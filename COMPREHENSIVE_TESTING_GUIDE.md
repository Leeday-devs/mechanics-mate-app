# Comprehensive Testing Guide - Before Production Launch

**Purpose:** Verify all functionality works correctly before Stripe live mode activation
**Scope:** User workflows, security, error handling, integrations
**Timeline:** 2-3 hours for full test suite

---

## Test Environment Setup

### Prerequisites

```bash
# Ensure you have:
- Node.js 16+ installed
- Access to Netlify dashboard
- Access to Stripe test dashboard
- Test credit card: 4242 4242 4242 4242 (Stripe)
- Browser with developer tools
- Postman or curl for API testing
```

### Local Testing

```bash
# Start the server locally
npm install
npm start

# Server should be running on http://localhost:3000
# Test endpoint: curl http://localhost:3000/api/health
```

---

## Testing Workflows

### 1. Authentication Flow ✅

#### Test 1.1: Sign Up with Valid Email & Password

**Steps:**
1. Go to `/signup`
2. Enter:
   - Email: `testuser-$(date +%s)@example.com`
   - Password: `TestPass123`
   - Name: `Test User`
3. Click "Sign Up"

**Expected Result:**
- ✅ Account created successfully
- ✅ Redirected to dashboard or login
- ✅ Confirmation email received (check spam)
- ✅ User can log in

**Status:** 🔴 TODO

---

#### Test 1.2: Sign Up with Invalid Email

**Steps:**
1. Go to `/signup`
2. Try: `invalid-email`, `@example.com`, `test@`
3. Click "Sign Up"

**Expected Result:**
- ✅ Error message displayed
- ✅ NOT sent to server
- ✅ Form stays on signup page

**Status:** 🔴 TODO

---

#### Test 1.3: Sign Up with Weak Password

**Steps:**
1. Go to `/signup`
2. Try passwords:
   - `123456` (numbers only)
   - `password` (lowercase only)
   - `Pass1` (too short)

**Expected Result:**
- ✅ Error message: "Password must contain uppercase, lowercase, and numbers"
- ✅ NOT sent to server

**Status:** 🔴 TODO

---

#### Test 1.4: Login with Correct Credentials

**Steps:**
1. Go to `/login`
2. Enter email and password created in Test 1.1
3. Click "Login"

**Expected Result:**
- ✅ Login successful
- ✅ Token stored in localStorage
- ✅ Redirected to chat or dashboard
- ✅ User data displayed

**Status:** 🔴 TODO

---

#### Test 1.5: Login with Wrong Password

**Steps:**
1. Go to `/login`
2. Enter correct email, wrong password
3. Click "Login"

**Expected Result:**
- ✅ Error: "Invalid email or password"
- ✅ NOT logged in
- ✅ Token not stored

**Status:** 🔴 TODO

---

#### Test 1.6: Logout Invalidates Token

**Steps:**
1. Log in successfully
2. Click "Logout"
3. Try to access `/dashboard` directly by typing URL

**Expected Result:**
- ✅ Logged out successfully
- ✅ Redirected to landing page
- ✅ Token removed from localStorage
- ✅ Cannot access dashboard without logging in

**Status:** 🔴 TODO

---

#### Test 1.7: Rate Limiting on Auth

**Steps:**
1. Use curl or Postman to make 6 failed login attempts rapidly:
```bash
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  sleep 1
done
```

**Expected Result:**
- ✅ Attempts 1-5 processed normally
- ✅ Attempt 6+ returns: "Too many authentication attempts"
- ✅ Locked out for 15 minutes

**Status:** 🔴 TODO

---

### 2. Subscription & Payment Flow ✅

#### Test 2.1: Free User Cannot Access Chat

**Steps:**
1. Create new account (no subscription)
2. Try to access `/chat` or `/app`
3. Try to send a message (if redirected)

**Expected Result:**
- ✅ Cannot access chat page
- ✅ Redirected to pricing page
- ✅ Error message: "Active subscription required"
- ✅ Chat endpoint returns 403

**Status:** 🔴 TODO

---

#### Test 2.2: Stripe Checkout Works

