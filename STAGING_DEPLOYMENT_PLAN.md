# Mechanics Mate - Staging Deployment Plan

**Purpose**: Detailed plan for deploying to staging environment before production
**Date Created**: October 27, 2025
**Target Audience**: DevOps, Engineering Lead, System Administrators

---

## Overview

This document provides a step-by-step plan for deploying Mechanics Mate to a staging environment for final testing before production launch.

**Timeline**: 2-3 hours (including verification)
**Risk Level**: Low (staging environment, not affecting users)
**Rollback Plan**: Yes, documented below

---

## Pre-Deployment Checklist

### Code Readiness
- [ ] All commits pushed to GitHub
- [ ] Latest code on main branch
- [ ] No uncommitted changes locally
- [ ] All tests passing

```bash
# Verify code state
git status  # Should show "nothing to commit, working tree clean"
git log --oneline -5  # Check recent commits
npm test  # Verify tests pass
```

### Credentials & Secrets
- [ ] `.env.staging` file prepared with staging values
- [ ] Staging Stripe TEST keys configured
- [ ] Staging Supabase URL and keys obtained
- [ ] Staging Anthropic API key verified
- [ ] Email service credentials (if applicable)
- [ ] Not committed to git (in .gitignore)

### Infrastructure Ready
- [ ] Staging server provisioned (or cloud instance)
- [ ] Node.js 20+ installed on staging
- [ ] Nginx/reverse proxy configured
- [ ] SSL certificate (self-signed or real) installed
- [ ] Firewall rules configured
- [ ] Database (Supabase) access verified

---

## Step 1: Prepare Staging Environment (30 min)

### 1.1 Connect to Staging Server

```bash
# SSH into staging server
ssh -i staging-key.pem user@staging.mechanics-mate.app

# Or for cloud platforms
ssh -i deployment-key.pem ec2-user@staging-instance-ip
```

### 1.2 Create Application Directory

```bash
# Create application directory
sudo mkdir -p /var/www/mechanics-mate-staging
sudo chown $USER:$USER /var/www/mechanics-mate-staging

# Navigate to directory
cd /var/www/mechanics-mate-staging
```

### 1.3 Install Node.js & Dependencies

```bash
# Check if Node.js is already installed
node --version  # Should be v20+

# If not installed, install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version && npm --version
```

### 1.4 Clone Repository

```bash
# Clone from GitHub
git clone https://github.com/Leeday-devs/mechanics-mate-app.git .

# Verify code is there
ls -la  # Should show index.html, server.js, package.json, etc.
```

---

## Step 2: Configure Environment (15 min)

### 2.1 Create `.env.staging` File

```bash
# Create environment file
nano .env.staging
```

**Copy this template** and fill in your staging values:

```env
# ============================================
# STAGING ENVIRONMENT CONFIGURATION
# ============================================

NODE_ENV=staging
PORT=3000

# ============================================
# ANTHROPIC (Claude AI)
# ============================================
ANTHROPIC_API_KEY=sk-ant-[YOUR_STAGING_KEY]

# ============================================
# SUPABASE (Database & Auth)
# ============================================
SUPABASE_URL=https://[staging-project].supabase.co
SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SUPABASE_SERVICE_ROLE_KEY]

# ============================================
# STRIPE (Payments) - TEST MODE
# ============================================
STRIPE_SECRET_KEY=sk_test_[YOUR_TEST_SECRET_KEY]
STRIPE_PUBLISHABLE_KEY=pk_test_[YOUR_TEST_PUBLISHABLE_KEY]
STRIPE_WEBHOOK_SECRET=whsec_test_[YOUR_TEST_WEBHOOK_SECRET]

# Stripe Price IDs (TEST mode)
STRIPE_PRICE_STARTER=price_[TEST_STARTER]
STRIPE_PRICE_PROFESSIONAL=price_[TEST_PROFESSIONAL]
STRIPE_PRICE_WORKSHOP=price_[TEST_WORKSHOP]

# ============================================
# JWT & CSRF
# ============================================
JWT_SECRET=[GENERATE_STRONG_RANDOM_32_CHARS]
# Generate with: openssl rand -hex 16

# ============================================
# SENTRY (Error Tracking)
# ============================================
SENTRY_DSN=https://[key]@[org].ingest.sentry.io/[project_id]
SENTRY_ENVIRONMENT=staging
SENTRY_SAMPLE_RATE=0.5

# ============================================
# CORS & ORIGINS
# ============================================
ALLOWED_ORIGINS=https://staging.mechanics-mate.app,https://www-staging.mechanics-mate.app,http://localhost:3000

# ============================================
# EMAIL SERVICE (Optional - for testing)
# ============================================
# Configure after this deployment
# SENDGRID_API_KEY=SG.xxx
# EMAIL_FROM=noreply@staging.mechanics-mate.app
```

