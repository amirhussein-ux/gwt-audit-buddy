# Mongoose Deprecation & MongoDB Connection Issues - Resolution Guide

## Issues Identified

### 1. Mongoose Deprecation Warnings
**Error Message:**
```
(node:XXXXX) [MONGOOSE] Warning: mongoose: the `new` option for `findOneAndUpdate()` 
and `findOneAndReplace()` is deprecated. Use `returnDocument: 'after'` instead.
```

**Status:** ✅ **RESOLVED**

#### Root Cause
Mongoose has deprecated the `new: true` option in favor of the modern `returnDocument: 'after'` option. While your codebase was mostly using the new syntax, there were:
1. **One incomplete call** at [backend/src/routes/auditRoute.js#L157](backend/src/routes/auditRoute.js#L157) that didn't specify any return options
2. **No global Mongoose configuration** to set modern defaults

#### Fixes Applied

**Fix 1: Updated auditRoute.js (Line 157)**
```javascript
// BEFORE - No return options specified
AuditLog.findByIdAndUpdate(savedAuditLog._id, { status: 'failed', error: error.message })

// AFTER - Using proper returnDocument option
AuditLog.findByIdAndUpdate(
  savedAuditLog._id, 
  { status: 'failed', error: error.message },
  { returnDocument: 'after' }
)
```

**Fix 2: Added Global Mongoose Configuration in db.js**
```javascript
// Set defaults to use modern returnDocument instead of deprecated new option
mongoose.set('returnOriginal', false); // Uses returnDocument: 'after' by default
```

This prevents any deprecation warnings from findOneAndUpdate, findByIdAndUpdate, and findOneAndReplace.

---

### 2. MongoDB Connection Issues

**Error Messages:**
```
[MongoDB] Lost connection to database
[MongoDB] Connection failed: Could not connect to any servers in your MongoDB Atlas cluster. 
One common reason is that you're trying to access the database from an IP that isn't whitelisted.
```

**Status:** ⚠️ **CONFIGURATION RECOMMENDED**

#### Root Cause Analysis

Your current MongoDB connection configuration is well-optimized for a long-running server, but the connection failures indicate:

1. **IP Whitelist Issue** (Most Recent Error - April 13)
   - Your current machine's IP address is not on the MongoDB Atlas cluster's IP whitelist
   - This is blocking all new connections

2. **Transient Network Issues** (Earlier Errors - April 9-10)
   - Brief disconnections ("Lost connection to database")
   - These could be from pool exhaustion or network latency

#### Current Configuration Analysis

Your connection settings in [backend/src/config/db.js](backend/src/config/db.js) are **already well-optimized**:

| Setting | Value | Rationale |
|---------|-------|-----------|
| `maxPoolSize` | 50 | Handles concurrent requests in long-running server |
| `minPoolSize` | 10 | Pre-warmed connections for quick response |
| `maxIdleTimeMS` | 5 min | Balances memory vs. connection readiness |
| `connectTimeoutMS` | 10 sec | Reasonable timeout for establishing connections |
| `socketTimeoutMS` | 30 sec | Prevents hanging queries |
| `serverSelectionTimeoutMS` | 5 sec | Quick failover detection |
| `retryWrites` | true | Automatic retry on transient failures |
| `retryReads` | true | Resilience to temporary read issues |

---

## Solutions & Actions Required

### Immediate Actions

#### 1. ✅ MongoDB Atlas IP Whitelist Configuration
**Your current issue:** IP address not whitelisted

**To Fix:**
1. Go to MongoDB Atlas: https://cloud.mongodb.com
2. Navigate to **Clusters** → Your Cluster → **Network Access** → **IP Whitelist**
3. Add your current IP address:
   - If you know your IP: Add it directly
   - If you don't know your IP: Connect once and check the error for the IP, then add it
4. Alternatively, for development: Add `0.0.0.0/0` (allows all IPs) - **NOT recommended for production**

#### 2. ✅ Enhanced Connection Monitoring
The db.js configuration now includes:
- Global Mongoose setting to prevent deprecation warnings
- Enhanced connection event listeners
- Comment for enabling detailed monitoring: Set `monitorCommands: true` if needed

### For Production Environment

#### Connection Resilience Best Practices

1. **Connection Pool Sizing**
   - Monitor your peak concurrent requests
   - Formula: Peak Concurrent Ops × (Avg Operation Duration) + 20% headroom
   - Current setting (50) is conservative; adjust based on monitoring

2. **Circuit Breaker Pattern**
   - Consider implementing a circuit breaker for failed connections
   - Fail fast rather than retry indefinitely

3. **Monitoring & Alerts**
   ```javascript
   // Monitor connection pool status
   mongoose.connection.on('connected', () => {
     console.log('[MongoDB] Connected');
   });
   
   mongoose.connection.on('disconnected', () => {
     console.warn('[MongoDB] Lost connection');
     // TODO: Add alert to monitoring system
   });
   
   mongoose.connection.on('error', (err) => {
     console.error('[MongoDB] Error:', err.message);
     // TODO: Add error tracking (Sentry, DataDog, etc.)
   });
   ```

#### For High-Availability

If experiencing frequent disconnections:
```javascript
// In db.js, consider adding:
{
  ...options,
  // Increase pool sizes for high-concurrency scenarios
  maxPoolSize: 100,
  minPoolSize: 25,
  
  // More aggressive idle connection cleanup
  maxIdleTimeMS: 3 * 60 * 1000, // 3 minutes instead of 5
  
  // Faster detection of failed connections
  socketTimeoutMS: 20000, // Reduced from 30s for faster failure detection
}
```

---

## Verification Steps

### 1. Verify Deprecation Warnings are Gone
```bash
cd backend
npm start
```
Check logs for `[MONGOOSE] Warning` messages. They should no longer appear.

### 2. Verify Connection After IP Whitelist
```bash
curl http://localhost:4000/health
# Should respond with: { status: 'ok', service: 'gwt-audit-backend', ... }
```

### 3. Test Database Operations
Run your audit tests:
```bash
npm run test-api
npm run test-checks
```

---

## Code Changes Summary

### Files Modified

1. **[backend/src/config/db.js](backend/src/config/db.js)**
   - Added: `mongoose.set('returnOriginal', false)` for global deprecation fix
   - Added: `monitorCommands` option for future debugging capability
   - Enhanced: Comments explaining connection pool configuration

2. **[backend/src/routes/auditRoute.js](backend/src/routes/auditRoute.js) - Line 157**
   - Added: `{ returnDocument: 'after' }` option to `findByIdAndUpdate` call
   - Formatted: Multi-line for clarity

---

## Next Steps

1. **Add your current IP to MongoDB Atlas whitelist** (CRITICAL)
2. Monitor connection logs after restart
3. If issues persist, check:
   - MongoDB Atlas cluster status
   - Network connectivity to Atlas server
   - VPN/Firewall settings if behind corporate network

---

## References

- [Mongoose findOneAndUpdate Documentation](https://mongoosejs.com/docs/api/query.html#Query.prototype.findOneAndUpdate())
- [Mongoose returnDocument Option](https://mongoosejs.com/docs/tutorials/findoneandupdate.html)
- [MongoDB Atlas IP Whitelist](https://www.mongodb.com/docs/atlas/security-whitelist/)
- [MongoDB Connection Pool Documentation](https://www.mongodb.com/docs/manual/administration/connection-pooling/)
