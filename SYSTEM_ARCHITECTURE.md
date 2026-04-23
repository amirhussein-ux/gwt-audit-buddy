# 🏗️ GWT Audit Buddy - Complete System Architecture

**Date:** April 2026  
**Version:** Full-Stack Government Website Audit Tool  
**Stack:** React 18 + TypeScript + Express.js + MongoDB + Playwright

---

## 📋 Executive Summary

GWT Audit Buddy is an automated compliance auditing platform for Philippine government websites. It combines web scraping (Playwright), accessibility testing (Axe-core), and compliance scoring to assess agencies against the DICT Web Governance Framework (4 maturity stages + WCAG accessibility levels).

**Key Features:**
- ✅ Automated web audits with live progress tracking
- ✅ Compliance scoring (DICT framework + WCAG)
- ✅ Agency leaderboard & trend analysis
- ✅ PDF/Excel report generation
- ✅ Multi-user authentication + role-based access
- ✅ Async background audit processing
- ✅ Archive/restore audit trails

---

## 🗂️ COMPLETE FILE TREE WITH DESCRIPTIONS

### Root Configuration Files

```
gwt-audit-buddy/
├── package.json                   # Frontend deps (React, Vite, Tailwind, shadcn/ui, Recharts)
├── vite.config.ts                 # Vite build config (port 8080, @ alias, SWC compiler)
├── tsconfig.json                  # TypeScript config (React JSX, module resolution)
├── tsconfig.app.json              # App-specific TypeScript (ES2020, no conflicting tsconfig)
├── tsconfig.node.json             # Build tool types (Vite, Node)
├── tailwind.config.ts             # Tailwind CSS theming + animation utilities
├── postcss.config.js              # PostCSS plugins (Tailwind, Autoprefixer)
├── eslint.config.js               # ESLint rules (TypeScript, React hooks, refresh)
├── vitest.config.ts               # Vitest setup (jsdom, coverage)
├── playwright.config.ts           # Playwright E2E test config
├── components.json                # shadcn/ui component registry
├── index.html                      # HTML entry point (Vite SPA root)
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
│
├── 📄 DOCUMENTATION (Multiple md files - see list below)
│   ├── README.md                   # Project overview
│   ├── TECH_STACK.md              # Detailed dependencies
│   ├── TESTING_GUIDE.md           # Test execution
│   ├── COMPLIANCE_REPORT_GUIDE.md # Report generation
│   ├── SECURITY_API_INVENTORY.md  # API security audit
│   ├── MASID_SETUP.md             # Implementation details
│   ├── MASID_CHECKLIST.md         # Deployment checklist
│   ├── AUTH_SECURITY_TESTING.md   # Security tests
│   └── [40+ other documentation files]
│
├── 🔧 UTILITY SCRIPTS (Root level)
│   ├── test-audit.cjs              # Basic audit test
│   ├── test-audit-logging.cjs      # Detailed logging test
│   ├── test-audit-raw.cjs          # Raw output test
│   ├── debug-csv-loading.cjs       # CSV parsing debug
│   ├── debug-scoring.cjs           # Scoring algorithm debug
│   ├── test-excel-inspect.cjs      # Excel format inspection
│   ├── verify-checks.cjs           # Verify compliance checks
│   ├── CLEAR_FRONTEND_CACHE.js     # Clear browser cache
│   ├── CLEAR_STUCK_AUDIT.js        # Reset stuck audits
│   └── [more debugging scripts]
│
├── public/                         # Static assets (served on root /)
│   ├── favicon.ico                 # Browser tab icon
│   ├── robots.txt                  # SEO crawling rules
│   └── placeholder.svg             # Image placeholder
│
├── src/                            # 🎨 FRONTEND APPLICATION
│   ├── main.tsx                    # React DOM entry point
│   ├── App.tsx                     # Main router + provider setup
│   ├── index.css                   # Global styles
│   ├── App.css                     # App-specific styles
│   ├── vite-env.d.ts              # Vite type definitions
│   │
│   ├── 📄 pages/                   # Page components (route destinations)
│   │   ├── Index.tsx               # Landing page (hero + CTA)
│   │   ├── LoginPage.tsx           # Authentication page
│   │   ├── Dashboard.tsx           # Main audit runner + analytics
│   │   ├── ResultsPage.tsx         # Audit history/results view
│   │   ├── AuditDetailPage.tsx     # Single audit with full details
│   │   ├── AuditLogPage.tsx        # Audit log listing (searchable)
│   │   ├── ArchivePage.tsx         # Archived audits view
│   │   └── NotFound.tsx            # 404 error page
│   │
│   ├── 🧩 components/              # Reusable UI components
│   │   ├── Header.tsx              # Top navigation bar
│   │   ├── Sidebar.tsx             # Left sidebar navigation
│   │   ├── MainLayout.tsx          # Protected page wrapper
│   │   ├── NavLink.tsx             # Navigation link helper
│   │   ├── ProtectedRoute.tsx      # Auth guard wrapper
│   │   ├── LandingPage.tsx         # Hero section (reused)
│   │   ├── NotificationCenter.tsx  # Toast notification manager
│   │   ├── AuditInput.tsx          # URL input form component
│   │   ├── AuditProgress.tsx       # Progress steps display
│   │   ├── AuditResults.tsx        # Results table/grid
│   │   ├── AuditSummaryReport.tsx  # Compliance summary view
│   │   ├── ConfirmationDialog.tsx  # Reusable modal dialog
│   │   │
│   │   ├── dashboard/              # Dashboard sub-components
│   │   │   ├── MaturityRadarChart.tsx      # Radar chart (4 dimensions)
│   │   │   ├── ComplianceTrendChart.tsx    # Line chart over time
│   │   │   ├── AgencyLeaderboard.tsx       # Ranked table
│   │   │   └── CriticalAlertsTable.tsx     # High-priority issues
│   │   │
│   │   └── ui/                     # shadcn/ui component library (40+ files)
│   │       ├── accordion.tsx        # Accordion primitive
│   │       ├── alert.tsx           # Alert notifications
│   │       ├── alert-dialog.tsx    # Alert modal
│   │       ├── button.tsx          # Button variants
│   │       ├── card.tsx            # Card container
│   │       ├── checkbox.tsx        # Checkbox input
│   │       ├── dialog.tsx          # Modal dialog
│   │       ├── dropdown-menu.tsx   # Dropdown menu
│   │       ├── form.tsx            # Form utilities (React Hook Form)
│   │       ├── input.tsx           # Text input
│   │       ├── select.tsx          # Select dropdown
│   │       ├── table.tsx           # Data table
│   │       ├── tabs.tsx            # Tab navigation
│   │       ├── toast.tsx           # Toast system
│   │       ├── toaster.tsx         # Toast container
│   │       ├── tooltip.tsx         # Tooltip popover
│   │       ├── badge.tsx           # Badge label
│   │       ├── chart.tsx           # Recharts wrapper
│   │       ├── sonner.tsx          # Sonner toast integration
│   │       ├── sidebar.tsx         # Sidebar layout
│   │       ├── pagination.tsx      # Pagination controls
│   │       ├── calendar.tsx        # Date picker
│   │       ├── navigation-menu.tsx # Navigation
│   │       └── [30+ more UI primitives]
│   │
│   ├── 🎣 hooks/                   # Custom React hooks
│   │   ├── use-mobile.tsx          # Mobile device detection
│   │   └── use-toast.ts            # Toast notification hook
│   │
│   ├── 🌍 contexts/                # Context API providers
│   │   └── AuthContext.tsx         # Auth state + login/logout/verify
│   │
│   ├── 🛠️ utils/                    # Utility functions
│   │   ├── pdfExport.ts            # PDF generation (jsPDF + html2canvas)
│   │   ├── leaderboardPdfExport.ts # Leaderboard PDF export
│   │
│   ├── 📚 lib/                      # Shared libraries
│   │   └── utils.ts                # Common utilities (cn, formatting)
│   │
│   └── 🧪 test/                     # Frontend tests
│       └── [Vitest test files]
│
├── backend/                        # 🔧 BACKEND APPLICATION
│   ├── package.json                # Backend deps (Express, Mongoose, Playwright, ExcelJS)
│   ├── ecosystem.config.cjs        # PM2 process manager config
│   ├── .env                        # Backend environment variables
│   ├── .env.example                # Environment template
│   │
│   ├── 📄 DOCUMENTATION
│   │   ├── ABUSE_PROTECTION_GUIDE.md      # DOS prevention
│   │   ├── IDOR_VULNERABILITY_FIX.md      # Access control fixes
│   │   └── [Other backend docs]
│   │
│   ├── 🔧 UTILITY SCRIPTS (Root level)
│   │   ├── test-api.js              # API endpoint test
│   │   ├── test-audit-checks.js     # Audit engine test
│   │   ├── test-auto-agency.js      # Agency auto-discovery
│   │   ├── test-auto-agency-detailed.js  # Detailed agency test
│   │   ├── smoke-runAudit.js        # Quick smoke test
│   │   ├── create-admin-user.js     # Create admin account
│   │   ├── insert-demo-user.js      # Insert demo user
│   │   ├── seed.js                  # Database seeding
│   │   ├── diagnose-audit.js        # Full diagnostics
│   │   ├── check-audit-owners.js    # Verify ownership
│   │   ├── check-db.js              # Database connectivity
│   │   ├── fix-audit-ownership.js   # Fix ownership issues
│   │   ├── fix-admin-password.js    # Reset admin password
│   │   ├── fix-audit-archive-field.js   # Fix archive field
│   │   ├── cancel-running-audits.js # Cancel stuck audits
│   │   ├── reset-stuck-audit.js     # Reset stuck state
│   │   ├── unlock-admin.js          # Unlock admin account
│   │   ├── debug-password.js        # Password hashing debug
│   │   ├── debug-logo.js            # Logo detection debug
│   │   ├── debug-psa.js             # PSA parsing debug
│   │   ├── debug-fuzzy.cjs          # Fuzzy matching debug
│   │   ├── test-calendar.js         # Calendar test
│   │   ├── test-bcrypt.js           # Bcrypt testing
│   │   ├── test-checks.js           # Check system test
│   │   ├── test-detectors.js        # Detector functions test
│   │   ├── test-fuzzy-matching.cjs  # Fuzzy search test
│   │   └── test-missing-checks.js   # Missing checks analysis
│   │
│   ├── src/                        # Backend source code
│   │   ├── server.js               # Express app initialization
│   │   │                            # - Middleware setup
│   │   │                            # - Route registration
│   │   │                            # - Error handlers
│   │   │                            # - Health check endpoint
│   │   │
│   │   ├── 🔐 middleware/
│   │   │   ├── auth.js              # JWT/session validation + SessionManager
│   │   │   │                        # - authenticate() middleware
│   │   │   │                        # - authorize(role) middleware
│   │   │   │                        # - SessionManager class (in-memory)
│   │   │   └── rateLimiter.js       # Express-rate-limit rules
│   │   │                            # - loginLimiter (5/15min)
│   │   │                            # - registrationLimiter (5/15min)
│   │   │                            # - passwordResetLimiter (3/15min)
│   │   │                            # - auditLimiter (resource protection)
│   │   │                            # - downloadLimiter (export protection)
│   │   │
│   │   ├── 📦 models/               # Mongoose schemas
│   │   │   ├── User.js              # User schema
│   │   │   │                        # - username, email, hashedPassword
│   │   │   │                        # - role (admin/auditor), agency (ref)
│   │   │   │                        # - loginAttempts, lockUntil
│   │   │   │                        # - emailVerificationToken, passwordResetToken
│   │   │   │                        # - Pre-save hook: bcrypt password hashing
│   │   │   │
│   │   │   ├── Agency.js            # Government agency registry
│   │   │   │                        # - name, acronym, domainUrl (unique)
│   │   │   │                        # - agencyType, region (Philippine regions)
│   │   │   │                        # - headEmail, headPhone, notes
│   │   │   │                        # - isActive, lastAuditDate, tags
│   │   │   │                        # - Indexes: domainUrl, region+agencyType
│   │   │   │
│   │   │   ├── AuditLog.js          # Audit execution results
│   │   │   │                        # - auditUrl, status, agency (ref), auditedBy (ref)
│   │   │   │                        # - pst detection (found, location, format)
│   │   │   │                        # - transparencySeal (found, link, location)
│   │   │   │                        # - citizensCharter, masthead links
│   │   │   │                        # - accessibility metrics (altTextCoverage, formLabels)
│   │   │   │                        # - performance (loadTimeMs, pagesCrawled, brokenLinks)
│   │   │   │                        # - auditResults (raw checks), uiReport (formatted)
│   │   │   │                        # - crawledPages, auditDurationMs, completedAt
│   │   │   │                        # - isArchived (admin only)
│   │   │   │
│   │   │   ├── ComplianceScore.js   # Calculated maturity scores
│   │   │   │                        # - agency (ref), linked to AuditLog
│   │   │   │                        # - webPresence.stage1-4 (0-100), currentStage
│   │   │   │                        # - webUsability (accessibility, identity, navigation, content)
│   │   │   │                        # - wcag levels (A, AA, AAA compliance)
│   │   │   │
│   │   │   └── Notification.js      # Event notifications
│   │   │                            # - type (audit_completed/failed/archived/restored)
│   │   │                            # - auditLog (ref), triggeredBy (user ref)
│   │   │                            # - title, message, auditUrl, auditStatus
│   │   │                            # - metadata (agency, archiveReason, checksCompleted)
│   │   │
│   │   ├── 🛣️ routes/               # Express route handlers
│   │   │   ├── authRoute.js         # Authentication endpoints
│   │   │   │                        # - POST /login (rate limited 5/15min)
│   │   │   │                        # - POST /logout
│   │   │   │                        # - POST /verify-email (24h token)
│   │   │   │                        # - POST /resend-verification
│   │   │   │                        # - POST /forgot-password
│   │   │   │                        # - POST /reset-password (15min token)
│   │   │   │                        # - GET /verify (session validation)
│   │   │   │                        # - GET /me (current user profile)
│   │   │   │
│   │   │   ├── auditRoute.js        # Audit CRUD + downloads
│   │   │   │                        # - GET / (list audits, paginated)
│   │   │   │                        # - POST / (start audit, returns 202)
│   │   │   │                        # - GET /:id (full audit details)
│   │   │   │                        # - GET /:id/excel (download XLSX)
│   │   │   │                        # - GET /:id/pdf (download PDF)
│   │   │   │                        # - POST /:id/cancel (stop audit)
│   │   │   │                        # - POST /:id/archive (admin only)
│   │   │   │                        # - POST /:id/restore (admin only)
│   │   │   │                        # - Rate limited + ownership checks
│   │   │   │
│   │   │   ├── dashboardRoute.js    # Analytics endpoints
│   │   │   │                        # - GET /maturity-index (agency rankings)
│   │   │   │                        # - GET /leaderboard (top performers)
│   │   │   │                        # - GET /compliance-trend (scores over time)
│   │   │   │                        # - GET /critical-alerts (high-priority issues)
│   │   │   │
│   │   │   └── notificationRoute.js # Notification system
│   │   │                            # - GET / (list notifications, paginated)
│   │   │                            # - GET /unread (unread count)
│   │   │                            # - POST /:id/read (mark as read)
│   │   │                            # - POST /read-all (mark all as read)
│   │   │
│   │   ├── 🛠️ services/             # Business logic layer
│   │   │   ├── auditEngine.js       # Core audit orchestrator
│   │   │   │                        # - runAudit(url, options) main function
│   │   │   │                        # - Validates URL (http/https)
│   │   │   │                        # - Crawls site (5-50 pages)
│   │   │   │                        # - Runs accessibility scan (Axe)
│   │   │   │                        # - Detects PST, seal, masthead links
│   │   │   │                        # - Measures performance (load time)
│   │   │   │                        # - Builds compliance checks
│   │   │   │                        # - Generates UI report + summary
│   │   │   │
│   │   │   ├── reportGenerator.js   # Export generation
│   │   │   │                        # - generateAuditReport() → ExcelJS workbook
│   │   │   │                        # - generateAuditReportPdf() → jsPDF document
│   │   │   │                        # - buildUiAuditSummary() → Frontend-friendly summary
│   │   │   │
│   │   │   ├── semanticEvaluator.js # AI-based analysis (optional)
│   │   │   │                        # - runSemanticEvaluation() for content analysis
│   │   │   │
│   │   │   └── emailService.js      # SMTP notifications
│   │   │                            # - sendVerificationEmail()
│   │   │                            # - sendPasswordResetEmail()
│   │   │
│   │   ├── 🔍 config/               # Configuration modules
│   │   │   ├── db.js                # MongoDB connection setup
│   │   │   │                        # - getConnectionOptions() pool config
│   │   │   │                        # - connectDB() main connection
│   │   │   │                        # - setupConnectionListeners()
│   │   │   │                        # - Pool: 10-50, timeout: 30s, retryWrites: true
│   │   │   │
│   │   │   └── Assessment Guidelines.csv # DICT framework reference
│   │   │
│   │   └── 🎯 audit/                # Audit engine sub-modules
│   │       ├── atoms/               # Low-level audit functions
│   │       │   ├── scraper.js       # Playwright page scraping
│   │       │   │                    # - scrapePage(url, context)
│   │       │   │                    # - createSharedContext() for connection pooling
│   │       │   │                    # - scrapePageWithContext() for reuse
│   │       │   │
│   │       │   ├── siteCrawler.js   # Multi-page site crawl
│   │       │   │                    # - crawlSiteUrls(startUrl, options)
│   │       │   │                    # - Respect robots.txt
│   │       │   │                    # - Depth/concurrency limits
│   │       │   │
│   │       │   ├── accessibilityScanner.js # WCAG accessibility testing
│   │       │   │                    # - runAccessibilityScan(page, context)
│   │       │   │                    # - Axe-core integration
│   │       │   │                    # - Reports: A/AA/AAA levels
│   │       │   │
│   │       │   ├── pageSignals.js   # DOM inspection utilities
│   │       │   │                    # - inspectPageSignals() extract signals
│   │       │   │                    # - Text extraction, link analysis
│   │       │   │
│   │       │   └── gwtHeuristics.js # Rule detection helpers
│   │       │                        # - PST format detection
│   │       │                        # - Logo/seal detection
│   │       │                        # - Link validation
│   │       │
│   │       └── molecules/           # Composite audit checks
│   │           └── gwtChecker.js    # Build compliance checks
│   │                                # - buildWebPresenceStageChecks() → stages 1-4
│   │                                # - buildContentAccessibilityChecks()
│   │                                # - buildNavigationStructureChecks()
│   │                                # - buildBrandIdentityChecks()
│   │                                # - buildCompanyInfoChecks()
│   │                                # - [+ 10 more check builders]
│   │
│   ├── logs/                        # Runtime logs directory
│   └── templates/                   # Email templates (Nodemailer)
│
├── node_modules/                   # Frontend dependencies
└── dist/                           # Frontend build output (Vite build)
```

