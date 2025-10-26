# High Priority Fixes Implementation Guide

This guide provides step-by-step instructions to implement the remaining high-priority security and functionality improvements identified in the production audit.

**Status:** Implementation ready for deployment
**Timeline:** Implement before Stripe live mode activation

---

## Overview of Remaining Fixes

| # | Issue | Priority | Complexity | Status |
|---|-------|----------|-----------|--------|
| 1 | Structured Error Logging (Sentry) | HIGH | Medium | 🔴 TODO |
| 2 | Request Validation & Sanitization | HIGH | Medium | 🔴 TODO |
| 3 | CSRF Protection | HIGH | Medium | 🔴 TODO |
| 4 | Token Blacklist for Logout | HIGH | Low | 🔴 TODO |
| 5 | Webhook Idempotency | HIGH | Medium | 🔴 TODO |

---

## Fix #1: Structured Error Logging with Sentry

### Overview
Integrate Sentry.io for production error tracking and monitoring.

### Why
- Currently errors only logged to console (lost after restart)
- No visibility into production errors
- Can't debug customer issues
- No alerting on critical failures

### Installation Steps

```bash
# 1. Add Sentry to dependencies
npm install --save @sentry/node @sentry/tracing

# 2. Create .env variable for Sentry DSN
# Get DSN from https://sentry.io after creating project
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1
```

### Implementation

**File: server.js**

```javascript
// Add near the top of server.js (after imports, before middleware)
const Sentry = require("@sentry/node");
const { CaptureConsole } = require("@sentry/integrations");

// Initialize Sentry only in production
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || 'production',
        integrations: [
            new CaptureConsole({
                levels: ['error', 'warn']
            })
        ],
        tracesSampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || '0.1'),
        // Capture performance monitoring
        beforeSend(event, hint) {
            if (event.exception) {
                const error = hint.originalException;
                console.error('Sentry capturing error:', error.message);
            }
            return event;
        }
    });

    // Attach Sentry to Express
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.errorHandler()); // Must be last error handler
}
```

**File: .env (production)**

```
SENTRY_DSN=https://your-key@sentry.io/project-id
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1
```

### Testing

```javascript
// Test endpoint to verify Sentry is working
app.get('/api/debug/error', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Not available in production' });
    }

    try {
        throw new Error('Test error for Sentry');
    } catch (error) {
        Sentry.captureException(error);
        res.json({ message: 'Error captured and sent to Sentry' });
    }
});
```

### Netlify Configuration

Add to netlify.toml:
```toml
[env.production]
  SENTRY_DSN = "your-sentry-dsn"
  SENTRY_ENVIRONMENT = "production"
```

### Verification
- [ ] Sentry.io account created and project set up
- [ ] DSN added to Netlify environment variables
- [ ] Test error captured and appears in Sentry dashboard
- [ ] Error alerts configured in Sentry

---

## Fix #2: Request Validation & Sanitization

### Overview
Validate and sanitize all user inputs to prevent injection attacks.

### Why
- Currently minimal input validation
- Risk of SQL injection, XSS, command injection
- No length/format checks on user inputs
- Missing type validation

### Installation Steps

```bash
npm install --save express-validator
```

### Implementation

**File: routes/auth.js** (Update signup/login validation)

```javascript
const { body, validationResult } = require('express-validator');

// Validation rules
const signupValidation = [
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Must be a valid email'),
    body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Password must be 8-128 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain uppercase, lowercase, and numbers'),
    body('name')
        .optional()
        .trim()
        .isLength({ max: 100 })
        .matches(/^[a-zA-Z\s-']+$/)
        .withMessage('Name contains invalid characters')
];

const loginValidation = [
    body('email')
        .isEmail()
        .normalizeEmail(),
    body('password')
        .isLength({ min: 1 })
        .withMessage('Password required')
];

// Validation middleware
const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Apply validation to routes
router.post('/signup', authLimiter, signupValidation, validateInput, async (req, res) => {
    // ... rest of signup code
});

router.post('/login', authLimiter, loginValidation, validateInput, async (req, res) => {
    // ... rest of login code
});
```

**File: routes/subscriptions.js** (Update checkout validation)

```javascript
const { body, validationResult } = require('express-validator');

const checkoutValidation = [
    body('planId')
        .isIn(['starter', 'professional', 'workshop'])
        .withMessage('Invalid plan selected')
];

const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

router.post('/create-checkout',
    authLimiter,
    authenticateToken,
    checkoutValidation,
    validateInput,
    async (req, res) => {
        // ... rest of code
    }
);
```

**File: server.js** (Update chat endpoint validation)

