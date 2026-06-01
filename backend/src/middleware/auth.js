import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

/**
 * Authentication Middleware - Protects routes that require authentication
 */
export const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Admin Middleware - Requires admin role
 */
export const admin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Rate Limit Middleware - Per-user rate limiting
 */
export const rateLimitPerUser = (maxRequests = 60, windowMs = 60000) => {
  const requests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id;
    if (!userId) return next();

    const now = Date.now();
    const userRequests = requests.get(userId) || [];

    // Remove old requests outside the window
    const recentRequests = userRequests.filter((time) => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    recentRequests.push(now);
    requests.set(userId, recentRequests);
    next();
  };
};

export default auth;
