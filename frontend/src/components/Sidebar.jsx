import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../context/authContext';

/**
 * Sidebar Component - Enterprise Navigation Sidebar
 */
const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(true);

  const navGroups = [
    {
      title: 'Command Center',
      items: [
        { id: 'dashboard', label: 'Dashboard Overview', route: '/dashboard' },
        { id: 'map', label: 'Geospatial Map', route: '/map' },
        { id: 'search', label: 'Location Search', route: '/search' },
      ]
    },
    {
      title: 'Intelligence Modules',
      items: [
        { id: 'analytics', label: 'Environmental Analytics', route: '/analytics' },
      ]
    },
    {
      title: 'System & Reports',
      items: [
        { id: 'profile', label: 'User Profile', route: '/profile' },
        { id: 'settings', label: 'System Configuration', route: '/settings' },
      ]
    }
  ];

  const handleNavigation = (route) => {
    navigate(route);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`${
        isExpanded ? 'w-64' : 'w-16'
      } bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800 transition-all duration-300 z-40`}
    >
      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden scrollbar-thin">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {isExpanded && (
              <p className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                {group.title}
              </p>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.route && 
                (item.id === 'dashboard' || item.id === 'map' || item.id === 'analytics' || item.id === 'settings' || item.id === 'search');
                
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.route)}
                  title={!isExpanded ? item.label : ''}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-white border-l-2 border-emerald-500'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-l-2 border-transparent'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 group-hover:bg-slate-300 transition-colors"></span>
                  {isExpanded && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Actions */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 px-3 flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-slate-200 rounded transition-colors text-sm"
        >
          {isExpanded ? 'Collapse Sidebar ◀' : '▶'}
        </button>
        <button
          onClick={handleLogout}
          className={`w-full py-2 px-3 flex items-center justify-center bg-rose-900/50 hover:bg-rose-900 text-rose-200 rounded transition-colors text-sm ${!isExpanded && 'p-2'}`}
          title="Secure Logout"
        >
          {isExpanded ? 'SECURE LOGOUT' : 'EXIT'}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
