# SMTP Setup Guide - Fixing Email Rate Limits

## Problem
Getting "email rate exceeded" error when creating accounts because Supabase has strict email rate limits (4 emails/hour on free tier).

## Solution
Configure SendGrid as your SMTP provider to bypass Supabase's rate limits.

---

## Step-by-Step Setup

### 1. Get SendGrid API Key

1. Go to https://app.sendgrid.com/
2. Sign up for free account (100 emails/day free)
3. Navigate to: **Settings → API Keys**
4. Click **"Create API Key"**
5. Name: `Car Mechanic Production`
6. Permissions: **Full Access** (or Restricted with Mail Send enabled)
7. Click **Create & View**
8. **Copy the API key** (shown only once!)

### 2. Verify Sender Email in SendGrid

Before SendGrid can send emails, you must verify your sender email:

#### Option A: Single Sender Verification (Quick & Easy)
1. In SendGrid, go to: **Settings → Sender Authentication**
2. Click **"Get Started"** under "Single Sender Verification"
3. Fill in the form:
   - From Name: `Car Mechanic`
   - From Email: `noreply@car-mechanic.co.uk` (or use your personal email for testing)
   - Reply To: Your email
   - Company details
4. Click **Create**
5. **Check your email** and click the verification link
6. ✅ You're ready to send!

#### Option B: Domain Authentication (Professional - if you own car-mechanic.co.uk)
1. In SendGrid: **Settings → Sender Authentication → Authenticate Your Domain**
2. Follow DNS configuration steps for your domain
3. This allows sending from any @car-mechanic.co.uk address

### 3. Update .env File

Replace the placeholder in your `.env` file:

```bash
# BEFORE:
SENDGRID_API_KEY=YOUR_SENDGRID_API_KEY_HERE

# AFTER:
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxx.yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

**Also update these if needed:**
```bash
SENDGRID_FROM_EMAIL=noreply@car-mechanic.co.uk  # Must match verified sender
SENDGRID_FROM_NAME=Car Mechanic
```

### 4. Configure Supabase SMTP Settings

This makes Supabase use SendGrid instead of their rate-limited service:

1. Go to **Supabase Dashboard**: https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq
2. Navigate to: **Project Settings → Authentication → SMTP Settings**
3. Click **"Enable Custom SMTP"**
4. Fill in the form:

```
Host: smtp.sendgrid.net
Port Number: 587
Sender email: noreply@car-mechanic.co.uk
Sender name: Car Mechanic
Username: apikey
Password: [Paste your SendGrid API Key here]
```

5. Click **Save**

### 5. Re-enable Email Verification in Auth Routes

Uncomment the email sending code in `src/routes/auth.js`:

**Lines 145-178** - Uncomment the verification email section
**Lines 436-459** - Uncomment the resend verification section

### 6. Test the Setup

#### Local Testing:
```bash
# Start your server
npm start

# Try creating a new account
# Check console for: ✅ SendGrid initialized with API key
# Check console for: ✅ Verification email sent to [email]
```

#### Check SendGrid Activity:
1. Go to SendGrid Dashboard
2. **Activity** tab
3. See your sent emails in real-time

---

## Alternative: Quick Dev Mode (Skip Email Entirely)

If you just want to test without email verification:

1. **Supabase Dashboard** → Authentication → Providers → Email
2. Toggle **OFF** "Confirm email"
3. Users can sign up without email verification
4. ⚠️ **Re-enable before production!**

---

## Rate Limits Comparison

| Provider | Free Tier Limit | Cost |
|----------|----------------|------|
| Supabase (default) | 4 emails/hour | Free |
| SendGrid Free | 100 emails/day | Free |
| SendGrid Essentials | 100,000 emails/month | $19.95/month |

---

## Verification Checklist

- [ ] SendGrid account created
- [ ] API key generated and copied
- [ ] Sender email verified in SendGrid
- [ ] `.env` updated with API key
- [ ] Supabase SMTP settings configured
- [ ] Email verification code uncommented in auth.js
- [ ] Test signup creates account and sends email
- [ ] Email received successfully
- [ ] Verification link works

---

## Troubleshooting

### "403 Forbidden" from SendGrid
→ Your sender email is not verified. Complete Step 2.

### Emails not sending (no error)
→ Check `SENDGRID_API_KEY` is set correctly in `.env`
→ Restart your server after updating `.env`

### "Invalid API key"
→ Make sure you copied the full key from SendGrid
→ API key starts with `SG.`

### Verification link doesn't work
→ Check `APP_URL` and `SITE_URL` in `.env` are correct

### Still hitting rate limits
→ Make sure Supabase SMTP is configured (Step 4)
→ Check Supabase isn't still using their default email service

---

## Production Deployment

Before deploying to production:

1. ✅ Set up custom SMTP in Supabase
2. ✅ Verify domain in SendGrid (not just single sender)
3. ✅ Update Netlify environment variables with `SENDGRID_API_KEY`
4. ✅ Re-enable email verification in auth.js
5. ✅ Test signup flow end-to-end
6. ✅ Monitor SendGrid activity dashboard

---

## Support Resources

- SendGrid Docs: https://docs.sendgrid.com/
- Supabase SMTP Docs: https://supabase.com/docs/guides/auth/auth-smtp
- Your email service code: `src/utils/emailService.js`
