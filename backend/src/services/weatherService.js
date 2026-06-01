import axios from 'axios';
import cache from './cacheManager.js';
import logger from '../utils/logger.js';

/**
 * OpenWeatherMap — unified live weather + air pollution for every H3 cell.
 * Endpoints: /weather, /uvi, /air_pollution (single API key).
 */

const OWM_BASE = 'https://api.openweathermap.org/data/2.5';
const CACHE_TTL =
  parseInt(process.env.OWM_CACHE_TTL_MS, 10) ||
  Math.max(20_000, (parseInt(process.env.POLL_INTERVAL_MS, 10) || 30_000) - 5000);

/** EPA PM2.5 breakpoints (µg/m³) → AQI */
const PM25_BREAKPOINTS = [
  { lo: 0, hi: 12, aqiLo: 0, aqiHi: 50 },
  { lo: 12.1, hi: 35.4, aqiLo: 51, aqiHi: 100 },
  { lo: 35.5, hi: 55.4, aqiLo: 101, aqiHi: 150 },
  { lo: 55.5, hi: 150.4, aqiLo: 151, aqiHi: 200 },
  { lo: 150.5, hi: 250.4, aqiLo: 201, aqiHi: 300 },
  { lo: 250.5, hi: 350.4, aqiLo: 301, aqiHi: 400 },
  { lo: 350.5, hi: 500.4, aqiLo: 401, aqiHi: 500 },
];

function getApiKey() {
  return process.env.OPENWEATHERMAP_API_KEY || '';
}

function calcSubIndex(value, breakpoints) {
  for (const bp of breakpoints) {
    if (value >= bp.lo && value <= bp.hi) {
      return Math.round(((bp.aqiHi - bp.aqiLo) / (bp.hi - bp.lo)) * (value - bp.lo) + bp.aqiLo);
    }
  }
  return Math.min(Math.round(value), 500);
}

/** OWM air_pollution `main.aqi` is 1–5; map to approximate EPA scale when PM2.5 missing */
function owmIndexToEpaAqi(owmIndex) {
  const map = { 1: 25, 2: 75, 3: 125, 4: 175, 5: 275 };
  return map[owmIndex] ?? null;
}

export function pm25ToEpaAqi(pm25) {
  if (pm25 == null || pm25 < 0) return null;
  return calcSubIndex(pm25, PM25_BREAKPOINTS);
}

function computeWeatherRiskModifier(weather) {
  if (weather.humidity == null || weather.temp == null) return null;

  let risk = 0;
  if (weather.humidity > 80) risk += 30;
  else if (weather.humidity > 60) risk += 20;
  else if (weather.humidity > 40) risk += 10;

  const temp = weather.temp;
  if (temp >= 20 && temp <= 35) risk += 25;
  else if (temp >= 15 && temp <= 40) risk += 15;
  else risk += 5;

  const wind = weather.windSpeed ?? 5;
  if (wind < 2) risk += 20;
  else if (wind < 5) risk += 12;
  else if (wind < 10) risk += 5;

  if (weather.uvIndex != null) {
    if (weather.uvIndex < 3) risk += 15;
    else if (weather.uvIndex < 6) risk += 8;
  }

  if (weather.rainfall > 10) risk += 10;
  else if (weather.rainfall > 0) risk += 3;

  return Math.min(risk, 100);
}

function unavailablePayload() {
  return {
    available: false,
    temp: null,
    humidity: null,
    windSpeed: null,
    uvIndex: null,
    rainfall: null,
    pressure: null,
    condition: null,
    description: null,
    icon: null,
    feelsLike: null,
    visibility: null,
    weatherRiskModifier: null,
    aqi: null,
    aqiLevel: null,
    pm25: null,
    pm10: null,
    co: null,
    no: null,
    no2: null,
    so2: null,
    o3: null,
    nh3: null,
    aqiNormalized: null,
    timestamp: new Date().toISOString(),
    source: 'openweathermap',
  };
}

/**
 * Fetch live weather + air pollution for one H3 cell — cache is per hex, never shared across cells.
 */
export async function fetchOpenWeatherForHex(h3Index, lat, lng) {
  const cacheKey = `owm:hex:${h3Index}`;
  const cached = cache.get(cacheKey);
  if (cached) return { ...cached, h3Index, lat, lng };

  const result = await fetchOpenWeatherFromApi(lat, lng);
  const withMeta = { ...result, h3Index, lat, lng };
  cache.set(cacheKey, withMeta, CACHE_TTL);
  return withMeta;
}

/**
 * Legacy coordinate fetch — prefer fetchOpenWeatherForHex to avoid cross-cell reuse.
 */
