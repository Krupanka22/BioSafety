import logger from '../utils/logger.js';
import { crowdSnapshotToOsmData, fetchCrowdForHex, fetchCrowdGridSnapshot } from './crowdDensityService.js';
import { getHexCenter } from './h3GridEngine.js';
import { fetchHygieneScoreForLocation } from './hygieneService.js';
import { buildLocationReasoning } from './locationReasoning.js';
import { computeAdaptiveScore } from './scoreWeighting.js';
import { fetchOpenWeatherForHex, normaliseAqiForRisk } from './weatherService.js';

/**
 * Biosafety Score Engine — Each H3 cell uses its own coordinates for
 * OpenWeatherMap, Overpass crowd bbox, Nominatim/Hygiene, and reasoning.
 */

const scoreHistory = new Map();
const MAX_HISTORY = 1440;

const OWM_HEX_DELAY_MS = parseInt(process.env.OWM_HEX_DELAY_MS, 10) || 500; // Increased from 80ms to prevent rate limiting
const CROWD_HEX_DELAY_MS = parseInt(process.env.CROWD_HEX_DELAY_MS, 10) || 600; // Increased from 100ms to prevent rate limiting

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function getRiskLevel(score) {
  if (score >= 75) return 'CRITICAL';
  if (score >= 50) return 'HIGH';
  if (score >= 25) return 'MODERATE';
  return 'LOW';
}

function getRiskColor(score) {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f97316';
  if (score >= 25) return '#eab308';
  return '#22c55e';
}

function getHistoricalBaseline(h3Index) {
  const history = scoreHistory.get(h3Index);
  if (!history || history.length === 0) return 50;
  const recent = history.slice(-30);
  return recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
}

function recordScore(h3Index, score) {
  if (!scoreHistory.has(h3Index)) scoreHistory.set(h3Index, []);
  const history = scoreHistory.get(h3Index);
  history.push({ score, timestamp: new Date().toISOString() });
  if (history.length > MAX_HISTORY) history.shift();
}

/**
 * Compute biosafety for one H3 hex — independent API calls per cell center.
 */
