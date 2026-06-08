import express from 'express';
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
router.get('/locations', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    const rings = parseInt(req.query.rings) || DEFAULT_RINGS;

    let globalScores = getCurrentScores();
    let gridCells = getGridForRadius(lat, lng);
    const validH3 = new Set(gridCells.map(g => g.h3Index));
    
    let scores = globalScores.filter(s => validH3.has(s.h3Index));

    if (scores.length === 0) {
      scores = await computeScoresForGrid(gridCells);
    }

    const boundaryByHex = new Map(
      gridCells.map((g) => [g.h3Index, g.boundary || []])
    );

    const locations = scores.map((s, idx) => {
      let zoneName = `Zone ${s.h3Index.slice(-6).toUpperCase()}`;
      if (s.breakdown?.crowdDensity?.hotspots?.length > 0) {
        const firstHotspot = s.breakdown.crowdDensity.hotspots[0];
        if (firstHotspot.name && firstHotspot.name !== 'other' && !firstHotspot.name.startsWith('bus_') && !firstHotspot.name.startsWith('train_')) {
          zoneName = firstHotspot.name;
        }
      }
      return {
        id: idx + 1,
        h3Index: s.h3Index,
        name: zoneName,
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
      };
    });

    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get heatmap data
router.get('/heatmap/:region', (req, res) => {
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
router.get('/nearby', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat) || DEFAULT_LAT;
    const lng = parseFloat(req.query.lng) || DEFAULT_LNG;
    const radius = parseFloat(req.query.radius) || 0.5;

    // Run Nominatim requests sequentially to respect their 1-request-per-second concurrency limit
    const geo = await reverseGeocode(lat, lng);
    const places = await searchNearbyPlaces(lat, lng, radius, 20);
    const scores = getCurrentScores();

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
router.get('/safe-route', async (req, res) => {
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
router.get('/grid/:h3Index', async (req, res) => {
  try {
    const { h3Index } = req.params;
    const score = await computeScoreForHex(h3Index);
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
