/**
 * Centralized logger utility using Pino
 * Provides structured logging with correlation IDs and metadata
 * All application logs should go through this logger, not console.log
 */

const pino = require('pino');

// Check if Pino is available, fallback to console if not
let logger;

try {
  logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  });
} catch (_err) {
  // Pino not available, create minimal logger and log the failure
  console.error('[LOGGER] Pino initialization failed, falling back to console logging:', _err.message);
  logger = {
    info: (...args) => console.log('[INFO]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    debug: (...args) => console.debug('[DEBUG]', ...args),
  };
}

/**
 * Log security event with context
 * @param {string} event - Event type (e.g., 'CORS_BLOCKED', 'AUTH_FAILED')
 * @param {string} message - Event description
 * @param {Object} metadata - Additional context (IP, user-agent, etc.)
 */
function logSecurityEvent(event, message, metadata = {}) {
  logger.warn(
    {
      type: 'SECURITY_EVENT',
      event,
      ...metadata,
    },
    message
  );
}

/**
 * Log configuration startup
 * @param {Object} config - Configuration object
 * @param {boolean} masked - Whether to mask sensitive values
 */
function logStartup(message, metadata = {}) {
  logger.info(
    {
      type: 'STARTUP',
      ...metadata,
    },
    message
  );
}

/**
 * Log database event
 * @param {string} event - Event type (e.g., 'CONNECT', 'DISCONNECT', 'ERROR')
 * @param {string} message - Event description
 * @param {Object} metadata - Additional context (response time, etc.)
 */
function logDatabase(event, message, metadata = {}) {
  const level = event === 'ERROR' ? 'error' : 'info';
  logger[level](
    {
      type: 'DATABASE',
      event,
      ...metadata,
    },
    message
  );
}

/**
 * Log application health
 * @param {string} component - Component name (MongoDB, Memory, etc.)
 * @param {string} status - Status (healthy, degraded, unhealthy)
 * @param {Object} metadata - Component-specific data
 */
function logHealth(component, status, metadata = {}) {
  const level = status === 'unhealthy' ? 'error' : status === 'degraded' ? 'warn' : 'info';
  logger[level](
    {
      type: 'HEALTH_CHECK',
      component,
      status,
      ...metadata,
    },
    `Health check: ${component} is ${status}`
  );
}

module.exports = {
  logger,
  logSecurityEvent,
  logStartup,
  logDatabase,
  logHealth,
};
