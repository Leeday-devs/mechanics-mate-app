# How to Fix Supabase Security Issues

## Overview

You have **41+ security issues** in your Supabase database. This guide will help you fix them all systematically.

## Files Created

1. **[check_supabase_security.sql](check_supabase_security.sql)** - Comprehensive audit script to identify all security issues
2. **[fix_all_security_issues.sql](fix_all_security_issues.sql)** - Automated fix script for all common issues
3. **[SECURITY_ISSUES_GUIDE.md](SECURITY_ISSUES_GUIDE.md)** - Detailed explanation of each issue type
4. **Migration files** - Individual fixes (already exist in migrations folder)

## Step-by-Step Fix Process

### Step 1: Backup Your Database

**CRITICAL: Always backup before making security changes!**

1. Go to Supabase Dashboard
2. Navigate to Database → Backups
3. Create a manual backup
4. Wait for it to complete

### Step 2: Run Security Audit

1. Go to Supabase Dashboard → **SQL Editor**
2. Create a new query
3. Copy the contents of `check_supabase_security.sql`
4. Click **Run**
5. Review the output to see all security issues

### Step 3: Fix Security Issues (Choose One Method)

#### Option A: Automated Fix (Recommended)

1. In SQL Editor, create a new query
2. Copy the contents of `fix_all_security_issues.sql`
3. Review the script carefully
4. Run the script
5. Review the output
6. If successful, uncomment `COMMIT;` at the bottom and run again
7. If there are errors, uncomment `ROLLBACK;` and run to undo changes

#### Option B: Manual Fix (More Control)

Run each migration file individually:

1. **Fix views** - Run `002_fix_security_advisor_issues.sql`
2. **Fix functions** - Run `003_fix_search_path_security.sql`
3. **Enable RLS** - Run `007_enable_rls_on_user_tables.sql`

### Step 4: Verify Fixes

1. Run `check_supabase_security.sql` again
2. Check that all critical issues are resolved
3. Review the summary at the bottom

### Step 5: Test Your Application

**IMPORTANT:** After applying security fixes, test your application thoroughly!

1. Test user authentication
2. Test data access (CRUD operations)
3. Test any admin functions
4. Check error logs for RLS policy violations

### Step 6: Fix Any Issues

If your app breaks after enabling RLS:

1. Check Supabase logs for RLS policy errors
2. Create appropriate RLS policies for each table
3. Grant necessary permissions

## Common Issues After Fixing

### Issue: "Row level security policy violation"

**Cause:** RLS is now enabled, but your app doesn't have proper policies.

**Fix:**
```sql
-- Example: Allow users to read their own data
CREATE POLICY "Users read own data"
    ON public.my_table
    FOR SELECT
    USING (auth.uid() = user_id);

-- Example: Allow service role full access
CREATE POLICY "Service role full access"
    ON public.my_table
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');
```

### Issue: "Permission denied for table"

**Cause:** Grants were revoked or RLS is blocking access.

**Fix:**
```sql
-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.my_table TO authenticated;

-- Create appropriate RLS policy
CREATE POLICY "Authenticated users access"
    ON public.my_table
    FOR ALL
    USING (auth.role() = 'authenticated');
```

### Issue: Functions not working

**Cause:** `search_path` is now restricted.

**Fix:** Make sure all table references in functions use fully qualified names:
```sql
-- Bad
SELECT * FROM my_table;

-- Good
SELECT * FROM public.my_table;
```

## Understanding the Fixes

### What We Fixed

1. **Removed SECURITY DEFINER from views** (3 views)
   - `failed_login_attempts`
   - `login_activity`
   - `recent_errors`

2. **Set search_path on SECURITY DEFINER functions**
   - Prevents privilege escalation attacks
   - All functions now have `SET search_path = ''`

3. **Enabled RLS on all tables**
   - Ensures data is protected by policies
   - Prevents unauthorized access

4. **Created basic RLS policies**
   - Users can only see their own data
   - Service role has full access for admin operations

### What You Need to Review

1. **RLS Policies** - The automated script creates basic policies. You may need to customize them for your use case.

2. **Grants** - Review which roles have access to which tables.

3. **Storage Policies** - If you use Supabase Storage, create policies for buckets.

4. **Auth Settings** - Check the following in Supabase Dashboard:
   - Authentication → Policies → Enable "Leaked password protection"
   - Authentication → Policies → Enable MFA options

## Security Checklist

After running the fixes, verify:

- [ ] All views removed SECURITY DEFINER property
- [ ] All SECURITY DEFINER functions have search_path set
- [ ] All public tables have RLS enabled
- [ ] Each table has appropriate RLS policies
- [ ] Application still works correctly
- [ ] No unauthorized data access is possible
- [ ] Admin functions still work with service_role
- [ ] Storage buckets have policies (if using storage)
- [ ] Auth leaked password protection enabled
- [ ] MFA options configured

## Getting Help

If you encounter issues:

1. Check the [SECURITY_ISSUES_GUIDE.md](SECURITY_ISSUES_GUIDE.md) for explanations
2. Review Supabase logs for specific error messages
3. Check Supabase documentation: https://supabase.com/docs/guides/auth/row-level-security
4. Run the audit script to identify remaining issues

## Maintenance

Run the security audit script periodically (monthly recommended) to catch new issues.

## Files Reference

- **check_supabase_security.sql** - Identifies all security issues
- **fix_all_security_issues.sql** - Automated comprehensive fix
- **002_fix_security_advisor_issues.sql** - Fixes views with SECURITY DEFINER
- **003_fix_search_path_security.sql** - Fixes function search_path
- **007_enable_rls_on_user_tables.sql** - Enables RLS on tables
- **SECURITY_ISSUES_GUIDE.md** - Detailed explanation of issues

---

**Next Steps:**
1. Backup your database
2. Run the security audit
3. Review the output
4. Run the fix script
5. Test your application
6. Celebrate secure data! 🎉