```javascript
const { body, validationResult } = require('express-validator');

const chatValidation = [
    body('message')
        .trim()
        .isLength({ min: 1, max: 5000 })
        .withMessage('Message must be 1-5000 characters'),
    body('conversationHistory')
        .isArray()
        .withMessage('Conversation history must be an array')
        .custom((value) => value.length <= 50)
        .withMessage('Conversation history limited to 50 messages')
];

const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Invalid request',
            details: errors.array()
        });
    }
    next();
};

app.post('/api/chat',
    chatLimiter,
    authenticateToken,
    requireSubscription,
    chatValidation,
    validateInput,
    async (req, res) => {
        // ... rest of code
    }
);
```

### Verification
- [ ] npm install express-validator succeeds
- [ ] All auth endpoints validated
- [ ] All subscription endpoints validated
- [ ] Chat endpoint validated
- [ ] Test with invalid inputs rejected
- [ ] Test with valid inputs accepted

---

## Fix #3: CSRF Protection

### Overview
Prevent Cross-Site Request Forgery attacks on state-changing operations.

### Why
- Users could be tricked into making unwanted purchases
- Subscriptions could be modified without consent
- No protection for sensitive operations

### Installation Steps

```bash
npm install --save csurf
```

### Implementation

**File: server.js** (Add CSRF middleware setup)

```javascript
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Must come before CSRF protection
app.use(cookieParser());

// Configure CSRF protection (skip for specific endpoints)
const csrfProtection = csrf({
    cookie: false,
    sessionKey: 'session',
    // Skip CSRF for API requests (use token in Authorization header instead)
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
    safe: true
});

// Skip CSRF for webhook (Stripe signature verification is enough)
app.use((req, res, next) => {
    if (req.path === '/api/subscriptions/webhook') {
        return next();
    }
    csrfProtection(req, res, next);
});

// Provide CSRF token to client
app.get('/api/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});
```

**File: script.js** (Client-side - request CSRF token)

```javascript
// Get CSRF token on app load
async function getCsrfToken() {
    try {
        const response = await fetch('/api/csrf-token');
        const data = await response.json();
        localStorage.setItem('csrfToken', data.csrfToken);
        return data.csrfToken;
    } catch (error) {
        console.error('Failed to get CSRF token:', error);
    }
}

// Update all API calls to include CSRF token
async function apiCall(url, options = {}) {
    const csrfToken = localStorage.getItem('csrfToken');

    if (csrfToken) {
        options.headers = {
            ...options.headers,
            'X-CSRF-Token': csrfToken
        };
    }

    return fetch(url, options);
}

// Use instead of fetch for all POST/PUT/DELETE requests
// Example:
const response = await apiCall('/api/subscriptions/create-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: 'starter' })
});
```

### Verification
- [ ] npm install csurf succeeds
- [ ] CSRF token endpoint accessible
- [ ] Client receives token on load
- [ ] Token sent with state-changing requests
- [ ] Invalid token rejected with 403

---

## Fix #4: Token Blacklist for Logout

### Overview
Implement server-side token invalidation on logout.

### Why
- Currently logout only removes client-side token
- Token remains valid on server until expiration (7 days)
- Compromised tokens can't be revoked immediately
- No way to force logout across all sessions

### Implementation

**File: lib/tokenBlacklist.js** (New file)

```javascript
// Simple in-memory token blacklist
// For production, use Redis: npm install --save redis
// Then replace Set with Redis integration

class TokenBlacklist {
    constructor() {
        this.tokens = new Set();
        // Cleanup expired tokens every hour
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    add(token, expiresAt) {
        this.tokens.add({
            token,
            expiresAt: expiresAt || Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
        });
    }

    has(token) {
        for (let entry of this.tokens) {
            if (entry.token === token && entry.expiresAt > Date.now()) {
                return true;
            }
        }
        return false;
    }

    cleanup() {
        const now = Date.now();
        for (let entry of this.tokens) {
            if (entry.expiresAt <= now) {
                this.tokens.delete(entry);
            }
        }
    }
}

module.exports = new TokenBlacklist();
```

**File: middleware/auth.js** (Update authenticateToken)

```javascript
const tokenBlacklist = require('../lib/tokenBlacklist');

async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }

        // Check if token is blacklisted
        if (tokenBlacklist.has(token)) {
            return res.status(401).json({ error: 'Token has been revoked' });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // ... rest of validation
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
}
```

**File: routes/auth.js** (Update logout endpoint)

```javascript
const tokenBlacklist = require('../lib/tokenBlacklist');

router.post('/logout', authenticateToken, async (req, res) => {
    try {
        const token = req.headers['authorization'].split(' ')[1];

        // Add token to blacklist (expires when JWT expires)
        tokenBlacklist.add(token);

        // Also revoke from Supabase
        await supabase.auth.signOut();

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Error logging out' });
    }
});
```

### Production Recommendation: Use Redis

For production, replace in-memory Set with Redis:

```bash
npm install --save redis
```

**File: lib/tokenBlacklist.js** (Redis version)

```javascript
const redis = require('redis');

const client = redis.createClient({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD
});

client.on('error', (err) => console.log('Redis Client Error', err));
client.connect();

class TokenBlacklist {
    async add(token, expiresAt) {
        const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
        await client.setEx(`blacklist:${token}`, ttl, 'true');
    }

    async has(token) {
        const result = await client.get(`blacklist:${token}`);
        return result !== null;
    }
}

module.exports = new TokenBlacklist();
```

