const crypto = require('crypto');

/**
 * Simple session management for MASID shared accounts
 * Uses in-memory sessions for now (can be replaced with Redis in production)
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  /**
   * Create a new session token
   */
  createSession(userId, username, role) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    this.sessions.set(token, {
      userId,
      username,
      role,
      createdAt: Date.now(),
      expiresAt,
      lastActivity: Date.now(),
    });

    return token;
  }

  /**
   * Validate session token
   */
  validateSession(token) {
    const session = this.sessions.get(token);

    if (!session) {
      return { valid: false, reason: 'Token not found' };
    }

    if (Date.now() > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, reason: 'Token expired' };
    }

    // Update last activity (keep sessions alive if active)
    session.lastActivity = Date.now();
    return { valid: true, session };
  }

  /**
   * Revoke session
   */
  revokeSession(token) {
    return this.sessions.delete(token);
  }

  /**
   * Get session details
   */
  getSession(token) {
    return this.sessions.get(token);
  }

  /**
   * Cleanup expired sessions (runs periodically)
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
      }
    }
  }
}

// Create global session manager instance
const sessionManager = new SessionManager();

// Cleanup expired sessions every hour
setInterval(() => {
  sessionManager.cleanupExpiredSessions();
  console.log('[Auth] Cleaned up expired sessions');
}, 60 * 60 * 1000);

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header or cookies
 */
const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;

    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided',
        code: 'NO_TOKEN',
      });
    }

    const { valid, session, reason } = sessionManager.validateSession(token);

    if (!valid) {
      return res.status(401).json({
        error: `Authentication failed: ${reason}`,
        code: 'INVALID_TOKEN',
      });
    }

    // Attach user info to request
    req.user = {
      id: session.userId,
      username: session.username,
      role: session.role,
      token,
    };

    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error.message);
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Role-based access control
 * @param {string|string[]} allowedRoles - Role(s) that are allowed to access this route
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware
 * Doesn't reject if no token, but populates req.user if token is valid
 */
const authenticateOptional = (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.sessionToken;

    if (token) {
      const { valid, session } = sessionManager.validateSession(token);
      if (valid) {
        req.user = {
          id: session.userId,
          username: session.username,
          role: session.role,
          token,
        };
      }
    }

    next();
  } catch (error) {
    console.error('[Auth] Optional auth error:', error.message);
    next(); // Don't reject on error for optional auth
  }
};

module.exports = {
  sessionManager,
  authenticate,
  authorize,
  authenticateOptional,
};
