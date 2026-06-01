import { motion } from 'framer-motion';

/**
 * Loader Component - Full-screen loading animation
 */
const Loader = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-screen flex items-center justify-center bg-white"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full"
        />
        <p className="text-gray-600 font-medium">Loading BioSafe Platform...</p>
      </div>
    </motion.div>
  );
};

export default Loader;
