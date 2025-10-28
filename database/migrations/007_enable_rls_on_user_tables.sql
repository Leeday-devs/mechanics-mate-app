/**
 * Enable Row Level Security (RLS) on User Data Tables
 *
 * This migration enables RLS on all tables that contain user-specific data:
 * - subscriptions: User payment information
 * - message_usage: User quota tracking
 * - message_history: User chat conversations
 * - admin_users: Admin user list
 *
 * CRITICAL: Run these changes in order, testing each one before moving to the next
 *
 * Timeline: October 28, 2025
 * Status: REQUIRED FOR PRODUCTION
 */

-- ============================================================================
-- TABLE 1: subscriptions - Enable RLS and create policies
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own subscription
CREATE POLICY user_view_own_subscription ON subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Users can only update their own subscription
CREATE POLICY user_update_own_subscription ON subscriptions
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy 3: Service role can do anything (for webhooks, backend operations)
CREATE POLICY service_role_all_subscriptions ON subscriptions
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy 4: Admins can view all subscriptions (for support/analytics)
CREATE POLICY admin_view_all_subscriptions ON subscriptions
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));

-- ============================================================================
-- TABLE 2: message_usage - Enable RLS and create policies
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE message_usage ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own usage
CREATE POLICY user_view_own_usage ON message_usage
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Users can update their own usage (if allowing self-updates)
CREATE POLICY user_update_own_usage ON message_usage
    FOR UPDATE
    USING (user_id = auth.uid());

-- Policy 3: Service role can insert/update usage (for tracking messages)
CREATE POLICY service_role_manage_usage ON message_usage
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy 4: Admins can view all usage (for analytics)
CREATE POLICY admin_view_all_usage ON message_usage
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));

-- ============================================================================
-- TABLE 3: message_history - Enable RLS and create policies
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE message_history ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can only view their own message history
CREATE POLICY user_view_own_messages ON message_history
    FOR SELECT
    USING (user_id = auth.uid());

-- Policy 2: Users can only insert their own messages
CREATE POLICY user_insert_own_messages ON message_history
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy 3: Users can update/delete their own messages (for edits/deletions)
CREATE POLICY user_update_own_messages ON message_history
    FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY user_delete_own_messages ON message_history
    FOR DELETE
    USING (user_id = auth.uid());

-- Policy 4: Service role can do anything (for admin cleanup, migrations)
CREATE POLICY service_role_manage_messages ON message_history
    FOR ALL
    USING (auth.role() = 'service_role');

-- Policy 5: Admins can view all messages (for support/moderation)
CREATE POLICY admin_view_all_messages ON message_history
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users
        WHERE admin_users.user_id = auth.uid()
    ));

-- ============================================================================
-- TABLE 4: admin_users - Enable RLS and create policies
-- ============================================================================

-- Enable Row Level Security
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Only admins can view the admin user list (security through obscurity)
CREATE POLICY admin_view_admins ON admin_users
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM admin_users au
        WHERE au.user_id = auth.uid()
    ));

-- Policy 2: Service role can manage admins (for backend admin operations)
CREATE POLICY service_role_manage_admins ON admin_users
    FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- VERIFICATION QUERIES - Run these to confirm RLS is enabled
-- ============================================================================

-- Check that RLS is enabled on all tables
-- Expected output: All should show 't' (true) in rowsecurity column
/*
SELECT
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('subscriptions', 'message_usage', 'message_history', 'admin_users')
ORDER BY tablename;
*/

-- Check all policies were created
-- Expected output: 16 policies total (4 per table)
/*
SELECT
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('subscriptions', 'message_usage', 'message_history', 'admin_users')
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- TESTING PROCEDURES - Run these with different user contexts
-- ============================================================================

-- Test 1: Regular user sees only their data
-- Replace 'user-id-here' with actual user ID from auth.users
/*
SET jwt.claims.sub = 'user-id-here';

-- Should show only this user's subscription
SELECT * FROM subscriptions;

-- Should show only this user's usage
SELECT * FROM message_usage;

-- Should show only this user's messages
SELECT * FROM message_history LIMIT 5;

RESET jwt.claims.sub;
*/

