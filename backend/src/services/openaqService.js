import axios from 'axios';
import cache from './cacheManager.js';
import logger from '../utils/logger.js';

/**
 * @deprecated Not used — AQI is fetched via OpenWeatherMap air_pollution API.
 * See weatherService.js fetchOpenWeatherForLocation().
 */

const OPENAQ_BASE = 'https://api.openaq.org/v2';
const CACHE_TTL = 300_000; // 5 min

/**
 * EPA breakpoints for PM2.5 (µg/m³ 24-hr) → AQI sub-index.
 */
const PM25_BREAKPOINTS = [
  { lo: 0,    hi: 12,    aqiLo: 0,   aqiHi: 50  },
  { lo: 12.1, hi: 35.4,  aqiLo: 51,  aqiHi: 100 },
  { lo: 35.5, hi: 55.4,  aqiLo: 101, aqiHi: 150 },
  { lo: 55.5, hi: 150.4, aqiLo: 151, aqiHi: 200 },
  { lo: 150.5,hi: 250.4, aqiLo: 201, aqiHi: 300 },
  { lo: 250.5,hi: 350.4, aqiLo: 301, aqiHi: 400 },
  { lo: 350.5,hi: 500.4, aqiLo: 401, aqiHi: 500 },
];

function calcSubIndex(value, breakpoints) {
  for (const bp of breakpoints) {
    if (value >= bp.lo && value <= bp.hi) {
      return Math.round(
        ((bp.aqiHi - bp.aqiLo) / (bp.hi - bp.lo)) * (value - bp.lo) + bp.aqiLo
      );
    }
  }
  return Math.min(Math.round(value), 500);
}

/**
 * Fetch AQI data for a location.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 * @returns {Promise<{aqi:number,pm25:number|null,pm10:number|null,no2:number|null,co:number|null,o3:number|null,stations:object[],timestamp:string}>}
 */
export async function fetchAQIForLocation(lat, lng, radiusKm = 10) {
  const cacheKey = `openaq:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const resp = await axios.get(`${OPENAQ_BASE}/latest`, {
      params: {
        coordinates: `${lat},${lng}`,
        radius: radiusKm * 1000, // metres
        limit: 20,
        order_by: 'distance',
      },
      timeout: 10_000,
    });

    const results = resp.data?.results || [];

    // Aggregate pollutant readings across nearby stations
    const pollutants = { pm25: [], pm10: [], no2: [], co: [], o3: [], so2: [] };
    const stations = [];

    for (const station of results) {
      const stationInfo = {
        id: station.location,
        name: station.location,
        distance: station.distance,
        measurements: {},
      };

      for (const m of station.measurements || []) {
        const param = m.parameter?.toLowerCase();
        const val = m.value;
        if (val == null || val < 0) continue;
        if (param === 'pm25' || param === 'pm2.5') { pollutants.pm25.push(val); stationInfo.measurements.pm25 = val; }
        else if (param === 'pm10')  { pollutants.pm10.push(val); stationInfo.measurements.pm10 = val; }
        else if (param === 'no2')   { pollutants.no2.push(val);  stationInfo.measurements.no2  = val; }
        else if (param === 'co')    { pollutants.co.push(val);   stationInfo.measurements.co   = val; }
        else if (param === 'o3')    { pollutants.o3.push(val);   stationInfo.measurements.o3   = val; }
        else if (param === 'so2')   { pollutants.so2.push(val);  stationInfo.measurements.so2  = val; }
      }
      stations.push(stationInfo);
    }

    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const pm25 = avg(pollutants.pm25);
    const pm10 = avg(pollutants.pm10);
    const no2  = avg(pollutants.no2);
    const co   = avg(pollutants.co);
    const o3   = avg(pollutants.o3);

    // Compute AQI from PM2.5 (primary pollutant) or fallback to estimate
    let aqi = 0;
    if (pm25 !== null) {
      aqi = calcSubIndex(pm25, PM25_BREAKPOINTS);
    } else if (pm10 !== null) {
      aqi = Math.round(pm10 * 0.8); // rough estimate
    }

    const result = {
      available: stations.length > 0 || aqi > 0,
      aqi: aqi > 0 ? Math.min(aqi, 500) : null,
      pm25: pm25 !== null ? +pm25.toFixed(1) : null,
      pm10: pm10 !== null ? +pm10.toFixed(1) : null,
      no2:  no2  !== null ? +no2.toFixed(1)  : null,
      co:   co   !== null ? +co.toFixed(1)   : null,
      o3:   o3   !== null ? +o3.toFixed(1)   : null,
      stations,
      stationCount: stations.length,
      timestamp: new Date().toISOString(),
    };

    cache.set(cacheKey, result, CACHE_TTL);
    return result;
  } catch (err) {
    logger.error(`OpenAQ fetch failed: ${err.message}`);
    return {
      available: false,
      aqi: null,
      pm25: null,
      pm10: null,
      no2: null,
      co: null,
      o3: null,
      stations: [],
      stationCount: 0,
      timestamp: new Date().toISOString(),
      source: 'openaq',
    };
  }
}

export default { fetchAQIForLocation };
