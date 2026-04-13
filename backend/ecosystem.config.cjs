/**
 * PM2 Ecosystem Config — GWT Audit Backend
 * File: ecosystem.config.cjs  (CommonJS — required by PM2)
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs            # start
 *   pm2 restart ecosystem.config.cjs          # restart
 *   pm2 stop gwt-audit-backend                # stop
 *   pm2 logs gwt-audit-backend                # live logs
 *   pm2 monit                                 # dashboard
 *   pm2 delete gwt-audit-backend              # remove from PM2
 */

module.exports = {
  apps: [
    {
      // ── Identity ───────────────────────────────────────────────────────────
      name: 'gwt-audit-backend',
      script: './src/server.js',     // entry point
      cwd: './',                     // run from backend root directory

      // ── Runtime ───────────────────────────────────────────────────────────
      interpreter: 'node',
      instances: 1,                  // single instance for dev
      exec_mode: 'fork',             // fork mode (cluster not needed for dev)

      // ── Environment ───────────────────────────────────────────────────────
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
        // Audit timeout: 10 minutes (matches server.js setting)
        SERVER_TIMEOUT_MS: 600000,
        // Set AUDIT_DEBUG=1 to enable verbose heuristic logs
        AUDIT_DEBUG: '0',
      },

      // ── Restart behavior ──────────────────────────────────────────────────
      // Watch mode OFF — Playwright launches Chromium subprocesses that would
      // trigger false restarts if watch is enabled.
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 3000,           // wait 3s before restarting on crash

      // ── Memory guard ──────────────────────────────────────────────────────
      // Playwright + Chromium can consume significant memory on large crawls.
      // Restart if backend exceeds 1.5 GB.
      max_memory_restart: '1500M',

      // ── Logging ───────────────────────────────────────────────────────────
      out_file: './logs/gwt-audit-out.log',
      error_file: './logs/gwt-audit-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      // ── Graceful shutdown ─────────────────────────────────────────────────
      // Give in-flight audits time to finish before killing the process.
      kill_timeout: 10000,           // 10 seconds
      wait_ready: false,
    },
  ],
};
