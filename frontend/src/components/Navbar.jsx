import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../context/authContext';
import { useMapStore } from '../context/stores';
import axios from 'axios';

/**
 * Navbar Component - Enterprise top navigation bar
 */
const Navbar = () => {
  const user = useAuthStore((state) => state.user);
  const setSearchLocation = useMapStore((state) => state.setSearchLocation);
  const [currentTime, setCurrentTime] = useState(new Date().toISOString());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString());
    }, 1000);
    return () => clearInterval(timer);
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
          params: { q: query, format: 'json', limit: 5 },
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
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <nav className="bg-white border-b border-slate-200 px-4 py-2 flex flex-col md:flex-row items-center justify-between shadow-sm z-50">
      {/* Left Section - Logo and Title */}
      <div className="flex items-center gap-4 w-full md:w-auto mb-2 md:mb-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">BS</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Biosafety Command Center</h1>
        </div>
        <div className="hidden md:flex h-6 border-l border-slate-300 mx-2"></div>
        <div className="hidden md:flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-xs font-medium text-slate-600 uppercase">System Online • Live Feed Active</span>
        </div>
      </div>

      {/* Center Section - Search Bar */}
      <div className="w-full md:w-96 flex-1 max-w-lg px-4 hidden lg:block relative z-50">
        <div className="relative">
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search coordinates, H3 index, or location name..." 
            className="w-full bg-slate-50 border border-slate-300 rounded text-sm px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <span className="absolute right-3 top-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-200 px-1.5 py-0.5 rounded">
            {isSearching ? '...' : 'Find'}
          </span>
        </div>
        
        {searchResults.length > 0 && (
          <div className="absolute top-full left-4 right-4 mt-1 bg-white border border-slate-200 shadow-lg rounded max-h-64 overflow-y-auto">
            {searchResults.map((loc) => (
              <div 
                key={loc.place_id} 
                onClick={() => handleSelectLocation(loc)}
                className="px-3 py-2 border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <p className="text-sm text-slate-800 font-medium truncate">{loc.display_name.split(',')[0]}</p>
                <p className="text-xs text-slate-500 truncate">{loc.display_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Section - System Status and User */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Last Sync</p>
          <p className="text-xs font-mono text-slate-700">{currentTime}</p>
        </div>
        
        <div className="h-6 border-l border-slate-300 hidden sm:block mx-1"></div>

        {/* Global Severity */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 uppercase">Global Status:</span>
          <span className="badge badge-safe uppercase">Nominal</span>
        </div>

        <div className="flex items-center gap-3 ml-2">
          <button className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition-colors" title="Notifications">
            ALERTS
          </button>
          <button className="text-[10px] font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition-colors" title="Settings">
            CONFIG
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <div className="w-7 h-7 bg-slate-800 text-white rounded flex items-center justify-center font-bold text-xs uppercase">
              {user?.name?.charAt(0) || 'U'}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
