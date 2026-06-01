import { io } from 'socket.io-client';

/**
 * Socket.IO Service — Manages WebSocket connection to the backend
 * for real-time biosafety data updates.
 */

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

let socket = null;
let eventHandlers = {};
/** Last location subscription — re-sent on connect/reconnect */
let pendingSubscription = null;

/**
 * Connect to the backend WebSocket server.
 */
export function connectSocket() {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    triggerHandler('connection-status', 'connected');
    if (pendingSubscription) {
      socket.emit('subscribe-location', pendingSubscription);
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    triggerHandler('connection-status', 'disconnected');
  });

  socket.on('reconnect_attempt', () => {
    triggerHandler('connection-status', 'reconnecting');
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    triggerHandler('connection-status', 'error');
  });

  // Biosafety events
  socket.on('biosafety:grid-update', (data) => triggerHandler('grid-update', data));
  socket.on('biosafety:score-change', (data) => triggerHandler('score-change', data));
  socket.on('biosafety:weather-update', (data) => triggerHandler('weather-update', data));
  socket.on('biosafety:aqi-update', (data) => triggerHandler('aqi-update', data));
  socket.on('biosafety:alert', (data) => triggerHandler('alert', data));
  socket.on('biosafety:heatmap-update', (data) => triggerHandler('heatmap-update', data));
  socket.on('biosafety:crowd-update', (data) => triggerHandler('crowd-update', data));
  socket.on('biosafety:hex-detail', (data) => triggerHandler('hex-detail', data));

  // Independent location monitoring events
  socket.on('location-analysis-independent', (data) => triggerHandler('location-analysis-independent', data));
  socket.on('5km-monitoring-start', (data) => triggerHandler('5km-monitoring-start', data));
  socket.on('independent-location-analysis', (data) => triggerHandler('independent-location-analysis', data));
  socket.on('independent-location-update', (data) => triggerHandler('independent-location-update', data));
  socket.on('location-detail', (data) => triggerHandler('location-detail', data));
  socket.on('5km-heatmap-update', (data) => triggerHandler('5km-heatmap-update', data));

  return socket;
}

/**
 * Disconnect from the WebSocket server.
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Subscribe to receive data for a specific location.
 */
export function subscribeLocation(lat, lng, rings) {
  pendingSubscription = { lat, lng };
  if (rings != null) pendingSubscription.rings = rings;
  if (socket?.connected) {
    socket.emit('subscribe-location', pendingSubscription);
  }
}

/**
 * Request detailed data for a specific H3 hex.
 */
export function requestHexDetail(h3Index) {
  if (socket?.connected) {
    socket.emit('get-hex-detail', { h3Index });
  }
}

/**
 * Register an event handler.
 */
export function onSocketEvent(event, handler) {
  if (!eventHandlers[event]) eventHandlers[event] = [];
  eventHandlers[event].push(handler);
}

/**
 * Remove an event handler.
 */
export function offSocketEvent(event, handler) {
  if (eventHandlers[event]) {
    eventHandlers[event] = eventHandlers[event].filter((h) => h !== handler);
  }
}

/**
 * Trigger registered handlers for an event.
 */
function triggerHandler(event, data) {
  const handlers = eventHandlers[event] || [];
  for (const handler of handlers) {
    try {
      handler(data);
    } catch (err) {
      console.error(`[Socket] Handler error for ${event}:`, err);
    }
  }
}

/**
 * Get current connection status.
 */
export function isConnected() {
  return socket?.connected || false;
}

/**
 * Analyze a specific location independently with complete environmental intelligence
 */
export function analyzeLocationIndependently(lat, lng, label) {
  if (socket?.connected) {
    socket.emit('analyze-location-independent', { lat, lng, label });
  }
}

/**
 * Start 5km radius monitoring with independent location analysis
 */
export function start5kmMonitoring(centerLat, centerLng, radiusKm = 5, includeGridCells = true) {
  if (socket?.connected) {
    socket.emit('start-5km-monitoring', { centerLat, centerLng, radiusKm, includeGridCells });
  }
}

/**
 * Get detailed environmental intelligence for a specific location
 */
export function getLocationDetail(lat, lng, includeFactorWiseReasoning = true) {
  if (socket?.connected) {
    socket.emit('get-location-detail', { lat, lng, includeFactorWiseReasoning });
  }
}

/**
 * Stop 5km radius monitoring
 */
export function stop5kmMonitoring() {
  if (socket?.connected) {
    socket.emit('stop-5km-monitoring', {});
  }
}

export default {
  connectSocket,
  disconnectSocket,
  subscribeLocation,
  requestHexDetail,
  onSocketEvent,
  offSocketEvent,
  isConnected,
};
