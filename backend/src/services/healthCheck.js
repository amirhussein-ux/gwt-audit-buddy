/**
 * Enhanced Health Check Service
 * Validates application readiness and dependencies (MongoDB, memory, etc.)
 * Returns structured health status for monitoring and orchestration
 *
 * Health Check Types:
 * - Liveness: Is the app running and responding? (For load balancers)
 * - Readiness: Is the app ready to serve requests? (For orchestration)
 */

const mongoose = require('mongoose');
const { logger, logHealth } = require('../lib/logger');
const { getConfig } = require('../config/env');

/**
 * Health status constants
 */
const HealthStatus = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
};

/**
 * Promise utility to wrap a promise with a timeout
 * @param {Promise} promise - Promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} name - Name for timeout error message
 * @returns {Promise}
 */
function withTimeout(promise, ms, name) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Check if sensitive information should be exposed in health responses
 * Only expose in development mode
 * @returns {boolean}
 */
function shouldExposeSensitiveInfo() {
  return getConfig().nodeEnv === 'development';
}

/**
 * Sanitize error message for production environments
 * @param {string} message - Original error message
 * @returns {string} Sanitized message
 */
function sanitizeMessage(message) {
  if (shouldExposeSensitiveInfo()) {
    return message;
  }
  // Generic message for production
  return message && message.length > 100 ? 'Component unhealthy' : message;
}

/**
 * Component health result
 * @typedef {Object} ComponentHealth
 * @property {string} name - Component name
 * @property {string} status - Component status (healthy/degraded/unhealthy)
 * @property {number} responseTimeMs - Response time in milliseconds
 * @property {string} [message] - Status message (for errors/warnings)
 * @property {*} [details] - Additional component-specific details
 */

/**
 * Check MongoDB database connectivity and health
 * @returns {Promise<ComponentHealth>}
 */
async function checkDatabase() {
  const startTime = Date.now();

  try {
    const status = mongoose.connection.readyState;

    // Connection states: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    if (status !== 1) {
      return {
        name: 'MongoDB',
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: `Connection state: ${status} (expected: 1)`,
      };
    }

    // Test actual connectivity with ping
    const db = mongoose.connection.getClient();
    if (!db) {
      return {
        name: 'MongoDB',
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message: 'No database client',
      };
    }

    // Perform actual ping command with timeout protection (5 second timeout)
    const pingStart = Date.now();
    try {
      await withTimeout(
        db.db('admin').command({ ping: 1 }),
        5000,
        'MongoDB health check'
      );
    } catch (pingErr) {
      const message = sanitizeMessage(pingErr.message);
      logHealth('mongodb', HealthStatus.UNHEALTHY, { error: pingErr.message });
      return {
        name: 'MongoDB',
        status: HealthStatus.UNHEALTHY,
        responseTimeMs: Date.now() - startTime,
        message,
      };
    }

    const responseTimeMs = Date.now() - pingStart;

    // Determine status based on response time
    let componentStatus = HealthStatus.HEALTHY;
    let message = 'Database healthy';

    if (responseTimeMs > 1000) {
      componentStatus = HealthStatus.DEGRADED;
      message = `Database responding slowly (${responseTimeMs}ms)`;
    }

    logHealth('mongodb', componentStatus, { responseTimeMs });

    return {
      name: 'MongoDB',
      status: componentStatus,
      responseTimeMs,
      message,
    };
  } catch (error) {
    const message = sanitizeMessage(error.message);
    logHealth('mongodb', HealthStatus.UNHEALTHY, { error: error.message });
    return {
      name: 'MongoDB',
      status: HealthStatus.UNHEALTHY,
      responseTimeMs: Date.now() - startTime,
      message,
    };
  }
}

/**
 * Check application memory usage
 * Flags degraded status if memory is above 85% of heap limit
 * @returns {ComponentHealth}
 */
function checkMemory() {
  const mem = process.memoryUsage();

  const heapUsedPercent = (mem.heapUsed / mem.heapTotal) * 100;
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);

  let status = HealthStatus.HEALTHY;
  let message = `Memory: ${heapUsedMB}MB / ${heapTotalMB}MB`;

  if (heapUsedPercent > 90) {
    status = HealthStatus.UNHEALTHY;
    message = `Critical memory usage: ${heapUsedPercent.toFixed(1)}%`;
  } else if (heapUsedPercent > 85) {
    status = HealthStatus.DEGRADED;
    message = `High memory usage: ${heapUsedPercent.toFixed(1)}%`;
  }

  return {
    name: 'Memory',
    status,
    responseTimeMs: 0,
    message,
    details: {
      heapUsedMB,
      heapTotalMB,
      externalMB: Math.round(mem.external / 1024 / 1024),
      heapUsedPercent: heapUsedPercent.toFixed(1),
    },
  };
}

