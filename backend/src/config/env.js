/**
 * Environment Configuration and Validation
 * Validates all required and optional environment variables at startup
 * Ensures production readiness with clear error messages
 *
 * IMPORTANT: This module must be imported and executed BEFORE any other configuration
 * Call validateEnvironment() at the top of server.js to ensure early validation
 */

const { logger, logStartup } = require('../lib/logger');

/**
 * Parse and validate environment variables
 * @returns {Object} Validated configuration object
 * @throws {Error} If required variables are missing or invalid
 */
function validateEnvironment() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const isDevelopment = nodeEnv === 'development';

  const config = {};

  // ====================
  // REQUIRED VARIABLES
  // ====================

  // Node Environment
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(
      `Invalid NODE_ENV: "${nodeEnv}". Must be one of: development, production, test`
    );
  }
  config.nodeEnv = nodeEnv;

  // MongoDB Connection String
  if (!process.env.MONGODB_URI) {
    throw new Error('Missing required environment variable: MONGODB_URI');
  }
  if (!process.env.MONGODB_URI.startsWith('mongodb')) {
    throw new Error('Invalid MONGODB_URI: Must be a valid MongoDB connection string');
  }
  config.mongodbUri = process.env.MONGODB_URI;

  // Port
  const port = parseInt(process.env.PORT || '4000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid PORT: "${process.env.PORT}". Must be a number between 1-65535`
    );
  }
  config.port = port;

  // ====================
  // PRODUCTION-ONLY VARIABLES (Required in production)
  // ====================

  if (isProduction) {
    // ALLOWED_ORIGINS - REQUIRED in production
    if (!process.env.ALLOWED_ORIGINS) {
      throw new Error(
        'Missing required production environment variable: ALLOWED_ORIGINS\n' +
        'In production, you must explicitly define allowed CORS origins.\n' +
        'Format: "https://app.example.com,https://www.example.com"\n' +
        'Do NOT use localhost or wildcards in production.'
      );
    }

    const origins = process.env.ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    if (origins.length === 0) {
      throw new Error('ALLOWED_ORIGINS is empty. Provide at least one valid origin.');
    }

    // Validate that no localhost or wildcard in production
    const invalidOrigins = origins.filter(
      (origin) =>
        origin.includes('localhost') ||
        origin.includes('127.0.0.1') ||
        origin === '*' ||
        origin.startsWith('*.') ||
        !origin.includes('https://')
    );

    if (invalidOrigins.length > 0) {
      throw new Error(
        `Invalid origins in ALLOWED_ORIGINS for production: ${invalidOrigins.join(', ')}\n` +
        'Production origins must:\n' +
        '  - Use HTTPS (https://)\n' +
        '  - Not include localhost/127.0.0.1\n' +
        '  - Not include wildcards (*)\n' +
        '  - Be specific domain names'
      );
    }

    config.allowedOrigins = origins;
  } else {
    // Development defaults
    config.allowedOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:5173', 'http://localhost:3000'];
  }

  // ====================
  // OPTIONAL VARIABLES (With validation)
  // ====================

  // Server Timeout
  if (process.env.SERVER_TIMEOUT_MS) {
    const timeout = parseInt(process.env.SERVER_TIMEOUT_MS, 10);
    if (isNaN(timeout) || timeout < 1000) {
      throw new Error(
        'Invalid SERVER_TIMEOUT_MS: Must be a number >= 1000 (1 second minimum)'
      );
    }
    config.serverTimeoutMs = timeout;
  } else {
    config.serverTimeoutMs = 10 * 60 * 1000; // 10 minutes default
  }

  // ====================
  // MONGODB CONNECTION POOL CONFIGURATION
  // ====================

  // Pool size validation
  const poolSizeMax = parseInt(process.env.MONGODB_POOL_SIZE_MAX || '50', 10);
  if (isNaN(poolSizeMax) || poolSizeMax < 1 || poolSizeMax > 500) {
    throw new Error(
      `Invalid MONGODB_POOL_SIZE_MAX: "${process.env.MONGODB_POOL_SIZE_MAX}". Must be 1-500`
    );
  }

  const poolSizeMin = parseInt(process.env.MONGODB_POOL_SIZE_MIN || '10', 10);
  if (isNaN(poolSizeMin) || poolSizeMin < 1 || poolSizeMin > poolSizeMax) {
    throw new Error(
      `Invalid MONGODB_POOL_SIZE_MIN: "${process.env.MONGODB_POOL_SIZE_MIN}". Must be 1-${poolSizeMax}`
    );
  }

  // Timeout validation
  const validateTimeout = (name, value, min = 1000) => {
    const ms = parseInt(value, 10);
    if (isNaN(ms) || ms < min) {
      throw new Error(`Invalid ${name}: Must be >= ${min}ms`);
    }
    return ms;
  };

  config.mongodb = {
    poolSizeMax,
    poolSizeMin,
    idleTimeoutMs: validateTimeout('MONGODB_IDLE_TIMEOUT_MS', process.env.MONGODB_IDLE_TIMEOUT_MS || (5 * 60 * 1000), 1000),
    connectTimeoutMs: validateTimeout('MONGODB_CONNECT_TIMEOUT_MS', process.env.MONGODB_CONNECT_TIMEOUT_MS || 10000, 1000),
    socketTimeoutMs: validateTimeout('MONGODB_SOCKET_TIMEOUT_MS', process.env.MONGODB_SOCKET_TIMEOUT_MS || 30000, 1000),
    serverSelectionTimeoutMs: validateTimeout('MONGODB_SERVER_SELECTION_TIMEOUT_MS', process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000, 1000),
    heartbeatIntervalMs: validateTimeout('MONGODB_HEARTBEAT_INTERVAL_MS', process.env.MONGODB_HEARTBEAT_INTERVAL_MS || 10000, 1000),
    monitor: process.env.MONGODB_MONITOR === 'true',
    // Do not force TLS off by default. Atlas SRV connections require TLS and
    // Mongoose/driver will infer proper defaults from the URI.
    ssl: process.env.MONGODB_SSL === undefined
      ? undefined
      : process.env.MONGODB_SSL === 'true',
    // Do not force authSource to "admin" by default. Let URI decide unless explicit.
    authSource: process.env.MONGODB_AUTH_SOURCE || undefined,
  };

  // ====================
  // LOGGING CONFIGURATION
  // ====================
  const validLogLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');
  if (!validLogLevels.includes(logLevel)) {
    throw new Error(
      `Invalid LOG_LEVEL: "${logLevel}". Must be one of: ${validLogLevels.join(', ')}`
    );
  }
  config.logLevel = logLevel;

  // ====================
  // RATE LIMITING CONFIGURATION
  // ====================
  const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10);
  if (isNaN(rateLimitWindowMs) || rateLimitWindowMs < 1000) {
    throw new Error(
      'Invalid RATE_LIMIT_WINDOW_MS: Must be a number >= 1000'
    );
  }

  const rateLimitMaxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5', 10);
  if (isNaN(rateLimitMaxRequests) || rateLimitMaxRequests < 1) {
    throw new Error(
      'Invalid RATE_LIMIT_MAX_REQUESTS: Must be a number >= 1'
    );
  }

  config.rateLimit = {
    windowMs: rateLimitWindowMs,
    maxRequests: rateLimitMaxRequests,
    blockSuspicious: process.env.BLOCK_SUSPICIOUS_REQUESTS === 'true',
    disabled: process.env.RATE_LIMIT_DISABLED === 'true',
  };

  if (config.rateLimit.disabled && isProduction) {
    logger.warn('[Config] Rate limiting is DISABLED in production! This is not recommended.');
  }

  // ====================
  // EMAIL & FRONTEND CONFIGURATION
  // ====================
  const frontendUrl = process.env.FRONTEND_URL || (isDevelopment ? 'http://localhost:5173' : null);
  if (isProduction && !frontendUrl) {
    throw new Error(
      'Missing required production environment variable: FRONTEND_URL\n' +
      'Must be set to your frontend application URL (e.g., https://app.example.com)'
    );
  }
  config.frontendUrl = frontendUrl;

  // SMTP Configuration (optional but validate if provided)
  if (process.env.SMTP_HOST) {
    config.smtp = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || 'noreply@example.com',
    };

    if (!config.smtp.user || !config.smtp.password) {
      logger.warn('[Config] SMTP_HOST configured but missing SMTP_USER or SMTP_PASSWORD. Email features disabled.');
      config.smtp = null;
    }
  }

  // ====================
  // REPORTING & API CONFIGURATION
  // ====================
  if (process.env.RESEND_API_KEY) {
    config.resendApiKey = process.env.RESEND_API_KEY;
  }
  config.resendFromEmail = process.env.RESEND_FROM_EMAIL || null;

  config.reportAdminEmail = process.env.REPORT_ADMIN_EMAIL || 'admin@dict.gov.ph';
  config.appUrl = process.env.APP_URL || frontendUrl;

  // ====================
  // AI/ML CONFIGURATION
  // ====================
  if (process.env.GEMINI_API_KEY) {
    config.gemini = {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
    };
  }

  // ====================
  // AUDIT & DEBUG CONFIGURATION
  // ====================
  config.auditDebug = process.env.AUDIT_DEBUG === '1' || process.env.AUDIT_DEBUG === 'true';
  if (config.auditDebug && isProduction) {
    logger.warn('[Config] Audit debug mode is ENABLED in production. This may impact performance.');
  }

  // ====================
  // SECURITY WARNINGS
  // ====================

  if (isDevelopment) {
    logger.warn('[Config] Running in DEVELOPMENT mode. Do not use this configuration in production.');
  }

  return config;
}

