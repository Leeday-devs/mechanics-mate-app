# My Mechanic - Subscription Check & Dashboard Flow Analysis

## Project Overview
This is a web-based automotive AI assistant application built with Node.js/Express backend and vanilla JavaScript frontend. It uses:
- **Authentication**: Supabase Auth + JWT tokens
- **Payment**: Stripe subscriptions
- **Database**: Supabase PostgreSQL
- **Plan Models**: Starter (50 msgs/month), Professional (200 msgs/month), Workshop (unlimited)

---

## 1. SUBSCRIPTION CHECK FLOW

### 1.1 High-Level Flow Diagram

```
User Login → API validates JWT → Check Subscription Status → Access Chat
      ↓
No Subscription Found
      ↓
Redirect to /pricing.html → User selects plan → Stripe checkout
      ↓
Payment Success → Webhook updates DB → Retry dashboard load
```

### 1.2 Authentication Middleware (`middleware/auth.js`)

**Function: `authenticateToken`**
- Extracts JWT token from `Authorization: Bearer <token>` header
- Verifies token signature using `JWT_SECRET`
- Checks if token is blacklisted (logout protection)
- Attaches user object to `req.user` with `id` and `email`

**Function: `requireSubscription`**
```javascript
// Lines 74-101 of middleware/auth.js
async function requireSubscription(req, res, next) {
    const userId = req.user.id;
    
    // Query subscriptions table - accepts: active, trialing, incomplete
    const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'incomplete'])
        .single();
    
    if (error || !subscription) {
        return res.status(403).json({
            error: 'Active subscription required',
            needsSubscription: true
        });
    }
    
    req.subscription = subscription;  // Attach to request
    next();
}
```

**Key Points:**
- Only accepts statuses: `active`, `trialing`, `incomplete`
- Rejects: `past_due`, `canceled`, `incomplete_expired`
- Returns 403 if no valid subscription found

---

## 2. DASHBOARD REDIRECT FLOW

### 2.1 Dashboard Page Load (`dashboard.html` script section)

**Entry Point: `loadDashboard(retryCount = 0)` - Line 408**

```javascript
// Step 1: Check for auth token
const token = localStorage.getItem('authToken');
if (!token) {
    window.location.href = '/login.html';  // Redirect unauthenticated users
    return;
}

// Step 2: Call /api/auth/me endpoint
const response = await fetch('/api/auth/me', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});

// Step 3: Process response
const data = await response.json();
// data contains: { user, subscription, usage, isAdmin }
```

### 2.2 Subscription Validation Logic (Lines 459-487)

```javascript
// Valid subscription statuses
const validStatuses = ['active', 'trialing', 'incomplete'];

// Check if user has valid subscription
if (!data.subscription || !validStatuses.includes(data.subscription.status)) {
    
    // SPECIAL CASE: Just completed payment
    if (fromPayment && retryCount < 15) {
        // Wait for webhook to update DB (max 15 retries, 2sec each = 30 sec total)
        planBadge.textContent = 'Processing Payment...';
        planInfo.innerHTML = '<p>Your payment is being processed. Please wait...</p>';
        
        setTimeout(() => loadDashboard(retryCount + 1), 2000);  // Retry loop
        return;
    }
    
    // NO SUBSCRIPTION FOUND - REDIRECT TO PRICING
    console.error('[Dashboard] No subscription. Redirecting to pricing.');
    window.location.href = '/pricing.html?error=subscription_not_found';
    return;
}

// HAS VALID SUBSCRIPTION - Load dashboard data
const planId = data.subscription.plan_id;
const planName = PLAN_NAMES[planId];
planBadge.textContent = `${planName} Plan`;

// Display usage stats
const limit = PLAN_LIMITS[planId];
const used = data.usage.message_count;
const remaining = limit === -1 ? '∞' : Math.max(0, limit - used);
```

**Redirect Scenarios:**
1. No auth token → `/login.html`
2. No valid subscription → `/pricing.html?error=subscription_not_found`
3. Payment processing → Retry loop (max 15 retries with 2-second delay)
4. Valid subscription → Display dashboard with usage stats

---

## 3. PRICING PAGE FLOW

### 3.1 Plan Selection (pricing.html, Lines 308-350)

**User clicks "Select [Plan]" button:**