/**
 * Check application uptime
 * @returns {ComponentHealth}
 */
function checkUptime() {
  const uptimeSeconds = process.uptime();
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);
  const uptimeHours = Math.floor(uptimeMinutes / 60);

  let uptimeStr;
  if (uptimeHours > 0) {
    uptimeStr = `${uptimeHours}h ${uptimeMinutes % 60}m`;
  } else {
    uptimeStr = `${uptimeMinutes}m ${Math.floor(uptimeSeconds % 60)}s`;
  }

  return {
    name: 'Uptime',
    status: HealthStatus.HEALTHY,
    responseTimeMs: 0,
    message: `Application running for ${uptimeStr}`,
    details: {
      uptimeSeconds: Math.round(uptimeSeconds),
      uptimeMinutes,
    },
  };
}

/**
 * Check application liveness
 * Simple check that the app is running and can respond
 * Used by load balancers/Kubernetes probes
 * @returns {Promise<Object>} Liveness status
 */
async function checkLiveness() {
  const startTime = Date.now();
  try {
    return {
      status: HealthStatus.HEALTHY,
      timestamp: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
    };
  } catch (error) {
    logHealth('liveness', HealthStatus.UNHEALTHY, { error: error.message });
    return {
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      totalDurationMs: Date.now() - startTime,
      message: 'Application not responding',
    };
  }
}

/**
 * Perform comprehensive health check
 * Checks database, memory, uptime, and overall system readiness
 * Removes sensitive information in production mode
 * @returns {Promise<Object>} Health check result with overall status and component details
 */
async function checkReadiness() {
  const startTime = Date.now();
  const READINESS_TIMEOUT_MS = 10000; // 10 second overall timeout

  try {
    // Check all components in parallel with overall timeout protection
    const [databaseHealth, memoryHealth, uptimeHealth] = await withTimeout(
      Promise.all([
        checkDatabase(),
        Promise.resolve(checkMemory()),
        Promise.resolve(checkUptime()),
      ]),
      READINESS_TIMEOUT_MS,
      'Health check'
    );

    const components = [databaseHealth, memoryHealth, uptimeHealth];

    // Determine overall status based on component statuses
    let overallStatus = HealthStatus.HEALTHY;

    if (components.some((c) => c.status === HealthStatus.UNHEALTHY)) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (components.some((c) => c.status === HealthStatus.DEGRADED)) {
      overallStatus = HealthStatus.DEGRADED;
    }

    const totalDurationMs = Date.now() - startTime;

    logHealth('readiness', overallStatus, { totalDurationMs, components: components.length });

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      totalDurationMs,
      components,
      message:
      overallStatus === HealthStatus.HEALTHY
        ? 'Application is healthy and ready'
        : overallStatus === HealthStatus.DEGRADED
          ? 'Application is degraded but operational'
          : 'Application is unhealthy',
    };

    // Include sensitive info only in development mode
    if (shouldExposeSensitiveInfo()) {
      response.version = process.env.npm_package_version || 'unknown';
      response.environment = getConfig().nodeEnv;
      response.pid = process.pid;
    }

    return response;
  } catch (error) {
    // If health check times out or fails, return unhealthy status
    const totalDurationMs = Date.now() - startTime;
    logger.error({ error: error.message }, '[Health Check] Timeout or critical error during readiness check');
    logHealth('readiness', HealthStatus.UNHEALTHY, { error: error.message });

    return {
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date().toISOString(),
      totalDurationMs,
      message: 'Health check failed or timed out',
      components: [],
    };
  }
}

/**
 * Perform comprehensive health check (backwards compatibility)
 * Alias for checkReadiness
 * @returns {Promise<Object>} Health check result
 */
async function performHealthCheck() {
  return checkReadiness();
}

/**
 * Quick ping check (faster than full health check)
 * Useful for load balancer health checks
 * @returns {Promise<boolean>} True if application is responding
 */
async function ping() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Ping timeout')), 5000)
    );

    const check = mongoose.connection.readyState === 1;

    await Promise.race([timeout, Promise.resolve(check)]);

    return check;
  } catch {
    return false;
  }
}

module.exports = {
  performHealthCheck,
  checkLiveness,
  checkReadiness,
  ping,
  checkDatabase,
  checkMemory,
  checkUptime,
};
