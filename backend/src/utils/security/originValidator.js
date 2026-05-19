/**
 * Origin Validator Utility
 * Validates CORS origins with proper normalization and security logging
 * Prevents various origin bypass techniques
 */

const { logSecurityEvent } = require('../../lib/logger');

/**
 * Normalize an origin for consistent comparison
 * Handles:
 * - Case sensitivity (HTTP scheme lowercase)
 * - Port standardization
 * - URL parsing for validity
 *
 * @param {string} origin - Raw origin string
 * @returns {string|null} Normalized origin or null if invalid
 */
function normalizeOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return null;
  }

  try {
    // Parse the URL to validate and normalize
    const url = new URL(origin);

    // Ensure it's http or https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    // Construct normalized origin (lowercase protocol/host, but preserve case of domain)
    // Note: URL.origin handles this automatically
    return url.origin;
  } catch (_err) {
    // Invalid URL format
    return null;
  }
}

/**
 * Validate if an origin is allowed based on whitelist
 * Handles case normalization and edge cases
 * Also rejects dangerous patterns even if whitelisted
 *
 * @param {string} origin - The origin header from request
 * @param {string[]} allowedOrigins - Whitelist of allowed origins
 * @param {Object} context - Request context for logging (IP, userAgent, etc.)
 * @returns {boolean} True if origin is allowed
 */
function validateOrigin(origin, allowedOrigins, context = {}) {
  // Allow requests without Origin header (same-origin requests)
  // These typically come from form submissions, same-origin fetch, etc.
  if (!origin) {
    return true;
  }

  // In production, reject dangerous patterns before whitelist checks.
  // In development, allow localhost/IP origins when explicitly whitelisted.
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && isDangerousOrigin(origin)) {
    logSecurityEvent('CORS_DANGEROUS_PATTERN', `Rejected origin with dangerous pattern: "${origin}"`, {
      origin,
      dangerous: true,
      ...context,
    });
    return false;
  }

  // Normalize the incoming origin for comparison
  const normalizedIncoming = normalizeOrigin(origin);

  // If the origin is not a valid URL, reject it
  if (!normalizedIncoming) {
    logSecurityEvent('CORS_INVALID_ORIGIN', `Rejected invalid origin format: "${origin}"`, {
      origin,
      ...context,
    });
    return false;
  }

  // Check against whitelist (with normalization)
  const isAllowed = allowedOrigins.some((allowedOrigin) => {
    const normalizedAllowed = normalizeOrigin(allowedOrigin);
    return normalizedAllowed === normalizedIncoming;
  });

  if (!isAllowed) {
    logSecurityEvent('CORS_BLOCKED', `Rejected CORS origin: "${origin}"`, {
      origin: normalizedIncoming,
      allowedCount: allowedOrigins.length,
      ...context,
    });
  }

  return isAllowed;
}

/**
 * Check if origin contains dangerous patterns
 * Detects common bypass attempts
 *
 * @param {string} origin - The origin to check
 * @returns {boolean} True if origin appears malicious
 */
function isDangerousOrigin(origin) {
  if (!origin) return false;

  const dangerousPatterns = [
    /^[*]/,                    // Wildcard
    /localhost/i,              // Localhost (if supposed to be production)
    /127\.0\.0\.1/,           // Loopback
    /\.local$/i,              // .local TLD (typically dev machines)
    /\d+\.\d+\.\d+\.\d+:\d+/, // IP:port pattern
  ];

  return dangerousPatterns.some((pattern) => pattern.test(origin));
}

/**
 * Validate production origin requirements
 * Stricter validation for production deployments
 *
 * @param {string} origin - The origin to validate
 * @returns {boolean|string} True if valid, or error message
 */
function validateProductionOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return 'Origin must be a non-empty string';
  }

  if (isDangerousOrigin(origin)) {
    return `Origin "${origin}" not allowed in production (contains localhost, IP, or wildcard)`;
  }

  const normalized = normalizeOrigin(origin);
  if (!normalized) {
    return `Origin "${origin}" is not a valid URL`;
  }

  if (!normalized.startsWith('https://')) {
    return `Origin "${origin}" must use HTTPS in production`;
  }

  return true;
}

/**
 * Extract context from Express request for logging
 * @param {Object} req - Express request object
 * @returns {Object} Context object with IP, user-agent, etc.
 */
function getRequestContext(req) {
  return {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent') || 'unknown',
    method: req.method,
    path: req.path,
  };
}

module.exports = {
  normalizeOrigin,
  validateOrigin,
  isDangerousOrigin,
  validateProductionOrigin,
  getRequestContext,
};
