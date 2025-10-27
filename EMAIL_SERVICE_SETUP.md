# Mechanics Mate - Email Service Setup Guide

**Purpose**: Configure email service for email verification, notifications, and transactional emails
**Last Updated**: October 27, 2025
**Status**: Ready for implementation

---

## Overview

Mechanics Mate requires email functionality for:
1. **Email Verification** - Confirm user signup email
2. **Password Reset** - (Future feature)
3. **Subscription Notifications** - Invoice, renewal reminders
4. **Support Emails** - Contact form responses

This guide covers setup for **SendGrid** (recommended for production) and **Mailgun** (alternative).

---

## Option 1: SendGrid (Recommended)

### Why SendGrid?
- ✅ 100 emails/day free tier
- ✅ Excellent deliverability
- ✅ Simple API integration
- ✅ Good documentation
- ✅ Affordable scaling ($20-100/month)

### Step 1: Create SendGrid Account

1. Go to https://sendgrid.com
2. Click "Sign Up Free"
3. Fill in account details
4. Verify email
5. Complete setup wizard

### Step 2: Create API Key

**In SendGrid Dashboard**:

1. Click your username (top right) → Settings → API Keys
2. Click "Create API Key"
3. Name: `Mechanics Mate Production`
4. Select "Full Access"
5. Click "Create & Copy"
6. **Save the key** (you won't see it again!)

### Step 3: Set Up Sender Identity

**In SendGrid Dashboard**:

1. Settings → Sender Authentication
2. Click "Verify a Single Sender"
3. Fill in:
   - **From Email**: `noreply@mechanics-mate.app`
   - **From Name**: `Mechanics Mate`
   - **Company**: `Mechanics Mate`
   - **Address**: Your company address
4. Click "Create"
5. Check email for verification link
6. Click link in email to verify

### Step 4: Update Application Code

**Install SendGrid package**:

```bash
npm install @sendgrid/mail
```

**Create email utility** (`utils/emailService.js`):

```javascript
const sgMail = require('@sendgrid/mail');

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
    console.warn('⚠️  SENDGRID_API_KEY not configured. Email sending disabled.');
}

/**
 * Send email verification email
 * @param {string} email - User's email address
 * @param {string} verificationLink - Full URL to verification page
 * @returns {Promise<boolean>} Success status
 */
async function sendVerificationEmail(email, verificationLink) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(`Email verification link (development): ${verificationLink}`);
        return false;
    }

    const msg = {
        to: email,
        from: {
            email: 'noreply@mechanics-mate.app',
            name: 'Mechanics Mate'
        },
        subject: 'Verify Your Mechanics Mate Email',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); color: white; padding: 20px; text-align: center; }
                    .button { background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
                    .footer { color: #999; font-size: 12px; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Mechanics Mate</h1>
                    </div>

                    <h2>Verify Your Email</h2>

                    <p>Thank you for signing up for Mechanics Mate! Please verify your email address to complete your account setup.</p>

                    <p>Click the button below to verify your email:</p>

                    <a href="${verificationLink}" class="button">Verify Email</a>

                    <p>Or copy and paste this link in your browser:</p>
                    <p style="word-break: break-all; color: #666; font-size: 12px;">${verificationLink}</p>

                    <p style="color: #666; font-size: 14px;">
                        This link will expire in 24 hours. If you didn't create this account, you can safely ignore this email.
                    </p>

                    <div class="footer">
                        <p>© 2025 Mechanics Mate. All rights reserved.</p>
                        <p>
                            <a href="https://mechanics-mate.app/privacy" style="color: #999;">Privacy Policy</a> |
                            <a href="https://mechanics-mate.app/terms" style="color: #999;">Terms of Service</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `,
        text: `
            Verify Your Email

            Click the link below to verify your email:
            ${verificationLink}

            This link will expire in 24 hours.
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`✅ Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending verification email:', error.message);
        return false;
    }
}

/**
 * Send welcome email
 * @param {string} email - User's email address
 * @param {string} name - User's name
 * @returns {Promise<boolean>} Success status
 */
