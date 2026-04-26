const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Security configuration constants
const SECURITY_CONFIG = {
  BCRYPT_ROUNDS: 12, // Cost factor for bcrypt (higher = more secure but slower)
  ACCOUNT_LOCKOUT_CONFIG: {
    MAX_ATTEMPTS: 5,
    LOCK_DURATION_MS: 30 * 60 * 1000, // 30 minutes
  },
  EMAIL_VERIFICATION_EXPIRES_MS: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET_EXPIRES_MS: 15 * 60 * 1000, // 15 minutes
};

// Validation regex patterns
const VALIDATION_PATTERNS = {
  EMAIL: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
};
const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [VALIDATION_PATTERNS.EMAIL, 'Please provide a valid email'],
    },
    hashedPassword: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't return password by default
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'auditor'],
      default: 'auditor',
      description: 'admin: full access including archive/restore, auditor: can run and view audits',
    },
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      description: 'Associated government agency (optional)',
    },
    fullName: {
      type: String,
      trim: true,
      maxlength: [120, 'Full name must be 120 characters or fewer'],
      description: 'Government employee full name',
    },
    positionTitle: {
      type: String,
      trim: true,
      maxlength: [120, 'Position title must be 120 characters or fewer'],
      description: 'Government position or office title',
    },
    officePhone: {
      type: String,
      trim: true,
      maxlength: [40, 'Office phone must be 40 characters or fewer'],
      description: 'Office landline or trunk line',
    },
    mobileNumber: {
      type: String,
      trim: true,
      maxlength: [40, 'Mobile number must be 40 characters or fewer'],
      description: 'Mobile contact number',
    },
    settings: {
      auditDefaults: {
        maxPages: {
          type: Number,
          default: 20,
          min: 1,
          max: 200,
        },
        maxDepth: {
          type: Number,
          default: 3,
          min: 0,
          max: 10,
        },
        concurrency: {
          type: Number,
          default: 3,
          min: 1,
          max: 10,
        },
      },
      notifications: {
        inAppEnabled: {
          type: Boolean,
          default: true,
        },
        emailEnabled: {
          type: Boolean,
          default: true,
        },
        auditCompleted: {
          type: Boolean,
          default: true,
        },
        auditFailed: {
          type: Boolean,
          default: true,
        },
        archiveEvents: {
          type: Boolean,
          default: true,
        },
        complianceDigest: {
          type: Boolean,
          default: false,
        },
      },
      dashboard: {
        landingPage: {
          type: String,
          enum: ['dashboard', 'results', 'audit-log', 'archive'],
          default: 'dashboard',
        },
        showAgencyLeaderboard: {
          type: Boolean,
          default: true,
        },
        showTrendChart: {
          type: Boolean,
          default: true,
        },
        showCriticalAlerts: {
          type: Boolean,
          default: true,
        },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      description: 'Whether email has been verified',
    },
    emailVerificationToken: {
      type: String,
      select: false,
      description: 'Token for email verification (expires in 24 hours)',
    },
    emailVerificationTokenExpires: {
      type: Date,
      select: false,
    },
    passwordResetToken: {
      type: String,
      select: false,
      description: 'Token for password reset (expires in 15 minutes)',
    },
    passwordResetTokenExpires: {
      type: Date,
      select: false,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
      description: 'Account locked after failed login attempts',
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

/**
 * Hash password before saving (middleware)
 * Uses bcrypt for secure password hashing
 */
userSchema.pre('save', async function () {
  // Only hash if password is new or modified
  if (!this.isModified('hashedPassword')) {
    return;
  }

  try {
    this.hashedPassword = await bcrypt.hash(this.hashedPassword, SECURITY_CONFIG.BCRYPT_ROUNDS);
  } catch (error) {
    console.error('[User] Password hashing error:', error.message);
    throw error;
  }
});

/**
 * Compare password method (bcrypt)
 * @param {string} candidatePassword - Plain text password to verify
 * @returns {Promise<boolean>} Whether password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || typeof candidatePassword !== 'string' || !this.hashedPassword) {
    return false;
  }

  try {
    return await bcrypt.compare(candidatePassword, this.hashedPassword);
  } catch (error) {
    console.error('[User] Password comparison error:', error.message);
    return false;
  }
};

/**
 * Generate email verification token
 * @returns {string} Verification token
 */
userSchema.methods.generateEmailVerificationToken = function () {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.emailVerificationToken = token;
  this.emailVerificationTokenExpires = new Date(
    Date.now() + SECURITY_CONFIG.EMAIL_VERIFICATION_EXPIRES_MS
  );
  return token;
};

/**
 * Verify email verification token and mark email as verified
 * @param {string} token - Token to verify
 * @returns {Promise<boolean>} Whether token was valid and email verified
 */
userSchema.methods.verifyEmailToken = async function (token) {
  if (
    this.emailVerificationToken !== token ||
    new Date() > this.emailVerificationTokenExpires
  ) {
    return false;
  }

  this.isEmailVerified = true;
  this.emailVerificationToken = undefined;
  this.emailVerificationTokenExpires = undefined;
  await this.save();
  return true;
};

/**
 * Generate password reset token
 * @returns {string} Password reset token
 */
userSchema.methods.generatePasswordResetToken = function () {
  const token = require('crypto').randomBytes(32).toString('hex');
  this.passwordResetToken = token;
  this.passwordResetTokenExpires = new Date(
    Date.now() + SECURITY_CONFIG.PASSWORD_RESET_EXPIRES_MS
  );
  return token;
};

/**
 * Verify password reset token validity
 * @param {string} token - Token to verify
 * @returns {boolean} Whether token is valid and not expired
 */
userSchema.methods.isPasswordResetTokenValid = function (token) {
  return (
    this.passwordResetToken === token &&
    new Date() <= this.passwordResetTokenExpires
  );
};

/**
 * Clear password reset token after use
 * @returns {Promise<Object>} Updated user document
 */
userSchema.methods.clearPasswordResetToken = async function () {
  this.passwordResetToken = undefined;
  this.passwordResetTokenExpires = undefined;
  return this.save();
};

/**
 * Update last login timestamp and clear lockout
 * @returns {Promise<Object>} Updated user document
 */
userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

/**
 * Increment failed login attempts and lock account if threshold exceeded
 * @returns {Promise<Object>} Updated user document
 */
userSchema.methods.recordFailedLogin = async function () {
  this.loginAttempts = (this.loginAttempts || 0) + 1;

  // Lock account after exceeding max attempts
  if (this.loginAttempts >= SECURITY_CONFIG.ACCOUNT_LOCKOUT_CONFIG.MAX_ATTEMPTS) {
    this.lockUntil = new Date(
      Date.now() + SECURITY_CONFIG.ACCOUNT_LOCKOUT_CONFIG.LOCK_DURATION_MS
    );
  }

  return this.save();
};

/**
 * Check if account is currently locked
 * @returns {boolean} Whether account is locked
 */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * Unlock account and clear failed login attempts
 * @returns {Promise<Object>} Updated user document
 */
userSchema.methods.unlock = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
