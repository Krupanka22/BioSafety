import express from 'express';

const router = express.Router();

/**
 * Users Routes
 */

// Get user profile
router.get('/profile', (req, res) => {
  res.json({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    createdAt: new Date(),
  });
});

// Update profile
router.put('/profile', (req, res) => {
  res.json({
    message: 'Profile updated successfully',
    user: req.body,
  });
});

// Get all users (admin only)
router.get('/', (req, res) => {
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
