const mongoose = require('mongoose');
const { logger, logDatabase } = require('../lib/logger');
const { getConfig } = require('./env');

/**
 * MongoDB Connection Configuration
 * Optimized for production with configurable pool settings
 * Supports connection event logging and graceful shutdown
 */

// Prevent duplicate listener registration
const registeredConnections = new WeakMap();
const signalHandlersRegistered = new Map();

// Track connection state to prevent concurrent connections
let connectionPromise = null;
let isConnected = false;

// Global Mongoose Configuration
// Set defaults to return updated document instead of original
// This prevents deprecation warnings from findOneAndUpdate, findByIdAndUpdate, findOneAndReplace
mongoose.set('returnDocument', 'after');

// Connection pool & timeout constants (now loaded from validated env.js)
// These should be read from getConfig().mongodb but kept as const for backwards compatibility
const MONGODB_CONFIG = {
  get POOL_SIZE_MAX() {
    return getConfig().mongodb.poolSizeMax;
  },
  get POOL_SIZE_MIN() {
    return getConfig().mongodb.poolSizeMin;
  },
  get IDLE_TIMEOUT_MS() {
    return getConfig().mongodb.idleTimeoutMs;
  },
  get CONNECT_TIMEOUT_MS() {
    return getConfig().mongodb.connectTimeoutMs;
  },
  get SOCKET_TIMEOUT_MS() {
    return getConfig().mongodb.socketTimeoutMs;
  },
  get SERVER_SELECTION_TIMEOUT_MS() {
    return getConfig().mongodb.serverSelectionTimeoutMs;
  },
  get HEARTBEAT_INTERVAL_MS() {
    return getConfig().mongodb.heartbeatIntervalMs;
  },
};

/**
 * Build connection options based on environment
 * @returns {Object} Mongoose connection options
 */
const getConnectionOptions = () => {
  const mongoConfig = getConfig().mongodb;
  const options = {
    maxPoolSize: mongoConfig.poolSizeMax,
    minPoolSize: mongoConfig.poolSizeMin,
    maxIdleTimeMS: mongoConfig.idleTimeoutMs,
    connectTimeoutMS: mongoConfig.connectTimeoutMs,
    socketTimeoutMS: mongoConfig.socketTimeoutMs,
    serverSelectionTimeoutMS: mongoConfig.serverSelectionTimeoutMs,
    heartbeatFrequencyMS: mongoConfig.heartbeatIntervalMs,
    retryWrites: true,
    retryReads: true,
    // Enable command monitoring for debugging (slow in production)
    monitorCommands: mongoConfig.monitor,
  };

  // Only set optional connection flags when explicitly configured.
  // This prevents overriding URI-driven defaults (important for Atlas SRV/TLS).
  if (typeof mongoConfig.ssl === 'boolean') {
    options.ssl = mongoConfig.ssl;
  }
  if (mongoConfig.authSource) {
    options.authSource = mongoConfig.authSource;
  }

  return options;
};

/**
 * Validate MongoDB URI is configured
 * @throws {Error} If MONGODB_URI is not set
 */
const validateMongoDbUri = (uri) => {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
  if (!uri.startsWith('mongodb')) {
    throw new Error('Invalid MONGODB_URI: Must be a valid MongoDB connection string');
  }
};

/**
 * Setup connection event handlers for monitoring and diagnostics
 * Logs connection state changes, errors, and reconnection attempts
 * Protects against duplicate listener registration
 * @param {mongoose.Connection} connection - Active MongoDB connection
 */
const setupConnectionListeners = (connection) => {
  // Prevent duplicate listener registration
  if (registeredConnections.has(connection)) {
    logger.warn('MongoDB connection listeners already registered, skipping');
    return;
  }
  registeredConnections.set(connection, true);

  connection.on('connected', () => {
    logDatabase('connected', 'Successfully connected to MongoDB', {
      host: connection.host,
      port: connection.port,
      database: connection.name,
    });
  });

  connection.on('connecting', () => {
    logDatabase('connecting', 'Attempting to connect to MongoDB', {});
  });

  connection.on('disconnected', () => {
    logDatabase('disconnected', 'Lost connection to MongoDB (reconnection will be attempted)', {});
  });

  connection.on('error', (err) => {
    logDatabase('error', 'MongoDB connection error', {
      error: err.message,
      code: err.code,
    });
  });

  connection.on('reconnected', () => {
    logDatabase('reconnected', 'Successfully reconnected to MongoDB', {});
  });

  connection.on('disconnecting', () => {
    logDatabase('disconnecting', 'Closing MongoDB connection', {});
  });
};

