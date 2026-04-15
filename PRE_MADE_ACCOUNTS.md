# Pre-Made User Accounts - GWT Audit System

## Overview

The GWT Audit System includes pre-made government user accounts to simplify initial setup and testing. All accounts follow the email format `username@dict.gov.ph` (DICT = Department of Information and Communications Technology, Philippines).

**⚠️ IMPORTANT**: All pre-made accounts use the default password `changeme123`. You **MUST** change these passwords immediately in production before deploying to live servers.

---

## Creating Pre-Made Accounts

Pre-made accounts are **manually added to MongoDB** for explicit control over account creation.

### Option 1: MongoDB Compass (GUI) - Easiest

1. Open **MongoDB Compass**
2. Connect to your MongoDB instance
3. Navigate to `gwt_audit_db` → `users` collection
4. Click **INSERT DOCUMENT**
5. Copy-paste the account JSON from [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md)
6. Repeat for each account

### Option 2: MongoDB Shell (CLI)

```bash
mongosh "your-mongodb-connection-string/gwt_audit_db"
```

Then paste the bulk insert command from [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md#insert-all-at-once)

### Option 3: Programmatically (Node.js)

See [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md#using-mongoosem-nodejs) for code examples

---

## Pre-Made Accounts

### Admin Accounts (Full Access)

| Username | Email | Password | Role | Description |
|----------|-------|----------|------|-------------|
| `admin` | `admin@dict.gov.ph` | `changeme123` | admin | System Administrator |
| `administrator` | `administrator@dict.gov.ph` | `changeme123` | admin | System Administrator |

**Permissions**:
- View all audit results
- Run new audits
- Manage user accounts
- Access all system features
- View reports and analytics

---

### Auditor Accounts (Audit & Report Access)

| Username | Email | Password | Role | Description |
|----------|-------|----------|------|-------------|
| `auditor1` | `auditor1@dict.gov.ph` | `changeme123` | auditor | Government Auditor |
| `auditor2` | `auditor2@dict.gov.ph` | `changeme123` | auditor | Government Auditor |
| `compliance_officer` | `compliance.officer@dict.gov.ph` | `changeme123` | auditor | Compliance Officer |

**Permissions**:
- Run audits on government websites
- View and manage audit results
- Generate compliance reports
- Cannot manage user accounts

---

### Viewer Accounts (Read-Only Access)

| Username | Email | Password | Role | Description |
|----------|-------|----------|------|-------------|
| `viewer1` | `viewer1@dict.gov.ph` | `changeme123` | viewer | Government Official |
| `viewer2` | `viewer2@dict.gov.ph` | `changeme123` | viewer | Government Official |
| `supervisor` | `supervisor@dict.gov.ph` | `changeme123` | viewer | Audit Supervisor |

**Permissions**:
- View audit results and reports
- Cannot run new audits
- Cannot modify any data
- Read-only access only

---

## Security Considerations

### Default Password ⚠️

All pre-made accounts use `changeme123` for initial setup. This is **insecure** and should be changed immediately:

1. **For Development**: You can keep the default password during development/testing
2. **For Staging**: Change passwords before moving to staging environment
3. **For Production**: Change ALL passwords before deploying to production

### Changing Passwords

Currently, this system doesn't have a built-in password change UI. To change a password:

1. **Option A**: Delete the user and re-seed with a new password (not recommended)
2. **Option B**: Implement a password change endpoint in the API
3. **Option C**: Directly update the database with a hashed password

### Adding Additional Users

To add new users in production:

1. **Manually**: Update `backend/seed.js` with new user data and run `node seed.js`
2. **API-Based**: Implement a `/auth/register` endpoint (currently not implemented)
3. **Admin Panel**: Build a user management UI (future enhancement)

---

## Testing the Accounts

### Login Via Frontend

1. Start the backend: `cd backend && npm start`
2. Start the frontend: `npm run dev`
3. Navigate to login page
4. Try logging in with different accounts:

```
Email: admin@dict.gov.ph
Password: changeme123
```

### Test via API

```bash
# Login
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "auditor1", "password": "changeme123"}'

# Response:
{
  "token": "abc123...",
  "user": {
    "id": "...",
    "username": "auditor1",
    "email": "auditor1@dict.gov.ph",
    "role": "auditor"
  },
  "expiresIn": "24h"
}

# Verify token
curl -X GET http://localhost:4000/api/auth/verify \
  -H "Authorization: Bearer abc123..."

# Response:
{
  "valid": true,
  "user": {
    "username": "auditor1",
    "role": "auditor"
  },
  "expiresIn": 86400
}
```

---

## Account Lifecycle

### Creation
- Run `node backend/seed.js` to create pre-made accounts
- Script checks for existing accounts and only creates missing ones
- Safe to run multiple times

### Active Use
- Each user has a 24-hour session token
- Sessions automatically expire after 24 hours
- Users must log in again after expiration
- Account lock-out after 5 failed login attempts (30-minute lock duration)

### Deletion
- To delete a user, modify MongoDB directly or build a delete endpoint
- Alternatively, set `isActive: false` to deactivate without deleting

### Reset
- To reset all users: Delete the MongoDB database and re-run seed script

---

## Production Checklist

Before deploying to production:

- [ ] Change all pre-made account passwords
- [ ] Disable account creation/deletion endpoints (if built)
- [ ] Enable HTTPS for all authentication endpoints
- [ ] Implement audit logging for login attempts
- [ ] Set up session management (Redis instead of in-memory)
- [ ] Implement proper password hashing (currently using PBKDF2)
- [ ] Add rate limiting to login endpoint
- [ ] Set up automated backups
- [ ] Document actual user credentials and store securely
- [ ] Implement 2FA for admin accounts

---

## Troubleshooting

### "Account is temporarily locked"

The account has had 5 failed login attempts. Wait 30 minutes or delete the user from MongoDB and re-run the seed script.

### "Invalid username or password"

- Check that username and password are correct
- Verify email format: `username@dict.gov.ph`
- Check that the user was created: query MongoDB

### Token Expired Error

Sessions expire after 24 hours. User must log in again.

### "No users created"

- Check that MongoDB is running and `MONGODB_URI` is correct
- Verify users don't already exist in the database
- Check for errors in console output during seed script

---

## Related Files

- **Seed Script**: [backend/seed.js](backend/seed.js)
- **User Model**: [backend/src/models/User.js](backend/src/models/User.js)
- **Auth Routes**: [backend/src/routes/authRoute.js](backend/src/routes/authRoute.js)
- **Auth Middleware**: [backend/src/middleware/auth.js](backend/src/middleware/auth.js)
- **Frontend Auth**: [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
