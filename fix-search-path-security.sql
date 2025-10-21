-- ============================================
-- FIX: Supabase Security Warning
-- Function public.update_updated_at_column has a role mutable search_path
-- ============================================
--
-- This script fixes the security issue by setting a secure search_path
-- on the update_updated_at_column function.
--
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Recreate the function with secure search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment explaining the security fix
COMMENT ON FUNCTION public.update_updated_at_column() IS
'Automatically updates the updated_at timestamp. SET search_path prevents privilege escalation attacks.';

-- Recreate triggers for subscriptions table
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Recreate triggers for message_usage table
DROP TRIGGER IF EXISTS update_message_usage_updated_at ON public.message_usage;
CREATE TRIGGER update_message_usage_updated_at
    BEFORE UPDATE ON public.message_usage
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Verify the fix was applied
SELECT
    proname AS function_name,
    prosecdef AS is_security_definer,
    proconfig AS search_path_config
FROM pg_proc
WHERE proname = 'update_updated_at_column';

-- Expected result:
-- function_name: update_updated_at_column
-- is_security_definer: true
-- search_path_config: {search_path=}
