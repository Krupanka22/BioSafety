import { useEffect, useMemo } from 'react';
import { useDashboardStore } from '../context/stores';
import { useLiveBiosafety } from '../hooks/useLiveBiosafety';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

/**
 * Dashboard Page — Enterprise Biosafety Monitoring Hub
 */
const Dashboard = () => {
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

    return () => {
      cleanupSocketListeners();
    };
  }, [lat, lng]);

  const timeSinceUpdate = useMemo(() => {
    if (!lastUpdated) return 'WAITING FOR TELEMETRY';
    const seconds = Math.round((Date.now() - new Date(lastUpdated).getTime()) / 1000);
    if (seconds < 5) return 'SYNCED JUST NOW';
    if (seconds < 60) return `SYNCED ${seconds}s AGO`;
    return `SYNCED ${Math.round(seconds / 60)}m AGO`;
  }, [lastUpdated]);

  const chartData = useMemo(() => {
    if (scoreHistory && scoreHistory.length > 0) return scoreHistory;
    return [];
  }, [scoreHistory]);

  const getRiskColor = (level) => {
    const colors = {
      CRITICAL: 'text-rose-600',
      HIGH: 'text-orange-600',
      MODERATE: 'text-amber-600',
      LOW: 'text-emerald-600',
    };
    return colors[level] || 'text-slate-600';
  };

  const getBadgeClass = (level) => {
    const classes = {
      CRITICAL: 'badge-critical',
      HIGH: 'badge-high',
      MODERATE: 'badge-moderate',
      LOW: 'badge-safe',
    };
    return classes[level] || 'badge-safe';
  };

  const currentLevel = riskData?.level || 'LOW';

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Environmental Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1 uppercase tracking-wider">Coordinates: {lat?.toFixed(5)}, {lng?.toFixed(5)}</p>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
              connectionStatus === 'reconnecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
            }`}></span>
            <span className="text-xs font-bold text-slate-700 uppercase">
              {connectionStatus === 'connected' ? 'TELEMETRY ACTIVE' :
               connectionStatus === 'reconnecting' ? 'RECONNECTING...' : 'OFFLINE'}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono mt-1">{timeSinceUpdate}</span>
        </div>
      </div>

      {/* Primary Telemetry Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Risk Score */}
        <div className="card border-t-4 border-t-slate-800">
          <div className="card-header">
            <span className="metric-label">System Risk Score</span>
            <span className={`badge ${getBadgeClass(currentLevel)} uppercase`}>{currentLevel}</span>
          </div>
          <div className="flex items-end justify-between">
            <p className={`text-4xl font-black ${getRiskColor(currentLevel)} tracking-tighter`}>
              {riskData?.score ?? biosafetyScore ?? '--'}
            </p>
            <p className="text-xs text-slate-500 font-mono mb-1">Scale: 0-100</p>
          </div>
          <div className="w-full bg-slate-100 rounded-sm h-1.5 mt-4 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${
                currentLevel === 'CRITICAL' ? 'bg-rose-500' :
                currentLevel === 'HIGH' ? 'bg-orange-500' :
                currentLevel === 'MODERATE' ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${riskData?.score || biosafetyScore || 0}%` }}
            ></div>
          </div>
        </div>

        {/* AQI */}
        <div className="card">
          <div className="card-header">
            <span className="metric-label">Air Quality Index</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          </div>
          <p className={`text-3xl font-bold ${
            (aqiData?.raw || 0) > 200 ? 'text-rose-600' :
            (aqiData?.raw || 0) > 100 ? 'text-orange-600' :
            (aqiData?.raw || 0) > 50 ? 'text-amber-600' : 'text-emerald-600'
          }`}>
            {aqiData?.raw ?? '--'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
            <div>
              <span className="text-slate-400 uppercase">PM2.5</span>
              <p className="font-mono text-slate-700">{aqiData?.pm25 ?? '--'} µg/m³</p>
            </div>
            <div>
              <span className="text-slate-400 uppercase">PM10</span>
              <p className="font-mono text-slate-700">{aqiData?.pm10 ?? '--'} µg/m³</p>
            </div>
          </div>
        </div>

        {/* Crowd Density */}
        <div className="card">
          <div className="card-header">
            <span className="metric-label">Crowd Density</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-slate-800">
              {crowdDensity ?? '--'}
            </p>
            <span className="text-sm font-medium text-slate-400 mb-1">/100</span>
          </div>
          <p className="text-xs text-slate-500 mt-4 border-t border-slate-100 pt-3">
            Real-time geospatial tracking
          </p>
        </div>

        {/* Weather Intelligence */}
        <div className="card">
          <div className="card-header">
            <span className="metric-label">Weather Intelligence</span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-3xl font-bold text-slate-800">
              {weatherData?.temp ?? '--'}°
            </p>
            <div className="text-xs text-slate-600 uppercase font-medium">
              <p>{weatherData?.condition ?? 'Monitoring...'}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3">
            <div>
              <span className="text-slate-400 uppercase">Humidity</span>
              <p className="font-mono text-slate-700">{weatherData?.humidity ?? '--'}%</p>
            </div>
            <div>
              <span className="text-slate-400 uppercase">UV Index</span>
              <p className="font-mono text-slate-700">{weatherData?.uvIndex ?? '--'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts & Secondary Intel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 card flex flex-col">
          <div className="card-header">
            <span className="metric-label">24-Hour Risk Assessment Trend</span>
            <span className="text-xs text-slate-400 uppercase font-mono">Live Sync</span>
          </div>
          <div className="flex-1 min-h-[250px]">
            {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#334155" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#334155" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '4px', fontSize: '12px' }}
                  itemStyle={{ color: '#0f172a', fontWeight: '600' }}
                />
                <Area type="monotone" dataKey="score" stroke="#334155" strokeWidth={2} fillOpacity={1} fill="url(#colorScore)" />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-sm bg-slate-50/50">
                <div className="w-4 h-4 bg-slate-300 rounded-sm mb-3"></div>
                <p className="text-sm font-medium uppercase tracking-wide">Awaiting Telemetry</p>
                <p className="text-xs font-mono mt-1">Matrix initializing...</p>
              </div>
            )}
          </div>
        </div>

        {/* Alerts Log */}
        <div className="card flex flex-col">
          <div className="card-header">
            <span className="metric-label">System Alerts Log</span>
            <span className={`badge ${alerts?.length > 0 ? 'badge-high' : 'badge-safe'}`}>
              {alerts?.length || 0} ACTIVE
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[250px] space-y-2 pr-2 scrollbar-thin">
            {alerts && alerts.length > 0 ? (
              alerts.slice(0, 8).map((alert, idx) => (
                <div key={alert.id || idx} className={`p-3 rounded-sm border-l-4 text-sm ${
                  alert.severity === 'critical' ? 'bg-rose-50 border-rose-500' :
                  alert.severity === 'high' ? 'bg-orange-50 border-orange-500' :
                  'bg-slate-50 border-slate-400'
                }`}>
                  <p className="font-bold text-slate-800">{alert.title}</p>
                  <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-2 uppercase">
                    {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : 'T-0m'}
                  </p>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <span className="px-2 py-1 bg-slate-200 text-slate-600 font-bold text-[10px] rounded mb-2">SYSTEM OK</span>
                <p className="text-sm font-medium uppercase tracking-wide">No Anomalies</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analytics Overview Bar */}
      {overview && overview.totalHexes > 0 && (
        <div className="card">
          <div className="card-header border-b-0 pb-0 mb-3">
            <span className="metric-label">Regional Infrastructure State</span>
            <span className="text-xs font-mono text-slate-500 uppercase">Sector: {overview.totalHexes} Hex Cells</span>
          </div>
          <div className="grid grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden">
            <div className="bg-white p-3 text-center">
              <p className="text-xl font-black text-emerald-600">{overview.lowCount || 0}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Low Risk</p>
            </div>
            <div className="bg-white p-3 text-center">
              <p className="text-xl font-black text-amber-600">{overview.moderateCount || 0}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Moderate</p>
            </div>
            <div className="bg-white p-3 text-center">
              <p className="text-xl font-black text-orange-600">{overview.highCount || 0}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">High Risk</p>
            </div>
            <div className="bg-white p-3 text-center">
              <p className="text-xl font-black text-rose-600">{overview.criticalCount || 0}</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Critical</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
