import express from 'express';
import { getCurrentUser, login, logout, register } from '../controllers/authController.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

/**
 * Authentication Routes
 */

// Register
router.post('/register', register);

// Login
router.post('/login', login);

// Get current user
router.get('/me', auth, getCurrentUser);

// Logout
router.post('/logout', auth, logout);

export default router;
