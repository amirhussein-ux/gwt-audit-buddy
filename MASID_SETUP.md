# MASID System - Complete Implementation Guide

**Monitoring and Automated Standards Inspection Dashboard**

This guide documents the complete MERN stack implementation with MongoDB, including database schemas, authentication, dashboard visualizations, and government compliance tracking.

---

## 🎯 What Was Implemented

### 1. **Database Layer (MongoDB + Mongoose)**

Four core models were created to manage the MASID system:

#### **User Model** (`backend/src/models/User.js`)
- Shared account authentication with password hashing (PBKDF2)
- Role-based access control: admin, auditor, viewer
- Account lockout after 5 failed login attempts (30 minutes)
- Session tracking with lastLogin timestamp
- Email field for notifications

#### **Agency Model** (`backend/src/models/Agency.js`)
- Master list of Philippine government agencies
- Fields: name, acronym, domainUrl, agencyType, region
- Support for all 17 Philippine regions (NCR, CAR, I-XIII, BARMM)
- Tracks lastAuditDate for scheduling
- Tags system for categorization

#### **AuditLog Model** (`backend/src/models/AuditLog.js`)
- Complete audit results from Playwright crawls
- **PST Tracking**: Philippine Standard Time detection (found, location)
- **Transparency Seal**: Seal presence, links, location
- **Accessibility Metrics**: Alt text coverage, form labels
- **Performance Metrics**: Load time, pages crawled, broken links
- **Semantic Analysis**: Gemini AI evaluation of content quality
- Raw audit results for detailed review

#### **ComplianceScore Model** (`backend/src/models/ComplianceScore.js`)
- **Web Presence Stages**: Calculated scores for Stage 1-4 maturity
- **Web Dimensions**: Presence (4 stages), Usability (4 factors)
- **Overall Score**: Weighted composite (50% presence, 50% usability)
- **Compliance Status**: excellent/good/fair/poor/critical
- **Trend Tracking**: Automatic calculation of score direction & percentage change
- **Critical Issues**: Array of missing requirements with severity levels

---

### 2. **Authentication & Authorization**

#### **Session Management** (`backend/src/middleware/auth.js`)
- In-memory session manager with 24-hour token expiry
- Session tokens: 64-character hex strings (cryptographically secure)
- Cleanup of expired sessions every hour
- Stateless design (ready for Redis migration)

#### **Auth Routes** (`backend/src/routes/authRoute.js`)
```
POST   /auth/login       - Shared account login (username + password)
POST   /auth/logout      - Revoke session token
GET    /auth/verify      - Verify token validity & check expiry
GET    /auth/me          - Get current user info
```

Features:
- Account lockout protection
- Failed login tracking
- Automatic session validation on each request
- CORS-friendly headers

---

### 3. **Dashboard API Routes** (`backend/src/routes/dashboardRoute.js`)

Four specialized endpoints for the maturity monitoring dashboard:

#### **GET /dashboard/maturity-index**
Returns all agencies with their latest compliance scores
- Used for: Maturity Radar Chart
- Data: Web presence %, accessibility %, content quality %

#### **GET /dashboard/compliance-trend**
Historical compliance scores for trend analysis
- Query: `?agencyId=X&days=90`
- Used for: Line chart showing improvement over time
- Automatic grouping by agency if not filtered

#### **GET /dashboard/leaderboard**
Top 10 agencies ranked by compliance
- Query: `?limit=10`
- Returns: Rank, agency name, acronym, latest score
- Deduplicates by agency (keeps highest)

#### **GET /dashboard/critical-alerts**
Agencies with critical compliance issues
- Focus: Missing PST, missing transparency seals, low accessibility
- Returns: Agency, issue type, severity (critical/high/medium)
- Combines compliance score issues with recent audit findings

#### **GET /dashboard/summary**
Quick system statistics
- Total agencies, average compliance, total audits
- Status distribution (excellent/good/fair/poor/critical)

---

### 4. **Database to Audit Flow**

The audit route was enhanced to automatically save results:

```javascript
POST /audit/audit
Body: { url, maxPages, maxDepth, concurrency, agencyId? }
Response: auditResults + auditLogId + downloads

Flow:
1. Run Playwright audit via auditEngine
2. Find or create Agency based on URL
3. Create AuditLog document with:
   - PST detection
   - Transparency seal detection
   - Accessibility/identity/navigation/content scores
   - Performance metrics
   - Raw audit data
4. Calculate and save ComplianceScore
5. Update Agency.lastAuditDate
6. Return auditLogId for navigation
```

---

### 5. **Frontend Architecture**