### 2.2 Verify Environment File

```bash
# Verify file was created
cat .env.staging

# Check that all required keys are present
grep -E "ANTHROPIC_API_KEY|STRIPE_SECRET_KEY|SUPABASE_URL|JWT_SECRET" .env.staging
```

### 2.3 Ensure .gitignore Protects Credentials

```bash
# Verify .env files are in .gitignore
cat .gitignore | grep "\.env"

# Ensure .env.staging is not committed
git status  # Should NOT show .env.staging
```

---

## Step 3: Install & Build (15 min)

### 3.1 Install Dependencies

```bash
# Install npm packages
npm install

# Verify installation
npm list | head -20  # Check packages are installed
```

### 3.2 Run Database Migrations

```bash
# Note: Migrations should be run in Supabase console or with psql
# OR create a migration runner script

# For now, document that migrations need to be applied:
echo "⚠️  Database migrations must be applied to Supabase manually"
echo "See DATABASE_SCHEMA.md for migration SQL files"

# Verify migrations were applied (check Supabase dashboard)
# Tables should exist: webhook_events, token_blacklist, email_verification_tokens
```

---

## Step 4: Start Application (10 min)

### 4.1 Test Direct Server Start

```bash
# Test start with staging config
NODE_ENV=staging node server.js

# Expected output:
# ✅ Environment validation passed
# My Mechanic server running on http://localhost:3000

# Press Ctrl+C to stop
```

### 4.2 Set Up PM2 for Process Management

```bash
# Install PM2 globally if not already
sudo npm install -g pm2

# Start app with PM2 using staging env
pm2 start server.js --name "mechanics-mate-staging" --env staging

# Verify it's running
pm2 status

# Check logs
pm2 logs mechanics-mate-staging

# Set to restart on reboot
pm2 startup
pm2 save
```

### 4.3 Verify Server is Running

```bash
# Check if port 3000 is listening
lsof -i :3000

# Expected: node process running on port 3000
```

---

## Step 5: Configure Reverse Proxy (10 min)

### 5.1 Set Up Nginx

```bash
# Install Nginx if not already installed
sudo apt-get install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/mechanics-mate-staging
```

**Paste this configuration**:

```nginx
upstream mechanics_mate_staging {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name staging.mechanics-mate.app;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name staging.mechanics-mate.app;

    # SSL Certificate (use staging cert)
    ssl_certificate /etc/letsencrypt/live/staging.mechanics-mate.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.mechanics-mate.app/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Reverse proxy to Node app
    location / {
        proxy_pass http://mechanics_mate_staging;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 5.2 Enable Nginx Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/mechanics-mate-staging \
           /etc/nginx/sites-enabled/mechanics-mate-staging

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Expected: "test is successful"

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl status nginx
```

---

## Step 6: Health Checks (15 min)

### 6.1 Check Server Connectivity

```bash
# From local machine or another server:
curl -k https://staging.mechanics-mate.app  # -k for self-signed cert

# Expected: HTML response (landing page)

# Check API endpoint
curl -k https://staging.mechanics-mate.app/api/auth/csrf-token

# Expected: {"csrfToken":"..."}
```

### 6.2 Check Application Logs

```bash
# View PM2 logs
pm2 logs mechanics-mate-staging

# Check for errors
pm2 logs mechanics-mate-staging | grep -i "error"

# Expected: No critical errors, only normal startup messages
```

### 6.3 Verify Database Connection

```bash
# The app logs should show successful database connection
pm2 logs mechanics-mate-staging | grep -i "database\|supabase"

# Or make a request that requires DB:
# This will be tested in Step 8
```

### 6.4 Check Security Headers

```bash
curl -k -I https://staging.mechanics-mate.app | grep -E "Strict-Transport|X-Frame"

# Expected: Security headers present
```

---

## Step 7: Configure Monitoring (10 min)

### 7.1 Set Up Sentry (Already Configured)

```bash
# Sentry errors will start being captured automatically
# View in Sentry dashboard: https://sentry.io

# Verify Sentry is receiving events:
# Make a test request and check Sentry console
```

### 7.2 Set Up Uptime Monitoring

**Using UptimeRobot (Free Tier)**:
1. Go to https://uptimerobot.com
2. Add new monitor: `https://staging.mechanics-mate.app/api/auth/csrf-token`
3. Interval: 5 minutes
4. Alert email: devops@mechanics-mate.app

### 7.3 Monitor Server Resources

