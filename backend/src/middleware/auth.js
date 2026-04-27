const crypto = require('crypto');
const mongoose = require('mongoose');
const Session = require('../models/Session');

// Session configuration constants
const SESSION_CONFIG = {
  TOKEN_LENGTH: 32,
  EXPIRY_MS: 24 * 60 * 60 * 1000, // 24 hours
  CLEANUP_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

/**
 * Persistent session management backed by MongoDB.
 * This survives process restarts and supports explicit revocation.
 */
class SessionManager {
  constructor() {
    this.cleanupTimer = null;
    this.memorySessions = new Map();
  }

  startCleanupRoutine() {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions().catch((error) => {
        console.error('[Auth] Session cleanup failed:', error.message);
      });
    }, SESSION_CONFIG.CLEANUP_INTERVAL_MS);
  }

  stopCleanupRoutine() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async createSession(userId, username, role) {
    const token = crypto.randomBytes(SESSION_CONFIG.TOKEN_LENGTH).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_CONFIG.EXPIRY_MS);

    if (mongoose.connection.readyState !== 1) {
      this.memorySessions.set(token, {
        userId,
        username,
        role,
        expiresAt,
        lastActivity: new Date(),
      });
      return token;
    }

    await Session.create({
      tokenHash: hashToken(token),
      userId: new mongoose.Types.ObjectId(userId),
      username,
      role,
      expiresAt,
      lastActivity: new Date(),
    });

    return token;
  }

  async validateSession(token) {
    if (!token || typeof token !== 'string') {
      return { valid: false, reason: 'Invalid token format' };
    }

    if (mongoose.connection.readyState !== 1) {
      const memorySession = this.memorySessions.get(token);
      if (!memorySession) {
        return { valid: false, reason: 'Token not found' };
      }

      const now = new Date();
      if (now > new Date(memorySession.expiresAt)) {
        this.memorySessions.delete(token);
        return { valid: false, reason: 'Token expired' };
      }

      memorySession.lastActivity = now;
      return { valid: true, session: memorySession };
    }

    const session = await Session.findOne({
      tokenHash: hashToken(token),
      revokedAt: null,
    }).lean();

    if (!session) {
      return { valid: false, reason: 'Token not found' };
    }

    const now = new Date();
    if (now > new Date(session.expiresAt)) {
      await Session.deleteOne({ _id: session._id });
      return { valid: false, reason: 'Token expired' };
    }

    await Session.updateOne(
      { _id: session._id },
      { $set: { lastActivity: now } }
    );

    return { valid: true, session };
  }

  async revokeSession(token) {
    if (mongoose.connection.readyState !== 1) {
      return this.memorySessions.delete(token);
    }

    const result = await Session.updateOne(
      { tokenHash: hashToken(token), revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  async revokeUserSessions(userId) {
    if (mongoose.connection.readyState !== 1) {
      let revokedCount = 0;
      for (const [token, session] of this.memorySessions.entries()) {
        if (session.userId?.toString() === userId.toString()) {
          this.memorySessions.delete(token);
          revokedCount++;
        }
      }
      return revokedCount;
    }

    const result = await Session.updateMany(
      { userId: new mongoose.Types.ObjectId(userId), revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );
    return result.modifiedCount;
  }

  async getSession(token) {
    if (mongoose.connection.readyState !== 1) {
      return this.memorySessions.get(token);
    }

    return Session.findOne({ tokenHash: hashToken(token), revokedAt: null }).lean();
  }

  async cleanupExpiredSessions() {
    if (mongoose.connection.readyState !== 1) {
      const now = new Date();
      let deletedCount = 0;
      for (const [token, session] of this.memorySessions.entries()) {
        if (now > new Date(session.expiresAt)) {
          this.memorySessions.delete(token);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[Auth] Cleaned up ${deletedCount} expired in-memory session(s)`);
      }
      return;
    }

    const result = await Session.deleteMany({
      $or: [
        { expiresAt: { $lte: new Date() } },
        { revokedAt: { $ne: null } },
      ],
    });

    if (result.deletedCount > 0) {
      console.log(`[Auth] Cleaned up ${result.deletedCount} expired/revoked session(s)`);
    }
  }
}

const sessionManager = new SessionManager();
sessionManager.startCleanupRoutine();

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  if (req.cookies?.sessionToken) {
    return req.cookies.sessionToken;
  }

  return null;
};

const attachUserToRequest = (req, session) => {
  req.user = {
    _id: session.userId.toString(),
    username: session.username,
    role: session.role,
  };
};

const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided',
        code: 'NO_TOKEN',
      });
    }

    const { valid, session, reason } = await sessionManager.validateSession(token);

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

const authenticateOptional = async (req, _res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const { valid, session } = await sessionManager.validateSession(token);
      if (valid) {
        attachUserToRequest(req, session);
        req.user.token = token;
      }
    }

    next();
  } catch (error) {
    console.error('[Auth] Optional auth error:', error.message);
    next();
  }
};

module.exports = {
  sessionManager,
  authenticate,
  authorize,
  authenticateOptional,
};
