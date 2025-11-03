# Domain Update Summary - car-mechanic.co.uk

## Overview
Successfully updated the domain from `mechanics-mate.app` to `car-mechanic.co.uk` across the entire application.

## Files Updated

### 1. Environment Configuration
- **[.env](.env)**
  - `SENDGRID_FROM_EMAIL`: `noreply@car-mechanic.co.uk`
  - `SENDGRID_FROM_NAME`: `Car Mechanic`
  - `SITE_URL`: `https://car-mechanic.co.uk`
  - `ALLOWED_ORIGINS`: Added `https://car-mechanic.co.uk`

### 2. Build Configuration
- **[netlify.toml](netlify.toml)**
  - `SITE_URL`: `https://car-mechanic.co.uk`
  - `APP_URL`: `https://car-mechanic.co.uk`

### 3. Email Service
- **[src/utils/emailService.js](src/utils/emailService.js)**
  - All email templates updated with new branding
  - Brand name: "Car Mechanic" (was "Mechanics Mate")
  - Domain: `car-mechanic.co.uk`
  - Contact email: `contact@car-mechanic.co.uk`
  - Updated footer links (privacy, terms, support)
  - Synced to netlify functions: `netlify/functions/utils/emailService.js`

### 4. Documentation
- **[SMTP_SETUP_GUIDE.md](SMTP_SETUP_GUIDE.md)**
  - Updated all references to new domain
  - SendGrid sender email: `noreply@car-mechanic.co.uk`
  - Sender name: `Car Mechanic`

## Email Template Changes

All three email templates updated:
1. **Verification Email** - "Verify Your Car Mechanic Email"
2. **Welcome Email** - "Welcome to Car Mechanic!"
3. **Password Reset Email** - "Reset Your Car Mechanic Password"

Each template now includes:
- Header: 🚗 Car Mechanic
- Footer: © 2025 Car Mechanic. All rights reserved.
- Links: https://car-mechanic.co.uk/*
- Contact: contact@car-mechanic.co.uk

## Next Steps for Production

### 1. Domain Configuration
- [ ] Point `car-mechanic.co.uk` to your hosting (Netlify)
- [ ] Configure DNS records
- [ ] Set up SSL certificate (auto via Netlify)

### 2. SendGrid Setup
- [ ] Get SendGrid API key
- [ ] Verify sender email: `noreply@car-mechanic.co.uk`
- [ ] OR set up domain authentication for `car-mechanic.co.uk`
- [ ] Update `.env` with real API key (replace `YOUR_SENDGRID_API_KEY_HERE`)

### 3. Supabase Configuration
- [ ] Configure custom SMTP in Supabase with SendGrid credentials
- [ ] OR disable "Confirm email" for development/testing

### 4. Netlify Environment Variables
Update Netlify with production environment variables:
```bash
SITE_URL=https://car-mechanic.co.uk
APP_URL=https://car-mechanic.co.uk
SENDGRID_API_KEY=SG.xxxxx...
SENDGRID_FROM_EMAIL=noreply@car-mechanic.co.uk
SENDGRID_FROM_NAME=Car Mechanic
ALLOWED_ORIGINS=https://car-mechanic.co.uk
```

### 5. Email Verification
- [ ] Re-enable email verification code in `src/routes/auth.js` (lines 145-178)
- [ ] Re-enable resend verification in `src/routes/auth.js` (lines 436-459)

## Testing Checklist

### Local Testing
- [ ] Start server: `npm start`
- [ ] Check console for SendGrid initialization
- [ ] Test signup flow
- [ ] Verify email template content

### Production Testing
- [ ] Deploy to Netlify
- [ ] Test domain access: https://car-mechanic.co.uk
- [ ] Create test account
- [ ] Verify email received with correct branding
- [ ] Check email links point to car-mechanic.co.uk

## Rate Limit Fix Status

### Current Issue
- Supabase email rate limit: 4 emails/hour (causing signup failures)

### Solution Implemented
- Custom SMTP configuration ready
- SendGrid integration code complete
- Environment variables configured

### To Activate
1. Add SendGrid API key to `.env`
2. Configure Supabase SMTP settings (see [SMTP_SETUP_GUIDE.md](SMTP_SETUP_GUIDE.md))
3. New rate limits: 100 emails/day (free) or 100k/month (paid)

## Support

For SMTP setup help, see: [SMTP_SETUP_GUIDE.md](SMTP_SETUP_GUIDE.md)

---
**Updated:** 2025-11-03
**Domain:** car-mechanic.co.uk
**Status:** ✅ Code updated, awaiting production deployment
