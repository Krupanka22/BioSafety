import axios from 'axios';
import cache from './cacheManager.js';
import { latLngToH3, getHexBbox } from './h3GridEngine.js';
import logger from '../utils/logger.js';

/**
 * Crowd Density — 100% free geospatial intelligence (OpenStreetMap + Overpass).
 * No paid crowd APIs or tokens required.
 *
 * Signals: transport hubs, malls, markets, tourist sites, intersections, rush hour.
 */

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';
const OVERPASS_MIRRORS = (process.env.OVERPASS_MIRRORS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const CACHE_TTL = parseInt(process.env.CROWD_CACHE_TTL_MS, 10) || 120_000;

/** Weight map for crowd-relevant OSM features */
const CROWD_WEIGHTS = {
  train_station: 8,
  subway_entrance: 7,
  station: 7,
  bus_station: 6,
  ferry_terminal: 5,
  bus_stop: 2,
  marketplace: 7,
  mall: 8,
  department_store: 6,
  supermarket: 4,
  food_court: 5,
  attraction: 6,
  museum: 5,
  theme_park: 7,
  zoo: 6,
  stadium: 8,
  sports_centre: 6,
  cinema: 5,
  theatre: 5,
  events_venue: 7,
  community_centre: 4,
  place_of_worship: 4,
  tourism: 5,
  traffic_signals: 3,
  motorway_junction: 5,
  junction: 4,
  crossing: 2,
  halt: 5,
};

const crowdHistory = new Map(); // h3Index → [{score, ts}]
const MAX_CROWD_HISTORY = 120;

/** In-memory grid snapshot (one Overpass call per pipeline cycle) */
let activeGridSnapshot = null;

function getRushHourMultiplier(date = new Date()) {
  const hour = date.getHours();
  const day = date.getDay();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend && hour >= 11 && hour <= 20) return 1.25;
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) return 1.4;
  if (hour >= 11 && hour <= 16) return 1.15;
  if (hour >= 22 || hour <= 6) return 0.75;
  return 1.0;
}

function getHistoricalCongestionFactor(h3Index, currentBase) {
  const hist = crowdHistory.get(h3Index);
  if (!hist || hist.length < 3) return 1.0;
  const recent = hist.slice(-8);
  const avg = recent.reduce((s, h) => s + h.score, 0) / recent.length;
  if (currentBase > avg * 1.15) return 1.12;
  if (currentBase < avg * 0.85) return 0.92;
  return 1.0;
}

function recordCrowdHistory(h3Index, score) {
  if (!crowdHistory.has(h3Index)) crowdHistory.set(h3Index, []);
  const list = crowdHistory.get(h3Index);
  list.push({ score, timestamp: new Date().toISOString() });
  if (list.length > MAX_CROWD_HISTORY) list.shift();
}

function buildCrowdOverpassQuery(south, west, north, east) {
  return `
    [out:json][timeout:25];
    (
      node["amenity"~"bus_station|train_station|ferry_terminal|marketplace|food_court"](${south},${west},${north},${east});
      node["railway"~"station|halt|subway_entrance"](${south},${west},${north},${east});
      node["public_transport"~"station|stop_position|platform"](${south},${west},${north},${east});
      node["shop"~"mall|department_store|supermarket"](${south},${west},${north},${east});
      node["tourism"~"attraction|museum|zoo|theme_park|viewpoint"](${south},${west},${north},${east});
      node["leisure"~"stadium|sports_centre|water_park"](${south},${west},${north},${east});
      node["amenity"~"cinema|theatre|events_venue|community_centre"](${south},${west},${north},${east});
      node["highway"="traffic_signals"](${south},${west},${north},${east});
      node["highway"="motorway_junction"](${south},${west},${north},${east});
      node["junction"](${south},${west},${north},${east});
      way["amenity"~"bus_station|train_station|marketplace"](${south},${west},${north},${east});
      way["railway"="station"](${south},${west},${north},${east});
      way["shop"="mall"](${south},${west},${north},${east});
    );
    out center;
  `;
}

