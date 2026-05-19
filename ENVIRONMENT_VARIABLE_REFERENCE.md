# ENVIRONMENT VARIABLE REFERENCE

**Last Updated:** May 19, 2026  
**Scope:** TrackHub Policy Management System - Backend Configuration  
**Audience:** DevOps, System Administrators, Developers

---

## CRITICAL CONFIGURATION (Required)

These variables are required for application startup. Missing any will cause app to fail at startup.

### NODE_ENV
- **Type:** String
- **Required:** Yes
- **Default:** development
- **Allowed Values:** development | production | test
- **Validation:** Exact match only
- **Purpose:** Determines runtime mode
- **Production Requirement:** MUST be production
- **Example:** `NODE_ENV=production`

### MONGODB_URI
- **Type:** MongoDB Connection String
- **Required:** Yes
- **Default:** None
- **Validation:** Must start with mongodb:// or mongodb+srv://
- **Purpose:** Database connection endpoint
- **Production Requirement:** Must use MongoDB Atlas (mongodb+srv://) or production instance
- **Security:** Should use authentication
- **Example:** `MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname`

### PORT
- **Type:** Number
- **Required:** No (has default)
- **Default:** 4000
- **Range:** 1-65535
- **Validation:** Must be valid port number
- **Purpose:** HTTP server listening port
- **Production Requirement:** Use port 3000+ (avoid reserved ports)
- **Example:** `PORT=3000`

### ALLOWED_ORIGINS
- **Type:** Comma-separated URLs
- **Required:** Yes in production, optional in development
- **Default:** http://localhost:5173, http://localhost:3000 (development only)
- **Validation:** Must be valid HTTPS URLs in production
- **Purpose:** CORS whitelist
- **Production Requirement:**
  - MUST include all frontend domain(s)
  - MUST use HTTPS only
  - NO localhost, 127.0.0.1, or wildcard (*)
- **Example:** `ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com`

---

## SECURITY CONFIGURATION (Required in Production)

### CORS Security
**Variable:** ALLOWED_ORIGINS (see above)

**Production Rules:**
- ❌ NO http:// (must be https://)
- ❌ NO localhost:*
- ❌ NO 127.0.0.1
- ❌ NO *.example.com (subdomains handled differently)
- ✅ DO use exact domains: https://example.com
- ✅ DO list all frontend domains separately

**Validation Enforced:**
- Startup fails if invalid in production mode
- Dangerous origins (localhost, IPs) are rejected even if in whitelist
- Case-insensitive domain matching
- Port-specific origins (https://example.com:443 vs https://example.com) are normalized

---

## DATABASE CONFIGURATION (Optional - Production Optimizable)

All pool and timeout settings are optional but recommended for production tuning.

### MONGODB_POOL_SIZE_MAX
- **Type:** Number
- **Default:** 50
- **Range:** 1-500
- **Validation:** Must be >= MONGODB_POOL_SIZE_MIN
- **Purpose:** Maximum connection pool size
- **Production Recommendation:** 20-50 for typical apps, 50-100 for high concurrency
- **Example:** `MONGODB_POOL_SIZE_MAX=100`

### MONGODB_POOL_SIZE_MIN
- **Type:** Number
- **Default:** 10
- **Range:** 1-MONGODB_POOL_SIZE_MAX
- **Purpose:** Minimum connection pool size
- **Production Recommendation:** 5-20
- **Example:** `MONGODB_POOL_SIZE_MIN=20`

### MONGODB_IDLE_TIMEOUT_MS
- **Type:** Number (milliseconds)
- **Default:** 300000 (5 minutes)
- **Minimum:** 1000 (1 second)
- **Purpose:** How long to keep idle connections open
- **Production Recommendation:** 300000-600000
- **Example:** `MONGODB_IDLE_TIMEOUT_MS=600000`

### MONGODB_CONNECT_TIMEOUT_MS
- **Type:** Number (milliseconds)
- **Default:** 10000 (10 seconds)
- **Minimum:** 1000
- **Purpose:** Timeout for establishing connection
- **Production Recommendation:** 10000-30000
- **Example:** `MONGODB_CONNECT_TIMEOUT_MS=15000`

### MONGODB_SOCKET_TIMEOUT_MS
- **Type:** Number (milliseconds)
- **Default:** 30000 (30 seconds)
- **Minimum:** 1000
- **Purpose:** Timeout for socket operations
- **Production Recommendation:** 30000-60000
- **Example:** `MONGODB_SOCKET_TIMEOUT_MS=45000`

### MONGODB_SERVER_SELECTION_TIMEOUT_MS
- **Type:** Number (milliseconds)
- **Default:** 5000 (5 seconds)
- **Minimum:** 1000
- **Purpose:** Timeout for server discovery
- **Production Recommendation:** 5000-10000
- **Example:** `MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000`

### MONGODB_HEARTBEAT_INTERVAL_MS
- **Type:** Number (milliseconds)
- **Default:** 10000 (10 seconds)
- **Minimum:** 1000
- **Purpose:** Health check interval for connections
- **Production Recommendation:** 10000-30000
- **Example:** `MONGODB_HEARTBEAT_INTERVAL_MS=15000`

### MONGODB_SSL
- **Type:** Boolean (true/false)
- **Default:** false
- **Purpose:** Enable SSL for MongoDB connection
- **Production Requirement:** Set to true if using MongoDB Atlas or SSL-enabled server
- **Example:** `MONGODB_SSL=true`

### MONGODB_MONITOR
- **Type:** Boolean (true/false)
- **Default:** false
- **Purpose:** Enable MongoDB command monitoring (verbose logging)
- **Production Recommendation:** false (heavy overhead)
- **Development Recommendation:** false (unless debugging)
- **Example:** `MONGODB_MONITOR=false`

### MONGODB_AUTH_SOURCE
- **Type:** String
- **Default:** admin
- **Purpose:** Database to authenticate against
- **Production Recommendation:** Use admin or specific auth DB
- **Example:** `MONGODB_AUTH_SOURCE=admin`

---

## EMAIL CONFIGURATION (Optional)

Required only if email notifications are enabled.

### SMTP_HOST
- **Type:** String (hostname or IP)
- **Required:** If SMTP email enabled
- **Default:** None
- **Example:** `SMTP_HOST=smtp.gmail.com`

### SMTP_PORT
- **Type:** Number
- **Default:** 587 (if SMTP_HOST set)
- **Common Values:**
  - 587 - TLS (recommended)
  - 465 - SSL
  - 25 - Unencrypted (not recommended)
- **Example:** `SMTP_PORT=587`

### SMTP_USER
- **Type:** String (email address)
- **Required:** If SMTP_HOST set
- **Example:** `SMTP_USER=noreply@example.com`

### SMTP_PASSWORD
- **Type:** String (password or app-specific password)
- **Required:** If SMTP_HOST set
- **Security:** Should be stored in secure vault, not in code
- **Example:** Use environment variable

### SMTP_FROM_EMAIL
- **Type:** String (email address)
- **Default:** noreply@example.com
- **Purpose:** From address for sent emails
- **Example:** `SMTP_FROM_EMAIL=notifications@example.com`

### FRONTEND_URL
- **Type:** URL
- **Default:** http://localhost:5173
- **Purpose:** Base URL for email links
- **Production Requirement:** Must be public-facing HTTPS URL
- **Example:** `FRONTEND_URL=https://app.example.com`

---

## REPORTING CONFIGURATION (Optional)

Required only if report export/email features are enabled.

### RESEND_API_KEY
- **Type:** String (API key)
- **Required:** If using Resend for email
- **Security:** Should be in secure vault
- **Purpose:** Resend email service authentication
- **Example:** Provided by Resend dashboard

### REPORT_ADMIN_EMAIL
- **Type:** String (email address)
- **Default:** admin@dict.gov.ph
- **Purpose:** Email address to notify for reports
- **Example:** `REPORT_ADMIN_EMAIL=admin@organization.com`

### APP_URL
- **Type:** URL
- **Default:** http://localhost:5173
- **Purpose:** Application URL for report links
- **Production Requirement:** Public-facing HTTPS URL
- **Example:** `APP_URL=https://audit.example.com`

---

## LOGGING CONFIGURATION (Optional)

### LOG_LEVEL
- **Type:** String
- **Default:** info
- **Allowed Values:** trace | debug | info | warn | error | fatal
- **Purpose:** Logging verbosity level
- **Production Recommendation:** info or warn
- **Development Recommendation:** debug or trace
- **Example:** `LOG_LEVEL=warn`

---

## AI/ML CONFIGURATION (Optional)

Required only if semantic evaluation is enabled.

### GEMINI_API_KEY
- **Type:** String (API key)
- **Required:** If using Google Gemini for AI analysis
- **Security:** Should be in secure vault
- **Purpose:** Google Generative AI authentication
- **Example:** Provided by Google AI Studio

### GEMINI_MODEL
- **Type:** String (model identifier)
- **Default:** gemini-2.0-flash
- **Purpose:** Which Gemini model to use
- **Example:** `GEMINI_MODEL=gemini-pro`

---

## AUDIT CONFIGURATION (Optional)

### AUDIT_DEBUG
- **Type:** Boolean (0 or 1)
- **Default:** 0 (disabled)
- **Purpose:** Enable verbose audit logging
- **Production Requirement:** Should be 0 (disabled)
- **Development Recommendation:** Can set to 1 for debugging
- **Example:** `AUDIT_DEBUG=0`

---

## RATE LIMITING CONFIGURATION (Optional)

### RATE_LIMIT_WINDOW_MS
- **Type:** Number (milliseconds)
- **Default:** 900000 (15 minutes)
- **Purpose:** Time window for rate limit counting
- **Production Recommendation:** 900000-3600000
- **Example:** `RATE_LIMIT_WINDOW_MS=900000`

### RATE_LIMIT_MAX_REQUESTS
- **Type:** Number
- **Default:** 5
- **Purpose:** Max requests per window for login attempts
- **Production Recommendation:** 5-10
- **Example:** `RATE_LIMIT_MAX_REQUESTS=5`

### RATE_LIMIT_DISABLED
- **Type:** Boolean (true/false)
- **Default:** false
- **Purpose:** Disable rate limiting (not recommended)
- **Production Requirement:** Should always be false
- **Example:** `RATE_LIMIT_DISABLED=false`

---

## TIMEOUT CONFIGURATION (Optional)

### SERVER_TIMEOUT_MS
- **Type:** Number (milliseconds)
- **Default:** 600000 (10 minutes)
- **Purpose:** Request timeout for long operations (audits)
- **Production Recommendation:** 600000-1800000
- **Example:** `SERVER_TIMEOUT_MS=600000`

---

## ENVIRONMENT VALIDATION RULES

The application validates environment configuration at startup. All validations are documented in `backend/src/config/env.js`.

### Validation Enforcement

**Development Mode (NODE_ENV=development):**
- Most variables optional
- Defaults applied for missing values
- Warnings logged for misconfigurations
- Localhost origins allowed

**Production Mode (NODE_ENV=production):**
- All critical variables required
- No defaults applied (fail fast)
- Strict validation for all values
- Dangerous patterns rejected
- HTTPS enforcement for CORS

### Startup Validation Checklist

On application startup, the following is validated:

- ✅ NODE_ENV is one of: development | production | test
- ✅ MONGODB_URI is provided and valid
- ✅ PORT is a valid port number (1-65535)
- ✅ ALLOWED_ORIGINS meets production requirements (if production)
- ✅ MongoDB pool sizes are within valid range (1-500)
- ✅ All timeouts are valid (minimum 1000ms)
- ✅ Email configuration (if provided) is complete
- ✅ API keys are provided (if services enabled)

If validation fails, application logs errors and exits immediately.

---

## ENVIRONMENT FILE EXAMPLES

### .env (Development)
```
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/audit-buddy
PORT=4000
LOG_LEVEL=debug
AUDIT_DEBUG=0
```

### .env.production
```
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/audit-buddy
PORT=3000
ALLOWED_ORIGINS=https://audit.example.com,https://admin.example.com
LOG_LEVEL=warn
MONGODB_SSL=true
MONGODB_POOL_SIZE_MAX=100
MONGODB_POOL_SIZE_MIN=20
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASSWORD=<secure-app-password>
SMTP_FROM_EMAIL=noreply@example.com
FRONTEND_URL=https://audit.example.com
RESEND_API_KEY=<from-resend-dashboard>
REPORT_ADMIN_EMAIL=admin@organization.com
GEMINI_API_KEY=<from-google-ai>
RATE_LIMIT_DISABLED=false
```

---

## CONFIGURATION BEST PRACTICES

### Security

1. **Never commit secrets** - Use environment variable injection
2. **Use strong passwords** - For MONGODB_URI and email credentials
3. **Restrict API keys** - Limit API key scope and permissions
4. **Rotate credentials** - Regularly rotate database and API credentials
5. **Audit access** - Log all configuration changes

### Performance

1. **Tune pool sizes** - Based on expected concurrency
2. **Adjust timeouts** - Based on network conditions
3. **Enable monitoring** - Use LOG_LEVEL=info for visibility
4. **Monitor health endpoints** - Watch /health/ready for degradation

### Reliability

1. **Test configuration** - Verify all required vars are set
2. **Use configuration management** - HashiCorp Vault, AWS Secrets Manager, etc.
3. **Plan for failures** - Have fallback strategies for external services
4. **Document deployment** - Keep configuration documented

---

## VALIDATION FAILURES - COMMON ISSUES

### Issue: "Invalid ALLOWED_ORIGINS: ... must use HTTPS in production"
**Cause:** Using http:// instead of https:// in production
**Fix:** Update ALLOWED_ORIGINS to use https://

### Issue: "Invalid PORT: Must be a number between 1-65535"
**Cause:** PORT set to invalid value (string, negative, >65535)
**Fix:** Set PORT to valid integer between 1-65535

### Issue: "Missing required environment variable: MONGODB_URI"
**Cause:** MONGODB_URI not set
**Fix:** Provide valid MongoDB connection string

### Issue: "Invalid MONGODB_POOL_SIZE_MAX: Must be 1-500"
**Cause:** Pool size outside valid range
**Fix:** Set to value between 1 and 500

---

**Document Status:** ✅ COMPLETE  
**Last Validated:** May 19, 2026  
**Scope:** Phase 1-2  
**Owner:** Architecture Team  

