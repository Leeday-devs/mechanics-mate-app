# Pre-Launch Checklist for Mechanics Mate

## 🚨 CRITICAL ISSUES (MUST FIX BEFORE LAUNCH)

### 1. **LIVE STRIPE KEYS IN DEVELOPMENT** ❌
**Risk Level**: CRITICAL - Financial/Legal liability
- Your `.env` file contains LIVE Stripe keys (`sk_live_...`, `pk_live_...`)
- `NODE_ENV=development` but using production Stripe keys
- **Impact**: Real charges could be processed during testing
- **Action Required**:
  - [ ] Replace with TEST keys: `sk_test_...` and `pk_test_...` for development
  - [ ] Create separate `.env.production` for live keys
  - [ ] Use live keys ONLY in production environment
  - [ ] Test payment flow with Stripe test mode first

### 2. **Duplicate Stripe Price ID** ❌
**Risk Level**: CRITICAL - Business logic error
- Line 25 in `.env`: `STRIPE_PRICE_WORKSHOP` has same value as `STRIPE_PRICE_STARTER`
- Workshop plan (£39.99) will charge Starter price (£4.99)
- **Action Required**:
  - [ ] Fix `STRIPE_PRICE_WORKSHOP` to correct price ID from Stripe Dashboard
  - [ ] Verify all three price IDs are unique and correct

### 3. **Wide-Open CORS** ❌
**Risk Level**: HIGH - Security vulnerability
- `server.js` line 42: `app.use(cors())` with no restrictions
- Any website can make requests to your API
- **Action Required**:
  ```javascript
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
    credentials: true
  }));
  ```

### 4. **No Rate Limiting on Auth Endpoints** ❌
**Risk Level**: HIGH - Brute force attacks possible
- Login/signup endpoints have no rate limiting
- Vulnerable to credential stuffing attacks
- **Action Required**:
  - [ ] Add rate limiter to `/api/auth` routes
  - [ ] Implement exponential backoff for failed logins

---

## ⚠️ HIGH PRIORITY ISSUES

### 5. **Environment Variable Validation Missing**
**Risk Level**: HIGH - Runtime failures
- No startup checks for required env vars
- App will crash if keys are missing
- **Action Required**:
  ```javascript
  // Add to server.js after line 6
  const required Vars = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'STRIPE_SECRET_KEY', 'JWT_SECRET'];
  const missing = requiredVars.filter(v => !process.env[v]);
  if (missing.length) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  ```

### 6. **No Logging/Monitoring**
**Risk Level**: MEDIUM-HIGH - Debugging blind spots
- No error tracking (no Sentry, LogRocket, etc.)
- Can't debug production issues
- **Action Required**:
  - [ ] Add error logging service
  - [ ] Log API errors with context
  - [ ] Monitor Claude API usage and costs

### 7. **Supabase Database Schema Not Included**
**Risk Level**: HIGH - Deployment blocker
- No SQL schema file for database setup
- New deployments will fail
- **Action Required**:
  - [ ] Export Supabase schema to SQL file
  - [ ] Document table structure and relationships
  - [ ] Include RLS (Row Level Security) policies

### 8. **No Health Check Monitoring**
**Risk Level**: MEDIUM - Downtime detection
- `/api/health` endpoint exists but no monitoring
- Won't know if server goes down
- **Action Required**:
  - [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
  - [ ] Add health checks for Anthropic AI, Supabase, Stripe

---

## 📋 MEDIUM PRIORITY ISSUES

### 9. **Missing HTTPS Enforcement**
- No redirect from HTTP to HTTPS
- **Fix**: Add HTTPS middleware or configure at reverse proxy level

### 10. **No Backup Strategy**
- User data in Supabase - need backup plan
- **Fix**: Configure Supabase automated backups

### 11. **API Keys Exposed in Client** (Low Risk but  worth noting)
- Supabase `ANON_KEY` is intentionally public (OK)
- Stripe `PUBLISHABLE_KEY` is intentionally public (OK)
- Just ensure they're the correct keys for each environment

### 12. **Missing Admin Authentication**
- Admin panel has no special auth check
- Anyone with account can access `/admin.html`
- **Fix**: Add admin role check in middleware

### 13. **No Email Verification**
- Users can sign up without email verification
- Risk of fake accounts
- **Fix**: Implement Supabase email confirmation

### 14. **Service Worker Caching Strategy**
- Check that offline functionality works as expected
- Test cache invalidation

### 15. **Missing Security Headers**
- No helmet.js or security headers
- **Fix**: Add helmet middleware:
  ```javascript
  const helmet = require('helmet');
  app.use(helmet());
  ```

---

## ✅ GOOD PRACTICES ALREADY IMPLEMENTED

✓ .env file properly in .gitignore
✓ Rate limiting on chat endpoint
✓ JWT authentication
✓ Input validation on chat messages
✓ Quota checking before AI requests
✓ PWA manifest and service worker
✓ Mobile-responsive design
✓ Error handling in frontend

---

## 🚀 PRE-LAUNCH DEPLOYMENT CHECKLIST

### Environment Setup
- [ ] Create production environment variables
- [ ] Use Stripe TEST keys for staging
- [ ] Use Stripe LIVE keys only in production
- [ ] Set NODE_ENV=production
- [ ] Configure production URL in CORS

### Database
- [ ] Export and backup Supabase schema
- [ ] Create database indexes for performance
- [ ] Set up automated backups
- [ ] Configure RLS policies

### Security
- [ ] Enable HTTPS only
- [ ] Add security headers (helmet.js)
- [ ] Configure CORS properly
- [ ] Add rate limiting to auth routes
- [ ] Implement admin role checks
- [ ] Enable email verification

### Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up cost alerts for Claude API
- [ ] Monitor Stripe webhook delivery

### Testing
- [ ] Test complete signup → payment → usage flow
- [ ] Test quota limits for each tier
- [ ] Test payment failure scenarios
- [ ] Test subscription cancellation
- [ ] Test on multiple devices/browsers
- [ ] Verify offline PWA functionality

### Legal/Compliance
- [ ] Add Privacy Policy page
- [ ] Add Terms of Service page
- [ ] Add Cookie Policy (if applicable)
- [ ] GDPR compliance check (EU users)
- [ ] Display refund policy

### Performance
- [ ] Minify JavaScript/CSS
- [ ] Optimize images
- [ ] Enable gzip compression
- [ ] Set cache headers properly
- [ ] Load test with expected traffic

---

## 💰 COST MONITORING

### Current API Costs
- **Claude 3.5 Sonnet**: $3/MTok input, $15/MTok output
- **Supabase**: Check usage against free tier limits
- **Stripe**: 1.5% + 20p per successful UK card charge

### Recommendations
- [ ] Set daily/monthly spending limits on Claude API
- [ ] Monitor token usage per request
- [ ] Cache common responses if possible
- [ ] Consider response streaming for better UX

---

## 📝 DOCUMENTATION NEEDED

- [ ] API documentation
- [ ] Deployment guide for production
- [ ] Database schema documentation
- [ ] Admin user creation process
- [ ] Emergency procedures (API key rotation, etc.)

---

## ⏰ TIMELINE RECOMMENDATION

**Do NOT launch until**:
1. ✅ Critical issues 1-4 are fixed
2. ✅ High priority issues 5-8 are addressed
3. ✅ Complete testing checklist
4. ✅ Legal pages added (Privacy, Terms)

**Estimated time to production-ready**: 2-3 days of focused work

---

*Generated: 2025-10-18*
*Review this checklist before any production deployment*
