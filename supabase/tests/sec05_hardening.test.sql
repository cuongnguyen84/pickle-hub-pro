-- SEC-05 regression: the hardening from 20260716120000 stays applied.

BEGIN;

SELECT plan(7);

-- 1. No SECURITY DEFINER function in public may run with an unpinned
--    search_path — the exact lint SEC-05 closed.
SELECT is(
  (SELECT COUNT(*)::int
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) cfg
       WHERE cfg LIKE 'search_path=%'
     )),
  0,
  'every SECURITY DEFINER function pins search_path'
);

-- 2. No public table may have RLS disabled.
SELECT is(
  (SELECT COUNT(*)::int
   FROM pg_class c
   JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind = 'r'
     AND n.nspname = 'public'
     AND NOT c.relrowsecurity),
  0,
  'every public table has RLS enabled'
);

-- 3. error_alert_dedup is invisible to API roles.
SELECT ok(
  NOT has_table_privilege('anon', 'public.error_alert_dedup', 'SELECT'),
  'anon cannot select error_alert_dedup'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.error_alert_dedup', 'SELECT'),
  'authenticated cannot select error_alert_dedup'
);

-- 4. Internally-gated admin/PII RPCs have no anon EXECUTE.
SELECT ok(
  NOT has_function_privilege('anon', 'public.admin_lookup_profiles_by_email(text[])', 'EXECUTE'),
  'anon cannot execute admin_lookup_profiles_by_email'
);
SELECT ok(
  NOT has_function_privilege('anon', 'public.find_profile_by_phone(text)', 'EXECUTE'),
  'anon cannot execute find_profile_by_phone'
);
-- Authenticated flows keep working (ghost-profile phone uniqueness check).
SELECT ok(
  has_function_privilege('authenticated', 'public.find_profile_by_phone(text)', 'EXECUTE'),
  'authenticated keeps find_profile_by_phone'
);

SELECT * FROM finish();

ROLLBACK;
