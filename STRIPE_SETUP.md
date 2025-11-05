# Stripe Setup Guide - New Trial Plan

## Create the £1.99 Trial Plan in Stripe

⚠️ **IMPORTANT**: The Trial plan is limited to **2 uses per email address**. After 2 trial subscriptions, users must select a different plan.

### Step 1: Log into Stripe Dashboard
1. Go to https://dashboard.stripe.com
2. Make sure you're in **TEST MODE** first (toggle in top right)

### Step 2: Create the Trial Product

1. Navigate to **Products** in the left sidebar
2. Click **+ Add product**
3. Fill in the details:
   - **Name**: `Trial Plan`
   - **Description**: `Try us out - 10 credits per month, no saved chats (max 2 uses per customer)`
   - **Pricing model**: Choose **Standard pricing**
   - **Price**: `1.99`
   - **Billing period**: `Monthly`
   - **Currency**: `GBP`
4. Click **Add product**

### Step 3: Get the Price ID

After creating the product, you'll see it in your Products list:
1. Click on the **Trial Plan** product
2. In the **Pricing** section, you'll see the price you just created
3. Copy the **Price ID** - it will look like: `price_xxxxxxxxxxxxx`

### Step 4: Add to Environment Variables

Add the price ID to your `.env` file:

```bash
# Trial Plan (£1.99/mo) - Limited to 2 uses per email
STRIPE_PRICE_TRIAL=price_xxxxxxxxxxxxx
```

**Full pricing environment variables should now be:**

```bash
# Stripe Price IDs
STRIPE_PRICE_TRIAL=price_xxxxxxxxxxxxx          # £1.99 - 10 credits, 0 saved chats (max 2 uses per email)
STRIPE_PRICE_STARTER=price_xxxxxxxxxxxxx        # £4.99 - 50 credits, 2 saved chats
STRIPE_PRICE_PROFESSIONAL=price_xxxxxxxxxxxxx   # £14.99 - 200 credits, 5 saved chats
STRIPE_PRICE_WORKSHOP=price_xxxxxxxxxxxxx       # £39.99 - Unlimited credits, 10 saved chats
```

### Step 5: Repeat for Production

Once tested in TEST MODE:
1. Switch to **LIVE MODE** in Stripe (toggle in top right)
2. Repeat Steps 2-4 to create the same product in live mode
3. Update your production environment variables with the LIVE price ID

---

## Existing Plans - Update Descriptions

You may also want to update the descriptions of your existing plans in Stripe to mention saved chats:

### Starter Plan (£4.99/mo)
**New Description**: `Perfect for car owners - 50 credits per month, 2 saved conversations`

### Professional Plan (£14.99/mo)
**New Description**: `For enthusiasts and mechanics - 200 credits per month, 5 saved conversations`

### Workshop Plan (£39.99/mo)
**New Description**: `For professional workshops - Unlimited credits, 10 saved conversations`

---

## Verify Setup

After adding the environment variable:

1. Restart your server:
   ```bash
   npm start
   ```

2. Check the console for the pricing validation - you should see NO warnings about missing price IDs

3. Test the pricing page to ensure the new Basic plan appears

4. Test signup flow with the Basic plan

---

## Current Pricing Structure

| Plan | Price | Credits | Saved Chats | Notes |
|------|-------|---------|-------------|-------|
| **Trial** (NEW) | £1.99/mo | 10 | 0 | Max 2 uses per email |
| Starter | £4.99/mo | 50 | 2 | - |
| Professional | £14.99/mo | 200 | 5 | - |
| Workshop | £39.99/mo | Unlimited | 10 | - |

---

## Troubleshooting

**Issue**: "Missing STRIPE_PRICE_TRIAL" warning on server start

**Solution**: Make sure you've:
1. Created the product in Stripe
2. Copied the correct price ID (starts with `price_`)
3. Added it to `.env` file
4. Restarted the server

**Issue**: Customers can't see the Trial plan on pricing page

**Solution**:
1. Check that the pricing page is reading from the correct configuration
2. Verify the price ID is correct in Stripe
3. Clear browser cache and reload

**Issue**: User gets "Trial plan limit reached" error

**Solution**: This is expected behavior! The trial plan is limited to 2 uses per email address. The user should:
1. Select a different plan (Starter, Professional, or Workshop)
2. Or use a different email address (if legitimate use case)

---

## Next Steps After Adding Price ID

1. ✅ Update `.env` with `STRIPE_PRICE_TRIAL`
2. ✅ Restart server
3. ✅ Apply database migration (009_create_saved_conversations_table.sql)
4. ✅ Test the complete flow:
   - Sign up with Trial plan
   - Check dashboard shows 0 / 0 saved chats
   - Verify Saved Chats button is hidden
   - Try to subscribe to Trial again (after canceling) - should work
   - Try a 3rd time - should be blocked with error message
   - Test upgrading to Starter to enable saved chats
