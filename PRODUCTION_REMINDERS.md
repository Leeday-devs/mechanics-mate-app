# Production Reminders - Features to Re-enable

This file tracks features that have been temporarily disabled during development and **MUST** be re-enabled before production deployment.

---

## 🚨 CRITICAL - Email Functionality

**Status:** DISABLED (Temporarily)
**Date Disabled:** 2025-11-02
**Reason:** Supabase email rate limit reached during development
**Impact:** Users will not receive verification or welcome emails

### What Was Disabled:

1. **Email Verification Emails**
   - Location: [src/routes/auth.js:100-181](Desktop/Git Hub Projects/mechanics-mate-app/src/routes/auth.js#L100-L181)
   - Function: Signup endpoint email sending
   - Action Required: Uncomment email sending code

2. **Welcome Emails**
   - Location: [src/routes/auth.js:167-176](Desktop/Git Hub Projects/mechanics-mate-app/src/routes/auth.js#L167-L176)
   - Function: Welcome email after signup
   - Action Required: Uncomment welcome email sending

3. **Resend Verification Endpoint**
   - Location: [src/routes/auth.js:415-453](Desktop/Git Hub Projects/mechanics-mate-app/src/routes/auth.js#L415-L453)
   - Function: Resend verification email
   - Action Required: Uncomment email sending code

### Before Production Deployment:

- [ ] Verify Supabase email quota is sufficient for production load
- [ ] Test SendGrid integration with production domain
- [ ] Verify SENDGRID_API_KEY is set in production environment
- [ ] Verify SENDGRID_FROM_EMAIL is configured with production domain
- [ ] Test email deliverability (check spam folders)
- [ ] Re-enable all email sending code (see locations above)
- [ ] Test complete signup flow with email verification
- [ ] Test resend verification flow
- [ ] Monitor email sending rate limits
- [ ] Consider upgrading Supabase plan if needed for email volume

### Configuration to Verify:

```bash
# Production environment variables that MUST be set:
SENDGRID_API_KEY=<your-production-key>
SENDGRID_FROM_EMAIL=noreply@mechanics-mate.app
SENDGRID_FROM_NAME=Mechanics Mate
SUPABASE_URL=<your-supabase-url>
SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
APP_URL=<your-production-url>
SITE_URL=<your-production-url>
```

### Related Files:
- [src/utils/emailService.js](Desktop/Git Hub Projects/mechanics-mate-app/src/utils/emailService.js) - Email sending functions
- [src/utils/emailVerification.js](Desktop/Git Hub Projects/mechanics-mate-app/src/utils/emailVerification.js) - Token management
- [src/routes/auth.js](Desktop/Git Hub Projects/mechanics-mate-app/src/routes/auth.js) - Auth endpoints

---

## Template for Future Temporary Disables

When disabling features temporarily, add entries using this template:

### [Feature Name]

**Status:** DISABLED
**Date Disabled:** YYYY-MM-DD
**Reason:** [Why it was disabled]
**Impact:** [What functionality is affected]

#### What Was Disabled:
- [Specific file/function/endpoint]
- [Location and line numbers]

#### Before Production:
- [ ] [Action item 1]
- [ ] [Action item 2]

---

**Last Updated:** 2025-11-02
**Next Review Date:** Before production deployment
