require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const auditRoute = require('./routes/auditRoute');
const authRoute = require('./routes/authRoute');
const dashboardRoute = require('./routes/dashboardRoute');
const notificationRoute = require('./routes/notificationRoute');
const { connectDB } = require('./config/db');
const { suspiciousRequestDetector } = require('./middleware/rateLimiter');
const { sessionManager } = require('./middleware/auth');

/**
 * Validate that required environment variables are set
 * @throws {Error} If critical environment variables are missing
 */
const validateEnvironment = () => {
  const requiredVars = ['MONGODB_URI'];
  const missingVars = requiredVars.filter((v) => !process.env[v]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\nPlease check your .env file.`
    );
  }

  // Warn about optional but recommended variables
  const recommendedVars = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'FRONTEND_URL', 'ALLOWED_ORIGINS'];
  const missingRecommended = recommendedVars.filter((v) => !process.env[v]);

  if (missingRecommended.length > 0) {
    console.warn(
      `[Server] Optional security variables not configured: ${missingRecommended.join(', ')}\nSome features may not work properly.`
    );
  }
};

// Server configuration constants
const SERVER_CONFIG = {
  PORT: Number(process.env.PORT) || 4000,
  REQUEST_TIMEOUT_MS: Number(process.env.SERVER_TIMEOUT_MS) || 10 * 60 * 1000, // 10 minutes
  JSON_BODY_LIMIT: '50mb', // Support large audit report downloads
  KEEP_ALIVE_TIMEOUT_MS: Number(process.env.SERVER_TIMEOUT_MS) || 10 * 60 * 1000,
  HEADERS_TIMEOUT_MS: (Number(process.env.SERVER_TIMEOUT_MS) || 10 * 60 * 1000) + 5000,
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: 10 * 1000, // 10 second force-shutdown timeout
};

const app = express();

/**
 * Request timeout middleware
 * Prevents long-running requests from hanging indefinitely
 */
const requestTimeoutMiddleware = (req, res, next) => {
  res.setTimeout(SERVER_CONFIG.REQUEST_TIMEOUT_MS, () => {
    console.warn('[Server] Request timeout for', req.method, req.path);
    res.status(408).json({ error: 'Request timed out.' });
  });
  next();
};

/**
 * Health check endpoint
 * Returns server status, PID, uptime, and memory usage
 */
const healthCheckHandler = (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gwt-audit-backend',
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    memory: process.memoryUsage().rss,
  });
};

/**
 * Global error handler middleware
 * Catches all unhandled route errors
 */
const errorHandler = (err, _req, res, _next) => {
  console.error('[Server] Unhandled error:', err?.message);
  res.status(err.statusCode || 500).json({
    error: err?.message || 'Internal server error.',
  });
};

/**
 * Setup platform middleware (CORS, body parsing, timeout, security headers)
 */
const setupMiddleware = () => {
  // Security headers (helmet) - MUST come before other middleware
  app.use(helmet());

  // Bot/suspicious request detection middleware
  app.use(suspiciousRequestDetector);

  // CORS with secure configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173'];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true, // Allow cookies
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 3600, // Preflight cache 1 hour
    })
  );

  // Parse cookies (for httpOnly session cookies)
  app.use(cookieParser());

  // Body parsing
  app.use(express.json({ limit: SERVER_CONFIG.JSON_BODY_LIMIT }));

  // Request timeout
  app.use(requestTimeoutMiddleware);

  // Log middleware (development only)
  if (process.env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
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

  // Health check (can be public for monitoring)
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
    console.log(`[Server] ${signal} received — shutting down gracefully...`);

    server.close(() => {
      sessionManager.stopCleanupRoutine();
      console.log('[Server] HTTP server closed. All connections terminated.');
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error('[Server] Forced shutdown after timeout.');
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
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection in promise:', reason);
  });
};

/**
 * Start Express server
 */
async function startServer() {
  try {
    // Validate environment first
    validateEnvironment();

    // Connect to database
    await connectDB();

    // Setup application
    setupMiddleware();
    setupRoutes();
    setupProcessErrorHandlers();

    // Start listening
    const server = app.listen(SERVER_CONFIG.PORT, () => {
      console.log(`[GWT] Backend listening on port ${SERVER_CONFIG.PORT} (PID: ${process.pid})`);
      console.log(`[GWT] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[GWT] CORS Origins: ${process.env.ALLOWED_ORIGINS || 'http://localhost:5173'}`);
      // Signal PM2 the app is ready
      if (process.send) {
        process.send('ready');
      }
    });

    // Configure server behavior
    setupServerTimeouts(server);
    setupGracefulShutdown(server);
  } catch (error) {
    console.error('[Server] Failed to start:', error.message);
    process.exit(1);
  }
}

// Start the server
startServer();
