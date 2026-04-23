# GWT Audit Buddy - User Acceptance Testing (UAT) Criteria

**System**: GWT Audit Buddy (Web Accessibility Audit System for Philippine Government Websites)  
**Scope**: End-to-end functional, security, performance, and data integrity testing  
**Environment**: Staging (matches production configuration)

---

## 📋 TEST EXECUTION TEMPLATE

For each test case below, record:
- **Test ID**: Unique identifier
- **Status**: ✅ PASS | ❌ FAIL | ⏭️ SKIP | 🟡 CONDITIONAL
- **Tester**: Name of QA person
- **Date**: MM/DD/YYYY
- **Notes**: Any deviations or observations

---

## 🔐 SECTION 1: AUTHENTICATION & AUTHORIZATION

### 1.1 User Login - Valid Credentials
**Test ID**: AUTH-001  
**Precondition**: User account exists in MongoDB (e.g., user@dict.gov.ph)  
**Steps**:
1. Navigate to login page
2. Enter valid email (user@dict.gov.ph)
3. Enter valid password (Temporary123@)
4. Click "Login"

**Expected**:
- ✅ Login successful
- ✅ Redirected to Dashboard
- ✅ JWT token stored securely (httpOnly cookie or Authorization header)
- ✅ User name/role visible in header

**Evidence**: Screenshot of dashboard with user info

---

### 1.2 User Login - Invalid Email
**Test ID**: AUTH-002  
**Steps**:
1. Enter non-existent email (fake@dict.gov.ph)
2. Enter any password
3. Click "Login"

**Expected**:
- ✅ Error message: "Invalid email or password"
- ✅ Generic message (does not reveal if email exists)
- ✅ User remains on login page
- ✅ No tokens generated

---

### 1.3 User Login - Invalid Password
**Test ID**: AUTH-003  
**Steps**:
1. Enter valid email (user@dict.gov.ph)
2. Enter wrong password (WrongPassword123)
3. Click "Login"

**Expected**:
- ✅ Error message: "Invalid email or password"
- ✅ Generic message (does not reveal password is wrong)
- ✅ Login attempts increment (check backend logs or DB)
- ✅ After 5 failed attempts within 15 mins → Account locked (403)

---

### 1.4 Rate Limiting on Login
**Test ID**: AUTH-004  
**Steps**:
1. Attempt login 5 times with wrong password within 60 seconds
2. On 6th attempt, submit

**Expected**:
- ✅ Requests 1-5: Normal error responses
- ✅ Request 6: 429 Too Many Requests
- ✅ Error message: "Too many login attempts. Please try again later."
- ✅ Rate limit reset after 15 minutes

---

### 1.5 Session Expiry (24 Hours)
**Test ID**: AUTH-005  
**Precondition**: User logged in, known session token  
**Steps**:
1. Manually set system clock +24 hours (or mock in backend)
2. Attempt to access protected route (GET /api/audit)
3. Submit request with old session token

**Expected**:
- ✅ Request returns 401 Unauthorized
- ✅ Error message: "Token expired"
- ✅ Redirected to login page on frontend
- ✅ Session deleted from server

---

### 1.6 Authorization - Viewer vs Auditor vs Admin
**Test ID**: AUTH-006  
**Steps**:
1. Login as "Viewer" role (viewer@dict.gov.ph)
2. Attempt to: POST /api/audit (start new audit)
3. Logout, login as "Auditor" role (auditor@dict.gov.ph)
4. POST /api/audit → Should succeed
5. Login as "Admin" (admin@dict.gov.ph)
6. POST /api/audit AND POST /api/audit/:id/archive → Both should succeed

**Expected**:
- ✅ Viewer: Can read audits, cannot POST/archive
- ✅ Auditor: Can read/write audits, cannot archive
- ✅ Admin: Full access to all endpoints
- ✅ Proper 403 Forbidden responses for unauthorized actions

---

