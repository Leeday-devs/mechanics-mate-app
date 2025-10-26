# ⚠️ CRITICAL: Stripe Keys Configuration Guide

**IMPORTANT:** Using LIVE Stripe keys in development can result in REAL CHARGES.

This document explains how to properly configure Stripe keys for development, staging, and production.

---

## 🚨 CRITICAL ISSUE: LIVE vs TEST Keys

### The Problem
- **TEST Keys** (start with `sk_test_`, `pk_test_`) - Process fake transactions on sandbox
- **LIVE Keys** (start with `sk_live_`, `pk_live_`) - Process REAL money
- If you use LIVE keys in development, test transactions will charge REAL credit cards

### The Solution
Use the CORRECT keys for each environment:

| Environment | Stripe Keys | NODE_ENV | Real Charges? |
|-------------|------------|----------|---------------|
| **Development** (Local) | `sk_test_...` / `pk_test_...` | development | ❌ NO |
| **Staging** (Testing) | `sk_test_...` / `pk_test_...` | staging | ❌ NO |
| **Production** (Live) | `sk_live_...` / `pk_live_...` | production | ✅ YES |

---

## 📋 Setup Steps

### Step 1: Create Local Development .env File

**File:** `.env` (in your project root, never commit this)

```bash
# Copy from .env.example and modify
cp .env.example .env
```

**Fill in with TEST keys from Stripe:**

```
# Development - Use TEST keys (sk_test_... and pk_test_...)
ANTHROPIC_API_KEY=sk-ant-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
STRIPE_SECRET_KEY=sk_test_1234567890abcdef       # ⚠️ TEST KEY (starts with sk_test_)
STRIPE_PUBLISHABLE_KEY=pk_test_1234567890abcdef # ⚠️ TEST KEY (starts with pk_test_)
STRIPE_WEBHOOK_SECRET=whsec_test_1234567890      # ⚠️ TEST WEBHOOK SECRET
STRIPE_PRICE_STARTER=price_1234567890abcdef
STRIPE_PRICE_PROFESSIONAL=price_0987654321fedcba
STRIPE_PRICE_WORKSHOP=price_abcdef1234567890
JWT_SECRET=your-random-secret-min-32-chars
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### Step 2: Get TEST Keys from Stripe

1. Go to **[Stripe Dashboard](https://dashboard.stripe.com)**
2. Click **"Developers"** (bottom left)
3. Toggle **"Test mode"** (top right) - should show blue "Test Mode" indicator
4. Go to **API Keys**
5. Copy the **Publishable key** (starts with `pk_test_`)
6. Copy the **Secret key** (starts with `sk_test_`)
7. Go to **Webhooks** → **Add endpoint**
8. Copy the **Signing secret** (starts with `whsec_test_`)

### Step 3: Get TEST Price IDs from Stripe

1. Go to **Products** in Stripe
2. Create or find your test products:
   - Starter
   - Professional
   - Workshop
3. Copy the **Price ID** for each (starts with `price_`)
4. Add to `.env`

### Step 4: Verify Setup

```bash
# Start the server
npm start

# Should see:
# ✅ Environment validation passed
# ✅ No warnings about using LIVE keys in development
```

---

## 🚀 Production Setup (Netlify)

### Get LIVE Keys from Stripe

1. Go to **[Stripe Dashboard](https://dashboard.stripe.com)**
2. Make sure **Test mode is OFF** (toggle in top right)
3. Go to **API Keys**
4. Copy **Publishable key** (starts with `pk_live_`)
5. Copy **Secret key** (starts with `sk_live_`)
6. Go to **Webhooks** → Add endpoint for production domain
7. Copy **Signing secret** (starts with `whsec_live_`)

### Set Production Environment Variables in Netlify

1. Go to **Netlify Dashboard**
2. Select your site
3. Go to **Site settings** → **Build & deploy** → **Environment**
4. Add these variables:

```
STRIPE_SECRET_KEY=sk_live_your_real_key_here
STRIPE_PUBLISHABLE_KEY=pk_live_your_real_key_here
STRIPE_WEBHOOK_SECRET=whsec_live_your_real_key_here
STRIPE_PRICE_STARTER=price_live_xxx
STRIPE_PRICE_PROFESSIONAL=price_live_xxx
STRIPE_PRICE_WORKSHOP=price_live_xxx
NODE_ENV=production
```

5. **DO NOT** add these to `.env` file
6. **DO NOT** commit them to GitHub

### Webhook Configuration for Production

1. Go to Stripe → **Webhooks**
2. Add new endpoint for your production domain:
   - URL: `https://yourdomain.com/api/subscriptions/webhook`
   - Events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
