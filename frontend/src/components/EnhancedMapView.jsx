import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet-heat';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { useIndependentMonitoring } from '../hooks/useIndependentMonitoring';
import { useLiveBiosafety } from '../hooks/useLiveBiosafety';
import LocationDetailPanel from './LocationDetailPanel';

/**
 * Enhanced Map View with 5km Independent Monitoring
 * Displays real-time biosafety heatmap with independent location analysis
 */
const EnhancedMapView = () => {
  const { lat, lng } = useLiveBiosafety({ watch: true });
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const heatLayerRef = useRef(null);
  const markersRef = useRef(new Map());
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  const {
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
  } = useIndependentMonitoring(lat, lng, 5);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    leafletMapRef.current = L.map(mapRef.current).setView([lat, lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(leafletMapRef.current);

    // Add current location marker
    L.circleMarker([lat, lng], {
      radius: 10,
      fillColor: '#3b82f6',
      color: '#1e40af',
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.8,
    }).bindPopup('📍 Your Location').addTo(leafletMapRef.current);

    return () => {
      // Cleanup on unmount
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Update heatmap when data changes
  useEffect(() => {
    if (!leafletMapRef.current || !heatmapData.length) return;

    // Remove old heatmap
    if (heatLayerRef.current) {
      leafletMapRef.current.removeLayer(heatLayerRef.current);
    }

    // Create heat array [lat, lng, intensity]
    const heat = heatmapData.map(point => [
      point.lat,
      point.lng,
      point.intensity,
    ]);

    // Add new heatmap layer
    heatLayerRef.current = L.heatLayer(heat, {
      radius: 40,
      blur: 25,
      maxZoom: 17,
      gradient: {
        0.0: '#22c55e',  // Green (Low)
        0.33: '#eab308', // Yellow (Moderate)
        0.66: '#f97316', // Orange (High)
        1.0: '#ef4444',  // Red (Critical)
      },
    }).addTo(leafletMapRef.current);
  }, [heatmapData]);

  // Update location markers
  useEffect(() => {
    if (!leafletMapRef.current) return;

    // Clear old markers except current location
    markersRef.current.forEach((marker, key) => {
      if (key !== 'current-location') {
        leafletMapRef.current.removeLayer(marker);
      }
    });
    markersRef.current.clear();

    // Add location markers
    for (const location of locations) {
      const key = `${location.latitude},${location.longitude}`;
      const color = getRiskColor(location.biosafetyScore);

      const marker = L.circleMarker([location.latitude, location.longitude], {
        radius: 8,
        fillColor: color,
        color: darkenColor(color),
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.7,
      }).bindPopup(
        `<div class="text-sm">
          <p class="font-bold">${location.label}</p>
          <p>Score: ${location.biosafetyScore?.toFixed(1)}</p>
          <p>Risk: ${location.riskLevel}</p>
        </div>`
      ).on('click', () => {
        getLocationDetails(location.latitude, location.longitude);
        setDetailPanelOpen(true);
      }).addTo(leafletMapRef.current);

      markersRef.current.set(key, marker);
    }
  }, [locations, getLocationDetails]);

  // Auto-fit map to bounds when monitoring starts
  useEffect(() => {
    if (monitoringActive && leafletMapRef.current && heatmapData.length > 0) {
      const bounds = L.latLngBounds(
        heatmapData.map(p => [p.lat, p.lng])
      );
      leafletMapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [monitoringActive, heatmapData]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Control Panel */}
      <motion.div
        className="p-4 bg-black/80 border-b border-white/10 backdrop-blur-xl"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">
            5km Independent Biosafety Monitoring
          </h2>
          {monitoringActive ? (
            <motion.button
              onClick={stopMonitoring}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Stop Monitoring
            </motion.button>
          ) : (
            <motion.button
              onClick={startMonitoring}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {loading ? 'Starting...' : 'Start Monitoring'}
            </motion.button>
          )}
        </div>

        {/* Stats */}
        {monitoringActive && (
          <div className="grid grid-cols-6 gap-4">
            <StatCard label="Total Points" value={statsMonitored.totalPoints} />
            <StatCard label="Grid Cells" value={statsMonitored.gridCells} />
            <StatCard label="Transport Hubs" value={statsMonitored.transportHubs} />
            <StatCard label="Junctions" value={statsMonitored.trafficJunctions} />
            <StatCard label="Crowded Areas" value={statsMonitored.crowdedAreas} />
            <StatCard
              label="Critical"
              value={statsMonitored.criticalLocations}
              critical={statsMonitored.criticalLocations > 0}
            />
          </div>
        )}

        {error && (
          <motion.div
            className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-300 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {error}
          </motion.div>
        )}
      </motion.div>

      {/* Map Container */}
      <div ref={mapRef} className="flex-1" />

      {/* Location Detail Panel */}
      <LocationDetailPanel
        locationDetail={locationDetail}
        isOpen={detailPanelOpen}
        onClose={() => setDetailPanelOpen(false)}
        loading={loading}
        error={error}
      />
    </div>
  );
};

/**
 * Stat Card Component
 */
function StatCard({ label, value, critical = false }) {
  return (
    <motion.div
      className={`p-3 rounded-lg border ${
        critical
          ? 'bg-red-500/10 border-red-500/50 text-red-300'
          : 'bg-white/5 border-white/20 text-white'
      }`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
    >
      <p className="text-xs opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </motion.div>
  );
}

/**
 * Utility Functions
 */
function getRiskColor(score) {
  if (score >= 75) return '#ef4444'; // Red
  if (score >= 50) return '#f97316'; // Orange
  if (score >= 25) return '#eab308'; // Yellow
  return '#22c55e'; // Green
}

function darkenColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = 30;
  const usePound = typeof hex === 'string' && hex[0] === '#';
  return (usePound ? '#' : '') + String('000000' + (num - amt).toString(16)).slice(-6);
}

export default EnhancedMapView;
