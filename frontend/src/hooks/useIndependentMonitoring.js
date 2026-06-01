import { useCallback, useEffect, useRef, useState } from 'react';
import {
    analyzeLocationIndependently,
    getLocationDetail,
    offSocketEvent,
    onSocketEvent,
    start5kmMonitoring,
    stop5kmMonitoring,
} from '../services/socketService';

/**
 * Hook for managing independent location monitoring with factor-wise analysis
 */
export function useIndependentMonitoring(centerLat, centerLng, radiusKm = 5) {
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [locations, setLocations] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationDetail, setLocationDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statsMonitored, setStatsMonitored] = useState({
    totalPoints: 0,
    gridCells: 0,
    transportHubs: 0,
    trafficJunctions: 0,
    crowdedAreas: 0,
    criticalLocations: 0,
  });

  const locationsByTypeRef = useRef({
    GRID_CELL: [],
    TRANSPORT_HUB: [],
    TRAFFIC_JUNCTION: [],
    CROWDED_AREA: [],
  });

  // Handle 5km monitoring start
  const handleMonitoringStart = useCallback((data) => {
    if (data.success) {
      setLoading(false);
      setMonitoringActive(true);
      setError(null);

      setStatsMonitored({
        totalPoints: data.totalPoints,
        gridCells: data.pointsByType?.GRID_CELL?.length || 0,
        transportHubs: data.pointsByType?.TRANSPORT_HUB?.length || 0,
        trafficJunctions: data.pointsByType?.TRAFFIC_JUNCTION?.length || 0,
        crowdedAreas: data.pointsByType?.CROWDED_AREA?.length || 0,
        criticalLocations: 0,
      });

      locationsByTypeRef.current = data.pointsByType;
    } else {
      setLoading(false);
      setError(data.error || 'Failed to start monitoring');
      setMonitoringActive(false);
    }
  }, []);

  // Handle independent location analysis
  const handleLocationAnalysis = useCallback((data) => {
    if (data && !data.error) {
      setLocations(prev => {
        const existing = prev.find(l => l.latitude === data.latitude && l.longitude === data.longitude);
        if (existing) {
          return prev.map(l =>
            l.latitude === data.latitude && l.longitude === data.longitude ? data : l
          );
        }
        return [...prev, data];
      });

      // Update critical locations count
      if (data.riskLevel === 'CRITICAL' || data.riskLevel === 'HIGH') {
        setStatsMonitored(prev => ({
          ...prev,
          criticalLocations: (prev.criticalLocations || 0) + 1,
        }));
      }
    }
  }, []);

  // Handle heatmap updates
  const handleHeatmapUpdate = useCallback((data) => {
    setHeatmapData(data.points || []);
  }, []);

  // Handle location detail
  const handleLocationDetail = useCallback((data) => {
    if (data && !data.error) {
      setLocationDetail(data);
    }
  }, []);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setLoading(true);
    setError(null);
    start5kmMonitoring(centerLat, centerLng, radiusKm, true);
  }, [centerLat, centerLng, radiusKm]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setMonitoringActive(false);
    setLocations([]);
    setHeatmapData([]);
    setLocationDetail(null);
    stop5kmMonitoring();
  }, []);

  // Get details for a location
  const getLocationDetails = useCallback((lat, lng) => {
    getLocationDetail(lat, lng, true);
    setSelectedLocation({ lat, lng });
  }, []);

  // Analyze a specific location independently
  const analyzeLocation = useCallback((lat, lng, label) => {
    analyzeLocationIndependently(lat, lng, label);
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    onSocketEvent('5km-monitoring-start', handleMonitoringStart);
    onSocketEvent('independent-location-analysis', handleLocationAnalysis);
    onSocketEvent('independent-location-update', handleLocationAnalysis);
    onSocketEvent('5km-heatmap-update', handleHeatmapUpdate);
    onSocketEvent('location-detail', handleLocationDetail);

    return () => {
      offSocketEvent('5km-monitoring-start', handleMonitoringStart);
      offSocketEvent('independent-location-analysis', handleLocationAnalysis);
      offSocketEvent('independent-location-update', handleLocationAnalysis);
      offSocketEvent('5km-heatmap-update', handleHeatmapUpdate);
      offSocketEvent('location-detail', handleLocationDetail);
    };
  }, [handleMonitoringStart, handleLocationAnalysis, handleHeatmapUpdate, handleLocationDetail]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (monitoringActive) {
        stopMonitoring();
      }
    };
  }, [monitoringActive, stopMonitoring]);

  return {
    monitoringActive,
    locations,
    heatmapData,
    selectedLocation,
    locationDetail,
    loading,
    error,
    statsMonitored,
    startMonitoring,
    stopMonitoring,
    getLocationDetails,
    analyzeLocation,
    setSelectedLocation,
  };
}

/**
 * Hook for detailed location analysis with factor-wise reasoning
 */
export function useLocationDetailAnalysis(lat, lng) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAnalysis = useCallback((data) => {
    if (data && !data.error) {
      setAnalysis(data);
      setError(null);
    } else if (data?.error) {
      setError(data.error);
    }
    setLoading(false);
  }, []);

  const analyze = useCallback(() => {
    setLoading(true);
    getLocationDetail(lat, lng, true);
  }, [lat, lng]);

  useEffect(() => {
    onSocketEvent('location-detail', handleAnalysis);
    return () => {
      offSocketEvent('location-detail', handleAnalysis);
    };
  }, [handleAnalysis]);

  return { analysis, loading, error, analyze };
}

/**
 * Hook for factor-wise reasoning display
 */
export function useFactorWiseReasoning(factors, reasoning) {
  const [displayItems, setDisplayItems] = useState([]);

  useEffect(() => {
    if (reasoning && Array.isArray(reasoning)) {
      const items = reasoning.map((reason, idx) => ({
        id: idx,
        text: reason,
        severity: extractSeverity(reason),
        icon: extractIcon(reason),
      }));
      setDisplayItems(items);
    }
  }, [reasoning]);

  return { displayItems };
}

function extractSeverity(reason) {
  if (reason.includes('HAZARDOUS') || reason.includes('🚨') || reason.includes('CRITICAL')) return 'critical';
  if (reason.includes('UNHEALTHY') || reason.includes('⚠️') || reason.includes('UNSAFE')) return 'high';
  if (reason.includes('HEAVY') || reason.includes('HIGH')) return 'moderate';
  return 'low';
}

function extractIcon(reason) {
  if (reason.includes('🚨')) return '🚨';
  if (reason.includes('⚠️')) return '⚠️';
  if (reason.includes('💧')) return '💧';
  if (reason.includes('🌡️')) return '🌡️';
  if (reason.includes('🌪️')) return '🌪️';
  if (reason.includes('☀️')) return '☀️';
  if (reason.includes('🌧️')) return '🌧️';
  if (reason.includes('👥')) return '👥';
  if (reason.includes('🚆')) return '🚆';
  if (reason.includes('🚗')) return '🚗';
  if (reason.includes('🔥')) return '🔥';
  if (reason.includes('🚫')) return '🚫';
  if (reason.includes('✓')) return '✓';
  return '📍';
}
