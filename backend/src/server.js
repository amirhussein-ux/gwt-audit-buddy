require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const auditRoute = require('./routes/auditRoute');
const authRoute = require('./routes/authRoute');
const dashboardRoute = require('./routes/dashboardRoute');
const notificationRoute = require('./routes/notificationRoute');
const reportRoute = require('./routes/reportRoute');
const { connectDB } = require('./config/db');
const { apiLimiter, suspiciousRequestDetector } = require('./middleware/rateLimiter');
const { sessionManager } = require('./middleware/auth');
const { validateEnvironment, getConfig, logConfigSummary, isOriginAllowed } = require('./config/env');
const { performHealthCheck } = require('./services/healthCheck');
const { logger, logStartup, logSecurityEvent } = require('./lib/logger');
const { getRequestContext } = require('./utils/security/originValidator');

// Server configuration constants - determined from validated environment
let SERVER_CONFIG = {
  PORT: 4000, // Will be overridden by getConfig()
  REQUEST_TIMEOUT_MS: 10 * 60 * 1000,
  JSON_BODY_LIMIT: '50mb', // Support large audit report downloads
  KEEP_ALIVE_TIMEOUT_MS: 10 * 60 * 1000,
  HEADERS_TIMEOUT_MS: 10 * 60 * 1000 + 5000,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 10 * 1000,
};

// Will be populated after environment validation
let CORS_CONFIG = {
  allowedOrigins: ['http://localhost:5173'], // Default, will be overridden
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
};

const app = express();

/**
 * Request timeout middleware
 * Prevents long-running requests from hanging indefinitely
 */
const requestTimeoutMiddleware = (req, res, next) => {
  res.setTimeout(SERVER_CONFIG.REQUEST_TIMEOUT_MS, () => {
    logger.warn({ method: req.method, path: req.path }, 'Request timeout');
    res.status(408).json({ error: 'Request timed out.' });
  });
  next();
};

/**
 * Enhanced health check endpoint
 * Returns comprehensive application health status including database connectivity
 * Supports both detailed and quick modes
 * 
 * Query params:
 *  - detailed=true (default: comprehensive check)
 *  - detailed=false (quick ping only)
 */
