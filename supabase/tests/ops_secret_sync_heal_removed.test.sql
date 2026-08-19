-- The job that must not come back.
--
-- `secret-sync-heal-30min` was deleted from production by hand on 2026-08-03,
-- after it overwrote `SCRAPER_AUTH_SECRET` in a loop. Two migrations still
-- schedule it, so every database built from this repo had it again — staging
-- proved that ten days later. `20260814120000` is the removal written down.
--
-- Two layers, because the two failures are different failures:
--
--   · The state of THIS database after every migration has run. That is the
--     real call site; delete the `cron.unschedule` from the migration and the
--     first assertion goes red on the next `db reset`.
--   · The behaviour of the removal under fixtures a real environment can be in
--     — job active, job inactive, job absent, similarly-named neighbours. Those
--     statements are not copied here: they are read back out of the ledger, so
--     a test that passes is a test that ran the shipped text.
--
-- The ledger lookup is asserted before it is used. A version that is not there
-- yields zero statements, and a replay of zero statements makes every
-- assertion below true without executing anything.

BEGIN;

SELECT plan(14);

-- ─── Layer 1: this database, after migrations ───────────────────────────────

SELECT is(
  (SELECT count(*) FROM cron.job WHERE jobname = 'secret-sync-heal-30min'),
  0::bigint,
  'the job is not scheduled here — 20260622000000 created it, 20260814120000 took it away');

SELECT isnt_empty(
  $$SELECT 1 FROM supabase_migrations.schema_migrations
     WHERE version = '20260814120000' AND array_length(statements, 1) >= 1$$,
  'the removal is in the ledger with statements — otherwise every replay below is a no-op that proves nothing');

-- ─── The shipped statements, replayable ─────────────────────────────────────

CREATE FUNCTION pg_temp.replay_removal() RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE v_sql text;
BEGIN
  FOR v_sql IN
    SELECT unnest(statements)
    FROM supabase_migrations.schema_migrations
    WHERE version = '20260814120000'
  LOOP
    EXECUTE v_sql;
  END LOOP;
END;
$fn$;

-- ─── Absent → success ───────────────────────────────────────────────────────
-- Production deleted this job by hand. When the migration reaches it there will
-- be nothing to remove, and that has to be a clean apply rather than an error.

SELECT lives_ok(
  'SELECT pg_temp.replay_removal()',
  'an environment that never had the job applies the removal without complaint');

-- ─── Active → removed ───────────────────────────────────────────────────────

SELECT lives_ok(
  $$SELECT cron.schedule('secret-sync-heal-30min', '*/30 * * * *', 'SELECT 1')$$,
  'stage the job the way 20260622000000 leaves it');

SELECT is(
  (SELECT count(*) FROM cron.job WHERE jobname = 'secret-sync-heal-30min'),
  1::bigint,
  'staged');

SELECT lives_ok('SELECT pg_temp.replay_removal()', 'removal runs against an active job');

SELECT is(
  (SELECT count(*) FROM cron.job WHERE jobname = 'secret-sync-heal-30min'),
  0::bigint,
  'an active job is gone');

-- ─── Inactive → removed ─────────────────────────────────────────────────────
-- Staging spent a day in this state: switched off by hand, still scheduled.
-- "Switched off" is not "removed"; the next `db reset` switches it back on.

SELECT lives_ok(
  $$SELECT cron.schedule('secret-sync-heal-30min', '*/30 * * * *', 'SELECT 1');
    SELECT cron.alter_job(
      (SELECT jobid FROM cron.job WHERE jobname = 'secret-sync-heal-30min'),
      active := false)$$,
  'stage the job disabled');

SELECT lives_ok('SELECT pg_temp.replay_removal()', 'removal runs against an inactive job');

SELECT is(
  (SELECT count(*) FROM cron.job WHERE jobname = 'secret-sync-heal-30min'),
  0::bigint,
  'an inactive job is gone too — active is not the thing being matched on');

-- ─── Neighbours survive ─────────────────────────────────────────────────────
-- The whole reason to match on `=` instead of LIKE. Every name here is one a
-- LIKE pattern aimed at this job would plausibly have swallowed.

SELECT lives_ok(
  $$SELECT cron.schedule('secret-sync-heal-30min-v2', '*/30 * * * *', 'SELECT 1');
    SELECT cron.schedule('secret-sync-heal',          '*/30 * * * *', 'SELECT 1');
    SELECT cron.schedule('secret-sync-heal-30min ',   '*/30 * * * *', 'SELECT 1');
    SELECT pg_temp.replay_removal()$$,
  'run the removal with three near-misses in the table');

SELECT set_eq(
  $$SELECT jobname FROM cron.job
     WHERE jobname LIKE 'secret-sync%' OR jobname LIKE 'social-poster%'$$,
  ARRAY[
    'secret-sync-heal-30min-v2',
    'secret-sync-heal',
    'secret-sync-heal-30min ',
    'social-poster-catchup-15min'
  ],
  'the near-misses and social-poster-catchup-15min all survive; only the exact name went');

SELECT set_eq(
  $$SELECT jobname FROM cron.job WHERE jobname LIKE 'shop-media%'$$,
  ARRAY['shop-media-cleanup-every-5m', 'shop-media-reconcile-hourly'],
  'both Shop jobs are untouched');

-- ─── Twice is the same as once ──────────────────────────────────────────────

SELECT lives_ok(
  $$SELECT pg_temp.replay_removal();
    SELECT pg_temp.replay_removal()$$,
  'replaying the removal twice more changes nothing and raises nothing');

SELECT * FROM finish();
ROLLBACK;
