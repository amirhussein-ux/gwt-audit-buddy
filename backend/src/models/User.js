const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * User Schema - Shared Account Authentication for MASID
 * Supports role-based access control for government agencies
 */
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
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email'],
    },
    hashedPassword: {
      type: String,
      required: [true, 'Password is required'],
      select: false, // Don't return password by default
      minlength: 6,
    },
    role: {
      type: String,
      enum: ['admin', 'auditor', 'viewer'],
      default: 'viewer',
      description: 'admin: full access, auditor: can run audits, viewer: read-only',
    },
    agency: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agency',
      description: 'Associated government agency (optional)',
    },
    isActive: {
      type: Boolean,
      default: true,
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
 */
userSchema.pre('save', async function () {
  // Only hash if password is new or modified
  if (!this.isModified('hashedPassword')) {
    return;
  }

  const salt = crypto.randomBytes(10).toString('hex');
  const hash = crypto.pbkdf2Sync(this.hashedPassword, salt, 1000, 64, 'sha512').toString('hex');
  this.hashedPassword = `${salt}:${hash}`;
});

/**
 * Compare password method
 */
userSchema.methods.comparePassword = function (candidatePassword) {
  const [salt, hash] = this.hashedPassword.split(':');
  const candidateHash = crypto.pbkdf2Sync(candidatePassword, salt, 1000, 64, 'sha512').toString('hex');
  return hash === candidateHash;
};

/**
 * Update last login
 */
userSchema.methods.updateLastLogin = async function () {
  this.lastLogin = new Date();
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

/**
 * Increment failed login attempts
 */
userSchema.methods.recordFailedLogin = async function () {
  this.loginAttempts = (this.loginAttempts || 0) + 1;

  // Lock account after 5 failed attempts for 30 minutes
  if (this.loginAttempts >= 5) {
    this.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
  }

  return this.save();
};

/**
 * Check if account is locked
 */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > new Date();
};

/**
 * Unlock account
 */
userSchema.methods.unlock = async function () {
  this.loginAttempts = 0;
  this.lockUntil = null;
  return this.save();
};

module.exports = mongoose.model('User', userSchema);
