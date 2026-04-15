# Authentication Security Testing Guide

**Purpose**: Verify all security features are working correctly  
**Time**: ~15 minutes  
**Requires**: Backend running, Postman or curl

---

## Pre-Test Setup

```bash
# Terminal 1: Start backend
cd backend
npm install  # If not done yet
npm start

# Should see:
# [GWT] Backend listening on port 4000 (PID: xxxxx)
# [GWT] Environment: development
# [GWT] CORS Origins: http://localhost:5173,http://localhost:3000
```

---

## Test 1: CORS Restriction

**Purpose**: Verify CORS only allows whitelisted origins

```bash
# This should FAIL (not in ALLOWED_ORIGINS)
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Origin: http://attacker.com" \
  -H "Content-Type: application/json" \
  -H "Access-Control-Request-Method: POST"

# Expected: CORS error (no Access-Control-Allow-Origin header)

# This should SUCCEED (whitelisted)
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"wrong"}'

# Expected: 401 Unauthorized (but CORS allowed)
```

---

## Test 2: Registration & Email Verification

**Purpose**: Verify email verification system

### Step 1: Register User

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser123",
    "email": "testuser@example.com",
    "password": "SecurePass123!"
  }'

# Expected Response:
# {
#   "message": "Registration successful. Please check your email to verify your account.",
#   "user": {
#     "id": "...",
#     "username": "testuser123",
#     "email": "testuser@example.com",
#     "role": "viewer",
#     "isEmailVerified": false
#   }
# }
```

### Step 2: Check Email Service Log

In backend console, look for:
```
[EmailService] Verification email sent to testuser@example.com
```

If SMTP not configured:
```
[EmailService] Email service not configured - skipping verification email
```

### Step 3: Try Login (Should Fail)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!"
  }'

# Expected Response (401):
# {
#   "error": "Please verify your email before logging in",
#   "code": "EMAIL_NOT_VERIFIED"
# }
```

### Step 4: Get Verification Token

In backend console, find the generated token in the registration output or check MongoDB:

```javascript
// Check in MongoDB
db.users.findOne({ email: "testuser@example.com" }, { emailVerificationToken: 1 })
```

### Step 5: Verify Email

```bash
curl -X POST http://localhost:4000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "token": "<token-from-step-4>"
  }'

# Expected Response (200):
# {
#   "message": "Email verified successfully",
#   "user": {
#     "id": "...",
#     "email": "testuser@example.com",
#     "isEmailVerified": true
#   }
# }
```

### Step 6: Login (Should Succeed)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!"
  }'

# Expected Response (200):
# {
#   "token": "hexadecimal-string-here",
#   "user": { ... },
#   "expiresIn": "24h"
# }
```

---

## Test 3: Token Extraction Security

**Purpose**: Verify tokens can ONLY come from Authorization header

### Test 3A: Token in Query String (Should FAIL)

```bash
FAKE_TOKEN="abc123def456"

curl -X GET "http://localhost:4000/api/auth/me?token=$FAKE_TOKEN" \
  -H "Content-Type: application/json"

# Expected Response (401):
# {
#   "error": "No authentication token provided",
#   "code": "NO_TOKEN"
# }
```

### Test 3B: Token in Body (Should FAIL)

```bash
curl -X GET http://localhost:4000/api/auth/me \
  -H "Content-Type: application/json" \
  -d '{"token": "abc123def456"}'

# Expected Response (401):
# {
#   "error": "No authentication token provided",
#   "code": "NO_TOKEN"
# }
```

### Test 3C: Token in Header (Should SUCCEED)

```bash
# First, get a valid token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"SecurePass123!"}' \
  | jq -r '.token')

# Now use it in header
curl -X GET http://localhost:4000/api/auth/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# Expected Response (200):
# {
#   "user": {
#     "id": "...",
#     "username": "testuser123",
#     "email": "testuser@example.com",
#     "role": "viewer"
#   }
# }
```

---

## Test 4: Rate Limiting

**Purpose**: Verify rate limiting prevents brute force attacks

### Test 4A: Rapid Login Attempts

```bash
# Make 6 login attempts in quick succession
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "testuser@example.com",
      "password": "wrong-password"
    }' | jq '.error,.code'
done

# Expected:
# Attempts 1-5: "Invalid email or password"
# Attempt 6: "Too many login attempts, please try again later." (429)
```

### Test 4B: Rate Limit Headers

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"testuser@example.com","password":"wrong"}'

# Look for headers:
# RateLimit-Limit: 5
# RateLimit-Remaining: 4
# RateLimit-Reset: <unix-timestamp>
```

---

## Test 5: Account Lockout

**Purpose**: Verify account locks after failed attempts

### Step 1: Trigger Lockout

```bash
# Make 5 failed login attempts to trigger lockout
for i in {1..5}; do
  curl -s -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "testuser@example.com",
      "password": "wrong-password"
    }' > /dev/null
  echo "Failed attempt $i"
done

# Check console for:
# [Auth] Account locked notification sent to testuser@example.com
```