---

## 🔄 MAIN WORKFLOW DIAGRAMS

### 1. Authentication Flow
```
User Registration/Login
    ↓
LandingPage → LoginPage (email + password input)
    ↓
ConfirmationDialog (email verification optional)
    ↓
POST /api/auth/login (rate limited: 5/15min)
    ↓
Backend validates credentials + bcrypt check
    ↓
Generate JWT token (24h expiry)
    ↓
Response: { token, user: {id, email, role, agency} }
    ↓
Frontend stores token in localStorage (AUTH_TOKEN)
    ↓
AuthContext updates user + isAuthenticated = true
    ↓
ProtectedRoute allows navigation to Dashboard
```

### 2. Audit Execution Flow (30-60 seconds)
```
Dashboard Page
    ↓
User enters URL (AuditInput component)
    ↓
POST /api/audit with token + URL
    └─ Validation: http/https required
    └─ Rate limit check: auditLimiter
    └─ Create AuditLog (status: in_progress)
    └─ Return 202 status immediately + auditLogId
    ↓
Frontend saves activeAudit to localStorage
    ↓
Show AuditProgress component (12 steps)
    └─ fetch, pst, transparency, citizens, masthead
    └─ loadtime, alttags, urls, fonts, sns
    └─ presence, report
    ↓
Background: auditEngine.runAudit() executes
    └─ Validate URL
    └─ Create Playwright context (stealth mode)
    └─ Crawl site (5-50 pages, depth 0-3)
    └─ For each page:
    │   ├─ Accessibility scan (Axe-core)
    │   ├─ PST detection regex
    │   ├─ Transparency seal image detection
    │   ├─ Navigation links check
    │   ├─ Performance metrics (load time)
    │   └─ Extract page signals
    └─ Build compliance checks (50+ checks)
    └─ Generate UI report summary
    └─ Store in AuditLog.auditResults + uiReport
    └─ Calculate ComplianceScore (stages 1-4)
    └─ Update Agency.lastAuditDate
    └─ Update AuditLog.status = success
    └─ Create Notification (audit_completed)
    ↓
Frontend polls GET /api/audit/:id until completion
    ↓
Auto-navigate to /audit/:id (AuditDetailPage)
    ↓
Display tabs: Summary, Compliance, Accessibility, Performance
    └─ Download buttons: Excel, PDF
    └─ Archive button (admin only)
```

