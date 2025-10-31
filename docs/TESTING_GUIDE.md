# Mechanics Mate - Testing Guide

**Purpose**: Comprehensive testing procedures before production launch
**Last Updated**: October 27, 2025
**Audience**: QA, developers, product team

---

## Quick Start Testing

### Prerequisites
- Local server running: `npm start`
- Server accessible at `http://localhost:3000`
- Postman or curl for API testing
- Test Stripe account configured

### Test Flow Summary
```
1. Test Authentication ✓
2. Test Email Verification ✓
3. Test Subscription Flow ✓
4. Test Security Features ✓
5. Test API Endpoints ✓
6. Test Error Handling ✓
```

---

## Test Scenarios

### 1. Authentication & Account Management

#### 1.1 User Signup
**Test**: Create new account with valid credentials
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPass123!",
    "name": "Test User"
  }'
```

**Expected Response**:
- Status: 201 Created
- Contains JWT token
- Contains user object with id, email, name
- Message about email verification

**Test Cases**:
- [ ] Valid email and password ✓
- [ ] Invalid email format (should reject)
- [ ] Short password < 8 chars (should reject)
- [ ] Duplicate email (should reject)
- [ ] Missing required fields (should reject)

#### 1.2 User Login
**Test**: Authenticate with email/password
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "TestPass123!"
  }'
```

**Expected Response**:
- Status: 200 OK
- Contains JWT token
- Contains user info
- Contains subscription status

**Test Cases**:
- [ ] Correct credentials ✓
- [ ] Wrong password (should return 401)
- [ ] Non-existent email (should return 401)
- [ ] Missing email/password (should return 400)

#### 1.3 Get CSRF Token
**Test**: Retrieve CSRF token for state-changing operations
```bash
curl -X GET http://localhost:3000/api/auth/csrf-token
```

**Expected Response**:
- Status: 200 OK
- Contains `csrfToken` field
- Token is 32+ characters

**Test Cases**:
- [ ] Request returns valid token ✓
- [ ] Token can be used in subsequent requests ✓

#### 1.4 Logout
**Test**: Invalidate session and blacklist token
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"_csrf": "<csrf_token>"}'
```

**Expected Response**:
- Status: 200 OK
- Message: "Logged out successfully"

**Test Cases**:
- [ ] Valid token logs out successfully ✓
- [ ] Token is blacklisted after logout ✓
- [ ] Attempting to use token after logout fails (401 TOKEN_REVOKED) ✓

---

### 2. Email Verification

#### 2.1 Resend Verification Email
**Test**: Request new verification email
```bash
curl -X POST http://localhost:3000/api/auth/resend-verification \
  -H "Authorization: Bearer <token>"
```

**Expected Response** (dev mode):
- Status: 200 OK
- Contains verification link
- Link format: `http://localhost:3000/verify-email?token=...`

**Test Cases**:
- [ ] Authenticated user can request verification ✓
- [ ] Unauthenticated request rejected (401) ✓
- [ ] Token in link is valid and unexpired ✓

#### 2.2 Verify Email Token
**Test**: Verify email with token from link
```bash
curl -X POST http://localhost:3000/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token": "verification_token_from_email"}'
```

**Expected Response**:
- Status: 200 OK
- Message: "Email verified successfully"
- Contains verified email

**Test Cases**:
- [ ] Valid token verifies successfully ✓
- [ ] Expired token rejected (400) ✓
- [ ] Invalid token rejected (400) ✓
- [ ] Token can't be reused (already verified) ✓

#### 2.3 Visit Verification Page
**Test**: User visits email verification page
```
1. Navigate to: http://localhost:3000/verify-email?token=<token>
2. Page should:
   - Show loading spinner initially
   - Auto-verify the token
   - Display success or error message
   - Show "Go to Dashboard" button on success
```

**Expected UI**:
- [ ] Loading spinner visible while verifying
- [ ] Success message with check mark ✓
- [ ] "Go to Dashboard" button links to chat
- [ ] Error message for invalid token

---

### 3. Subscription & Payment Flow

#### 3.1 Create Checkout Session
**Test**: Initialize Stripe checkout
```bash
curl -X POST http://localhost:3000/api/subscriptions/create-checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"planId": "professional"}'
```

**Expected Response**:
- Status: 200 OK
- Contains `sessionId` (starts with `cs_test_`)
- Contains `url` (Stripe checkout page)

**Test Cases**:
- [ ] Valid plan ID creates session ✓
- [ ] Invalid plan ID rejected (400) ✓
- [ ] Unauthenticated request rejected (401) ✓
- [ ] User with existing active subscription rejected (400) ✓

#### 3.2 Complete Test Payment
**Test**: Go through full payment flow
```
1. Call /create-checkout with planId
2. Open returned Stripe URL in browser
3. Use Stripe test card: 4242 4242 4242 4242
   - Expiry: Any future date (e.g., 12/25)
   - CVC: Any 3 digits (e.g., 123)
4. Complete payment
5. Verify subscription created in database
```

