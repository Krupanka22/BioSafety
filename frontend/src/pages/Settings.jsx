import { motion } from 'framer-motion';

/**
 * Settings Page - Application settings
 */
const Settings = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 max-w-4xl"
    >
      <motion.div variants={itemVariants}>
        <h1 className="text-4xl font-bold text-black">Settings</h1>
        <p className="text-gray-600 mt-2">Configure application settings</p>
      </motion.div>

      {/* Account Settings */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Account Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">Theme</label>
            <select className="input-field">
              <option>Light (Default)</option>
              <option>Dark</option>
              <option>System</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-2">Language</label>
            <select className="input-field">
              <option>English</option>
              <option>Spanish</option>
              <option>French</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-2">Timezone</label>
            <select className="input-field">
              <option>UTC</option>
              <option>EST</option>
              <option>PST</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* API Keys */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">API Keys</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-black mb-2">API Key</label>
            <div className="flex gap-2">
              <input
                type="password"
                value="sk_live_••••••••••••••••"
                className="input-field flex-1"
                readOnly
              />
              <motion.button
                whileHover={{ scale: 1.05 }}
                className="btn-secondary"
              >
                Copy
              </motion.button>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            className="btn-secondary"
          >
            Regenerate Key
          </motion.button>
        </div>
      </motion.div>

      {/* Notifications */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Notification Settings</h2>
        <div className="space-y-4">
          {[
            { label: 'Critical Alerts', description: 'Immediate notifications for critical risks' },
            { label: 'Weekly Summary', description: 'Get weekly analytics summary' },
            { label: 'New Features', description: 'Be notified about new features' },
          ].map((setting, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-black">{setting.label}</p>
                <p className="text-sm text-gray-600">{setting.description}</p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Danger Zone */}
      <motion.div variants={itemVariants} className="card border-red-200 bg-red-50">
        <h2 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h2>
        <p className="text-gray-600 text-sm mb-4">
          These actions cannot be undone. Please proceed with caution.
        </p>
        <motion.button
          whileHover={{ scale: 1.05 }}
          className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
        >
          Delete Account
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

export default Settings;
