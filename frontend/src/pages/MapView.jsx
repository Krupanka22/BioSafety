import { motion } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../context/stores';
import { useLiveBiosafety } from '../hooks/useLiveBiosafety';
import { subscribeLocation } from '../services/socketService';

/**
 * MapView Page — Interactive H3 hex grid biosafety risk map with real-time updates
 */
const MapView = () => {
  const {
    fetchLocations, fetchNearbyPlaces, fetchSafeRoute, clearSafeRoute,
    locations, selectLocation, selectedLocation, nearbyPlaces, safeRoute,
    heatmapPoints, initSocketListeners, cleanupSocketListeners,
  } = useMapStore();

  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);
  const hexLayerGroupRef = useRef(null);
  const heatLayerGroupRef = useRef(null);
  const routeLayerRef = useRef(null);
  const hexLayersRef = useRef(new Map());
  const [routeLoading, setRouteLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [lastMapUpdate, setLastMapUpdate] = useState(null);
  const [filterLevels, setFilterLevels] = useState({
    CRITICAL: true, HIGH: true, MODERATE: true, LOW: true,
  });

  const { lat, lng } = useLiveBiosafety({ watch: true });

  useEffect(() => {
    initSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  useEffect(() => {
    fetchLocations(lat, lng);
    fetchNearbyPlaces(lat, lng, 0.6);
  }, [lat, lng]);

  const handleSafeRoute = async () => {
    if (!selectedLocation || !leafletMapRef.current) return;
    setRouteLoading(true);
    clearSafeRoute();
    if (routeLayerRef.current) {
      leafletMapRef.current.removeLayer(routeLayerRef.current);
      routeLayerRef.current = null;
    }

    const data = await fetchSafeRoute(lat, lng, selectedLocation.lat, selectedLocation.lng);
    setRouteLoading(false);
    if (!data?.direct?.geometry) return;

    const geom =
      data.recommendation === 'alternative' && data.alternative?.geometry
        ? data.alternative.geometry
        : data.direct.geometry;

    routeLayerRef.current = L.geoJSON(
      { type: 'Feature', geometry: geom },
      { style: { color: '#2563eb', weight: 4, opacity: 0.85 } }
    ).addTo(leafletMapRef.current);

    leafletMapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });
  };

  const handleZoomToCurrentLocation = () => {
    setGeoLoading(true);
    setGeoError('');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;

          if (leafletMapRef.current) {
            leafletMapRef.current.setView([latitude, longitude], 14);

            if (currentLocationMarkerRef.current) {
              leafletMapRef.current.removeLayer(currentLocationMarkerRef.current);
            }

            const marker = L.circleMarker([latitude, longitude], {
              radius: 12,
              fillColor: '#3b82f6',
              color: '#1e40af',
              weight: 3,
              opacity: 0.9,
              fillOpacity: 0.8,
            });

            marker.bindPopup('📍 Your Current Location');
            marker.addTo(leafletMapRef.current);
            currentLocationMarkerRef.current = marker;

            // Refresh data for this location
            fetchLocations(latitude, longitude);
            subscribeLocation(latitude, longitude);
          }

          setGeoLoading(false);
        },
        (error) => {
          setGeoError(`Location error: ${error.message}`);
          setGeoLoading(false);
        }
      );
    } else {
      setGeoError('Geolocation not supported by your browser');
      setGeoLoading(false);
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current).setView([lat, lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    hexLayerGroupRef.current = L.layerGroup().addTo(map);
    heatLayerGroupRef.current = L.layerGroup().addTo(map);

    leafletMapRef.current = map;
    setMapReady(true);

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  // Incrementally update H3 hex layers (colors refresh without full map rebuild)
  useEffect(() => {
    if (!leafletMapRef.current || !hexLayerGroupRef.current || !locations?.length) return;

    const activeIds = new Set();

    locations.forEach((loc) => {
      if (!filterLevels[loc.riskLevel]) {
        const existing = hexLayersRef.current.get(loc.h3Index);
        if (existing) {
          hexLayerGroupRef.current.removeLayer(existing);
          hexLayersRef.current.delete(loc.h3Index);
        }
        return;
      }

      activeIds.add(loc.h3Index);
      const fillColor = loc.riskColor || getColorForRisk(loc.riskLevel);
      let layer = hexLayersRef.current.get(loc.h3Index);

      if (layer) {
        layer.setStyle({ fillColor, fillOpacity: 0.45 });
        layer.setPopupContent(createPopupContent(loc));
      } else if (loc.boundary?.length > 0) {
        layer = L.polygon(loc.boundary, {
          fillColor,
          color: '#374151',
          weight: 1,
          opacity: 0.7,
          fillOpacity: 0.45,
        });
        layer.bindPopup(createPopupContent(loc));
        layer.on('click', () => selectLocation(loc));
        layer.addTo(hexLayerGroupRef.current);
        hexLayersRef.current.set(loc.h3Index, layer);
      } else {
        layer = L.circleMarker([loc.lat, loc.lng], {
          radius: 12,
          fillColor,
          color: '#374151',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6,
        });
        layer.bindPopup(createPopupContent(loc));
        layer.on('click', () => selectLocation(loc));
        layer.addTo(hexLayerGroupRef.current);
        hexLayersRef.current.set(loc.h3Index, layer);
      }
    });

    for (const [h3Index, layer] of hexLayersRef.current) {
      if (!activeIds.has(h3Index)) {
        hexLayerGroupRef.current.removeLayer(layer);
        hexLayersRef.current.delete(h3Index);
      }
    }

    setLastMapUpdate(new Date());
  }, [locations, filterLevels, selectLocation]);

  // Live heatmap overlay from socket heatmapPoints (falls back to location scores)
  useEffect(() => {
    if (!heatLayerGroupRef.current) return;

    heatLayerGroupRef.current.clearLayers();
    const points = heatmapPoints?.length > 0
      ? heatmapPoints
      : locations.map((loc) => ({
          lat: loc.lat,
          lng: loc.lng,
          intensity: (loc.riskScore || 0) / 100,
          riskColor: loc.riskColor,
        }));

    points.forEach((pt) => {
      const intensity = pt.intensity ?? (pt.score || 0) / 100;
      if (intensity < 0.15) return;
      const heatCircle = L.circle([pt.lat, pt.lng], {
        radius: 450,
        fillColor: pt.riskColor || '#ef4444',
        color: 'transparent',
        fillOpacity: intensity * 0.2,
      });
      heatCircle.addTo(heatLayerGroupRef.current);
    });
  }, [heatmapPoints, locations]);

  function getColorForRisk(level) {
    const colors = {
      CRITICAL: '#ef4444',
      HIGH: '#f97316',
      MODERATE: '#eab308',
      LOW: '#22c55e',
    };
    return colors[level] || '#9ca3af';
  }

  function createPopupContent(loc) {
    const b = loc.breakdown || {};
    return `
      <div style="min-width:200px;font-family:inherit;">
        <h3 style="font-weight:bold;margin:0 0 8px 0;font-size:14px;">${loc.name}</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px;">
          <span>🛡️ Biosafety:</span><strong>${loc.riskScore ?? '—'}</strong>
          <span>🌬️ AQI:</span><strong>${b.aqi?.raw ?? '—'}</strong>
          <span>🌫️ PM2.5:</span><strong>${b.aqi?.pm25 ?? '—'}</strong>
          <span>🌡️ Temp:</span><strong>${b.weather?.temp ?? '—'}°C</strong>
          <span>💧 Humid:</span><strong>${b.weather?.humidity ?? '—'}%</strong>
          <span>👥 Crowd:</span><strong>${b.crowdDensity?.score ?? '—'}</strong>
          <span>🧼 Hygiene:</span><strong>${b.hygiene?.score ?? '—'}</strong>
        </div>
        <div style="margin-top:8px;padding:4px 8px;background:${loc.riskColor || '#ccc'};color:white;border-radius:4px;text-align:center;font-weight:bold;font-size:12px;">
          ${loc.riskLevel} RISK
        </div>
        ${loc.reasoning?.summary ? `<p style="margin-top:8px;font-size:11px;color:#374151;line-height:1.4;">${loc.reasoning.summary}</p>` : ''}
      </div>
    `;
  }

  const toggleFilter = (level) => {
    setFilterLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-4xl font-bold text-black mb-2">Risk Heat Map</h1>
        <p className="text-gray-600">
          Live H3 grid (~5km radius) — {locations.length} independent zones · per-cell data
        </p>
      </motion.div>

      {/* Map + Sidebar */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Area */}
        <div className="lg:col-span-2 space-y-3">
          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 items-center flex-wrap">
            <button
              onClick={handleZoomToCurrentLocation}
              disabled={geoLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition-all hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {geoLoading ? (
                <><span className="animate-spin">⏳</span> Getting Location...</>
              ) : (
                <>📍 My Location</>
              )}
            </button>
            <span className="text-xs text-gray-400">
              {locations.length} hexes • ~1km² each
            </span>
            {lastMapUpdate && (
              <span className="flex items-center gap-1.5 text-xs text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Updated {lastMapUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
            {geoError && <p className="text-sm text-red-600">{geoError}</p>}
          </motion.div>

          {/* Map */}
          <div
            ref={mapRef}
            className="card h-96 md:h-[500px] rounded-lg overflow-hidden"
            style={{ zIndex: 1 }}
          ></div>
        </div>

        {/* Sidebar */}
        <motion.div className="space-y-4">
          {/* Filters */}
          <motion.div className="card">
            <h3 className="font-bold text-black mb-4">Risk Filters</h3>
            <div className="space-y-3">
              {[
                { level: 'CRITICAL', color: 'bg-red-500',    label: 'Critical Risk' },
                { level: 'HIGH',     color: 'bg-orange-500', label: 'High Risk' },
                { level: 'MODERATE', color: 'bg-yellow-500', label: 'Moderate Risk' },
                { level: 'LOW',      color: 'bg-green-500',  label: 'Low Risk' },
              ].map((filter) => (
                <label key={filter.level} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLevels[filter.level]}
                    onChange={() => toggleFilter(filter.level)}
                    className="w-4 h-4"
                  />
                  <div className={`w-3 h-3 rounded ${filter.color}`}></div>
                  <span className="text-sm text-black">{filter.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">
                    {locations.filter((l) => l.riskLevel === filter.level).length}
                  </span>
                </label>
              ))}
            </div>
          </motion.div>

          {/* Selected Location Details */}
          {selectedLocation && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card">
              <h3 className="font-bold text-black mb-4">Zone Details</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600">Zone ID</p>
                  <p className="font-medium text-black">{selectedLocation.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Biosafety Score</p>
                  <p className="font-bold text-2xl" style={{ color: selectedLocation.riskColor }}>
                    {selectedLocation.riskScore} <span className="text-sm font-normal">/ 100</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Risk Level</p>
                  <span className="inline-block px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: selectedLocation.riskColor }}>
                    {selectedLocation.riskLevel}
                  </span>
                </div>

                {/* Breakdown */}
                {selectedLocation.breakdown?.crowdDensity?.hotspots?.length > 0 && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 font-medium mb-2">Crowd Hotspots (OSM)</p>
                    <ul className="text-xs space-y-1 max-h-24 overflow-y-auto">
                      {selectedLocation.breakdown.crowdDensity.hotspots.slice(0, 5).map((h, i) => (
                        <li key={i} className="text-gray-700">
                          {h.name} <span className="text-gray-400">({h.type})</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedLocation.breakdown && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 font-medium">Score Breakdown</p>
                    {[
                      { label: 'AQI', value: selectedLocation.breakdown.aqi?.score, icon: '🌬️' },
                      { label: 'Weather', value: selectedLocation.breakdown.weather?.score, icon: '🌡️' },
                      { label: 'Crowd', value: selectedLocation.breakdown.crowdDensity?.score, icon: '👥' },
                      { label: 'Hygiene', value: selectedLocation.breakdown.hygiene?.score, icon: '🧼', invert: true },
                      { label: 'Historical', value: selectedLocation.breakdown.historical?.score, icon: '📊' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="text-sm">{item.icon}</span>
                        <span className="text-xs text-gray-600 w-16">{item.label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div
                            className="bg-black h-1.5 rounded-full transition-all"
                            style={{ width: `${item.value || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-mono text-gray-600 w-8 text-right">
                          {item.value ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-xs text-gray-600">Coordinates</p>
                  <p className="font-mono text-sm text-black">
                    {selectedLocation.lat?.toFixed(4)}, {selectedLocation.lng?.toFixed(4)}
                  </p>
                </div>

                {selectedLocation.reasoning?.summary && (
                  <div className="p-2 bg-gray-50 rounded text-xs text-gray-700 leading-relaxed">
                    {selectedLocation.reasoning.summary}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSafeRoute}
                  disabled={routeLoading}
                  className="w-full mt-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {routeLoading ? 'Calculating OSRM route…' : '🛣️ Safe route (OSRM)'}
                </button>
                {safeRoute?.direct?.risk?.avgRisk != null && (
                  <p className="text-xs text-gray-500 mt-1">
                    Route avg risk: {safeRoute.direct.risk.avgRisk}
                    {safeRoute.recommendation === 'alternative' && safeRoute.alternative?.risk
                      ? ` → safer alt: ${safeRoute.alternative.risk.avgRisk}`
                      : ''}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Nearby OSM / Nominatim places */}
          <motion.div className="card">
            <h3 className="font-bold text-black mb-3">
              Nearby Places <span className="text-xs text-gray-400 font-normal">(Nominatim)</span>
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {nearbyPlaces.length > 0 ? (
                nearbyPlaces.slice(0, 8).map((p, i) => (
                  <div key={`${p.osmId}-${i}`} className="text-sm p-2 bg-gray-50 rounded">
                    <p className="font-medium text-black truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.distanceKm} km</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">Loading nearby places…</p>
              )}
            </div>
          </motion.div>

          {/* Nearby Zones List */}
          <motion.div className="card">
            <h3 className="font-bold text-black mb-4">
              Nearby Zones <span className="text-xs text-gray-400 font-normal">({locations.length})</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {locations && locations.length > 0 ? (
                [...locations]
                  .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
                  .slice(0, 20)
                  .map((loc) => (
                    <motion.button
                      key={loc.h3Index || loc.id}
                      whileHover={{ x: 5 }}
                      onClick={() => {
                        selectLocation(loc);
                        if (leafletMapRef.current) {
                          leafletMapRef.current.setView([loc.lat, loc.lng], 15);
                        }
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-all flex items-center justify-between ${
                        selectedLocation?.h3Index === loc.h3Index
                          ? 'bg-black text-white'
                          : 'bg-gray-50 text-black hover:bg-gray-100'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">{loc.name}</p>
                        <p className="text-xs opacity-75">{loc.riskLevel}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{loc.riskScore ?? '—'}</span>
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: loc.riskColor || '#9ca3af' }}
                        ></div>
                      </div>
                    </motion.button>
                  ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">Loading zones...</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Legend */}
      <motion.div variants={itemVariants} className="card">
        <h3 className="font-bold text-black mb-4">Risk Level Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { color: 'bg-red-500', label: 'Critical', value: '75-100' },
            { color: 'bg-orange-500', label: 'High', value: '50-74' },
            { color: 'bg-yellow-500', label: 'Moderate', value: '25-49' },
            { color: 'bg-green-500', label: 'Low', value: '0-24' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${item.color}`}></div>
              <div className="text-sm">
                <p className="font-medium text-black">{item.label}</p>
                <p className="text-xs text-gray-600">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MapView;
