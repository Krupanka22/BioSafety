import { motion } from 'framer-motion';
import { useState } from 'react';
import { useAuthStore } from '../context/authContext';

/**
 * Navbar Component - Top navigation with user menu
 */
const Navbar = () => {
  const { user } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  return (
    <motion.nav
      initial={{ y: -60 }}
      animate={{ y: 0 }}
      className="bg-white border-b border-gray-100 px-8 py-4 flex items-center justify-between shadow-sm"
    >
      {/* Left Section - Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-black">Dashboard</h1>
      </div>

      {/* Right Section - User Profile */}
      <div className="flex items-center gap-6">
        {/* Notifications */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <span className="text-xl">🔔</span>
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </motion.button>

        {/* User Menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center font-bold text-sm">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <span className="hidden sm:block text-sm font-medium text-black">{user?.name || 'User'}</span>
          </motion.button>

          {/* User Dropdown Menu */}
          {showUserMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
            >
              <div className="p-4 border-b border-gray-100">
                <p className="font-medium text-black">{user?.name}</p>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
              <div className="p-2">
                {[
                  { label: 'Profile', icon: '👤' },
                  { label: 'Settings', icon: '⚙️' },
                  { label: 'Help', icon: '❓' },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded transition-colors text-black"
                  >
                    <span className="mr-2">{item.icon}</span>
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.nav>
  );
};

export default Navbar;