/**
 * Get validated environment configuration
 * Cached after first validation
 */
let cachedConfig = null;

function getConfig() {
  if (!cachedConfig) {
    cachedConfig = validateEnvironment();
  }
  return cachedConfig;
}

/**
 * Log configuration summary (redacting sensitive values)
 */
function logConfigSummary() {
  const config = getConfig();

  logStartup('Configuration Loaded Successfully', {
    environment: config.nodeEnv,
    port: config.port,
    mongodbUri: maskSensitive(config.mongodbUri),
    corsOrigins: config.allowedOrigins,
    serverTimeout: `${config.serverTimeoutMs}ms`,
    mongodbPoolMax: config.mongodb.poolSizeMax,
    mongodbPoolMin: config.mongodb.poolSizeMin,
  });
}

/**
 * Mask sensitive values in logs
 * @param {string} value - Value to mask
 * @returns {string} Masked value
 */
function maskSensitive(value) {
  if (!value) return 'NOT SET';
  if (value.length <= 10) return '***';
  return value.substring(0, 5) + '...' + value.substring(value.length - 5);
}

/**
 * Validate origin for CORS requests at runtime
 * Uses proper origin validation with normalization
 *
 * @param {string} origin - The origin header from request
 * @param {Object} context - Request context for logging
 * @returns {boolean} True if origin is allowed
 */
function isOriginAllowed(origin, context = {}) {
  const { validateOrigin } = require('../utils/security/originValidator');
  const allowedOrigins = getConfig().allowedOrigins;
  return validateOrigin(origin, allowedOrigins, context);
}

module.exports = {
  validateEnvironment,
  getConfig,
  logConfigSummary,
  maskSensitive,
  isOriginAllowed,
};
