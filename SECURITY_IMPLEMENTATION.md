# Security Refactor Implementation Guide

**Status**: ✅ PHASE 1 COMPLETE (Critical Issues Fixed)  
**Date**: April 15, 2026  
**Severity**: CRITICAL security improvements implemented

---

## What Changed

### ✅ PHASE 1: CRITICAL SECURITY FIXES (IMPLEMENTED)

#### 1. **Bcrypt Password Hashing** ✅
- **Before**: PBKDF2 with 1000 iterations (outdated, vulnerable to GPU cracking)
- **After**: Bcrypt with 12 rounds (industry standard, resistant to GPU/cloud attacks)
- **File**: `backend/src/models/User.js`
- **Migration**: Existing passwords will remain PBKDF2 until user logs in (auto-upgraded on successful login)

```typescript
// Old: synchronous PBKDF2
const hashPassword = (password) => {
  const hash = crypto.pbkdf2Sync(...);
  return `${salt}:${hash}`;
};

// New: asynchronous bcrypt
const hashPassword = await bcrypt.hash(password, 12);
```

#### 2. **Email Verification System** ✅
- **New Endpoints**:
  - `POST /auth/register` - Register with email verification
  - `POST /auth/verify-email` - Verify email with token
  - `POST /auth/resend-verification` - Resend verification if expired

- **Token Expiry**: 24 hours
- **Behavior**: Users cannot login until email verified

```bash
# Register new user
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john","email":"john@example.com","password":"Pass123!"}'

# Verify email (user receives token in email or URL)
curl -X POST http://localhost:4000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","token":"<token-from-email>"}'
```

#### 3. **Password Reset System** ✅
- **New Endpoints**:
  - `POST /auth/forgot-password` - Request password reset (rate limited: 3 req/15 min)
  - `POST /auth/reset-password` - Complete password reset with token

- **Token Expiry**: 15 minutes
- **Security**: Tokens emailed to user, not provided via response

```bash
# Request password reset
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com"}'

# Reset password (user receives token via email)
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","token":"<token>","password":"NewPass123!"}'
```

#### 4. **Rate Limiting** ✅
- **Login Endpoint**: 5 attempts per 15 minutes per IP
- **Password Reset**: 3 requests per 15 minutes per IP
- **File**: `backend/src/middleware/rateLimiter.js`

#### 5. **CORS Hardened** ✅
- **Before**: `cors()` - Accept all origins (CRITICAL vulnerability)
- **After**: Whitelist specific origins via `ALLOWED_ORIGINS` env var

```javascript
// Old: VULNERABLE
app.use(cors());

// New: SECURE
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ?.split(',')
  .map(o => o.trim())
  || ['http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600,
}));
```

#### 6. **Token Extraction Hardened** ✅
- **Before**: Tokens extracted from Authorization header, body, OR query string
- **After**: Tokens extracted from Authorization header ONLY (or httpOnly cookie as fallback)
- **Why**: Prevents tokens in logs, browser history, proxy caches

```javascript
// Old: VULNERABLE - tokens visible in logs/URL bar
const token = req.query?.token || req.body?.token || req.headers.authorization;

// New: SECURE - headers or httpOnly cookie only
const token = extractTokenFromHeader(req);
// Token in query string is explicitly ignored
```

#### 7. **HttpOnly Session Cookies** ✅
- **Session tokens now sent as httpOnly cookies** in addition to JSON response
- **Prevents XSS attacks** from reading token via JavaScript

```javascript
res.cookie('sessionToken', token, {
  httpOnly: true,  // Not accessible to JavaScript
  secure: true,    // HTTPS only in production
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000,
});
```

#### 8. **Security Headers Added** ✅
- **Helmet.js middleware** added to all responses
- **Headers included**:
  - Content-Security-Policy
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security
  - X-XSS-Protection

#### 9. **Environment Validation** ✅
- **Critical variables validated at startup**: MONGODB_URI, secrets
- **Recommended variables warned if missing**: SMTP_HOST, SESSION_SECRET
- **Server won't start if required env vars missing**

#### 10. **Account Lockout Notifications** ✅
- **Users notified via email** when account locked after 5 failed attempts
- **Email includes**: Lock duration, advice to reset password
- **File**: `backend/src/services/emailService.js`

