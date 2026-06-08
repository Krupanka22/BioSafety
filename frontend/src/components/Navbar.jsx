import { useState, useEffect, useRef } from 'react';
import { useMapStore } from '../context/stores';
import api from '../services/api';
import { Bell, Settings, User, Search as SearchIcon, Activity } from 'lucide-react';

/**
 * Navbar Component - Enterprise top navigation bar (Light Theme)
 */
const Navbar = () => {
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
        const res = await api.get(`/dashboard/search-location`, {
          params: { q: query }
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
    <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex flex-col md:flex-row items-center justify-between shadow-sm z-50">
      {/* Left Section - Logo and Title */}
      <div className="flex items-center gap-4 w-full md:w-auto mb-2 md:mb-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Activity className="w-5 h-5" />
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Command Center</h1>
        </div>
        <div className="hidden md:flex h-6 border-l border-slate-200 mx-2"></div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Live Feed Active</span>
        </div>
      </div>

      {/* Center Section - Search Bar */}
      <div className="w-full md:w-96 flex-1 max-w-xl px-4 hidden lg:block relative z-50">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
          </div>
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search coordinates, H3 index, or location name..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm pl-10 pr-16 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
          <span className="absolute right-2 top-2 text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
            {isSearching ? '...' : 'Find'}
          </span>
        </div>
        
        {searchResults.length > 0 && (
          <div className="absolute top-full left-4 right-4 mt-2 bg-white border border-slate-200 shadow-xl rounded-xl max-h-64 overflow-y-auto overflow-x-hidden">
            {searchResults.map((loc) => (
              <div 
                key={loc.place_id} 
                onClick={() => handleSelectLocation(loc)}
                className="px-4 py-3 border-b border-slate-50 hover:bg-indigo-50/50 cursor-pointer transition-colors"
              >
                <p className="text-sm text-slate-900 font-bold truncate">{loc.name || loc.display_name.split(',')[0]}</p>
                <p className="text-xs text-slate-500 truncate">{loc.display_name}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Section - System Status and User */}
      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
        <div className="text-right hidden sm:block">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Last Sync</p>
          <p className="text-xs font-mono text-slate-700 font-semibold">{currentTime}</p>
        </div>
        
        <div className="h-6 border-l border-slate-200 hidden sm:block mx-1"></div>

        {/* Global Severity */}
        <div className="flex items-center gap-2">
          <span className="badge badge-indigo">SYSTEM NOMINAL</span>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Notifications">
            <Bell className="w-5 h-5" />
          </button>
          <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Settings">
            <Settings className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 ml-1">
            <div className="w-8 h-8 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold text-xs uppercase border border-slate-200 hover:bg-slate-200 cursor-pointer transition-colors">
              <User className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
