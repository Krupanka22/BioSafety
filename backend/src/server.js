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
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import mapRoutes from './routes/map.js';
import usersRoutes from './routes/users.js';
import logger from './utils/logger.js';
import { initPipeline, startPipeline } from './services/realtimePipeline.js';

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
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/users', usersRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    services: {
      pipeline: 'active',
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

// Export for use in other files
export { io };

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server ready`);
  logger.info(`Default location: ${process.env.DEFAULT_LAT || 12.9716}, ${process.env.DEFAULT_LNG || 77.5946}`);

  // Start the real-time pipeline after server is ready
  startPipeline();
  logger.info('Real-time biosafety pipeline started');
});

export default app;
