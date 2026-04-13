# Complete End-to-End Testing Guide

## 🔧 Backend Improvements Made

1. **Better Error Handling**: Individual check builders now fail gracefully without breaking entire audit
2. **Resilient Crawling**: If crawl fails, uses homepage as fallback instead of crashing
3. **Comprehensive Logging**: Detailed logs show exactly what data is being generated and stored
4. **Better Fallbacks**: Crawl errors don't prevent audit from running

---

## ✅ Testing Procedure

### Step 1: Verify Backend is Running
```bash
# Terminal 1: Backend
cd backend
npm start

# Expected output:
# [timestamp] [Server] Listening on port 5000
# [timestamp] [AUDIT_ENGINE] runAudit started...
```

### Step 2: Check Previous Audit Data
```bash
# Terminal 2: Diagnostics  
cd backend
node diagnose-audit.js

# Expected output:
# ✅ MongoDB connected
# 📋 Latest Audit Found
# 📊 Check count: 100+  (NOT 0)
# 🔍 Check Details (shows actual checks with Pass/Fail status)
```

**If you see things like:**
- ❌ "No checks found!" - Backend didn't run audit properly
- ⚠️  "Only 15 checks" - Some check builders are failing
- ❌ "No crawled pages" - Crawl failed completely

Then proceed to **Step 3**.

### Step 3: Start a Brand New Audit from Frontend

1. **Clear all browser data:**
   ```javascript
   // Open DevTools (F12) → Console → Paste this:
   localStorage.clear();
   sessionStorage.clear();
   if ('caches' in window) {
     caches.keys().then(names => 
       names.forEach(name => caches.delete(name))
     );
   }
   location.reload();
   ```

