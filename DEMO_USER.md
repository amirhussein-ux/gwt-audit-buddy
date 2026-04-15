# Demo User Setup Guide

⚠️ **SECURITY NOTICE**: Demo credentials are **NOT** stored in this file. See setup instructions below.

---

## Quick Setup

To get demo credentials for testing:

### Option 1: Run the Setup Script (Recommended)
```bash
cd backend
node seed.js
```

This creates a pre-configured demo user with verified email. Check the console output for credentials.

### Option 2: Use Environment Variables
Demo credentials can be configured via environment variables:
- `VITE_DEMO_EMAIL` - Demo user email
- `VITE_DEMO_PASSWORD` - Demo user password
- `VITE_SHOW_DEMO_CREDENTIALS` - Show demo credentials box (set to "true" in dev only)

Set these in `.env.local` (never commit to git):
```env
VITE_DEMO_EMAIL=user@dict.gov.ph
VITE_DEMO_PASSWORD=YourSecurePassword123!
VITE_SHOW_DEMO_CREDENTIALS=true
```

---

## Manual MongoDB Insertion

For manual setup, see [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md).

**Important**: 
- Never commit real credentials to version control
- Change demo passwords immediately in production
- Use strong, unique passwords for each environment

---

## MongoDB Insertion

Add this demo user to your MongoDB database:

### MongoDB Compass (GUI)

Copy and paste this JSON into the `users` collection:

```json
{
  "username": "Amir Macakiling",
  "email": "user@dict.gov.ph",
  "hashedPassword": "Temporary123@",
  "role": "admin",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
}
```

### MongoDB Shell (CLI)

```javascript
db.users.insertOne({
  "username": "Amir Macakiling",
  "email": "user@dict.gov.ph",
  "hashedPassword": "Temporary123@",
  "role": "admin",
  "isActive": true,
  "loginAttempts": 0,
  "lockUntil": null,
  "lastLogin": null
});
```

### Node.js

```javascript
const mongoose = require('mongoose');
const User = require('./src/models/User');

await mongoose.connect(process.env.MONGODB_URI);

const demoUser = new User({
  username: 'Amir Macakiling',
  email: 'user@dict.gov.ph',
  hashedPassword: 'Temporary123@',
  role: 'admin' // or 'auditor', 'viewer' as needed
});

await demoUser.save();
console.log('Demo user created:', demoUser);
```

---

## Features Accessible

With this demo account, you can:

✅ View all audit results  
✅ Run new audits  
✅ Generate compliance reports  
✅ Access all system features  
✅ Manage user data  

---

## Troubleshooting

**"Invalid username or password"**
- Ensure MongoDB has the account inserted
- Verify the credentials match exactly (case-sensitive)
- Check the password hashing in User.js

**"Account is temporarily locked"**
- 5 failed login attempts lock the account for 30 minutes
- Delete and re-insert the account to reset
- Or update: `db.users.updateOne({ email: 'user@dict.gov.ph' }, { $set: { loginAttempts: 0, lockUntil: null } })`

**Token Expired**
- Sessions expire after 24 hours
- Log in again to get a new token

---

## Related Files

- [ACCOUNTS_QUICK_REF.md](ACCOUNTS_QUICK_REF.md) - All pre-made accounts
- [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md) - Detailed setup instructions
- [PRE_MADE_ACCOUNTS.md](PRE_MADE_ACCOUNTS.md) - Complete documentation
- [backend/src/models/User.js](backend/src/models/User.js) - User model
- [backend/src/routes/authRoute.js](backend/src/routes/authRoute.js) - Auth endpoints