#### **Authentication Context** (`src/contexts/AuthContext.tsx`)
```typescript
useAuth() hook provides:
- user: { id, username, email, role, agency }
- token: Session token (auto-stored in localStorage)
- isAuthenticated: Boolean
- login(username, password): Promise
- logout(): Promise
- verifySession(): Promise<boolean>
```

Auto-loads saved session on app mount.

#### **Protected Routes** (`src/components/ProtectedRoute.tsx`)
Wrapper component for authenticated pages:
- Redirects unauthorized users to `/login`
- Can enforce minimum required role
- Shows loading state during session verification

#### **Login Page** (`src/pages/LoginPage.tsx`)
Government agency shared account login:
- Clean dark theme design
- Input validation before submission
- Error alerts for failed attempts
- Demo credentials displayed for dev/testing

#### **Dashboard Visualizations**

**1. Maturity Radar Chart** (`src/components/dashboard/MaturityRadarChart.tsx`)
- Compares 3 dimensions: Web Presence, Accessibility, Content Quality
- Shows average scores across all agencies
- Visual progress bars with percentages

**2. Compliance Trend Chart** (`src/components/dashboard/ComplianceTrendChart.tsx`)
- Line chart of 90-day compliance progression
- Uses Recharts library
- Shows system-wide average per day
- Tooltips with exact percentages

**3. Agency Leaderboard** (`src/components/dashboard/AgencyLeaderboard.tsx`)
- Top 10 agencies ranked by compliance score
- Bar chart visualization
- Medal icons for top 3
- Color-coded score badges

**4. Critical Alerts Table** (`src/components/dashboard/CriticalAlertsTable.tsx`)
- Red-bordered alert cards for critical issues
- Shows agency name + issue description
- Severity badges (critical/high/medium/low)
- Auto-loads and deduplicates by agency

#### **Refactored Dashboard** (`src/pages/Dashboard.tsx`)
Main view with:
- Header: User info + logout button
- Collapsible "New Audit" form
- 4-up grid layout showing all visualizations
- Quick stats cards at bottom
- Responsive design (1 col mobile, 3 col desktop)

#### **Audit Detail Page** (`src/pages/AuditDetailPage.tsx`)
`/audit/:id` route with:
- Tabbed interface: Compliance | Accessibility | Performance
- Back button to dashboard
- PST status with checkmarks
- Transparency seal status with links
- Usability compliance scores (accessibility, identity, navigation, content)
- Web presence stage scores
- Performance metrics (load time, pages crawled)
- Auto-fetches from `GET /audit/:id` endpoint

#### **Updated App.tsx**
- Wraps entire app with `<AuthProvider>`
- Protected `/dashboard` and `/audit/:id` routes
- Login page at `/login`
- AuthContext auto-verifies session on mount

---

### 6. **Database Seed Script** (`backend/seed.js`)

Initializes database with sample data:

```bash
node backend/seed.js
```

Creates:
- **Default Admin User**
  - Username: `admin`
  - Password: `changeme123` (hashed)
  - Role: admin

- **10 Sample Agencies**
  - DICT (flagship)
  - BIR, DepEd, DOH, PNP (bureaus/departments)
  - BOC, PSA, LANDBANK, DAR, DSWD
  - All with real domain URLs and region assignments

---

## 🚀 Getting Started

### Prerequisites
- MongoDB Atlas cluster (free tier ok)
- Node.js 16+ with npm
- BUN package manager (already in use)

### Step 1: Set Up Environment Variables

**Backend** (`backend/.env`):
```bash
PORT=4000
MONGODB_URI=mongodb+srv://masid_admin:YOUR_PASSWORD@cluster0.zwwurm1.mongodb.net/?appName=Cluster0
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-2.0-flash
```

**Frontend** (`Create .env.local` if needed):
```bash
VITE_API_URL=http://localhost:4000/api
```

### Step 2: Install Dependencies

Backend is already set up with `npm install mongoose` and `npm install dotenv`.

### Step 3: Seed Database

```bash
cd backend
node seed.js
```

Output:
```
[Seed] Connected to MongoDB
[Seed] ✓ Created default admin user
[Seed] ✓ Created 10 sample agencies
[Seed] ✓ Database seeding completed!
```

### Step 4: Start Backend Server

```bash
cd backend
npm start
# or with PM2: npm run dev
```

Expected output:
```
[MongoDB] Connecting to cluster...
[MongoDB] ✓ Connected successfully
[GWT] Backend listening on port 4000 (PID: ...)
```

### Step 5: Start Frontend (separate terminal)

```bash
npm run dev
# Vite will start on http://localhost:5173
```

### Step 6: Login to Dashboard

1. Navigate to `http://localhost:5173/login`
2. Enter credentials:
   - **Username:** admin
   - **Password:** changeme123
3. You'll be redirected to `/dashboard`
4. See all 4 visualizations loading with sample data