**Expected Results**:
- [ ] Payment succeeds
- [ ] User redirected to dashboard.html?success=true ✓
- [ ] Subscription created in database ✓
- [ ] User can now use chat (quota available) ✓

#### 3.3 Manage Subscription (Portal)
**Test**: Access billing portal
```bash
curl -X POST http://localhost:3000/api/subscriptions/create-portal \
  -H "Authorization: Bearer <token>"
```

**Expected Response**:
- Status: 200 OK
- Contains `url` to Stripe billing portal

**Test Cases**:
- [ ] Authenticated user gets portal URL ✓
- [ ] Unauthenticated request rejected (401) ✓
- [ ] User without subscription rejected (404) ✓
- [ ] Portal link opens in browser ✓

---

### 4. Security Tests

#### 4.1 CSRF Protection
**Test**: Verify CSRF tokens are required and validated

```bash
# Test 1: POST without CSRF token (should fail)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass"}'

# Expected: 403 with "CSRF_TOKEN_INVALID" error
```

**Test Cases**:
- [ ] POST without CSRF token returns 403 ✓
- [ ] POST with valid CSRF token succeeds ✓
- [ ] POST with invalid CSRF token returns 403 ✓
- [ ] Tokens are tied to session cookies ✓

#### 4.2 Rate Limiting
**Test**: Verify rate limits prevent abuse

```bash
# Try 6 login attempts in 15 minutes (limit is 5)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
  echo "Attempt $i"
done

# Expected: 6th request returns 429 Too Many Requests
```

**Test Cases**:
- [ ] First 5 failed login attempts accepted ✓
- [ ] 6th attempt returns 429 ✓
- [ ] Response includes retry-after header ✓
- [ ] Successful login doesn't count against limit ✓

#### 4.3 Input Validation
**Test**: Verify malicious input is rejected

```bash
# Test 1: SQL injection attempt
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin'\'';--","password":"anything"}'

# Expected: 400 Bad Request with validation error

# Test 2: XSS attempt
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"pass","name":"<script>alert(1)</script>"}'

# Expected: 400 Bad Request with validation error
```

**Test Cases**:
- [ ] Invalid email format rejected ✓
- [ ] SQL injection in email rejected ✓
- [ ] XSS payload in name rejected ✓
- [ ] Long strings beyond max length rejected ✓
- [ ] Empty/null values rejected where required ✓

#### 4.4 Error Message Security
**Test**: Verify error messages don't leak sensitive info

```bash
# Test incorrect login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@test.com","password":"wrong"}'

# Should return: "Invalid email or password"
# Should NOT return: "Email not found in database" or similar
```

**Test Cases**:
- [ ] Login error generic (doesn't confirm email exists) ✓
- [ ] Database errors not exposed to client ✓
- [ ] System paths not revealed in errors ✓
- [ ] Stack traces not visible in responses ✓

#### 4.5 CORS Restrictions
**Test**: Verify CORS only allows expected origins

```bash
# Test from different origin
curl -X GET http://localhost:3000/api/auth/me \
  -H "Origin: https://attacker.com" \
  -H "Authorization: Bearer <token>"

# Expected: CORS error or blocked by browser
# Allowed origins: http://localhost:3000, http://127.0.0.1:3000
```

**Test Cases**:
- [ ] Localhost origin allowed ✓
- [ ] 127.0.0.1 origin allowed ✓
- [ ] Different domain blocked ✓
- [ ] Production domain allowed (when configured) ✓

---

### 5. API Endpoint Tests

#### 5.1 Get Current User
**Test**: Retrieve authenticated user's profile
```bash
curl -X GET http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer <token>"
```

**Expected Response**:
- Status: 200 OK
- Contains user object
- Contains subscription info
- Contains usage stats
- Contains isAdmin flag

**Test Cases**:
- [ ] Authenticated user returns complete profile ✓
- [ ] Unauthenticated request returns 401 ✓
- [ ] User data is accurate ✓
- [ ] Subscription info includes plan and current period ✓

#### 5.2 Chat Endpoint
**Test**: Send message and get AI response
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "[Vehicle: 2020 Honda Civic 2.0L Gas] Why is my car making a knocking sound?",
    "conversationHistory": []
  }'
```

**Expected Response**:
- Status: 200 OK
- Contains AI response text
- Contains quotaRemaining
- Contains quotaLimit
- Response time < 10 seconds

**Test Cases**:
- [ ] Valid message returns response ✓
- [ ] Response includes vehicle context ✓
- [ ] Quota decrements after each message ✓
- [ ] User without subscription returns 403 ✓
- [ ] Out-of-quota user returns error ✓

#### 5.3 Admin Endpoints
**Test**: Access admin analytics
```bash
# Only works if user is in admin_users table
curl -X GET http://localhost:3000/api/admin/stats \
  -H "Authorization: Bearer <admin_token>"
