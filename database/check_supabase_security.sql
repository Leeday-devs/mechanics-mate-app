-- ============================================
-- COMPREHENSIVE SUPABASE SECURITY AUDIT SCRIPT
-- ============================================
-- This script checks for common Supabase security issues
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

\echo '=========================================='
\echo 'SUPABASE SECURITY AUDIT'
\echo '=========================================='
\echo ''

-- ============================================
-- 1. CHECK: Views with SECURITY DEFINER
-- ============================================
\echo '1. CHECKING: Views with SECURITY DEFINER property'
\echo '------------------------------------------'

SELECT
    schemaname,
    viewname,
    definition
FROM pg_views
WHERE schemaname = 'public'
AND definition ILIKE '%SECURITY DEFINER%'
ORDER BY viewname;

\echo ''

-- ============================================
-- 2. CHECK: Functions with mutable search_path
-- ============================================
\echo '2. CHECKING: Functions with mutable search_path'
\echo '------------------------------------------'

SELECT
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    CASE
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END AS security_type,
    p.proconfig AS search_path_config,
    CASE
        WHEN p.prosecdef AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])
        THEN 'VULNERABLE'
        ELSE 'OK'
    END AS status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname IN ('public', 'auth')
AND p.prokind = 'f'  -- functions only, not aggregates
ORDER BY
    CASE WHEN p.prosecdef AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])
    THEN 0 ELSE 1 END,
    p.proname;

\echo ''

-- ============================================
-- 3. CHECK: Tables without RLS enabled
-- ============================================
\echo '3. CHECKING: Tables without Row Level Security (RLS)'
\echo '------------------------------------------'

SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN 'ENABLED'
        ELSE 'DISABLED'
    END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY
    CASE WHEN rowsecurity THEN 1 ELSE 0 END,
    tablename;

\echo ''

-- ============================================
-- 4. CHECK: RLS Policies
-- ============================================
\echo '4. CHECKING: RLS Policies for public tables'
\echo '------------------------------------------'

SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

\echo ''

-- ============================================
-- 5. CHECK: Triggers with SECURITY DEFINER
-- ============================================
\echo '5. CHECKING: Triggers using SECURITY DEFINER functions'
\echo '------------------------------------------'

SELECT
    t.trigger_schema,
    t.event_object_table AS table_name,
    t.trigger_name,
    t.action_timing,
    t.event_manipulation,
    p.proname AS function_name,
    CASE
        WHEN p.prosecdef THEN 'SECURITY DEFINER'
        ELSE 'SECURITY INVOKER'
    END AS security_type
FROM information_schema.triggers t
JOIN pg_proc p ON t.action_statement LIKE '%' || p.proname || '%'
WHERE t.trigger_schema = 'public'
ORDER BY t.event_object_table, t.trigger_name;

\echo ''

-- ============================================
-- 6. CHECK: Publicly accessible tables/views
-- ============================================
\echo '6. CHECKING: Public access grants'
\echo '------------------------------------------'

SELECT
    schemaname,
    tablename,
    array_agg(privilege_type) AS privileges
FROM information_schema.table_privileges
WHERE grantee = 'anon'
AND table_schema = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

\echo ''

-- ============================================
-- 7. CHECK: Auth schema security
-- ============================================
\echo '7. CHECKING: Auth schema access'
\echo '------------------------------------------'

SELECT
    table_schema,
    table_name,
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'auth'
AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee;

\echo ''

-- ============================================
-- 8. CHECK: Functions with SECURITY DEFINER
-- ============================================
\echo '8. CHECKING: All SECURITY DEFINER functions'
\echo '------------------------------------------'

SELECT
    n.nspname AS schema,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true
AND n.nspname IN ('public', 'auth')
ORDER BY n.nspname, p.proname;

\echo ''

-- ============================================
-- 9. CHECK: Storage bucket policies
-- ============================================
\echo '9. CHECKING: Storage bucket policies'
\echo '------------------------------------------'

SELECT
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets
ORDER BY name;

\echo ''

-- ============================================
-- 10. CHECK: Realtime publications
-- ============================================
\echo '10. CHECKING: Realtime publications'
\echo '------------------------------------------'

SELECT
    pubname AS publication_name,
    array_agg(tablename) AS tables
FROM pg_publication p
JOIN pg_publication_tables pt ON p.pubname = pt.pubname
GROUP BY pubname
ORDER BY pubname;

\echo ''

-- ============================================
-- SUMMARY
-- ============================================
\echo '=========================================='
\echo 'SECURITY AUDIT SUMMARY'
\echo '=========================================='

WITH security_stats AS (
    SELECT
        COUNT(*) FILTER (WHERE NOT rowsecurity) AS tables_without_rls,
        COUNT(*) FILTER (WHERE rowsecurity) AS tables_with_rls
    FROM pg_tables
    WHERE schemaname = 'public'
),
function_stats AS (
    SELECT
        COUNT(*) FILTER (
            WHERE p.prosecdef
            AND (p.proconfig IS NULL OR NOT p.proconfig::text[] @> ARRAY['search_path='])
        ) AS vulnerable_functions,
        COUNT(*) FILTER (WHERE p.prosecdef) AS security_definer_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prokind = 'f'
)
SELECT
    'Tables without RLS' AS issue_type,
    s.tables_without_rls AS count,
    CASE
        WHEN s.tables_without_rls > 0 THEN 'CRITICAL'
        ELSE 'OK'
    END AS severity
FROM security_stats s
UNION ALL
SELECT
    'Functions with mutable search_path',
    f.vulnerable_functions,
    CASE
        WHEN f.vulnerable_functions > 0 THEN 'CRITICAL'
        ELSE 'OK'
    END
FROM function_stats f
UNION ALL
SELECT
    'SECURITY DEFINER functions',
    f.security_definer_functions,
    CASE
        WHEN f.security_definer_functions > 0 THEN 'WARNING'
        ELSE 'OK'
    END
FROM function_stats f;

\echo ''
\echo 'Audit completed.'
\echo '=========================================='
