import { motion } from 'framer-motion';
import { useFactorWiseReasoning } from '../hooks/useIndependentMonitoring';

/**
 * Location Detail Panel Component
 * Displays complete environmental intelligence with factor-wise independent analysis
 */
const LocationDetailPanel = ({
  locationDetail,
  isOpen,
  onClose,
  loading,
  error,
}) => {
  const { displayItems } = useFactorWiseReasoning(
    locationDetail?.factors,
    locationDetail?.alerts || []
  );

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-2xl max-h-[90vh] bg-black/90 border border-white/20 rounded-t-2xl overflow-y-auto backdrop-blur-xl"
        initial={{ y: 500 }}
        animate={{ y: 0 }}
        exit={{ y: 500 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 p-6 border-b border-white/10 bg-black/95 backdrop-blur-xl flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {locationDetail?.location ? `Location ${locationDetail.location.lat.toFixed(4)}, ${locationDetail.location.lng.toFixed(4)}` : 'Location Detail'}
            </h2>
            <p className="text-white/60 text-sm">{locationDetail?.timestamp}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block">
                <div className="animate-spin rounded-full h-8 w-8 border border-white/30 border-t-white"></div>
              </div>
              <p className="text-white/60 mt-4">Loading environmental data...</p>
            </div>
          ) : locationDetail ? (
            <>
              {/* Biosafety Score */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-white/60 text-sm mb-2">Biosafety Score</p>
                  <p className="text-4xl font-bold text-white">
                    {locationDetail.biosafetyScore?.toFixed(1) || '—'}
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-white/60 text-sm mb-2">Risk Level</p>
                  <p className={`text-2xl font-bold ${getRiskLevelColor(locationDetail.riskLevel)}`}>
                    {locationDetail.riskLevel || '—'}
                  </p>
                </div>
              </div>

              {/* Environmental Intelligence */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">Environmental Intelligence</h3>

                {/* Air Quality */}
                {locationDetail.environmentalIntelligence?.airQuality && (
                  <EnvironmentalCard
                    title="Air Quality & Pollution"
                    icon="💨"
                    data={locationDetail.environmentalIntelligence.airQuality}
                  />
                )}

                {/* Weather */}
                {locationDetail.environmentalIntelligence?.weather && (
                  <EnvironmentalCard
                    title="Weather Conditions"
                    icon="🌡️"
                    data={locationDetail.environmentalIntelligence.weather}
                  />
                )}

                {/* Crowd Metrics */}
                {locationDetail.environmentalIntelligence?.crowdMetrics && (
                  <EnvironmentalCard
                    title="Crowd & Congestion Metrics"
                    icon="👥"
                    data={locationDetail.environmentalIntelligence.crowdMetrics}
                  />
                )}

                {/* Hygiene Analysis */}
                {locationDetail.environmentalIntelligence?.hygieneAnalysis && (
                  <EnvironmentalCard
                    title="Hygiene & Sanitation"
                    icon="🧼"
                    data={locationDetail.environmentalIntelligence.hygieneAnalysis}
                  />
                )}
              </div>

              {/* Factor-wise Reasoning */}
              {displayItems.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white">Factor-wise Risk Analysis</h3>
                  <div className="space-y-2">
                    {displayItems.map((item) => (
                      <motion.div
                        key={item.id}
                        className={`p-3 rounded-lg border-l-4 ${getSeverityStyles(item.severity)}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: item.id * 0.05 }}
                      >
                        <p className="text-white/90">
                          <span className="mr-2">{item.icon}</span>
                          {item.text}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detailed Factors */}
              {locationDetail.factors && (
                <div className="mt-6 pt-6 border-t border-white/10">
                  <h3 className="text-lg font-semibold text-white mb-4">Detailed Factor Breakdown</h3>
                  <FactorBreakdown factors={locationDetail.factors} />
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-white/60">
              No data available
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

/**
 * Environmental Card Component
 */
function EnvironmentalCard({ title, icon, data }) {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
        <span>{icon}</span>
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {Object.entries(data).map(([key, value]) => (
          <div key={key} className="p-2 bg-black/30 rounded">
            <p className="text-white/60 text-xs capitalize">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </p>
            <p className="text-white font-semibold mt-1">
              {formatValue(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Factor Breakdown Component
 */
function FactorBreakdown({ factors }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Object.entries(factors).map(([category, categoryData]) => (
        <div key={category} className="p-3 rounded-lg bg-white/5 border border-white/10">
          <h5 className="font-semibold text-white capitalize mb-2">
            {category.replace(/([A-Z])/g, ' $1').trim()}
          </h5>
          {typeof categoryData === 'object' && categoryData !== null ? (
            <div className="space-y-1 text-sm">
              {Object.entries(categoryData).map(([key, value]) => (
                <div key={key} className="flex justify-between text-white/70">
                  <span>{key}:</span>
                  <span className="text-white">{formatValue(value)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white">{formatValue(categoryData)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Utility Functions
 */
function getRiskLevelColor(riskLevel) {
  switch (riskLevel) {
    case 'CRITICAL':
      return 'text-red-400';
    case 'HIGH':
      return 'text-orange-400';
    case 'MODERATE':
      return 'text-yellow-400';
    case 'LOW':
      return 'text-green-400';
    default:
      return 'text-white/60';
  }
}

function getSeverityStyles(severity) {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 border-red-500/50 text-red-300';
    case 'high':
      return 'bg-orange-500/10 border-orange-500/50 text-orange-300';
    case 'moderate':
      return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-300';
    case 'low':
      return 'bg-green-500/10 border-green-500/50 text-green-300';
    default:
      return 'bg-white/5 border-white/20 text-white/70';
  }
}

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return value.toFixed(1);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default LocationDetailPanel;
