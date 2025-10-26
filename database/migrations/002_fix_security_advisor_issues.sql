/**
 * Security Advisor Fixes
 *
 * Fixes the following issues:
 * - Remove SECURITY DEFINER from views (not needed for these views)
 * - Add search_path to functions (prevents search_path mutation)
 */

-- ============================================
-- FIX: Remove SECURITY DEFINER from views
-- ============================================

-- Drop and recreate recent_errors view without SECURITY DEFINER
DROP VIEW IF EXISTS recent_errors CASCADE;

CREATE VIEW recent_errors AS
SELECT
    id,
    user_id,
    title,
    message,
    endpoint,
    status_code,
    severity,
    created_at
FROM application_logs
WHERE severity IN ('error', 'critical')
ORDER BY created_at DESC
LIMIT 50;

-- Drop and recreate login_activity view without SECURITY DEFINER
DROP VIEW IF EXISTS login_activity CASCADE;

CREATE VIEW login_activity AS
SELECT
    id,
    user_id,
    status_code,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM application_logs
WHERE log_type = 'login'
ORDER BY created_at DESC;

-- Drop and recreate failed_login_attempts view without SECURITY DEFINER
DROP VIEW IF EXISTS failed_login_attempts CASCADE;

CREATE VIEW failed_login_attempts AS
SELECT
    id,
    user_id,
    ip_address,
    user_agent,
    metadata,
    created_at
FROM application_logs
WHERE log_type = 'login' AND status_code = 401
ORDER BY created_at DESC;

-- ============================================
-- FIX: Add search_path to functions
-- ============================================

-- Drop and recreate update_updated_at_column function with search_path
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER update_application_logs_updated_at
    BEFORE UPDATE ON application_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Drop and recreate cleanup_old_logs function with search_path
DROP FUNCTION IF EXISTS cleanup_old_logs(INTEGER) CASCADE;

CREATE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM application_logs
    WHERE created_at < (CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL)
    AND severity != 'critical';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTE: Auth Security Issues (Manual Fix)
-- ============================================
--
-- The following Auth warnings require manual configuration in Supabase:
--
-- 1. "Leaked Password Protection" - Disabled
--    Location: Authentication → Policies → Password & Hashing
--    Action: Enable "Leaked password protection"
--
-- 2. "Insufficient MFA Options" - Too few MFA methods
--    Location: Authentication → Policies → Multi-factor Authentication
--    Action: Enable additional MFA methods (TOTP, SMS, etc.)
--
-- These are project-level settings that must be configured in the
-- Supabase dashboard, not via SQL.