### 1.7 IDOR Prevention - Users Cannot View Other Users' Audits
**Test ID**: AUTH-007  
**Steps**:
1. Login as User A (user@dict.gov.ph), perform audit
2. Record the auditLogId
3. Logout
4. Login as User B (different account)
5. Attempt GET /api/audit/{User_A_auditLogId}

**Expected**:
- ✅ Returns 403 Forbidden
- ✅ Error: "You do not have permission to access this audit"
- ✅ User B cannot see User A's audit data

**Evidence**: API response screenshot

---

## 📊 SECTION 2: AUDIT EXECUTION

### 2.1 Audit Starts Successfully
**Test ID**: AUDIT-001  
**Steps**:
1. Login as auditor
2. Navigate to Dashboard
3. Enter valid government URL: https://www.psa.gov.ph
4. Set: maxPages=10, maxDepth=2, concurrency=3
5. Click "Start Audit"

**Expected**:
- ✅ Request returns 202 Accepted
- ✅ Response includes auditLogId and status: "in_progress"
- ✅ Frontend redirects to results page
- ✅ Results page shows "Audit in progress..."
- ✅ Backend logs show crawl starting
- ✅ Frontend polls GET /api/audit for status updates

---

### 2.2 Audit Completes with Full Results
**Test ID**: AUDIT-002  
**Precondition**: Audit from 2.1 running  
**Steps**:
1. Wait for audit to complete (typically 2-5 minutes)
2. Observe frontend auto-update
3. Check GET /api/audit/:id response

**Expected**:
- ✅ Status changes to "completed"
- ✅ Results page displays all checks (100+)
- ✅ Includes:
  - Web Presence checks (Stage 1-4)
  - Web Usability checks
  - Performance metrics (load time, WCAG %)
  - Page crawl count
  - Accessibility metrics (alt text %, form labels %)
- ✅ Summary report card shows compliance score

---

### 2.3 Audit Timeout Handling (Long-Running Site)
**Test ID**: AUDIT-003  
**Steps**:
1. Start audit on very large site (>100 pages)
2. Wait 60+ seconds

**Expected**:
- ✅ Audit completes within 90 seconds max
- ✅ If timeout occurs, status = "failed"
- ✅ Error message explains timeout
- ✅ Partial results included (pages crawled before timeout)
- ✅ No frontend hanging/blank page

---

### 2.4 Invalid URL Handling
**Test ID**: AUDIT-004  
**Steps**:
1. Enter invalid URLs and test each:
   - "not-a-url"
   - "http://localhost:8080" (non-.gov.ph domain)
   - "ftp://example.gov.ph" (not http/https)
   - "" (empty)

**Expected**:
- ✅ Frontend validation catches all
- ✅ Error message specific: "Must be .gov.ph domain" or "Invalid URL format"
- ✅ Submit button disabled until valid
- ✅ Toast notification shows error

---

### 2.5 Concurrent Audits (Multiple Users)
**Test ID**: AUDIT-005  
**Steps**:
1. User A starts audit on site1.gov.ph
2. Immediately (within 5s), User B starts audit on site2.gov.ph
3. Monitor both audits to completion

**Expected**:
- ✅ Both audits process simultaneously
- ✅ Both complete successfully
- ✅ No cross-contamination of results
- ✅ Each user sees only their audit

---

### 2.6 Audit Can Be Cancelled
**Test ID**: AUDIT-006  
**Steps**:
1. Start audit
2. Within 30 seconds, click "Cancel Audit" button
3. Confirm cancellation

**Expected**:
- ✅ Status changes to "cancelled"
- ✅ Backend stops Playwright processes
- ✅ UI shows "Audit Cancelled"
- ✅ Results page shows partial/no results
- ✅ Cannot restart same audit (must start new one)

---

### 2.7 Audit Execution Respects Crawl Parameters
**Test ID**: AUDIT-007  
**Steps**:
1. Start audit with parameters:
   - maxPages: 5
   - maxDepth: 1
   - concurrency: 2
2. Monitor backend logs or page count in results