/**
 * Setup graceful shutdown handler
 * Ensures all in-flight database operations complete before closing connection
 * Protects against duplicate signal handler registration
 * @param {mongoose.Connection} connection - Active MongoDB connection
 */
const setupGracefulShutdown = (connection) => {
  // Prevent duplicate signal handler registration
  const signalKey = 'MONGO_GRACEFUL_SHUTDOWN';
  if (signalHandlersRegistered.get(signalKey)) {
    logger.warn('MongoDB graceful shutdown handlers already registered, skipping');
    return;
  }
  signalHandlersRegistered.set(signalKey, true);

  const shutdown = async (signal) => {
    logDatabase('shutdown', `${signal} signal received - gracefully closing MongoDB connection`, {
      signal,
    });

    try {
      const startTime = Date.now();
      await connection.close();
      const duration = Date.now() - startTime;
      logDatabase('shutdown_complete', 'MongoDB connection closed cleanly', {
        duration,
        signal,
      });
    } catch (err) {
      logger.error({ error: err.message, signal }, 'Error closing MongoDB connection');
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

/**
 * Test database connectivity
 * Useful for health checks and diagnostics
 * @returns {Promise<boolean>} True if database is accessible
 */
const testConnectivity = async () => {
  try {
    const startTime = Date.now();
    // Ping the database
    await mongoose.connection.db.admin().ping();
    const duration = Date.now() - startTime;
    logDatabase('ping', 'Database connectivity test successful', { duration });
    return true;
  } catch (err) {
    logger.error({ error: err.message }, 'Database connectivity test failed');
    return false;
  }
};

/**
 * Connect to MongoDB cluster with optimized pool settings
 * Establishes connection, sets up event listeners, and graceful shutdown
 * Prevents concurrent connection attempts via state tracking
 * @returns {Promise<mongoose.Connection>} Active connection instance
 */
const connectDB = async () => {
  // If already connected, return existing connection
  if (isConnected && mongoose.connection.readyState === 1) {
    logger.debug('MongoDB connection already established, returning existing connection');
    return mongoose.connection;
  }

  // If connection is in progress, return the same promise to prevent duplicate attempts
  if (connectionPromise) {
    logger.debug('MongoDB connection in progress, returning pending connection');
    return connectionPromise;
  }

  // Start connection process
  connectionPromise = (async () => {
    try {
      const mongoURI = getConfig().mongodbUri;
      validateMongoDbUri(mongoURI);

      const mongoConfig = getConfig().mongodb;
      logDatabase('connecting', 'Attempting MongoDB connection with configuration', {
        poolSizeMax: mongoConfig.poolSizeMax,
        poolSizeMin: mongoConfig.poolSizeMin,
        idleTimeoutMs: mongoConfig.idleTimeoutMs,
        connectTimeoutMs: mongoConfig.connectTimeoutMs,
        socketTimeoutMs: mongoConfig.socketTimeoutMs,
      });

      const startTime = Date.now();
      const connection = await mongoose.connect(mongoURI, getConnectionOptions());
      const duration = Date.now() - startTime;

      logDatabase('connected', 'MongoDB connection established successfully', {
        duration,
        host: connection.connection.host,
        database: connection.connection.name,
      });

      // Mark as connected
      isConnected = true;

      // Setup event listeners for connection monitoring
      setupConnectionListeners(connection.connection);

      // Setup graceful shutdown to close connection cleanly
      setupGracefulShutdown(connection.connection);

      return connection.connection;
    } catch (error) {
      logger.error({ error: error.message, stack: error.stack }, 'MongoDB connection failed');
      connectionPromise = null; // Reset on error to allow retry
      process.exit(1);
    }
  })();

  return connectionPromise;
};

module.exports = {
  connectDB,
  testConnectivity,
  MONGODB_CONFIG,
};
