const mongoose = require('mongoose');

/**
 * MongoDB Connection Configuration
 * Optimized for traditional long-running server (Express + PM2)
 */

// Global Mongoose Configuration
// Set defaults to return updated document instead of original
// This prevents deprecation warnings from findOneAndUpdate, findByIdAndUpdate, findOneAndReplace
mongoose.set('returnDocument', 'after');

// Connection pool & timeout constants
const MONGODB_CONFIG = {
  POOL_SIZE_MAX: 50, // Handle concurrent OLTP requests
  POOL_SIZE_MIN: 10, // Pre-warmed connections for quick response
  IDLE_TIMEOUT_MS: 5 * 60 * 1000, // Keep idle connections for up to 5 minutes
  CONNECT_TIMEOUT_MS: 10 * 1000, // 10 seconds to establish connection
  SOCKET_TIMEOUT_MS: 30 * 1000, // 30 seconds for socket operations
  SERVER_SELECTION_TIMEOUT_MS: 5 * 1000, // 5 seconds for server selection
};

/**
 * Build connection options based on environment
 * @returns {Object} Mongoose connection options
 */
const getConnectionOptions = () => ({
  maxPoolSize: MONGODB_CONFIG.POOL_SIZE_MAX,
  minPoolSize: MONGODB_CONFIG.POOL_SIZE_MIN,
  maxIdleTimeMS: MONGODB_CONFIG.IDLE_TIMEOUT_MS,
  connectTimeoutMS: MONGODB_CONFIG.CONNECT_TIMEOUT_MS,
  socketTimeoutMS: MONGODB_CONFIG.SOCKET_TIMEOUT_MS,
  serverSelectionTimeoutMS: MONGODB_CONFIG.SERVER_SELECTION_TIMEOUT_MS,
  retryWrites: true,
  retryReads: true,
  monitorCommands: process.env.MONGODB_MONITOR === 'true',
});

/**
 * Validate MongoDB URI is configured
 * @throws {Error} If MONGODB_URI is not set
 */
const validateMongoDbUri = (uri) => {
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is required');
  }
};

/**
 * Setup connection event handlers
 * @param {mongoose.Connection} connection - Active MongoDB connection
 */
const setupConnectionListeners = (connection) => {
  connection.on('disconnected', () => {
    console.warn('[MongoDB] Lost connection to database');
  });

  connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
  });
};

/**
 * Connect to MongoDB cluster with optimized pool settings
 * @returns {Promise<mongoose.Connection>} Active connection instance
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    validateMongoDbUri(mongoURI);

    console.log('[MongoDB] Connecting to cluster...');
    await mongoose.connect(mongoURI, getConnectionOptions());

    console.log('[MongoDB] ✓ Connected successfully');
    setupConnectionListeners(mongoose.connection);

    return mongoose.connection;
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
