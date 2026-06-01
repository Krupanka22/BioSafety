import axios from 'axios';
import cache from './cacheManager.js';
import logger from '../utils/logger.js';

/**
 * @deprecated Not used — AQI is fetched via OpenWeatherMap air_pollution API.
 * See weatherService.js fetchOpenWeatherForLocation().
 */

const CPCB_BASE = 'https://app.cpcbccr.com/ccr_docs/all_city_air_quality';
const CACHE_TTL = 300_000; // 5 min

/**
 * Map of major Indian cities to approximate coordinates for matching.
 */
const CITY_COORDS = {
  'Bengaluru': { lat: 12.97, lng: 77.59 },
  'Bangalore': { lat: 12.97, lng: 77.59 },
  'Delhi':     { lat: 28.61, lng: 77.21 },
  'Mumbai':    { lat: 19.08, lng: 72.88 },
  'Chennai':   { lat: 13.08, lng: 80.27 },
  'Hyderabad': { lat: 17.39, lng: 78.49 },
  'Kolkata':   { lat: 22.57, lng: 88.36 },
  'Pune':      { lat: 18.52, lng: 73.86 },
};

/**
 * Fetch CPCB data and find stations closest to given coordinates.
 * CPCB's public API can be unreliable, so we provide a graceful fallback.
 */
export async function fetchCPCBData(lat, lng) {
  const cacheKey = `cpcb:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    // CPCB doesn't have a proper lat/lng API – we try their public JSON endpoint
    const resp = await axios.get(CPCB_BASE, { timeout: 8_000 });
    const records = resp.data || [];

    // Find closest city
    let bestMatch = null;
    let bestDist = Infinity;

    for (const [city, coords] of Object.entries(CITY_COORDS)) {
      const dist = Math.sqrt(Math.pow(lat - coords.lat, 2) + Math.pow(lng - coords.lng, 2));
      if (dist < bestDist) {
        bestDist = dist;
        bestMatch = city;
      }
    }

    // Try to find matching station from CPCB data
    let stationData = null;
    if (Array.isArray(records)) {
      stationData = records.find(
        (r) => r.city?.toLowerCase().includes(bestMatch?.toLowerCase() || '')
      );
    }

    const result = {
      aqi: stationData?.aqi ? parseInt(stationData.aqi, 10) : null,
      city: bestMatch,
      stationName: stationData?.station || `Nearest to ${bestMatch}`,
      pollutants: {
        pm25: stationData?.pm25 ? parseFloat(stationData.pm25) : null,
        pm10: stationData?.pm10 ? parseFloat(stationData.pm10) : null,
        no2:  stationData?.no2  ? parseFloat(stationData.no2)  : null,
        so2:  stationData?.so2  ? parseFloat(stationData.so2)  : null,
        co:   stationData?.co   ? parseFloat(stationData.co)   : null,
        o3:   stationData?.o3   ? parseFloat(stationData.o3)   : null,
      },
      timestamp: new Date().toISOString(),
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.warn(`CPCB fetch failed (expected if outside India): ${err.message}`);
    return {
      aqi: null,
      city: null,
      stationName: null,
      pollutants: {},
      timestamp: new Date().toISOString(),
    };
  }
}

export default { fetchCPCBData };
