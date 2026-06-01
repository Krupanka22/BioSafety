import express from 'express';
import { auth } from '../middleware/auth.js';
import {
  getGridForLocation,
  getGridForRadius,
  getRingsForRadiusKm,
  getMonitorRadiusKm,
  getHexBbox,
} from '../services/h3GridEngine.js';
import { computeScoreForHex, computeScoresForGrid } from '../services/biosafetyScoreEngine.js';
import { getCurrentScores, getCurrentGrid } from '../services/realtimePipeline.js';
import { reverseGeocode, searchNearbyPlaces } from '../services/nominatimService.js';
import { getSafeRoute } from '../services/osrmService.js';

const router = express.Router();

/**
 * Map Routes — Live H3 grid data with biosafety scores
 */

const DEFAULT_LAT = parseFloat(process.env.DEFAULT_LAT) || 12.9716;
const DEFAULT_LNG = parseFloat(process.env.DEFAULT_LNG) || 77.5946;
const DEFAULT_RINGS = parseInt(process.env.H3_RING_SIZE, 10) || getRingsForRadiusKm(getMonitorRadiusKm());

// Get locations with risk data — returns H3 hex grid
router.get('/locations', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    const rings = parseInt(req.query.rings) || DEFAULT_RINGS;

    let scores = getCurrentScores();
    let gridCells = getCurrentGrid();

    if (!scores || scores.length === 0) {
      gridCells = getGridForRadius(lat, lng);
      scores = await computeScoresForGrid(gridCells);
    } else if (!gridCells || gridCells.length === 0) {
      gridCells = getGridForRadius(lat, lng);
    }

    const boundaryByHex = new Map(
      gridCells.map((g) => [g.h3Index, g.boundary || []])
    );

    const locations = scores.map((s, idx) => ({
      id: idx + 1,
      h3Index: s.h3Index,
      name: `Zone ${s.h3Index.slice(-6).toUpperCase()}`,
      lat: s.lat,
      lng: s.lng,
      riskLevel: s.riskLevel,
      riskScore: s.biosafetyScore,
      riskColor: s.riskColor,
      timeToSafe: s.timeToSafe,
      boundary: boundaryByHex.get(s.h3Index) || [],
      breakdown: s.breakdown,
      reasoning: s.reasoning,
      timestamp: s.timestamp,
    }));

    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get heatmap data
router.get('/heatmap/:region', auth, (req, res) => {
  try {
    const scores = getCurrentScores();

    const heatmapPoints = scores.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      intensity: s.biosafetyScore / 100,
      score: s.biosafetyScore,
      riskLevel: s.riskLevel,
    }));

    res.json({
      region: req.params.region,
      heatmapPoints,
      generatedAt: new Date().toISOString(),
      totalPoints: heatmapPoints.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Nearby places — Nominatim + Overpass (free)
router.get('/nearby', auth, async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    const radius = parseFloat(req.query.radius) || 0.5;

    const [geo, places, scores] = await Promise.all([
      reverseGeocode(lat, lng),
      searchNearbyPlaces(lat, lng, radius, 20),
      Promise.resolve(getCurrentScores()),
    ]);

    res.json({
      location: geo,
      places: places.places,
      placeCount: places.count,
      monitoredHexes: scores.length,
      timestamp: new Date().toISOString(),
      sources: ['nominatim', 'overpass'],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Safe route — OSRM + live hex risk scoring
router.get('/safe-route', auth, async (req, res) => {
  try {
    const fromLat = parseFloat(req.query.fromLat);
    const fromLng = parseFloat(req.query.fromLng);
    const toLat = parseFloat(req.query.toLat);
    const toLng = parseFloat(req.query.toLng);

    if ([fromLat, fromLng, toLat, toLng].some((n) => Number.isNaN(n))) {
      return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng are required' });
    }

    const scores = getCurrentScores();
    const route = await getSafeRoute(fromLat, fromLng, toLat, toLng, scores);
    res.json(route);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get detailed data for a single hex
router.get('/grid/:h3Index', auth, async (req, res) => {
  try {
    const { h3Index } = req.params;
    const score = await computeScoreForHex(h3Index);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