function elementCoords(el) {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

function classifyFeature(el) {
  const t = el.tags || {};
  if (t.railway === 'station' || t.railway === 'halt') return t.railway === 'halt' ? 'halt' : 'train_station';
  if (t.railway === 'subway_entrance') return 'subway_entrance';
  if (t.amenity) return t.amenity;
  if (t.shop) return t.shop;
  if (t.tourism) return t.tourism;
  if (t.leisure) return t.leisure;
  if (t.highway === 'traffic_signals') return 'traffic_signals';
  if (t.highway === 'motorway_junction') return 'motorway_junction';
  if (t.junction) return 'junction';
  if (t.public_transport) return t.public_transport;
  return 'other';
}

function computeBboxForHexList(hexList, paddingKm = 0.3) {
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;

  for (const hex of hexList) {
    south = Math.min(south, hex.lat);
    north = Math.max(north, hex.lat);
    west = Math.min(west, hex.lng);
    east = Math.max(east, hex.lng);
  }

  const pad = paddingKm / 111.32;
  const midLat = (south + north) / 2;
  const padLng = paddingKm / (111.32 * Math.cos((midLat * Math.PI) / 180));

  return {
    south: south - pad,
    north: north + pad,
    west: west - padLng,
    east: east + padLng,
  };
}

async function queryOverpass(query) {
  const endpoints = [OVERPASS_URL, ...OVERPASS_MIRRORS];
  let lastErr;

  for (const url of endpoints) {
    try {
      const resp = await axios.post(url, `data=${encodeURIComponent(query)}`, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: parseInt(process.env.OVERPASS_TIMEOUT_MS, 10) || 35_000,
      });
      return resp.data?.elements || [];
    } catch (err) {
      lastErr = err;
      logger.warn(`Overpass crowd query failed (${url}): ${err.message}`);
    }
  }

  throw lastErr || new Error('All Overpass endpoints failed');
}

/**
 * One Overpass fetch for the entire H3 grid — avoids 37× duplicate calls.
 */
