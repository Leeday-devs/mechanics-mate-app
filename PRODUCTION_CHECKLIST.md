# Production Checklist - Mechanics Mate

**Status:** 🟡 IN PROGRESS
**Last Updated:** 2025-10-27
**Target:** Launch-Ready

---

## 🚨 CRITICAL (Must Fix Before Launch)

### 1. Real API Credentials
- [ ] Replace placeholder Anthropic API key with real one
- [ ] Replace placeholder Stripe TEST keys with real TEST keys
- [ ] Replace placeholder Supabase credentials with real ones
- [ ] Generate real JWT_SECRET (min 32 characters)

### 2. Security Hardening
- [ ] Add HTTPS enforcement in `netlify.toml`
- [ ] Add input validation to admin endpoints (`routes/admin.js:107`)
- [ ] Verify CORS configuration (already fixed ✅)
- [ ] Verify error handling (already hardened ✅)

### 3. Configuration
- [ ] Update `.env` with all real credentials
- [ ] Set `NODE_ENV=production` for production deployment
- [ ] Set `ALLOWED_ORIGINS` to production domain

---

## 🟡 HIGH PRIORITY (Security & Stability - 6-8 hours)

### Error Logging
- [ ] Implement Sentry integration for production error tracking
- [ ] Configure error notifications/alerts

### Input Validation & Security
- [ ] Add request validation using express-validator
- [ ] Add CSRF protection using csurf middleware
- [ ] Implement webhook idempotency for Stripe events
- [ ] Add token blacklist for logout invalidation

### Rate Limiting
- [ ] Add rate limiting to auth endpoints (login/signup)

---

## 📋 MEDIUM PRIORITY (Compliance & Best Practices - 4-6 hours)

### Documentation & Schema
- [ ] Export and document Supabase database schema
- [ ] Create API documentation
- [ ] Create deployment runbook

### User Verification
- [ ] Implement email verification for signups
- [ ] Add admin role-based authentication check

### Legal & Compliance
- [ ] Create Privacy Policy page
- [ ] Create Terms of Service page
- [ ] Add GDPR compliance (if applicable for EU users)

### Monitoring & Support
- [ ] Set up uptime monitoring (UptimeRobot/Pingdom)
- [ ] Configure backup strategy for Supabase
- [ ] Create incident response procedures

---

## 🧪 TESTING

### Manual Tests (Required)
- [ ] Complete signup → payment → usage flow
- [ ] Test quota limits for each tier
- [ ] Test payment failure scenarios
- [ ] Test subscription cancellation
- [ ] Test on multiple devices/browsers
- [ ] Verify offline PWA functionality

### Security Tests
- [ ] CORS restrictions working correctly
- [ ] Rate limiting prevents brute force
- [ ] Error messages don't leak sensitive info
- [ ] Input validation prevents injection attacks

### Performance Tests
- [ ] Load test with expected traffic volume
- [ ] Verify response times acceptable
- [ ] Check API cost per request

---

## 📊 DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] All critical items completed
- [ ] All high priority items completed
- [ ] All tests passing
- [ ] Code reviewed and committed
- [ ] Backup of production database created

### Deployment
- [ ] Deploy to staging environment first
- [ ] Verify all functionality on staging
- [ ] Monitor staging for 24 hours
- [ ] Deploy to production
- [ ] Monitor production closely first 24 hours

### Post-Deployment
- [ ] Verify all features working
- [ ] Monitor error logs
- [ ] Check API usage and costs
- [ ] Respond to any user issues
- [ ] Document any issues for future reference

---

## 💰 COST MONITORING

### API Costs
- Claude 3.5 Sonnet: $3/MTok input, $15/MTok output
- Supabase: Monitor usage against free tier
- Stripe: 1.5% + 20p per transaction

### Recommendations
- [ ] Set daily/monthly spending limits on Claude API
- [ ] Monitor token usage per request
- [ ] Set up cost alerts

---

## 📁 Documentation Status

### Essential Docs (Keep)
- ✅ README.md - Overview & getting started
- ✅ DEPLOYMENT.md - Deployment instructions
- ✅ DATABASE_SCHEMA.md - Database structure
- ✅ SECURITY.md - Security guidelines
- ✅ CHANGELOG.md - Version history
- ✅ PRODUCTION_AUDIT_REPORT.md - Audit findings
- ✅ HIGH_PRIORITY_FIXES_IMPLEMENTATION.md - Implementation guides
- ✅ COMPREHENSIVE_TESTING_GUIDE.md - Test procedures
- ✅ PRODUCTION_CHECKLIST.md - This file

### Cleaned Up (Removed)
- 🗑️ PRE_LAUNCH_CHECKLIST.md (consolidated here)
- 🗑️ PRE_PRODUCTION_CHECKLIST.md (consolidated here)
- 🗑️ LAUNCH_READY_SUMMARY.md (consolidated here)
- 🗑️ DASHBOARD-LOGIN-FIX.md (completed)
- 🗑️ CRITICAL_STRIPE_KEYS_FIX.md (completed)
- 🗑️ SECURITY_ADVISOR_FIXES.md (completed)
- 🗑️ LOGGING_SYSTEM_IMPLEMENTATION.md (completed)
- 🗑️ DATABASE_LOGGING_SETUP.md (completed)

---

## 🎯 Timeline Estimate

- **Critical Items:** 30 minutes
- **High Priority Items:** 6-8 hours
- **Medium Priority Items:** 4-6 hours
- **Testing:** 4-6 hours
- **Total:** 15-20 hours of focused work

---

## ✅ Sign-Off

When all items are complete:
- [ ] All boxes checked
- [ ] All tests passing
- [ ] Ready for production

**Approved For Launch:** ___________ (Date)

---

*Keep this checklist up to date as you progress through production preparation.*
