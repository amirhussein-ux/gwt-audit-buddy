# Pre-Made Accounts Quick Reference

## 🚀 Demo User (For Testing & Navigation)

Use this account to navigate and test the system:

```
Username: Amir Macakiling
Email: user@dict.gov.ph
Password: Temporary123@
Role: Admin (Full access)
```

**Quick Setup**: See [DEMO_USER.md](DEMO_USER.md) for MongoDB insertion instructions.

---

## Setup

**Manual MongoDB Insertion** - See [MANUAL_ACCOUNT_SETUP.md](MANUAL_ACCOUNT_SETUP.md) for detailed instructions.

**Quick Setup Options:**
1. **MongoDB Compass (GUI)** - Insert documents via UI
2. **MongoDB Shell (CLI)** - Run bulk insert command
3. **Node.js** - Programmatic insertion

---

## Login Credentials

### Admin Accounts (Full Access)
```
Username: admin
Email: admin@dict.gov.ph
Password: changeme123
Role: admin

---

Username: administrator
Email: administrator@dict.gov.ph
Password: changeme123
Role: admin
```

### Auditor Accounts (Can Run Audits)
```
Username: auditor1
Email: auditor1@dict.gov.ph
Password: changeme123
Role: auditor

---

Username: auditor2
Email: auditor2@dict.gov.ph
Password: changeme123
Role: auditor

---

Username: compliance_officer
Email: compliance.officer@dict.gov.ph
Password: changeme123
Role: auditor
```

### Viewer Accounts (Read-Only)
```
Username: viewer1
Email: viewer1@dict.gov.ph
Password: changeme123
Role: viewer

---

Username: viewer2
Email: viewer2@dict.gov.ph
Password: changeme123
Role: viewer

---

Username: supervisor
Email: supervisor@dict.gov.ph
Password: changeme123
Role: viewer
```

---

## Role Permissions

| Permission | Admin | Auditor | Viewer |
|-----------|-------|---------|--------|
| View audit results | ✓ | ✓ | ✓ |
| Run audits | ✓ | ✓ | ✗ |
| Manage users | ✓ | ✗ | ✗ |
| Access all features | ✓ | ◐ | ✗ |

---

## API Testing Examples

### Login with cURL
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"auditor1","password":"changeme123"}'
```

### Verify Token
```bash
curl -X GET http://localhost:4000/api/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

⚠️ **SECURITY**: Change all default passwords in production!
