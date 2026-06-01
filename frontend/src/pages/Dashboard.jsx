import { motion } from 'framer-motion';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDashboardStore } from '../context/stores';
import { useLiveBiosafety } from '../hooks/useLiveBiosafety';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/**
 * Dashboard Page — Live biosafety monitoring hub
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const {
    fetchDashboardData, riskData, exposureScore, alerts, trends, loading,
    biosafetyScore, aqiData, weatherData, hygieneScore, crowdDensity,
    overview, lastUpdated, connectionStatus, scoreHistory,
    initSocketListeners, cleanupSocketListeners,
  } = useDashboardStore();

  const { lat, lng } = useLiveBiosafety({ watch: true });

  useEffect(() => {
    initSocketListeners();
    fetchDashboardData(lat, lng);

    const interval = setInterval(() => fetchDashboardData(lat, lng), 30000);

    return () => {
      cleanupSocketListeners();
      clearInterval(interval);
    };
  }, [lat, lng]);

  // Time since last update
  const timeSinceUpdate = useMemo(() => {
    if (!lastUpdated) return 'Waiting for data...';
    const seconds = Math.round((Date.now() - new Date(lastUpdated).getTime()) / 1000);
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.round(seconds / 60)}m ago`;
  }, [lastUpdated]);

  // Chart data from real score history (populated by socket events + REST)
  const chartData = useMemo(() => {
    if (scoreHistory && scoreHistory.length > 0) {
      return scoreHistory;
    }
    // No data yet — show empty state
    return [];
  }, [scoreHistory]);

  // Risk level color
  const getRiskColor = (level) => {
    const colors = {
      CRITICAL: 'text-red-600',
      HIGH: 'text-orange-500',
      MODERATE: 'text-yellow-600',
      LOW: 'text-green-600',
    };
    return colors[level] || 'text-gray-600';
  };

  const getRiskBg = (level) => {
    const colors = {
      CRITICAL: 'bg-red-500',
      HIGH: 'bg-orange-500',
      MODERATE: 'bg-yellow-500',
      LOW: 'bg-green-500',
    };
    return colors[level] || 'bg-gray-400';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Header with live status */}
      <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-black mb-2">Risk Overview</h1>
          <p className="text-gray-600">Real-time biosafety monitoring and predictive analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
            connectionStatus === 'reconnecting' ? 'bg-yellow-500 animate-pulse' :
            'bg-red-500'
          }`}></div>
          <span className="text-xs text-gray-500">
            {connectionStatus === 'connected' ? `Live • Updated ${timeSinceUpdate}` :
             connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Offline'}
          </span>
        </div>
      </motion.div>

      {/* KPI Cards — Live Data */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Biosafety Score */}
        <motion.div whileHover={{ scale: 1.02, y: -5 }} className="card group cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium mb-1">Biosafety Score</p>
              <p className={`text-4xl font-bold ${getRiskColor(riskData?.level)}`}>
                {riskData?.score ?? biosafetyScore ?? '—'}
              </p>
            </div>
            <span className="text-3xl group-hover:scale-110 transition-transform">🛡️</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-1000 ${getRiskBg(riskData?.level)}`}
              style={{ width: `${riskData?.score || biosafetyScore || 0}%` }}
            ></div>
          </div>
          <p className={`text-xs mt-2 font-semibold ${getRiskColor(riskData?.level)}`}>
            {riskData?.level || 'LOADING'}
          </p>
        </motion.div>

        {/* AQI */}
        <motion.div whileHover={{ scale: 1.02, y: -5 }} className="card group cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium mb-1">Air Quality (AQI)</p>
              <p className={`text-4xl font-bold ${
                (aqiData?.raw || 0) > 200 ? 'text-red-600' :
                (aqiData?.raw || 0) > 100 ? 'text-orange-500' :
                (aqiData?.raw || 0) > 50 ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {aqiData?.raw ?? '—'}
              </p>
            </div>
            <span className="text-3xl group-hover:scale-110 transition-transform">🌬️</span>
          </div>
          <p className="text-xs text-gray-500">
            PM2.5: {aqiData?.pm25 ?? '—'} • PM10: {aqiData?.pm10 ?? '—'} • OpenWeatherMap live
          </p>
        </motion.div>

        {/* Weather */}
        <motion.div whileHover={{ scale: 1.02, y: -5 }} className="card group cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium mb-1">Weather Risk</p>
              <p className="text-4xl font-bold text-black">
                {weatherData?.score ?? '—'}
              </p>
            </div>
            <span className="text-3xl group-hover:scale-110 transition-transform">
              {weatherData?.condition === 'Rain' ? '🌧️' :
               weatherData?.condition === 'Clouds' ? '☁️' :
               weatherData?.condition === 'Clear' ? '☀️' : '🌤️'}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            {weatherData?.temp ?? '—'}°C • {weatherData?.humidity ?? '—'}% • UV {weatherData?.uvIndex ?? '—'} • {weatherData?.condition ?? '—'}
          </p>
        </motion.div>

        {/* Active Alerts */}
        <motion.div whileHover={{ scale: 1.02, y: -5 }} className="card group cursor-pointer">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="text-gray-600 text-sm font-medium mb-1">Active Alerts</p>
              <p className={`text-4xl font-bold ${alerts?.length > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {alerts?.length || 0}
              </p>
            </div>
            <span className="text-3xl group-hover:scale-110 transition-transform">🔔</span>
          </div>
          <p className="text-xs text-gray-500">
            {alerts?.length === 0 ? 'All clear — no threats detected' : `${alerts?.length} alert(s) require attention`}
          </p>
        </motion.div>
      </motion.div>

      {/* Secondary KPIs — Crowd & Hygiene */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div whileHover={{ scale: 1.02 }} className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">👥</span>
            <p className="text-gray-600 text-sm font-medium">Crowd Density</p>
          </div>
          <p className="text-3xl font-bold text-black">
            {crowdDensity !== undefined && crowdDensity !== null ? crowdDensity : '—'}
            <span className="text-sm text-gray-400 ml-1">/100</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">OSM + Overpass · transport & hotspots</p>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🧼</span>
            <p className="text-gray-600 text-sm font-medium">Hygiene Score</p>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {hygieneScore !== undefined && hygieneScore !== null ? hygieneScore : '—'}
            <span className="text-sm text-gray-400 ml-1">/100</span>
          </p>
        </motion.div>

        <motion.div whileHover={{ scale: 1.02 }} className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">⏱️</span>
            <p className="text-gray-600 text-sm font-medium">Time to Safe</p>
          </div>
          <p className="text-3xl font-bold text-black">
            {riskData?.timeToSafe || '—'}
          </p>
        </motion.div>
      </motion.div>

      {/* Content Grid — Chart + Alerts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend Chart */}
        <motion.div className="lg:col-span-2 card">
          <h2 className="text-xl font-bold text-black mb-4">Risk Trend (24h)</h2>
          <div className="h-64">
            {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#000000" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9ca3af' }} interval={3} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Area
                  type="monotone" dataKey="score" name="Risk Score"
                  stroke="#000000" fill="url(#riskGradient)" strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <span className="text-3xl">📈</span>
                  <p className="text-gray-400 mt-2">Collecting live data...</p>
                  <p className="text-xs text-gray-300 mt-1">Chart will populate as scores arrive</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Alerts */}
        <motion.div className="card">
          <h2 className="text-xl font-bold text-black mb-4">Recent Alerts</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {alerts && alerts.length > 0 ? (
              alerts.slice(0, 5).map((alert, idx) => (
                <motion.div
                  key={alert.id || idx}
                  whileHover={{ x: 5 }}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                    alert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                    'bg-gray-50 border-gray-200'
                  }`}
                >
                  <p className="text-sm font-medium text-black">{alert.title}</p>
                  <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'Just now'}
                  </p>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8">
                <span className="text-3xl">✅</span>
                <p className="text-gray-500 mt-2">No recent alerts</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Trends Section — Live Data */}
      <motion.div variants={itemVariants} className="card">
        <h2 className="text-xl font-bold text-black mb-6">Trend Analysis</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              label: 'This Hour',
              change: trends?.week?.change || '—',
              trend: trends?.week?.trend || 'stable',
            },
            {
              label: 'Today',
              change: trends?.month?.change || '—',
              trend: trends?.month?.trend || 'stable',
            },
            {
              label: 'This Week',
              change: trends?.year?.change || '—',
              trend: trends?.year?.trend || 'stable',
            },
          ].map((trend, idx) => (
            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">{trend.label}</p>
              <p className={`text-2xl font-bold ${
                trend.trend === 'down' ? 'text-green-600' :
                trend.trend === 'up' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {trend.change}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {trend.trend === 'up' ? '↑ Increasing risk' :
                 trend.trend === 'down' ? '↓ Decreasing risk' :
                 '→ Stable'}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Zone Overview */}
      {overview && overview.totalHexes > 0 && (
        <motion.div variants={itemVariants} className="card">
          <h2 className="text-xl font-bold text-black mb-4">Zone Status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 bg-red-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-red-600">{overview.criticalCount || 0}</p>
              <p className="text-xs text-red-600">Critical</p>
            </div>
            <div className="p-3 bg-orange-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-orange-500">{overview.highCount || 0}</p>
              <p className="text-xs text-orange-500">High</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-yellow-600">{overview.moderateCount || 0}</p>
              <p className="text-xs text-yellow-600">Moderate</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-green-600">{overview.lowCount || 0}</p>
              <p className="text-xs text-green-600">Low</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            Monitoring {overview.totalHexes} H3 hex zones (~1km² each)
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default Dashboard;
