# Quick Reference - Subscription Flow

## Key Files & Locations

### Backend Core
- `middleware/auth.js` - Token validation & subscription checks
- `routes/auth.js` - Login/register & /api/auth/me endpoint
- `routes/subscriptions.js` - Stripe checkout & webhooks
- `server.js` - Chat endpoint with triple protection
- `lib/pricing.js` - Plan configuration & limits
- `utils/quota.js` - Monthly message quota tracking

### Frontend Pages
- `login.html` - User authentication
- `pricing.html` - Plan selection & Stripe checkout trigger
- `dashboard.html` - Subscription status & usage display
- `script.js` - Main chat interface with error handling

## The Three-Layer Protection System

```
Request to /api/chat
    ↓
1. authenticateToken
   - Verify JWT signature
   - Check token not blacklisted
   ↓
2. requireSubscription
   - Query: user has active/trialing/incomplete subscription?
   - Reject if no valid subscription → 403
   ↓
3. checkQuota
   - Get plan limits from PLAN_LIMITS
   - Check monthly message count
   - Reset if month changed
   - Reject if quota exceeded → 429
```

## Critical Checks

### Is User Authenticated?
- **Where**: `middleware/auth.js` → `authenticateToken()`
- **Method**: Verify JWT in Authorization header
- **Failure**: 403 Invalid or expired token

### Does User Have Subscription?
- **Where**: `middleware/auth.js` → `requireSubscription()`
- **Method**: Query `subscriptions` table for `status IN (active, trialing, incomplete)`
- **Failure**: 403 Active subscription required
- **Issue**: `incomplete` status should probably be removed (unconfirmed payment)

### Is Message Quota Available?
- **Where**: `server.js` line 306 → `checkQuota()`
- **Method**: Get `message_usage` record, check count < limit for plan
- **Failure**: 429 Monthly message quota exceeded
- **Issue**: Quota incremented even if Claude API fails (should be after success)

## Dashboard Redirect Logic

### When User Visits /dashboard.html

1. **No token?** → Redirect to /login.html
2. **Token exists?** → Call GET /api/auth/me
3. **No subscription?**
   - If `?success=true` (just paid): Retry up to 15x (max 30 sec waiting for webhook)
   - If timeout: Redirect to /pricing.html?error=subscription_not_found
4. **Has subscription?** → Display dashboard with plan & usage stats

### The Webhook Retry Problem

After payment completes on Stripe, the flow is:
```
Stripe charges card
    ↓
User redirected to /dashboard.html?success=true
    ↓
Dashboard calls /api/auth/me (subscription not in DB yet!)
    ↓
No subscription found → Start retry loop
    ↓
Webhook delivers (typically 1-5 seconds)
    ↓
Dashboard DB updated
    ↓
Retry succeeds, show dashboard
```

**Problem**: If webhook delayed >30 seconds, user sees "not found" despite being charged
**Solution**: Query Stripe API directly instead of relying on webhook

## Plan Configuration

### PLAN_LIMITS (utils/quota.js)
```javascript
{
  starter: 50,        // 50 messages per month
  professional: 200,  // 200 messages per month
  workshop: -1        // Unlimited (-1 = no limit)
}
```

### PLAN_PRICES (lib/pricing.js)
```javascript
{
  starter: process.env.STRIPE_PRICE_STARTER,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL,
  workshop: process.env.STRIPE_PRICE_WORKSHOP
}
```

## Common Error Responses

### No Subscription
- **From**: Chat endpoint when `requireSubscription` fails
- **Status**: 403
- **Response**: `{ error: 'Active subscription required', needsSubscription: true }`
- **Client Action**: Redirect to /pricing.html

### Quota Exceeded
- **From**: Chat endpoint after quota check
- **Status**: 429
- **Response**: `{ error: 'Monthly message quota exceeded', needsUpgrade: true }`
- **Client Action**: Show upgrade prompt, redirect to /pricing.html

### Invalid Token
- **From**: Any endpoint when token invalid
- **Status**: 403
- **Response**: `{ error: 'Invalid or expired token' }`
- **Client Action**: Redirect to /login.html

