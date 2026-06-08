import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Cloud,
  MapPin,
  Menu,
  Radar,
  ShieldCheck,
  Wind,
} from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'Contact', href: '#contact' },
];

const features = [
  { title: 'AQI Monitoring', icon: Wind, detail: 'Live AQI telemetry with regional thresholds.' },
  { title: 'Weather Intelligence', icon: Cloud, detail: 'Climatic overlays for risk forecasting.' },
  { title: 'Nearby Region Analysis', icon: Radar, detail: 'Adjacent-zone monitoring with alerts.' },
  { title: 'Heatmap Monitoring', icon: MapPin, detail: 'Risk hotspot density visualization.' },
  { title: 'AI Risk Detection', icon: ShieldCheck, detail: 'Automated risk scoring and insights.' },
  { title: 'Real-Time Updates', icon: BarChart3, detail: 'Continuous sync across dashboards.' },
];

const Landing = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Biosafety Intelligence Platform';
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-body relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 left-1/3 h-72 w-72 rounded-full bg-purple-200/50 blur-[120px]"></div>
        <div className="absolute top-40 -right-10 h-80 w-80 rounded-full bg-blue-200/50 blur-[140px]"></div>
        <div className="absolute bottom-10 left-10 h-64 w-64 rounded-full bg-indigo-200/50 blur-[120px]"></div>
      </div>

      <nav className="fixed top-5 inset-x-0 z-50">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-xl px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 border border-indigo-700 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 tracking-tight">Biosafety Intelligence</div>
                <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Platform</div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-600">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} className="hover:text-indigo-600 transition-colors">
                  {item.label}
                </a>
              ))}
              <div className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-600">
                Telemetry Online
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-indigo-600 text-white px-4 py-2 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Launch Dashboard
                <ArrowUpRight className="w-4 h-4" />
              </button>
              <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-indigo-600 transition-colors shadow-sm">
                <Menu className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section id="home" className="mx-auto max-w-6xl px-6 pt-32 pb-20 relative">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-600 shadow-sm">
            Soft Intelligence Layer
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-slate-900 font-display tracking-tight">
            REAL-TIME BIOSAFETY INTELLIGENCE
          </h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            AI-powered environmental monitoring, AQI analysis, hotspot surveillance, nearby-region intelligence, and real-time biosafety monitoring.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 sm:pt-6">
            <button
              onClick={() => navigate('/dashboard')}
              className="rounded-full bg-indigo-600 text-white px-8 py-3 text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto"
            >
              Launch Dashboard
            </button>
            <button
              onClick={() => navigate('/map')}
              className="rounded-full border border-slate-200 bg-white px-8 py-3 text-sm font-semibold text-slate-700 hover:border-slate-300 transition-colors shadow-sm w-full sm:w-auto"
            >
              Live Monitoring
            </button>
          </div>
        </div>
        
        <div className="mt-12 sm:mt-16 md:mt-20 mx-auto max-w-5xl relative z-10 flex justify-center px-2 sm:px-6 lg:px-8">
          <div className="w-full relative rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-200/80 bg-white">
            <img 
              src="/image.png" 
              alt="Biosafety Platform Dashboard Preview" 
              className="w-full h-auto block" 
            />
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold text-slate-900 font-display">Core Monitoring Features</h2>
          <p className="text-sm text-slate-500 mt-3 uppercase tracking-[0.2em]">Live Modules</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6 hover:border-slate-300 transition-colors shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-5">
                <feature.icon className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{feature.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <footer id="contact" className="border-t border-slate-200 bg-slate-50 mt-10">
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2 text-slate-700 font-medium">
            <Activity className="w-4 h-4" />
            Biosafety Intelligence
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com" className="hover:text-indigo-600 transition-colors">GitHub</a>
            <a href="/docs" className="hover:text-indigo-600 transition-colors">Documentation</a>
            <a href="mailto:contact@biosafety.ai" className="hover:text-indigo-600 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
