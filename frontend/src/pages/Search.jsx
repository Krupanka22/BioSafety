import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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

  // Focus input on mount
  const inputRef = useRef(null);
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await axios.get(`https://nominatim.openstreetmap.org/search`, {
          params: { q: query, format: 'json', limit: 10 },
          headers: { 'Accept': 'application/json' }
        });
        setSearchResults(res.data || []);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
  };

  const handleSelectLocation = (loc) => {
    setSearchLocation(parseFloat(loc.lat), parseFloat(loc.lon), loc.display_name);
    // Navigate back to the dashboard to see the newly loaded data
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Global Biosafety Search</h1>
          <p className="text-sm text-slate-500 uppercase tracking-widest">Target a new coordinate grid or city</p>
        </div>

        <div className="relative z-50">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Enter city, coordinates, or facility name..."
            className="w-full bg-white border-2 border-slate-300 rounded-lg text-lg px-6 py-4 focus:outline-none focus:border-slate-800 focus:ring-2 focus:ring-slate-200 transition-all shadow-sm"
          />
          <div className="absolute right-4 top-4 flex items-center gap-3">
            {isSearching && (
              <span className="text-xs font-bold text-slate-400 uppercase animate-pulse">Scanning...</span>
            )}
            <span className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded">
              Search
            </span>
          </div>
        </div>

        {/* Results Dropdown Area */}
        <div className="mt-4 w-full">
          {searchResults.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
              <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-widest">
                Found {searchResults.length} Potential Targets
              </div>
              <ul className="max-h-[50vh] overflow-y-auto">
                {searchResults.map((loc) => (
                  <li
                    key={loc.place_id}
                    onClick={() => handleSelectLocation(loc)}
                    className="px-6 py-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {loc.display_name.split(',')[0]}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{loc.display_name}</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Coordinates</p>
                      <p className="text-xs font-mono text-slate-700 mt-0.5">
                        {parseFloat(loc.lat).toFixed(4)}, {parseFloat(loc.lon).toFixed(4)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : searchQuery.trim() && !isSearching ? (
            <div className="text-center p-8 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">No matching sectors found</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Search;
