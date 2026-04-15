# GWT Audit Buddy - Backend API Security Inventory

**Date:** April 15, 2026  
**Scope:** Complete backend API routes, database queries, and authorization checks

---

## Executive Summary

### Key Findings:
- **Total API Endpoints:** 18 (8 public, 10 protected)
- **Critical Issues:** 1 IDOR vulnerability pattern
- **Missing Ownership Checks:** 3 endpoints
- **Database Collections Used:** 4 (User, Agency, AuditLog, ComplianceScore)
- **Authentication:** Session-based (in-memory tokens, 24-hour expiry)
- **Authorization:** Role-based (admin, auditor, viewer)

---

## API Endpoints Inventory

### 1. Authentication Routes (`/api/auth`)
**File:** [backend/src/routes/authRoute.js](backend/src/routes/authRoute.js)  
**Authentication Required:** Varies by endpoint  
**Database Models Used:** User

#### 1.1 POST /auth/login
- **Line:** [109](backend/src/routes/authRoute.js#L109)
- **Authentication:** ❌ Not required
- **Rate Limiting:** ✅ Yes (5 requests/15 minutes)
- **Methods:** Email/password authentication
- **Database Query:** `User.findOne({ email, isActive: true }).select('+hashedPassword')`
- **User ID Extraction:** Via email lookup, password verified with bcrypt
- **Authorization Checks:** 
  - Email verification required
  - Account lockout after 5 failed attempts (30-minute duration)
- **Response:** Returns JWT token + user object

**Potential IDOR Issues:** None (email-based lookup, intentionally open)

---

#### 1.2 POST /auth/verify-email
- **Line:** [199](backend/src/routes/authRoute.js#L199)
- **Authentication:** ❌ Not required
- **Rate Limiting:** ❌ No
- **Parameters:** `email`, `token` (from request body)
- **Database Query:** `User.findOne({ email }).select('+emailVerificationToken +emailVerificationTokenExpires')`
- **Authorization Checks:** Token verification via `user.verifyEmailToken(token)`
- **Response:** User object if verified

**Potential IDOR Issues:** ⚠️ **YES** - No rate limiting on email verification. Email address in body could be enumerated.

---

#### 1.3 POST /auth/resend-verification
- **Line:** [244](backend/src/routes/authRoute.js#L244)
- **Authentication:** ❌ Not required
- **Rate Limiting:** ❌ No
- **Parameters:** `email` (from request body)
- **Database Query:** `User.findOne({ email })`
- **Authorization Checks:** Checks if email is verified
- **Response:** Generic message (doesn't reveal if email exists)

**Potential Issues:** ⚠️ Information leak - Response is generic but endpoint validates email existence silently

---

#### 1.4 POST /auth/logout
- **Line:** [295](backend/src/routes/authRoute.js#L295)
- **Authentication:** ✅ Required (reads from Authorization header)
- **Rate Limiting:** ❌ No
- **Methods:** Revokes session token
- **Database Query:** None (in-memory session revocation)
- **Authorization Checks:** Token extraction from header

---

#### 1.5 POST /auth/forgot-password
- **Line:** [325](backend/src/routes/authRoute.js#L325)
- **Authentication:** ❌ Not required
- **Rate Limiting:** ✅ Yes (3 requests/15 minutes)
- **Parameters:** `email`
- **Database Query:** `User.findOne({ email })`
- **Authorization Checks:** Token generation + email notification
- **Response:** Generic message (doesn't reveal if email exists)

---

#### 1.6 POST /auth/reset-password
- **Line:** [370](backend/src/routes/authRoute.js#L370)
- **Authentication:** ❌ Not required (token-based instead)
- **Rate Limiting:** ❌ No
- **Parameters:** `email`, `token`, `password`
- **Database Query:** `User.findOne({ email }).select('+passwordResetToken +passwordResetTokenExpires')`
- **Authorization Checks:** Token validity via `user.isPasswordResetTokenValid(token)` (15-minute expiry)

**Potential Issues:** ⚠️ No rate limiting. Could attempt to reset password repeatedly with brute force.

---

#### 1.7 GET /auth/verify
- **Line:** [417](backend/src/routes/authRoute.js#L417)
- **Authentication:** ❌ Not required (reads Authorization header)
- **Rate Limiting:** ❌ No
- **Methods:** Token validation
- **Database Query:** None (in-memory session lookup)
- **Response:** Token validity status + expiry time

**Potential Issues:** ⚠️ Could be used to enumerate valid tokens (timing side-channel)

---

#### 1.8 GET /auth/me
- **Line:** [458](backend/src/routes/authRoute.js#L458)
- **Authentication:** ✅ Required (reads Authorization header)
- **Rate Limiting:** ❌ No
- **Methods:** Retrieve current user profile
- **Database Query:** `User.findById(session.userId).select('-hashedPassword')`
- **User ID Extraction:** ✅ From validated session (session.userId)
- **Authorization Checks:** Session must be valid and not expired

**Potential Issues:** ✅ No IDOR - user ID is tied to valid session

---

### 2. Audit Routes (`/api/audit`)
**File:** [backend/src/routes/auditRoute.js](backend/src/routes/auditRoute.js)  
**Authentication Required:** All endpoints ✅  
**Database Models Used:** AuditLog, Agency, ComplianceScore

#### 2.1 GET /audit
- **Line:** [119](backend/src/routes/auditRoute.js#L119)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** List all audits
- **Query Parameters:** `skip`, `limit`, `status`
- **Database Queries:**
  - `AuditLog.find(query).populate('agency', 'name acronym domainUrl region').sort({ createdAt: -1 }).skip().limit().lean()`
  - `AuditLog.countDocuments(query)`
- **Authorization Checks:** Authentication only, no ownership check
- **Response:** Returns paginated audit list for all audits

**Potential Issues:** ❌ **No user ownership filtering** - All authenticated users see all audits

---

#### 2.2 POST /audit (Start New Audit)
- **Line:** [155](backend/src/routes/auditRoute.js#L155)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** POST body: `url`, `maxPages`, `maxDepth`, `concurrency`, `agencyId` (optional)
- **Database Queries:**
  - `Agency.findById(agencyId)` if agencyId provided
  - `Agency.findOne({ domainUrl: parsedUrl.origin })` for auto-matching
  - `Agency.create({ ... })` if auto-discovery enabled
  - `AuditLog.save()`
  - Background: `AuditLog.findByIdAndUpdate()` to store results
  - `ComplianceScore.save()` for results
  - `agency.save()` to update lastAuditDate
- **User ID Extraction:** Authenticated user context but not stored in AuditLog
- **Authorization Checks:** Authentication only

**Potential Issues:** 
- ❌ **No user ownership tracking** - User who runs audit not recorded
- ❌ **Auto-agency creation** - Any authenticated user can trigger creation of new agencies
- ❌ **No rate limiting on audit runs** - Could DOS analysis engine

---

#### 2.3 GET /audit/:id
- **Line:** [409](backend/src/routes/auditRoute.js#L409)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** Retrieve specific audit with full details
- **URL Parameter:** `id` (AuditLog._id)
- **Database Queries:**
  - `AuditLog.findById(id).populate('agency', 'name acronym domainUrl region').lean()`
  - `ComplianceScore.findOne({ auditLog: id }).lean()`
- **Authorization Checks:** Authentication only, **NO ownership check**
- **Response:** Full audit details including all check results

**SQL Injection Risk:** ✅ None (ObjectID validation automatic in Mongoose)

**⚠️ CRITICAL IDOR VULNERABILITY:**
```
GET /api/audit/507f1f77bcf86cd799439001
- Any authenticated user can request any audit by ID
- No check if user owns/created the audit
- Returns full audit details and compliance scores
```

---

#### 2.4 GET /audit/:id/download/excel
- **Line:** [454](backend/src/routes/auditRoute.js#L454)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** Download audit report as Excel file
- **URL Parameter:** `id` (AuditLog._id)
- **Database Query:** `AuditLog.findById(id).lean()`
- **Authorization Checks:** Authentication only, **NO ownership check**
- **Response:** Excel file buffer with content-disposition

**⚠️ CRITICAL IDOR VULNERABILITY:**
```
GET /api/audit/507f1f77bcf86cd799439001/download/excel
- Same IDOR issue as GET /audit/:id
- Any authenticated user can download any audit's Excel report
- Reports may contain sensitive compliance data
```

---

#### 2.5 GET /audit/:id/download/pdf
- **Line:** [487](backend/src/routes/auditRoute.js#L487)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** Download audit report as PDF file
- **URL Parameter:** `id` (AuditLog._id)
- **Database Query:** `AuditLog.findById(id).lean()`
- **Authorization Checks:** Authentication only, **NO ownership check**
- **Response:** PDF file buffer with content-disposition

**⚠️ CRITICAL IDOR VULNERABILITY:**
```
GET /api/audit/507f1f77bcf86cd799439001/download/pdf
- Same IDOR issue as GET /audit/:id
- Any authenticated user can download any audit's PDF report
```

---

### 3. Dashboard Routes (`/api/dashboard`)
**File:** [backend/src/routes/dashboardRoute.js](backend/src/routes/dashboardRoute.js)  
**Authentication Required:** All endpoints ✅  
**Database Models Used:** Agency, ComplianceScore, AuditLog  

#### 3.1 GET /dashboard/maturity-index
- **Line:** [14](backend/src/routes/dashboardRoute.js#L14)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** Get all active agencies with latest compliance scores
- **Database Queries:**
  - `Agency.find({ isActive: true }).lean()`
  - For each agency: `ComplianceScore.findOne({ agency: [id] }).sort({ createdAt: -1 }).lean()`
- **Authorization Checks:** Authentication only
- **Response:** Returns all agencies with scores (no filtering)

**Intended Use:** Public dashboard, but no role-based filtering

**Data Exposure:** ✅ All compliance data visible to any authenticated user (including viewers)

---

#### 3.2 GET /dashboard/compliance-trend
- **Line:** [50](backend/src/routes/dashboardRoute.js#L50)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Query Parameters:** `agencyId` (optional), `days` (default: 90)
- **Methods:** Historical compliance scores for trend analysis
- **Database Query:**
  ```mongodb
  ComplianceScore.find({
    createdAt: { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) },
    agency: agencyId (if provided)
  }).select('agency overallScore webPresence webUsability createdAt').sort({ createdAt: 1 }).lean()
  ```
- **Authorization Checks:** None
- **Response:** Time-series compliance data

**Potential Issues:** ❌ No ownership/agency-level filtering

---

#### 3.3 GET /dashboard/leaderboard
- **Line:** [105](backend/src/routes/dashboardRoute.js#L105)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Query Parameters:** `limit` (default: 10)
- **Methods:** Top N agencies by compliance score
- **Database Query:**
  ```mongodb
  ComplianceScore.find()
    .sort({ overallScore: -1, createdAt: -1 })
    .limit(10)
    .populate('agency', 'name acronym agencyType region domainUrl')
    .lean()
  ```
- **Authorization Checks:** None
- **Response:** Ranked list of top agencies

**Data Integrity:** ✅ Deduplicates agencies (keeps highest score per agency)

---

#### 3.4 GET /dashboard/critical-alerts
- **Line:** [149](backend/src/routes/dashboardRoute.js#L149)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** Agencies with critical compliance issues
- **Database Queries:**
  - `ComplianceScore.find({ 'criticalIssues.severity': { $in: ['critical', 'high'] } })`
  - `AuditLog.find().select('agency pst transparencySeal').sort({ createdAt: -1 }).lean()`
- **Authorization Checks:** None
- **Response:** List of agencies with critical issues

---

#### 3.5 GET /dashboard/summary
- **Line:** [220](backend/src/routes/dashboardRoute.js#L220)
- **Authentication:** ✅ Required
- **Rate Limiting:** ❌ No
- **Methods:** Aggregate dashboard statistics
- **Database Queries:**
  - `Agency.countDocuments({ isActive: true })`
  - `ComplianceScore.find().select('overallScore').lean()` → calculates average
  - `AuditLog.countDocuments()`
  - `ComplianceScore.find().select('complianceStatus').lean()` → groups by status
- **Authorization Checks:** None
- **Response:** Summary statistics

**Potential Abuse:** Statistics could be used to infer data about the audit system

---

## Database Models & Collections

### Collection 1: User
**File:** [backend/src/models/User.js](backend/src/models/User.js)

**Schema:**
```javascript
{
  username: String (unique, required, 3+ chars),
  email: String (unique, required, validated),
  hashedPassword: String (select: false, not returned by default),
  role: String (enum: admin, auditor, viewer),
  agency: ObjectId (ref: Agency),
  isActive: Boolean,
  isEmailVerified: Boolean,
  emailVerificationToken: String (select: false),
  emailVerificationTokenExpires: Date (select: false),
  passwordResetToken: String (select: false),
  passwordResetTokenExpires: Date (select: false),
  lastLogin: Date,
  loginAttempts: Number,
  lockUntil: Date (account lockout after 5 failed attempts)
}
```

**Indexes:** 
- email (unique)
- username (unique)

**Security Features:**
- ✅ Passwords hashed with bcrypt (cost factor: 12)
- ✅ Account lockout after 5 failed attempts (30-minute duration)
- ✅ Email verification required before login
- ✅ Password reset tokens expire in 15 minutes
- ✅ Email verification tokens expire in 24 hours

---

### Collection 2: Agency
**File:** [backend/src/models/Agency.js](backend/src/models/Agency.js)

**Schema:**
```javascript
{
  name: String (required),
  acronym: String (uppercase),
  domainUrl: String (required, required to start with http/https, unique),
  agencyType: String (enum: national_bureau, national_department, sub_agency, regional_office, local_government, other),
  region: String (enum: NCR, CAR, I-XIII, BARMM, National),
  headEmail: String,
  headPhone: String,
  notes: String,
  isActive: Boolean,
  lastAuditDate: Date,
  tags: [String]
}
```

**Indexes:**
- domainUrl (unique)
- region + agencyType (compound)
- isActive + lastAuditDate

**Critical Issue:** ⚠️ **Auto-creation of agencies**
- When POST /audit is called with new URL → new Agency created automatically
- Any authenticated user can create agencies
- No validation of actual government status

---

### Collection 3: AuditLog
**File:** [backend/src/models/AuditLog.js](backend/src/models/AuditLog.js)

**Schema:**
```javascript
{
  agency: ObjectId (ref: Agency),
  auditUrl: String (required - the crawled URL),
  status: String (enum: in_progress, success, partial, failed),
  pst: { found, location, format },
  transparencySeal: { found, link, location },
  citizensCharter: { found, link },
  masthead: { aboutUs, contactUs, home },
  accessibility: { altTextCoverage, formLabels },
  performance: { loadTimeMs, pagesCrawled, brokenLinks },
  auditResults: { checks: [...], crawlSummary, loadTime, pageAudits, crawledPages },
  uiReport: { webPresence, webUsability },
  crawledPages: [{ url, status, title }],
  auditDurationMs: Number,
  completedAt: Date
}
```

**CRITICAL DATA STRUCTURE ISSUE:** 
- ❌ **No user ownership field** - AuditLog doesn't track who ran the audit
- ❌ **No createdBy field** - Cannot implement per-user access control
- ❌ **No acl/permissions field** - Cannot restrict access

**Indexes:**
- agency (for lookups)

---

### Collection 4: ComplianceScore
**File:** [backend/src/models/ComplianceScore.js](backend/src/models/ComplianceScore.js)

**Schema:**
```javascript
{
  agency: ObjectId (ref: Agency, required),
  webPresence: { stage1-4: 0-100, currentStage: 1-4, averageScore },
  webUsability: { accessibility, identity, navigation, content: 0-100 },
  overallScore: Number (0-100),
  complianceStatus: String (enum: excellent, good, fair, poor, critical),
  criticalIssues: [{ type, severity, description }],
  previousScore: Number,
  trend: String (enum: improving, stable, declining),
  trendPercentage: Number,
  auditLog: ObjectId (ref: AuditLog),
  auditedAt: Date,
  auditedBy: ObjectId (ref: User),
  adjustments: [{ field, originalValue, adjustedValue, reason, adjustedBy, adjustedAt }],
  notes: String
}
```

**Indexes:**
- agency + auditedAt (compound)
- overallScore (for leaderboard sorting)
- complianceStatus
- criticalIssues.severity

**Data Integrity:**
- ✅ Links to agency and audit
- ⚠️ Stores adjustment history with adjustedBy user reference
- ⚠️ No ownership/visibility controls

---

## User ID Extraction Points

### Where User IDs Are Captured:

1. **POST /auth/login** [Line 135, authRoute.js]
   ```javascript
   const user = await User.findOne({ email, isActive: true })
   // User ID extracted from email lookup
   // Stored in session manager as: session.userId
   ```

2. **Session Manager** [auth.js - SessionManager class]
   ```javascript
   createSession(userId, username, role)
   // Stores: { userId, username, role, createdAt, expiresAt, lastActivity }
   // Returned as token (32-byte hex)
   ```

3. **GET /auth/me** [Line 483, authRoute.js]
   ```javascript
   const user = await User.findById(session.userId)
   // Directly from validated session
   ```

### Where User IDs Are NOT Captured:
- ❌ POST /audit (no auditor/creator tracking)
- ❌ GET /audit endpoints (no permission checks)
- ❌ GET /dashboard endpoints (no per-user filtering)

---

## Authorization & Middleware Summary

### Authentication Middleware
**File:** [backend/src/middleware/auth.js](backend/src/middleware/auth.js)

**Middleware Functions:**
1. **authenticate()** - Validates Bearer token or sessionToken cookie
   - Returns 401 if token missing or invalid
   - Attaches `req.user` object with { id, username, role, token }

2. **authorize(allowedRoles)** - Role-based access control
   - Checks if req.user.role is in allowed list
   - Returns 403 if insufficient role
   - **CURRENTLY UNUSED IN CODEBASE** - No routes use authorize middleware

3. **authenticateOptional()** - Non-blocking auth
   - Attaches req.user if token valid
   - Doesn't reject if token missing
   - Not used in current routes

### Role Definitions
- **admin** - Full system access (not enforced)
- **auditor** - Can run audits (not enforced) 
- **viewer** - Read-only (not enforced)

**Status:** ⚠️ **Roles defined but NOT enforced** - No endpoints require specific roles

---

### Rate Limiting
**File:** [backend/src/middleware/rateLimiter.js](backend/src/middleware/rateLimiter.js)

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 5 | 15 min |
| POST /auth/forgot-password | 3 | 15 min |
| POST /auth/reset-password | ❌ None | - |
| POST /auth/verify-email | ❌ None | - |
| GET /audit/:id | ❌ None | - |
| POST /audit | ❌ None | - |
| GET /dashboard/* | ❌ None | - |

**Status:** ⚠️ Most endpoints lack rate limiting

---

## IDOR (Insecure Direct Object Reference) Vulnerabilities

### Critical IDOR Issues Found:

#### **Issue #1: Audit Access Without Ownership Check**
**Severity:** 🔴 CRITICAL

**Affected Endpoints:**
- GET /api/audit/:id [Line 409]
- GET /api/audit/:id/download/excel [Line 454]
- GET /api/audit/:id/download/pdf [Line 487]

**Vulnerability:**
```
Any authenticated user can:
1. Request ANY audit by ID
2. Download ANY audit report (Excel/PDF)
3. Access detailed compliance data for agencies they don't manage
```

**Proof of Concept:**
```bash
# User A obtains an audit ID (from browser DevTools or guessing)
curl -H "Authorization: Bearer USER_B_TOKEN" \
     http://localhost:4000/api/audit/507f1f77bcf86cd799439001

# Response includes full audit details, even if created by User A
# User can then download reports with confidential data
```

**Root Cause:**
- No `createdBy` or `userId` field in AuditLog schema
- Database queries don't filter by user
- No ownership validation in route handlers

**Exploit Impact:**
- 🔴 View confidential government compliance data
- 🔴 Download sensitive audit reports
- 🔴 Enumerate all audits via ID guessing (if sequential IDs used)
- 🔴 Track which agencies are being audited

---

#### **Issue #2: Unfiltered Audit List**
**Severity:** 🟠 HIGH

**Affected Endpoint:**
- GET /api/audit [Line 119]

**Vulnerability:**
```
GET /api/audit?skip=0&limit=50

Returns ALL audits in database to any authenticated user
- No pagination respects user ownership
- Lists all agencies being audited
```

**Exploit Impact:**
- Information disclosure about audit coverage
- Can corroborate with IDOR to target specific audits

---

### Dashboard Data Visibility

**Affected Endpoints:**
- GET /api/dashboard/compliance-trend [Line 50]
- GET /api/dashboard/maturity-index [Line 14]
- GET /api/dashboard/leaderboard [Line 105]

**Issue:** No per-user or per-agency filtering
- All authenticated users see all compliance data
- Cannot restrict viewer to specific agencies
- No tenant isolation for multi-agency users

---

## Direct Database Queries Summary

### Query Execution Flow:

**User Authentication:**
```javascript
// authRoute.js:117
await User.findOne({ email, isActive: true }).select('+hashedPassword')
// Line 135: Password comparison with bcrypt.compare()
```

**Audit Creation:**
```javascript
// auditRoute.js:210-230
// Check/create agency
const agency = await Agency.findOne({ domainUrl })
const newAgency = await Agency.create({ ... })

// Create audit log
new AuditLog({ agency, status: 'in_progress', ... }).save()

// Background processing (auditRoute.js:395)
await AuditLog.findByIdAndUpdate(auditLogId, updateData)
```

**Audit Retrieval:**
```javascript
// auditRoute.js:409 - IDOR VULNERABILITY
await AuditLog.findById(id)
  .populate('agency', 'name acronym domainUrl region')
  .lean()

// No filter on user ownership
// No check if req.user should access this audit
```

**Dashboard Data:**
```javascript
// dashboardRoute.js:16-24
await Agency.find({ isActive: true }).lean()
for each agency:
  await ComplianceScore.findOne({ agency })

// Returns all data without user filtering
```

---

## Session Management

**Implementation:** In-memory session store  
**File:** [backend/src/middleware/auth.js](backend/src/middleware/auth.js#L21-L80)

**Session Structure:**
```javascript
{
  token: String (32-byte hex),
  userId: ObjectId,
  username: String,
  role: String,
  createdAt: Date,
  expiresAt: Date (24 hours),
  lastActivity: Date
}
```

**Cleanup:** Automatic cleanup every 60 minutes

**Security Issues:**
- ⚠️ In-memory store lost on server restart
- ⚠️ No session persistence to database
- ⚠️ No distributed session support (breaks with load balancing)
- ✅ Secure token generation (crypto.randomBytes)
- ✅ HttpOnly cookies + Bearer tokens supported
- ✅ CORS + CSRF protections in place

---

## Environment & Security Configuration

**Validated Environment Variables:**
- ✅ MONGODB_URI (required)
- ⚠️ SESSION_SECRET (optional but recommended)
- ⚠️ JWT_SECRET (optional but recommended)

**Recommended but Missing:**
- SMTP_HOST (for email notifications)
- NODE_ENV (defaults to development)
- ALLOWED_ORIGINS (defaults to localhost:5173)

---

## Recommended Remediation Priority

### 🔴 CRITICAL (Fix Immediately):

1. **Add User Ownership to Audits**
   - Add `createdBy: ObjectId (ref: User)` field to AuditLog
   - Modify POST /audit to store req.user.id
   - Update GET /audit/:id to verify: `audit.createdBy === req.user.id`
   - Update both download endpoints similarly

2. **Enforce Role-Based Access Control**
   - Use `authorize()` middleware on protected routes
   - Enforce auditor role for POST /audit
   - Restrict dashboard access to admin/auditor roles

3. **Rate Limit Audit Operations**
   - Add rate limiting to POST /audit (prevent DOS)
   - Add rate limiting to download endpoints

### 🟠 HIGH (Fix in Next Sprint):

1. **Per-User Dashboard Filtering**
   - Filter audit data by user's assigned agency
   - Implement tenant isolation

2. **Session Persistence**
   - Move sessions to Redis/database for distributed systems
   - Add session invalidation endpoint

3. **Add Agency Ownership to User**
   - Allow users to be associated with specific agencies
   - Enforce agency-level access controls

### 🟡 MEDIUM (Addressing Next):

1. **Add rate limiting to all POST /auth endpoints except login/forgot-password**
2. **Add comprehensive audit logging to AuditLog schema**
3. **Implement proper error handling to prevent information leaks**

---

## Code References - All Endpoints

| Endpoint | File | Line | Auth | Query Collections |
|----------|------|------|------|-------------------|
| POST /auth/login | authRoute.js | 109 | ❌ | User |
| POST /auth/verify-email | authRoute.js | 199 | ❌ | User |
| POST /auth/resend-verification | authRoute.js | 244 | ❌ | User |
| POST /auth/logout | authRoute.js | 295 | ✅ | - |
| POST /auth/forgot-password | authRoute.js | 325 | ❌ | User |
| POST /auth/reset-password | authRoute.js | 370 | ❌ | User |
| GET /auth/verify | authRoute.js | 417 | ❌ | - |
| GET /auth/me | authRoute.js | 458 | ✅ | User |
| GET /audit | auditRoute.js | 119 | ✅ | AuditLog, Agency |
| POST /audit | auditRoute.js | 155 | ✅ | Agency, AuditLog, ComplianceScore |
| GET /audit/:id | auditRoute.js | 409 | ✅ | AuditLog, ComplianceScore |
| GET /audit/:id/download/excel | auditRoute.js | 454 | ✅ | AuditLog |
| GET /audit/:id/download/pdf | auditRoute.js | 487 | ✅ | AuditLog |
| GET /dashboard/maturity-index | dashboardRoute.js | 14 | ✅ | Agency, ComplianceScore |
| GET /dashboard/compliance-trend | dashboardRoute.js | 50 | ✅ | ComplianceScore |
| GET /dashboard/leaderboard | dashboardRoute.js | 105 | ✅ | ComplianceScore, Agency |
| GET /dashboard/critical-alerts | dashboardRoute.js | 149 | ✅ | ComplianceScore, AuditLog, Agency |
| GET /dashboard/summary | dashboardRoute.js | 220 | ✅ | Agency, ComplianceScore, AuditLog |

---

## Conclusion

The backend has a **foundational authentication system** but is missing **critical ownership/access control**. The primary vulnerability is **IDOR on audit endpoints** where any authenticated user can access any audit regardless of who created it.

**Key Action Items:**
1. ✅ Add user ownership tracking to AuditLog
2. ✅ Implement access control checks before returning audit data
3. ✅ Enforce role-based middleware on all protected routes
4. ✅ Add rate limiting to all data-modifying endpoints
