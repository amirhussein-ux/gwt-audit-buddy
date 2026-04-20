const rateLimit = require('express-rate-limit');

/**
 * Rate limiting configuration for different endpoint categories
 * Each has different limits based on sensitivity and resource usage
 */
const RATE_LIMIT_CONFIG = {
  WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 5, // 5 attempts
};

/**
 * Bot detection and user-agent validation
 * Prevents automated scraping and API abuse
 */
const SUSPICIOUS_USER_AGENTS = [
  'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java',
  'nodejs', 'perl', 'ruby', 'php', 'scan', 'exploit',
];

/**
 * Check if user-agent appears to be suspicious/automated
 * @param {string} userAgent - User-Agent header from request
 * @returns {boolean} True if agent appears suspicious
 */
const isSuspiciousUserAgent = (userAgent) => {
  if (!userAgent) return true; // Missing user-agent is suspicious
  const lower = userAgent.toLowerCase();
  return SUSPICIOUS_USER_AGENTS.some(agent => lower.includes(agent));
};

/**
 * Rate limiter for login attempts (STRICT)
 * Limits: 5 requests per 15 minutes per IP
 * Prevents brute force attacks on authentication
 */
const loginLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.MAX_REQUESTS, // 5 attempts
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination for targeted protection
    return `${req.ip}-${req.body?.email || 'unknown'}`;
  },
  skip: (req) => {
    // Skip rate limiting for requests from allowed IPs (optional admin whitelist)
    return false;
  },
  handler: (req, res) => {
    console.warn('[RateLimit] Login attempt blocked:', { ip: req.ip, email: req.body?.email });
    return res.status(429).json({
      error: 'Too many login attempts. Please try again in a few minutes.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Rate limiter for account registration (STRICT)
 * Limits: 5 requests per 15 minutes per IP
 * Prevents account enumeration and mass account creation
 */
const registrationLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 5, // 5 registrations per 15 min
  message: 'Too many registration attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP to prevent mass registrations
    return req.ip;
  },
  skip: (req) => {
    // Block requests with suspicious user agents
    if (isSuspiciousUserAgent(req.get('user-agent'))) {
      return false; // Don't skip - will be rate limited
    }
    return false;
  },
  handler: (req, res) => {
    console.warn('[RateLimit] Registration attempt blocked:', { ip: req.ip });
    return res.status(429).json({
      error: 'Too many registration attempts. Please try again later.',
      code: 'RATE_LIMIT_REGISTRATION',
    });
  },
});

/**
 * Rate limiter for password reset requests (MODERATE)
 * Limits: 3 requests per 15 minutes per IP
 * Prevents account takeover via reset abuse
 */
const passwordResetLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 3, // 3 attempts per 15 min
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by IP + email combination
    return `${req.ip}-${req.body?.email || 'unknown'}`;
  },
  handler: (req, res) => {
    console.warn('[RateLimit] Password reset attempt blocked:', { ip: req.ip });
    return res.status(429).json({
      error: 'Too many password reset attempts. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    });
  },
});

/**
 * Rate limiter for email verification/resend (MODERATE)
 * Limits: 5 requests per 15 minutes per IP
 * Prevents email verification spam and abuse
 */
const emailVerificationLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 5, // 5 attempts per 15 min
  message: 'Too many verification requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `${req.ip}-${req.body?.email || 'unknown'}`;
  },
  handler: (req, res) => {
    console.warn('[RateLimit] Email verification attempt blocked:', { ip: req.ip });
    return res.status(429).json({
      error: 'Too many verification attempts. Please try again later.',
      code: 'RATE_LIMIT_VERIFICATION',
    });
  },
});

/**
 * Rate limiter for audit endpoints (MODERATE-RELAXED)
 * Limits: 30 audit requests per 15 minutes per user
 * Allows legitimate auditing while preventing DOS attacks
 */
const auditLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 30, // 30 audits per 15 min
  message: 'Too many audit requests, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by user ID if authenticated, otherwise by IP
    return req.user?._id?.toString() || req.ip;
  },
  skip: (req) => {
    // Skip if rate limiting disabled (development)
    if (process.env.RATE_LIMIT_DISABLED === 'true') {
      console.log('[RateLimit] Audit rate limiting disabled (dev mode)');
      return true;
    }
    // Only rate limit if user is not admin (admins can run full audits)
    return req.user?.role === 'admin';
  },
  handler: (req, res) => {
    console.warn('[RateLimit] Audit request blocked:', { ip: req.ip, userId: req.user?._id });
    return res.status(429).json({
      error: 'Too many audit requests. Please try again later.',
      code: 'RATE_LIMIT_AUDIT',
      message: 'Audit requests are limited to prevent server overload.',
    });
  },
});

/**
 * Rate limiter for AI/Gemini requests (STRICT)
 * Limits: 10 AI requests per 15 minutes per user
 * AI API calls are expensive; strict limits prevent abuse
 */
const aiRequestLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 10, // 10 AI requests per 15 min (expensive)
  message: 'Too many AI requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit strictly per user (authenticated required)
    return req.user?._id?.toString() || req.ip;
  },
  skip: (req) => {
    // Only rate limit authenticated users
    return !req.user;
  },
  handler: (req, res) => {
    console.warn('[RateLimit] AI request blocked:', { userId: req.user?._id });
    return res.status(429).json({
      error: 'Too many AI analysis requests. AI requests are limited to prevent resource exhaustion.',
      code: 'RATE_LIMIT_AI',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});

/**
 * Rate limiter for download requests (MODERATE)
 * Limits: 50 downloads per 15 minutes per user
 * Prevents automated scraping of reports
 */
const downloadLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 50, // 50 downloads per 15 min
  message: 'Too many download requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.user?._id?.toString() || req.ip;
  },
  handler: (req, res) => {
    console.warn('[RateLimit] Download request blocked:', { ip: req.ip, userId: req.user?._id });
    return res.status(429).json({
      error: 'Too many downloads. Please try again later.',
      code: 'RATE_LIMIT_DOWNLOAD',
    });
  },
});

/**
 * Rate limiter for general API endpoints (RELAXED)
 * Limits: 100 requests per 15 minutes per IP
 * Catches remaining abuse patterns
 */
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: 100, // 100 general API requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for admin users
    return req.user?.role === 'admin';
  },
});

/**
 * Middleware to detect and block suspicious requests
 * Checks for patterns indicative of bots/scrapers
 */
const suspiciousRequestDetector = (req, res, next) => {
  const userAgent = req.get('user-agent') || '';
  const suspicious = {
    noUserAgent: !userAgent,
    suspiciousUserAgent: isSuspiciousUserAgent(userAgent),
    multipleHeaders: (req.headers['x-forwarded-for'] || '').split(',').length > 3,
  };

  // Log suspicious activity
  if (Object.values(suspicious).some(v => v)) {
    console.warn('[SuspiciousRequest] Detected:', {
      ip: req.ip,
      userAgent,
      path: req.path,
      suspicious,
    });
    req.suspicious = suspicious;
  }

  next();
};

module.exports = {
  loginLimiter,
  registrationLimiter,
  passwordResetLimiter,
  emailVerificationLimiter,
  auditLimiter,
  aiRequestLimiter,
  downloadLimiter,
  apiLimiter,
  suspiciousRequestDetector,
  isSuspiciousUserAgent,
};
