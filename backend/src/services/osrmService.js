import axios from 'axios';
import cache from './cacheManager.js';
import logger from '../utils/logger.js';
import { latLngToH3 } from './h3GridEngine.js';

/**
 * OSRM — free routing (Open Source Routing Machine).
 * Public demo: router.project-osrm.org (fair-use; set OSRM_URL for self-hosted).
 */

const OSRM_BASE = process.env.OSRM_URL || 'https://router.project-osrm.org';
const CACHE_TTL = 120_000;

/**
 * Get driving route between two points.
 */
export async function getRoute(fromLat, fromLng, toLat, toLng, profile = 'driving') {
  const cacheKey = `osrm:${fromLat.toFixed(4)}:${fromLng.toFixed(4)}:${toLat.toFixed(4)}:${toLng.toFixed(4)}:${profile}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const url = `${OSRM_BASE}/route/v1/${profile}/${coords}`;
    const resp = await axios.get(url, {
      params: { overview: 'full', geometries: 'geojson', steps: false },
      timeout: 12_000,
    });

    const route = resp.data?.routes?.[0];
    if (!route) {
      return { available: false, geometry: null, distanceM: 0, durationSec: 0 };
    }

    const result = {
      available: true,
      geometry: route.geometry,
      distanceM: route.distance,
      durationSec: route.duration,
      legs: route.legs,
      timestamp: new Date().toISOString(),
      source: 'osrm',
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.error(`OSRM route failed: ${err.message}`);
    return { available: false, geometry: null, distanceM: 0, durationSec: 0, source: 'osrm' };
  }
}

/**
 * Sample coordinates along a GeoJSON LineString every ~stepM meters.
 */
export function sampleRouteCoordinates(geometry, stepM = 200) {
  if (!geometry?.coordinates?.length) return [];

  const coords = geometry.coordinates; // [lng, lat]
  const samples = [[coords[0][1], coords[0][0]]];

  for (let i = 1; i < coords.length; i++) {
    const [lng0, lat0] = coords[i - 1];
    const [lng1, lat1] = coords[i];
    const segLen = haversineM(lat0, lng0, lat1, lng1);
    const steps = Math.max(1, Math.floor(segLen / stepM));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      samples.push([lat0 + (lat1 - lat0) * t, lng0 + (lng1 - lng0) * t]);
    }
  }

  return samples;
}

/**
 * Score a route against live hex biosafety scores; pick lower-risk alternative via waypoint.
 */
export function scoreRouteAgainstHexes(samplePoints, hexScores) {
  const scoreMap = new Map(hexScores.map((h) => [h.h3Index, h.biosafetyScore]));

  let total = 0;
  let max = 0;
  let count = 0;

  for (const [lat, lng] of samplePoints) {
    const h3 = latLngToH3(lat, lng);
    const score = scoreMap.get(h3);
    if (score !== undefined) {
      total += score;
      max = Math.max(max, score);
      count++;
    }
  }

  return {
    avgRisk: count > 0 ? Math.round(total / count) : null,
    maxRisk: count > 0 ? max : null,
    sampledPoints: count,
  };
}

/**
 * Suggest a safer route by routing through the lowest-risk nearby hex center.
 */
export async function getSafeRoute(fromLat, fromLng, toLat, toLng, hexScores = []) {
  const direct = await getRoute(fromLat, fromLng, toLat, toLng);
  if (!direct.available) return { direct, alternative: null, recommendation: 'unavailable' };

  const directSamples = sampleRouteCoordinates(direct.geometry);
  const directRisk = scoreRouteAgainstHexes(directSamples, hexScores);

  let alternative = null;
  let altRisk = null;

  if (hexScores.length > 3) {
    const sorted = [...hexScores].sort((a, b) => a.biosafetyScore - b.biosafetyScore);
    const waypoint = sorted[Math.floor(sorted.length * 0.1)]; // low-risk decile

    if (waypoint) {
      try {
        const coords = `${fromLng},${fromLat};${waypoint.lng},${waypoint.lat};${toLng},${toLat}`;
        const url = `${OSRM_BASE}/route/v1/driving/${coords}`;
        const resp = await axios.get(url, {
          params: { overview: 'full', geometries: 'geojson' },
          timeout: 12_000,
        });
        const route = resp.data?.routes?.[0];
        if (route) {
          alternative = {
            available: true,
            geometry: route.geometry,
            distanceM: route.distance,
            durationSec: route.duration,
            waypoint: { lat: waypoint.lat, lng: waypoint.lng, h3Index: waypoint.h3Index },
            source: 'osrm',
          };
          altRisk = scoreRouteAgainstHexes(
            sampleRouteCoordinates(alternative.geometry),
            hexScores
          );
        }
      } catch (err) {
        logger.warn(`OSRM safe route waypoint failed: ${err.message}`);
      }
    }
  }

  const recommendation =
    alternative && altRisk?.avgRisk != null && directRisk?.avgRisk != null && altRisk.avgRisk < directRisk.avgRisk - 5
      ? 'alternative'
      : 'direct';

  return {
    direct: { ...direct, risk: directRisk },
    alternative: alternative ? { ...alternative, risk: altRisk } : null,
    recommendation,
    timestamp: new Date().toISOString(),
  };
}

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default { getRoute, getSafeRoute, sampleRouteCoordinates, scoreRouteAgainstHexes };
