require('dotenv').config();

const express = require('express');
const cors = require('cors');
const auditRoute = require('./routes/auditRoute');
const authRoute = require('./routes/authRoute');
const dashboardRoute = require('./routes/dashboardRoute');
const { connectDB } = require('./config/db');

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// Increase timeout for long-running audits (10 minutes)
const SERVER_TIMEOUT_MS = Number(process.env.SERVER_TIMEOUT_MS) || 10 * 60 * 1000;

app.use(cors());
// Increased limit: audit responses with base64 XLSX/PDF can exceed 1mb
app.use(express.json({ limit: '50mb' }));

// Apply timeout to all requests
app.use((req, res, next) => {
  res.setTimeout(SERVER_TIMEOUT_MS, () => {
    res.status(408).json({ error: 'Request timed out.' });
  });
  next();
});

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'gwt-audit-backend',
    pid: process.pid,
    uptime: Math.round(process.uptime()),
    memory: process.memoryUsage().rss,
  });
});

// Register routes
// Auth routes don't need authentication (login/logout/verify)
app.use('/api/auth', authRoute);

// Protected routes (require authentication from here)
app.use('/api/dashboard', dashboardRoute);
app.use('/api/audit', auditRoute);

app.use((err, _req, res, _next) => {
  console.error('[MASID] Unhandled error:', err?.message);
  res.status(500).json({
    error: err?.message || 'Internal server error.',
  });
});

// Connect to MongoDB and start server
async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`[GWT] Backend listening on port ${PORT} (PID: ${process.pid})`);
      // Signal PM2 the app is ready
      if (process.send) process.send('ready');
    });

    // Keep connections alive for long audits
    server.keepAliveTimeout = SERVER_TIMEOUT_MS;
    server.headersTimeout = SERVER_TIMEOUT_MS + 5000;

    // Graceful shutdown — lets in-flight audits finish on pm2 stop/restart
    function gracefulShutdown(signal) {
      console.log(`[GWT] ${signal} received — shutting down gracefully...`);
      server.close(() => {
        console.log('[GWT] HTTP server closed. Exiting.');
        process.exit(0);
      });
      setTimeout(() => {
        console.error('[GWT] Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    }

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('[GWT] Failed to start server:', error.message);
    process.exit(1);
  }
}


process.on('unhandledRejection', (reason) => {
  console.error('[GWT] Unhandled rejection:', reason);
});

// Start the server
startServer();