```javascript
const planId = button.dataset.plan;  // 'starter', 'professional', 'workshop'
const token = localStorage.getItem('authToken');

// Call backend to create Stripe checkout session
const response = await fetch('/api/subscriptions/create-checkout', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ planId })
});

// Redirect to Stripe Checkout URL
const data = await response.json();
window.location.href = data.url;  // Stripe checkout page
```

### 3.2 Backend Checkout Creation (`routes/subscriptions.js`, Lines 11-101)

```javascript
router.post('/create-checkout', authenticateToken, async (req, res) => {
    const { planId } = req.body;
    const userId = req.user.id;
    
    // Step 1: Validate plan
    if (!planId || !PLAN_PRICES[planId]) {
        return res.status(400).json({ error: 'Invalid plan selected' });
    }
    
    // Step 2: Check no existing active subscription
    const { data: existingSub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();
    
    if (existingSub) {
        return res.status(400).json({ error: 'You already have an active subscription' });
    }
    
    // Step 3: Create or retrieve Stripe customer
    // Create Stripe customer linked to user via metadata
    const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: userId }
    });
    
    // Step 4: Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [{ price: PLAN_PRICES[planId], quantity: 1 }],
        mode: 'subscription',
        success_url: '/dashboard.html?success=true',
        cancel_url: '/pricing.html?canceled=true',
        metadata: { user_id: userId, plan_id: planId }
    });
    
    res.json({ sessionId: session.id, url: session.url });
});
```

**PLAN_PRICES** (lib/pricing.js):
```javascript
const PLAN_PRICES = {
    starter: process.env.STRIPE_PRICE_STARTER,      // from .env
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    workshop: process.env.STRIPE_PRICE_WORKSHOP
};

const PLAN_LIMITS = {
    starter: 50,
    professional: 200,
    workshop: -1  // -1 = unlimited
};
```

---

## 4. PAYMENT & WEBHOOK HANDLING

### 4.1 Stripe Webhook Flow (`routes/subscriptions.js`, Lines 154-254)

```javascript
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    // Step 1: Verify webhook signature
    event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
    );
    
    // Step 2: Check idempotency (prevent duplicate processing)
    const { data: existingEvent } = await supabaseAdmin
        .from('webhook_events')
        .select('id')
        .eq('event_id', event.id)
        .single();
    
    if (existingEvent) {
        return res.json({ received: true, duplicate: true });
    }
    
    // Step 3: Handle webhook events
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
    }
    
    // Step 4: Record webhook for idempotency
    await supabaseAdmin
        .from('webhook_events')
        .insert({
            event_id: event.id,
            event_type: event.type,
            data: event,
            status: 'processed'
        });
});
```

### 4.2 Subscription Update Handler (Lines 256-312)

```javascript
async function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;  // 'active', 'trialing', etc.
    
    // Get user ID from Stripe customer metadata
    const customer = await stripe.customers.retrieve(customerId);
    const userId = customer.metadata.supabase_user_id;
    
    // Get plan ID
    let planId = subscription.metadata?.plan_id;
    if (!planId) {
        const priceId = subscription.items.data[0].price.id;
        planId = Object.keys(PLAN_PRICES).find(key => PLAN_PRICES[key] === priceId);
    }
    
    // Upsert subscription into DB
    await supabaseAdmin
        .from('subscriptions')
        .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan_id: planId,
            status: status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end
        }, {
            onConflict: 'user_id'  // Update existing or insert new
        });
}
```

---

## 5. API ENDPOINT FOR AUTH STATE

### 5.1 GET /api/auth/me (`routes/auth.js`, Lines 268-304)

**Purpose**: Retrieve current user subscription and usage state

```javascript
router.get('/me', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    
    // Get subscription with valid statuses
    const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'incomplete'])
        .single();
    
    // Get message usage for this month
    const { data: usage } = await supabaseAdmin
        .from('message_usage')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    // Check admin status
    const { data: admin } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    res.json({
        user: req.user,
        subscription: subscription || null,
        usage: usage || { message_count: 0, month: current_month },
        isAdmin: !!admin
    });
});
```

