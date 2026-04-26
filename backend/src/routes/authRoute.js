const express = require('express');
const User = require('../models/User');
const { authenticate, sessionManager } = require('../middleware/auth');
const { 
  loginLimiter, 
  passwordResetLimiter,
  registrationLimiter,
  emailVerificationLimiter,
  isSuspiciousUserAgent
} = require('../middleware/rateLimiter');
const emailService = require('../services/emailService');

const router = express.Router();

// Security configuration
const SECURITY_CONFIG = {
  ACCOUNT_LOCKOUT_CONFIG: {
    MAX_ATTEMPTS: 5,
    LOCK_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  },
};

// Error messages
const ERROR_MESSAGES = {
  EMAIL_PASSWORD_REQUIRED: 'Email and password are required',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_NOT_VERIFIED: 'Please verify your email before logging in',
  ACCOUNT_LOCKED: 'Account is temporarily locked. Try again in {minutes} minutes.',
  NO_TOKEN_PROVIDED: 'No authentication token provided',
  INVALID_TOKEN: 'Invalid or expired authentication token',
  USER_NOT_FOUND: 'User not found',
  LOGOUT_SUCCESS: 'Logged out successfully',
  LOGIN_FAILED: 'Login failed',
  VERIFY_FAILED: 'Verification failed',
  FETCH_USER_FAILED: 'Failed to fetch user info',
  EMAIL_VERIFICATION_SENT: 'Verification email sent',
  EMAIL_VERIFIED: 'Email verified successfully',
  TOKEN_EXPIRED: 'Token has expired',
  PASSWORD_RESET_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successfully',
};

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
};

const PROFILE_LIMITS = {
  USERNAME_MIN_LENGTH: 3,
  PASSWORD_MIN_LENGTH: 8,
  MAX_PAGES: { min: 1, max: 200 },
  MAX_DEPTH: { min: 0, max: 10 },
  CONCURRENCY: { min: 1, max: 10 },
};

/**
 * Extract token from Authorization header ONLY (for security)
 * Do NOT extract from body or query (prevents logging/caching)
 * @param {Object} req - Express request object
 * @returns {string|null} Token or null if not found
 */
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7); // Remove 'Bearer ' prefix
};

/**
 * Build user response object
 * @param {Object} user - Mongoose user document
 * @param {Object} options - Options for response
 * @returns {Object} Formatted user response
 */
const buildUserResponse = (user, options = {}) => {
  const agency = user.agency && typeof user.agency === 'object'
    ? {
        id: user.agency._id,
        name: user.agency.name,
        acronym: user.agency.acronym,
        region: user.agency.region,
        domainUrl: user.agency.domainUrl,
      }
    : user.agency;

  const response = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    fullName: user.fullName || '',
    positionTitle: user.positionTitle || '',
    officePhone: user.officePhone || '',
    mobileNumber: user.mobileNumber || '',
    settings: user.settings || {},
  };

  if (options.includeAgency) {
    response.agency = agency;
  }

  if (options.includeLastLogin) {
    response.lastLogin = user.lastLogin;
  }

  return response;
};

const clampNumber = (value, min, max, fallback) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, numeric));
};

const sanitizeProfilePayload = (body = {}) => ({
  username: typeof body.username === 'string' ? body.username.trim() : undefined,
  fullName: typeof body.fullName === 'string' ? body.fullName.trim() : undefined,
  positionTitle: typeof body.positionTitle === 'string' ? body.positionTitle.trim() : undefined,
  officePhone: typeof body.officePhone === 'string' ? body.officePhone.trim() : undefined,
  mobileNumber: typeof body.mobileNumber === 'string' ? body.mobileNumber.trim() : undefined,
});

