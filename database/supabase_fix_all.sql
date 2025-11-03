-- ============================================
-- COMPREHENSIVE SECURITY FIXES - SUPABASE COMPATIBLE
-- ============================================
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS!
-- Copy and paste this entire file into Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- FIX 1: Remove SECURITY DEFINER from views
-- ============================================

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

-- ============================================
-- FIX 2: Set search_path on all SECURITY DEFINER functions
-- ============================================

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

-- ============================================
-- FIX 3: Recreate triggers
-- ============================================

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

-- ============================================
-- FIX 4: Enable RLS on all public tables
-- ============================================

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
    END LOOP;
END $$;

-- ============================================
-- FIX 5: Create basic RLS policies
-- ============================================

-- Policy for application_logs: Only service_role can access
DROP POLICY IF EXISTS "Service role access to application_logs" ON public.application_logs;
CREATE POLICY "Service role access to application_logs"
    ON public.application_logs
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

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
            USING (auth.jwt()->>'role' = 'service_role');
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
            USING (auth.jwt()->>'role' = 'service_role');
    END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

-- Check for remaining SECURITY DEFINER views
SELECT 'Remaining SECURITY DEFINER views:' AS check_type, COUNT(*) AS count
FROM pg_views
WHERE schemaname = 'public'
AND definition ILIKE '%SECURITY DEFINER%'

UNION ALL

-- Check for functions with mutable search_path
SELECT 'Functions with mutable search_path:', COUNT(*)
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])

UNION ALL

-- Check for tables without RLS
SELECT 'Tables without RLS:', COUNT(*)
FROM pg_tables
WHERE schemaname = 'public'
AND NOT rowsecurity;

-- IMPORTANT: Review the verification results above
-- If all counts are 0, the fixes were successful!
-- Now you can COMMIT the transaction

COMMIT;

-- After running this, test your application thoroughly
-- If there are issues, you can restore from your backup
