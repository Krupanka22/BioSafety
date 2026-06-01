import { create } from 'zustand';
import api from '../services/api';
import { onSocketEvent, offSocketEvent, isConnected } from '../services/socketService';

/**
 * Dashboard Store — Live biosafety data with Socket.IO real-time updates
 */
export const useDashboardStore = create((set, get) => ({
  riskData: null,
  exposureScore: 0,
  alerts: [],
  trends: null,
  loading: false,
  error: null,

  // Live data fields
  biosafetyScore: 0,
  aqiData: null,
  weatherData: null,
  hygieneScore: 0,
  crowdDensity: 0,
  overview: null,
  lastUpdated: null,
  connectionStatus: 'disconnected',

  // Real score history for charts (populated from socket + REST)
  scoreHistory: [],
  factorBreakdown: null, // { aqi, weather, crowdDensity, hygiene, historical }

  /**
   * Fetch dashboard data from REST API
   */
  fetchDashboardData: async (lat, lng) => {
    set({ loading: true });
    try {
      const params = {};
      if (lat) params.lat = lat;
      if (lng) params.lng = lng;

      const [risk, score, alerts, trends, history] = await Promise.all([
        api.get('/dashboard/risk-overview', { params }),
        api.get('/dashboard/exposure-score', { params }),
        api.get('/dashboard/alerts'),
        api.get('/dashboard/trends'),
        api.get('/dashboard/score-history', { params: { limit: 60 } }).catch(() => ({ data: {} })),
      ]);

      set({
        riskData: risk.data,
        exposureScore: score.data.score,
        alerts: alerts.data,
        trends: trends.data,
        biosafetyScore: risk.data.score || 0,
        scoreHistory: history.data?.timeline || [],
        factorBreakdown: history.data?.factorBreakdown || null,
        crowdDensity: history.data?.factorBreakdown?.crowdDensity || 0,
        hygieneScore: history.data?.factorBreakdown?.hygiene || 0,
        loading: false,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  /**
   * Handle Socket.IO real-time updates
   */
  handleGridUpdate: (data) => {
    if (!data) return;
    const overview = data.overview || {};
    const scores = data.scores || [];

    const firstWithBreakdown = scores.find((s) => s.breakdown);
    const bd = firstWithBreakdown?.breakdown || {};
    const liveAqi = bd.aqi
      ? {
          raw: bd.aqi.raw,
          pm25: bd.aqi.pm25,
          pm10: bd.aqi.pm10,
          co: bd.aqi.co,
          no2: bd.aqi.no2,
          so2: bd.aqi.so2,
          o3: bd.aqi.o3,
          score: bd.aqi.score,
          source: bd.aqi.source || 'openweathermap',
        }
      : null;
    const liveWeather = bd.weather
      ? {
          score: bd.weather.score,
          temp: bd.weather.temp,
          humidity: bd.weather.humidity,
          rainfall: bd.weather.rainfall,
          pressure: bd.weather.pressure,
          uvIndex: bd.weather.uvIndex,
          windSpeed: bd.weather.windSpeed,
          condition: bd.weather.condition,
          icon: bd.weather.icon,
          source: 'openweathermap',
        }
      : null;

    // Compute average crowd density and hygiene across all hexes
    let totalCrowd = 0, totalHygiene = 0, bdCount = 0;
    for (const s of scores) {
      if (s.breakdown) {
        totalCrowd += s.breakdown.crowdDensity?.score || 0;
        totalHygiene += s.breakdown.hygiene?.score || 0;
        bdCount++;
      }
    }
    const avgCrowd = bdCount > 0 ? Math.round(totalCrowd / bdCount) : 0;
    const avgHygiene = bdCount > 0 ? Math.round(totalHygiene / bdCount) : 0;

    // Compute average factor breakdown
    let avgAqi = 0, avgWeather = 0, avgHistorical = 0;
    for (const s of scores) {
      if (s.breakdown) {
        avgAqi += s.breakdown.aqi?.score || 0;
        avgWeather += s.breakdown.weather?.score || 0;
        avgHistorical += s.breakdown.historical?.score || 0;
      }
    }
    if (bdCount > 0) {
      avgAqi = Math.round(avgAqi / bdCount);
      avgWeather = Math.round(avgWeather / bdCount);
      avgHistorical = Math.round(avgHistorical / bdCount);
    }

    // Append to score history (keep last 120 points — 2 hours at 1-min intervals)
    const newPoint = {
      time: new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: data.timestamp,
      score: overview.avgScore || 0,
    };

    set((state) => ({
      overview,
      biosafetyScore: overview.avgScore || 0,
      ...(liveAqi ? { aqiData: liveAqi } : {}),
      ...(liveWeather ? { weatherData: liveWeather } : {}),
      crowdDensity: avgCrowd,
      hygieneScore: avgHygiene,
      factorBreakdown: {
        aqi: avgAqi,
        weather: avgWeather,
        crowdDensity: avgCrowd,
        hygiene: avgHygiene,
        historical: avgHistorical,
      },
      riskData: {
        level: overview.riskLevel || 'LOW',
        score: overview.avgScore || 0,
        timeToSafe: overview.timeToSafe || '-',
        riskColor: overview.riskColor,
        criticalZones: overview.criticalCount || 0,
        highRiskZones: overview.highCount || 0,
        totalHexes: overview.totalHexes || 0,
      },
      scoreHistory: [...state.scoreHistory, newPoint].slice(-120),
      lastUpdated: data.timestamp,
    }));
  },

  handleWeatherUpdate: (data) => {
    if (data) set({ weatherData: data });
  },

  handleAqiUpdate: (data) => {
    if (data) set({ aqiData: data });
  },

  handleCrowdUpdate: (data) => {
    if (data?.score != null) set({ crowdDensity: data.score });
  },

  handleAlert: (alert) => {
    if (alert) {
      set((state) => ({
        alerts: [alert, ...state.alerts].slice(0, 50),
      }));
    }
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  /**
   * Initialize Socket.IO event listeners
   */
  initSocketListeners: () => {
    const state = get();
    onSocketEvent('grid-update', state.handleGridUpdate);
    onSocketEvent('weather-update', state.handleWeatherUpdate);
    onSocketEvent('aqi-update', state.handleAqiUpdate);
    onSocketEvent('crowd-update', state.handleCrowdUpdate);
    onSocketEvent('alert', state.handleAlert);
    onSocketEvent('connection-status', state.setConnectionStatus);
    state.setConnectionStatus(isConnected() ? 'connected' : 'disconnected');
  },

  /**
   * Cleanup Socket.IO event listeners
   */
  cleanupSocketListeners: () => {
    const state = get();
    offSocketEvent('grid-update', state.handleGridUpdate);
    offSocketEvent('weather-update', state.handleWeatherUpdate);
    offSocketEvent('aqi-update', state.handleAqiUpdate);
    offSocketEvent('crowd-update', state.handleCrowdUpdate);
    offSocketEvent('alert', state.handleAlert);
    offSocketEvent('connection-status', state.setConnectionStatus);
  },

  clearAlerts: () => set({ alerts: [] }),
}));

/**
 * Analytics Store — Live analytics with real prediction data
 */
export const useAnalyticsStore = create((set, get) => ({
  predictions: null,
  historicalData: [],
  heatmapData: [],
  correlationData: null,
  insights: [],
  loading: false,
  lastLiveUpdate: null,

  fetchPredictions: async (params) => {
    set({ loading: true });
    try {
      const response = await api.get('/analytics/predictions', { params });
      set({ predictions: response.data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  fetchHistoricalData: async (params) => {
    set({ loading: true });
    try {
      const response = await api.get('/analytics/historical', { params });
      set({ historicalData: response.data, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  fetchCorrelation: async () => {
    try {
      const response = await api.get('/analytics/correlation');
      set({ correlationData: response.data });
    } catch (error) {
      // correlation endpoint might not be available yet
    }
  },

  fetchInsights: async () => {
    try {
      const response = await api.get('/analytics/insights');
      set({ insights: response.data });
    } catch (error) {
      // insights endpoint might not be available yet
    }
  },

  fetchHeatmapData: async (region) => {
    set({ loading: true });
    try {
      const response = await api.get(`/map/heatmap/${region || 'live'}`);
      const points = response.data?.heatmapPoints || response.data?.points || [];
      set({ heatmapData: points, loading: false });
    } catch (error) {
      set({ loading: false });
    }
  },

  handleGridUpdate: () => {
    set({ lastLiveUpdate: new Date().toISOString() });
    get().fetchCorrelation();
    get().fetchInsights();
  },

  initSocketListeners: () => {
    const state = get();
    onSocketEvent('grid-update', state.handleGridUpdate);
    onSocketEvent('heatmap-update', (data) => {
      if (data?.points) set({ heatmapData: data.points, lastLiveUpdate: data.timestamp });
    });
  },

  cleanupSocketListeners: () => {
    const state = get();
    offSocketEvent('grid-update', state.handleGridUpdate);
  },
}));

/**
 * Map Store — H3 grid-based map data with real-time updates
 */
export const useMapStore = create((set, get) => ({
  locations: [],
  selectedLocation: null,
  h3Grid: [],
  heatmapPoints: [],
  riskLayers: [],
  nearbyPlaces: [],
  safeRoute: null,
  loading: false,
  gridLoading: false,
  searchLocation: null,

  setSearchLocation: (lat, lng, name) => {
    set({ searchLocation: { lat, lng, name } });
  },

  /**
   * Fetch H3 grid with live biosafety scores
   */
  fetchNearbyPlaces: async (lat, lng, radius = 0.5) => {
    try {
      const response = await api.get('/map/nearby', { params: { lat, lng, radius } });
      set({
        nearbyPlaces: response.data?.places || [],
      });
    } catch {
      set({ nearbyPlaces: [] });
    }
  },

  fetchSafeRoute: async (fromLat, fromLng, toLat, toLng) => {
    try {
      const response = await api.get('/map/safe-route', {
        params: { fromLat, fromLng, toLat, toLng },
      });
      set({ safeRoute: response.data });
      return response.data;
    } catch {
      set({ safeRoute: null });
      return null;
    }
  },

  clearSafeRoute: () => set({ safeRoute: null }),

  fetchLocations: async (lat, lng, rings) => {
    set({ loading: true, gridLoading: true });
    try {
      const params = {};
      if (lat) params.lat = lat;
      if (lng) params.lng = lng;
      if (rings) params.rings = rings;

      const response = await api.get('/map/locations', { params });
      const locations = response.data || [];

      set({
        locations,
        h3Grid: locations,
        loading: false,
        gridLoading: false,
      });
    } catch (error) {
      set({ loading: false, gridLoading: false });
    }
  },

  /**
   * Handle Socket.IO grid updates
   */
  scoresToLocations: (data) => {
    if (!data?.scores) return [];
    const gridMap = new Map(
      (data.grid || []).map((g) => [g.h3Index, g.boundary || []])
    );
    return data.scores.map((s, idx) => {
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
      boundary: gridMap.get(s.h3Index) || [],
      breakdown: s.breakdown,
      reasoning: s.reasoning,
      timestamp: s.timestamp,
      };
    });
  },

  handleGridUpdate: (data) => {
    if (!data?.scores) return;
    const locations = get().scoresToLocations(data);

    set((state) => {
      const selectedH3 = state.selectedLocation?.h3Index;
      const updatedSelection = selectedH3
        ? locations.find((l) => l.h3Index === selectedH3) || state.selectedLocation
        : state.selectedLocation;

      return {
        locations,
        h3Grid: locations,
        selectedLocation: updatedSelection,
      };
    });
  },

  handleHeatmapUpdate: (data) => {
    if (data?.points) {
      set({ heatmapPoints: data.points });
    }
  },

  handleScoreChange: (data) => {
    if (!data?.h3Index) return;
    set((state) => ({
      locations: state.locations.map((loc) =>
        loc.h3Index === data.h3Index
          ? {
              ...loc,
              riskScore: data.biosafetyScore,
              riskLevel: data.riskLevel,
              riskColor: data.riskColor,
            }
          : loc
      ),
    }));
  },

  /**
   * Initialize Socket.IO event listeners
   */
  initSocketListeners: () => {
    const state = get();
    onSocketEvent('grid-update', state.handleGridUpdate);
    onSocketEvent('heatmap-update', state.handleHeatmapUpdate);
    onSocketEvent('score-change', state.handleScoreChange);
  },

  cleanupSocketListeners: () => {
    const state = get();
    offSocketEvent('grid-update', state.handleGridUpdate);
    offSocketEvent('heatmap-update', state.handleHeatmapUpdate);
    offSocketEvent('score-change', state.handleScoreChange);
  },

  selectLocation: (location) => {
    set({ selectedLocation: location });
  },

  setRiskLayers: (layers) => {
    set({ riskLayers: layers });
  },

  updateHexScore: (h3Index, newScore) => {
    set((state) => ({
      locations: state.locations.map((loc) =>
        loc.h3Index === h3Index ? { ...loc, ...newScore } : loc
      ),
    }));
  },
}));