export async function computeScoreForHex(h3Index, _context = {}) {
  const center = getHexCenter(h3Index);
  const { lat, lng } = center;

  const owmData = await fetchOpenWeatherForHex(h3Index, lat, lng);
  const crowdHex = await fetchCrowdForHex(h3Index, lat, lng, _context.crowdSnapshot);
  const osmData = crowdSnapshotToOsmData(
    { perHex: { [h3Index]: crowdHex }, amenities: [] },
    h3Index
  );
  const hygieneData = await fetchHygieneScoreForLocation(lat, lng, 0.5, osmData, h3Index);

  const effectiveAQI = owmData.aqi;
  const aqiAvailable = owmData.available && effectiveAQI != null && effectiveAQI > 0;
  const aqiNormalized = aqiAvailable ? normaliseAqiForRisk(effectiveAQI) : null;

  const weatherAvailable = owmData.available && owmData.weatherRiskModifier != null;
  const weatherRisk = weatherAvailable ? owmData.weatherRiskModifier : null;

  const crowdAvailable = crowdHex.available && crowdHex.crowdDensityScore != null;
  const crowdDensity = crowdAvailable ? crowdHex.crowdDensityScore : null;

  const hygieneAvailable = hygieneData.available && hygieneData.hygieneScore != null;
  const hygieneInverse = hygieneAvailable ? 100 - hygieneData.hygieneScore : null;

  const historicalBaseline = getHistoricalBaseline(h3Index);
  const historyPoints = scoreHistory.get(h3Index)?.length || 0;
  const historicalAvailable = historyPoints > 0;

  const { score: adaptiveScore } = computeAdaptiveScore({
    aqi: { value: aqiNormalized, available: aqiAvailable },
    weather: { value: weatherRisk, available: weatherAvailable },
    crowdDensity: { value: crowdDensity, available: crowdAvailable },
    hygiene: { value: hygieneInverse, available: hygieneAvailable },
    historical: { value: historicalBaseline, available: historicalAvailable },
  });

  const finalScore = adaptiveScore ?? 0;
  recordScore(h3Index, finalScore);

  let timeToSafe = '-';
  if (finalScore > 25) {
    timeToSafe = `${Math.round((finalScore / 100) * 48)}h`;
  }

  const result = {
    h3Index,
    lat,
    lng,
    biosafetyScore: finalScore,
    riskLevel: getRiskLevel(finalScore),
    riskColor: getRiskColor(finalScore),
    timeToSafe,
    breakdown: {
      aqi: {
        available: aqiAvailable,
        score: aqiNormalized != null ? Math.round(aqiNormalized) : null,
        raw: effectiveAQI,
        aqiLevel: owmData.aqiLevel,
        weight: 0.25,
        pm25: owmData.pm25,
        pm10: owmData.pm10,
        co: owmData.co,
        no: owmData.no,
        no2: owmData.no2,
        so2: owmData.so2,
        o3: owmData.o3,
        source: 'openweathermap',
        fetchedAt: owmData.timestamp,
      },
      weather: {
        available: weatherAvailable,
        score: weatherRisk != null ? Math.round(weatherRisk) : null,
        weight: 0.20,
        temp: owmData.temp,
        humidity: owmData.humidity,
        windSpeed: owmData.windSpeed,
        rainfall: owmData.rainfall,
        pressure: owmData.pressure,
        uvIndex: owmData.uvIndex,
        condition: owmData.condition,
        icon: owmData.icon,
        source: 'openweathermap',
        fetchedAt: owmData.timestamp,
      },
      crowdDensity: {
        available: crowdAvailable,
        score: crowdDensity,
        weight: 0.20,
        poiCount: crowdHex.poiCount,
        infrastructure: crowdHex.infrastructure,
        hotspots: crowdHex.hotspots ?? [],
        rushHourMultiplier: crowdHex.rushHourMultiplier,
        topCategories: Object.entries(crowdHex.categories || {})
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([category, count]) => ({ category, count })),
        source: 'openstreetmap+overpass',
        fetchedAt: crowdHex.fetchedAt,
      },
      hygiene: {
        available: hygieneAvailable,
        score: hygieneData.hygieneScore,
        inverseScore: hygieneInverse != null ? Math.round(hygieneInverse) : null,
        weight: 0.20,
        reviewCount: hygieneData.reviewCount,
        nlpSource: hygieneData.nlpSource,
        source: hygieneData.source,
      },
      historical: {
        available: historicalAvailable,
        score: Math.round(historicalBaseline),
        weight: 0.15,
        dataPoints: historyPoints,
        source: 'live_pipeline',
      },
    },
    timestamp: new Date().toISOString(),
  };

  result.reasoning = buildLocationReasoning(result);
  return result;
}

/**
 * Score full grid — each hex processed independently (sequential to respect API limits).
 */
export async function computeScoresForGrid(hexList) {
  const results = [];
  logger.info(`Scoring ${hexList.length} H3 cells independently (per-hex OWM + OSM)`);

  const gridSnapshot = await fetchCrowdGridSnapshot(hexList);

  for (let i = 0; i < hexList.length; i++) {
    const hex = hexList[i];
    try {
      const score = await computeScoreForHex(hex.h3Index, { crowdSnapshot: gridSnapshot });
      results.push(score);
    } catch (err) {
      logger.error(`Score computation failed for ${hex.h3Index}: ${err.message}`);
      results.push({
        h3Index: hex.h3Index,
        lat: hex.lat,
        lng: hex.lng,
        biosafetyScore: 0,
        riskLevel: 'UNKNOWN',
        riskColor: '#9ca3af',
        timeToSafe: '-',
        breakdown: {},
        timestamp: new Date().toISOString(),
        error: true,
      });
    }

    if (i < hexList.length - 1) {
      await sleep(Math.max(OWM_HEX_DELAY_MS, CROWD_HEX_DELAY_MS));
    }
  }

  return results;
}