**Response Structure:**
```json
{
    "user": {
        "id": "uuid",
        "email": "user@example.com"
    },
    "subscription": {
        "user_id": "uuid",
        "plan_id": "professional",
        "status": "active",
        "current_period_end": "2025-11-30T...",
        "cancel_at_period_end": false
    },
    "usage": {
        "user_id": "uuid",
        "message_count": 45,
        "month": "2025-10"
    },
    "isAdmin": false
}
```

---

## 6. CHAT API PROTECTION

### 6.1 Chat Endpoint (`server.js`, Line 273)

```javascript
app.post('/api/chat', 
    chatLimiter,           // Rate limiting
    authenticateToken,     // Require JWT token
    requireSubscription,   // Require active subscription
    async (req, res) => {
        // Check message quota
        const quotaCheck = await checkQuota(userId, subscription.plan_id);
        if (!quotaCheck.allowed) {
            return res.status(429).json({
                error: 'Monthly message quota exceeded',
                needsUpgrade: true
            });
        }
        
        // Process chat message...
    }
);
```

**Three layers of protection:**
1. Token validation
2. Subscription status check
3. Monthly quota enforcement

### 6.2 Quota Checking (`utils/quota.js`, Lines 11-76)

```javascript
async function checkQuota(userId, planId) {
    const currentMonth = getCurrentMonth();  // YYYY-MM
    const limit = PLAN_LIMITS[planId];
    
    // Unlimited plan
    if (limit === -1) {
        return { allowed: true, remaining: -1 };
    }
    
    // Get or create usage record
    const { data: usage } = await supabaseAdmin
        .from('message_usage')
        .select('*')
        .eq('user_id', userId)
        .single();
    
    // Check if month changed - reset quota
    if (usage.month !== currentMonth) {
        await supabaseAdmin
            .from('message_usage')
            .update({
                message_count: 0,
                month: currentMonth,
                last_reset: new Date().toISOString()
            })
            .eq('user_id', userId);
        
        return { allowed: true, remaining: limit, limit, used: 0 };
    }
    
    // Check if quota exceeded
    const remaining = limit - usage.message_count;
    return {
        allowed: remaining > 0,
        remaining: Math.max(0, remaining),
        limit,
        used: usage.message_count
    };
}
```

---

## 7. CLIENT-SIDE ERROR HANDLING

### 7.1 Quota Exceeded Error (`script.js`, Lines 567-574)

```javascript
else if (error.message.includes('quota exceeded')) {
    errorMessage = '📊 Monthly message quota exceeded! Please upgrade your plan.';
    
    if (confirm('Monthly message quota exceeded!\n\nWould you like to upgrade?')) {
        window.location.href = '/pricing.html';  // Redirect to pricing
    }
}
```

### 7.2 No Subscription Error (`script.js`, Lines 582-587)

```javascript
else if (error.message.includes('subscription required')) {
    errorMessage = '💳 Active subscription required. Please subscribe.';
    
    setTimeout(() => {
        const errorPageUrl = '/auth-error.html?type=no_subscription&code=NO_SUBSCRIPTION';
        window.location.href = errorPageUrl;
    }, 2000);
}
```

---

## 8. IDENTIFIED ISSUES & CONCERNS

### CRITICAL ISSUES

#### Issue 1: Race Condition in Subscription Validation
**Location**: Dashboard `loadDashboard()` with webhook retry loop
**Problem**: 
- Dashboard performs up to 15 retries waiting for webhook (30 seconds maximum)
- Stripe webhook delivery is asynchronous and not guaranteed to arrive within this window
- If webhook is delayed beyond 30 seconds, user gets redirected to pricing despite having paid
- User might already be charged but can't access the service

**Code**:
```javascript
if (fromPayment && retryCount < 15) {
    setTimeout(() => loadDashboard(retryCount + 1), 2000);  // Max 30 seconds
    return;
}
// After 30 seconds: redirect to pricing
window.location.href = '/pricing.html?error=subscription_not_found';
```

**Impact**: High - User confusion, support tickets
**Recommendation**: 
- Implement longer retry window (60+ seconds)
- Add server-side status check using Stripe API directly
- Display more user-friendly message about processing

#### Issue 2: Silent Token Blacklist Failures
**Location**: `middleware/auth.js`, Lines 23-43
**Problem**:
- Token blacklist check catches exceptions but continues if table doesn't exist
- If blacklist query fails for any reason, token is still accepted
- Logged-out users might still be able to use old tokens