async function sendWelcomeEmail(email, name) {
    if (!process.env.SENDGRID_API_KEY) {
        console.warn(`Welcome email not sent (SendGrid not configured)`);
        return false;
    }

    const msg = {
        to: email,
        from: {
            email: 'noreply@mechanics-mate.app',
            name: 'Mechanics Mate'
        },
        subject: 'Welcome to Mechanics Mate!',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #d32f2f 0%, #c62828 100%); color: white; padding: 20px; text-align: center; }
                    .button { background-color: #d32f2f; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🚗 Mechanics Mate</h1>
                    </div>

                    <h2>Welcome, ${name || 'Friend'}!</h2>

                    <p>Your Mechanics Mate account is ready to go! Get expert automotive advice powered by AI.</p>

                    <a href="https://mechanics-mate.app/chat" class="button">Start Chatting</a>

                    <p>You can now:</p>
                    <ul>
                        <li>Get instant automotive advice for your vehicle</li>
                        <li>Search real-world forum discussions</li>
                        <li>Track maintenance and repairs</li>
                    </ul>
                </div>
            </body>
            </html>
        `
    };

    try {
        await sgMail.send(msg);
        console.log(`✅ Welcome email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending welcome email:', error.message);
        return false;
    }
}

module.exports = {
    sendVerificationEmail,
    sendWelcomeEmail
};
```

### Step 5: Update Auth Routes

**In `routes/auth.js`**, update the signup endpoint to send email:

```javascript
const emailService = require('../utils/emailService');

// In the signup endpoint, after user creation:
const token = await emailVerification.createVerificationToken(authData.user.id, email);
const baseUrl = req.headers.origin || `${req.protocol}://${req.get('host')}`;
const verificationLink = emailVerification.generateVerificationLink(token, baseUrl);

// Send verification email
emailService.sendVerificationEmail(email, verificationLink)
    .catch(err => console.error('Email send failed:', err));

// Also send welcome email (optional)
emailService.sendWelcomeEmail(email, name)
    .catch(err => console.error('Welcome email failed:', err));
```

### Step 6: Update Environment Variables

**Add to `.env` and `.env.staging`**:

```env
# SendGrid Email Service
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=noreply@mechanics-mate.app
SENDGRID_FROM_NAME=Mechanics Mate
```

### Step 7: Test Email Sending

```bash
# Create test user in local environment
# Check console output for verification link (since SendGrid API key not configured)

# In staging:
# 1. Signup with test email
# 2. Check email inbox for verification email
# 3. Click verification link
# 4. Verify email status in Supabase
```

---

## Option 2: Mailgun (Alternative)

### Why Mailgun?
- ✅ Similar features to SendGrid
- ✅ Free tier (100 emails/month after signup)
- ✅ Excellent documentation
- ✅ Lower cost alternative

### Step 1: Create Mailgun Account

1. Go to https://mailgun.com
2. Sign up for free account
3. Verify email and complete setup

### Step 2: Get API Credentials

1. In Mailgun Dashboard, go to "Sending → Domain"
2. Add new domain (or use Mailgun subdomain)
3. Copy **API Key** and **Domain**
4. Save both values

### Step 3: Install Mailgun Package

```bash
npm install mailgun.js
```

### Step 4: Create Mailgun Email Utility

```javascript
const FormData = require('form-data');
const Mailgun = require('mailgun.js');

const mailgun = new Mailgun(FormData);

const client = process.env.MAILGUN_API_KEY
    ? mailgun.client({username: 'api', key: process.env.MAILGUN_API_KEY})
    : null;

async function sendVerificationEmail(email, verificationLink) {
    if (!client) {
        console.warn(`Verification link (dev): ${verificationLink}`);
        return false;
    }

    try {
        await client.messages.create(process.env.MAILGUN_DOMAIN, {
            from: `Mechanics Mate <noreply@${process.env.MAILGUN_DOMAIN}>`,
            to: email,
            subject: 'Verify Your Mechanics Mate Email',
            html: `<a href="${verificationLink}">Verify Email</a>`,
            text: `Verify your email: ${verificationLink}`
        });
        console.log(`✅ Verification email sent to ${email}`);
        return true;
    } catch (error) {
        console.error('❌ Error sending email:', error);
        return false;
    }
}

module.exports = { sendVerificationEmail };
```

### Step 5: Update Environment

```env
MAILGUN_API_KEY=your_api_key
MAILGUN_DOMAIN=mg.yourdomain.com
```

---

## Email Testing in Development

### Without Email Service (Default)

When `SENDGRID_API_KEY` is not configured:
- Links are logged to console
- Verification links displayed in responses
- Perfect for local development

### With Email Service

**To test with real emails**:

1. Get free SendGrid account
2. Add `SENDGRID_API_KEY` to `.env`
3. Signup with real email address
4. Check inbox for verification email
5. Click link to verify

---

## Email Verification Flow

```
User Signup
    ↓
Send Verification Email
    ↓
User Clicks Link
    ↓
Frontend: /verify-email?token=xxx
    ↓
Backend: POST /api/auth/verify-email
    ↓
Mark Email Verified
    ↓
User Can Access Chat
```

---

## Transactional Emails Template

After email verification is working, add these emails:

### 1. Welcome Email (On Signup)
- Welcome message
- Quick start guide
- Link to documentation

### 2. Email Verification (On Signup)
- Verification link (24 hour expiry)
- Instructions

### 3. Password Reset (Future)
- Reset link
- Password reset instructions

### 4. Subscription Confirmation (On Payment)
- Invoice details
- Plan benefits
- Support contact

### 5. Invoice/Receipt (Monthly)
- Amount charged
- Plan name
- Next billing date
- Download invoice link

### 6. Payment Failed (On Failed Payment)
- Which payment failed
- Amount
- Action required
- Link to update payment method

---

## Production Considerations

### Email Domain Setup

For production, use branded domain:

1. **Register domain** (e.g., noreply@mechanics-mate.app)
2. **Add DNS records** (SendGrid/Mailgun provides these):
   - SPF record
   - DKIM record
   - CNAME record (optional)
3. **Verify in SendGrid/Mailgun** dashboard
4. **Monitor deliverability**

### Email Rate Limits

- SendGrid: 100+ emails/day
- Mailgun: Scalable
- Production: Monitor usage

### Bounce Handling

```javascript
// Implement bounce handling for:
// - Invalid emails
// - Hard bounces (domain doesn't exist)
// - Soft bounces (mailbox full)
// - Complaints (marked as spam)

// Use webhook to update user email status
```

### Compliance

- ✅ Unsubscribe link in emails
- ✅ Privacy policy link
- ✅ Company contact info
- ✅ GDPR compliant (with consent)
- ✅ CAN-SPAM compliant

---

## Troubleshooting

### Emails Not Sending

**Check**:
1. API key correct in `.env`
2. Domain verified in provider dashboard
3. Sender email matches verified domain
4. Check provider logs for errors

```bash
# Check SendGrid logs
# In SendGrid Dashboard: Activity → Delivery Status
```

### Emails Going to Spam

**Solutions**:
1. Add SPF/DKIM records
2. Warm up sending IP
3. Verify domain reputation
4. Check email content (avoid spam words)

### High Bounce Rate

**Check**:
1. Email list quality
2. Invalid email format validation
3. Typos in email addresses

---

## Cost Estimation

| Service | Volume | Cost/Month |
|---------|--------|-----------|
| SendGrid | 1,000/month | Free |
| SendGrid | 10,000/month | $15 |
| SendGrid | 100,000/month | $80 |
| Mailgun | 10,000/month | $20 |

---

## Implementation Timeline

- **Phase 1** (Current): Email service setup guide
- **Phase 2** (Next): Install package and create utility
- **Phase 3**: Update auth routes to send emails
- **Phase 4**: Test in staging environment
- **Phase 5**: Deploy to production

---

## Next Steps

1. ✅ Choose email provider (SendGrid recommended)
2. ✅ Create free account
3. ✅ Get API key
4. ✅ Update application code
5. ✅ Test in staging
6. ✅ Deploy to production

---

## Support

- SendGrid Support: https://support.sendgrid.com
- Mailgun Support: https://mailgun.zendesk.com
- Email issues: devops@mechanics-mate.app

---

**Last Updated**: October 27, 2025
**Status**: Ready for implementation
