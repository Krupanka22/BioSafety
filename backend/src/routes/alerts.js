import express from 'express';
import { getAlerts } from '../services/realtimePipeline.js';

const router = express.Router();

/**
 * Alerts Routes — Live alerts from the real-time pipeline
 */

// Get alerts
router.get('/', (req, res) => {
  const alerts = getAlerts();
  const limit = parseInt(req.query.limit) || 50;
  const severity = req.query.severity; // optional filter

  let filtered = alerts;
  if (severity) {
    filtered = alerts.filter((a) => a.severity === severity);
  }

  res.json(filtered.slice(0, limit));
});

// Acknowledge an alert (mark as read)
router.post('/:id/acknowledge', (req, res) => {
  const alerts = getAlerts();
  const alert = alerts.find((a) => a.id === req.params.id);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = 'guest';
    return res.json({ message: 'Alert acknowledged', alert });
  }
  res.status(404).json({ error: 'Alert not found' });
});

export default router;