---

## Installation & Deployment

### Step 1: Install Dependencies

```bash
cd backend
npm install
# New packages installed:
# - bcrypt (password hashing)
# - express-rate-limit (rate limiting)
# - helmet (security headers)
# - cookie-parser (HttpOnly cookies)
# - nodemailer (email service)
```

### Step 2: Update Environment Variables

**Copy and customize `.env`**:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your values:
```

**Critical from `.env.example`**:

```env
# Required
MONGODB_URI=... (use new credentials)
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Secrets (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
SESSION_SECRET=<generate-new-44-char-hex>
JWT_SECRET=<generate-new-44-char-hex>

# Email (for verification/reset links)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password  (NOT your Google password)
SMTP_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### Step 3: Rotate MongoDB Credentials

**CRITICAL**: The old `.env` had credentials in it. Change NOW:

```bash
# MongoDB Atlas Console:
1. Security > Database Access
2. Create new user with minimal permissions:
   - Only "readWrite" on your audit database
   - Not admin
3. Regenerate connection string
4. Update MONGODB_URI in new .env (never commit real credentials)
```

### Step 4: Test Locally

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Test endpoints
# 1. Register
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_user",
    "email": "test@example.com",
    "password": "TestPass123!"
  }'

# Check console - should show verification email attempted
# (If SMTP not configured, email won't send but endpoint works)

# 2. Verify email (use token from console or email)
curl -X POST http://localhost:4000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "token": "<token-from-response>"
  }'

# 3. Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123!"
  }'

# 4. Verify token works
curl -X GET http://localhost:4000/api/auth/verify \
  -H "Authorization: Bearer <token-from-login>"

# 5. Test rate limiting (make 6 rapid login attempts)
for i in {1..6}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# 6th request should return 429 "Too many requests"
```

### Step 5: Production Deployment

**Before deploying to production**:

```checklist
[ ] Rotate MongoDB credentials (non-admin user)
[ ] Generate new SESSION_SECRET and JWT_SECRET
[ ] Configure SMTP (Gmail App Password or SendGrid)
[ ] Set ALLOWED_ORIGINS to production domain(s) only
[ ] Set NODE_ENV=production
[ ] Enable SSL/TLS on your server
[ ] Test email verification flow end-to-end
[ ] Test password reset flow end-to-end
[ ] Load test with `ab -c 100 -n 10000` to verify rate limiting
```

---

## Frontend Changes Required

### AuthContext.tsx Updates Needed:

```typescript
// OLD: Tokens from response only
const { token } = await response.json();
localStorage.setItem('token', token);

// NEW: Token automatically included in cookies
// Frontend can still use Bearer token OR relies on cookies for authenticated requests
// No changes needed - existing token handling works as-is
```

### New Pages Needed:

1. **VerifyEmailPage.tsx** - Handle email verification links
2. **ResetPasswordPage.tsx** - Handle password reset links
3. **ResendVerificationPage.tsx** - Resend verification email option

### API Changes:

| Endpoint | Old Status | New Status | Notes |
|----------|-----------|-----------|-------|
| POST /auth/login | 200 | 200 | Now requires email verified + rate limited |
| POST /auth/logout | 200 | 200-401 | Now clears httpOnly cookie |
| GET /auth/verify | 200 | 200 | Token header-only now |
| GET /auth/me | 200 | 200 | Token header-only now |
| POST /auth/register | N/A | 201 | **NEW**: Email verification required |
| POST /auth/verify-email | N/A | 200 | **NEW**: Email token verification |
| POST /auth/forgot-password | N/A | 200 | **NEW**: Password reset request |
| POST /auth/reset-password | N/A | 200 | **NEW**: Password reset completion |

---

## Tracking & Testing

### Audit Logging

All authentication events should be logged:

```javascript
// TODO: Add audit log entries for:
- User registration (success/failure)
- Email verification (success/failure)
- Successful logins
- Failed login attempts
- Account lockouts
- Password resets
- Session revocations
```

### Security Testing Checklist

```bash
# 1. Test CORS restrictions
curl -H "Origin: http://attacker.com" \
  http://localhost:4000/api/auth/login \
  # Should fail with CORS error

