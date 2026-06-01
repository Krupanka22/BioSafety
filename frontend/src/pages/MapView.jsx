import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';
import { useMapStore } from '../context/stores';
import { useLiveBiosafety } from '../hooks/useLiveBiosafety';
import { subscribeLocation } from '../services/socketService';

/**
 * MapView Page — Interactive GIS-style H3 hex grid biosafety risk map
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

  const [lastFetchKey, setLastFetchKey] = useState('');

  useEffect(() => {
    initSocketListeners();
    return () => cleanupSocketListeners();
  }, []);

  useEffect(() => {
    const key = `${lat.toFixed(3)}:${lng.toFixed(3)}`;
    if (key !== lastFetchKey) {
      setLastFetchKey(key);
      fetchLocations(lat, lng);
      fetchNearbyPlaces(lat, lng, 0.6);
    }
  }, [lat, lng, lastFetchKey]);

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
      { style: { color: '#0ea5e9', weight: 4, opacity: 0.9, dashArray: '5, 10' } }
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
              radius: 8, fillColor: '#0ea5e9', color: '#0369a1', weight: 2, opacity: 1, fillOpacity: 0.9,
            });
            marker.bindPopup('<b>Current Origin</b>');
            marker.addTo(leafletMapRef.current);
            currentLocationMarkerRef.current = marker;
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
      setGeoError('Geolocation unsupported');
      setGeoLoading(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return;

    const map = L.map(mapRef.current, { zoomControl: false }).setView([lat, lng], 13);
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Using a more clinical/enterprise map tile style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap contributors © CARTO',
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
        layer.setStyle({ fillColor, fillOpacity: 0.25 });
        layer.setPopupContent(createPopupContent(loc));
      } else if (loc.boundary?.length > 0) {
        layer = L.polygon(loc.boundary, {
          fillColor, color: '#475569', weight: 1, opacity: 0.6, fillOpacity: 0.25,
        });
        layer.bindPopup(createPopupContent(loc));
        layer.on('click', () => selectLocation(loc));
        layer.addTo(hexLayerGroupRef.current);
        hexLayersRef.current.set(loc.h3Index, layer);
      } else {
        layer = L.circleMarker([loc.lat, loc.lng], {
          radius: 12, fillColor, color: '#475569', weight: 1, opacity: 0.6, fillOpacity: 0.25,
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

  useEffect(() => {
    if (!heatLayerGroupRef.current) return;
    heatLayerGroupRef.current.clearLayers();
    const points = heatmapPoints?.length > 0 ? heatmapPoints : locations.map((loc) => ({
      lat: loc.lat, lng: loc.lng, intensity: (loc.riskScore || 0) / 100, riskColor: loc.riskColor,
    }));

    points.forEach((pt) => {
      const intensity = pt.intensity ?? (pt.score || 0) / 100;
      if (intensity < 0.15) return;
      L.circle([pt.lat, pt.lng], {
        radius: 400, fillColor: pt.riskColor || '#e11d48', color: 'transparent', fillOpacity: intensity * 0.15,
      }).addTo(heatLayerGroupRef.current);
    });
  }, [heatmapPoints, locations]);

  function getColorForRisk(level) {
    const colors = { CRITICAL: '#e11d48', HIGH: '#ea580c', MODERATE: '#d97706', LOW: '#16a34a' };
    return colors[level] || '#94a3b8';
  }

  function getBadgeClass(level) {
    const classes = { CRITICAL: 'badge-critical', HIGH: 'badge-high', MODERATE: 'badge-moderate', LOW: 'badge-safe' };
    return classes[level] || 'badge-safe';
  }

  function createPopupContent(loc) {
    return `
      <div style="font-family:-apple-system, sans-serif; font-size:12px;">
        <strong style="display:block;margin-bottom:4px;font-size:14px;color:#0f172a;">${loc.name}</strong>
        <div style="color:#64748b;font-family:monospace;margin-bottom:8px;">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</div>
        <div style="padding:2px 6px; border-radius:2px; display:inline-block; font-weight:bold; color:white; background-color:${loc.riskColor || '#ccc'}; margin-bottom:8px;">${loc.riskLevel} RISK (${loc.riskScore})</div>
        <p style="margin:0;color:#334155;">Click region for detailed telemetry.</p>
      </div>
    `;
  }

  return (
    <div className="h-full flex flex-col space-y-4 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Geospatial Intelligence Map</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">
            Monitoring {locations.length} H3 sectors • Global EPSG:4326 Projection
          </p>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <button
            onClick={handleZoomToCurrentLocation}
            disabled={geoLoading}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            {geoLoading ? 'Acquiring...' : 'Target Origin'}
          </button>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Map Sync</p>
            <p className="text-xs font-mono text-slate-700">
              {lastMapUpdate ? lastMapUpdate.toLocaleTimeString() : 'Awaiting data'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
        {/* Left Side: Map Controls & Layers */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
          
          <div className="card bg-slate-50 border-slate-300">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">Map Layers & Filters</h3>
            <div className="space-y-3">
              {[
                { level: 'CRITICAL', color: 'bg-rose-600', label: 'Critical Risk Sectors' },
                { level: 'HIGH', color: 'bg-orange-600', label: 'High Risk Sectors' },
                { level: 'MODERATE', color: 'bg-amber-500', label: 'Moderate Risk Sectors' },
                { level: 'LOW', color: 'bg-emerald-600', label: 'Low Risk Sectors' },
              ].map((filter) => (
                <label key={filter.level} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLevels[filter.level]}
                    onChange={() => setFilterLevels((p) => ({ ...p, [filter.level]: !p[filter.level] }))}
                    className="w-4 h-4 rounded text-slate-800 border-slate-300 focus:ring-slate-500"
                  />
                  <div className={`w-3 h-3 rounded-sm ${filter.color}`}></div>
                  <span className="text-xs font-medium text-slate-700 flex-1">{filter.label}</span>
                  <span className="text-[10px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {locations.filter((l) => l.riskLevel === filter.level).length}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 pb-2 mb-3">
              Sector Directory ({locations.length})
            </h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
              {[...locations]
                .sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
                .map((loc) => (
                  <button
                    key={loc.h3Index || loc.id}
                    onClick={() => {
                      selectLocation(loc);
                      if (leafletMapRef.current) leafletMapRef.current.setView([loc.lat, loc.lng], 16);
                    }}
                    className={`w-full text-left p-2 rounded border transition-colors flex items-center justify-between ${
                      selectedLocation?.h3Index === loc.h3Index
                        ? 'bg-slate-800 border-slate-900 text-white shadow-inner'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex-1 truncate pr-2">
                      <p className="font-bold text-xs truncate uppercase">{loc.name}</p>
                      <p className={`text-[10px] font-mono mt-0.5 ${selectedLocation?.h3Index === loc.h3Index ? 'text-slate-300' : 'text-slate-500'}`}>
                        {loc.riskLevel} / {loc.riskScore}
                      </p>
                    </div>
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: loc.riskColor || '#94a3b8' }}></div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Center: Live Map */}
        <div className="lg:col-span-2 relative border border-slate-300 rounded-md shadow-sm bg-slate-100 flex flex-col">
          <div ref={mapRef} className="flex-1 w-full rounded-md z-10"></div>
          {!mapReady && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50/80">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Initializing GIS Matrix...</span>
            </div>
          )}
        </div>

        {/* Right Side: Selected Location Biosafety Panel */}
        <div className="lg:col-span-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
          {selectedLocation ? (
            <div className="card bg-white border-slate-300">
              <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase truncate pr-2" title={selectedLocation.name}>
                    {selectedLocation.name}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-1">IDX: {selectedLocation.h3Index}</p>
                </div>
                <span className={`badge ${getBadgeClass(selectedLocation.riskLevel)} uppercase font-bold text-[10px]`}>
                  {selectedLocation.riskLevel}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Risk Score</p>
                  <p className="text-2xl font-black text-slate-800" style={{ color: selectedLocation.riskColor }}>
                    {selectedLocation.riskScore}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Est. Safe</p>
                  <p className="text-sm font-bold text-slate-700 mt-1">
                    {selectedLocation.timeToSafe || 'Unknown'}
                  </p>
                </div>
              </div>

              {selectedLocation.reasoning?.summary && (
                <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700 leading-relaxed font-medium">
                  {selectedLocation.reasoning.summary}
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                  Environmental Metrics
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="block text-[10px] text-slate-500 uppercase">AQI (PM2.5)</span>
                    <span className="font-mono font-bold text-slate-800">{selectedLocation.breakdown?.aqi?.raw ?? '--'}</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="block text-[10px] text-slate-500 uppercase">Temp</span>
                    <span className="font-mono font-bold text-slate-800">{selectedLocation.breakdown?.weather?.temp ?? '--'}°C</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="block text-[10px] text-slate-500 uppercase">Crowd Density</span>
                    <span className="font-mono font-bold text-slate-800">{selectedLocation.breakdown?.crowdDensity?.score ?? '--'}/100</span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded border border-slate-100">
                    <span className="block text-[10px] text-slate-500 uppercase">Hygiene</span>
                    <span className="font-mono font-bold text-slate-800">{selectedLocation.breakdown?.hygiene?.score ?? '--'}/100</span>
                  </div>
                </div>
              </div>

              {selectedLocation.breakdown?.crowdDensity?.hotspots?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1 mb-2">
                    Detected Hotspots
                  </h4>
                  <ul className="text-[10px] space-y-1 max-h-24 overflow-y-auto scrollbar-thin">
                    {selectedLocation.breakdown.crowdDensity.hotspots.map((h, i) => (
                      <li key={i} className="flex justify-between py-1 border-b border-slate-50">
                        <span className="font-medium text-slate-700 truncate mr-2">{h.name}</span>
                        <span className="text-slate-400 font-mono truncate max-w-[80px]">{h.type}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-200">
                <button
                  onClick={handleSafeRoute}
                  disabled={routeLoading}
                  className="w-full btn-primary flex justify-center items-center gap-2 text-xs"
                >
                  {routeLoading ? 'Calculating Safe Vector...' : 'Plot Evacuation Route'}
                </button>
                {safeRoute?.direct?.risk?.avgRisk != null && (
                  <div className="mt-2 text-[10px] font-mono bg-slate-50 p-2 rounded border border-slate-200">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Direct Route Risk:</span>
                      <span className="font-bold text-slate-700">{safeRoute.direct.risk.avgRisk}</span>
                    </div>
                    {safeRoute.recommendation === 'alternative' && safeRoute.alternative?.risk && (
                      <div className="flex justify-between mt-1 text-emerald-600">
                        <span>Safe Alt Found:</span>
                        <span className="font-bold">{safeRoute.alternative.risk.avgRisk}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 border-dashed border-2">
              <div className="w-4 h-4 bg-slate-300 rounded-sm mb-3"></div>
              <p className="text-xs font-bold uppercase tracking-wider text-center">No Sector Selected</p>
              <p className="text-[10px] text-slate-400 mt-2 text-center max-w-[150px]">Select a region on the map or from the directory to view detailed telemetry.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapView;