### Step 2: Attempt Login (Should Fail with ACCOUNT_LOCKED)

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "SecurePass123!"
  }'

# Expected Response (429):
# {
#   "error": "Account is temporarily locked. Try again in 30 minutes.",
#   "code": "ACCOUNT_LOCKED"
# }
```

### Step 3: Check Email (If SMTP Configured)

User should receive: "Account Temporarily Locked" email with:
- Lock duration (30 minutes)
- Action to take (password reset)

---

## Test 6: Password Reset Flow

**Purpose**: Verify secure password reset

### Step 1: Request Password Reset

```bash
curl -X POST http://localhost:4000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "testuser@example.com"}'

# Expected Response (200):
# {
#   "message": "If email exists, password reset link has been sent"
# }
```

### Step 2: Get Reset Token

In backend console or MongoDB:
```javascript
db.users.findOne(
  { email: "testuser@example.com" },
  { passwordResetToken: 1 }
)
```

### Step 3: Reset Password

```bash
curl -X POST http://localhost:4000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "token": "<token-from-step-2>",
    "password": "NewPassword456!"
  }'

# Expected Response (200):
# {
#   "message": "Password reset successfully",
#   "user": { ... }
# }
```

### Step 4: Login with New Password

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "NewPassword456!"
  }'

# Expected Response (200): Token returned
```

---

## Test 7: Bcrypt Password Hashing

**Purpose**: Verify passwords are hashed with bcrypt (not PBKDF2)

### Check Database

```javascript
// MongoDB Shell
db.users.findOne(
  { email: "testuser@example.com" },
  { hashedPassword: 1 }
)

// Expected format:
// "$2b$12$..." (bcrypt)
// NOT "salt:hash" format (old PBKDF2)
```

---

## Test 8: Security Headers

**Purpose**: Verify Helmet security headers present

```bash
curl -i http://localhost:4000/health | grep -E "Strict-Transport|X-Frame-Options|X-Content-Type"

# Expected Headers:
# Strict-Transport-Security: max-age=31536000
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
```

---

## Test 9: HttpOnly Cookies

**Purpose**: Verify session cookies sent as httpOnly

```bash
curl -i -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "NewPassword456!"
  }' | grep -i "set-cookie"

# Expected:
# Set-Cookie: sessionToken=...; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400
```

---

## Quick Test Script

Save as `test-auth-security.sh`:

```bash
#!/bin/bash
set -e

echo "🔐 GWT Auth Security Testing"
echo "=============================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

test_count=0
pass_count=0

test_result() {
  test_count=$((test_count + 1))
  if [ $1 -eq 0 ]; then
    pass_count=$((pass_count + 1))
    echo -e "${GREEN}✓${NC} Test $test_count: $2"
  else
    echo -e "${RED}✗${NC} Test $test_count: $2"
  fi
}

# Test 1: CORS
echo -e "\n📍 Test CORS Restriction"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://evil.com" http://localhost:4000/api/auth/login)
test_result 1 "CORS blocks evil.com"

# Test 2: Registration
echo -e "\n📍 Test Registration"
RESPONSE=$(curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Pass123!"}')
EMAIL_VERIFIED=$(echo $RESPONSE | jq -r '.user.isEmailVerified')
[[ "$EMAIL_VERIFIED" == "false" ]] && test_result 0 "Email not verified on register" || test_result 1 "Email verified too early"

# Test 3: Login Blocked Until Verified
echo -e "\n📍 Test Email Verification Required"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Pass123!"}')
[[ "$STATUS" == "401" ]] && test_result 0 "Login blocked (email unverified)" || test_result 1 "Login allowed (email unverified)"

# Test 4: Token Security
echo -e "\n📍 Test Token Extraction"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:4000/api/auth/me?token=fake")
[[ "$STATUS" == "401" ]] && test_result 0 "Query token rejected" || test_result 1 "Query token accepted"

# Summary
echo -e "\n=============================="
echo "Results: $pass_count/$test_count tests passed"
echo "=============================="

if [ $pass_count -eq $test_count ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed${NC}"
  exit 1
fi
```

Run it:
```bash
chmod +x test-auth-security.sh
./test-auth-security.sh
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ECONNREFUSED` | Backend not running (`npm start`) |
| `"Email service not configured"` | SMTP not set up (OK for testing) |
| `"No token provided"` | Check Bearer format: `Authorization: Bearer <token>` |
| `429 Too Many Requests` | Wait 15 minutes or restart backend |
| `"Invalid or expired verification token"` | Token expired (24hr limit) |

---

## Success Criteria

All tests should show:
- ✅ CORS enforced
- ✅ Email verification required
- ✅ Tokens extracted from headers only
- ✅ Rate limiting active
- ✅ Account lockout working
- ✅ Password reset functional
- ✅ Bcrypt hashing used
- ✅ Security headers present
- ✅ HttpOnly cookies sent

---

