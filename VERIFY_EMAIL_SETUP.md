# Email Setup Verification Guide

**Date:** 2025-11-03
**Status:** Testing SMTP Configuration

---

## ✅ Completed Steps

1. ✅ SendGrid API key configured in Netlify
2. ✅ SendGrid sender verified (`info@car-mechanic.co.uk`)
3. ✅ Supabase Custom SMTP configured

---

## 🧪 Verification Steps

### Step 1: Verify Supabase SMTP Settings

**Manually check in Supabase Dashboard:**

1. Go to: https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/settings/auth

2. Scroll down to **"SMTP Settings"** section

3. Verify these settings are saved:
   - [ ] Custom SMTP is **enabled** (toggle should be ON)
   - [ ] Host: `smtp.sendgrid.net`
   - [ ] Port: `587`
   - [ ] Sender email: `info@car-mechanic.co.uk`
   - [ ] Sender name: `Car Mechanic`
   - [ ] Username: `apikey`
   - [ ] Password: Shows masked value (saved)

4. If any settings are missing or incorrect:
   - Re-enter the values
   - Click "Save"
   - Wait for confirmation message

---

### Step 2: Test Email Delivery

**Option A: Test via Production Site**

1. **Visit your site:**
   - Go to: https://car-mechanic.co.uk

2. **Create a test account:**
   - Use a real email address you can check
   - Complete signup form
   - Submit

3. **Check what happens:**
   - ⚠️ Currently, email verification is disabled in code
   - Account should be created immediately
   - No email will be sent yet (expected)

4. **Verify in Supabase:**
   - Go to: https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/auth/users
   - Check if your test user appears
   - Verify user was created successfully

**Option B: Test Supabase Email Directly**

1. **Trigger a password reset email:**
   - Go to your site's password reset page
   - Enter a registered email
   - Request password reset
   - This should trigger an email through Supabase SMTP

2. **Check your inbox:**
   - Look for email from `info@car-mechanic.co.uk`
   - Check it arrived (may take 1-2 minutes)
   - Verify email branding shows "Car Mechanic"

3. **Check SendGrid Activity:**
   - Go to: https://app.sendgrid.com/activity
   - Look for recent sent email
   - Check delivery status

---

### Step 3: Verify No Rate Limit Errors

**Check Supabase Logs:**

1. Go to: https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/logs/explorer

2. Filter for email-related events

3. Look for:
   - ❌ **Should NOT see:** "rate limit exceeded" errors
   - ✅ **Should see:** Successful email sending events

---

### Step 4: Check SendGrid Activity

1. Go to: https://app.sendgrid.com/activity

2. Check for recent activity:
   - If emails were sent, they should appear here
   - Check delivery status
   - Look for any errors or bounces

---

## 🔧 Troubleshooting

### Issue: SMTP Settings Not Saved in Supabase

**Symptoms:** Settings disappear after clicking Save

**Fix:**
1. Make sure all required fields are filled
2. Check password field has the full SendGrid API key
3. Try refreshing the page and checking again
4. Contact Supabase support if issue persists

---

### Issue: Emails Still Not Sending

**Check these in order:**

1. **Verify SMTP is enabled in Supabase:**
   - Custom SMTP toggle should be ON
   - All fields should show values (password masked)

2. **Check SendGrid sender is verified:**
   - Go to: https://app.sendgrid.com/settings/sender_auth
   - `info@car-mechanic.co.uk` should show "Verified"

3. **Verify SendGrid API key is correct:**
   - In Supabase SMTP settings, password should be full API key
   - Should start with `SG.`
   - Check it matches your SendGrid API key from the Netlify environment variables

4. **Check Supabase logs for errors:**
   - https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/logs/explorer
   - Look for SMTP connection errors

5. **Test SendGrid API key directly:**
   ```bash
   curl --request POST \
     --url https://api.sendgrid.com/v3/mail/send \
     --header 'Authorization: Bearer YOUR_SENDGRID_API_KEY' \
     --header 'Content-Type: application/json' \
     --data '{
       "personalizations": [{"to": [{"email": "your-email@example.com"}]}],
       "from": {"email": "info@car-mechanic.co.uk", "name": "Car Mechanic"},
       "subject": "Test Email",
       "content": [{"type": "text/plain", "value": "This is a test email."}]
     }'
   ```
   Replace `your-email@example.com` with your actual email.

---

### Issue: Rate Limit Still Appearing

**Symptoms:** Still getting "rate limit exceeded" error

**Possible causes:**
1. SMTP not enabled in Supabase (check toggle is ON)
2. Supabase still using default email service
3. Settings not saved properly

**Fix:**
1. Double-check SMTP settings are saved
2. Try disabling and re-enabling Custom SMTP
3. Wait 5 minutes and try again (settings may need to propagate)

---

## ✅ Success Indicators

You'll know everything is working when:

1. **Supabase SMTP:**
   - ✅ Custom SMTP toggle is ON
   - ✅ All fields show saved values
   - ✅ No errors when saving

2. **Email Delivery:**
   - ✅ Test emails are received
   - ✅ Emails come from `info@car-mechanic.co.uk`
   - ✅ No rate limit errors in Supabase logs

3. **SendGrid Activity:**
   - ✅ Sent emails appear in activity feed
   - ✅ Delivery status shows "Delivered"
   - ✅ No bounces or errors

---

## 📊 Expected Results After Configuration

### Before SMTP Configuration:
- ❌ Rate limit: 4 emails per hour
- ❌ "Email rate exceeded" errors
- ❌ Can't create multiple test accounts

### After SMTP Configuration:
- ✅ Rate limit: 100+ emails per day
- ✅ No rate limit errors
- ✅ Unlimited test account creation
- ✅ Reliable email delivery

---

## 🎯 Next Steps After Verification

Once you've confirmed SMTP is working:

### 1. Re-enable Email Verification (Optional)

Currently disabled in `src/routes/auth.js` (lines 145-178)

**To re-enable:**
```bash
# Edit the file
code src/routes/auth.js  # or your preferred editor

# Uncomment lines 145-178
# The email verification code block

# Test locally first
npm start
# Create test account
# Check email is received

# Deploy
git add src/routes/auth.js
git commit -m "Re-enable email verification"
git push origin main
```

### 2. Test Production Email Flow

After re-enabling verification:
1. Create account on https://car-mechanic.co.uk
2. Check email inbox
3. Click verification link
4. Verify account is marked as verified in Supabase

### 3. Monitor Email Metrics

- Daily: Check SendGrid activity
- Weekly: Review delivery rates
- Monthly: Check bounce/spam rates

---

## 🔗 Quick Links

- **Supabase Auth Settings:** https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/settings/auth
- **Supabase Users:** https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/auth/users
- **Supabase Logs:** https://supabase.com/dashboard/project/wxxedmzxwqjolbxmntaq/logs/explorer
- **SendGrid Activity:** https://app.sendgrid.com/activity
- **SendGrid Sender Auth:** https://app.sendgrid.com/settings/sender_auth
- **Your Site:** https://car-mechanic.co.uk

---

**Status:** Ready for testing
**Next:** Verify SMTP settings in Supabase dashboard, then test email delivery