**Expected**:
- ✅ Crawler respects maxPages limit (≤5 pages crawled)
- ✅ Crawler respects maxDepth (only 1 level deep)
- ✅ Concurrency set to 2 (max 2 parallel requests)
- ✅ Results show actual crawled count

---

## 📋 SECTION 3: CHECKS & COMPLIANCE SCORING

### 3.1 Web Presence Checks (Stage 1 - Emerging)
**Test ID**: CHECKS-001  
**Steps**:
1. Complete audit
2. Navigate to "Web Presence Evaluation" tab
3. Examine Stage 1 results

**Expected**:
- ✅ Stage 1 has 4 sections: A (Foundation), B (Homepage Structure), C (Main Content), D (Navigation)
- ✅ 21 total items with Yes/No status
- ✅ Each item has Remarks field (explanation)
- ✅ All items present (A:4, B:8, C:9, D:5)

---

### 3.2 Web Presence Checks (All Stages)
**Test ID**: CHECKS-002  
**Steps**:
1. View all 4 stages in Web Presence tab
2. Count items in each stage

**Expected**:
- ✅ Stage 1: 21 items (4+8+9+5)
- ✅ Stage 2 (Enhanced): 16 items (5 sections)
- ✅ Stage 3 (Transactional): 14 items (4 sections)
- ✅ Stage 4 (Connected): 22 items (7 sections)
- ✅ Color coding: Blue/Green/Purple/Orange for stages

---

### 3.3 Web Usability Checks
**Test ID**: CHECKS-003  
**Steps**:
1. Navigate to "Web Usability Evaluation" tab
2. Review all checks

**Expected**:
- ✅ 4 categories with multiple items each
- ✅ All checks have Pass/Fail/N/A status
- ✅ Remarks explain why passed or failed
- ✅ Matches DICT assessment form structure

---

### 3.4 Performance Metrics Tab
**Test ID**: CHECKS-004  
**Steps**:
1. Navigate to "Performance Metrics" tab
2. Review all metrics

**Expected**:
- ✅ Load Time: Displayed in ms (averaged over 3 trials)
- ✅ WCAG AA Compliance: Percentage (from Axe checks)
- ✅ Pages Crawled: Count
- ✅ Page Load Time Chart: Visual representation
- ✅ All values non-null/not "NaN"

---

### 3.5 Semantic Checks (Gemini AI - Optional)
**Test ID**: CHECKS-005  
**Precondition**: GEMINI_API_KEY configured  
**Steps**:
1. Complete audit
2. Check for semantic evaluation results

**Expected**:
- ✅ If API key present: 4 semantic checks (tagline, whitespace, about/contact, density)
- ✅ Status: Pass/Fail with reasoning
- ✅ If API key missing: Results show "N/A" with note "Semantic evaluation not available"

---

### 3.6 Compliance Scoring Calculation
**Test ID**: CHECKS-006  
**Steps**:
1. Complete audit
2. Check Summary Report Card
3. Calculate expected score:
   - Determine highest stage achieved (stages are sequential)
   - Get percentage score within that stage
   - Example: "Stage 2 at 75%" → Overall ~50-75%

**Expected**:
- ✅ Compliance score accurately represents results
- ✅ Pass/Fail badge matches score (Pass if ≥50%, Fail if <50%)
- ✅ Agency leaderboard rank updates accordingly
- ✅ Historical trend captured (for compliance report)

---

## 💾 SECTION 4: REPORTS & EXPORTS

### 4.1 Web Accessibility Audit Summary Report (On-Screen)
**Test ID**: EXPORT-001  
**Steps**:
1. Complete audit
2. Review top card: "Web Accessibility Audit Summary Report"

**Expected**:
- ✅ Shows: Web Presence stages (✓/○), Web Usability scores (%), Overall %
- ✅ Key findings: PST status, Transparency Seal, Load time, WCAG %, Pages crawled
- ✅ Pass/Fail badge at top
- ✅ All metrics match detailed tabs below

---

