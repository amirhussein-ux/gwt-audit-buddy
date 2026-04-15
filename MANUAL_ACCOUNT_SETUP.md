# Manual Pre-Made Account Setup

⚠️ **SECURITY NOTICE**: Demo credentials are **NOT** stored in this file. Use setup scripts instead.

---

## Quick Start

Use the automated setup scripts instead of manual insertion:

```bash
# Create pre-verified demo user with all required fields
cd backend
node seed.js
```

This is **easier**, **more secure**, and **automatically handles password hashing**.

---

## MongoDB Connection (Manual Method)

If you prefer manual setup, here are the connection options:

### Using MongoDB Compass (GUI)

1. Open **MongoDB Compass**
2. Connect to your MongoDB instance using `MONGODB_URI` from `.env`
3. Navigate to: `gwt_audit_db` → `users` collection
4. Click **INSERT DOCUMENT**
5. Enter user data (see template below)

### Using MongoDB Shell (CLI)

```bash
# Connect to MongoDB
mongosh "mongodb://your-connection-string/gwt_audit_db"

# Then create documents using the template below
```

### Using Node.js/Mongoose

```javascript
const mongoose = require('mongoose');
const User = require('./src/models/User');

await mongoose.connect(process.env.MONGODB_URI);

const user = new User({
  username: 'example_user',
  email: 'user@dict.gov.ph',
  hashedPassword: 'NEVER_HARDCODE_PASSWORDS',  // Will be hashed by pre-save middleware
  role: 'auditor',
  isActive: true,
});

await user.save();
console.log('User created:', user._id);
```

---

## User Document Template

When manually creating accounts, use this template structure:

### Basic Template