export async function fetchOpenWeatherForLocation(lat, lng, h3Index = null) {
  if (h3Index) return fetchOpenWeatherForHex(h3Index, lat, lng);

  const cacheKey = `owm:coord:${lat.toFixed(6)}:${lng.toFixed(6)}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const result = await fetchOpenWeatherFromApi(lat, lng);
  cache.set(cacheKey, result, CACHE_TTL);
  return result;
}

async function fetchOpenWeatherFromApi(lat, lng) {

  const apiKey = getApiKey();
  if (!apiKey) {
    logger.warn('OPENWEATHERMAP_API_KEY not set — live weather/AQI unavailable');
    return unavailablePayload();
  }

  try {
    const [weatherResp, uvResp, airResp] = await Promise.allSettled([
      axios.get(`${OWM_BASE}/weather`, {
        params: { lat, lon: lng, appid: apiKey, units: 'metric' },
        timeout: 10_000,
      }),
      axios.get(`${OWM_BASE}/uvi`, {
        params: { lat, lon: lng, appid: apiKey },
        timeout: 10_000,
      }),
      axios.get(`${OWM_BASE}/air_pollution`, {
        params: { lat, lon: lng, appid: apiKey },
        timeout: 10_000,
      }),
    ]);

    const w = weatherResp.status === 'fulfilled' ? weatherResp.value.data : null;
    const uv = uvResp.status === 'fulfilled' ? uvResp.value.data : null;
    const air = airResp.status === 'fulfilled' ? airResp.value.data : null;

    if (!w && !air) throw new Error('OpenWeatherMap returned no weather or air data');

    const airEntry = air?.list?.[0];
    const components = airEntry?.components || {};
    const owmAqiLevel = airEntry?.main?.aqi ?? null;

    const pm25 = components.pm2_5 != null ? +components.pm2_5.toFixed(2) : null;
    const pm10 = components.pm10 != null ? +components.pm10.toFixed(2) : null;
    const co = components.co != null ? +components.co.toFixed(2) : null;
    const no = components.no != null ? +components.no.toFixed(4) : null;
    const no2 = components.no2 != null ? +components.no2.toFixed(2) : null;
    const so2 = components.so2 != null ? +components.so2.toFixed(2) : null;
    const o3 = components.o3 != null ? +components.o3.toFixed(2) : null;
    const nh3 = components.nh3 != null ? +components.nh3.toFixed(2) : null;

    let epaAqi = pm25ToEpaAqi(pm25);
    if (epaAqi == null && owmAqiLevel != null) {
      epaAqi = owmIndexToEpaAqi(owmAqiLevel);
    }

    const weatherSlice = {
      temp: w?.main?.temp ?? null,
      humidity: w?.main?.humidity ?? null,
      windSpeed: w?.wind?.speed ?? null,
      uvIndex: uv?.value ?? null,
      rainfall: w?.rain?.['1h'] ?? w?.rain?.['3h'] ?? 0,
      pressure: w?.main?.pressure ?? null,
      condition: w?.weather?.[0]?.main ?? null,
      description: w?.weather?.[0]?.description ?? null,
      icon: w?.weather?.[0]?.icon ?? null,
      feelsLike: w?.main?.feels_like ?? w?.main?.temp ?? null,
      visibility: w?.visibility ?? null,
    };

    const weatherAvailable = weatherSlice.temp != null && weatherSlice.humidity != null;
    const airAvailable = epaAqi != null && epaAqi > 0;

    const result = {
      available: weatherAvailable || airAvailable,
      ...weatherSlice,
      weatherRiskModifier: weatherAvailable ? computeWeatherRiskModifier(weatherSlice) : null,
      aqi: epaAqi,
      aqiLevel: owmAqiLevel,
      pm25,
      pm10,
      co,
      no,
      no2,
      so2,
      o3,
      nh3,
      aqiNormalized: airAvailable ? normaliseAqiForRisk(epaAqi) : null,
      timestamp: new Date().toISOString(),
      source: 'openweathermap',
    };

    return result;
  } catch (err) {
    logger.error(`OpenWeatherMap unified fetch failed: ${err.message}`);
    return unavailablePayload();
  }
}

/** Map EPA AQI (0–500) to 0–100 biosafety risk contribution */
export function normaliseAqiForRisk(aqi) {
  if (aqi == null || aqi <= 0) return null;
  if (aqi <= 50) return aqi * 0.2;
  if (aqi <= 100) return 10 + (aqi - 50);
  if (aqi <= 200) return 60 + (aqi - 100) * 0.3;
  return Math.min(90 + (aqi - 200) * 0.05, 100);
}

/** @deprecated Use fetchOpenWeatherForLocation — kept for compatibility */
export async function fetchWeatherForLocation(lat, lng) {
  const data = await fetchOpenWeatherForLocation(lat, lng);
  return {
    available: data.available && data.weatherRiskModifier != null,
    temp: data.temp,
    humidity: data.humidity,
    windSpeed: data.windSpeed,
    uvIndex: data.uvIndex,
    rainfall: data.rainfall,
    pressure: data.pressure,
    condition: data.condition,
    description: data.description,
    icon: data.icon,
    feelsLike: data.feelsLike,
    visibility: data.visibility,
    weatherRiskModifier: data.weatherRiskModifier,
    timestamp: data.timestamp,
    source: data.source,
  };
}

/** AQI-only view from unified OpenWeatherMap response */
export async function fetchAQIFromOpenWeather(lat, lng) {
  const data = await fetchOpenWeatherForLocation(lat, lng);
  return {
    available: data.aqi != null && data.aqi > 0,
    aqi: data.aqi,
    aqiLevel: data.aqiLevel,
    pm25: data.pm25,
    pm10: data.pm10,
    co: data.co,
    no: data.no,
    no2: data.no2,
    so2: data.so2,
    o3: data.o3,
    nh3: data.nh3,
    score: data.aqiNormalized,
    stationCount: data.available ? 1 : 0,
    timestamp: data.timestamp,
    source: 'openweathermap',
  };
}

export default {
  fetchOpenWeatherForHex,
  fetchOpenWeatherForLocation,
  fetchWeatherForLocation,
  fetchAQIFromOpenWeather,
  pm25ToEpaAqi,
  normaliseAqiForRisk,
};