### 3. Compliance Scoring System
```
Audit Complete
    ↓
auditEngine generates 50+ compliance checks
    ↓
Checks grouped by category:
    ├─ Stage 1 (Emerging): 10 checks
    ├─ Stage 2 (Enhanced): 10 checks
    ├─ Stage 3 (Interactive): 15 checks
    └─ Stage 4 (Transformational): 15 checks
    ↓
Each check scored:
    ├─ ✅ Pass (100 points)
    ├─ ⚠️ Partial (50 points)
    └─ ❌ Fail (0 points)
    ↓
ComplianceScore calculated:
    ├─ webPresence.stage1 = avg(stage1 checks)
    ├─ webPresence.stage2 = avg(stage2 checks)
    ├─ webPresence.stage3 = avg(stage3 checks)
    ├─ webPresence.stage4 = avg(stage4 checks)
    ├─ currentStage = max(stage ≥ 50%)
    └─ averageScore = (stage1+stage2+stage3+stage4)/4
    ↓
webUsability metrics:
    ├─ accessibility = WCAG coverage %
    ├─ identity = Logo/branding %
    ├─ navigation = Masthead links %
    └─ content = Content quality %
    ↓
Saved to ComplianceScore collection
    ↓
Dashboard displays in:
    ├─ MaturityRadarChart (4-dimensional)
    ├─ AgencyLeaderboard (ranked by average)
    └─ ComplianceTrendChart (over time)
```