const sanitizeSettingsPayload = (body = {}, role = 'auditor') => ({
  auditDefaults: {
    maxPages: clampNumber(
      body.auditDefaults?.maxPages,
      PROFILE_LIMITS.MAX_PAGES.min,
      PROFILE_LIMITS.MAX_PAGES.max,
      20
    ),
    maxDepth: clampNumber(
      body.auditDefaults?.maxDepth,
      PROFILE_LIMITS.MAX_DEPTH.min,
      PROFILE_LIMITS.MAX_DEPTH.max,
      3
    ),
    concurrency: clampNumber(
      body.auditDefaults?.concurrency,
      PROFILE_LIMITS.CONCURRENCY.min,
      PROFILE_LIMITS.CONCURRENCY.max,
      3
    ),
  },
  notifications: {
    inAppEnabled: Boolean(body.notifications?.inAppEnabled),
    emailEnabled: Boolean(body.notifications?.emailEnabled),
    auditCompleted: Boolean(body.notifications?.auditCompleted),
    auditFailed: Boolean(body.notifications?.auditFailed),
    archiveEvents: role === 'admin' ? Boolean(body.notifications?.archiveEvents) : false,
    complianceDigest: role === 'admin' ? Boolean(body.notifications?.complianceDigest) : false,
  },
  dashboard: {
    landingPage: role === 'admin'
      ? ['dashboard', 'results', 'audit-log', 'archive'].includes(body.dashboard?.landingPage)
        ? body.dashboard.landingPage
        : 'dashboard'
      : ['dashboard', 'results', 'audit-log'].includes(body.dashboard?.landingPage)
        ? body.dashboard.landingPage
        : 'dashboard',
    showAgencyLeaderboard: Boolean(body.dashboard?.showAgencyLeaderboard),
    showTrendChart: Boolean(body.dashboard?.showTrendChart),
    showCriticalAlerts: Boolean(body.dashboard?.showCriticalAlerts),
  },
});

/**
 * Validate login input
 * @param {string} email - Email address
 * @param {string} password - Password
 * @returns {Object} Validation result with error if invalid
 */
const validateLoginInput = (email, password) => {
  if (!email || !password) {
    return {
      valid: false,
      error: ERROR_MESSAGES.EMAIL_PASSWORD_REQUIRED,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    };
  }
  return { valid: true };
};

/**
 * POST /auth/register
 * Register a new user account (rate limited)
 * Supports self-registration with email verification
 */
router.post('/register', registrationLimiter, async (req, res) => {
  try {
    const { email, password, username } = req.body;

    // Validate input
    if (!email || !password || !username) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Email, password, and username are required',
      });
    }

    // Check for suspicious user agents (bot detection)
    if (isSuspiciousUserAgent(req.get('user-agent'))) {
      console.warn('[Auth] Registration blocked - suspicious user agent:', { ip: req.ip, userAgent: req.get('user-agent') });
      return res.status(400).json({
        error: 'Registration from this source is not allowed. Use a standard web browser.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Email or username already registered',
        code: 'USER_EXISTS',
      });
    }

    // Create new user (email not verified yet)
    const newUser = new User({
      username,
      email,
      hashedPassword: password, // Will be hashed by pre-save middleware
      role: 'auditor', // Default role for new accounts
      isActive: true,
      isEmailVerified: false, // Require email verification
    });

    await newUser.save();

    // Generate email verification token
    const verificationToken = newUser.generateEmailVerificationToken();
    await newUser.save();

    // Send verification email
    try {
      await emailService.sendEmailVerification(newUser, verificationToken);
    } catch (emailError) {
      console.error('[Auth] Verification email failed:', emailError.message);
      // Continue even if email fails (user can resend)
    }

    return res.status(HTTP_STATUS.CREATED).json({
      message: 'Account created. Please verify your email to log in.',
      user: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        isEmailVerified: false,
      },
      note: 'Check your email for verification link',
    });
  } catch (error) {
    console.error('[Auth Register] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Registration failed',
    });
  }
});

/**
 * Authenticate user with email and password (rate limited)
 */
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validation = validateLoginInput(email, password);
    if (!validation.valid) {
      return res.status(validation.statusCode).json({ error: validation.error });
    }

    // Find user by email
    const user = await User.findOne({ email, isActive: true })
      .populate('agency', 'name acronym region domainUrl')
      .select('+hashedPassword');

    if (!user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockedMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: ERROR_MESSAGES.ACCOUNT_LOCKED.replace('{minutes}', lockedMinutes),
        code: 'ACCOUNT_LOCKED',
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    // Verify password (bcrypt is async)
    const passwordValid = await user.comparePassword(password);

    if (!passwordValid) {
      await user.recordFailedLogin();

      // Send security alert if account just got locked
      if (user.isLocked()) {
        try {
          const lockedMinutes = Math.ceil(
            SECURITY_CONFIG.ACCOUNT_LOCKOUT_CONFIG.LOCK_DURATION_MS / 60000
          );
          await emailService.sendAccountLockedNotification(user, lockedMinutes);
        } catch (emailError) {
          console.error('[Auth] Failed to send account locked email:', emailError.message);
        }
      }

      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Create session
    const token = sessionManager.createSession(user._id.toString(), user.username, user.role);

    // Set secure httpOnly cookie (in addition to Bearer token)
    res.cookie('sessionToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only send over HTTPS in production
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    return res.status(HTTP_STATUS.OK).json({
      token,
      user: buildUserResponse(user, { includeAgency: true }),
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('[Auth Login] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.LOGIN_FAILED,
    });
  }
});

/**
 * POST /auth/verify-email
 * Verify email with token (rate limited)
 */
router.post('/verify-email', emailVerificationLimiter, async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Email and token are required',
      });
    }

    const user = await User.findOne({ email }).select(
      '+emailVerificationToken +emailVerificationTokenExpires'
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verify token
    const isValid = await user.verifyEmailToken(token);

    if (!isValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid or expired verification token',
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      message: ERROR_MESSAGES.EMAIL_VERIFIED,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error('[Auth Verify Email] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Email verification failed',
    });
  }
});