**Steps:**
1. Go to `/pricing`
2. Click "Subscribe" on Starter plan
3. Proceed to Stripe checkout
4. Enter test card: `4242 4242 4242 4242`
5. Enter future expiry: `12/25`
6. Enter CVC: `123`
7. Enter name and email
8. Click "Pay"

**Expected Result:**
- ✅ Stripe checkout opens
- ✅ Payment processed
- ✅ Redirected to dashboard with success message
- ✅ Dashboard shows "Starter Plan" active
- ✅ Chat becomes accessible

**Status:** 🔴 TODO

---

#### Test 2.3: Stripe Webhook Updates Subscription

**Steps:**
1. Complete Test 2.2 (make a payment)
2. Wait 5-10 seconds
3. Refresh dashboard

**Expected Result:**
- ✅ Subscription status shows "active"
- ✅ Next billing date displayed
- ✅ Plan details correct
- ✅ Message quota shows (50 for Starter, 200 for Professional)

**Status:** 🔴 TODO

---

#### Test 2.4: Plan Limits Are Enforced

**Steps:**
1. Subscribe to Starter plan (50 messages/month)
2. Go to chat
3. Send 50 messages (can use same message repeatedly)

**Expected Result:**
- ✅ Messages 1-50 succeed
- ✅ Message 51 rejected with: "Monthly message quota exceeded"
- ✅ Quota display shows "0 remaining"
- ✅ User prompted to upgrade

**Status:** 🔴 TODO

---

#### Test 2.5: Quota Resets Monthly

**Steps:**
1. Complete Test 2.4 (use all quota)
2. (Developer) Change system clock or test parameter to next month
3. Try to send message

**Expected Result:**
- ✅ Quota counter reset to 50 (or plan limit)
- ✅ Message succeeds
- ✅ Quota increments correctly

**Status:** 🔴 TODO

---

#### Test 2.6: Manage Subscription (Portal)

**Steps:**
1. Go to dashboard after subscribing
2. Click "Manage Subscription"
3. Should open Stripe billing portal

**Expected Result:**
- ✅ Stripe portal opens
- ✅ Can view subscription details
- ✅ Can update payment method
- ✅ Can cancel subscription
- ✅ Can upgrade/downgrade plan

**Status:** 🔴 TODO

---

### 3. Chat Functionality ✅

#### Test 3.1: Send Message with Vehicle Selected

**Steps:**
1. Log in with subscription active
2. Select vehicle: `2018 Ford Focus 1.5L Petrol`
3. Send message: `What's the service interval?`

**Expected Result:**
- ✅ Message sent successfully
- ✅ Response received from Claude
- ✅ Response acknowledges the vehicle
- ✅ Response uses UK terminology (pounds, kilometers, etc.)
- ✅ Message quota incremented
- ✅ Message logged to database

**Status:** 🔴 TODO

---

#### Test 3.2: Send Message Without Vehicle Selected

**Steps:**
1. Go to chat
2. DON'T select a vehicle
3. Send message: `What's wrong with my car?`

**Expected Result:**
- ✅ Message sent
- ✅ Response received
- ✅ Claude asks to select vehicle first
- ✅ No vehicle info in response

**Status:** 🔴 TODO

---

#### Test 3.3: Conversation History Persists

**Steps:**
1. Send message 1: `What's the tire size?`
2. Get response
3. Send message 2: `And the oil capacity?`

**Expected Result:**
- ✅ Claude references first message in response to second
- ✅ Conversation history displayed in UI
- ✅ Can scroll through previous messages

**Status:** 🔴 TODO

---

#### Test 3.4: Rate Limiting on Chat

**Steps:**
1. Send 10 messages rapidly (within 1 minute)
2. Try to send 11th message

**Expected Result:**
- ✅ Messages 1-10 processed
- ✅ Message 11 rejected: "Too many chat requests"
- ✅ Must wait 1 minute before trying again

**Status:** 🔴 TODO

---

#### Test 3.5: Message Length Validation

**Steps:**
1. Try to send message with:
   - 1 character (too short)
   - 5001 characters (too long)
   - 2500 characters (valid)

