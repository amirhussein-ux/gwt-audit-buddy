const express = require('express');
const User = require('../models/User');
const { sessionManager } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /auth/login
 * Authenticate user with username (shared account)
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
      });
    }

    // Find user
    const user = await User.findOne({ username, isActive: true }).select('+hashedPassword');

    if (!user) {
      return res.status(401).json({
        error: 'Invalid username or password',
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockedMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(429).json({
        error: `Account is temporarily locked. Try again in ${lockedMinutes} minutes.`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    // Verify password
    const passwordValid = user.comparePassword(password);

    if (!passwordValid) {
      await user.recordFailedLogin();
      return res.status(401).json({
        error: 'Invalid username or password',
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Create session
    const token = sessionManager.createSession(user._id.toString(), user.username, user.role);

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        agency: user.agency,
      },
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('[Auth Login] Error:', error.message);
    return res.status(500).json({
      error: 'Login failed',
      details: error.message,
    });
  }
});

/**
 * POST /auth/logout
 * Revoke session token
 */
router.post('/logout', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token;

    if (token) {
      sessionManager.revokeSession(token);
    }

    return res.status(200).json({
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('[Auth Logout] Error:', error.message);
    return res.status(500).json({
      error: 'Logout failed',
    });
  }
});

/**
 * GET /auth/verify
 * Check if session token is valid
 */
router.get('/verify', (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;

    if (!token) {
      return res.status(401).json({
        valid: false,
        error: 'No token provided',
      });
    }

    const { valid, session, reason } = sessionManager.validateSession(token);

    if (!valid) {
      return res.status(401).json({
        valid: false,
        error: reason,
      });
    }

    return res.status(200).json({
      valid: true,
      user: {
        username: session.username,
        role: session.role,
      },
      expiresIn: Math.ceil((session.expiresAt - Date.now()) / 1000), // seconds
    });
  } catch (error) {
    console.error('[Auth Verify] Error:', error.message);
    return res.status(500).json({
      valid: false,
      error: 'Verification failed',
    });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user info
 */
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { valid, session } = sessionManager.validateSession(token);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await User.findById(session.userId).select('-hashedPassword');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        agency: user.agency,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch user info',
    });
  }
});

module.exports = router;