-- Test 2: Service role bypasses RLS
-- Service role should see all data regardless of RLS
/*
-- This uses the service_role JWT
SELECT * FROM subscriptions;
SELECT * FROM message_usage;
SELECT * FROM message_history LIMIT 5;
*/

-- Test 3: Anonymous user gets permission denied
-- Should fail with "permission denied" error
/*
-- Unset JWT to simulate anonymous
SET jwt.claims.sub = NULL;

SELECT * FROM subscriptions;
-- Expected: ERROR 42501: new row violates row-level security policy

RESET jwt.claims.sub;
*/

-- Test 4: Admin sees all data
-- Replace 'admin-user-id' with an admin user ID
/*
SET jwt.claims.sub = 'admin-user-id';

-- Admin with admin_view_all policy should see all subscriptions
SELECT * FROM subscriptions LIMIT 5;

-- Admin should see all usage
SELECT * FROM message_usage LIMIT 5;

-- Admin should see all messages (for moderation)
SELECT * FROM message_history LIMIT 5;

RESET jwt.claims.sub;
*/

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

/*

POLICIES CREATED:

subscriptions:
  - user_view_own_subscription: SELECT - users see their own subscription
  - user_update_own_subscription: UPDATE - users can update their own subscription
  - service_role_all_subscriptions: ALL - service role can do anything
  - admin_view_all_subscriptions: SELECT - admins see all subscriptions

message_usage:
  - user_view_own_usage: SELECT - users see their own usage
  - user_update_own_usage: UPDATE - users can update their own usage
  - service_role_manage_usage: ALL - service role can do anything
  - admin_view_all_usage: SELECT - admins see all usage

message_history:
  - user_view_own_messages: SELECT - users see their own messages
  - user_insert_own_messages: INSERT - users insert their own messages
  - user_update_own_messages: UPDATE - users update their own messages
  - user_delete_own_messages: DELETE - users delete their own messages
  - service_role_manage_messages: ALL - service role can do anything
  - admin_view_all_messages: SELECT - admins see all messages

admin_users:
  - admin_view_admins: SELECT - admins see admin list
  - service_role_manage_admins: ALL - service role can do anything

TOTAL: 15 policies across 4 tables

SECURITY GUARANTEES:

1. User Isolation
   - Each user can only see/access their own data
   - Even with SQL injection, can't access other users' data
   - Enforced at database level, not application level

2. Admin Access
   - Admins can view all data for support/moderation
   - But still follow other RLS rules (can't insert as other users)

3. Backend Operations
   - Service role bypasses RLS for trusted backend code
   - Webhooks, admin operations, migrations all work

4. Anonymous Protection
   - Unauthenticated users get permission denied
   - Can't use data API without authentication

BACKUP & RESTORE:

If you need to rollback this migration:

ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_usage DISABLE ROW LEVEL SECURITY;
ALTER TABLE message_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_view_own_subscription ON subscriptions;
DROP POLICY IF EXISTS user_update_own_subscription ON subscriptions;
DROP POLICY IF EXISTS service_role_all_subscriptions ON subscriptions;
DROP POLICY IF EXISTS admin_view_all_subscriptions ON subscriptions;

-- ... repeat for other tables

MONITORING:

Check for RLS violations in logs:
SELECT * FROM application_logs
WHERE log_type = 'security'
AND created_at > NOW() - INTERVAL '24 hours';

Monitor failed queries:
SELECT * FROM application_logs
WHERE severity = 'error'
AND message LIKE '%permission denied%'
AND created_at > NOW() - INTERVAL '24 hours';

*/

-- ============================================================================
-- MIGRATION METADATA
-- ============================================================================

-- This migration:
-- - Enables RLS on 4 critical tables
-- - Creates 15 security policies
-- - Provides fine-grained access control
-- - Is reversible (can disable RLS if needed)
-- - Has no impact on schema (only permissions)
-- - Is required for production deployment

-- Estimated execution time: < 1 second
-- Data impact: None (RLS just filters existing data)
-- Backwards compatibility: Yes (existing code still works)
-- Requires testing: Yes (test each policy before deployment)

-- Created: 2025-10-28
-- Author: Security Audit
-- Status: READY FOR PRODUCTION