**Expected Result:**
- ✅ Messages under 1 char rejected
- ✅ Messages over 5000 chars rejected
- ✅ 2500 char message accepted
- ✅ Error messages displayed

**Status:** 🔴 TODO

---

#### Test 3.6: Long Conversation History

**Steps:**
1. Send 30 messages in conversation
2. Send 31st message

**Expected Result:**
- ✅ Messages 1-30 sent successfully
- ✅ Message 31 rejected: "Conversation history too long"
- ✅ User prompted to start new conversation

**Status:** 🔴 TODO

---

### 4. Error Handling & Security ✅

#### Test 4.1: API Errors Don't Expose Details

**Steps:**
1. Use curl to make request with invalid data:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
```

**Expected Result:**
- ✅ Returns 401/403 error
- ✅ Error message is generic: "Invalid or expired token"
- ✅ NO internal details exposed
- ✅ NO stack traces shown

**Status:** 🔴 TODO

---

#### Test 4.2: CORS Prevents Cross-Origin Requests

**Steps:**
1. Open browser console on different site (e.g., google.com)
2. Try to make request to your API:
```javascript
fetch('https://mechanics-mate.netlify.app/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'test' })
})
```

**Expected Result:**
- ✅ Request blocked
- ✅ Error: "Access to XMLHttpRequest blocked by CORS policy"
- ✅ NOT sent to server

**Status:** 🔴 TODO

---

#### Test 4.3: HTTPS Enforcement

**Steps:**
1. Try to access: `http://mechanics-mate.netlify.app`
2. Should redirect to: `https://mechanics-mate.netlify.app`

**Expected Result:**
- ✅ HTTP request redirected to HTTPS
- ✅ URL bar shows HTTPS
- ✅ No mixed content warnings
- ✅ All resources loaded over HTTPS

**Status:** 🔴 TODO

---

#### Test 4.4: Helmet Security Headers Present

**Steps:**
1. Use curl to check headers:
```bash
curl -I https://mechanics-mate.netlify.app
```

**Expected Result:**
- ✅ `X-Frame-Options: DENY`
- ✅ `X-Content-Type-Options: nosniff`
- ✅ `X-XSS-Protection: 1; mode=block`
- ✅ `Referrer-Policy: strict-origin-when-cross-origin`
- ✅ No information leaked in headers

**Status:** 🔴 TODO

---

### 5. Admin Dashboard ✅

#### Test 5.1: Only Admins Can Access

**Steps:**
1. Create regular user account
2. Try to access `/api/admin/users` (using curl with token)
3. Should be rejected

**Expected Result:**
- ✅ Regular user gets 403: "Admin access required"
- ✅ Admin user gets user list
- ✅ Pagination works (limit parameter validated)

**Status:** 🔴 TODO

---

#### Test 5.2: Admin Stats Are Accurate

**Steps:**
1. Log in as admin
2. Go to admin dashboard
3. Check stats against known values

**Expected Result:**
- ✅ Total users count correct
- ✅ Active subscriptions count correct
- ✅ Monthly revenue calculated correctly
- ✅ Total messages count correct
- ✅ AI cost calculated accurately

**Status:** 🔴 TODO

---

### 6. Landing & Marketing Pages ✅

#### Test 6.1: Landing Page Loads

**Steps:**
1. Go to `/`
2. Verify all content loads

**Expected Result:**
- ✅ Page loads without errors
- ✅ All images load
- ✅ No console errors
- ✅ CTA buttons work

**Status:** 🔴 TODO

---

#### Test 6.2: Pricing Page Displays Plans

**Steps:**
1. Go to `/pricing`
2. View all 3 plans

**Expected Result:**
- ✅ All plans visible
- ✅ Pricing correct (from environment variables)
- ✅ Subscribe buttons work
- ✅ No layout issues

**Status:** 🔴 TODO

---

### 7. PWA & Offline ✅

#### Test 7.1: Service Worker Installed

**Steps:**
1. Go to `/`
2. Open DevTools → Application → Service Workers
3. Should show service worker registered

**Expected Result:**
- ✅ Service worker registered
- ✅ Status: "active and running"
- ✅ Cache storage present

