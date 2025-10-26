# Production Audit Report - Mechanics Mate App
**Date:** October 26, 2025
**Status:** Pre-Production Review
**Next Step:** Stripe Live Mode Activation

---

## Executive Summary

This comprehensive audit examined the **mechanics-mate-app** across security, functionality, error handling, and best practices. The application has a **solid foundation** but requires several **critical fixes** before moving from Stripe test mode to production.

**Overall Risk Level:** 🟡 **MEDIUM** (fixable before launch)

---

## Table of Contents
1. [Critical Issues (Must Fix)](#critical-issues)
2. [High Priority Issues](#high-priority-issues)
3. [Medium Priority Issues](#medium-priority-issues)
4. [Best Practices Recommendations](#best-practices)
5. [Security Assessment](#security-assessment)
6. [Testing Checklist](#testing-checklist)
7. [Production Readiness](#production-readiness)

---

## Critical Issues (MUST FIX)

### 1. **Error Response Disclosure** ⚠️ CRITICAL
**Location:** `server.js:378`
**Severity:** High
**Issue:**
```javascript
res.status(500).json({
    error: 'Failed to get response from AI assistant',
    details: error.message  // ❌ Exposes internal error details
});
```

**Risk:** Exposes system errors to clients, aids attackers in reconnaissance.

**Fix:**
```javascript
// server.js - Replace error handling
catch (error) {
    console.error('Error calling Claude API:', error);
    // Log detailed error server-side
    res.status(500).json({
        error: 'Failed to get response. Please try again.',
        errorCode: 'CLAUDE_API_ERROR'
        // Don't expose error.message to client
    });
}
```

**Status:** 🔴 NOT FIXED

---

### 2. **CORS Bypass in Development Mode** ⚠️ CRITICAL
**Location:** `server.js:110`
**Severity:** High
**Issue:**
```javascript
if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
    callback(null, true);  // ❌ Allows ANY origin if NODE_ENV=development
}
```

**Risk:** If NODE_ENV is accidentally 'development' in production, CORS is completely bypassed.

**Fix:**
```javascript
if (process.env.NODE_ENV !== 'production' && !origin) {
    // Allow development without origin (mobile apps, Postman)
    return callback(null, true);
}

if (allowedOrigins.indexOf(origin) !== -1) {
    callback(null, true);
} else {
    console.warn('⚠️  CORS blocked request from:', origin);
    callback(new Error('Not allowed by CORS'));
}
```

**Status:** 🔴 NOT FIXED

---

### 3. **Missing Input Validation on Admin Endpoints** ⚠️ CRITICAL
**Location:** `routes/admin.js:107`
**Severity:** Medium-High
**Issue:**
```javascript
const limit = parseInt(req.query.limit) || 50;  // ❌ No validation
// User could send: ?limit=999999 or ?limit=-1
```

**Risk:** Large queries could cause DoS, negative numbers cause crashes.

**Fix:**
```javascript
const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 500);
// Ensures: 1 ≤ limit ≤ 500
```

**Status:** 🔴 NOT FIXED

---

### 4. **No HTTPS Enforcement** ⚠️ CRITICAL
**Location:** Global (Netlify configuration)
**Severity:** Critical
**Issue:** Application doesn't enforce HTTPS, sensitive data (tokens, passwords) transmitted in clear.

**Fix - Add to netlify.toml:**
```toml
[[redirects]]
  from = "http://*"
  to = "https://:splat"
  status = 301
```

**Status:** 🔴 NOT FIXED

---

### 5. **Duplicate Plan Pricing Configuration** ⚠️ CRITICAL
**Location:** `routes/subscriptions.js:9-13` and `routes/admin.js:65-69`
**Severity:** Medium
**Issue:** Plan prices hardcoded in two places (DRY violation).

**Risk:** If prices change in Stripe, code must be updated in two places → risk of inconsistency.

**Fix:** Create `lib/pricing.js`:
```javascript
const PLAN_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    workshop: process.env.STRIPE_PRICE_WORKSHOP
};

const PLAN_MRR = {  // Monthly Recurring Revenue (in GBP)
    starter: 4.99,
    professional: 14.99,
    workshop: 39.99
};

module.exports = { PLAN_PRICES, PLAN_MRR };
```

Then import and use throughout.

**Status:** 🔴 NOT FIXED

---

## High Priority Issues

### 6. **No Structured Error Logging**
**Location:** Throughout `server.js`
**Severity:** High
**Issue:** Errors logged to console only; no persistent logging for production debugging.

**Fix:** Integrate error tracking. Add to dependencies:
```bash
npm install --save @sentry/node
```

Then in `server.js`:
```javascript
const Sentry = require("@sentry/node");

if (process.env.NODE_ENV === 'production') {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV
    });
    app.use(Sentry.Handlers.requestHandler());
}

// ... after all routes ...
if (process.env.NODE_ENV === 'production') {
    app.use(Sentry.Handlers.errorHandler());
}
```

**Status:** 🔴 NOT FIXED

---

### 7. **No Request Validation/Sanitization**
**Location:** `routes/auth.js`, `server.js` (chat endpoint)
**Severity:** High
**Issue:** User inputs not validated against malicious payloads.

**Fix:** Add validation library:
```bash
npm install --save express-validator
```

Example usage in `routes/auth.js`:
```javascript
const { body, validationResult } = require('express-validator');

router.post('/signup',
    authLimiter,
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).trim().escape(),
    body('name').trim().escape(),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // ... rest of code
    }
);
```

**Status:** 🔴 NOT FIXED

---

### 8. **Missing CSRF Protection on State-Changing Operations**
**Location:** All POST/PUT/DELETE endpoints
**Severity:** High
**Issue:** No CSRF tokens on subscription checkout, payment changes.

**Fix:** Add CSRF middleware:
```bash
npm install --save csurf
```

**Status:** 🔴 NOT FIXED

---

### 9. **Sensitive Token in localStorage (XSS Risk)**
**Location:** `script.js:96, 460, 533, 747`
**Severity:** High
**Issue:** JWT tokens stored in localStorage are vulnerable to XSS attacks.

**Note:** While formatMessage properly escapes HTML (✓ good practice), localStorage is still not ideal.

**Recommendation:** Consider:
- Option A: Move to httpOnly cookies (requires backend changes)
- Option B: Keep localStorage but implement strict CSP

Current CSP in `server.js:93-102` is relaxed (allows unsafe-inline). Should be:
```javascript
contentSecurityPolicy: {
    directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        scriptSrc: ["'self'"],  // ✓ Remove unsafe-inline
        connectSrc: ["'self'", "https://api.anthropic.com", "https://*.supabase.co", "https://api.stripe.com"]
    }
}
```

**Status:** 🟡 PARTIALLY MITIGATED (good HTML escaping, but CSP needs hardening)

---

### 10. **No Session Management / Server-Side Logout**
**Location:** `routes/auth.js:164-168`
**Severity:** High
**Issue:** Logout only removes client-side token; token remains valid on server.

**Risk:** Compromised token still works until expiration (7 days).

**Fix:** Implement token blacklist:
```javascript
// Add to server setup
const tokenBlacklist = new Set();

// Update logout endpoint
router.post('/logout', authenticateToken, async (req, res) => {
    const token = req.headers['authorization'].split(' ')[1];
    tokenBlacklist.add(token);

    // Also revoke from Supabase
    await supabase.auth.signOut();

    res.json({ success: true });
});

// Modify authenticateToken middleware to check blacklist
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (tokenBlacklist.has(token)) {
        return res.status(401).json({ error: 'Token has been revoked' });
    }
    // ... rest of validation
}
```

**Status:** 🔴 NOT FIXED

---

## Medium Priority Issues

### 11. **Webhook Idempotency Not Implemented**
**Location:** `routes/subscriptions.js:117-161`
**Severity:** Medium
**Issue:** Stripe webhooks could be processed twice → duplicate charges/records.

**Fix:** Add idempotency tracking:
```javascript
const processedWebhooks = new Set();

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Check idempotency
    if (processedWebhooks.has(event.id)) {
        return res.json({ received: true }); // Already processed
    }

    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;
            // ... other cases
        }

        processedWebhooks.add(event.id);
        res.json({ received: true });
    } catch (error) {
        // On error, don't mark as processed so it retries
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});
```

**Status:** 🔴 NOT FIXED

---

### 12. **No Rate Limiting on Health Check**
**Location:** `server.js:384-386`
**Severity:** Low-Medium
**Issue:** `/api/health` endpoint not rate-limited; could be used in DoS attacks.

**Fix:**
```javascript
app.get('/api/health', apiLimiter, (req, res) => {
    res.json({ status: 'ok', message: 'My Mechanic API is running' });
});
```

**Status:** 🔴 NOT FIXED

---

### 13. **No Database Query Logging**
**Location:** All database operations
**Severity:** Medium
**Issue:** No audit trail for database operations → can't track who changed what.

**Recommendation:** Add Supabase audit logs review:
- Check Supabase dashboard for audit log settings
- Consider adding custom audit table for critical operations

**Status:** 🟡 DEPENDS ON SUPABASE CONFIG

---

### 14. **Missing Pagination on Admin Endpoints**
**Location:** `routes/admin.js:11, 18, 77, 84`
**Severity:** Medium
**Issue:** Admin endpoints fetch all data; doesn't scale with user growth.

**Fix:** Add pagination (example for `/admin/users`):
```javascript
const page = Math.max(1, parseInt(req.query.page) || 1);
const pageSize = Math.min(Math.max(parseInt(req.query.pageSize) || 25, 1), 100);
const offset = (page - 1) * pageSize;

const { data: authUsers, count } = await supabaseAdmin.auth.admin.listUsers({
    page: page,
    perPage: pageSize
});

res.json({
    users,
    pagination: { page, pageSize, total: count }
});
```

**Status:** 🔴 NOT FIXED

---

### 15. **No Automatic Cleanup of Old Message History**
**Location:** Database schema
**Severity:** Medium
**Issue:** Message history grows indefinitely → database bloat.

**Fix:** Add Supabase scheduled function to cleanup old messages:
```sql
-- Run monthly
DELETE FROM message_history
WHERE created_at < NOW() - INTERVAL '6 months'
AND user_id IN (
    SELECT user_id FROM subscriptions
    WHERE status IN ('canceled', 'past_due')
);
```

**Status:** 🔴 NOT FIXED

---

## Best Practices Recommendations

### 16. **Add Request/Response Logging**
Implement structured logging for debugging:
```bash
npm install --save pino
```

### 17. **Database Connection Pooling**
Ensure Supabase connection pooling is enabled (checked in Supabase settings).

### 18. **Content Security Policy Hardening**
Remove `unsafe-inline` from scriptSrc in Helmet config.

### 19. **Add Health Check for Dependencies**
Create endpoint that verifies all services (Anthropic, Supabase, Stripe) are reachable.

### 20. **Environment-Specific Configuration**
Create separate config files for dev/staging/production.

---

## Security Assessment

### ✅ Strengths
- JWT-based authentication implemented correctly
- Rate limiting on critical endpoints (auth, chat)
- Helmet security headers enabled
- HTML escaping in frontend (no XSS via message display)
- Service role key properly restricted (admin operations only)
- Stripe webhook signature verification implemented
- Password handling via Supabase (not custom)
- Row-level security (RLS) enabled in database

### ❌ Weaknesses
- Error responses expose implementation details
- CORS configuration too permissive in dev mode
- No input validation/sanitization
- No persistent error logging
- Missing CSRF protection
- No server-side session invalidation
- Sensitive data in localStorage
- CSP policy too relaxed
- Webhook idempotency not implemented

### ⚠️ Areas for Improvement
- Add Sentry for error tracking
- Implement structured request logging
- Add authentication audit trail
- Database backup/recovery process
- Incident response plan

---

## Testing Checklist

### Authentication Flow ✓
- [ ] Sign up with valid email/password
- [ ] Sign up with invalid email (rejected)
- [ ] Sign up with weak password (rejected)
- [ ] Login with correct credentials
- [ ] Login with incorrect password (rejected)
- [ ] Token refresh/expiration
- [ ] Logout removes token from backend
- [ ] Accessing protected routes without token (rejected)

### Subscription/Payment Flow ✓
- [ ] Free user cannot access chat
- [ ] Starter plan allows 50 messages/month
- [ ] Professional plan allows 200 messages/month
- [ ] Workshop plan allows unlimited messages
- [ ] Quota reset monthly on correct date
- [ ] Stripe checkout completes successfully
- [ ] Subscription status updates after payment
- [ ] Webhook notifications update database
- [ ] Invoice webhook processed correctly
- [ ] Subscription cancellation works
- [ ] Portal session redirect works

### Chat Functionality ✓
- [ ] Send message with vehicle selected
- [ ] Receive response from Claude
- [ ] Message count increments quota
- [ ] Conversation history persists
- [ ] Rate limiting triggered after 10 req/min
- [ ] Message over 5000 chars rejected
- [ ] Forum search integrates with response

### Error Handling ✓
- [ ] Network errors handled gracefully
- [ ] API errors don't expose implementation details
- [ ] Timeout errors display user-friendly message
- [ ] Database errors don't crash application

### Security Tests ✓
- [ ] Token cannot be reused after logout
- [ ] CORS prevents cross-origin requests
- [ ] Rate limiting prevents brute force
- [ ] Admin endpoints require authentication
- [ ] Webhook requires valid signature
- [ ] Injection attacks fail

---

## Production Readiness Checklist

### Before Stripe Live Mode Activation

- [ ] **CRITICAL FIXES:** All 5 critical issues resolved
- [ ] **HIGH PRIORITY:** At least 6/10 high priority issues fixed
- [ ] **LOGGING:** Error tracking (Sentry) configured
- [ ] **MONITORING:** Uptime monitoring enabled
- [ ] **BACKUPS:** Database backup strategy verified
- [ ] **SECRETS:** All API keys stored as Netlify environment variables
- [ ] **HTTPS:** Enforced via redirect
- [ ] **TESTING:** Complete user journey tested
- [ ] **LOAD TEST:** Chat endpoint tested under load
- [ ] **SECURITY:** Security audit signed off
- [ ] **DOCUMENTATION:** Runbooks for incident response created
- [ ] **ALERTS:** Alerts configured for critical endpoints
- [ ] **RECOVERY:** Rollback procedure tested
- [ ] **GDPR:** Data retention/deletion policy confirmed

---

## Recommendations by Priority

### 🔴 **IMMEDIATE (Do Today)**
1. Fix error response disclosure
2. Fix CORS bypass vulnerability
3. Add input validation
4. Enforce HTTPS
5. Implement error logging (Sentry)

### 🟡 **THIS WEEK (Before Going Live)**
6. Implement request validation/sanitization
7. Add CSRF protection
8. Implement token blacklist for logout
9. Add webhook idempotency
10. Test all workflows thoroughly

### 🟢 **POST-LAUNCH (Optional but Recommended)**
11. Add structured request logging
12. Implement database query audit logging
13. Add health check for all dependencies
14. Implement pagination for admin endpoints
15. Add database cleanup job

---

## Sign-Off

**Audit Conducted By:** Claude Code
**Date:** 2025-10-26
**Status:** ⚠️ **NOT PRODUCTION READY** - Awaiting fixes

**Required Actions Before Production:**
- [ ] Fix all 5 CRITICAL issues
- [ ] Address at least 6 HIGH priority issues
- [ ] Complete testing checklist
- [ ] Configure monitoring/logging
- [ ] Security sign-off from team

---

## Next Steps

1. Review and approve this audit report
2. Create GitHub issues for each finding
3. Implement critical fixes (Priority 1)
4. Run full test suite
5. Deploy to staging environment
6. Conduct UAT
7. Switch Stripe to live mode
8. Deploy to production

---

**Questions?** Check documentation files:
- `README.md` - Overview
- `DEPLOYMENT.md` - Deployment guide
- `DATABASE_SCHEMA.md` - Database structure
- `SECURITY.md` - Security guidelines

