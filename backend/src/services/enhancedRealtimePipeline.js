/**
 * Enhanced Real-Time Pipeline Extension
 * Adds independent location monitoring, factor-wise analysis, and dynamic 5km monitoring
 */

import logger from '../utils/logger.js';
import { generateIndependentMonitoringPoints } from './independentLocationAnalyzer.js';
import { analyzeLocationIndependently, analyzeMultipleLocationsIndependently } from './multiPointMonitoring.js';

/** State for independent monitoring */
let independentLocationAnalyses = new Map(); // lat,lng → analysis
let independentMonitoringInterval = null;
let dynamicMonitoringRadius = 5; // km
let isIndependentMonitoringActive = false;

/**
 * Initialize independent location monitoring with WebSocket
 */
export function initIndependentLocationMonitoring(io) {
  io.on('connection', (socket) => {
    logger.info(`Independent monitor: client connected ${socket.id}`);

    // Client requests analysis of specific location
    socket.on('analyze-location-independent', async (data) => {
      const { lat, lng, label } = data;
      
      try {
        const analysis = await analyzeLocationIndependently(lat, lng, label);
        socket.emit('location-analysis-independent', {
          success: true,
          data: analysis,
        });
      } catch (error) {
        socket.emit('location-analysis-independent', {
          success: false,
          error: error.message,
        });
      }
    });

    // Client requests monitoring of 5km radius with independent locations
    socket.on('start-5km-monitoring', async (data) => {
      const { centerLat, centerLng, radiusKm = 5, includeGridCells = true } = data;
      
      try {
        const monitoringPoints = await generateIndependentMonitoringPoints(
          centerLat,
          centerLng,
          radiusKm
        );

        // Analyze all points independently
        const analyses = await analyzeMultipleLocationsIndependently(monitoringPoints);
        
        socket.emit('5km-monitoring-start', {
          success: true,
          centerLat,
          centerLng,
          radiusKm,
          totalPoints: analyses.length,
          pointsByType: groupByType(analyses),
          timestamp: new Date().toISOString(),
        });

        // Send individual location analyses
        for (const analysis of analyses) {
          socket.emit('independent-location-analysis', analysis);
        }

        // Start continuous monitoring for this socket
        const monitoringKey = `${centerLat.toFixed(4)},${centerLng.toFixed(4)}`;
        startContinuousMonitoring(socket, centerLat, centerLng, radiusKm);
      } catch (error) {
        socket.emit('5km-monitoring-start', {
          success: false,
          error: error.message,
        });
      }
    });

    // Client requests specific location detail
    socket.on('get-location-detail', async (data) => {
      const { lat, lng, includeFactorWiseReasoning = true } = data;
      
      try {
        const analysis = await analyzeLocationIndependently(lat, lng);
        
        const detail = {
          location: { lat, lng },
          biosafetyScore: analysis.biosafetyScore,
          riskLevel: analysis.riskLevel,
          riskColor: analysis.riskColor,
          timestamp: analysis.timestamp,
          factors: analysis.factors,
          reasoning: includeFactorWiseReasoning ? analysis.reasoning : undefined,
          environmentalIntelligence: {
            airQuality: {
              aqi: analysis.factors.airQuality?.aqi,
              category: analysis.factors.airQuality?.aqiCategory,
              pm25: analysis.factors.pollution?.pm25,
              pm10: analysis.factors.pollution?.pm10,
              co: analysis.factors.pollution?.co,
              no2: analysis.factors.pollution?.no2,
              so2: analysis.factors.pollution?.so2,
              o3: analysis.factors.pollution?.o3,
            },
            weather: {
              temperature: analysis.factors.weather?.temperature,
              humidity: analysis.factors.weather?.humidity,
              rainfall: analysis.factors.weather?.rainfall,
              windSpeed: analysis.factors.weather?.windSpeed,
              uvIndex: analysis.factors.weather?.uvIndex,
              description: analysis.factors.weather?.description,
            },
            crowdMetrics: {
              estimatedCrowd: analysis.factors.crowdDensity?.estimatedCrowd,
              congestionLevel: analysis.factors.crowdDensity?.congestionLevel,
              transportHubDensity: analysis.factors.crowdDensity?.transportHubDensity,
              trafficJunctionCount: analysis.factors.crowdDensity?.trafficJunctionCount,
              hotspotsNearby: analysis.factors.crowdDensity?.hotspotsNearby,
            },
            hygieneAnalysis: {
              hygieneScore: analysis.factors.hygiene?.hygieneScore,
              hygieneLevel: analysis.factors.hygiene?.hygieneLevel,
              sanitationFacilities: analysis.factors.hygiene?.sanitationFacilities,
              medicalServices: analysis.factors.hygiene?.medicalServices,
            },
            alerts: analysis.reasoning,
          },
        };

        socket.emit('location-detail', detail);
      } catch (error) {
        socket.emit('location-detail', {
          success: false,
          error: error.message,
        });
      }
    });

    // Stop monitoring for this socket
    socket.on('stop-5km-monitoring', () => {
      stopContinuousMonitoring(socket.id);
    });

    socket.on('disconnect', () => {
      stopContinuousMonitoring(socket.id);
      logger.info(`Independent monitor: client disconnected ${socket.id}`);
    });
  });
}

