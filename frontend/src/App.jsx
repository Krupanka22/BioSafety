import { useEffect } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { connectSocket, disconnectSocket } from './services/socketService';

// Pages
import Analytics from './pages/Analytics';
import Dashboard from './pages/Dashboard';
import Landing from './pages/Landing';
import MapView from './pages/MapView';
import NotFound from './pages/NotFound';

import Search from './pages/Search';

// Components
import Layout from './components/ProtectedRoute';

function App() {
  // Connect socket globally so all pages receive real-time data
  useEffect(() => {
    connectSocket();
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />

        {/* Unprotected App Routes wrapped in Layout */}
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/search" element={<Search />} />
          <Route path="/analytics" element={<Analytics />} />

        </Route>

        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