### 4.2 Export to Excel
**Test ID**: EXPORT-002  
**Steps**:
1. Navigate to completed audit
2. Click "Download Excel Report"
3. File downloads (gwt-audit-buddy_audit_YYYY-MM-DD.xlsx)
4. Open in Excel/LibreOffice

**Expected**:
- ✅ File downloads successfully
- ✅ File name format: {domain}_audit_{date}.xlsx
- ✅ Sheets present:
  - Summary (overview + score)
  - Web Presence (all stages with Yes/No)
  - Web Usability (all checks)
  - Performance (metrics)
- ✅ All data matches on-screen report
- ✅ Formatting clean (proper fonts, colors, borders)
- ✅ No corrupted cells or #REF! errors

---

### 4.3 Export to PDF
**Test ID**: EXPORT-003  
**Steps**:
1. Click "Download PDF Report"
2. File downloads
3. Open in PDF viewer

**Expected**:
- ✅ File downloads successfully
- ✅ File name format: {domain}_audit_{date}.pdf
- ✅ Includes:
  - Cover page (title, date, agency)
  - Executive summary
  - All compliance results
  - Charts/graphs
- ✅ All text readable (no blurred/corrupt sections)
- ✅ Pages numbered
- ✅ ToC if applicable

---

### 4.4 Export Rate Limiting
**Test ID**: EXPORT-004  
**Steps**:
1. Click "Download Excel" 10 times within 1 minute
2. 11th attempt

**Expected**:
- ✅ First 5 downloads: Success
- ✅ 6th onwards: 429 Too Many Requests
- ✅ Error message: "Please wait before requesting another download"
- ✅ Rate limit reset after 15 minutes

---

## 📊 SECTION 5: AGENCY MANAGEMENT & LEADERBOARD

### 5.1 Agency Auto-Discovery
**Test ID**: AGENCY-001  
**Steps**:
1. Start first audit on https://newagency.gov.ph (not pre-registered)
2. Check Agency collection in MongoDB

**Expected**:
- ✅ New Agency document created:
  - name: Extracted from domain ("New Agency")
  - domainUrl: "https://newagency.gov.ph"
  - agencyType: "other"
  - tags: ["auto-discovered"]
  - isActive: true

---

### 5.2 Agency Leaderboard Updates
**Test ID**: AGENCY-002  
**Steps**:
1. Complete 3 audits on different sites
2. Navigate to Agency Leaderboard page
3. Check ranking

**Expected**:
- ✅ All 3 agencies appear on leaderboard
- ✅ Sorted by compliance score (highest first)
- ✅ Shows: Rank, Agency Name, Latest Score, Pass/Fail Status
- ✅ Clicking agency shows recent audits

---

### 5.3 Historical Audit Tracking
**Test ID**: AGENCY-003  
**Steps**:
1. Perform 3 audits on SAME site over time (e.g., days/weeks apart)
2. Navigate to agency details
3. View audit history

**Expected**:
- ✅ All 3 audits listed chronologically
- ✅ Latest audit at top (newest first)
- ✅ Can click each to view full results
- ✅ Trend shows score progression

---

## 🏛️ SECTION 6: ARCHIVE & DATA MANAGEMENT

### 6.1 Archive Audit (Admin Only)
**Test ID**: ARCHIVE-001  
**Precondition**: Completed audit exists  
**Steps**:
1. Login as Admin
2. Open audit details
3. Click "Archive Audit" button
4. Confirm

**Expected**:
- ✅ Audit moved to Archive section
- ✅ isArchived field = true in DB
- ✅ Removed from main Results page
- ✅ Accessible via Archive tab

---

### 6.2 Cannot Archive In-Progress Audit
**Test ID**: ARCHIVE-002  
**Steps**:
1. Start audit
2. Within 30 seconds, navigate to audit details
3. Attempt to click "Archive" button

**Expected**:
- ✅ Archive button disabled or hidden
- ✅ Tooltip: "Cannot archive while audit is running"
- ✅ If attempted via API: 400 Bad Request

---