2. **Create new audit:**
   - Open http://localhost:5080 (frontend)
   - Go to Dashboard
   - Enter website URL (e.g., https://www.example.gov.ph)  
   - Click "Start Audit"
   - **Wait 30-120 seconds** for completion

3. **Check backend logs:**
   Watch Terminal 1 for these messages in order:
   ```
   [AUDIT_ENGINE] runAudit started
   [AUDIT_ENGINE] Starting site crawl
   [AUDIT_ENGINE] Site crawl completed
   [AUDIT_ENGINE] Starting per-page audits
   [AUDIT_ENGINE] Performance trial 1/3
   [AUDIT_ENGINE] Performance trial 2/3
   [AUDIT_ENGINE] Performance trial 3/3
   [AUDIT_ENGINE] Collecting performance trials completed
   [AUDIT_ENGINE] Custom 404 check completed
   [AUDIT_ENGINE] Per-page audits completed
   [Background] Audit completed: checksCount: 100+
   [Background] Storing audit results...
   [Background] Audit log updated successfully
   ```

### Step 4: Verify Frontend Display

1. **Check Result Page:**
   - Should show percentages (not 0%)
   - Web Presence, Web Usability, Overall scores displayed
   - Key Findings populated (not all MISSING)
   - Page analysis count > 0

2. **Open Browser DevTools (F12):**
   - Go to Console
   - No red errors
   - Check Network tab - GET /api/audit/{id} returns 200 with data

3. **Inspect the audit data:**
   ```javascript
   // In Console, after visiting audit results page:
   // Open Network tab → find audit/{id} response
   // Should show structure like:
   {
     "audit": {
       "checks": [...100+ items],
       "auditResults": { "checks": [...] },
       "crawledPages": [...],
       "performance": { "pagesCrawled": 20 }
     },
     "compliance": { "webPresence": {...}, "webUsability": {...} }
   }
   ```

---

## 🐛 Troubleshooting

### Problem: Still Showing 0% After New Audit

**Check 1: Is backend running?**
```bash
curl http://localhost:5000/api/audit -H "Authorization: Bearer test"
# Should return error about no audits, not connection refused
```

**Check 2: Are checks being generated?**
```bash
# Run diagnostic:
cd backend
node diagnose-audit.js
# Look for "Check completed: X" lines
```

**Check 3: Are there database errors?**
```bash
# Check MongoDB connection in backend logs
# Should see "MongoDB connected" on startup
```

### Problem: Audit Takes Only 2 Seconds

**This means:** Crawl or audit is failing silently

**Solution:**
1. Check backend logs for error messages
2. Verify MongoDB is running and accessible  
3. Verify website is accessible: `curl https://yoursite.gov.ph`
4. Increase timeout in auditEngine.js from 25000ms to 35000ms

### Problem: Checks Only ~50 Instead of 100+

**This means:** Some check builders are failing

**Check which ones:**
```javascript
// In diagnose-audit.js output, look for check builders mentioned
// Then check that builder in gwtChecker.js for syntax errors
```

### Problem: Pages Say "0" Even After Wait

**Check the crawledPages:**
```bash
cd backend
node -e "
const mongoose = require('mongoose');
const AuditLog = require('./src/models/AuditLog');
mongoose.connect('mongodb://localhost:27017/gwt-audit-buddy').then(async () => {
  const audit = await AuditLog.findOne().sort({createdAt:-1}).lean();
  console.log('crawledPages:', audit.crawledPages);
  console.log('performance.pagesCrawled:', audit.performance?.pagesCrawled);
  process.exit(0);
});
"
```

If crawledPages is empty, the crawl failed. Check if website is accessible from your machine.

---

## 📊 Expected Results by Stage

### Stage 1: Backend Running
```
✅ npm start shows "Listening on port 5000"
✅ MongoDB connection successful
✅ No error messages on startup
```

### Stage 2: Audit Completes  
```
✅ Takes 30-120 seconds (not 2-3)
✅ Backend logs show all stages
✅ No timeout errors
✅ Returns 100+ checks minimum
```

### Stage 3: Data Stored in DB
```
✅ auditResults.checks: array of 100+ items
✅ crawledPages: array of URLs
✅ performance.pagesCrawled: > 0
✅ audits sorted by createdAt descending
```

### Stage 4: Frontend Displays
```
✅ Web Presence: 0-100%  (not always 0%)
✅ Web Usability: 0-100%  (not always 0%)
✅ Key Findings: populated with actual values
✅ Assessment forms: show Yes/No answers  
✅ Different sites show different results
```

---

## 🆘 Get Help Debugging

1. **Capture backend logs:**
   ```bash
   npm start > backend-logs.txt 2>&1
   # Run audit, then Ctrl+C to stop
   # Share backend-logs.txt contents
   ```

2. **Export audit from database:**
   ```bash
   cd backend
   node -e "
   const mongoose = require('mongoose');
   const AuditLog = require('./src/models/AuditLog');
   mongoose.connect('mongodb://localhost:27017/gwt-audit-buddy').then(async () => {
     const audit = await AuditLog.findOne().sort({createdAt:-1}).lean();
     console.log(JSON.stringify(audit, null, 2));
     process.exit(0);
   });
   " > audit-export.json
   ```

3. **Check MongoDB directly:**
   ```bash
   # Install MongoDB Compass (GUI) or use mongosh CLI
   # Connect to: mongodb://localhost:27017/gwt-audit-buddy
   # View: auditlogs collection
   # Export one document as JSON
   ```

---

## Quick Restart Guide

```bash
# Terminal 1: Stop old frontend
Ctrl+C

# Clear all npm/cache
npm run clean 2>/dev/null || true
rm -rf node_modules/.vite
rm -rf dist
rm -rf .next
rm -rf out

# Terminal 1: Start fresh frontend
npm install
npm run dev

# Terminal 2: Check backend
cd backend
npm start

# Once both running:
# Visit http://localhost:5080
# Run new audit
# Results should show data
```

---

## Success Indicators ✅

When everything is working:

1. ✅ Audit takes 45+ seconds (not 2 seconds)
2. ✅ Backend logs show "Audit checks generated: 100+" 
3. ✅ Frontend shows percentages (not all 0%)
4. ✅ Different websites have different results
5. ✅ Performance check shows load times
6. ✅ 404 check shows custom error page detection
7. ✅ Assessment forms populated with actual values
8. ✅ No JavaScript errors in browser console
9. ✅ Database contains 100+ checks per audit

Good luck! 🚀
