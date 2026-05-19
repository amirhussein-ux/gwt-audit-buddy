# Pre-Made Accounts Quick Reference

⚠️ **SECURITY NOTICE**: Credentials are **NOT** stored in this file for security reasons.

---

## Quick Setup for Demo

### Automated Setup (Recommended)
```bash
# Create a pre-verified demo user
cd backend
node seed.js
```

The console will display the created credentials. These are environment-specific and not stored in version control.

### Environment Variables
Demo credentials can be provided through environment variables:

**.env.local** (development only, never commit):
```env
VITE_DEMO_EMAIL=user@dict.gov.ph
VITE_DEMO_PASSWORD=YourSecurePassword123!
VITE_SHOW_DEMO_CREDENTIALS=true
```

**Production**: Do NOT set `VITE_SHOW_DEMO_CREDENTIALS` - demo credentials will not be displayed.

---

## Manual Account Creation

### MongoDB Insertion
See [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md) for detailed instructions on creating accounts:

1. **MongoDB Compass (GUI)** - Insert documents via UI
2. **MongoDB Shell (CLI)** - Run bulk insert command  
3. **Node.js** - Programmatic insertion via scripts

### Required Fields for User Documents

When manually creating accounts, include these fields:

```javascript
{
  "username": "account_username",      // Unique identifier
  "email": "user@dict.gov.ph",         // Must be unique
  "hashedPassword": "hashed_value",    // Will be hashed if plain text
  "role": "admin|auditor|viewer",      // User role
  "isActive": true,                     // Account status
  "isEmailVerified": true,              // Email verification status 
  "createdAt": ISODate(),               // Account creation timestamp
  "updatedAt": ISODate()                // Last update timestamp
}
```

---

## Role Permissions

| Permission | Admin | Auditor | Viewer |
|-----------|-------|---------|--------|
| View audit results | ✓ | ✓ | ✓ |
| Run audits | ✓ | ✓ | ✗ |
| Manage users | ✓ | ✗ | ✗ |
| Download reports | ✓ | ✓ | ✓ |
| Access all features | ✓ | ◐ | ✗ |

---

## Security Best Practices

✅ **DO:**
- Store credentials in environment variables (`.env.local` for development)
- Use strong, unique passwords
- Change demo passwords immediately for production
- Never commit `.env` files to version control
- Rotate secrets regularly

❌ **DON'T:**
- Hardcode credentials in source code
- Share credentials in chat or email
- Commit secrets to git (even in old commits)
- Use default passwords in production
- Log or display sensitive information

---

## Troubleshooting

**Can't see demo credentials on login page?**
- Ensure `VITE_SHOW_DEMO_CREDENTIALS=true` in `.env.local`
- Clear browser cache and hard refresh
- Check browser console for errors

**Demo user not created?**
- Verify MongoDB connection in `.env`
- Check backend logs: `node seed.js` should output status messages
- Ensure User model is properly imported

---

See [SECURITY_REFACTORING_COMPLETE.md](SECURITY_REFACTORING_COMPLETE.md) for authentication security details.

---

## API Testing Examples

### Login with cURL
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"auditor1","password":"<your_password>"}'
```

### Verify Token
```bash
curl -X GET http://localhost:4000/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

⚠️ **SECURITY**: Change all default passwords in production!