```json
{
  "username": "your_username",
  "email": "user@dict.gov.ph",
  "hashedPassword": "[YOUR_SECURE_PASSWORD]",
  "role": "admin|auditor|viewer",
  "isActive": true,
  "isEmailVerified": true,
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

### Complete Template (All Fields)

```json
{
  "username": "your_username",
  "email": "user@dict.gov.ph",
  "hashedPassword": "[YOUR_SECURE_PASSWORD]",
  "role": "admin",
  "isActive": true,
  "isEmailVerified": true,
  "emailVerificationToken": null,
  "emailVerificationTokenExpires": null,
  "passwordResetToken": null,
  "passwordResetTokenExpires": null,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null,
  "createdAt": new Date(),
  "updatedAt": new Date()
}
```

---

## Creating Test Accounts

### Step 1: Generate Secure Password
For testing, create a strong password:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Step 2: Insert via MongoDB Compass

1. Navigate to `gwt_audit_db` → `users` collection
2. Click **INSERT DOCUMENT**
3. Paste and modify the template above:
   - Replace `your_username` with actual username
   - Replace `[YOUR_SECURE_PASSWORD]` with your generated password
   - Set `email` to unique value
   - Set `role` appropriately

### Step 3: Verify in Frontend

- Restart backend: `npm start`
- Navigate to login page
- Try logging in with the email and password you set

---

## Role Reference

| Role | Permissions |
|------|------------|
| `admin` | Full access - manage users, run audits, view all data |
| `auditor` | Run audits, view results, download reports |
| `viewer` | View-only access to audit results |

---

## ⚠️ Important Security Notes

**Never:**
- Hardcode passwords in documentation
- Store credentials in version control
- Share passwords via email or chat
- Use weak/default passwords like `password123`

**Always:**
- Use strong, randomly generated passwords
- Store credentials in environment variables
- Change demo passwords immediately in production
- Use the seed.js script for consistent setup

---

## Troubleshooting

**Password not working?**
- Verify the password during account creation
- MongoDB doesn't auto-hash - the User model's pre-save middleware handles it
- Check that `isEmailVerified: true` is set
- Review backend logs for errors

**Can't find users collection?**
- Ensure you're in the correct database (`gwt_audit_db`)
- Create the collection first if it doesn't exist: `db.createCollection('users')`

**Need to change a password?**
- For security, don't update `hashedPassword` directly
- Delete the user and recreate with new password
- Or use the password reset feature in the application

---

See [ACCOUNTS_QUICK_REF.md](ACCOUNTS_QUICK_REF.md) for role permissions.
See [SECURITY_REFACTORING_COMPLETE.md](SECURITY_REFACTORING_COMPLETE.md) for security details.

```json
{
  "username": "admin",
  "email": "admin@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "admin",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "admin",
  "email": "admin@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "admin",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Admin Account 2

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "administrator",
  "email": "administrator@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "admin",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "administrator",
  "email": "administrator@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "admin",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Auditor Account 1

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "auditor1",
  "email": "auditor1@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "auditor",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "auditor1",
  "email": "auditor1@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "auditor",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Auditor Account 2

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "auditor2",
  "email": "auditor2@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "auditor",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "auditor2",
  "email": "auditor2@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "auditor",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Auditor Account 3

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "compliance_officer",
  "email": "compliance.officer@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "auditor",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "compliance_officer",
  "email": "compliance.officer@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "auditor",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Viewer Account 1

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "viewer1",
  "email": "viewer1@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "viewer",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "viewer1",
  "email": "viewer1@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "viewer",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Viewer Account 2

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "viewer2",
  "email": "viewer2@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "viewer",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "viewer2",
  "email": "viewer2@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "viewer",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

### Viewer Account 3

**MongoDB Compass**: Copy and insert this JSON

```json
{
  "username": "supervisor",
  "email": "supervisor@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "viewer",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

**MongoDB Shell**:

```javascript
db.users.insertOne({
  "username": "supervisor",
  "email": "supervisor@dict.gov.ph",
  "hashedPassword": "changeme123",
  "role": "viewer",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

---

## Insert All at Once

### MongoDB Shell (Bulk Insert)

```javascript
db.users.insertMany([
  {
    "username": "Amir Macakiling",
    "email": "user@dict.gov.ph",
    "hashedPassword": "Temporary123@",
    "role": "admin",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "admin",
    "email": "admin@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "admin",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "administrator",
    "email": "administrator@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "admin",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "auditor1",
    "email": "auditor1@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "auditor",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "auditor2",
    "email": "auditor2@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "auditor",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "compliance_officer",
    "email": "compliance.officer@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "auditor",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "viewer1",
    "email": "viewer1@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "viewer",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "viewer2",
    "email": "viewer2@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "viewer",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  },
  {
    "username": "supervisor",
    "email": "supervisor@dict.gov.ph",
    "hashedPassword": "changeme123",
    "role": "viewer",
    "isActive": true,
    "loginAttempts": 0,
    "lockUntil": null,
    "lastLogin": null
  }
]);
```

---

## Important Notes

### Password Hashing

- Passwords are **NOT** stored in plain text in MongoDB
- The User model (User.js) has a **pre-save middleware** that automatically hashes passwords
- When you insert `"hashedPassword": "changeme123"`, it gets hashed before storage
- The password field is marked with `select: false`, so it won't be returned in API responses

### Verification After Insert

Verify accounts were created:

```javascript
// MongoDB Shell
db.users.find({}, { username: 1, email: 1, role: 1 });

// Should output something like:
// { _id: ObjectId(...), username: 'admin', email: 'admin@dict.gov.ph', role: 'admin' }
// { _id: ObjectId(...), username: 'auditor1', email: 'auditor1@dict.gov.ph', role: 'auditor' }
// ... etc
```

### Testing Login

Once accounts are inserted, test login:

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"changeme123"}'

# Should return:
# {
#   "token": "abc123...",
#   "user": {
#     "id": "...",
#     "username": "admin",
#     "email": "admin@dict.gov.ph",
#     "role": "admin"
#   },
#   "expiresIn": "24h"
# }
```

---

## Updating Accounts

### Update Password

```javascript
// MongoDB Shell
db.users.updateOne(
  { username: 'admin' },
  { $set: { hashedPassword: 'newpassword123' } }
);
```

**Note**: The new password will be hashed when you next use the API login or when you call `.save()` on the User model.

### Update Role

```javascript
// MongoDB Shell
db.users.updateOne(
  { username: 'auditor1' },
  { $set: { role: 'admin' } }
);
```

### Deactivate Account

```javascript
// MongoDB Shell
db.users.updateOne(
  { username: 'viewer1' },
  { $set: { isActive: false } }
);
```

### Reset Failed Login Attempts

```javascript
// MongoDB Shell
db.users.updateOne(
  { username: 'admin' },
  { $set: { loginAttempts: 0, lockUntil: null } }
);
```

---

## Deleting Accounts

```javascript
// Delete one user
db.users.deleteOne({ username: 'viewer1' });

// Delete all users (⚠️ USE WITH CAUTION!)
db.users.deleteMany({});
```

---

## Reference: Account Fields

| Field | Type | Description |
|-------|------|-------------|
| `username` | String | Unique identifier (3+ chars) |
| `email` | String | Unique, format: `name@dict.gov.ph` |
| `hashedPassword` | String | Password (auto-hashed on save) |
| `role` | String | `admin`, `auditor`, or `viewer` |
| `isActive` | Boolean | Account enabled (default: true) |
| `loginAttempts` | Number | Failed login count (resets after success) |
| `lockUntil` | Date | Account locked until (null if not locked) |
| `lastLogin` | Date | Last successful login (null if never) |
| `createdAt` | Date | Account creation timestamp |
| `updatedAt` | Date | Last update timestamp |

---

## Related Files

- [PRE_MADE_ACCOUNTS.md](PRE_MADE_ACCOUNTS.md) - Account list and permissions
- [ACCOUNTS_QUICK_REF.md](ACCOUNTS_QUICK_REF.md) - Quick login reference
- [backend/src/models/User.js](backend/src/models/User.js) - User model & password hashing
- [backend/src/routes/authRoute.js](backend/src/routes/authRoute.js) - Login/logout endpoints