**Status:** 🔴 TODO

---

#### Test 7.2: App Installable

**Steps:**
1. Go to `/`
2. Browser should show "Install" option (Chrome on desktop/mobile)
3. Click "Install"

**Expected Result:**
- ✅ App installs successfully
- ✅ App icon appears on home screen/taskbar
- ✅ App opens full-screen
- ✅ App functions normally

**Status:** 🔴 TODO

---

## Performance Testing

### Test P.1: Chat Response Time

**Steps:**
1. Send message and measure response time

**Expected Result:**
- ✅ Response received within 10 seconds
- ✅ No timeout errors
- ✅ Typing indicator shows while waiting

**Benchmark:**
- < 3 seconds: Excellent
- 3-5 seconds: Good
- 5-10 seconds: Acceptable
- \> 10 seconds: Investigate

**Status:** 🔴 TODO

---

### Test P.2: Page Load Time

**Steps:**
1. Measure load time for each page
2. Check with DevTools Performance tab

**Expected Result:**
- ✅ Landing page: < 2 seconds
- ✅ Login page: < 1 second
- ✅ Dashboard: < 2 seconds
- ✅ Chat page: < 2 seconds

**Status:** 🔴 TODO

---

## Security Testing

### Test S.1: Input Validation

**Steps:**
1. Try to submit forms with:
   - SQL injection: `'; DROP TABLE users; --`
   - XSS: `<script>alert('xss')</script>`
   - Very long inputs (10,000+ characters)

**Expected Result:**
- ✅ All rejected or sanitized
- ✅ No errors in server logs
- ✅ Safe error messages

**Status:** 🔴 TODO

---

### Test S.2: No Sensitive Data in Logs

**Steps:**
1. Log in, make requests
2. Check server logs
3. Check browser Network tab

**Expected Result:**
- ✅ No passwords logged
- ✅ No tokens logged
- ✅ No API keys visible
- ✅ No PII in response bodies

**Status:** 🔴 TODO

---

## Regression Testing

### Test R.1: After Each Fix Deployment

- [ ] All auth endpoints work
- [ ] All subscription endpoints work
- [ ] Chat endpoint works
- [ ] Admin endpoints work
- [ ] No new errors introduced
- [ ] All existing tests still pass

---

## Final Sign-Off Checklist

### Core Functionality
- [ ] Sign up works
- [ ] Login works
- [ ] Logout works
- [ ] Chat works
- [ ] Stripe payment works
- [ ] Subscription management works
- [ ] Admin dashboard works

### Security
- [ ] HTTPS enforced
- [ ] CORS working correctly
- [ ] Rate limiting working
- [ ] Input validation working
- [ ] Error messages safe
- [ ] Security headers present

### User Experience
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] Fast loading times
- [ ] Clear error messages
- [ ] Intuitive navigation

### Infrastructure
- [ ] Database connected
- [ ] Stripe connected
- [ ] Anthropic API working
- [ ] Netlify deployed
- [ ] Monitoring/logging setup

---

## Test Results Summary

**Date Tested:** _______________
**Tester Name:** _______________
**Environment:** ⬜ Local ⬜ Staging ⬜ Production

| Category | Status | Notes |
|----------|--------|-------|
| Authentication | ⬜ PASS ⬜ FAIL | |
| Subscriptions | ⬜ PASS ⬜ FAIL | |
| Chat | ⬜ PASS ⬜ FAIL | |
| Admin | ⬜ PASS ⬜ FAIL | |
| Security | ⬜ PASS ⬜ FAIL | |
| Performance | ⬜ PASS ⬜ FAIL | |
| PWA | ⬜ PASS ⬜ FAIL | |

**Overall Result:** ⬜ READY FOR PRODUCTION ⬜ NEEDS FIXES

---

## Known Issues & Workarounds

(Fill in as discovered during testing)

---

## Sign-Off

**Tested By:** _______________
**Date:** _______________
**Approved By:** _______________
**Date:** _______________

✅ Application is READY for Stripe live mode activation

or

❌ Application needs fixes (see issues above)

---

