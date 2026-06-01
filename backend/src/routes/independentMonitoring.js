import express from 'express';
import {
    generateIndependentMonitoringPoints,
} from '../services/independentLocationAnalyzer.js';
import {
    analyzeLocationIndependently,
    analyzeMultipleLocationsIndependently,
} from '../services/multiPointMonitoring.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * GET /api/independent-monitoring/analyze
 * Analyze a specific location independently
 * Query: lat, lng, label (optional)
 */
router.get('/analyze', async (req, res) => {
  try {
    const { lat, lng, label } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing required parameters: lat, lng',
      });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({
        error: 'Invalid latitude or longitude values',
      });
    }

    const analysis = await analyzeLocationIndependently(
      latNum,
      lngNum,
      label || `Location ${latNum.toFixed(4)}, ${lngNum.toFixed(4)}`
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('Error in analyze endpoint:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * POST /api/independent-monitoring/analyze-multiple
 * Analyze multiple locations independently
 * Body: {
 *   locations: [
 *     {lat, lng, label},
 *     ...
 *   ]
 * }
 */
router.post('/analyze-multiple', async (req, res) => {
  try {
    const { locations } = req.body;

    if (!Array.isArray(locations)) {
      return res.status(400).json({
        error: 'locations must be an array',
      });
    }

    if (locations.length === 0) {
      return res.status(400).json({
        error: 'locations array cannot be empty',
      });
    }

    if (locations.length > 500) {
      return res.status(400).json({
        error: 'Maximum 500 locations allowed per request',
      });
    }

    // Validate locations
    for (const loc of locations) {
      if (!loc.lat || !loc.lng) {
        return res.status(400).json({
          error: 'Each location must have lat and lng',
        });
      }
    }

    const analyses = await analyzeMultipleLocationsIndependently(locations);

    res.json({
      success: true,
      count: analyses.length,
      data: analyses,
    });
  } catch (error) {
    logger.error('Error in analyze-multiple endpoint:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/independent-monitoring/generate-points
 * Generate monitoring points within 5km radius
 * Query: centerLat, centerLng, radiusKm (optional, default 5)
 */
router.get('/generate-points', async (req, res) => {
  try {
    const { centerLat, centerLng, radiusKm } = req.query;

    if (!centerLat || !centerLng) {
      return res.status(400).json({
        error: 'Missing required parameters: centerLat, centerLng',
      });
    }

    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const radius = radiusKm ? parseFloat(radiusKm) : 5;

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      return res.status(400).json({
        error: 'Invalid numeric parameters',
      });
    }

    if (radius < 0.5 || radius > 20) {
      return res.status(400).json({
        error: 'Radius must be between 0.5 and 20 km',
      });
    }

    const points = await generateIndependentMonitoringPoints(lat, lng, radius);

    // Group by type
    const grouped = {
      GRID_CELL: points.filter(p => p.type === 'GRID_CELL'),
      TRANSPORT_HUB: points.filter(p => p.type === 'TRANSPORT_HUB'),
      TRAFFIC_JUNCTION: points.filter(p => p.type === 'TRAFFIC_JUNCTION'),
      CROWDED_AREA: points.filter(p => p.type === 'CROWDED_AREA'),
    };

    res.json({
      success: true,
      centerLat: lat,
      centerLng: lng,
      radiusKm: radius,
      totalPoints: points.length,
      breakdown: {
        gridCells: grouped.GRID_CELL.length,
        transportHubs: grouped.TRANSPORT_HUB.length,
        trafficJunctions: grouped.TRAFFIC_JUNCTION.length,
        crowdedAreas: grouped.CROWDED_AREA.length,
      },
      points,
    });
  } catch (error) {
    logger.error('Error in generate-points endpoint:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/independent-monitoring/5km-analysis
 * Get complete 5km analysis (generates points + analyzes all)
 * Query: centerLat, centerLng, radiusKm (optional, default 5)
 */
router.get('/5km-analysis', async (req, res) => {
  try {
    const { centerLat, centerLng, radiusKm } = req.query;

    if (!centerLat || !centerLng) {
      return res.status(400).json({
        error: 'Missing required parameters: centerLat, centerLng',
      });
    }

    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const radius = radiusKm ? parseFloat(radiusKm) : 5;

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      return res.status(400).json({
        error: 'Invalid numeric parameters',
      });
    }

    // Set 10 second timeout for this operation
    req.setTimeout(30000);

    // Generate monitoring points
    const points = await generateIndependentMonitoringPoints(lat, lng, radius);

    // Analyze all points independently
    const analyses = await analyzeMultipleLocationsIndependently(points);

    // Calculate statistics
    const stats = {
      totalAnalyzed: analyses.length,
      riskLevelDistribution: {
        CRITICAL: analyses.filter(a => a.riskLevel === 'CRITICAL').length,
        HIGH: analyses.filter(a => a.riskLevel === 'HIGH').length,
        MODERATE: analyses.filter(a => a.riskLevel === 'MODERATE').length,
        LOW: analyses.filter(a => a.riskLevel === 'LOW').length,
      },
      averageScore: (analyses.reduce((sum, a) => sum + (a.biosafetyScore || 0), 0) / analyses.length).toFixed(1),
      maxScore: Math.max(...analyses.map(a => a.biosafetyScore || 0)).toFixed(1),
      minScore: Math.min(...analyses.map(a => a.biosafetyScore || 0)).toFixed(1),
    };

    // Identify critical zones
    const criticalZones = analyses
      .filter(a => a.riskLevel === 'CRITICAL')
      .sort((a, b) => b.biosafetyScore - a.biosafetyScore)
      .slice(0, 10);

    res.json({
      success: true,
      metadata: {
        centerLat: lat,
        centerLng: lng,
        radiusKm: radius,
        timestamp: new Date().toISOString(),
      },
      statistics: stats,
      criticalZones,
      analyses,
    });
  } catch (error) {
    logger.error('Error in 5km-analysis endpoint:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/independent-monitoring/heatmap-data
 * Get heatmap-formatted data for a 5km radius
 * Query: centerLat, centerLng, radiusKm (optional, default 5)
 */
router.get('/heatmap-data', async (req, res) => {
  try {
    const { centerLat, centerLng, radiusKm } = req.query;

    if (!centerLat || !centerLng) {
      return res.status(400).json({
        error: 'Missing required parameters: centerLat, centerLng',
      });
    }

    const lat = parseFloat(centerLat);
    const lng = parseFloat(centerLng);
    const radius = radiusKm ? parseFloat(radiusKm) : 5;

    // Generate points and analyze
    const points = await generateIndependentMonitoringPoints(lat, lng, radius);
    const analyses = await analyzeMultipleLocationsIndependently(points);

    // Format for heatmap
    const heatmapPoints = analyses.map(a => ({
      lat: a.latitude,
      lng: a.longitude,
      intensity: a.biosafetyScore / 100,
      score: a.biosafetyScore,
      riskLevel: a.riskLevel,
      label: a.label,
    }));

    res.json({
      success: true,
      centerLat: lat,
      centerLng: lng,
      radiusKm: radius,
      timestamp: new Date().toISOString(),
      points: heatmapPoints,
    });
  } catch (error) {
    logger.error('Error in heatmap-data endpoint:', error);
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * GET /api/independent-monitoring/health
 * Health check for independent monitoring system
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Independent Monitoring',
    features: [
      'Independent location analysis',
      'Multi-point monitoring',
      'Factor-wise reasoning',
      '5km radius generation',
      'Heatmap data export',
    ],
    endpoints: [
      'GET /analyze',
      'POST /analyze-multiple',
      'GET /generate-points',
      'GET /5km-analysis',
      'GET /heatmap-data',
    ],
  });
});

export default router;