**Code**:
```javascript
try {
    const { data: blacklistedToken } = await supabaseAdmin
        .from('token_blacklist')
        .select('id')
        .eq('token_jti', ...)
        .single();
    // If table missing or error occurs, falls through without blocking
} catch (error) {
    if (error.code !== 'PGRST116') {
        console.warn('Could not check token blacklist:', error.message);
        // ⚠️ Continues to next() anyway!
    }
}
```

**Impact**: Medium - Security concern, session management issue
**Recommendation**: 
- Fail-closed approach: reject auth if blacklist check fails
- Or ensure token_blacklist table exists before app starts

#### Issue 3: Incomplete Subscription Status Acceptance
**Location**: Multiple places accept `incomplete` status
**Problem**:
- `incomplete` status is used for failed initial payment attempts
- Treating it as valid subscription allows users with unpaid invoices to access chat
- Stripe-specific statuses not well-documented in code comments

**Code** (middleware/auth.js):
```javascript
.in('status', ['active', 'trialing', 'incomplete'])  // ⚠️ What is incomplete?
```

**Statuses Explained**:
- `active`: Valid paid subscription
- `trialing`: Free trial period
- `incomplete`: Awaiting payment completion (not yet confirmed)
- `incomplete_expired`: Payment attempt expired
- `past_due`: Payment failed but not yet canceled
- `canceled`: User canceled or payment permanently failed

**Impact**: Low-Medium - Users without confirmed payment can access service
**Recommendation**: Remove `incomplete` from accepted statuses OR properly document

### MODERATE ISSUES

#### Issue 4: No Quota Enforcement on Chat Endpoint Load
**Location**: `server.js` Line 306, `utils/quota.js`
**Problem**:
- Quota is checked but message still sent if limit exceeded
- Quota counter incremented regardless of whether response succeeds
- No rollback if API call to Claude fails after quota increment

**Code** (server.js):
```javascript
const quotaCheck = await checkQuota(userId, subscription.plan_id);
if (!quotaCheck.allowed) {
    return res.status(429).json({ error: 'Monthly message quota exceeded' });
}
// ... process message ...
await incrementQuota(userId);  // ⚠️ Always incremented, even if Claude call fails
```

**Impact**: Medium - User sees quota exhausted but some messages don't process
**Recommendation**: Increment quota AFTER successful response from Claude

#### Issue 5: Dashboard Doesn't Validate Subscription Status in Real-Time
**Location**: `dashboard.html` loads data once on page load
**Problem**:
- Dashboard shows subscription status at page load time
- If subscription is canceled while viewing dashboard, page doesn't update
- User can still see "Active" status and click chat button

**Impact**: Low - Page shows cached state, but chat endpoint catches real state
**Recommendation**: Add periodic refresh or WebSocket subscription status updates

#### Issue 6: Missing Environment Variable Validation
**Location**: `lib/pricing.js` Lines 33-46
**Problem**:
- App warns about missing Stripe Price IDs but continues
- Checkout will fail silently if prices not configured
- Should fail at startup in production

**Code**:
```javascript
function validatePricingConfig() {
    const missingPrices = [];
    if (!PLAN_PRICES.starter) missingPrices.push('STRIPE_PRICE_STARTER');
    // ... warnings only ...
    return missingPrices.length === 0;
}
// Called but return value not enforced
```

**Impact**: Low - App won't function without Stripe config, but needs better UX
**Recommendation**: Require validation at startup, throw error if missing

### MINOR ISSUES

#### Issue 7: Hardcoded Redirect URLs
**Location**: Multiple files (pricing.html, subscriptions.js)
**Problem**:
- Success/cancel URLs hardcoded as relative paths
- May not work correctly in different deployment environments

**Code** (subscriptions.js):
```javascript
success_url: `${req.headers.origin || 'http://localhost:3000'}/dashboard.html?success=true`,
```

**Recommendation**: Use environment variable for base URL

#### Issue 8: No PII Logging Controls
**Location**: `middleware/auth.js` and throughout
**Problem**:
- Console logs include email addresses
- Production logs might expose user information

**Code**:
```javascript
console.log('🔐 Token verified for user:', decoded.email);
console.log('✅ Auth successful for user:', req.user.email);
```

**Recommendation**: Use user ID instead of email in logs

---

## 9. FLOW SEQUENCE DIAGRAMS