### 4. Download & Export Flow
```
User on AuditDetailPage clicks "Download Excel"
    ↓
GET /api/audit/:id/excel + token + downloadLimiter
    ↓
Backend loads AuditLog.auditResults
    ↓
reportGenerator.generateAuditReport(results)
    └─ Create ExcelJS workbook
    └─ Sheet 1: Summary (metadata, scores)
    └─ Sheet 2: Checks (all 50+ checks table)
    └─ Sheet 3: Performance (load times, pages)
    └─ Sheet 4: Accessibility (WCAG scores)
    └─ Write to buffer
    ↓
Response headers:
    ├─ Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    └─ Content-Disposition: attachment; filename="agency_audit_2024-04-23.xlsx"
    ↓
Browser downloads file automatically
    ↓
User opens in Excel with full formatting
```

### 5. Admin Archive/Restore Flow
```
Admin on AuditDetailPage (role: admin)
    ↓
Sees "Archive" button (auditors don't see this)
    ↓
POST /api/audit/:id/archive + token + admin verification
    ↓
Backend checks canManageArchive(user) → true
    ↓
Update AuditLog.isArchived = true
    ↓
Create Notification (type: audit_archived, archiveReason)
    ↓
Audit hidden from main list /audit
    ↓
Visible in /archive page (ArchivePage)
    ↓
Admin can click "Restore"
    ↓
POST /api/audit/:id/restore
    ↓
Update AuditLog.isArchived = false
    ↓
Create Notification (type: audit_restored)
    ↓
Audit visible in main list again
```