export async function fetchCrowdGridSnapshot(hexList) {
  if (!hexList?.length) {
    return { available: false, perHex: {}, amenities: [], categories: {} };
  }

  const gridKey = hexList
    .map((h) => h.h3Index)
    .sort()
    .join('|');
  const cacheKey = `crowd:grid:${gridKey}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    activeGridSnapshot = cached;
    return cached;
  }

  const bbox = computeBboxForHexList(hexList);
  const hexSet = new Set(hexList.map((h) => h.h3Index));

  const perHex = {};
  for (const hex of hexList) {
    perHex[hex.h3Index] = {
      weightedSum: 0,
      poiCount: 0,
      categories: {},
      hotspots: [],
      transportNodes: 0,
      commercialHubs: 0,
      intersections: 0,
    };
  }

  try {
    const elements = await queryOverpass(
      buildCrowdOverpassQuery(bbox.south, bbox.west, bbox.north, bbox.east)
    );

    const rushMult = getRushHourMultiplier();
    const allAmenities = [];
    const globalCategories = {};

    for (const el of elements) {
      const coords = elementCoords(el);
      if (!coords) continue;

      const type = classifyFeature(el);
      const weight = CROWD_WEIGHTS[type] || (type === 'other' ? 0 : 1);
      if (weight <= 0) continue;

      const h3Index = latLngToH3(coords.lat, coords.lng);
      if (!hexSet.has(h3Index)) continue;

      const bucket = perHex[h3Index];
      bucket.weightedSum += weight;
      bucket.poiCount += 1;
      bucket.categories[type] = (bucket.categories[type] || 0) + 1;
      globalCategories[type] = (globalCategories[type] || 0) + 1;

      if (['train_station', 'subway_entrance', 'bus_station', 'station', 'halt', 'ferry_terminal'].includes(type)) {
        bucket.transportNodes += 1;
      }
      if (['mall', 'marketplace', 'department_store', 'supermarket', 'food_court'].includes(type)) {
        bucket.commercialHubs += 1;
      }
      if (['traffic_signals', 'motorway_junction', 'junction', 'crossing'].includes(type)) {
        bucket.intersections += 1;
      }

      if (weight >= 5) {
        bucket.hotspots.push({
          name: el.tags?.name || type,
          type,
          lat: coords.lat,
          lng: coords.lng,
        });
      }

      allAmenities.push({
        id: el.id,
        name: el.tags?.name || type,
        type,
        lat: coords.lat,
        lng: coords.lng,
        h3Index,
        tags: { description: el.tags?.description, note: el.tags?.note },
      });
    }

    const perHexScores = {};
    for (const hex of hexList) {
      const b = perHex[hex.h3Index];
      const baseScore = Math.min(
        100,
        Math.round((b.weightedSum / 18) * 55 + b.intersections * 2 + b.transportNodes * 3)
      );
      const histFactor = getHistoricalCongestionFactor(hex.h3Index, baseScore);
      const finalScore = Math.min(100, Math.round(baseScore * rushMult * histFactor));

      recordCrowdHistory(hex.h3Index, finalScore);

      perHexScores[hex.h3Index] = {
        available: b.poiCount > 0 || b.intersections > 0,
        crowdDensityScore: b.poiCount > 0 || b.intersections > 0 ? finalScore : null,
        poiCount: b.poiCount,
        categories: b.categories,
        infrastructure: {
          transportHubs: b.transportNodes,
          commercialHubs: b.commercialHubs,
          intersections: b.intersections,
          crowdedPlaces: b.hotspots.length,
        },
        hotspots: b.hotspots.slice(0, 10),
        rushHourMultiplier: rushMult,
        historicalFactor: histFactor,
        source: 'openstreetmap+overpass',
      };
    }

    const snapshot = {
      available: elements.length > 0,
      perHex: perHexScores,
      amenities: allAmenities.slice(0, 200),
      categories: globalCategories,
      elementCount: elements.length,
      bbox,
      timestamp: new Date().toISOString(),
      source: 'openstreetmap+overpass',
    };

    cache.set(cacheKey, snapshot, CACHE_TTL);
    activeGridSnapshot = snapshot;
    return snapshot;
  } catch (err) {
    logger.error(`Crowd grid snapshot failed: ${err.message}`);
    const empty = {
      available: false,
      perHex: Object.fromEntries(
        hexList.map((h) => [
          h.h3Index,
          { available: false, crowdDensityScore: null, source: 'openstreetmap+overpass' },
        ])
      ),
      amenities: [],
      categories: {},
      timestamp: new Date().toISOString(),
      source: 'openstreetmap+overpass',
    };
    activeGridSnapshot = empty;
    return empty;
  }
}

function scoreCrowdBucket(bucket, h3Index) {
  const rushMult = getRushHourMultiplier();
  const baseScore = Math.min(
    100,
    Math.round((bucket.weightedSum / 18) * 55 + bucket.intersections * 2 + bucket.transportNodes * 3)
  );
  const histFactor = getHistoricalCongestionFactor(h3Index, baseScore);
  const finalScore = Math.min(100, Math.round(baseScore * rushMult * histFactor));
  recordCrowdHistory(h3Index, finalScore);

  return {
    available: bucket.poiCount > 0 || bucket.intersections > 0,
    crowdDensityScore: bucket.poiCount > 0 || bucket.intersections > 0 ? finalScore : null,
    poiCount: bucket.poiCount,
    categories: bucket.categories,
    infrastructure: {
      transportHubs: bucket.transportNodes,
      commercialHubs: bucket.commercialHubs,
      intersections: bucket.intersections,
      crowdedPlaces: bucket.hotspots.length,
    },
    hotspots: bucket.hotspots.slice(0, 10),
    rushHourMultiplier: rushMult,
    historicalFactor: histFactor,
    lat: bucket.lat,
    lng: bucket.lng,
    source: 'openstreetmap+overpass',
  };
}

/**
 * Independent crowd analysis for one H3 cell — Overpass query on this hex's bbox only.
 */
export async function fetchCrowdForHexIndependent(h3Index, lat, lng) {
  const cacheKey = `crowd:hex:${h3Index}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const bbox = getHexBbox(h3Index);
  const pad = 0.0015;
  const south = bbox.south - pad;
  const north = bbox.north + pad;
  const west = bbox.west - pad;
  const east = bbox.east + pad;

  const bucket = {
    weightedSum: 0,
    poiCount: 0,
    categories: {},
    hotspots: [],
    transportNodes: 0,
    commercialHubs: 0,
    intersections: 0,
    lat,
    lng,
  };

  try {
    const elements = await queryOverpass(
      buildCrowdOverpassQuery(south, west, north, east)
    );

    for (const el of elements) {
      const coords = elementCoords(el);
      if (!coords) continue;

      const type = classifyFeature(el);
      const weight = CROWD_WEIGHTS[type] || (type === 'other' ? 0 : 1);
      if (weight <= 0) continue;

      bucket.weightedSum += weight;
      bucket.poiCount += 1;
      bucket.categories[type] = (bucket.categories[type] || 0) + 1;

      if (['train_station', 'subway_entrance', 'bus_station', 'station', 'halt', 'ferry_terminal'].includes(type)) {
        bucket.transportNodes += 1;
      }
      if (['mall', 'marketplace', 'department_store', 'supermarket', 'food_court'].includes(type)) {
        bucket.commercialHubs += 1;
      }
      if (['traffic_signals', 'motorway_junction', 'junction', 'crossing'].includes(type)) {
        bucket.intersections += 1;
      }
      if (weight >= 5) {
        bucket.hotspots.push({
          name: el.tags?.name || type,
          type,
          lat: coords.lat,
          lng: coords.lng,
        });
      }
    }

    const result = scoreCrowdBucket(bucket, h3Index);
    result.fetchedAt = new Date().toISOString();
    cache.set(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.warn(`Per-hex crowd fetch failed ${h3Index}: ${err.message}`);
    return {
      available: false,
      crowdDensityScore: null,
      h3Index,
      lat,
      lng,
      source: 'openstreetmap+overpass',
    };
  }
}

/**
 * Crowd data for a single hex — prefers independent hex bbox fetch.
 */
export async function fetchCrowdForHex(h3Index, lat, lng, gridContext = null) {
  const independent = await fetchCrowdForHexIndependent(h3Index, lat, lng);
  if (independent.available) return independent;

  if (gridContext?.perHex?.[h3Index]) return gridContext.perHex[h3Index];
  if (activeGridSnapshot?.perHex?.[h3Index]) return activeGridSnapshot.perHex[h3Index];

  return independent;
}

/**
 * OSM-shaped payload for hygiene service (shared grid amenities).
 */
export function crowdSnapshotToOsmData(snapshot, h3Index) {
  const hex = snapshot?.perHex?.[h3Index];
  const hexAmenities = (snapshot?.amenities || []).filter((a) => a.h3Index === h3Index);

  return {
    available: hex?.available || hexAmenities.length > 0,
    poiCount: hex?.poiCount || hexAmenities.length,
    categories: hex?.categories || {},
    crowdDensityScore: hex?.crowdDensityScore ?? null,
    infrastructure: hex?.infrastructure || {},
    amenities: hexAmenities,
    timestamp: snapshot?.timestamp,
    source: 'openstreetmap+overpass',
  };
}

export function clearCrowdGridSnapshot() {
  activeGridSnapshot = null;
}

export default {
  fetchCrowdGridSnapshot,
  fetchCrowdForHex,
  fetchCrowdForHexIndependent,
  crowdSnapshotToOsmData,
  clearCrowdGridSnapshot,
  getRushHourMultiplier,
};
