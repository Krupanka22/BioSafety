import axios from 'axios';
import cache from './cacheManager.js';
import logger from '../utils/logger.js';

/**
 * Nominatim (OpenStreetMap) — free geocoding and nearby place search.
 * Usage policy: max 1 request/second; identify app via User-Agent.
 */

const NOMINATIM_BASE = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
const CACHE_TTL = 300_000; // 5 min
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'BioSafetyPlatform/1.0 (educational; contact@localhost)';

const client = axios.create({
  baseURL: NOMINATIM_BASE,
  timeout: 12_000,
  headers: { 'User-Agent': USER_AGENT },
});

/**
 * Reverse geocode coordinates to address / area name.
 */
export async function reverseGeocode(lat, lng) {
  const cacheKey = `nominatim:rev:${lat.toFixed(4)}:${lng.toFixed(4)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const resp = await client.get('/reverse', {
      params: { lat, lon: lng, format: 'json', addressdetails: 1 },
    });

    const data = resp.data || {};
    const result = {
      available: true,
      displayName: data.display_name || null,
      address: data.address || {},
      lat: parseFloat(data.lat) || lat,
      lng: parseFloat(data.lon) || lng,
      osmType: data.osm_type,
      osmId: data.osm_id,
      timestamp: new Date().toISOString(),
      source: 'nominatim',
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.warn(`Nominatim reverse geocode failed: ${err.message}`);
    return { available: false, displayName: null, address: {}, lat, lng, source: 'nominatim' };
  }
}

/**
 * Search nearby places (restaurants, hospitals, etc.) via Nominatim search.
 */
export async function searchNearbyPlaces(lat, lng, radiusKm = 0.5, limit = 15) {
  const cacheKey = `nominatim:near:${lat.toFixed(3)}:${lng.toFixed(3)}:${radiusKm}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const resp2 = await client.get('/search', {
      params: {
        q: `hospital restaurant cafe bus_station near ${lat},${lng}`,
        format: 'json',
        limit,
        addressdetails: 1,
      },
    });

    const merged = resp2.data || [];
    const seen = new Set();
    const places = [];

    for (const p of merged) {
      const key = `${p.osm_type}:${p.osm_id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const plat = parseFloat(p.lat);
      const plng = parseFloat(p.lon);
      if (Number.isNaN(plat)) continue;

      const distKm = haversineKm(lat, lng, plat, plng);
      if (distKm > radiusKm * 1.2) continue;

      places.push({
        name: p.display_name?.split(',')[0] || p.name || 'Unnamed place',
        fullName: p.display_name,
        type: p.type || p.class,
        category: p.category,
        lat: plat,
        lng: plng,
        distanceKm: +distKm.toFixed(3),
        osmType: p.osm_type,
        osmId: p.osm_id,
      });
    }

    places.sort((a, b) => a.distanceKm - b.distanceKm);

    const result = {
      available: places.length > 0,
      places: places.slice(0, limit),
      count: places.length,
      timestamp: new Date().toISOString(),
      source: 'nominatim',
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.warn(`Nominatim nearby search failed: ${err.message}`);
    return { available: false, places: [], count: 0, source: 'nominatim' };
  }
}

function buildViewbox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  const west = lng - lngDelta;
  const south = lat - latDelta;
  const east = lng + lngDelta;
  const north = lat + latDelta;
  return [west, north, east, south]; // nominatim: left, top, right, bottom
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default { reverseGeocode, searchNearbyPlaces };
