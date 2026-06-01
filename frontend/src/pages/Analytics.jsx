import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useAnalyticsStore, useDashboardStore } from '../context/stores';
import { useLiveBiosafety } from '../hooks/useLiveBiosafety';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';

/**
 * Analytics Page — Live predictive analytics with real data from API + AI engine
 */
const Analytics = () => {
  const { predictions, historicalData, correlationData, insights, loading,
    fetchPredictions, fetchHistoricalData, fetchCorrelation, fetchInsights,
    initSocketListeners, cleanupSocketListeners, lastLiveUpdate,
  } = useAnalyticsStore();

  const {
    riskData, aqiData, weatherData, overview, factorBreakdown, scoreHistory,
    initSocketListeners: initDashboardSockets, cleanupSocketListeners: cleanupDashboardSockets,
    connectionStatus,
  } = useDashboardStore();

  useLiveBiosafety({ watch: true });

  useEffect(() => {
    initSocketListeners();
    initDashboardSockets();
    fetchPredictions();
    fetchHistoricalData({ days: 30 });
    fetchCorrelation();
    fetchInsights();

    return () => {
      cleanupSocketListeners();
      cleanupDashboardSockets();
    };
  }, []);

  // Prediction chart data
  const forecastData = (predictions?.predictions || []).slice(0, 30).map((p, i) => ({
    day: `Day ${i + 1}`,
    predicted: Math.round(p.predicted_risk_score || p.predictedRisk || 0),
    upper: Math.round(p.confidence_interval?.[1] || (p.predicted_risk_score || 0) + 10),
    lower: Math.round(p.confidence_interval?.[0] || (p.predicted_risk_score || 0) - 10),
  }));

  // Correlation matrix colors
  const getCorrelationColor = (value) => {
    if (value >= 0.7) return '#ef4444';
    if (value >= 0.4) return '#f97316';
    if (value >= 0.1) return '#eab308';
    if (value >= -0.1) return '#9ca3af';
    if (value >= -0.4) return '#3b82f6';
    return '#1d4ed8';
  };

  // Factor bar data from live breakdown scores (real per-factor values)
  const fb = factorBreakdown || {};
  const factorData = [
    { name: 'AQI', score: fb.aqi ?? (aqiData?.score || 0), fill: '#f97316' },
    { name: 'Weather', score: fb.weather ?? (weatherData?.score || 0), fill: '#3b82f6' },
    { name: 'Crowd', score: fb.crowdDensity ?? 0, fill: '#8b5cf6' },
    { name: 'Hygiene', score: fb.hygiene ?? 0, fill: '#22c55e' },
    { name: 'Historical', score: fb.historical ?? 0, fill: '#6b7280' },
  ].map((d) => ({ ...d, score: Math.round(d.score) }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-4xl font-bold text-black mb-2">Advanced Analytics</h1>
        <p className="text-gray-600">Predictive modeling and risk forecasting from live data</p>
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Live stream active</>
          ) : (
            <><span className="w-2 h-2 rounded-full bg-red-500"></span> Waiting for live connection</>
          )}
          {lastLiveUpdate ? ` • Last grid update ${new Date(lastLiveUpdate).toLocaleTimeString()}` : ''}
        </p>
      </motion.div>

      {/* Live Prediction Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          {
            title: '7-Day Forecast',
            value: riskData?.level || predictions?.currentOverview?.riskLevel || '—',
            icon: <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>,
            description: `Avg predicted score: ${forecastData.slice(0, 7).length > 0
              ? Math.round(forecastData.slice(0, 7).reduce((s, d) => s + d.predicted, 0) / 7) : '—'
            }`,
          },
          {
            title: 'Peak Risk Hour',
            value: (() => {
              if (scoreHistory && scoreHistory.length >= 3) {
                const peak = scoreHistory.reduce((max, pt) => pt.score > max.score ? pt : max, scoreHistory[0]);
                return peak.time || '—';
              }
              return '—';
            })(),
            icon: <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>,
            description: `Current score: ${riskData?.score ?? overview?.avgScore ?? '—'}`,
          },
          {
            title: 'Model Confidence',
            value: predictions?.modelAccuracy ? `${predictions.modelAccuracy.toFixed(1)}%` : '—',
            icon: <div className="w-3 h-3 bg-slate-400 rounded-sm"></div>,
            description: `Based on ${predictions?.forecastDays || 0}-day forecast window`,
          },
        ].map((card, idx) => (
          <motion.div key={idx} whileHover={{ scale: 1.02, y: -5 }} className="card group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-gray-600 text-sm font-medium">{card.title}</p>
                <p className="text-2xl font-bold text-black mt-2">{card.value}</p>
              </div>
              <div className="text-3xl group-hover:scale-110 transition-transform">{card.icon}</div>
            </div>
            <p className="text-xs text-gray-600">{card.description}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Forecast Chart */}
        <motion.div className="card">
          <h2 className="text-xl font-bold text-black mb-4">Risk Forecast (30 Days)</h2>
          <div className="h-80">
            {forecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#000" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#000" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#9ca3af" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} interval={4} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="url(#confGrad)" name="Upper Bound" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="url(#confGrad)" name="Lower Bound" />
                  <Area type="monotone" dataKey="predicted" stroke="#000" fill="url(#forecastGrad)" strokeWidth={2} name="Predicted Risk" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400">Loading forecast data...</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Correlation Matrix */}
        <motion.div className="card">
          <h2 className="text-xl font-bold text-black mb-4">Factor Correlation</h2>
          <div className="h-80 overflow-auto">
            {correlationData?.factors && correlationData.correlation_matrix ? (
              <div className="space-y-1">
                {/* Header row */}
                <div className="flex gap-1 pl-20">
                  {correlationData.factors.map((f, i) => (
                    <div key={i} className="w-14 text-center text-xs text-gray-500 truncate" title={f}>{f.slice(0, 5)}</div>
                  ))}
                </div>
                {/* Matrix rows */}
                {correlationData.factors.map((factor, i) => (
                  <div key={i} className="flex gap-1 items-center">
                    <div className="w-20 text-xs text-gray-600 text-right pr-2 truncate" title={factor}>{factor}</div>
                    {correlationData.correlation_matrix[i]?.map((val, j) => (
                      <div
                        key={j}
                        className="w-14 h-10 rounded flex items-center justify-center text-xs font-mono text-white"
                        style={{ backgroundColor: getCorrelationColor(val) }}
                        title={`${correlationData.factors[i]} × ${correlationData.factors[j]}: ${val}`}
                      >
                        {typeof val === 'number' ? val.toFixed(2) : '—'}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400">Computing correlations...</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Factor Contribution Chart */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-4">Risk Factor Contributions</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={factorData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} width={80} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
              <Bar dataKey="score" name="Contribution Score" radius={[0, 4, 4, 0]}>
                {factorData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Insights Section — Live */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Key Insights & Recommendations</h2>
        <div className="space-y-4">
          {insights && insights.length > 0 ? (
            insights.map((insight, idx) => (
              <motion.div
                key={idx}
                whileHover={{ x: 5 }}
                className={`p-4 rounded-lg border transition-all cursor-pointer ${
                  insight.severity === 'critical' ? 'bg-red-50 border-red-200' :
                  insight.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                  'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                  <div>
                    <p className="font-medium text-black">{insight.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{insight.description}</p>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <div className="w-4 h-4 bg-slate-300 rounded-sm mb-3 mx-auto"></div>
              <p className="mt-2">Gathering insights from live data...</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Model Performance — from AI engine */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Model Performance Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Accuracy', value: predictions?.modelAccuracy ? `${predictions.modelAccuracy.toFixed(1)}%` : '—' },
            { label: 'Data Points', value: predictions?.predictions?.length ? `${predictions.predictions.length * 24}` : '—' },
            { label: 'Active Zones', value: overview?.totalHexes ?? '—' },
            { label: 'Data Sources', value: '8 free APIs' },
          ].map((metric, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">{metric.label}</p>
              <p className="text-2xl font-bold text-green-600">{metric.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Analytics;