export function getOverviewFromScores(scores) {
  if (!scores || scores.length === 0) {
    return {
      avgScore: 0,
      maxScore: 0,
      riskLevel: 'LOW',
      criticalCount: 0,
      highCount: 0,
      moderateCount: 0,
      lowCount: 0,
      timeToSafe: '-',
    };
  }

  const validScores = scores.filter((s) => !s.error);
  const avgScore = Math.round(
    validScores.reduce((sum, s) => sum + s.biosafetyScore, 0) / validScores.length
  );

  return {
    avgScore,
    maxScore: Math.max(...validScores.map((s) => s.biosafetyScore)),
    riskLevel: getRiskLevel(avgScore),
    riskColor: getRiskColor(avgScore),
    criticalCount: validScores.filter((s) => s.riskLevel === 'CRITICAL').length,
    highCount: validScores.filter((s) => s.riskLevel === 'HIGH').length,
    moderateCount: validScores.filter((s) => s.riskLevel === 'MODERATE').length,
    lowCount: validScores.filter((s) => s.riskLevel === 'LOW').length,
    timeToSafe: validScores[0]?.timeToSafe || '-',
    totalHexes: validScores.length,
  };
}

export function generateAlerts(previousScores, currentScores) {
  const alerts = [];
  const prevMap = new Map(previousScores.map((s) => [s.h3Index, s]));

  for (const current of currentScores) {
    const prev = prevMap.get(current.h3Index);

    if (current.riskLevel === 'CRITICAL' && (!prev || prev.riskLevel !== 'CRITICAL')) {
      alerts.push({
        id: `alert-${Date.now()}-${current.h3Index}`,
        title: '🔴 Critical Risk Zone Detected',
        message: `Area ${current.h3Index.slice(-6)}: ${current.reasoning?.summary || 'Critical risk'}`,
        severity: 'critical',
        h3Index: current.h3Index,
        score: current.biosafetyScore,
        timestamp: new Date().toISOString(),
      });
    }

    if (prev && current.biosafetyScore - prev.biosafetyScore > 15) {
      alerts.push({
        id: `alert-${Date.now()}-spike-${current.h3Index}`,
        title: '⚠️ Rapid Risk Increase',
        message: `Area ${current.h3Index.slice(-6)} risk spiked from ${prev.biosafetyScore} to ${current.biosafetyScore}`,
        severity: 'high',
        h3Index: current.h3Index,
        score: current.biosafetyScore,
        previousScore: prev.biosafetyScore,
        timestamp: new Date().toISOString(),
      });
    }

    if (current.breakdown?.crowdDensity?.score > 65) {
      const hotspots = current.breakdown.crowdDensity.hotspots?.length || 0;
      alerts.push({
        id: `alert-${Date.now()}-crowd-${current.h3Index}`,
        title: '👥 High Crowd Density Zone',
        message: `Crowd ${current.breakdown.crowdDensity.score}/100 at ${current.lat?.toFixed(4)},${current.lng?.toFixed(4)}${hotspots ? ` (${hotspots} hotspots)` : ''}`,
        severity: current.breakdown.crowdDensity.score > 80 ? 'high' : 'medium',
        h3Index: current.h3Index,
        score: current.biosafetyScore,
        timestamp: new Date().toISOString(),
      });
    }

    if (current.breakdown?.aqi?.raw > 200) {
      alerts.push({
        id: `alert-${Date.now()}-aqi-${current.h3Index}`,
        title: '🌫️ Severe Air Quality Alert',
        message: `AQI ${current.breakdown.aqi.raw} at ${current.lat?.toFixed(4)},${current.lng?.toFixed(4)}`,
        severity: 'high',
        h3Index: current.h3Index,
        score: current.biosafetyScore,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

export function getScoreHistory(h3Index) {
  return scoreHistory.get(h3Index) || [];
}

export function getAllHistories() {
  const result = {};
  for (const [key, val] of scoreHistory) {
    result[key] = val;
  }
  return result;
}

export default {
  computeScoreForHex,
  computeScoresForGrid,
  getOverviewFromScores,
  generateAlerts,
  getScoreHistory,
  getAllHistories,
};
