# Supabase Security Issues Guide

This document explains common Supabase security issues and how to fix them.

## Critical Security Issues

### 1. Views with SECURITY DEFINER Property

**What it is:**
When a view is created with `SECURITY DEFINER`, it runs with the privileges of the user who created it, not the user who is querying it. This can lead to privilege escalation attacks.

**Why it's dangerous:**
- Users might access data they shouldn't have permission to see
- Bypasses Row Level Security (RLS) policies
- Can expose sensitive information

**Fix:**
Remove `SECURITY DEFINER` from views and rely on RLS policies instead.

**Affected in your database:**
- `public.failed_login_attempts`
- `public.login_activity`
- `public.recent_errors`

**How to fix:**
Run migration `002_fix_security_advisor_issues.sql`

---

### 2. Functions with Mutable search_path

**What it is:**
When a `SECURITY DEFINER` function doesn't have a fixed `search_path`, attackers can manipulate which schema PostgreSQL searches first, potentially executing malicious code.

**Why it's dangerous:**
- Allows privilege escalation attacks
- Attackers can create malicious objects in schemas that get searched first
- Can lead to SQL injection-like vulnerabilities

**Fix:**
Set `search_path = ''` or `search_path = public` on all `SECURITY DEFINER` functions.

**Example:**
```sql
CREATE OR REPLACE FUNCTION my_function()
RETURNS TRIGGER
SET search_path = ''  -- This prevents the attack
SECURITY DEFINER
AS $$
BEGIN
    -- function code
END;
$$ LANGUAGE plpgsql;
```

**How to fix:**
Run migration `003_fix_search_path_security.sql`

---

### 3. Tables without Row Level Security (RLS)

**What it is:**
RLS is Supabase's primary security mechanism. Without it, tables are accessible based on role permissions alone, which is usually too permissive.

**Why it's dangerous:**
- Data can be accessed/modified without proper authorization
- Users can potentially read/write all data in the table
- Bypasses app-level security

**Fix:**
Enable RLS on all public tables and create appropriate policies.

**Example:**
```sql
-- Enable RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own data"
    ON my_table
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
    ON my_table
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
```

**How to fix:**
Run migration `007_enable_rls_on_user_tables.sql`

---

## Other Common Issues

### 4. Public Access to Auth Schema

**What it is:**
The `auth` schema contains user credentials and should never be accessible to public or authenticated roles.

**Fix:**
```sql
REVOKE ALL ON SCHEMA auth FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM anon, authenticated;
```

---

### 5. Overly Permissive Grants

**What it is:**
Granting `SELECT`, `INSERT`, `UPDATE`, or `DELETE` to the `anon` or `authenticated` role without RLS enabled.

**Fix:**
Either:
1. Enable RLS and create restrictive policies, OR
2. Revoke the grants and use service_role for admin operations

---

### 6. Storage Buckets Without Policies

**What it is:**
Storage buckets that are public or don't have proper access policies.

**Fix:**
```sql
-- Make bucket private
UPDATE storage.buckets SET public = false WHERE name = 'my-bucket';

-- Create policies
CREATE POLICY "Users can upload their own files"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'my-bucket'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
```

---

## How to Use This Guide

### Step 1: Run the Security Audit
```bash
# In Supabase Dashboard > SQL Editor
# Run: database/check_supabase_security.sql
```

### Step 2: Review the Output
The audit will show you:
- All views with SECURITY DEFINER
- All functions with mutable search_path
- All tables without RLS
- All public access grants
- And more...

### Step 3: Apply Fixes
Run the migration files in order:
1. `002_fix_security_advisor_issues.sql` - Fixes views
2. `003_fix_search_path_security.sql` - Fixes functions
3. `007_enable_rls_on_user_tables.sql` - Enables RLS

### Step 4: Verify
Run the audit script again to ensure all issues are resolved.

---

## Quick Fix Checklist

- [ ] Remove SECURITY DEFINER from all views
- [ ] Set search_path on all SECURITY DEFINER functions
- [ ] Enable RLS on all public tables
- [ ] Create appropriate RLS policies
- [ ] Revoke unnecessary grants from anon/authenticated roles
- [ ] Secure storage buckets with policies
- [ ] Review auth schema permissions
- [ ] Test application functionality after changes

---

## Need Help?

If you see an issue in the Supabase Security Advisor that isn't covered here:
1. Copy the exact error message
2. Check the PostgreSQL security documentation
3. Review Supabase best practices: https://supabase.com/docs/guides/auth/row-level-security