/**
 * Start continuous monitoring of a 5km radius around center
 */
function startContinuousMonitoring(socket, centerLat, centerLng, radiusKm, intervalMs = 900000) {
  const monitoringId = `${socket.id}_${centerLat}_${centerLng}`;
  let errorCount = 0;
  
  const interval = setInterval(async () => {
    try {
      const points = await generateIndependentMonitoringPoints(centerLat, centerLng, radiusKm);
      const analyses = await analyzeMultipleLocationsIndependently(points);
      
      // Emit heatmap data
      const heatmapData = analyses.map(a => ({
        lat: a.latitude,
        lng: a.longitude,
        intensity: a.biosafetyScore / 100,
        score: a.biosafetyScore,
        riskLevel: a.riskLevel,
        label: a.label,
      }));

      socket.emit('5km-heatmap-update', {
        centerLat,
        centerLng,
        radiusKm,
        points: heatmapData,
        timestamp: new Date().toISOString(),
      });

      // Emit individual location updates
      for (const analysis of analyses) {
        socket.emit('independent-location-update', analysis);
      }
      errorCount = 0; // Reset error count on success
    } catch (error) {
      errorCount++;
      logger.error(`Continuous monitoring error for ${monitoringId} (Error count: ${errorCount}):`, error.message);
      if (errorCount >= 5) {
        logger.error(`Stopping continuous monitoring for ${monitoringId} due to repeated errors.`);
        stopContinuousMonitoring(socket.id);
        socket.emit('5km-monitoring-error', {
           message: 'Monitoring stopped due to repeated API failures. Please try again later.'
        });
      }
    }
  }, intervalMs);

  independentMonitoringInterval = interval;
  isIndependentMonitoringActive = true;
}

/**
 * Stop continuous monitoring
 */
function stopContinuousMonitoring(socketId) {
  if (independentMonitoringInterval) {
    clearInterval(independentMonitoringInterval);
    independentMonitoringInterval = null;
  }
  isIndependentMonitoringActive = false;
  logger.info(`Continuous monitoring stopped for ${socketId}`);
}

/**
 * Group analyses by location type
 */
function groupByType(analyses) {
  const grouped = {
    GRID_CELL: [],
    TRANSPORT_HUB: [],
    TRAFFIC_JUNCTION: [],
    CROWDED_AREA: [],
  };

  for (const analysis of analyses) {
    const type = analysis.type || 'GRID_CELL';
    if (grouped[type]) {
      grouped[type].push(analysis);
    }
  }

  return grouped;
}

/**
 * Get all current independent analyses
 */
export function getIndependentAnalyses() {
  return Array.from(independentLocationAnalyses.values());
}

/**
 * Check if independent monitoring is active
 */
export function isIndependentMonitoringRunning() {
  return isIndependentMonitoringActive;
}