```bash
# Watch memory and CPU usage
top -b -n 1 | head -20

# Check disk space
df -h

# Check PM2 resource usage
pm2 monit mechanics-mate-staging
```

---

## Step 8: Run Staging Tests (30 min)

### 8.1 Authentication Tests

```bash
# Test CSRF Token
curl -k https://staging.mechanics-mate.app/api/auth/csrf-token

# Expected: {"csrfToken":"..."}

# Test Signup (should work with valid data)
# Test Login (should work with valid credentials)
# See TESTING_GUIDE.md for full test procedures
```

### 8.2 API Endpoint Tests

```bash
# Test app is accessible
curl -k -I https://staging.mechanics-mate.app

# Test API endpoints work
# See API_DOCUMENTATION.md for all endpoints

# Test with Postman or similar tool
# Import API_DOCUMENTATION.md examples
```

### 8.3 Database Tests

```bash
# The app should be able to query database
# Create a test user and verify in Supabase dashboard
# Check tables for data creation
```

### 8.4 Payment Flow Test (Important!)

**Note: Use Stripe TEST Mode**

1. Open https://staging.mechanics-mate.app
2. Signup with test email
3. Click "Subscribe to Professional"
4. Enter Stripe test card: `4242 4242 4242 4242`
5. Use any future expiry (e.g., 12/25) and CVC (e.g., 123)
6. Complete payment
7. Verify subscription created in Supabase
8. Verify webhook event recorded in `webhook_events` table

---

## Step 9: Verify Email Integration (Next - Separate Task)

```bash
# Email verification will be tested after email service is configured
# See EMAIL_SERVICE_SETUP.md (to be created)
```

---

## Staging Verification Checklist

- [ ] Server running on port 3000
- [ ] Nginx reverse proxy working
- [ ] HTTPS accessible at staging.mechanics-mate.app
- [ ] Security headers present
- [ ] Database connection working
- [ ] API endpoints responding
- [ ] CSRF protection active
- [ ] Rate limiting functional
- [ ] Error logging to Sentry working
- [ ] Uptime monitoring configured
- [ ] Payment flow test passed
- [ ] No critical errors in logs
- [ ] Resource usage normal

---

## Common Issues & Solutions

### Issue: Port 3000 Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env and restart
```

### Issue: NGINX Configuration Error

```bash
# Check syntax
sudo nginx -t

# View error logs
sudo tail -50 /var/log/nginx/error.log

# Common fix: Missing SSL certificate
# Get free certificate with Let's Encrypt:
sudo apt-get install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d staging.mechanics-mate.app
```

### Issue: Database Connection Failed

```bash
# Verify Supabase credentials in .env
grep SUPABASE .env.staging

# Check Supabase dashboard:
# Settings → Database → Connection String
# Verify connection parameters match

# Test connection with psql:
psql -h db.supabase.co -U postgres -d postgres
```

### Issue: Webhook Not Processing

```bash
# Verify webhook_events table exists
# In Supabase SQL editor:
SELECT * FROM webhook_events LIMIT 1;

# Check webhook logs
pm2 logs mechanics-mate-staging | grep webhook

# Verify Stripe webhook secret in .env
grep STRIPE_WEBHOOK_SECRET .env.staging
```

---

## Rollback Procedure

If staging deployment fails critically:

```bash
# Stop the application
pm2 stop mechanics-mate-staging
pm2 delete mechanics-mate-staging

# Or if using systemd
sudo systemctl stop mechanics-mate

# Remove the application
rm -rf /var/www/mechanics-mate-staging

# The system returns to previous state
# No data affected (staging DB unchanged)
```

---

## Next Steps After Staging Verification

1. ✅ Run all tests in TESTING_GUIDE.md
2. ✅ Verify payment flow end-to-end
3. ⏳ **Set up email service (SendGrid/Mailgun)**
4. ⏳ Test email verification workflow
5. ⏳ Production deployment (follow same steps)

---

## Success Criteria

Staging deployment is successful when:

- ✅ Application starts without errors
- ✅ All API endpoints respond
- ✅ Database connectivity confirmed
- ✅ Payment test flow completes
- ✅ Error logging working
- ✅ Security headers present
- ✅ HTTPS accessible
- ✅ PM2/systemd configured for auto-restart
- ✅ Monitoring alerts active

---

## Support & Questions

For deployment questions:
- Check DEPLOYMENT_RUNBOOK.md
- Review logs: `pm2 logs mechanics-mate-staging`
- Contact: devops@mechanics-mate.app

---

**Last Updated**: October 27, 2025
**Next Review**: Before production deployment
**Status**: Ready for execution