---

## 🔐 SECURITY ARCHITECTURE

### Authentication & Session Management
```
JWT Token Flow:
├─ Token created on login: crypto.randomBytes(32).toString('hex')
├─ Stored in SessionManager (in-memory map)
├─ Expires in 24 hours
├─ 1-hour cleanup interval removes expired tokens
├─ Token sent via Authorization: Bearer <token> header
└─ Middleware authenticate() validates on each request

SessionManager:
├─ startCleanupRoutine() → setInterval cleanup every 1 hour
├─ createSession(userId, username, role) → generates token
├─ validateSession(token) → checks expiry, updates lastActivity
├─ revokeSession(token) → removes from map
└─ stopCleanupRoutine() → graceful shutdown
```

### Rate Limiting & DOS Protection
```
Rate Limits (express-rate-limit):
├─ Login: 5 requests per 15 minutes per IP
│   └─ Prevents brute force password attacks
├─ Registration: 5 requests per 15 minutes per IP
│   └─ Prevents account enumeration + mass creation
├─ Password Reset: 3 requests per 15 minutes per IP
│   └─ Prevents account takeover via reset abuse
├─ Audit Submission: 1 per 5 seconds (auditLimiter)
│   └─ Prevents resource exhaustion
└─ Download: 1 per 2 seconds (downloadLimiter)
    └─ Prevents export abuse

Additional:
├─ Suspicious user-agent detection (curl, wget, bots)
├─ IP-based rate limiting + email combo check
└─ Custom error responses with retry info
```

