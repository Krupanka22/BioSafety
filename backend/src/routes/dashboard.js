import express from 'express';
import { auth } from '../middleware/auth.js';
import { getGridForRadius } from '../services/h3GridEngine.js';
import { computeScoresForGrid, getOverviewFromScores, getScoreHistory } from '../services/biosafetyScoreEngine.js';
import { getCurrentScores, getCurrentOverview, getAlerts as getPipelineAlerts, getOrComputeScores } from '../services/realtimePipeline.js';

const router = express.Router();

/**
 * Dashboard Routes — Live data from biosafety score engine
 */

const DEFAULT_LAT = parseFloat(process.env.DEFAULT_LAT) || 12.9716;
const DEFAULT_LNG = parseFloat(process.env.DEFAULT_LNG) || 77.5946;

// Get risk overview — aggregated live scores
router.get('/risk-overview', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    
    // getOrComputeScores handles cache check and grid calculation automatically
    const scores = await getOrComputeScores(lat, lng);
    const overview = getOverviewFromScores(scores);

    res.json({
      level: overview.riskLevel,
      score: overview.avgScore,
      maxScore: overview.maxScore,
      timeToSafe: overview.timeToSafe,
      riskColor: overview.riskColor,
      criticalZones: overview.criticalCount,
      highRiskZones: overview.highCount,
      moderateZones: overview.moderateCount,
      lowRiskZones: overview.lowCount,
      totalHexes: overview.totalHexes,
      trend: overview.avgScore > 50 ? 'increasing' : 'stable',
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get exposure score — computed from live AQI + weather
router.get('/exposure-score', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    
    const scores = await getOrComputeScores(lat, lng);

    if (scores.length === 0) {
      return res.json({ score: 0, category: 'UNKNOWN', change: '0%', historicalData: [] });
    }

    const avgScore = Math.round(
      scores.reduce((s, sc) => s + sc.biosafetyScore, 0) / scores.length
    );

    // Build historical data from score histories
    const firstHex = scores[0];
    const history = getScoreHistory(firstHex?.h3Index);
    const historicalData = history.slice(-30).map((h, i) => ({
      date: h.timestamp,
      score: h.score,
    }));

    // Calculate change
    let change = '0%';
    if (historicalData.length >= 2) {
      const oldScore = historicalData[0].score;
      const newScore = historicalData[historicalData.length - 1].score;
      const pct = oldScore > 0 ? (((newScore - oldScore) / oldScore) * 100).toFixed(1) : '0';
      change = `${pct > 0 ? '+' : ''}${pct}%`;
    }

    res.json({
      score: avgScore,
      category: avgScore >= 75 ? 'CRITICAL' : avgScore >= 50 ? 'HIGH' : avgScore >= 25 ? 'MODERATE' : 'LOW',
      change,
      historicalData,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get active alerts — from pipeline
router.get('/alerts', auth, (req, res) => {
  const alerts = getPipelineAlerts();
  res.json(alerts.slice(0, 50));
});

// Get trends — computed from historical score data
router.get('/trends', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    
    const scores = await getOrComputeScores(lat, lng);

    if (scores.length === 0) {
      return res.json({
        week: { change: '0%', trend: 'stable' },
        month: { change: '0%', trend: 'stable' },
        year: { change: '0%', trend: 'stable' },
      });
    }

    // Use the first hex's history for trend calculations
    const history = getScoreHistory(scores[0]?.h3Index);

    const calcChange = (slice) => {
      if (slice.length < 2) return { change: '0%', trend: 'stable' };
      const old = slice[0].score;
      const now = slice[slice.length - 1].score;
      const pct = old > 0 ? (((now - old) / old) * 100).toFixed(1) : '0';
      return {
        change: `${pct > 0 ? '+' : ''}${pct}%`,
        trend: now > old ? 'up' : now < old ? 'down' : 'stable',
      };
    };

    res.json({
      week: calcChange(history.slice(-7)),
      month: calcChange(history.slice(-30)),
      year: calcChange(history),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get score history + live factor breakdown — for chart and KPI cards
router.get('/score-history', auth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 60; // last N data points
    
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    
    const scores = await getOrComputeScores(lat, lng);

    // Aggregate score history across all hexes by timestamp
    const allHistories = [];
    for (const s of scores) {
      const history = getScoreHistory(s.h3Index);
      for (const h of history) {
        allHistories.push(h);
      }
    }

    // Group by minute (truncate seconds)
    const grouped = {};
    for (const entry of allHistories) {
      const minuteKey = entry.timestamp.slice(0, 16); // "2026-05-30T19:05"
      if (!grouped[minuteKey]) grouped[minuteKey] = [];
      grouped[minuteKey].push(entry.score);
    }

    const timeline = Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-limit)
      .map(([key, vals]) => ({
        time: new Date(key + ':00.000Z').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: key,
        score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      }));

    // Compute live factor breakdown averages from current scores
    let avgAqi = 0, avgWeather = 0, avgCrowd = 0, avgHygiene = 0, avgHistorical = 0;
    let count = 0;
    for (const s of scores) {
      if (s.breakdown) {
        avgAqi += s.breakdown.aqi?.score || 0;
        avgWeather += s.breakdown.weather?.score || 0;
        avgCrowd += s.breakdown.crowdDensity?.score || 0;
        avgHygiene += s.breakdown.hygiene?.score || 0;
        avgHistorical += s.breakdown.historical?.score || 0;
        count++;
      }
    }
    if (count > 0) {
      avgAqi = Math.round(avgAqi / count);
      avgWeather = Math.round(avgWeather / count);
      avgCrowd = Math.round(avgCrowd / count);
      avgHygiene = Math.round(avgHygiene / count);
      avgHistorical = Math.round(avgHistorical / count);
    }

    res.json({
      timeline,
      factorBreakdown: {
        aqi: avgAqi,
        weather: avgWeather,
        crowdDensity: avgCrowd,
        hygiene: avgHygiene,
        historical: avgHistorical,
      },
      dataPoints: allHistories.length,
      hexCount: scores.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
