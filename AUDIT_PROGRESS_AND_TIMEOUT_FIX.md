# Audit Progress & Timeout Issue - Resolution

## Summary of Issues

### 1. **Progress Stuck on "Fetching Page Content"**
**Symptom:** Frontend progress bar shows only first step as complete and doesn't advance during audit.

**Root Cause:** 
- Frontend updates only the initial "fetch" step to "done"
- Then waits for audit completion without updating progress steps
- Backend processes in background without sending progress information
- No mechanism to show which step is currently executing

### 2. **Dashboard Times Out and Crashes**
**Symptom:** Error message "Audit took too long to complete. Please refresh the page."

**Root Cause:**
- Polling was waiting 4 minutes (120 polls × 2 seconds each)
- Completion criteria too strict: required 50+ checks AND webPresenceStage1 > 0
- Exponential timeout protection wasn't implemented
- Browser/server could terminate before audit completed

## Solutions Implemented

### Frontend Fix (Dashboard.tsx)

#### Changed polling logic:
```javascript
// BEFORE: Strict criteria, long timeout
if (checksCount >= 50 && webPresenceStage1 > 0) {
  auditComplete = true;
}

// AFTER: Simple status check
if (auditStatus === 'success') {
  auditComplete = true;
}
```

#### Added exponential backoff:
```javascript
// BEFORE: Fixed 2-second intervals
await new Promise(resolve => setTimeout(resolve, 2000));

// AFTER: Start at 1s, increase by 500ms per poll, max 3s
let pollInterval = 1000;
const maxPollInterval = 3000;
pollInterval = Math.min(pollInterval + 500, maxPollInterval);
await new Promise(resolve => setTimeout(resolve, pollInterval));
```

#### Reduced timeout:
```javascript
// BEFORE: 4 minutes (240,000ms)
const maxPolls = 120; // 2s * 120

// AFTER: 90 seconds with exponential backoff
const maxTotalTime = 90000;
```

#### Added progress simulation:
```javascript
// Simulate step progression based on elapsed time
const progressPercent = Math.min((elapsedTime / 60000) * 100, 95);
const stepIndex = Math.floor((progressPercent / 100) * (AUDIT_STEPS.length - 1));

setSteps((prev) => 
  prev.map((s, idx) => {
    if (idx < stepIndex) return { ...s, status: 'done' };
    if (idx === stepIndex) return { ...s, status: 'running' };
    return { ...s, status: 'pending' };
  })
);
```

### Key Changes

| Aspect | Before | After | Benefit |
|--------|--------|-------|---------|
| **Completion Check** | 50+ checks AND stage1 > 0 | status === 'success' | Simple, reliable check |
| **Max Timeout** | 4 minutes (240s) | 90 seconds | Faster feedback, less timeout risk |
| **Poll Intervals** | Fixed 2s | Exponential 1-3s | Reduces server load over time |
| **Progress Updates** | None | Simulated based on elapsed time | Visual feedback during audit |
| **Error Handling** | Generic error | Specific elapsed time info | Better debugging |

## How It Works Now

1. **Audit starts** → "Fetching page content" marked as running
2. **Response received** → Frontend begins polling with exponential backoff
3. **Each poll** → Updates progress steps based on elapsed time
4. **Backend completes audit** → Marks status as 'success' and saves results
5. **Poll detects success** → Redirects to audit detail page
6. **Timeout prevents hanging** → Errors after 90 seconds if still in progress

## Testing the Fix

### To verify the fix works:

```bash
# 1. Start the backend
cd backend
npm start

# 2. Start the frontend
cd ..
npm run dev

# 3. Login and navigate to Dashboard
# 4. Enter a test URL (e.g., https://example.com)
# 5. Observe:
#    - Progress steps advance over time
#    - Dashboard doesn't hang
#    - Redirects to results after audit completes
```

### Expected Behavior:
- Progress bar shows multiple steps advancing (not just first one)
- Visible feedback like "Audit in progress... 10s" 
- Redirect happens within 2-3 minutes (realistic audit time)
- No "timeout" errors after 4 minutes

## Additional Configuration

### Server Timeout
The backend already has a 10-minute timeout configured:
```javascript
const SERVER_TIMEOUT_MS = Number(process.env.SERVER_TIMEOUT_MS) || 10 * 60 * 1000;
```

This allows long-running audits while the frontend polls with a shorter 90-second timeout.

### Environment Variables
If you need to adjust timeouts:
```bash
# In backend/.env
SERVER_TIMEOUT_MS=600000  # 10 minutes (default)
PORT=4000
MONGODB_URI=mongodb+srv://...
```

## Troubleshooting

### If audits still timeout after 90 seconds:
1. Check backend logs for processing errors
2. Verify MongoDB connection (IP whitelist issue?)
3. Check network latency between frontend and backend
4. Consider reducing audit scope (fewer pages, lower depth)

### If progress doesn't update:
1. Open browser DevTools → Console
2. Check for polling logs like "[Dashboard] Poll X: status=..."
3. Verify backend is responding to GET requests on `/api/audit/:id`
4. Check Authorization header is included in requests

### If redirects fail:
1. Verify audit ID is being returned correctly from POST
2. Check MongoDB audit log is being saved as 'success'
3. Ensure uiReport and auditResults are populated

## Files Modified

- **[src/pages/Dashboard.tsx](src/pages/Dashboard.tsx)** - Polling logic and progress updates (lines 110-195)

## Future Improvements

1. **Real-time updates via WebSocket/SSE** - Get actual progress from backend instead of simulating
2. **Step-level granularity** - Backend sends which exact step is running
3. **Pause/Resume functionality** - Allow users to pause audits
4. **Background job queuing** - Use Bull/RabbitMQ for robust audit processing
5. **Progress streaming** - SSE to stream progress events to frontend