### Input Validation & Sanitization
```
URL Validation:
├─ Required field check
├─ URL format check (new URL() parse)
├─ Protocol check (must be http/https)
├─ Reject: mailto:, ftp://, file:// etc.

Email Validation:
├─ Regex: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
├─ Uniqueness check (User.email unique: true)
└─ Lowercase normalization

Password Validation:
├─ Min 6 characters
├─ Hashed with bcrypt (12 rounds) before storage
├─ Never returned in queries (select: false)

Other Inputs:
├─ Mongoose schema validation
├─ Zod runtime validation (frontend)
├─ Sanitize via HTML-to-text in email templates
└─ No string interpolation in queries (Mongoose parameterized)
```

### Access Control & IDOR Prevention
```
Audit Access Control:
├─ canAccessAudit(user, audit) function:
│   └─ ALL authenticated users can view all audits
│   └─ No ownership restriction (design choice)
├─ Authentication required on all audit endpoints
└─ auditedBy field tracks audit creator

Admin-Only Operations:
├─ canManageArchive(user) → user.role === 'admin'
│   ├─ Archive audit: POST /api/audit/:id/archive
│   ├─ Restore audit: POST /api/audit/:id/restore
│   └─ Cancel running audit: POST /api/audit/:id/cancel
└─ Middleware authorize('admin') enforces

User Profile Protection:
├─ Password hash never returned (select: false)
├─ Only return: id, email, username, role, agency
├─ Email verification status returned
└─ lastLogin timestamp for audit purposes
```