### 9.1 Login Flow

```
User inputs credentials
    ↓
POST /api/auth/login (with credentials)
    ↓
Validate with Supabase Auth
    ↓
Query subscriptions table (active, trialing, incomplete only)
    ↓
Generate JWT token (7-day expiry)
    ↓
Response: { token, user, hasSubscription, subscription }
    ↓
Client stores token in localStorage
    ↓
User can access chat if subscription exists
```

### 9.2 Chat Message Flow

```
User on dashboard types message
    ↓
GET auth token from localStorage
    ↓
POST /api/chat with message + token
    ↓
authenticateToken middleware: verify JWT signature
    ↓
requireSubscription middleware: check subscriptions table
    ↓
checkQuota(): verify monthly message limit not exceeded
    ↓
Send to Claude API with vehicle context
    ↓
incrementQuota(): increment user's message count
    ↓
Response: assistant message + updated conversation history
    ↓
If quota exceeded → 429 error + suggest upgrade
    ↓
If no subscription → 403 error + redirect to /pricing.html
```

### 9.3 Subscription Lifecycle

```
User on pricing.html
    ↓
Clicks "Select [Plan]"
    ↓
POST /api/subscriptions/create-checkout { planId }
    ↓
Check: no existing active subscription?
    ↓
Create/retrieve Stripe customer (linked via metadata)
    ↓
Create Stripe checkout session
    ↓
Redirect to Stripe payment form (session.url)
    ↓
User completes payment on Stripe
    ↓
Stripe webhook: customer.subscription.created/updated
    ↓
Webhook handler: upsert subscription into DB with status
    ↓
User redirected to /dashboard.html?success=true
    ↓
Dashboard loadDashboard() function:
   - Checks /api/auth/me
   - Sees subscription status = "active"
   - Displays plan details + usage stats
   - OR: If webhook hasn't processed yet, retries up to 15x (30 sec)
```

---

## 10. SECURITY ANALYSIS

### Authentication Chain
1. Supabase Auth handles user creation/password security
2. Backend generates JWT after Supabase validation
3. JWT sent in Authorization header for subsequent requests
4. Token blacklist checked on each request
5. Token expiry: 7 days

### Subscription Verification
1. Stripe owns truth of subscription state
2. Webhook updates local DB as source of truth for app
3. Each chat request verifies subscription exists
4. Monthly quotas reset automatically by month

### Potential Weaknesses
- JWT tokens stored in localStorage (vulnerable to XSS)
- No CSRF tokens visible in chat API (may be behind rate limiting)
- Webhook signature verification looks correct
- SQL injection risk mitigated by Supabase query builder

---

## 11. DATABASE SCHEMA REFERENCES

### subscriptions table
```sql
user_id (FK to auth.users)
stripe_customer_id
stripe_subscription_id
plan_id (starter|professional|workshop)
status (active|trialing|incomplete|past_due|canceled)
current_period_start (timestamp)
current_period_end (timestamp)
cancel_at_period_end (boolean)
```

### message_usage table
```sql
user_id (FK to auth.users)
message_count (integer)
month (YYYY-MM format)
last_reset (timestamp)
updated_at (timestamp)
```

### webhook_events table
```sql
event_id (Stripe event ID)
event_type (string)
data (JSONB)
status (processed|failed)
created_at (timestamp)
```

### token_blacklist table
```sql
token_jti (string, primary key)
user_id (FK)
email (string)
expires_at (timestamp)
reason (string)
```

---

## SUMMARY & RECOMMENDATIONS

### What Works Well
- Three-layer protection: auth → subscription → quota
- Idempotent webhook processing
- Monthly quota reset mechanism
- Clear separation of concerns
- Stripe integration follows best practices

### Critical Fixes Needed (Priority: P1)
1. Extend webhook retry window or query Stripe API directly
2. Implement fail-closed on token blacklist check
3. Document and validate subscription status values

### Important Improvements (Priority: P2)
1. Move quota increment after successful Claude response
2. Audit and remove PII from logs
3. Add environment variable validation at startup
4. Implement real-time subscription status updates

### Nice-to-Have (Priority: P3)
1. Use centralized logger instead of console.log
2. Add subscription status change webhooks
3. Implement usage analytics dashboard
4. Add grace period for past_due subscriptions