### 6.3 Restore Archived Audit
**Test ID**: ARCHIVE-003  
**Steps**:
1. Navigate to Archive section
2. Click "Restore" on archived audit
3. Confirm

**Expected**:
- ✅ Audit moved back to main Results
- ✅ isArchived field = false in DB
- ✅ Appears in Results page again
- ✅ All data intact

---

## 🔒 SECTION 7: SECURITY TESTING

### 7.1 SQL/NoSQL Injection Prevention
**Test ID**: SEC-001  
**Steps**:
1. Attempt injection in URL field:
   - `https://evil.gov.ph"; db.users.drop(); //`
   - `https://test.gov.ph" OR 1=1 --`
2. Submit audit

**Expected**:
- ✅ Rejected with validation error
- ✅ No database modification
- ✅ No error stack trace exposed

---

### 7.2 XSS Prevention (Email Field)
**Test ID**: SEC-002  
**Steps**:
1. During registration, email field:
   - `<script>alert('XSS')</script>@dict.gov.ph`
2. Submit registration

**Expected**:
- ✅ Validation error (invalid email format)
- ✅ Script does not execute
- ✅ No alert popup

---

### 7.3 CSRF Token Validation
**Test ID**: SEC-003  
**Steps**:
1. If CSRF middleware enabled: Attempt POST request without CSRF token
2. Use curl or Postman to bypass frontend

**Expected**:
- ✅ If CSRF enabled: 403 Forbidden
- ✅ If CSRF disabled: Note for Future improvement

---

### 7.4 Sensitive Data Not in Logs
**Test ID**: SEC-004  
**Steps**:
1. Perform full audit
2. Check backend logs (console.log output)
3. Search for: password, token, secret, api_key

**Expected**:
- ✅ No passwords in logs
- ✅ No full JWT tokens (only prefix/last 4 chars)
- ✅ No API keys visible
- ✅ Sensitive data redacted

---

### 7.5 No Unencrypted Credentials in Responses
**Test ID**: SEC-005  
**Steps**:
1. Login, capture JWT token
2. Use token to call GET /auth/me
3. Check response body

**Expected**:
- ✅ hashedPassword NOT returned
- ✅ Only: id, email, username, role, isEmailVerified, agency
- ✅ No plaintext password anywhere

---

### 7.6 HttpOnly Cookie for Session
**Test ID**: SEC-006  
**Steps**:
1. Login
2. Open browser DevTools → Application → Cookies
3. Look for sessionToken

**Expected**:
- ✅ sessionToken cookie present
- ✅ HttpOnly flag: ✓ (cannot access via JavaScript)
- ✅ Secure flag: ✓ (HTTPS only)
- ✅ SameSite: Strict or Lax

---

## ⚙️ SECTION 8: PERFORMANCE & LOAD

### 8.1 Audit Completes Within SLA
**Test ID**: PERF-001  
**Steps**:
1. Start audit on medium site (10-20 pages)
2. Record start time, completion time

**Expected**:
- ✅ Audit completes in <120 seconds (2 minutes)
- ✅ No timeout errors
- ✅ All checks executed
- ✅ Typical: 30-90 seconds

---

### 8.2 Dashboard Loads Quickly
**Test ID**: PERF-002  
**Steps**:
1. Login as user with 50+ historical audits
2. Navigate to Dashboard
3. Record page load time (DevTools Performance tab)

**Expected**:
- ✅ Page loads in <3 seconds
- ✅ Audit list populates immediately
- ✅ No spinning loader >2 seconds
- ✅ Pagination works for 50+ audits

---

### 8.3 Export Generation Performs
**Test ID**: PERF-003  
**Steps**:
1. Generate Excel export (large audit: 50+ checks)
2. Record generation time

**Expected**:
- ✅ Excel generated in <10 seconds
- ✅ File <5MB in size
- ✅ No server timeout
- ✅ File downloads successfully

---

### 8.4 Concurrent User Load
**Test ID**: PERF-004  
**Precondition**: Staging environment  
**Steps**:
1. Simulate 10 concurrent users logging in
2. 5 users start audits simultaneously
3. Monitor server metrics (CPU, memory, connections)