### Data Privacy & Encryption
```
Sensitive Data Handling:
├─ Passwords: bcrypt hashed (12 rounds)
├─ JWT Tokens: Stored in localStorage (HttpOnly best practice not used, XSS risk)
├─ Email Verification: Temporary token (24h expiry)
├─ Password Reset: Temporary token (15min expiry)
├─ Sessions: In-memory, cleared on 1h inactivity

HTTPS Requirement:
├─ .env enforced environment for JWT_SECRET
├─ Cookie SameSite: strict (CSRF protection)
├─ Helmet security headers applied
└─ CORS configured to prevent cross-origin abuse
```

---

## 📊 DATABASE SCHEMA RELATIONSHIPS

```
User (Authentication)
├─ _id: ObjectId
├─ username: String (unique)
├─ email: String (unique)
├─ hashedPassword: String (bcrypt)
├─ role: enum ['admin', 'auditor']
├─ agency: ObjectId → Agency
├─ isActive: Boolean
├─ isEmailVerified: Boolean
├─ loginAttempts: Number
├─ lockUntil: Date
├─ createdAt, updatedAt: Timestamp
└─ Indexes: username, email (unique)

                    ↓ (references)

Agency (Registry)
├─ _id: ObjectId
├─ name: String
├─ acronym: String
├─ domainUrl: String (unique)
├─ agencyType: enum (national_bureau, regional_office...)
├─ region: enum (NCR, CAR, I-XIII, BARMM)
├─ headEmail: String
├─ isActive: Boolean
├─ lastAuditDate: Date
├─ tags: [String]
├─ createdAt, updatedAt: Timestamp
└─ Indexes: domainUrl (unique), region+agencyType, isActive+lastAuditDate

                    ↓ (references)

AuditLog (Audit Results)
├─ _id: ObjectId
├─ agency: ObjectId → Agency
├─ auditUrl: String
├─ auditedBy: ObjectId → User
├─ status: enum ['in_progress', 'success', 'partial', 'failed']
├─ pst: { found, location, format }
├─ transparencySeal: { found, link, location }
├─ citizensCharter: { found, link }
├─ masthead: { aboutUs, contactUs, home }
├─ accessibility: { altTextCoverage, formLabels }
├─ performance: { loadTimeMs, pagesCrawled, brokenLinks }
├─ auditResults: { checks[], raw data }
├─ uiReport: { formatted summary for frontend }
├─ crawledPages: [{ url, status, title }]
├─ isArchived: Boolean
├─ auditDurationMs: Number
├─ createdAt, completedAt, updatedAt: Timestamp
└─ Indexes: agency, auditedBy, status, createdAt

                    ↓ (references via agency)

ComplianceScore (Calculated Metrics)
├─ _id: ObjectId
├─ agency: ObjectId → Agency (index)
├─ webPresence: { stage1-4 (0-100), currentStage, averageScore }
├─ webUsability: { accessibility, identity, navigation, content }
├─ wcag: { A, AA, AAA (0-100) }
├─ createdAt, updatedAt: Timestamp
└─ Indexes: agency (index)

Notification (Event Log)
├─ _id: ObjectId
├─ type: enum ['audit_completed', 'audit_failed', 'audit_archived', ...]
├─ auditLog: ObjectId → AuditLog (index)
├─ triggeredBy: ObjectId → User
├─ title: String
├─ message: String
├─ auditUrl: String
├─ auditStatus: enum ['success', 'partial', 'failed', 'cancelled']
├─ metadata: { agency, archiveReason, checksCompleted }
├─ isRead: Boolean
├─ createdAt, updatedAt: Timestamp
└─ Indexes: type, auditLog, triggeredBy
```

