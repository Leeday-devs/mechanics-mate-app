# Row Level Security (RLS) Implementation Checklist

**Purpose:** Verify RLS is properly configured on all sensitive tables

**Status:** ⚠️ PARTIAL - Some tables missing RLS

---

## Tables in Your Database

Based on your schema, here are the tables that MUST have RLS enabled:

### 📋 Table Status

| Table Name | Type | RLS Status | Priority | Action |
|---|---|---|---|---|
| `application_logs` | System | ✅ ENABLED | - | None - Already configured |
| `subscriptions` | User | ❓ UNKNOWN | CRITICAL | Check & Configure |
| `message_usage` | User | ❓ UNKNOWN | CRITICAL | Check & Configure |
| `message_history` | User | ❓ UNKNOWN | CRITICAL | Check & Configure |
| `admin_users` | System | ❓ UNKNOWN | HIGH | Check & Configure |
| `auth.users` | System | ✅ MANAGED | - | Supabase managed (OK) |

---

## How to Check Current RLS Status

**Via Supabase Dashboard:**
1. Go to SQL Editor
2. Run this query:

```sql
SELECT
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

**Output Legend:**
- `rowsecurity = true` = ✅ RLS is ENABLED
- `rowsecurity = false` = ❌ RLS is DISABLED

**Via Supabase Dashboard UI:**
1. Go to Settings > Database
2. Click each table
3. Check if "Row Level Security" toggle is ON

---

## Complete RLS Implementation

### ✅ Table 1: application_logs
**Status:** Already configured (see: `database/migrations/001_create_application_logs_table.sql`)

**Current Policies:**
```sql
-- ✅ Admin view all
CREATE POLICY admin_view_all_logs ON application_logs
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));

-- ✅ Users view their own
CREATE POLICY user_view_own_logs ON application_logs
    FOR SELECT
    USING (user_id = auth.uid());

-- ✅ Service role insert
CREATE POLICY insert_logs ON application_logs
    FOR INSERT
    WITH CHECK (true);
```

**Status:** ✅ COMPLIANT

---

### ❌ Table 2: subscriptions
**Status:** NEEDS RLS - This is critical for user privacy

**Run This SQL:**

```sql
-- Enable RLS on subscriptions
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own subscription
CREATE POLICY user_view_own_subscription ON subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Users can only update their own subscription
CREATE POLICY user_update_own_subscription ON subscriptions
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy 3: Service role can do anything (for webhooks)
CREATE POLICY service_role_all_subscriptions ON subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy 4: Admins can view all subscriptions
CREATE POLICY admin_view_all_subscriptions ON subscriptions
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));
```

**Test After Implementation:**
```sql
-- Test as authenticated user (should see only their subscription)
SELECT * FROM subscriptions WHERE user_id = auth.uid();

-- Test as anon (should see nothing - get permission denied)
-- Temporarily revoke auth and try again
```

---

### ❌ Table 3: message_usage
**Status:** NEEDS RLS - Users should only see their own usage

**Run This SQL:**

```sql
-- Enable RLS on message_usage
ALTER TABLE message_usage ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own usage
CREATE POLICY user_view_own_usage ON message_usage
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Service role can insert/update (for tracking)
CREATE POLICY service_role_manage_usage ON message_usage
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy 3: Admins can view all usage
CREATE POLICY admin_view_all_usage ON message_usage
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));
```

**What This Does:**
- Regular users: Can only see `SELECT` their own message usage
- Service role: Can do anything (admin operations)
- Admins: Can view everyone's usage

---

### ❌ Table 4: message_history
**Status:** NEEDS RLS - Very sensitive - should be per-user

**Run This SQL:**

```sql
-- Enable RLS on message_history
ALTER TABLE message_history ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own message history
CREATE POLICY user_view_own_messages ON message_history
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Users can only insert their own messages
CREATE POLICY user_insert_own_messages ON message_history
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy 3: Users can only update/delete their own messages
CREATE POLICY user_update_own_messages ON message_history
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY user_delete_own_messages ON message_history
    FOR DELETE
    USING (user_id = auth.uid());

-- Policy 4: Service role can do anything
CREATE POLICY service_role_manage_messages ON message_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy 5: Admins can view all (for support)
CREATE POLICY admin_view_all_messages ON message_history
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));
```

**Why This Matters:**
- Chat history is private user data
- GDPR/Privacy regulations require isolation
- Users must not see other users' conversations

---

### ❓ Table 5: admin_users
**Status:** NEEDS CHECK - Verify if RLS is needed

**Run This SQL:**

```sql
-- Check if admin_users table exists and its structure
SELECT * FROM information_schema.tables WHERE table_name = 'admin_users';

