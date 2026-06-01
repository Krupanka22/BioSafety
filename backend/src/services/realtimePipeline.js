import { getGridForLocation, getRingsForRadiusKm, getMonitorRadiusKm } from './h3GridEngine.js';
import { computeScoresForGrid, getOverviewFromScores, generateAlerts } from './biosafetyScoreEngine.js';
import logger from '../utils/logger.js';

/**
 * Real-Time Data Pipeline — Orchestrates periodic polling, score computation,
 * and Socket.IO broadcast to all connected clients.
 */

/** State store */
let io = null;
let currentGrid = [];
let currentScores = [];
let previousScores = [];
let allAlerts = [];        // Rolling alert buffer (max 200)
let monitoredLocations = new Map(); // socketId → {lat, lng}
let isRunning = false;
let pollInterval = null;

const MAX_ALERTS = 200;
const DEFAULT_LAT = parseFloat(process.env.DEFAULT_LAT) || 12.9716;
const DEFAULT_LNG = parseFloat(process.env.DEFAULT_LNG) || 77.5946;
const DEFAULT_RINGS = parseInt(process.env.H3_RING_SIZE, 10) || getRingsForRadiusKm(getMonitorRadiusKm());
/** Poll interval in ms (default 30s for near-real-time updates) */
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS, 10) || 30_000;

/**
 * Initialize the pipeline with a Socket.IO instance.
 */
export function initPipeline(socketIo) {
  io = socketIo;
  logger.info('Real-time pipeline initialized');

  // Set up socket connection handling
  io.on('connection', (socket) => {
    logger.info(`Pipeline: client connected ${socket.id}`);

    // Client subscribes to a location
    socket.on('subscribe-location', async (data) => {
      const lat = parseFloat(data?.lat) || DEFAULT_LAT;
      const lng = parseFloat(data?.lng) || DEFAULT_LNG;
      const rings = parseInt(data?.rings) || DEFAULT_RINGS;

      monitoredLocations.set(socket.id, { lat, lng, rings });
      logger.info(`Client ${socket.id} subscribed to ${lat.toFixed(4)}, ${lng.toFixed(4)} (${rings} rings)`);

      // Send current data immediately
      if (currentScores.length > 0) {
        const cachedTs = new Date().toISOString();
        socket.emit('biosafety:grid-update', {
          scores: currentScores,
          overview: getOverviewFromScores(currentScores),
          grid: currentGrid.map((h) => ({ h3Index: h.h3Index, boundary: h.boundary })),
          timestamp: cachedTs,
        });
        emitFactorUpdates(socket, currentScores, cachedTs);
        socket.emit('biosafety:heatmap-update', buildHeatmapPayload(currentScores, cachedTs));
      }

      // Trigger a fresh computation for this location
      try {
        const grid = getGridForLocation(lat, lng, rings);
        const scores = await computeScoresForGrid(grid);
        const overview = getOverviewFromScores(scores);

        const timestamp = new Date().toISOString();
        const gridPayload = {
          scores,
          overview,
          grid: grid.map((h) => ({ h3Index: h.h3Index, boundary: h.boundary })),
          timestamp,
        };

        previousScores = [...currentScores];
        currentScores = scores;
        currentGrid = grid;

        socket.emit('biosafety:grid-update', gridPayload);
        emitFactorUpdates(socket, scores, timestamp);
        socket.emit('biosafety:heatmap-update', buildHeatmapPayload(scores, timestamp));

        const newAlerts = generateAlerts(previousScores, currentScores);
        if (newAlerts.length > 0) {
          allAlerts = [...newAlerts, ...allAlerts].slice(0, MAX_ALERTS);
          for (const alert of newAlerts) {
            socket.emit('biosafety:alert', alert);
          }
        }
      } catch (err) {
        logger.error(`Failed to compute grid for ${socket.id}: ${err.message}`);
      }
    });

    // Client requests specific hex details
    socket.on('get-hex-detail', async (data) => {
      const hexScore = currentScores.find((s) => s.h3Index === data?.h3Index);
      if (hexScore) {
        socket.emit('biosafety:hex-detail', hexScore);
      }
    });

    socket.on('disconnect', () => {
      monitoredLocations.delete(socket.id);
      logger.info(`Pipeline: client disconnected ${socket.id}`);
    });
  });
}

/**
 * Get unique locations from monitored clients, grouped by proximity.
 * Rounds to 2 decimal places (~1km) to merge nearby clients.
 */
function getUniqueLocationGroups() {
  const groups = new Map(); // "lat:lng" → { lat, lng, rings, socketIds }

  for (const [socketId, loc] of monitoredLocations) {
    const key = `${loc.lat.toFixed(2)}:${loc.lng.toFixed(2)}`;
    if (!groups.has(key)) {
      groups.set(key, { lat: loc.lat, lng: loc.lng, rings: loc.rings || DEFAULT_RINGS, socketIds: [] });
    }
    groups.get(key).socketIds.push(socketId);
  }

  return [...groups.values()];
}

function buildHeatmapPayload(scores, timestamp) {
  return {
    points: scores.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      intensity: s.biosafetyScore / 100,
      score: s.biosafetyScore,
      riskLevel: s.riskLevel,
      h3Index: s.h3Index,
    })),
    timestamp,
  };
}