---

## 🚀 DEPLOYMENT CHECKLIST

- [ ] MongoDB Atlas cluster set up with proper pool config
- [ ] Backend .env configured (MONGODB_URI, JWT_SECRET, SMTP credentials)
- [ ] Frontend .env configured (VITE_API_URL)
- [ ] PM2 ecosystem.config.cjs configured (node_env: production)
- [ ] SSL/TLS certificates for HTTPS
- [ ] Helmet security headers enabled
- [ ] CORS properly configured for production domain
- [ ] Rate limiting tuned for production load
- [ ] Error logging / monitoring configured
- [ ] Backup strategy for MongoDB data
- [ ] Test email service (Nodemailer SMTP)
- [ ] Document admin user creation process
- [ ] Load test audit engine (stress test Playwright)

---

## 📈 Performance Considerations

| Metric | Value | Notes |
|--------|-------|-------|
| Audit Duration | 30-60 seconds | Depends on site complexity |
| Frontend Build | ~2 seconds | Vite with SWC compiler |
| Database Pool | 10-50 connections | Mongoose optimized config |
| JWT Expiry | 24 hours | Session management |
| Rate Limit Window | 15 minutes | Standard for login |
| Request Timeout | 10 minutes | Long audits need time |
| Memory Limit | 50MB JSON | Large audit reports |

---

## 🔗 Key Integration Points

1. **Playwright ↔ Audit Engine**: Web scraping + accessibility scanning
2. **MongoDB ↔ Mongoose**: ORM for schema + data persistence
3. **React Query ↔ REST API**: Server state caching + auto-sync
4. **Context API ↔ Auth**: Global auth state management
5. **Recharts ↔ Dashboard**: Real-time visualization of compliance data
6. **ExcelJS ↔ Reports**: Generate downloadable audit reports
7. **Nodemailer ↔ Email Service**: Send verification/reset emails

---

## 📚 Documentation Map

```
High-Level Guides:
├─ README.md → Project overview
├─ TECH_STACK.md → Dependencies
├─ MASID_SETUP.md → Implementation
└─ MASID_CHECKLIST.md → Deployment

Technical Details:
├─ SECURITY_API_INVENTORY.md → API security audit
├─ COMPLIANCE_REPORT_GUIDE.md → Report generation
├─ AUTH_SECURITY_TESTING.md → Authentication tests
└─ IDOR_VULNERABILITY_FIX.md → Access control fixes

Quick References:
├─ PRE_MADE_ACCOUNTS.md → Demo users
├─ ACCOUNTS_QUICK_REF.md → User management
└─ MANUAL_ACCOUNT_SETUP.md → Admin setup
```

---

**Last Updated:** April 2026  
**Architecture Version:** 2.0 (MASID-compliant)
