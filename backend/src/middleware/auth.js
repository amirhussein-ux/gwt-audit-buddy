const crypto = require('crypto');

// Session configuration constants
const SESSION_CONFIG = {
  TOKEN_LENGTH: 32,
  EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
};

/**
 * Simple session management for MASID shared accounts
 * Uses in-memory sessions for now (can be replaced with Redis in production)
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.cleanupTimer = null;
  }

  /**
   * Start the cleanup routine
   */
  startCleanupRoutine() {
    if (this.cleanupTimer) return; // Prevent duplicate timers
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, SESSION_CONFIG.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the cleanup routine (for graceful shutdown)
   */
  stopCleanupRoutine() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Create a new session token
   * @param {string} userId - User ID
   * @param {string} username - Username
   * @param {string} role - User role
   * @returns {string} Generated session token
   */
  createSession(userId, username, role) {
    const token = crypto.randomBytes(SESSION_CONFIG.TOKEN_LENGTH).toString('hex');
    const expiresAt = Date.now() + SESSION_CONFIG.EXPIRY_MS;

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
   * @param {string} token - Session token
   * @returns {Object} Validation result with valid flag and session data
   */
  validateSession(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Invalid token format' };
    }

    const session = this.sessions.get(token);

    if (!session) {
      return { valid: false, reason: 'Token not found' };
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      this.sessions.delete(token);
      return { valid: false, reason: 'Token expired' };
    }

    // Update last activity (keep sessions alive if active)
    session.lastActivity = now;
    return { valid: true, session };
  }

  /**
   * Revoke session token
   * @param {string} token - Session token to revoke
   * @returns {boolean} Whether revocation was successful
   */
  revokeSession(token) {
    return this.sessions.delete(token);
  }

  /**
   * Get session details (without validation)
   * @param {string} token - Session token
   * @returns {Object|undefined} Session data or undefined if not found
   */
  getSession(token) {
    return this.sessions.get(token);
  }

  /**
   * Cleanup expired sessions (runs periodically)
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    let deletedCount = 0;

    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`[Auth] Cleaned up ${deletedCount} expired session(s)`);
    }
  }
}

// Create global session manager instance
const sessionManager = new SessionManager();
sessionManager.startCleanupRoutine();

/**
 * Extract token from request headers or cookies (fallback)
 * Priority: Authorization header > Cookie
 * Do NOT extract from body or query (prevents logging/caching vulnerabilities)
 *
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
const extractToken = (req) => {
  // Priority 1: Authorization header (most secure)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  // Priority 2: HttpOnly cookie (as fallback)
  if (req.cookies?.sessionToken) {
    return req.cookies.sessionToken;
  }

  return null;
};

/**
 * Attach user data to request object
 * @param {Object} req - Express request object
 * @param {Object} session - Session data
 */
const attachUserToRequest = (req, session) => {
  req.user = {
    id: session.userId,
    username: session.username,
    role: session.role,
  };
};

/**
 * Authentication middleware
 * Verifies token from Authorization header or cookies
 * Attaches user info to req.user on success
 */
const authenticate = (req, res, next) => {
  try {
    const token = extractToken(req);

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

    attachUserToRequest(req, session);
    req.user.token = token;
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
 * Role-based access control middleware
 * @param {string|string[]} allowedRoles - Role(s) that are allowed to access this route
 * @returns {Function} Middleware function
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
 * Useful for routes that have different behavior based on auth status
 */
const authenticateOptional = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const { valid, session } = sessionManager.validateSession(token);
      if (valid) {
        attachUserToRequest(req, session);
        req.user.token = token;
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
