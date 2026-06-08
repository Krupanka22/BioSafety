import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Map, Search, BarChart3, ChevronLeft, ChevronRight, Activity } from 'lucide-react';

/**
 * Sidebar Component - Enterprise Navigation Sidebar (Light Theme)
 */
const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [isExpanded, setIsExpanded] = useState(true);

  const navGroups = [
    {
      title: 'Command Center',
      items: [
        { id: 'dashboard', label: 'Dashboard Overview', route: '/dashboard', icon: LayoutDashboard },
        { id: 'map', label: 'Geospatial Map', route: '/map', icon: Map },
        { id: 'search', label: 'Location Search', route: '/search', icon: Search },
      ]
    },
    {
      title: 'Intelligence Modules',
      items: [
        { id: 'analytics', label: 'Environmental Analytics', route: '/analytics', icon: BarChart3 },
      ]
    }
  ];

  const handleNavigation = (route) => {
    navigate(route);
  };

  return (
    <aside
      className={`${
        isExpanded ? 'w-64' : 'w-20'
      } bg-white text-slate-700 h-screen flex flex-col border-r border-slate-200 transition-all duration-300 z-40 shadow-sm`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-center border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
            <Activity className="w-5 h-5" />
          </div>
          {isExpanded && <span className="font-bold text-lg tracking-tight text-slate-900">BioSafe</span>}
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-6 space-y-8 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-2">
            {isExpanded && (
              <p className="px-3 text-[11px] font-bold text-indigo-900/40 uppercase tracking-widest mb-3">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.route;
              const Icon = item.icon;
                
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.route)}
                  title={!isExpanded ? item.label : ''}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800 border border-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 px-3 flex items-center justify-center gap-2 text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-700 rounded-lg transition-all border border-transparent hover:border-slate-200 text-sm font-medium"
        >
          {isExpanded ? (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Menu</span>
            </>
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