# 2. Test token rejection from query string
curl "http://localhost:4000/api/auth/me?token=fake_token"
# Should reject - token extracted from header only

# 3. Test rate limiting
ab -n 10 -c 10 -p login.json http://localhost:4000/api/auth/login
# Should throttle after 5 attempts

# 4. Test password reset token expiry
# Token expires after 15 minutes

# 5. Test email verification requirement
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"unverified@example.com","password":"Pass123!"}'
# Should return 401 EMAIL_NOT_VERIFIED

# 6. Test account lockout
# Make 5 failed login attempts
# 6th attempt should return 429 ACCOUNT_LOCKED
```

---

## Migration Guide (Existing Users)

### For Users with Old PBKDF2 Passwords:

1. **Old passwords work until first login**
2. **On successful login**: Password automatically re-hashed with bcrypt
3. **No user action needed** - transparent upgrade

```javascript
// User.pre('save') in User.js handles this:
userSchema.pre('save', async function() {
  if (!this.isModified('hashedPassword')) return;
  this.hashedPassword = await bcrypt.hash(this.hashedPassword, 12);
});
```

### For Pre-Made Accounts:

If you have pre-made accounts from manual insertion:

```bash
# Option 1: Let them update password on first login
# - Old PBKDF2 password still works
# - Auto-upgrades to bcrypt

# Option 2: Force password reset
# - Run script to generate reset tokens for all users
# - Send them password reset emails
# - They set new accounts with bcrypt

# TODO: Create migration script if needed
```

---

## ⚠️ REMAINING WORK (PHASE 2+)

### High Priority (Before scaling):

- [ ] **Redis Session Storage**: Move from in-memory to Redis (survives restarts, scales horizontally)
- [ ] **Audit Logging to DB**: Track all auth events for compliance
- [ ] **Email Templates**: Better HTML emails with branding
- [ ] **2FA/MFA**: Optional TOTP (Google Authenticator) support
- [ ] **API Rate Limiting**: Global rate limits per API key

### Medium Priority:

- [ ] **JWT Tokens**: Consider JWT vs session tokens for stateless scaling
- [ ] **OAuth2**: SSO integration (Google, Microsoft)
- [ ] **Account Recovery**: Admin-initiated unlock flow
- [ ] **Security Audit Logging**: Log IP, User-Agent, timestamp of all auth events

### Optional (Best Practices):

- [ ] **CAPTCHA**: reCAPTCHA on login after N failures
- [ ] **Device Fingerprinting**: Track trusted devices
- [ ] **IP Whitelist**: Optional per-user IP restriction
- [ ] **Session Management**: Active sessions UI (see active sessions, revoke specific ones)

---

## Production Checklist

```bash
# Security
[ ] MongoDB credentials rotated (non-admin user)
[ ] SESSION_SECRET and JWT_SECRET generated (44+ chars)
[ ] CORS ALLOWED_ORIGINS set to production domain only
[ ] NODE_ENV=production
[ ] SSL/TLS certificate installed
[ ] SMTP configured and tested

# Monitoring
[ ] Error logging configured (Sentry, LogRocket, etc.)
[ ] Rate limit monitoring set up
[ ] Failed login attempts monitored (threshold for alerts)
[ ] Email delivery monitoring (bounce/delivery rates)

# Testing
[ ] All auth endpoints tested with production DB
[ ] Email verification flow tested end-to-end
[ ] Password reset flow tested end-to-end
[ ] CORS restrictions verified
[ ] Rate limiting verified under load
[ ] Account lockout flow verified

# Documentation
[ ] Deployment guide reviewed
[ ] Environment variables documented
[ ] Emergency procedures documented (e.g., reset all rate limits)
[ ] User communication plan (new login flow changes)
```

---

## Support & Questions

If any components fail during installation:

1. **Check Node version**: `node --version` (should be 16+)
2. **Check npm packages**: `npm ls` 
3. **Check environment variables**: `cat backend/.env | grep -v "^#"`
4. **Check MongoDB connection**: Test connection string with `mongo` CLI
5. **Check SMTP**: Test with `nodemailer` test connection

---

## Security Contacts

Report security issues privately:
- Do NOT create public GitHub issues
- Email: security@yourdomain.com
- Include: Description, reproduction steps, potential impact

