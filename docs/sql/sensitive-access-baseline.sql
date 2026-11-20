-- Catalog-only; never selects application rows or credential values.
WITH targets AS (
 SELECT c.oid,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.reloptions
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relname IN
 ('dupr_user_tokens','dupr_partner_tokens','registration_secrets','profiles','payment_orders','public_profiles')
), access AS (
 SELECT t.relname,t.relrowsecurity,t.relforcerowsecurity,t.reloptions,r.rolname,
 has_table_privilege(r.oid,t.oid,'SELECT') AS can_select,
 has_any_column_privilege(r.oid,t.oid,'SELECT') AS any_column_select,
 has_table_privilege(r.oid,t.oid,'INSERT') AS can_insert,
 has_table_privilege(r.oid,t.oid,'UPDATE') AS can_update,
 has_table_privilege(r.oid,t.oid,'DELETE') AS can_delete
 FROM targets t CROSS JOIN pg_roles r WHERE r.rolname IN ('anon','authenticated')
), funcs AS (
 SELECT p.oid::regprocedure::text AS signature,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef
)
SELECT now() AS observed_at,
 (SELECT jsonb_agg(a ORDER BY relname,rolname) FROM access a) AS access,
 (SELECT jsonb_agg(x ORDER BY tablename,policyname)
  FROM (SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
        WHERE schemaname='public' AND tablename IN (SELECT relname FROM targets)) x) AS policies,
 (SELECT count(*) FROM funcs) AS public_security_definers,
 (SELECT jsonb_agg(f ORDER BY signature) FROM funcs f
  WHERE NOT EXISTS (SELECT 1 FROM unnest(f.proconfig) cfg WHERE cfg LIKE 'search_path=%')) AS definers_without_search_path,
 (SELECT jsonb_agg(f ORDER BY signature) FROM funcs f
  WHERE f.signature ~ '(dupr|registration|payment|profile)') AS sensitive_definers;

-- Run separately for column-level SELECT grants; contains catalog names only.
-- SELECT c.relname,a.attname,r.rolname
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
-- CROSS JOIN pg_roles r
-- WHERE n.nspname='public'
-- AND c.relname IN ('profiles','dupr_user_tokens','public_profiles')
-- AND r.rolname IN ('anon','authenticated')
-- AND has_column_privilege(r.oid,c.oid,a.attname,'SELECT')
-- ORDER BY c.relname,r.rolname,a.attnum;