const healthCheckHandler = async (req, res) => {
  try {
    // Call readiness check for full diagnostics
    const health = await performHealthCheck();
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 503 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    logger.error({ error: err.message, stack: err.stack }, 'Health check failed');
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Liveness probe handler
 * Quick check that app is running (for load balancers)
 */
const livenessCheckHandler = async (req, res) => {
  try {
    const { checkLiveness } = require('./services/healthCheck');
    const health = await checkLiveness();
    res.status(200).json(health);
  } catch (err) {
    logger.error({ error: err.message }, 'Liveness check failed');
    res.status(503).json({
      status: 'unhealthy',
      error: 'Liveness check failed',
    });
  }
};

/**
 * Readiness probe handler
 * Full check that app is ready for traffic (for orchestration)
 */
const readinessCheckHandler = async (req, res) => {
  try {
    const { checkReadiness } = require('./services/healthCheck');
    const health = await checkReadiness();
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (err) {
    logger.error({ error: err.message }, 'Readiness check failed');
    res.status(503).json({
      status: 'unhealthy',
      error: 'Readiness check failed',
    });
  }
};

/**
 * Global error handler middleware
 * Catches all unhandled route errors
 */
const errorHandler = (err, _req, res, _next) => {
  logger.error({ error: err?.message, stack: err?.stack }, 'Unhandled error');
  res.status(err.statusCode || 500).json({
    error: err?.message || 'Internal server error.',
  });
};

/**
 * Setup platform middleware (CORS, body parsing, timeout, security headers)
 * Uses validated environment configuration for CORS
 */
const setupMiddleware = () => {
  // Security headers (helmet) - MUST come before other middleware
  app.use(helmet());

  // Bot/suspicious request detection middleware
  app.use(suspiciousRequestDetector);

  // CORS with strict configuration based on validated environment
  // Uses callback to validate each origin request in real-time
  app.use((req, res, next) => {
    const corsMiddleware = cors({
      origin: (origin, callback) => {
        // Allow requests without origin (e.g., same-origin, mobile apps)
        if (!origin) {
          return callback(null, true);
        }

        // Get context for security logging
        const context = getRequestContext(req);
        
        // Check if origin is in allowed list (with context for logging)
        if (isOriginAllowed(origin, context)) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy violation'));
        }
      },
      credentials: true, // Allow cookies
      methods: CORS_CONFIG.methods,
      allowedHeaders: CORS_CONFIG.allowedHeaders,
      maxAge: CORS_CONFIG.maxAge, // Preflight cache 1 hour
      optionsSuccessStatus: 200, // For legacy browser compatibility
    });
    corsMiddleware(req, res, next);
  });

  // Parse cookies (for httpOnly session cookies)
  app.use(cookieParser());

  // Body parsing
  app.use(express.json({ limit: SERVER_CONFIG.JSON_BODY_LIMIT }));

  // Request timeout
  app.use(requestTimeoutMiddleware);

  // General API rate limiting
  app.use('/api', apiLimiter);

  // Log middleware (development only)
  if (getConfig().nodeEnv === 'development') {
    app.use((req, res, next) => {
      logger.debug({ method: req.method, path: req.path }, 'Incoming request');
      next();
    });
  }
};

/**
 * Register application routes
 */
const setupRoutes = () => {
  // Auth routes (no authentication required)
  app.use('/api/auth', authRoute);

  // Protected routes (require authentication)
  app.use('/api/dashboard', dashboardRoute);
  app.use('/api/audit', auditRoute);
  app.use('/api/notifications', notificationRoute);
  app.use('/api/reports', reportRoute);

  // Health check endpoints (public for monitoring/orchestration)
  // Liveness probe - quick app response check (for load balancers)
  app.get('/health/live', livenessCheckHandler);
  
  // Readiness probe - full diagnostics check (for orchestration)
  app.get('/health/ready', readinessCheckHandler);
  
  // Health endpoint - backwards compatibility (calls readiness)
  app.get('/health', healthCheckHandler);

  // Global error handler (must be last)
  app.use(errorHandler);
};

/**
 * Setup graceful shutdown sequence
 * Allows in-flight requests to complete before hard shutdown
 */
const setupGracefulShutdown = (server) => {
  const shutdown = (signal) => {
    logStartup(`${signal} received - shutting down gracefully`, {
      signal,
      timeout: SERVER_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT_MS,
    });

    server.close(() => {
      sessionManager.stopCleanupRoutine();
      logStartup('HTTP server closed - all connections terminated', {});
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error({ signal }, 'Forced shutdown after graceful timeout');
      process.exit(1);
    }, SERVER_CONFIG.GRACEFUL_SHUTDOWN_TIMEOUT_MS);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

/**
 * Setup server timeout configurations
 * Ensures long-running audits don't get terminated prematurely
 */
const setupServerTimeouts = (server) => {
  server.keepAliveTimeout = SERVER_CONFIG.KEEP_ALIVE_TIMEOUT_MS;
  server.headersTimeout = SERVER_CONFIG.HEADERS_TIMEOUT_MS;
};

/**
 * Handle unhandled promise rejections
 */
const setupProcessErrorHandlers = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logSecurityEvent('UNHANDLED_REJECTION', 'Unhandled promise rejection', {
      reason: reason?.message || String(reason),
      stack: reason?.stack,
    });
  });
};

/**
 * Start Express server with validated environment configuration
 */
async function startServer() {
  try {
    // Validate environment first - will throw on validation errors
    validateEnvironment();
    
    // Get validated configuration
    const config = getConfig();

    // Update SERVER_CONFIG with validated values
    SERVER_CONFIG.PORT = config.port;
    SERVER_CONFIG.REQUEST_TIMEOUT_MS = config.serverTimeoutMs;
    SERVER_CONFIG.KEEP_ALIVE_TIMEOUT_MS = config.serverTimeoutMs;
    SERVER_CONFIG.HEADERS_TIMEOUT_MS = config.serverTimeoutMs + 5000;

    // Update CORS_CONFIG with validated origins
    CORS_CONFIG.allowedOrigins = config.allowedOrigins;

    // Log configuration summary (masks sensitive values)
    logConfigSummary();

    // Connect to database
    await connectDB();

    // Setup application
    setupMiddleware();
    setupRoutes();
    setupProcessErrorHandlers();

    // Start listening
    const server = app.listen(SERVER_CONFIG.PORT, () => {
      logStartup('Backend server started', {
        port: SERVER_CONFIG.PORT,
        pid: process.pid,
        environment: getConfig().nodeEnv,
        corsOrigins: config.allowedOrigins,
      });
      // Signal PM2 the app is ready
      if (process.send) {
        process.send('ready');
      }
    });

    // Configure server behavior
    setupServerTimeouts(server);
    setupGracefulShutdown(server);
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server
startServer();
