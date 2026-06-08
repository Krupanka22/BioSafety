import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapStore } from '../context/stores';

/**
 * Global Location Search Page
 */
const Search = () => {
  const navigate = useNavigate();
  const setSearchLocation = useMapStore((state) => state.setSearchLocation);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markersRef = useRef([]);

  // Focus input on mount
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();

    // Init map
    if (!leafletMapRef.current && mapRef.current) {
      const map = L.map(mapRef.current, { zoomControl: false }).setView([20, 0], 2);
      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
    }

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const executeSearch = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      clearMarkers();
      return;
    }

    setIsSearching(true);
    try {
      // Use backend proxy to avoid Nominatim 429 rate limits and browser CORS issues
      const res = await api.get(`/dashboard/search-location`, {
        params: { q: query }
      });
      
      const features = res.data || [];
      const results = features.map(f => ({
        place_id: f.place_id || Math.random(),
        lat: parseFloat(f.lat),
        lon: parseFloat(f.lon),
        display_name: f.display_name,
        name: f.display_name.split(',')[0]
      }));

      setSearchResults(results);
      
      clearMarkers();
      
      if (results.length > 0 && leafletMapRef.current) {
        const bounds = L.latLngBounds();
        results.forEach((loc, idx) => {
          const marker = L.circleMarker([loc.lat, loc.lon], {
            radius: idx === 0 ? 10 : 6,
            fillColor: idx === 0 ? '#10b981' : '#3b82f6',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
          }).addTo(leafletMapRef.current);
          
          marker.bindPopup(`<b>${loc.name}</b><br/>${loc.display_name}`);
          
          // Clicking marker selects it
          marker.on('click', () => handleSelectLocation(loc));
          
          markersRef.current.push(marker);
          bounds.extend([loc.lat, loc.lon]);
        });
        
        leafletMapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchResults([]);
      clearMarkers();
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    // Debounce to 1500ms to avoid Nominatim 429 rate limits
    searchTimeoutRef.current = setTimeout(() => {
      executeSearch(query);
    }, 1500);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      executeSearch(searchQuery);
    }
  };

  const clearMarkers = () => {
    if (leafletMapRef.current) {
      markersRef.current.forEach(m => leafletMapRef.current.removeLayer(m));
      markersRef.current = [];
    }
  };

  const handleSelectLocation = (loc) => {
    setSearchLocation(parseFloat(loc.lat), parseFloat(loc.lon), loc.display_name);
    // Navigate back to the Map to see the newly loaded telemetry data plotted
    navigate('/map');
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-100px)]">
      {/* Left side: Search and Results */}
      <div className="w-full md:w-1/3 flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-50/80 backdrop-blur-sm border-b border-slate-200">
          <h1 className="text-xl font-extrabold text-slate-900 uppercase tracking-tight mb-2">Global Biosafety Search</h1>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-4">Target a new coordinate grid or city</p>
          
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter city, facility..."
              className="w-full bg-white border border-slate-200 rounded-lg text-sm px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            <div className="absolute right-3 top-3 flex items-center gap-2">
              {isSearching && (
                <span className="text-[10px] font-bold text-slate-400 uppercase animate-pulse">Scanning...</span>
              )}
              <button 
                onClick={() => executeSearch(searchQuery)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md shadow-sm transition-colors"
              >
                Find
              </button>
            </div>
          </div>
        </div>

        {/* Results Dropdown Area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-white">
          {searchResults.length > 0 ? (
            <ul>
              {searchResults.map((loc, idx) => (
                <li
                  key={loc.place_id}
                  onClick={() => handleSelectLocation(loc)}
                  className={`px-6 py-4 border-b border-slate-50 hover:bg-indigo-50/50 cursor-pointer transition-colors group flex flex-col justify-between gap-1 ${idx === 0 ? 'bg-indigo-50/30' : ''}`}
                >
                  <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {loc.name}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-tight">{loc.display_name}</p>
                  <div className="mt-2 text-left">
                    <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Coordinates</p>
                    <p className="text-[10px] font-mono text-slate-700 mt-0.5">
                      {parseFloat(loc.lat).toFixed(4)}, {parseFloat(loc.lon).toFixed(4)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : searchQuery.trim() && !isSearching ? (
            <div className="text-center p-8">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No matching sectors found</p>
            </div>
          ) : (
            <div className="text-center p-8 text-slate-400">
              <p className="text-xs font-bold uppercase tracking-widest">Awaiting Input</p>
              <p className="text-[10px] mt-2">Search for a location to view coordinates and map data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Map */}
      <div className="w-full md:w-2/3 rounded-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] border border-slate-200 overflow-hidden relative min-h-[300px]">
        <div ref={mapRef} className="absolute inset-0 z-10"></div>
        {isSearching && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm transition-all">
            <span className="text-sm font-bold text-indigo-700 uppercase tracking-widest bg-white px-6 py-3 rounded-lg shadow-xl border border-indigo-100 animate-pulse">
              Locating Targets...
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;