/**
 * POST /auth/resend-verification
 * Resend verification email (rate limited)
 */
router.post('/resend-verification', emailVerificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Email is required',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether email exists (security)
      return res.status(HTTP_STATUS.OK).json({
        message: 'If email exists, verification link has been sent',
      });
    }

    if (user.isEmailVerified) {
      return res.status(HTTP_STATUS.OK).json({
        message: 'Email already verified',
      });
    }

    // Generate new verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    try {
      await emailService.sendEmailVerification(user, verificationToken);
    } catch (emailError) {
      console.error('[Auth] Email verification resend failed:', emailError.message);
    }

    return res.status(HTTP_STATUS.OK).json({
      message: ERROR_MESSAGES.EMAIL_VERIFICATION_SENT,
    });
  } catch (error) {
    console.error('[Auth Resend Verification] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Failed to resend verification email',
    });
  }
});

/**
 * POST /auth/logout
 * Revoke session token
 */
router.post('/logout', (req, res) => {
  try {
    const token = extractTokenFromHeader(req);

    if (token) {
      sessionManager.revokeSession(token);
    }

    // Clear session cookie
    res.clearCookie('sessionToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(HTTP_STATUS.OK).json({
      message: ERROR_MESSAGES.LOGOUT_SUCCESS,
    });
  } catch (error) {
    console.error('[Auth Logout] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Logout failed',
    });
  }
});

/**
 * POST /auth/forgot-password
 * Request password reset (with rate limiting)
 */
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Email is required',
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether email exists (security)
      return res.status(HTTP_STATUS.OK).json({
        message: 'If email exists, password reset link has been sent',
      });
    }

    // Generate password reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send password reset email
    try {
      await emailService.sendPasswordReset(user, resetToken);
    } catch (emailError) {
      console.error('[Auth] Password reset email failed:', emailError.message);
    }

    return res.status(HTTP_STATUS.OK).json({
      message: ERROR_MESSAGES.PASSWORD_RESET_SENT,
    });
  } catch (error) {
    console.error('[Auth Forgot Password] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Password reset request failed',
    });
  }
});

/**
 * POST /auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, password } = req.body;

    if (!email || !token || !password) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Email, token, and password are required',
      });
    }

    const user = await User.findOne({ email }).select(
      '+passwordResetToken +passwordResetTokenExpires'
    );

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verify token
    if (!user.isPasswordResetTokenValid(token)) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Invalid or expired password reset token',
      });
    }

    // Update password (will be hashed by bcrypt middleware)
    user.hashedPassword = password;
    await user.clearPasswordResetToken();

    return res.status(HTTP_STATUS.OK).json({
      message: ERROR_MESSAGES.PASSWORD_RESET_SUCCESS,
      user: buildUserResponse(user),
    });
  } catch (error) {
    console.error('[Auth Reset Password] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Password reset failed',
    });
  }
});

/**
 * GET /auth/verify
 * Check if session token is valid
 * Returns 200 with valid=true/false (never 401)
 */
