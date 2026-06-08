import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import errorHandler from './middleware/errorHandler.js';
import alertsRoutes from './routes/alerts.js';
import analyticsRoutes from './routes/analytics.js';
import dashboardRoutes from './routes/dashboard.js';
import independentMonitoringRoutes from './routes/independentMonitoring.js';
import mapRoutes from './routes/map.js';
import usersRoutes from './routes/users.js';
import { initIndependentLocationMonitoring } from './services/enhancedRealtimePipeline.js';
import { initPipeline, startPipeline } from './services/realtimePipeline.js';
import logger from './utils/logger.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // increased for live data polling
  message: 'Too many requests, please try again later',
});
app.use('/api/', limiter);

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/independent-monitoring', independentMonitoringRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    services: {
      pipeline: 'active',
      independentMonitoring: 'enabled',
      websocket: io.engine?.clientsCount || 0,
      dataSources: [
        'openweathermap',
        'openstreetmap',
        'nominatim',
        'overpass',
        'huggingface',
        'osrm',
      ],
      weatherAqiProvider: 'openweathermap',
      monitorRadiusKm: parseFloat(process.env.MONITOR_RADIUS_KM) || 5,
      scoringMode: 'per-hex-independent',
      features: [
        'Independent location monitoring',
        'Factor-wise risk reasoning',
        'Multi-source data fetching',
        'Real-time WebSocket sync',
        'Comprehensive environmental intelligence',
      ],
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Initialize and start the real-time data pipeline
initPipeline(io);

// Initialize independent location monitoring with 5km radius tracking
initIndependentLocationMonitoring(io);

// Export for use in other files
export { io };

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server ready`);
  logger.info(`Default location: ${process.env.DEFAULT_LAT || 12.9716}, ${process.env.DEFAULT_LNG || 77.5946}`);
  logger.info(`Monitor radius: ${parseFloat(process.env.MONITOR_RADIUS_KM) || 5}km`);
  logger.info(`Independent location monitoring enabled for detailed factor-wise analysis`);

  // Start the real-time pipeline after server is ready
  startPipeline();
  logger.info('Real-time biosafety pipeline started');
});

export default app;