```

**Expected Response**:
- Status: 200 OK if admin
- Contains: totalUsers, totalActiveSubscriptions, monthlyRevenue, totalMessages
- Status: 403 if not admin

**Test Cases**:
- [ ] Admin user can access stats ✓
- [ ] Regular user gets 403 forbidden ✓
- [ ] Stats are accurate ✓
- [ ] Unauthenticated request returns 401 ✓

---

### 6. Quota Limits Testing

#### 6.1 Message Quota by Plan
**Test**: Verify quota enforcement
```
Starter Plan: 100 messages/month
Professional Plan: 500 messages/month
Workshop Plan: Unlimited
```

**Test Steps**:
1. Create account and purchase Starter plan
2. Send 100 messages (should all succeed)
3. Send 101st message (should fail with quota exceeded)
4. Upgrade to Professional plan
5. Send more messages (should work)

**Test Cases**:
- [ ] Starter user limited to 100/month ✓
- [ ] Professional user limited to 500/month ✓
- [ ] Workshop user unlimited ✓
- [ ] Over-quota message returns 403 ✓
- [ ] Quota resets monthly ✓
- [ ] Quota remaining shown in response ✓

---

### 7. Browser & Device Testing

#### 7.1 Desktop Browsers
Test on:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

**Checklist**:
- [ ] Layout renders correctly
- [ ] All buttons clickable
- [ ] Forms submit properly
- [ ] Chat interface works
- [ ] No console errors

#### 7.2 Mobile Devices
Test on:
- [ ] iPhone (iOS 15+)
- [ ] Android (version 10+)
- [ ] iPad (iPadOS 15+)
- [ ] Android tablet

**Checklist**:
- [ ] No horizontal scrolling
- [ ] Touch targets minimum 44x44px
- [ ] Keyboard doesn't cover input
- [ ] Dropdown menus work on touch
- [ ] Pinch-to-zoom still works
- [ ] Safe area padding respected

#### 7.3 PWA Functionality
Test offline capability:
```
1. Load app in browser
2. Go offline (DevTools > Network > Offline)
3. Try to access chat
4. Verify service worker works
```

**Test Cases**:
- [ ] App loads offline (cached) ✓
- [ ] Offline message shown
- [ ] Can add to home screen ✓
- [ ] App icon displays correctly ✓
- [ ] Splash screen shows on launch ✓

---

## Automated Test Checklist

### JavaScript Tests
```bash
# Run any unit tests if configured
npm test
```

### Security Scan
```bash
# Check for dependencies with vulnerabilities
npm audit

# Expected: No high severity vulnerabilities
```

### Performance Check
```bash
# Load test with Apache Bench
ab -n 100 -c 10 http://localhost:3000/

# Expected: All requests successful, <1s response time
```

---

## Regression Test Checklist

- [ ] All existing features still work
- [ ] No new errors in console
- [ ] No performance degradation
- [ ] All links working
- [ ] Forms submitting correctly
- [ ] Database queries fast
- [ ] No memory leaks observed

---

## Test Report Template

**Date**: _____________
**Tester**: _____________
**Environment**: Development / Staging / Production

### Results
| Test | Status | Notes |
|------|--------|-------|
| Authentication | ✓ Pass / ✗ Fail | |
| Email Verification | ✓ Pass / ✗ Fail | |
| Subscriptions | ✓ Pass / ✗ Fail | |
| CSRF Protection | ✓ Pass / ✗ Fail | |
| Rate Limiting | ✓ Pass / ✗ Fail | |
| Input Validation | ✓ Pass / ✗ Fail | |
| Error Handling | ✓ Pass / ✗ Fail | |
| Desktop Browsers | ✓ Pass / ✗ Fail | |
| Mobile Devices | ✓ Pass / ✗ Fail | |
| PWA Offline | ✓ Pass / ✗ Fail | |

### Issues Found
1. [Description]
2. [Description]

### Sign-off
Tested by: _____________
Date: _____________
Status: Ready for Production / Needs Fixes

---

## Success Criteria

All tests must pass before production deployment:

- ✓ All authentication flows working
- ✓ Email verification end-to-end
- ✓ Payment/subscription flow complete
- ✓ All security features active
- ✓ No sensitive data in logs/errors
- ✓ Rate limiting prevents abuse
- ✓ Input validation rejects malicious input
- ✓ Works on desktop & mobile
- ✓ Offline functionality (PWA)
- ✓ Response times acceptable
- ✓ Zero critical security issues

---

**Ready to test?** Start with [Test Scenario 1](#1-authentication--account-management)

Support: devops@mechanics-mate.app
