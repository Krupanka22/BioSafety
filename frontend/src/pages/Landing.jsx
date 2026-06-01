import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

/**
 * Landing Page - Application homepage
 */
const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: '🎯',
      title: 'Risk Prediction',
      description: 'Advanced AI-powered biosafety risk scoring and forecasting',
    },
    {
      icon: '🗺️',
      title: 'Geographic Mapping',
      description: 'Real-time heat maps and geospatial risk visualization',
    },
    {
      icon: '📊',
      title: 'Analytics Dashboard',
      description: 'Comprehensive analytics and trend analysis',
    },
    {
      icon: '🔔',
      title: 'Smart Alerts',
      description: 'Intelligent notification system for risk events',
    },
    {
      icon: '🔒',
      title: 'Privacy-First',
      description: 'Enterprise-grade security and data privacy',
    },
    {
      icon: '⚡',
      title: 'Real-Time Processing',
      description: 'Instant data processing and risk updates',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="min-h-screen bg-white overflow-hidden">
      {/* Navigation */}
      <motion.nav
        initial={{ y: -60 }}
        animate={{ y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 px-8 py-4 flex items-center justify-between bg-white border-b border-gray-100"
      >
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">
            B
          </div>
          <span className="font-bold text-xl text-black">BioSafe</span>
        </div>
        <div className="flex items-center gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/login')}
            className="btn-secondary"
          >
            Sign In
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/register')}
            className="btn-primary"
          >
            Get Started
          </motion.button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className="pt-32 pb-16 px-8 max-w-6xl mx-auto"
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="text-center space-y-8"
        >
          <motion.h1
            variants={itemVariants}
            className="text-5xl md:text-6xl font-bold text-black leading-tight"
          >
            Intelligent Biosafety
            <br />
            <span className="gradient-text">Risk Prediction Platform</span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl text-gray-600 max-w-2xl mx-auto"
          >
            Advanced AI-powered analytics for real-time biosafety monitoring, predictive
            forecasting, and intelligent risk management across geographic regions.
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-4 pt-4"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/register')}
              className="btn-primary text-lg px-8 py-3"
            >
              Start Free Trial
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="btn-secondary text-lg px-8 py-3"
            >
              Learn More
            </motion.button>
          </motion.div>
        </motion.div>

        {/* Hero Image Placeholder */}
        <motion.div
          variants={itemVariants}
          className="mt-16 h-96 bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-2xl border border-gray-200 flex items-center justify-center"
        >
          <div className="text-center">
            <p className="text-4xl mb-4">📊</p>
            <p className="text-gray-600">Interactive Dashboard Preview</p>
          </div>
        </motion.div>
      </motion.section>

      {/* Features Section */}
      <motion.section className="py-20 px-8 bg-white">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-6xl mx-auto"
        >
          <motion.div variants={itemVariants} className="text-center mb-16">
            <h2 className="text-4xl font-bold text-black mb-4">Powerful Features</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Everything you need for comprehensive biosafety risk management
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                whileHover={{ scale: 1.05, y: -10 }}
                className="card group cursor-pointer"
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-black mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="py-20 px-8 bg-black text-white"
      >
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl font-bold">Ready to Transform Your Safety Operations?</h2>
          <p className="text-gray-300 text-lg">
            Join leading organizations using BioSafe for intelligent risk management
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/register')}
            className="btn-secondary text-lg px-8 py-3 bg-white text-black hover:bg-gray-100"
          >
            Start Your Free Trial
          </motion.button>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8 px-8">
        <div className="max-w-6xl mx-auto text-center text-gray-600">
          <p>&copy; 2024 BioSafe. All rights reserved. | Privacy Policy | Terms of Service</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
