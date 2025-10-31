# Mechanics Mate - Deployment Runbook

**Purpose**: Step-by-step guide for deploying Mechanics Mate to production
**Last Updated**: October 27, 2025
**Audience**: DevOps engineers, system administrators

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Setup](#environment-setup)
3. [Database Migration](#database-migration)
4. [Application Deployment](#application-deployment)
5. [Verification Steps](#verification-steps)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code & Version Control

- [ ] All changes committed to main branch
- [ ] Latest code pulled from repository: `git pull origin main`
- [ ] Deployment tag created: `git tag v1.0.0-prod`
- [ ] Code reviewed and approved
- [ ] Unit tests passing locally
- [ ] No uncommitted changes: `git status` shows clean

### Credentials & Secrets

- [ ] `.env.production` file created with all required variables
- [ ] Verified in `.gitignore` (not committed)
- [ ] All API keys are valid and not expired:
  - [ ] `ANTHROPIC_API_KEY` from Anthropic Console
  - [ ] `STRIPE_SECRET_KEY` (production keys, not test)
  - [ ] `STRIPE_WEBHOOK_SECRET` configured in Stripe Dashboard
  - [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `JWT_SECRET` (strong, random 32+ chars)
  - [ ] `SENTRY_DSN` for error tracking
  - [ ] `STRIPE_PRICE_*` IDs match production prices

### Security Review

- [ ] HTTPS enabled in production
- [ ] CORS `ALLOWED_ORIGINS` restricted to production domain
- [ ] Database backups configured
- [ ] Rate limiting configured and tested
- [ ] Input validation enabled on all endpoints
- [ ] CSRF protection active
- [ ] Sensitive information not logged
- [ ] Error messages don't expose internal details

### Infrastructure

- [ ] Production server ready (CPU, RAM, disk space)
- [ ] Database connection tested
- [ ] Redis/cache configured (if applicable)
- [ ] SSL certificates valid and not expiring soon
- [ ] Firewall rules configured
- [ ] Load balancer configured (if applicable)

---

## Environment Setup

### 1. Connect to Production Server

```bash
ssh user@production-server.com
cd /var/www/mechanics-mate

# Or using EC2/Cloud instance
ssh -i deployment-key.pem ec2-user@your-instance-ip
```

### 2. Install Dependencies

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y  # Ubuntu/Debian
# OR
sudo yum update -y  # Amazon Linux/CentOS

# Install Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be v20.x or higher
npm --version   # Should be 10.x or higher
```

### 3. Clone Repository

```bash
# SSH-based clone (requires SSH key configured)
git clone git@github.com:Leeday-devs/mechanics-mate-app.git mechanics-mate
cd mechanics-mate

# OR HTTPS-based clone
git clone https://github.com/Leeday-devs/mechanics-mate-app.git mechanics-mate
cd mechanics-mate
```

### 4. Set Up Environment

```bash
# Create .env.production file
nano .env.production

# Add the following variables:
NODE_ENV=production
PORT=3000
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PROFESSIONAL=price_...
STRIPE_PRICE_WORKSHOP=price_...
JWT_SECRET=<generate_strong_random_string>
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production
SENTRY_SAMPLE_RATE=0.1
ALLOWED_ORIGINS=https://mechanics-mate.app,https://www.mechanics-mate.app
```

### 5. Install Application Dependencies

```bash
npm install --production

# Verify installation
npm list | head -20
```

---

## Database Migration

### 1. Backup Current Database

```bash
# Export Supabase backup
# Go to Supabase Console -> Backups -> Create backup

# Or via Postgres client (if you have direct access)
export PGPASSWORD="your_password"
pg_dump -h db.supabase.co -U postgres -d postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Run Database Migrations

```bash
# Connect to Supabase via psql or SQL editor
# Run migrations in order:

# 1. Application logs table
\i database/migrations/001_create_application_logs_table.sql

# 2. Security advisor fixes
\i database/migrations/002_fix_security_advisor_issues.sql

# 3. Search path security
\i database/migrations/003_fix_search_path_security.sql

# 4. Webhook events (for idempotency)
\i database/migrations/004_create_webhook_events_table.sql

# 5. Token blacklist (for logout)
\i database/migrations/005_create_token_blacklist_table.sql

# 6. Email verification
\i database/migrations/006_email_verification_system.sql
```

### 3. Verify Database State

```bash
# Connect to Supabase and run:
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
ORDER BY table_name;

# Should see: webhook_events, token_blacklist, email_verification_tokens, etc.
```

---

## Application Deployment

### Option A: Using PM2 (Recommended)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application with PM2
pm2 start server.js --name "mechanics-mate" --env production

# Set to restart on server reboot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs mechanics-mate
```

### Option B: Using Docker

```bash
# Build Docker image
docker build -t mechanics-mate:v1.0.0 .

# Run container
docker run -d \
  --name mechanics-mate \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  -v /var/log/mechanics-mate:/app/logs \
  mechanics-mate:v1.0.0

# Check logs
docker logs -f mechanics-mate
```

### Option C: Using Systemd Service

```bash
# Create systemd service file
sudo nano /etc/systemd/system/mechanics-mate.service

# Add:
[Unit]
Description=Mechanics Mate
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/mechanics-mate
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
EnvironmentFile=/var/www/mechanics-mate/.env.production

[Install]
WantedBy=multi-user.target

# Enable and start service
sudo systemctl enable mechanics-mate
sudo systemctl start mechanics-mate
sudo systemctl status mechanics-mate
```

### Option D: Using Nginx as Reverse Proxy

```bash
# Install Nginx
sudo apt-get install nginx

# Create Nginx config
sudo nano /etc/nginx/sites-available/mechanics-mate

# Add:
upstream mechanics_mate {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name mechanics-mate.app www.mechanics-mate.app;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mechanics-mate.app www.mechanics-mate.app;

    ssl_certificate /etc/letsencrypt/live/mechanics-mate.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mechanics-mate.app/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://mechanics_mate;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/mechanics-mate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## Verification Steps

### 1. Health Check

```bash
# Basic connectivity
curl http://localhost:3000 -I

# API health
curl http://localhost:3000/api/auth/csrf-token -I
```

### 2. Log Verification

```bash
# Check application logs
pm2 logs mechanics-mate | head -50

# Look for:
# - "✅ Environment validation passed"
# - "My Mechanic server running on http://localhost:3000"
# - No "ERROR" or "CRITICAL" messages
```

### 3. API Endpoint Tests

```bash
# Test CSRF token endpoint
curl -X GET http://localhost:3000/api/auth/csrf-token

# Should return: {"csrfToken":"..."}

# Test authentication (will fail without valid credentials, which is expected)
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"wrongpass"}'

# Should return: 401 Unauthorized
```

### 4. Database Connectivity

```bash
# Test from application (via logs or direct Supabase test)
# Verify Supabase connection is working by checking:
# - Subscription status queries
# - User lookups
# - Log creation
```

### 5. Stripe Webhook Configuration

```bash
# In Stripe Dashboard:
# - Go to Developers -> Webhooks
# - Add new endpoint: https://mechanics-mate.app/api/subscriptions/webhook
# - Select events: customer.subscription.*, invoice.payment.*
# - Copy webhook secret to STRIPE_WEBHOOK_SECRET in .env.production

# Test webhook (from Stripe Dashboard)
# Click "Send test event" and verify webhook_events table receives it
```

### 6. Email Verification Test

```bash
# Test email verification system
# 1. Go to /verify-email.html?token=test_token
# 2. Should show "Verification Failed" (expected with test token)
# 3. Verify database has email_verification_tokens table

# In production, set up email service (SendGrid, Mailgun, etc.)
```

---

## Rollback Procedures

### If Deployment Fails

#### Option 1: Quick Rollback with PM2

```bash
# Stop current version
pm2 stop mechanics-mate
pm2 delete mechanics-mate

# Checkout previous version
git checkout tags/v0.9.9

# Reinstall dependencies (if needed)
npm install

# Restart with PM2
pm2 start server.js --name "mechanics-mate"
```

#### Option 2: Docker Rollback

```bash
# Stop current container
docker stop mechanics-mate
docker rm mechanics-mate

# Run previous image
docker run -d \
  --name mechanics-mate \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  mechanics-mate:v0.9.9
```

#### Option 3: Database Rollback

```bash
# Restore from backup
export PGPASSWORD="your_password"
psql -h db.supabase.co -U postgres -d postgres < backup_20251027_150000.sql

# Or in Supabase Dashboard:
# Backups -> Find backup -> Restore
```

---

## Monitoring & Alerts

### 1. Set Up Error Monitoring (Sentry)

```bash
# Sentry is configured with SENTRY_DSN in .env.production
# All uncaught errors automatically reported

# Configure alerts in Sentry:
# - Email on first occurrence of error
# - Slack integration for critical errors
# - Issue resolution workflow
```

### 2. Set Up Application Monitoring

```bash
# With PM2 Plus (optional)
pm2 plus

# Monitor with:
# - CPU usage
# - Memory usage
# - Error rates
# - Response times
```

### 3. Set Up Uptime Monitoring

```bash
# Use service like Uptime Robot, Pingdom, or Datadog
# Monitor: https://mechanics-mate.app/api/auth/csrf-token
# Alert if down for more than 2 minutes
# Check every 5 minutes
```

### 4. Set Up Log Aggregation

```bash
# Option A: ELK Stack
# - Logstash collects logs
# - Elasticsearch indexes them
# - Kibana visualizes them

# Option B: Cloud services (CloudWatch, DataDog)
# Configure to collect logs from:
# - /var/log/mechanics-mate/*
# - PM2 logs
# - Sentry error logs
```

---

## Troubleshooting

### Application Won't Start

**Symptoms**: `PM2 or systemd reports process exited immediately`

```bash
# Check logs
pm2 logs mechanics-mate
journalctl -u mechanics-mate -n 50

# Common causes:
# 1. Missing required environment variables
cat .env.production | grep -E "ANTHROPIC|STRIPE|SUPABASE|JWT"

# 2. Port 3000 already in use
lsof -i :3000
kill -9 <PID>

# 3. Database connection failed
# - Verify SUPABASE_URL is correct
# - Verify SUPABASE_SERVICE_ROLE_KEY is valid
# - Check Supabase console for connection errors

# 4. Module not installed
npm install
npm list | grep -E "express|@anthropic|stripe"
```

### High Error Rate

**Symptoms**: Sentry showing >10% error rate

```bash
# Check specific error
tail -n 100 /var/log/mechanics-mate/error.log

# Common causes:
# 1. Database quota exceeded
#    - Check Supabase console for storage usage
#    - Clean up old logs/events

# 2. Stripe configuration wrong
#    - Verify STRIPE_SECRET_KEY format
#    - Check Stripe account for API restrictions

# 3. Rate limiting too aggressive
#    - Adjust limits in server.js if necessary

# 4. Memory leak
#    - Monitor with: pm2 monit mechanics-mate
#    - Check for unclosed database connections
```

### High Latency/Slow Responses

**Symptoms**: API responses taking >2 seconds

```bash
# Check server load
top
free -h
df -h

# Check database performance
# - Login to Supabase
# - Run: EXPLAIN ANALYZE SELECT * FROM subscriptions;
# - Look for missing indexes or slow queries

# Check network
mtr -r -c 100 google.com

# Solutions:
# - Restart application: pm2 restart mechanics-mate
# - Scale horizontally: Add more instances behind load balancer
# - Optimize database queries
# - Enable caching
```

### Webhook Failures

**Symptoms**: Stripe webhooks not processing

```bash
# Check webhook_events table for failures
SELECT * FROM webhook_events
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

# Manually retry failed webhooks
SELECT id, event_id, event_type FROM webhook_events
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '1 hour';

# Common causes:
# 1. STRIPE_WEBHOOK_SECRET wrong
#    - Copy from Stripe Dashboard
#    - Must match exactly

# 2. Webhook URL not publicly accessible
#    - Ensure https://mechanics-mate.app/api/subscriptions/webhook is accessible
#    - Test with: curl https://mechanics-mate.app/api/subscriptions/webhook

# 3. Supabase webhook_events table doesn't exist
#    - Run migration 004_create_webhook_events_table.sql
```

---

## Post-Deployment Checklist

- [ ] Application running stably for 1 hour without errors
- [ ] All endpoints responding with correct status codes
- [ ] Database queries executing in <500ms
- [ ] No sensitive information in logs
- [ ] Sentry configured and receiving errors
- [ ] Email verification working end-to-end
- [ ] Stripe webhooks being processed
- [ ] SSL certificate installed and valid
- [ ] HTTPS redirect working
- [ ] Rate limiting protecting endpoints
- [ ] CORS restricted to production domain
- [ ] Backup of production database created
- [ ] Team notified of successful deployment
- [ ] Deployment documented in issue tracker

---

## Deployment Rollback Summary

| Issue | Time to Detect | Time to Rollback | Recovery Window |
|-------|----------------|------------------|-----------------|
| Complete outage | < 2 min | < 5 min | < 10 min |
| High error rate | < 5 min | < 10 min | < 15 min |
| Database issue | < 10 min | < 15 min | < 30 min |
| Performance issue | < 20 min | < 10 min | < 30 min |

---

## Escalation Path

**For Critical Issues**:

1. **Detection** (< 2 min): Monitoring alerts to on-call
2. **Diagnosis** (< 5 min): Check logs, recent changes
3. **Communication** (< 5 min): Notify stakeholders
4. **Remediation** (< 10 min): Rollback or hot fix
5. **Post-Incident** (< 2 hours): Root cause analysis

**Escalation Contacts**:
- **On-Call Engineer**: [Contact info]
- **Engineering Lead**: [Contact info]
- **DevOps Lead**: [Contact info]
- **CTO**: [Contact info]

---

## Support & Questions

For deployment questions:
- **Slack**: #deployments
- **Email**: devops@mechanics-mate.app
- **Docs**: https://mechanics-mate.app/docs

---

**Last Reviewed**: October 27, 2025
**Last Deployed**: [TBD]
**Next Review**: December 27, 2025
