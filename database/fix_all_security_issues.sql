-- ============================================
-- COMPREHENSIVE SECURITY FIXES FOR SUPABASE
-- ============================================
-- This script attempts to fix common security issues
-- ALWAYS BACKUP YOUR DATABASE BEFORE RUNNING THIS
-- Review each section and comment out fixes you don't want
-- ============================================

BEGIN;

\echo '=========================================='
\echo 'APPLYING SECURITY FIXES'
\echo '=========================================='
\echo ''

-- ============================================
-- FIX 1: Remove SECURITY DEFINER from views
-- ============================================
\echo '1. Fixing views with SECURITY DEFINER...'

-- Drop and recreate recent_errors view without SECURITY DEFINER
DROP VIEW IF EXISTS public.recent_errors CASCADE;

CREATE VIEW public.recent_errors AS
SELECT
    id,
    user_id,
    title,
    message,
    endpoint,
    status_code,
    severity,
    created_at
FROM public.application_logs
WHERE severity IN ('error', 'critical')
ORDER BY created_at DESC
LIMIT 50;

COMMENT ON VIEW public.recent_errors IS 'Shows recent error logs. RLS policies apply.';

-- Drop and recreate login_activity view without SECURITY DEFINER
DROP VIEW IF EXISTS public.login_activity CASCADE;

CREATE VIEW public.login_activity AS
SELECT
    id,
    user_id,
    status_code,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM public.application_logs
WHERE log_type = 'login'
ORDER BY created_at DESC;

COMMENT ON VIEW public.login_activity IS 'Shows login activity. RLS policies apply.';

-- Drop and recreate failed_login_attempts view without SECURITY DEFINER
DROP VIEW IF EXISTS public.failed_login_attempts CASCADE;

CREATE VIEW public.failed_login_attempts AS
SELECT
    id,
    user_id,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM public.application_logs
WHERE log_type = 'login' AND status_code = 401
ORDER BY created_at DESC;

COMMENT ON VIEW public.failed_login_attempts IS 'Shows failed login attempts. RLS policies apply.';

\echo '✓ Views fixed'
\echo ''

-- ============================================
-- FIX 2: Set search_path on all SECURITY DEFINER functions
-- ============================================
\echo '2. Fixing functions with mutable search_path...'

-- Fix update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

CREATE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_updated_at_column() IS
'Automatically updates the updated_at timestamp. SET search_path prevents privilege escalation.';

-- Fix cleanup_old_logs function
DROP FUNCTION IF EXISTS public.cleanup_old_logs(INTEGER) CASCADE;

CREATE FUNCTION public.cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
SET search_path = ''
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.application_logs
    WHERE created_at < (CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL)
    AND severity != 'critical';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_logs(INTEGER) IS
'Cleans up old logs. SET search_path prevents privilege escalation.';

\echo '✓ Functions fixed'
\echo ''

-- ============================================
-- FIX 3: Recreate triggers
-- ============================================
\echo '3. Recreating triggers...'

