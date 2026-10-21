-- CP18 — the target host a scheduled job is allowed to use.
--
-- Runs against the real database, because the whole contract is "what does this
-- function do when the environment is misconfigured", and the interesting
-- answers only exist at run time.
--
-- The local database is itself the most useful fixture here: it has twenty
-- active cron jobs and no `project_url`, so it is a live example of the state
-- this design has to make safe.

BEGIN;

SELECT plan(9);

-- ─── Shape ──────────────────────────────────────────────────────────────────

SELECT has_function('public', 'ops_project_url', 'the helper exists');

SELECT is(
  (SELECT prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ops_project_url'),
  true,
  'SECURITY DEFINER — vault is not readable by the roles that call it');

SELECT ok(
  (SELECT proconfig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ops_project_url')
  @> ARRAY['search_path=public, vault, pg_catalog'],
  'search_path is pinned — a SECURITY DEFINER without one is a privilege bug waiting');

SELECT ok(
  NOT has_function_privilege('authenticated', 'public.ops_project_url()', 'EXECUTE'),
  'nothing holding a user JWT may ask where this database sends requests');

-- ─── Fails closed ───────────────────────────────────────────────────────────
-- No secret is configured on a local database, which is exactly the case a
-- fallback would have papered over.

-- 22023 = invalid_parameter_value. pgTAP compares a 5-character argument as a
-- SQLSTATE and anything longer as an error MESSAGE, so the condition name would
-- silently be matched against the wrong thing.
SELECT throws_ok(
  'SELECT public.ops_project_url()',
  '22023',
  NULL,
  'unconfigured is an exception, not a guess');

SELECT lives_ok(
  $$SELECT vault.create_secret('http://localhost:54321', 'project_url')$$,
  'stage a malformed value the way a hurried deploy would');

SELECT throws_ok(
  'SELECT public.ops_project_url()',
  '22023',
  NULL,
  'http://, a bare host, a path or a placeholder are all refused');

-- ─── Accepts exactly one shape ──────────────────────────────────────────────

SELECT lives_ok(
  $$DELETE FROM vault.secrets WHERE name = 'project_url';
    SELECT vault.create_secret('https://utokwfcljxjkpkaqgheo.supabase.co/', 'project_url')$$,
  'point it at a real project, with the trailing slash a pasted URL carries');

SELECT is(
  public.ops_project_url(),
  'https://utokwfcljxjkpkaqgheo.supabase.co',
  'the trailing slash is trimmed and the host comes back unchanged otherwise');

SELECT * FROM finish();
ROLLBACK;