**Expected**:
- ✅ All login requests process (no 5xx errors)
- ✅ All audits start successfully
- ✅ Server CPU: <80%
- ✅ Memory: Stable (no leak)
- ✅ No dropped connections

---

## 🎨 SECTION 9: USER INTERFACE & USABILITY

### 9.1 Navigation & Menu Structure
**Test ID**: UI-001  
**Steps**:
1. Login
2. Navigate through:
   - Dashboard → Start Audit
   - Results → View Audit Details
   - Audit Details → Tabs (Presence, Usability, Performance)
   - Export (Excel, PDF)
   - Account Profile
   - Logout

**Expected**:
- ✅ All navigation items present in header/sidebar
- ✅ Breadcrumbs show current page
- ✅ No broken links
- ✅ Page titles match navbar labels

---

### 9.2 Error Messages Are User-Friendly
**Test ID**: UI-002  
**Steps**:
1. Trigger various errors:
   - Network timeout (disconnect internet)
   - Invalid URL format
   - Missing required fields
   - Session expired (wait 24+ hours)

**Expected**:
- ✅ Error messages are clear and actionable
- ✅ Examples: "Please enter a valid .gov.ph domain" (not "Invalid format code: 400")
- ✅ Suggestions for recovery provided
- ✅ No technical jargon

---

### 9.3 Responsive Design (Mobile)
**Test ID**: UI-003  
**Steps**:
1. Open app on:
   - Desktop (1920x1080)
   - Tablet (768x1024)
   - Mobile (375x667)
2. Test all main flows

**Expected**:
- ✅ Layout adjusts for each screen size
- ✅ Touch targets ≥48px diameter (mobile)
- ✅ No horizontal scroll needed
- ✅ Menu collapses/expands properly

---

### 9.4 Loading States
**Test ID**: UI-004  
**Steps**:
1. Start audit and observe
2. Export file and observe

**Expected**:
- ✅ Loading spinner appears
- ✅ Spinner message: "Audit in progress..." or "Generating report..."
- ✅ Button text changes to "Processing..."
- ✅ Button disabled during operation
- ✅ No double-click possible

---

## ♿ SECTION 10: ACCESSIBILITY (WCAG 2.1 AA)

### 10.1 Keyboard Navigation
**Test ID**: A11Y-001  
**Steps**:
1. Use only Tab key to navigate login form
2. Tab through fields: Email → Password → Login button
3. Press Enter on Login button

**Expected**:
- ✅ All interactive elements reachable via Tab
- ✅ Focus visible (outline or highlight)
- ✅ Tab order logical (top-to-bottom, left-to-right)
- ✅ Enter key submits form

---

### 10.2 Color Contrast
**Test ID**: A11Y-002  
**Steps**:
1. Use WebAIM Contrast Checker or browser tool
2. Check text contrast ratios on:
   - Login form
   - Dashboard
   - Audit results

**Expected**:
- ✅ All text vs background: 4.5:1 minimum (normal text)
- ✅ Large text (18pt+): 3:1 minimum
- ✅ Pass/Fail badges clearly distinguishable

---

### 10.3 Screen Reader Compatibility
**Test ID**: A11Y-003  
**Precondition**: Screen reader installed (NVDA free)  
**Steps**:
1. Enable screen reader
2. Navigate login page
3. Tab through form fields

**Expected**:
- ✅ Screen reader announces all labels correctly
- ✅ Error messages announced
- ✅ Form instructions read aloud
- ✅ Button purposes clear

---

### 10.4 Alternative Text for Images
**Test ID**: A11Y-004  
**Steps**:
1. Inspect page for all images (logo, icons, charts)
2. Check alt text

**Expected**:
- ✅ All images have alt text
- ✅ Alt text descriptive (not "image" or "photo")
- ✅ Charts have data table alternative

---

## 📋 SECTION 11: DATA INTEGRITY & CONSISTENCY