3. Copy the **Signing secret** and add to Netlify environment variables

---

## ✅ Verification Checklist

### Before Testing Locally
- [ ] Using TEST Stripe keys (start with `sk_test_`, `pk_test_`)
- [ ] NODE_ENV=development in local .env
- [ ] .env file in .gitignore
- [ ] No live keys in .env.example
- [ ] No live keys in GitHub
- [ ] Can start npm server without warnings

### Before Going to Production
- [ ] Have LIVE Stripe keys from production Stripe account
- [ ] Keys set ONLY in Netlify environment variables
- [ ] NOT in .env file
- [ ] NOT in GitHub
- [ ] Webhook secret configured correctly
- [ ] Webhook events tested with Stripe CLI

---

## 🧪 Testing Stripe Payments

### Test with Stripe Test Mode

Use these test card numbers in Stripe checkout:

**Successful Payment:**
```
Card: 4242 4242 4242 4242
Expiry: 12/25
CVC: 123
Cardholder: Any name
```

**Payment Declined (test):**
```
Card: 4000 0000 0000 0002
Expiry: 12/25
CVC: 123
```

**3D Secure Required (test):**
```
Card: 4000 0025 0000 3155
Expiry: 12/25
CVC: 123
```

### Testing Webhooks Locally

Use **Stripe CLI** to test webhooks:

```bash
# Install Stripe CLI (if not already installed)
# https://stripe.com/docs/stripe-cli

# 1. Authenticate with Stripe
stripe login

# 2. Forward webhook events to your local server
stripe listen --forward-to localhost:3000/api/subscriptions/webhook

# 3. In another terminal, trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded

# 4. Check your server logs for webhook processing
```

---

## 🚨 Safety Checks Built Into Code

The application has built-in warnings to prevent live keys in development:

**File: server.js (lines 31-35)**
```javascript
// Warn if using live Stripe keys in development
if (process.env.NODE_ENV !== 'production' && process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    console.warn('⚠️  WARNING: Using LIVE Stripe keys in development environment!');
    console.warn('   This can result in real charges. Use test keys (sk_test_...) for development.');
}
```

If you see this warning, **STOP** and switch to test keys immediately.

---

## 📚 Reference Links

- [Stripe Test Mode Documentation](https://stripe.com/docs/testing)
- [Stripe API Keys](https://dashboard.stripe.com/apikeys)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)

---

## ❓ FAQs

### Q: I accidentally used live keys in development. Did I charge anyone?
**A:** Check your Stripe dashboard under "Payments" to see if any real transactions were processed. If so, issue refunds immediately.

### Q: How do I know if I'm in test mode on Stripe?
**A:** In the top right corner of Stripe Dashboard, you should see a blue **"Test mode"** toggle. When ON (blue), you're using test keys.

### Q: Can I use the same Stripe account for test and live?
**A:** Yes! One Stripe account has both test and live modes. Toggle between them in the dashboard.

### Q: What if my webhook secret is compromised?
**A:** Rotate it immediately:
1. Go to Stripe → Webhooks
2. Delete the old endpoint
3. Create a new endpoint
4. Update the secret in Netlify environment variables

### Q: Should test keys be committed to GitHub?
**A:** NO! Even though they're test-only, they should never be in version control. Use environment variables instead.

---

## ✅ CURRENT STATUS

**Your Setup:**
- ✅ .env file is in .gitignore (won't be committed)
- ✅ .env.example shows the template
- ✅ Code has warnings for live keys in development
- ✅ Ready for proper key configuration

**What You Need to Do:**
1. [ ] Get TEST keys from Stripe Dashboard
2. [ ] Create .env file with TEST keys
3. [ ] Test locally with test mode
4. [ ] Get LIVE keys when ready for production
5. [ ] Add LIVE keys ONLY to Netlify environment variables

---

**DO NOT SKIP THIS STEP - It's a critical financial security issue.**