### Verification
- [ ] Token added to blacklist on logout
- [ ] Blacklisted token rejected on next request
- [ ] Blacklist cleaned up after token expiration
- [ ] Test logout invalidates token

---

## Fix #5: Webhook Idempotency

### Overview
Prevent duplicate processing of Stripe webhooks.

### Why
- Stripe may retry failed webhooks
- Could process same event twice → double charges
- Could create duplicate records

### Implementation (No dependencies needed)

**File: lib/webhookCache.js** (New file)

```javascript
// Track processed webhook IDs to prevent duplicates
// In production, use Redis or database

class WebhookCache {
    constructor() {
        this.processed = new Set();
        // Keep webhooks for 24 hours then clean up
        setInterval(() => this.cleanup(), 60 * 60 * 1000);
    }

    has(webhookId) {
        return this.processed.has(webhookId);
    }

    add(webhookId) {
        this.processed.add({
            id: webhookId,
            timestamp: Date.now()
        });
    }

    cleanup() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000;

        for (let entry of this.processed) {
            if (now - entry.timestamp > maxAge) {
                this.processed.delete(entry);
            }
        }
    }
}

module.exports = new WebhookCache();
```

**File: routes/subscriptions.js** (Update webhook handler)

```javascript
const webhookCache = require('../lib/webhookCache');

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Check if webhook already processed (idempotency)
    if (webhookCache.has(event.id)) {
        console.log('Webhook already processed:', event.id);
        return res.json({ received: true });
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                await handleSubscriptionUpdate(event.data.object);
                break;

            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;

            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;

            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        // Mark webhook as processed AFTER successful handling
        webhookCache.add(event.id);
        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        // Don't mark as processed on error - Stripe will retry
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});
```

### Production Recommendation: Use Database

Store webhook processing status in database for persistence:

```sql
-- Add to database schema
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY,
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT DEFAULT 'processing',
    processed_at TIMESTAMP DEFAULT NOW(),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_webhook_stripe_id ON webhook_events(stripe_event_id);
```

### Verification
- [ ] Duplicate webhook events return 200 without reprocessing
- [ ] Webhook event recorded after successful processing
- [ ] Failed webhooks not marked as processed (allows retry)
- [ ] Test webhook replay with Stripe CLI

---

## Implementation Roadmap

### Phase 1: Validation & CSRF (Low Risk)
1. Install express-validator
2. Add validation to auth endpoints
3. Add validation to subscription endpoints
4. Test endpoints with invalid inputs
5. Deploy and monitor

**Estimated Time:** 2-3 hours

### Phase 2: Error Logging (Medium Risk)
1. Set up Sentry account
2. Add Sentry SDK
3. Configure environment variables
4. Test error capture
5. Set up alerts
6. Deploy

**Estimated Time:** 1-2 hours

### Phase 3: Token & Webhook (Low Risk)
1. Add token blacklist implementation
2. Update logout endpoint
3. Add webhook idempotency
4. Test logout invalidates token
5. Test webhook deduplication
6. Deploy

**Estimated Time:** 2-3 hours

### Phase 4: CSRF (Medium Risk - Optional)
1. Add CSRF middleware
2. Update client to fetch and send token
3. Test CSRF protection
4. Deploy

**Estimated Time:** 1-2 hours

---

## Testing Checklist

### After Each Fix Implementation

- [ ] npm install succeeds without errors
- [ ] Application starts without crashes
- [ ] All endpoints return expected responses
- [ ] Specific functionality for fix works correctly
- [ ] No regressions in other endpoints
- [ ] Logs show fix is active/working
- [ ] Rate limiting still works
- [ ] Database operations still work

### Before Production Deployment

- [ ] All 5 fixes implemented and tested
- [ ] Full user journey tested end-to-end
- [ ] Error handling works (test with intentional errors)
- [ ] Logging captures errors (check Sentry dashboard)
- [ ] Validation rejects invalid inputs
- [ ] CSRF prevents cross-origin attacks
- [ ] Token blacklist invalidates logout
- [ ] Webhook idempotency prevents duplicates
- [ ] Load testing passes
- [ ] Security audit passes

---

## Next Steps

1. **Today:** Implement Fixes #1-2 (Validation & Error Logging)
2. **Tomorrow:** Implement Fixes #3-5 (CSRF, Token Blacklist, Webhook)
3. **This Week:** Complete testing and deploy to staging
4. **Next Week:** UAT and production deployment

---

## Questions & Support

- Sentry Setup: https://docs.sentry.io/platforms/javascript/guides/node/
- Express Validator: https://express-validator.github.io/
- CSRF Protection: https://www.npmjs.com/package/csurf
- Stripe Webhooks: https://stripe.com/docs/webhooks

