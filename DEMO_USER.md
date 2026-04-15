# Demo User - Quick Navigation

Quick credentials for testing and navigating the GWT Audit System.

## Demo Account

| Field | Value |
|-------|-------|
| **Username** | Amir Macakiling |
| **Email** | user@dict.gov.ph |
| **Password** | Temporary123@ |
| **Role** | Flexible Access |

---

## Quick Login

### Frontend Login
1. Navigate to the login page
2. Enter credentials:
   - **Email**: `user@dict.gov.ph`
   - **Password**: `Temporary123@`
3. Click **Login**

### API Test Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "Amir Macakiling",
    "password": "Temporary123@"
  }'
```

**Response:**
```json
{
  "token": "abc123...",
  "user": {
    "id": "...",
    "username": "Amir Macakiling",
    "email": "user@dict.gov.ph",
    "role": "..."
  },
  "expiresIn": "24h"
}
```

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