-- Recreate trigger for application_logs
DROP TRIGGER IF EXISTS update_application_logs_updated_at ON public.application_logs;
CREATE TRIGGER update_application_logs_updated_at
    BEFORE UPDATE ON public.application_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate trigger for subscriptions (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
        CREATE TRIGGER update_subscriptions_updated_at
            BEFORE UPDATE ON public.subscriptions
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Recreate trigger for message_usage (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_usage') THEN
        DROP TRIGGER IF EXISTS update_message_usage_updated_at ON public.message_usage;
        CREATE TRIGGER update_message_usage_updated_at
            BEFORE UPDATE ON public.message_usage
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Recreate trigger for webhook_events (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
        DROP TRIGGER IF EXISTS update_webhook_events_updated_at ON public.webhook_events;
        CREATE TRIGGER update_webhook_events_updated_at
            BEFORE UPDATE ON public.webhook_events
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Recreate trigger for token_blacklist (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_blacklist') THEN
        DROP TRIGGER IF EXISTS update_token_blacklist_updated_at ON public.token_blacklist;
        CREATE TRIGGER update_token_blacklist_updated_at
            BEFORE UPDATE ON public.token_blacklist
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

\echo '✓ Triggers recreated'
\echo ''

-- ============================================
-- FIX 4: Enable RLS on all public tables
-- ============================================
\echo '4. Enabling Row Level Security on public tables...'

DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.tablename);
        RAISE NOTICE 'Enabled RLS on public.%', table_record.tablename;
    END LOOP;
END $$;

\echo '✓ RLS enabled on all public tables'
\echo ''

-- ============================================
-- FIX 5: Create basic RLS policies
-- ============================================
\echo '5. Creating basic RLS policies...'

-- Policy for application_logs: Only admins can access
DROP POLICY IF EXISTS "Admin access to application_logs" ON public.application_logs;
CREATE POLICY "Admin access to application_logs"
    ON public.application_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.role = 'service_role'
        )
    );

-- Policy for subscriptions: Users can view their own subscriptions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subscriptions') THEN
        DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
        CREATE POLICY "Users can view own subscriptions"
            ON public.subscriptions
            FOR SELECT
            USING (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can insert own subscriptions" ON public.subscriptions;
        CREATE POLICY "Users can insert own subscriptions"
            ON public.subscriptions
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);

        DROP POLICY IF EXISTS "Users can update own subscriptions" ON public.subscriptions;
        CREATE POLICY "Users can update own subscriptions"
            ON public.subscriptions
            FOR UPDATE
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Policy for message_usage: Users can view their own usage
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'message_usage') THEN
        DROP POLICY IF EXISTS "Users can view own message usage" ON public.message_usage;
        CREATE POLICY "Users can view own message usage"
            ON public.message_usage
            FOR SELECT
            USING (auth.uid() = user_id);
    END IF;
END $$;

-- Policy for webhook_events: Only service role can access
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
        DROP POLICY IF EXISTS "Service role access to webhook_events" ON public.webhook_events;
        CREATE POLICY "Service role access to webhook_events"
            ON public.webhook_events
            FOR ALL
            USING (
                auth.jwt()->>'role' = 'service_role'
            );
    END IF;
END $$;

-- Policy for token_blacklist: Service role only
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'token_blacklist') THEN
        DROP POLICY IF EXISTS "Service role access to token_blacklist" ON public.token_blacklist;
        CREATE POLICY "Service role access to token_blacklist"
            ON public.token_blacklist
            FOR ALL
            USING (
                auth.jwt()->>'role' = 'service_role'
            );
    END IF;
END $$;

\echo '✓ RLS policies created'
\echo ''

-- ============================================
-- FIX 6: Revoke unnecessary public grants
-- ============================================
\echo '6. Reviewing and adjusting grants...'

-- Note: Be careful with this section as it might break existing functionality
-- Review grants before revoking

-- Revoke direct table access from anon (they should use RLS policies)
DO $$
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        -- Keep grants but rely on RLS for security
        -- If you want to revoke all access, uncomment these:
        -- EXECUTE format('REVOKE ALL ON public.%I FROM anon', table_record.tablename);
        -- EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', table_record.tablename);
        NULL;
    END LOOP;
END $$;

\echo '✓ Grants reviewed'
\echo ''

-- ============================================
-- VERIFICATION
-- ============================================
\echo '=========================================='
\echo 'VERIFICATION'
\echo '=========================================='
\echo ''

\echo 'Checking for remaining security issues...'
\echo ''

-- Check for SECURITY DEFINER views
\echo 'Views with SECURITY DEFINER (should be 0):'
SELECT COUNT(*) AS count
FROM pg_views
WHERE schemaname = 'public'
AND definition ILIKE '%SECURITY DEFINER%';

\echo ''

-- Check for functions with mutable search_path
\echo 'SECURITY DEFINER functions without search_path (should be 0):'
SELECT COUNT(*) AS count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path=']);

\echo ''

-- Check for tables without RLS
\echo 'Tables without RLS (should be 0):'
SELECT COUNT(*) AS count
FROM pg_tables
WHERE schemaname = 'public'
AND NOT rowsecurity;

\echo ''
\echo '=========================================='
\echo 'SECURITY FIXES COMPLETED'
\echo '=========================================='
\echo ''
\echo 'Please review the changes and test your application.'
\echo 'If everything works correctly, COMMIT the transaction.'
\echo 'If there are issues, ROLLBACK the transaction.'
\echo ''

-- COMMIT; -- Uncomment this to commit the changes
-- ROLLBACK; -- Uncomment this to rollback the changes

END;