## Webhook Events Handled

From `routes/subscriptions.js` webhook handler:

| Event | Handler | Action |
|-------|---------|--------|
| `customer.subscription.created` | `handleSubscriptionUpdate()` | Insert into subscriptions table |
| `customer.subscription.updated` | `handleSubscriptionUpdate()` | Update subscriptions table |
| `customer.subscription.deleted` | `handleSubscriptionDeleted()` | Set status = 'canceled' |
| `invoice.payment_succeeded` | `handlePaymentSucceeded()` | Set status = 'active' |
| `invoice.payment_failed` | `handlePaymentFailed()` | Set status = 'past_due' |

## Token Lifecycle

1. **Created**: POST /api/auth/login
2. **Stored**: Client saves in localStorage
3. **Used**: Include in every request as `Authorization: Bearer <token>`
4. **Verified**: `authenticateToken()` checks signature & blacklist
5. **Expiry**: 7 days (from JWT)
6. **Blacklisted**: POST /api/auth/logout adds to blacklist table

## Database Tables Required

### subscriptions
```
user_id (UUID, PK)
stripe_customer_id (string)
stripe_subscription_id (string)
plan_id (starter|professional|workshop)
status (active|trialing|incomplete|past_due|canceled)
current_period_start (timestamp)
current_period_end (timestamp)
cancel_at_period_end (boolean)
```

### message_usage
```
user_id (UUID, PK)
message_count (integer)
month (YYYY-MM)
last_reset (timestamp)
updated_at (timestamp)
```

### webhook_events (for idempotency)
```
event_id (string, PK - from Stripe)
event_type (string)
data (JSONB)
status (processed|failed)
```

### token_blacklist
```
token_jti (string, PK)
user_id (UUID)
email (string)
expires_at (timestamp)
reason (string)
```

## Debugging Tips

### Check user has subscription in DB
```sql
SELECT * FROM subscriptions 
WHERE user_id = 'USER_UUID' 
AND status IN ('active', 'trialing', 'incomplete');
```

### Check message usage
```sql
SELECT * FROM message_usage 
WHERE user_id = 'USER_UUID' 
AND month = '2025-10';
```

### Check failed webhooks
```sql
SELECT * FROM webhook_events 
WHERE status = 'failed' 
ORDER BY created_at DESC;
```

### Verify Stripe customer linked correctly
```sql
SELECT user_id, stripe_customer_id, stripe_subscription_id, status 
FROM subscriptions 
WHERE user_id = 'USER_UUID';
```

## How to Fix Common Issues

### "User keeps getting redirected to pricing"
1. Check `/api/auth/me` returns valid subscription
2. Verify webhook_events table processed subscription event
3. Check webhook_events for failures: `status = 'failed'`
4. Manually upsert subscription if webhook failed

### "User says they're charged but can't access chat"
1. Query Stripe: `stripe.subscriptions.list({ customer: 'CUSTOMER_ID' })`
2. Check Stripe status (active/trialing/incomplete?)
3. Check if webhook delivered
4. Manually insert into subscriptions table if missing

### "Token blacklist isn't working"
1. Verify token_blacklist table exists
2. Check token actually inserted on logout
3. Check query doesn't have error (logs will show)
4. Consider fail-closed approach if table missing

### "Dashboard shows old subscription status"
1. Dashboard loads once on page open
2. Doesn't refresh if subscription changes mid-session
3. Solution: F5 refresh or implement periodic polling

## Environment Variables Required

```
JWT_SECRET=<long random string for signing tokens>
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_STARTER=price_xxxxx
STRIPE_PRICE_PROFESSIONAL=price_xxxxx
STRIPE_PRICE_WORKSHOP=price_xxxxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx
```

## Performance Notes

- Quota check queries `message_usage` table every request (1 query)
- Subscription check queries `subscriptions` table every request (1 query)
- Dashboard loads /api/auth/me once (batches 3 queries)
- Consider caching subscription status for 5-10 min if scaling
- Webhook processing stores events for audit trail (idempotency)