### 11.1 Audit Data Persists After Restart
**Test ID**: DATA-001  
**Steps**:
1. Complete audit, note auditLogId
2. Backend: Kill and restart server (pm2 restart gwt-audit-buddy)
3. Query GET /api/audit/{auditLogId}

**Expected**:
- ✅ Audit data intact (not lost)
- ✅ All checks and results present
- ✅ Timestamps unchanged

---

### 11.2 No Data Corruption on Concurrent Audits
**Test ID**: DATA-002  
**Steps**:
1. User A starts audit on site1.gov.ph
2. User B starts audit on site2.gov.ph (same time)
3. Both complete
4. Compare results with database

**Expected**:
- ✅ User A's results ≠ User B's results
- ✅ No mixed/corrupted data
- ✅ Each agency record accurate

---

### 11.3 Agency Duplicate Prevention
**Test ID**: DATA-003  
**Steps**:
1. Audit site1.gov.ph (new agency created)
2. Audit site1.gov.ph again (same domain)
3. Check Agency collection

**Expected**:
- ✅ Only 1 Agency document for site1.gov.ph
- ✅ No duplicates created
- ✅ Audit 1 and Audit 2 reference same agency._id

---

### 11.4 Score Calculation Consistency
**Test ID**: DATA-004  
**Steps**:
1. Complete same audit twice (same site, ~same time)
2. Compare compliance scores

**Expected**:
- ✅ Scores similar (±5% acceptable due to timing variations)
- ✅ Check counts identical
- ✅ Stage achievement same

---

## 📝 SECTION 12: DOCUMENTATION & KNOWLEDGE

### 12.1 Help & Guidance Available
**Test ID**: DOC-001  
**Steps**:
1. Look for help/documentation links
2. Check for tooltips on form fields

**Expected**:
- ✅ Help icon or FAQ link visible
- ✅ Tooltips explain crawl parameters (maxPages, maxDepth, concurrency)
- ✅ Links to DICT Assessment Forms
- ✅ Contact/support information available

---

### 12.2 Error Messages Point to Solutions
**Test ID**: DOC-002  
**Steps**:
1. Generate an error (e.g., invalid URL, timeout)
2. Read error message

**Expected**:
- ✅ Error explains what went wrong
- ✅ Suggests fix ("Check URL is .gov.ph domain")
- ✅ No error codes without explanation
- ✅ Links to documentation if applicable

---

## ✅ FINAL SIGNOFF CHECKLIST

Before UAT sign-off, confirm:

- [ ] All CRITICAL issues (1-5) from Code Review fixed or documented
- [ ] All test cases executed (marked ✅ or 🟡 with notes)
- [ ] No FAIL statuses; any failures have root cause documented
- [ ] Performance meets SLAs (<120s for audits, <3s for dashboard)
- [ ] Security scanning passed (OWASP Top 10 covered)
- [ ] Accessibility baseline met (WCAG 2.1 AA)
- [ ] Concurrent users (10+) tested without errors
- [ ] Rollback procedure documented and tested
- [ ] Deployment checklist completed
- [ ] Production environment hardened (.env secrets, rate limits, CORS)
- [ ] Monitoring/alerting configured (error rates, response times, uptime)
- [ ] Stakeholder walkthrough completed
- [ ] Go/No-Go decision made

---

## 📌 NOTES FOR TESTERS

1. **Test Data**: Use pre-made test accounts (ACCOUNTS_QUICK_REF.md)
2. **Staging URL**: Update as per environment setup
3. **Rate Limiting**: May vary based on ENV configuration
4. **Performance Baseline**: Adjust SLAs if hardware differs from production spec
5. **Screenshots**: Capture for each test (especially failures)
6. **Logs**: Enable AUDIT_DEBUG=1 for detailed audit processing logs
7. **Database**: Direct MongoDB access for verification (use Compass)
8. **Timing**: Account for network latency in performance tests

---

**Document Version**: 1.0  
**Last Updated**: April 2026  
**Owner**: QA Lead  
**Approval**: [Sign-off line]