router.get('/verify', (req, res) => {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      return res.status(200).json({
        valid: false,
        error: 'No token provided',
      });
    }

    const { valid, session, reason } = sessionManager.validateSession(token);

    if (!valid) {
      return res.status(200).json({
        valid: false,
        error: reason,
      });
    }

    return User.findById(session.userId)
      .populate('agency', 'name acronym region domainUrl')
      .then((user) => {
        if (!user || !user.isActive) {
          sessionManager.revokeSession(token);
          return res.status(200).json({
            valid: false,
            error: ERROR_MESSAGES.USER_NOT_FOUND,
          });
        }

        return res.status(200).json({
          valid: true,
          user: buildUserResponse(user, { includeAgency: true, includeLastLogin: true }),
          expiresIn: Math.ceil((session.expiresAt - Date.now()) / 1000),
        });
      })
      .catch((error) => {
        console.error('[Auth Verify] User lookup error:', error.message);
        return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
          valid: false,
          error: ERROR_MESSAGES.VERIFY_FAILED,
        });
      });
  } catch (error) {
    console.error('[Auth Verify] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      valid: false,
      error: ERROR_MESSAGES.VERIFY_FAILED,
    });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user info
 */
router.get('/me', async (req, res) => {
  try {
    const token = extractTokenFromHeader(req);

    if (!token) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.NO_TOKEN_PROVIDED,
      });
    }

    const { valid, session } = sessionManager.validateSession(token);

    if (!valid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: ERROR_MESSAGES.INVALID_TOKEN,
      });
    }

    const user = await User.findById(session.userId)
      .populate('agency', 'name acronym region domainUrl')
      .select('-hashedPassword');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      user: buildUserResponse(user, { includeAgency: true, includeLastLogin: true }),
    });
  } catch (error) {
    console.error('[Auth Me] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.FETCH_USER_FAILED,
    });
  }
});

router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('agency', 'name acronym region domainUrl agencyType')
      .select('-hashedPassword');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    return res.status(HTTP_STATUS.OK).json({
      user: buildUserResponse(user, { includeAgency: true, includeLastLogin: true }),
      metadata: {
        memberSince: user.createdAt,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error('[Auth Profile] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Failed to fetch profile',
    });
  }
});

router.put('/profile', authenticate, async (req, res) => {
  try {
    const updates = sanitizeProfilePayload(req.body);
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    if (updates.username !== undefined) {
      if (updates.username.length < PROFILE_LIMITS.USERNAME_MIN_LENGTH) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: `Username must be at least ${PROFILE_LIMITS.USERNAME_MIN_LENGTH} characters`,
        });
      }

      const duplicate = await User.findOne({
        username: updates.username,
        _id: { $ne: req.user._id },
      });

      if (duplicate) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Username is already in use',
        });
      }

      user.username = updates.username;
    }

    if (updates.fullName !== undefined) user.fullName = updates.fullName;
    if (updates.positionTitle !== undefined) user.positionTitle = updates.positionTitle;
    if (updates.officePhone !== undefined) user.officePhone = updates.officePhone;
    if (updates.mobileNumber !== undefined) user.mobileNumber = updates.mobileNumber;

    await user.save();

    const activeSession = sessionManager.getSession(req.user.token);
    if (activeSession) {
      activeSession.username = user.username;
    }

    const savedUser = await User.findById(user._id)
      .populate('agency', 'name acronym region domainUrl agencyType')
      .select('-hashedPassword');

    return res.status(HTTP_STATUS.OK).json({
      message: 'Profile updated successfully',
      user: buildUserResponse(savedUser, { includeAgency: true, includeLastLogin: true }),
    });
  } catch (error) {
    console.error('[Auth Update Profile] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Failed to update profile',
    });
  }
});

router.put('/settings', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    user.settings = sanitizeSettingsPayload(req.body, user.role);
    await user.save();

    const savedUser = await User.findById(user._id)
      .populate('agency', 'name acronym region domainUrl agencyType')
      .select('-hashedPassword');

    return res.status(HTTP_STATUS.OK).json({
      message: 'Settings updated successfully',
      user: buildUserResponse(savedUser, { includeAgency: true, includeLastLogin: true }),
    });
  } catch (error) {
    console.error('[Auth Update Settings] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Failed to update settings',
    });
  }
});

router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < PROFILE_LIMITS.PASSWORD_MIN_LENGTH) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: `New password must be at least ${PROFILE_LIMITS.PASSWORD_MIN_LENGTH} characters`,
      });
    }

    const user = await User.findById(req.user._id).select('+hashedPassword');

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    const passwordValid = await user.comparePassword(currentPassword);
    if (!passwordValid) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json({
        error: 'Current password is incorrect',
      });
    }

    user.hashedPassword = newPassword;
    await user.save();

    return res.status(HTTP_STATUS.OK).json({
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('[Auth Change Password] Error:', error.message);
    return res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: 'Failed to update password',
    });
  }
});

module.exports = router;
