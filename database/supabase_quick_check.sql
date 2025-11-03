-- ============================================
-- SUPABASE SECURITY AUDIT - SQL EDITOR COMPATIBLE
-- ============================================
-- Copy and paste this entire script into Supabase SQL Editor
-- It will show results in separate result sets
-- ============================================

-- ============================================
-- SECURITY SUMMARY (run this first)
-- ============================================
WITH security_summary AS (
    SELECT
        'Views with SECURITY DEFINER' AS issue_type,
        COUNT(*) AS count,
        'CRITICAL' AS severity,
        'Remove SECURITY DEFINER from views' AS fix,
        1 AS sort_order
    FROM pg_views
    WHERE schemaname = 'public'
    AND definition ILIKE '%SECURITY DEFINER%'

    UNION ALL

    SELECT
        'Functions with mutable search_path',
        COUNT(*),
        'CRITICAL',
        'Set search_path on SECURITY DEFINER functions',
        2
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
        'Enable RLS on all public tables',
        3
    FROM pg_tables
    WHERE schemaname = 'public'
    AND NOT rowsecurity

    UNION ALL

    SELECT
        'Tables without RLS policies',
        COUNT(DISTINCT t.tablename),
        'HIGH',
        'Create RLS policies for each table',
        4
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
    WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND p.policyname IS NULL

    UNION ALL

    SELECT
        'Public write grants to anon role',
        COUNT(*),
        'MEDIUM',
        'Review and restrict anon grants',
        5
    FROM information_schema.table_privileges
    WHERE grantee = 'anon'
    AND table_schema = 'public'
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')

    UNION ALL

    SELECT
        'SECURITY DEFINER functions (total)',
        COUNT(*),
        'INFO',
        'Review necessity of SECURITY DEFINER',
        6
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true
)
SELECT
    issue_type AS "Issue Type",
    count AS "Count",
    severity AS "Severity",
    fix AS "Recommended Fix"
FROM security_summary
WHERE count > 0
ORDER BY sort_order;

-- ============================================
-- TABLES WITHOUT RLS (most critical)
-- ============================================
SELECT
    tablename AS "Table Name",
    'CRITICAL: Enable RLS immediately' AS "Status"
FROM pg_tables
WHERE schemaname = 'public'
AND NOT rowsecurity
ORDER BY tablename;

-- ============================================
-- FUNCTIONS WITH MUTABLE SEARCH_PATH
-- ============================================
SELECT
    p.proname AS "Function Name",
    pg_get_function_identity_arguments(p.oid) AS "Arguments",
    'CRITICAL: Add search_path' AS "Status"
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.prosecdef = true
AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])
ORDER BY p.proname;

-- ============================================
-- ALL RLS STATUS
-- ============================================
SELECT
    tablename AS "Table Name",
    CASE
        WHEN rowsecurity THEN '✓ ENABLED'
        ELSE '✗ DISABLED'
    END AS "RLS Status",
    CASE
        WHEN rowsecurity THEN 'OK'
        ELSE 'CRITICAL'
    END AS "Severity"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY
    CASE WHEN rowsecurity THEN 1 ELSE 0 END,
    tablename;

-- ============================================
-- RLS POLICIES (if any exist)
-- ============================================
SELECT
    tablename AS "Table",
    policyname AS "Policy Name",
    CASE cmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE cmd::text
    END AS "Operation",
    array_to_string(roles, ', ') AS "Roles",
    LEFT(qual::text, 60) AS "Condition (truncated)"
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- ANONYMOUS ROLE GRANTS
-- ============================================
SELECT
    table_name AS "Table",
    string_agg(privilege_type, ', ' ORDER BY privilege_type) AS "Privileges",
    CASE
        WHEN string_agg(privilege_type, ', ') LIKE '%INSERT%'
             OR string_agg(privilege_type, ', ') LIKE '%UPDATE%'
             OR string_agg(privilege_type, ', ') LIKE '%DELETE%'
        THEN 'WARNING: Write access'
        ELSE 'Read only'
    END AS "Assessment"
FROM information_schema.table_privileges
WHERE grantee = 'anon'
AND table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;

-- ============================================
-- STORAGE BUCKETS
-- ============================================
SELECT
    name AS "Bucket Name",
    CASE WHEN public THEN '⚠ PUBLIC' ELSE '✓ PRIVATE' END AS "Access",
    CASE WHEN file_size_limit IS NULL THEN 'No limit' ELSE (file_size_limit / 1024 / 1024)::text || ' MB' END AS "Size Limit",
    COALESCE(array_to_string(allowed_mime_types, ', '), 'All types') AS "Allowed Types"
FROM storage.buckets
ORDER BY name;

-- ============================================
-- FINAL CRITICAL ISSUES COUNT
-- ============================================
SELECT
    'TOTAL CRITICAL ISSUES' AS "Summary",
    SUM(count)::integer AS "Count",
    CASE
        WHEN SUM(count) = 0 THEN '✓ No critical issues found'
        WHEN SUM(count) <= 5 THEN '⚠ Some critical issues need attention'
        ELSE '✗ Multiple critical issues - fix immediately'
    END AS "Status"
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
