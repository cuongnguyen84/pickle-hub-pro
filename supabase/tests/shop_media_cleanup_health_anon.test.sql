-- Acceptance check 19: the ops queue view is admin-only, and `anon` is not an
-- exception to that.
--
-- Found on staging, not here: the view answered an anonymous REST read with
-- 200 and a row of zeros. It leaked nothing, because the underlying table's
-- only SELECT policy is admin-only and a `security_invoker` view aggregating
-- zero rows returns zeros. But zeros and "the queue is empty" are the same
-- answer, so the protection was one layer deeper than the check believed, and
-- a future permissive policy on the jobs table would have published real
-- numbers with nothing raising.
--
-- 🔴 The reason this file stages its own broken state, instead of just
-- asserting the good one: **the local database and the hosted project disagree
-- about grants.** Measured the same hour —
--
--     has_table_privilege('anon', …)      local     staging
--     shop_media_cleanup_health             f          t
--     shop_media_cleanup_jobs               f          t
--     shops                                 t          t
--
-- Supabase's platform `ALTER DEFAULT PRIVILEGES` hand `anon` full DML on new
-- tables in `public`; on the hosted project they were in force when these
-- migrations ran, locally they were not. So an assertion that merely reads the
-- privilege here is **already true before the fix** — the first red-proof of
-- this file passed with the whole REVOKE deleted, which is exactly the kind of
-- green this project has been caught by before.
--
-- The fix is to grant `anon` the privilege inside the transaction, reproducing
-- what staging actually looked like, and then replay the shipped migration over
-- it. The statements are read out of the ledger rather than copied, so a green
-- run is a run of the text that ships.

BEGIN;

SELECT plan(9);

-- ─── The state this database is in after every migration ────────────────────

SELECT ok(
  NOT has_table_privilege('anon', 'public.shop_media_cleanup_health', 'SELECT'),
  'anon cannot read the cleanup queue health view');

SELECT ok(
  has_table_privilege('authenticated', 'public.shop_media_cleanup_health', 'SELECT'),
  'authenticated still can — the admin panel reads it, and RLS narrows it to admins');

SELECT ok(
  NOT has_table_privilege('anon', 'public.shop_media_cleanup_jobs', 'SELECT'),
  'anon cannot read the cleanup queue itself');

SELECT ok(
  (SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'shop_media_cleanup_jobs' AND cmd = 'SELECT') > 0,
  'and RLS is still the second layer, not the only one');

-- ─── The shipped statements, replayable ─────────────────────────────────────
-- Asserted before use: a version that is not in the ledger replays zero
-- statements, and zero statements pass every assertion below.

SELECT isnt_empty(
  $$SELECT 1 FROM supabase_migrations.schema_migrations
     WHERE version = '20260814130000' AND array_length(statements, 1) >= 1$$,
  'the revoke is in the ledger with statements');

CREATE FUNCTION pg_temp.replay_revoke() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_sql text;
BEGIN
  FOR v_sql IN
    SELECT unnest(statements)
    FROM supabase_migrations.schema_migrations
    WHERE version = '20260814130000'
  LOOP
    EXECUTE v_sql;
  END LOOP;
END;
$fn$;

-- ─── Reproduce what the hosted project looked like ──────────────────────────

SELECT lives_ok(
  $$GRANT SELECT ON public.shop_media_cleanup_health TO anon;
    GRANT SELECT ON public.shop_media_cleanup_jobs   TO anon$$,
  'hand anon the read that Supabase default privileges handed it on staging');

SELECT ok(
  has_table_privilege('anon', 'public.shop_media_cleanup_health', 'SELECT')
  AND has_table_privilege('anon', 'public.shop_media_cleanup_jobs', 'SELECT'),
  'the broken state is real before the fix runs — otherwise the next two assertions prove nothing');

SELECT lives_ok('SELECT pg_temp.replay_revoke()', 'replay the shipped revoke over it');

SELECT ok(
  NOT has_table_privilege('anon', 'public.shop_media_cleanup_health', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.shop_media_cleanup_jobs', 'SELECT')
  AND has_table_privilege('authenticated', 'public.shop_media_cleanup_health', 'SELECT'),
  'both reads are gone from anon, and authenticated keeps its own');

SELECT * FROM finish();
ROLLBACK;
