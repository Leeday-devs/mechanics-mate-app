-- ============================================
-- QUICK SECURITY CHECK
-- ============================================
-- Run this in Supabase SQL Editor for a quick overview
-- of security issues
-- ============================================

\echo '=========================================='
\echo 'QUICK SECURITY CHECK'
\echo '=========================================='
\echo ''

-- Summary counts
WITH security_summary AS (
    SELECT
        'Views with SECURITY DEFINER' AS issue_type,
        COUNT(*) AS count,
        'CRITICAL' AS severity,
        'Remove SECURITY DEFINER from views' AS fix
    FROM pg_views
    WHERE schemaname = 'public'
    AND definition ILIKE '%SECURITY DEFINER%'

    UNION ALL

    SELECT
        'Functions with mutable search_path',
        COUNT(*),
        'CRITICAL',
        'Set search_path on SECURITY DEFINER functions'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])

    UNION ALL

    SELECT
        'Tables without RLS',
        COUNT(*),
        'CRITICAL',
        'Enable RLS on all public tables'
    FROM pg_tables
    WHERE schemaname = 'public'
    AND NOT rowsecurity

    UNION ALL

    SELECT
        'Tables without RLS policies',
        COUNT(DISTINCT t.tablename),
        'HIGH',
        'Create RLS policies for each table'
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
    WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND p.policyname IS NULL

    UNION ALL

    SELECT
        'Public grants to anon role',
        COUNT(*),
        'MEDIUM',
        'Review and restrict anon grants'
    FROM information_schema.table_privileges
    WHERE grantee = 'anon'
    AND table_schema = 'public'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')

    UNION ALL

    SELECT
        'SECURITY DEFINER functions (total)',
        COUNT(*),
        'INFO',
        'Review necessity of SECURITY DEFINER'
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
)
SELECT
    issue_type,
    count,
    severity,
    fix
FROM security_summary
WHERE count > 0
ORDER BY
    CASE severity
        WHEN 'CRITICAL' THEN 1
        WHEN 'HIGH' THEN 2
        WHEN 'MEDIUM' THEN 3
        ELSE 4
    END;

\echo ''
\echo '=========================================='

-- Show specific items
\echo 'CRITICAL ISSUES DETAILS:'
\echo '=========================================='

\echo ''
\echo 'Views with SECURITY DEFINER:'
SELECT viewname
FROM pg_views
WHERE schemaname = 'public'
AND definition ILIKE '%SECURITY DEFINER%'
ORDER BY viewname;

\echo ''
\echo 'Functions with mutable search_path:'
SELECT proname AS function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])
ORDER BY proname;

\echo ''
\echo 'Tables without RLS:'
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
AND NOT rowsecurity
ORDER BY tablename;

\echo ''
\echo '=========================================='
\echo 'TOTAL ISSUES: '
SELECT SUM(count) AS total_issues
FROM (
    SELECT COUNT(*) AS count
    FROM pg_views
    WHERE schemaname = 'public'
    AND definition ILIKE '%SECURITY DEFINER%'

    UNION ALL

    SELECT COUNT(*)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
    AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])

    UNION ALL

    SELECT COUNT(*)
    FROM pg_tables
    WHERE schemaname = 'public'
    AND NOT rowsecurity
) sub;

\echo '=========================================='
\echo ''
\echo 'Next steps:'
\echo '1. Review the issues above'
\echo '2. Run fix_all_security_issues.sql to fix automatically'
\echo '3. Or run individual migration files for more control'
\echo '4. Test your application after fixes'
\echo ''
