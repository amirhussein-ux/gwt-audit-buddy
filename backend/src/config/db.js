const mongoose = require('mongoose');

/**
 * MongoDB Connection Configuration
 * Optimized for traditional long-running server (Express + PM2)
 */

/**
 * Global Mongoose Configuration
 * Set defaults to use returnDocument instead of deprecated `new` option
 * This prevents deprecation warnings from findOneAndUpdate, findByIdAndUpdate, findOneAndReplace
 */
mongoose.set('returnOriginal', false); // Use `returnDocument: 'after'` by default

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not set');
    }

    // Connection options optimized for traditional long-running servers
    const options = {
      // Pool configuration for OLTP workload (long-running server)
      // maxPoolSize: 50 connections to handle concurrent requests
      // minPoolSize: 10 pre-warmed connections for quick response
      maxPoolSize: 50,
      minPoolSize: 10,

      // Keep idle connections for up to 5 minutes
      maxIdleTimeMS: 5 * 60 * 1000,

      // Connection and socket timeouts
      connectTimeoutMS: 10000, // 10 seconds to establish connection
      socketTimeoutMS: 30000, // 30 seconds for socket operations

      // Server selection
      serverSelectionTimeoutMS: 5000,

      // Retry logic
      retryWrites: true,
      retryReads: true,

      // Connection pool monitoring for debugging
      monitorCommands: false, // Set to true to see detailed connection logs
    };

    console.log('[MongoDB] Connecting to cluster...');
    await mongoose.connect(mongoURI, options);

    console.log('[MongoDB] ✓ Connected successfully');

    // Monitor connection events
    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Lost connection to database');
    });

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err.message);
    });

    return mongoose.connection;
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { connectDB };