function emitFactorUpdates(targetSocket, scores, timestamp) {
  const weatherHex = scores.find((s) => s.breakdown?.weather?.available);
  const aqiHex = scores.find((s) => s.breakdown?.aqi?.available);

  if (weatherHex?.breakdown?.weather) {
    const w = weatherHex.breakdown.weather;
    targetSocket.emit('biosafety:weather-update', {
      score: w.score,
      temp: w.temp,
      humidity: w.humidity,
      windSpeed: w.windSpeed,
      rainfall: w.rainfall,
      pressure: w.pressure,
      uvIndex: w.uvIndex,
      condition: w.condition,
      icon: w.icon,
      source: 'openweathermap',
      timestamp,
    });
  }
  const crowdHex = scores.find((s) => s.breakdown?.crowdDensity?.available);
  if (crowdHex?.breakdown?.crowdDensity) {
    const c = crowdHex.breakdown.crowdDensity;
    targetSocket.emit('biosafety:crowd-update', {
      score: c.score,
      poiCount: c.poiCount,
      hotspots: c.hotspots,
      infrastructure: c.infrastructure,
      rushHourMultiplier: c.rushHourMultiplier,
      source: 'openstreetmap+overpass',
      timestamp,
    });
  }

  if (aqiHex?.breakdown?.aqi) {
    const a = aqiHex.breakdown.aqi;
    targetSocket.emit('biosafety:aqi-update', {
      raw: a.raw,
      score: a.score,
      aqiLevel: a.aqiLevel,
      pm25: a.pm25,
      pm10: a.pm10,
      co: a.co,
      no: a.no,
      no2: a.no2,
      so2: a.so2,
      o3: a.o3,
      source: 'openweathermap',
      timestamp,
    });
  }

  // Per-hex score deltas for clients that track individual cells
  const prevMap = new Map(previousScores.map((s) => [s.h3Index, s]));
  for (const current of scores) {
    const prev = prevMap.get(current.h3Index);
    if (!prev || prev.biosafetyScore !== current.biosafetyScore) {
      targetSocket.emit('biosafety:score-change', {
        h3Index: current.h3Index,
        biosafetyScore: current.biosafetyScore,
        riskLevel: current.riskLevel,
        riskColor: current.riskColor,
        previousScore: prev?.biosafetyScore ?? null,
        timestamp,
      });
    }
  }
}

/**
 * Run a single poll cycle — fetch data, compute scores, broadcast updates.
 * Computes grids for all unique client locations, not just the first.
 */
async function runPollCycle() {
  if (!io) return;

  const startTime = Date.now();
  logger.info('Pipeline: starting poll cycle');

  try {
    const locationGroups = getUniqueLocationGroups();

    // If no clients, use default location
    if (locationGroups.length === 0) {
      locationGroups.push({ lat: DEFAULT_LAT, lng: DEFAULT_LNG, rings: DEFAULT_RINGS, socketIds: [] });
    }

    // Track all scores/grids across all location groups for global state
    let allScores = [];
    let allGrids = [];

    for (const group of locationGroups) {
      const { lat, lng, rings, socketIds } = group;

      // Generate grid
      const grid = getGridForLocation(lat, lng, rings);
      const scores = await computeScoresForGrid(grid);
      const overview = getOverviewFromScores(scores);

      allScores.push(...scores);
      allGrids.push(...grid);

      // Build payloads
      const gridPayload = {
        scores,
        overview,
        grid: grid.map((h) => ({ h3Index: h.h3Index, boundary: h.boundary })),
        timestamp: new Date().toISOString(),
      };

      const timestamp = gridPayload.timestamp;

      // Emit to each client in this location group
      if (socketIds.length > 0) {
        for (const sid of socketIds) {
          const clientSocket = io.sockets.sockets.get(sid);
          if (clientSocket) {
            clientSocket.emit('biosafety:grid-update', gridPayload);
            emitFactorUpdates(clientSocket, scores, timestamp);
            clientSocket.emit('biosafety:heatmap-update', buildHeatmapPayload(scores, timestamp));
          }
        }
      } else {
        // No clients — broadcast to all (default location mode)
        io.emit('biosafety:grid-update', gridPayload);
        emitFactorUpdates(io, scores, timestamp);
        io.emit('biosafety:heatmap-update', buildHeatmapPayload(scores, timestamp));
      }
    }

    // Update global state (used by REST endpoints)
    const prevGlobal = [...currentScores];
    previousScores = prevGlobal;
    currentScores = allScores;
    currentGrid = allGrids;

    // Generate alerts from combined scores
    const newAlerts = generateAlerts(previousScores, currentScores);
    if (newAlerts.length > 0) {
      allAlerts = [...newAlerts, ...allAlerts].slice(0, MAX_ALERTS);
      for (const alert of newAlerts) {
        io.emit('biosafety:alert', alert);
      }
    }

    const elapsed = Date.now() - startTime;
    logger.info(`Pipeline: poll cycle complete in ${elapsed}ms — ${locationGroups.length} location(s), ${currentScores.length} hexes scored`);
  } catch (err) {
    logger.error(`Pipeline: poll cycle failed — ${err.message}`);
  }
}

/**
 * Start the periodic polling pipeline.
 */
export function startPipeline() {
  if (isRunning) return;
  isRunning = true;

  // Run first cycle immediately
  runPollCycle();

  // Recurring polls at POLL_INTERVAL_MS (default 30s)
  pollInterval = setInterval(() => {
    runPollCycle();
  }, POLL_INTERVAL_MS);

  logger.info(`Pipeline: periodic polling started (every ${POLL_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the pipeline.
 */
export function stopPipeline() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  isRunning = false;
  logger.info('Pipeline: stopped');
}

/**
 * Get current state (for REST API endpoints).
 */
export function getCurrentScores() {
  return currentScores;
}

export function getCurrentOverview() {
  return getOverviewFromScores(currentScores);
}

export function getAlerts() {
  return allAlerts;
}

export function getCurrentGrid() {
  return currentGrid;
}

export default {
  initPipeline,
  startPipeline,
  stopPipeline,
  getCurrentScores,
  getCurrentOverview,
  getAlerts,
  getCurrentGrid,
};
