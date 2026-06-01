import { motion } from 'framer-motion';

/**
 * Profile Page - User profile and personal settings
 */
const Profile = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
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
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-4xl font-bold text-black">Profile</h1>
        <p className="text-gray-600 mt-2">Manage your account information</p>
      </motion.div>

      {/* Profile Card */}
      <motion.div variants={itemVariants} className="card">
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
          {/* Avatar */}
          <div className="w-32 h-32 bg-black text-white rounded-2xl flex items-center justify-center text-6xl font-bold">
            U
          </div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl font-bold text-black mb-2">John Doe</h2>
            <p className="text-gray-600 mb-4">john@example.com</p>
            <p className="text-sm text-gray-500 mb-4">
              Biosafety Risk Analyst | Joined March 2024
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              className="btn-secondary"
            >
              Edit Profile
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Statistics */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {[
          { label: 'Alerts Reviewed', value: '234' },
          { label: 'Reports Generated', value: '45' },
          { label: 'Active Regions', value: '12' },
        ].map((stat, idx) => (
          <motion.div key={idx} className="card text-center">
            <p className="text-3xl font-bold text-black">{stat.value}</p>
            <p className="text-gray-600 text-sm mt-2">{stat.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Personal Info Form */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Personal Information</h2>
        <form className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                First Name
              </label>
              <input type="text" defaultValue="John" className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-black mb-2">
                Last Name
              </label>
              <input type="text" defaultValue="Doe" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Email
            </label>
            <input type="email" defaultValue="john@example.com" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-black mb-2">
              Organization
            </label>
            <input type="text" defaultValue="Health Department" className="input-field" />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            type="button"
            className="btn-primary"
          >
            Save Changes
          </motion.button>
        </form>
      </motion.div>

      {/* Preferences */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Preferences</h2>
        <div className="space-y-4">
          {[
            { label: 'Email Notifications', description: 'Receive alerts via email' },
            { label: 'Weekly Reports', description: 'Get summary reports every week' },
            { label: 'Dark Mode', description: 'Use dark theme (coming soon)' },
          ].map((pref, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div>
                <p className="font-medium text-black">{pref.label}</p>
                <p className="text-sm text-gray-600">{pref.description}</p>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5" />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Profile;
