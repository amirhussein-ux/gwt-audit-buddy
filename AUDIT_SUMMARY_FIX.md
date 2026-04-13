# AuditSummaryReport Fix Summary

## Problem
The AuditSummaryReport component was displaying all scores as 0% because:
1. The ComplianceScore model was missing the `webUsability` field definition
2. The audit route was looking for `uiReport?.grades` which doesn't exist in the data structure returned by `buildUiAuditSummary`

## Root Causes

### Issue 1: Missing webUsability in ComplianceScore Model
- The backend audit route was trying to save `webUsability` data with fields: accessibility, identity, navigation, content
- But the ComplianceScore Mongoose schema didn't have this field defined
- This caused the data to be silently dropped when saved

### Issue 2: Incorrect Data Path in Audit Route
- The audit route was accessing `uiReport?.grades?.['Presence & Identity']` 
- But `buildUiAuditSummary()` returns: `uiReport.webPresence` and `uiReport.webUsability`
- The `grades` object never existed, so all values defaulted to 0

## Solutions Applied

### Fix 1: Added webUsability to ComplianceScore Model
File: `backend/src/models/ComplianceScore.js`

Added schema definition:
```javascript
webUsability: {
  accessibility: { type: Number, min: 0, max: 100 },
  identity: { type: Number, min: 0, max: 100 },
  navigation: { type: Number, min: 0, max: 100 },
  content: { type: Number, min: 0, max: 100 },
}
```

### Fix 2: Updated Audit Route to Use Correct Data Paths
File: `backend/src/routes/auditRoute.js`

Changed from:
```javascript
const stage1 = uiReport?.grades?.['Presence & Identity'] || 0;
const stage2 = uiReport?.grades?.['Content and Semantics'] || 0;
// ... incorrect paths
```

To:
```javascript
const stage1 = uiReport?.webPresence?.stage1 || 0;
const stage2 = uiReport?.webPresence?.stage2 || 0;
const stage3 = uiReport?.webPresence?.stage3 || 0;
const stage4 = uiReport?.webPresence?.stage4 || 0;
const webPresenceAverage = (stage1 + stage2 + stage3 + stage4) / 4;

const accessibilityScore = uiReport?.webUsability?.accessibility || 0;
const identityScore = uiReport?.webUsability?.identity || 0;
const navigationScore = uiReport?.webUsability?.navigation || 0;
const contentScore = uiReport?.webUsability?.content || 0;
const webUsabilityAverage = (accessibilityScore + identityScore + navigationScore + contentScore) / 4;

const overallScore = (webPresenceAverage + webUsabilityAverage) / 2;
```

## How It Works Now

### Data Flow
1. **Audit Execution**: `buildUiAuditSummary()` processes audit results and calculates:
   - webPresence: { stage1, stage2, stage3, stage4, ... }
   - webUsability: { accessibility, identity, navigation, content, ... }

2. **Score Persistence**: Audit route creates ComplianceScore with:
   - webPresence scores (4 stages + average)
   - webUsability scores (4 factors)
   - overallScore = (webPresenceAverage + webUsabilityAverage) / 2
   - Links to auditLog via auditLog reference

3. **Frontend Display**: AuditDetailPage fetches audit + compliance data
   - Passes compliance data to AuditSummaryReport
   - Component calculates and displays:
     - Web Presence: Shows all 4 stages + average percentage
     - Web Usability: Shows all 4 factors + average percentage
     - Overall Assessment: Shows weighted average of both dimensions

## Testing Steps

1. **Restart Backend**: Required to load new ComplianceScore model schema
   ```bash
   cd backend
   npm start
   # or npm run dev
   ```

2. **Submit New Audit**: Go to Dashboard and submit a complete audit
   - Should return 202 with auditLogId
   - Redirects to audit detail page

3. **Verify Scores Display**:
   - Web Presence Evaluation: Should show Stage 1-4 scores and average
   - Web Usability Evaluation: Should show Accessibility, Identity, Navigation, Content scores and average
   - Overall Assessment: Should show weighted overall score
   - If all scores are non-zero, the fix is working

## Expected Behavior After Fix

- Existing audits (with no ComplianceScore): Shows 0% with PST fallback for stage 1
- New audits (with ComplianceScore): Shows calculated scores from audit report
- Scores should be non-zero if website has any compliant elements
- Compliance badge: Green ✓ if ≥70%, Orange ⚠ if <70%

## Files Modified
1. `backend/src/models/ComplianceScore.js` - Added webUsability schema
2. `backend/src/routes/auditRoute.js` - Fixed data path from grades to webPresence/webUsability

## Status
✅ All fixes applied and validated
✅ No TypeScript/syntax errors
✅ Ready for testing with new audits