-- If it exists, enable RLS:
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can view admin list (security)
CREATE POLICY admin_view_admins ON admin_users
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users au
        WHERE au.user_id = auth.uid()
    ));

-- Policy: Only service role can insert/update admins
CREATE POLICY service_role_manage_admins ON admin_users
    FOR ALL
    USING (auth.role() = 'service_role');
```

---

## Implementation Order

**Do these IN SEQUENCE in your Supabase SQL Editor:**

### Step 1: Verify Current Status
```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Step 2: Enable RLS (One at a time)
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
```

### Step 3: Create Policies (Use section above for each table)
Copy and paste the SQL from each table section above

### Step 4: Test Each Policy
```sql
-- Example test:
-- 1. Get a real user ID from your auth.users
SELECT id FROM auth.users LIMIT 1;

-- 2. Test with that user ID
SET jwt.claims.sub = 'user-id-here';
SELECT * FROM subscriptions;
RESET jwt.claims.sub;
```

### Step 5: Document in Migration
Create a new migration file:
```bash
# In database/migrations/
touch 007_enable_rls_on_user_tables.sql
```

Add all RLS SQL to that file for future reference

---

## Testing Procedures

### Test 1: User Can Only See Own Data

**Scenario:** User A logs in and queries their subscription

```javascript
// In your app
const { data, error } = await supabase
    .from('subscriptions')
    .select('*');

// Should ONLY return User A's subscription, or nothing if they have none
// NOT other users' subscriptions
```

### Test 2: Anon Users See Nothing

**Scenario:** Anonymous user tries to query subscriptions

```javascript
// Before login
const { data, error } = await supabase
    .from('subscriptions')
    .select('*');

// Should get permission denied error
// NOT see any data
```

### Test 3: Service Role Can Do Anything

**Scenario:** Backend service updates subscription via webhook

```javascript
// On backend with service role (NOT on client)
const { data, error } = await supabaseAdmin
    .from('subscriptions')
    .update({ status: 'active' })
    .eq('user_id', 'any-user-id'); // Service role bypasses RLS

// Should work without permission denied error
```

### Test 4: Admins Can View All

**Scenario:** Admin user views customer subscriptions

```javascript
// Admin is authenticated and in admin_users table
const { data, error } = await supabase
    .from('subscriptions')
    .select('*');

// Should return ALL subscriptions (not just their own)
// Because of admin_view_all_subscriptions policy
```

---

## Common Mistakes to Avoid

❌ **WRONG:**
```sql
-- This allows anonymous users to see everything
CREATE POLICY allow_all ON subscriptions
    FOR SELECT
    USING (true);
```

❌ **WRONG:**
```sql
-- This only works with hardcoded user IDs
CREATE POLICY view_subscription ON subscriptions
    FOR SELECT
    USING (user_id = 'fixed-user-id');
```

❌ **WRONG:**
```sql
-- Forgetting to handle service role operations
-- Backend operations will fail with permission denied
```

✅ **CORRECT:**
```sql
-- Requires authentication AND user ID must match
CREATE POLICY user_view_own ON subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

-- AND separate policy for service role
CREATE POLICY service_role_all ON subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');
```

---

## Verification Checklist

After implementing RLS on all tables:

- [ ] All tables show `rowsecurity = true` in `pg_tables`
- [ ] Each table has at least one SELECT policy for normal users
- [ ] Service role has unrestricted policies
- [ ] Admins have view-all policies
- [ ] Tested user can only see own data
- [ ] Tested anon user gets permission denied
- [ ] Tested service role can bypass RLS
- [ ] Tested admin can see all data
- [ ] No policies use hardcoded user IDs
- [ ] All policies use `auth.uid()` for user matching
- [ ] Updated DATABASE_SCHEMA.md with RLS details
- [ ] Created migration file for RLS setup

---

## References

**In Your Codebase:**
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Current schema
- [database/migrations/](database/migrations/) - Migration files

**Supabase Documentation:**
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Security Advisor](https://supabase.com/docs/guides/database/database-advisors)

**Testing Tools:**
- [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/_/sql)
- [User Impersonation Feature](https://supabase.com/docs/guides/database/postgres/user-impersonation)

---

## Timeline

**Immediate (Today):**
- [ ] Run verification query to check current RLS status
- [ ] Create this migration file in database/migrations/

**This Week:**
- [ ] Enable RLS on all 4 tables
- [ ] Create all policies
- [ ] Test each policy thoroughly

**Before Production:**
- [ ] Complete verification checklist
- [ ] Document all policies
- [ ] Train team on RLS concepts
- [ ] Set up monitoring for RLS violations

---

**Last Updated:** 2025-10-28
**Next Review:** After RLS implementation
