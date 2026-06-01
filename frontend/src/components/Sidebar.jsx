import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authContext';

/**
 * Sidebar Component - Main navigation sidebar with minimal design
 */
const Sidebar = () => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeRoute, setActiveRoute] = useState('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', route: '/dashboard' },
    { id: 'map', label: 'Risk Map', icon: '🗺️', route: '/map' },
    { id: 'analytics', label: 'Analytics', icon: '📈', route: '/analytics' },
    { id: 'profile', label: 'Profile', icon: '👤', route: '/profile' },
    { id: 'settings', label: 'Settings', icon: '⚙️', route: '/settings' },
  ];

  const handleNavigation = (item) => {
    setActiveRoute(item.id);
    navigate(item.route);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <motion.aside
      initial={{ x: -250 }}
      animate={{ x: 0 }}
      transition={{ duration: 0.3 }}
      className={`${
        isExpanded ? 'w-64' : 'w-20'
      } bg-black text-white h-screen flex flex-col border-r border-gray-800 transition-all duration-300`}
    >
      {/* Logo */}
      <div className="p-6 border-b border-gray-800">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black font-bold text-lg">
            B
          </div>
          {isExpanded && <span className="font-bold text-lg">BioSafe</span>}
        </motion.div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <AnimatePresence>
          {navItems.map((item) => (
            <motion.button
              key={item.id}
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleNavigation(item)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activeRoute === item.id
                  ? 'bg-white text-black'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {isExpanded && <span className="font-medium">{item.label}</span>}
            </motion.button>
          ))}
        </AnimatePresence>
      </nav>

      {/* Footer Actions */}
      <div className="p-4 border-t border-gray-800 space-y-2">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 px-4 text-gray-300 hover:bg-gray-800 rounded-lg transition-all"
        >
          {isExpanded ? '←' : '→'}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleLogout}
          className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition-all"
        >
          {isExpanded ? 'Logout' : '🚪'}
        </motion.button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
