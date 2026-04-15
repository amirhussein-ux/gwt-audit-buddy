# Security Audit Report - GWT Audit Buddy

**Date**: April 15, 2026  
**Severity Review**: CRITICAL issues identified  
**Status**: ⚠️ Requires immediate remediation

---

## Executive Summary

This authentication system has **7 CRITICAL and HIGH severity vulnerabilities** that must be fixed before production deployment. Most are remediable with code changes; some require infrastructure updates.

---

## Critical Issues

### 🔴 CRITICAL-1: CORS Configured to Allow All Origins
**File**: `backend/src/server.js:63`  
**Current**: `app.use(cors())`  
**Risk**: Any website can make authenticated requests on behalf of users  
**Impact**: Cross-Site Request Forgery (CSRF), data exfiltration  
**Fix**: Restrict CORS to specific frontend origin(s)

```javascript
// VULNERABLE (current)
app.use(cors());

// SECURE (required)
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
}));
```

### 🔴 CRITICAL-2: MongoDB Credentials Exposed in .env
**File**: `backend/.env:6`  
**Current**: `MONGODB_URI=mongodb+srv://masid_admin:CIcwSrRa1zS09MSP@...`  
**Risk**: Credentials visible in source control, logs, and error messages  
**Impact**: Complete database compromise if .env is exposed  
**Fix**: 
- Immediately rotate MongoDB credentials
- Use environment secrets in production (not .env files)
- Add `.env` to `.gitignore` (verify it's present)
- Use MongoDB connection string with minimal IAM user

### 🔴 CRITICAL-3: No Email Verification
**Status**: NOT IMPLEMENTED  
**Risk**: Any email can be registered; attackers can register with victim's email  
**Impact**: Account takeover, privilege escalation  
**Fix**: Send verification links, block account until verified

### 🔴 CRITICAL-4: No Rate Limiting on Login
**File**: `backend/src/routes/authRoute.js:90`  
**Risk**: Brute force / credential stuffing attacks  
**Impact**: Account compromise via automated password guessing  
**Fix**: Implement strict rate limiting (3 attempts per 15 minutes per IP)

### 🔴 CRITICAL-5: Token Extraction from URL/Body
**File**: `backend/src/routes/authRoute.js:33-37`  
```javascript
return (
  req.headers.authorization?.replace('Bearer ', '') ||
  req.body?.token ||      // 🔴 VULNERABLE: can be logged, cached
  req.query?.token ||     // 🔴 VULNERABLE: visible in URLs, logs
  null
);
```
**Risk**: Tokens leaked in browser history, server logs, proxies  
**Impact**: Session hijacking  
**Fix**: Accept tokens ONLY from Authorization header

---

## High Priority Issues

### 🟠 HIGH-1: Password Hashing Using PBKDF2 (Outdated)
**File**: `backend/src/models/User.js:5-35`  
**Issue**: PBKDF2 is slow to compute (increases hash time) vs. bcrypt  
**Risk**: GPU/cloud cracking becomes feasible with 1000 iterations  
**Recommendation**: Migrate to bcrypt or Argon2  
**Cost**: Requires password reset for existing users

### 🟠 HIGH-2: No Password Reset Tokens
**Status**: NOT IMPLEMENTED  
**Risk**: Users can't recover lost passwords; attackers can't be blocked  
**Recommendation**: Implement 15-minute expiring reset tokens

### 🟠 HIGH-3: Session Storage is In-Memory
**File**: `backend/src/middleware/auth.js:15-20`  
**Issue**: Sessions lost on server restart; doesn't scale to multiple servers  
**Risk**: No distributed session support  
**Recommendation**: Migrate to Redis or signed JWT

### 🟠 HIGH-4: No API Secrets/JWT Signing Keys Documented
**Issue**: No mention of JWT_SECRET or SESSION_SECRET in .env.example  
**Risk**: Keys could be hardcoded or reused across environments  
**Recommendation**: Document all required secrets

---

## Medium Priority Issues

### 🟡 MEDIUM-1: No HTTP Security Headers
**Issue**: Missing CSP, HSTS, X-Frame-Options, etc.  
**Risk**: XSS, clickjacking, SSL stripping attacks  
**Recommendation**: Add helmet.js middleware

### 🟡 MEDIUM-2: Token Not Set as HttpOnly Cookie
**File**: `backend/src/routes/authRoute.js:130-137`  
**Issue**: Token only in JSON response, stored in localStorage (vulnerable to XSS)  
**Recommendation**: Also send as httpOnly cookie for cookie-based requests

### 🟡 MEDIUM-3: No Account Recovery/Unlock Flow
**File**: `backend/src/models/User.js:180-185`  
**Issue**: Locked accounts require admin intervention  
**Recommendation**: Send admin notification or optional self-service unlock

### 🟡 MEDIUM-4: Insufficient Logging
**Issue**: Failed login attempts not logged to database for audit trail  
**Recommendation**: Log auth events (login, failed attempt, logout)

---

## ✅ Already Implemented (Positive)

- ✅ Password hashing with salt (using PBKDF2)
- ✅ Account lockout after 5 failed attempts (30 min timeout)
- ✅ Session token validation on each request
- ✅ Passwords selected: `-hashedPassword` to prevent exposure
- ✅ Token expiry: 24 hours
- ✅ Failed login tracking

---

## Implementation Priority

### Phase 1 (CRITICAL - Do immediately before deployment)
1. Fix CORS configuration
2. Rotate MongoDB credentials
3. Enforce token extraction from headers only
4. Add email verification
5. Add rate limiting to login

### Phase 2 (HIGH - Do before full production)
1. Migrate passwords to bcrypt
2. Implement password reset tokens
3. Add Redis sessions (optional if staying small)
4. Document all secrets in .env.example

### Phase 3 (MEDIUM - Ongoing)
1. Add security headers (helmet)
2. Implement audit logging
3. Add HttpOnly cookies
4. Add account recovery flow

---

## Testing Recommendations

- [ ] Test CORS rejects requests from different origins
- [ ] Test rate limiting locks account after N failures
- [ ] Test email verification blocks unverified accounts
- [ ] Test password reset tokens expire after 15 min
- [ ] Test tokens cannot be passed via query string or body
- [ ] Test audit logs capture all auth events
- [ ] Load test with multiple concurrent sessions

---

## References

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [NIST Password Guidelines](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [Express Security Practices](https://expressjs.com/en/advanced/best-practice-security.html)

---