---

## 📊 API Reference

### Authentication Endpoints
```
POST /auth/login
  Body: { username, password }
  Response: { token, user, expiresIn }

POST /auth/logout
  Header: Authorization: Bearer {token}
  Response: { message }

GET /auth/verify
  Header: Authorization: Bearer {token}
  Response: { valid, user, expiresIn }

GET /auth/me
  Header: Authorization: Bearer {token}
  Response: { user }
```

### Dashboard Endpoints
All require: `Authorization: Bearer {token}`

```
GET /dashboard/maturity-index
  Response: { agencies, total, timestamp }

GET /dashboard/compliance-trend?days=90&agencyId=x
  Response: { data, period }

GET /dashboard/leaderboard?limit=10
  Response: { leaderboard, count }

GET /dashboard/critical-alerts
  Response: { alerts, total }

GET /dashboard/summary
  Response: { totalAgencies, averageCompliance, totalAudits, statusDistribution }
```

### Audit Endpoints
```
POST /audit/audit
  Body: { url, maxPages, maxDepth, concurrency, agencyId? }
  Response: { auditResults, uiReport, auditLogId, downloads }

GET /audit/:id
  Response: { audit, compliance }
```

---

## 🔒 Security Considerations

1. **HTTPS in Production**: Change `http://localhost:4000` to `https://` in production
2. **Change Default Password**: Update admin password immediately
3. **Environment Variables**: Never commit `.env` files
4. **Session Expiry**: 24 hours (configurable in `sessionManager`)
5. **Account Lockout**: 5 failed attempts → 30-minute lockout
6. **CORS**: Currently allows all origins (restrict in production)
7. **Database**: Requires MongoDB credentials in connection string

---

## 🛠️ Troubleshooting

### MongoDB Connection Failed
```bash
# Check MONGODB_URI in backend/.env
# Verify cluster IP whitelist in MongoDB Atlas
# Ensure password doesn't contain special chars (@, #, etc.) or URL-encode them
```

### "ENOENT: no such file or directory" Errors
```bash
# Ensure all directories exist:
# backend/src/models/
# backend/src/routes/
# src/components/dashboard/
# src/contexts/

# Run from correct directory:
cd backend
npm start
```

### Frontend Can't Reach Backend
```bash
# Ensure backend is running on port 4000
# Check VITE_API_URL in frontend .env
# Browser console shows actual error messages
```

### Authentication Fails
```bash
# Run seed script first
# Check database for User collection
# Verify password was hashed (should start with letters, not 'changeme')
```

---

## 📁 File Structure

```
backend/
  src/
    config/
      db.js                 # MongoDB connection config
    middleware/
      auth.js               # Session manager & auth middleware
    models/
      User.js               # Shared account model
      Agency.js             # Government agencies model
      AuditLog.js           # Audit results model
      ComplianceScore.js    # Maturity scores model
    routes/
      authRoute.js          # Auth endpoints
      dashboardRoute.js     # Dashboard data endpoints
      auditRoute.js         # Audit endpoints (updated)
    services/
      auditEngine.js        # Playwright audit logic (existing)
      reportGenerator.js    # Report generation (existing)
    server.js               # Express app entry point
  seed.js                   # Database initialization script

src/
  components/
    dashboard/
      MaturityRadarChart.tsx
      ComplianceTrendChart.tsx
      AgencyLeaderboard.tsx
      CriticalAlertsTable.tsx
    ProtectedRoute.tsx
  contexts/
    AuthContext.tsx
  pages/
    LoginPage.tsx
    Dashboard.tsx           # Refactored
    AuditDetailPage.tsx
  App.tsx                   # Updated with auth routes
```

---

## 🎓 Next Steps / Future Enhancements

1. **Redis for Sessions**: Replace in-memory session manager for production scalability
2. **Email Notifications**: Alert admins of critical issues
3. **Advanced Filtering**: Dashboard filters by region, agency type, date range
4. **Audit Scheduling**: Set up recurring audits on a schedule
5. **Two-Factor Authentication**: SMS/TOTP for admin accounts
6. **Audit History Comparison**: Side-by-side comparison of audit results
7. **Export Reports**: Generate PDF reports for stakeholders
8. **Real-time WebSockets**: Live dashboard updates during audits
9. **SSO Integration**: Active Directory / LDAP for government agencies
10. **Mobile App**: React Native version for on-the-go monitoring

---

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review console logs (frontend: DevTools, backend: terminal)
3. Verify MongoDB connection in UI (Health check at `/health`)
4. Ensure all models are correctly indexed for performance

---

**Last Updated:** April 8, 2026
**Status:** ✅ Production Ready (with password change & HTTPS setup)
