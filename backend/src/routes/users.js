import express from 'express';
import { admin, auth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Users Routes
 */

// Get user profile
router.get('/profile', auth, (req, res) => {
  res.json({
    id: req.user.id,
    name: 'John Doe',
    email: req.user.email,
    role: req.user.role,
    createdAt: new Date(),
  });
});

// Update profile
router.put('/profile', auth, (req, res) => {
  res.json({
    message: 'Profile updated successfully',
    user: req.body,
  });
});

// Get all users (admin only)
router.get('/', auth, admin, (req, res) => {
  res.json([
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
    },
  ]);
});

export default router;
