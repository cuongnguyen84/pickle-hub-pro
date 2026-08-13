-- ============================================================================
-- Remove `secret-sync-heal-30min` for good
-- ----------------------------------------------------------------------------
-- On 2026-08-03 this job overwrote `SCRAPER_AUTH_SECRET` in a loop and took the
-- pro-tour scrapers down with a 401. It was removed from production the same
-- day — **by hand, in psql**. Nothing in this repository recorded that removal.
--
-- So the job is still scheduled by `20260622000000_secret_sync_infra.sql`, and
-- re-activated by `20260715190000_cron_fail_loud_on_missing_secret.sql`. Every
-- environment built from migrations gets it back. Staging proved that on
-- 2026-08-13: a database created the day before was running a job that had been
-- deleted from production ten days earlier, posting to a shared Cloudflare
-- Worker. It was harmless there only because staging has no
-- `secret_sync_heal_secret` in vault — the same accidental protection that CP18
-- was written about.
--
-- A hand-run DELETE is not a fix. It is a fix that lasts until the next
-- `db reset`. This is that fix written down.
--
-- ── What this does and does not touch ───────────────────────────────────────
--
--   · Exact name only. `secret-sync-heal-30min`, matched with `=`. A LIKE
--     pattern here would also take `social-poster-catchup-15min`'s sibling and
--     any future job whose name merely starts the same way; the blast radius of
--     a pattern is every job someone names carelessly later.
--   · Idempotent by construction: the statement is a SELECT over `cron.job`, so
--     an environment where the job never existed (or was already deleted by
--     hand, like production) runs zero calls and succeeds. Running it twice is
--     the same as running it once.
--   · No secrets are read or written. `SCRAPER_AUTH_SECRET` and
--     `secret_sync_heal_secret` are left exactly as they are — this migration is
--     about the schedule, not the credentials, and the vault rows are evidence.
--   · No requests. `cron.unschedule` deletes a row; nothing here calls
--     `net.http_post`, so applying it generates no outbound traffic.
-- ============================================================================

-- Zero rows → zero calls. That is the whole idempotency story.
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'secret-sync-heal-30min';

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'secret-sync-heal-30min') THEN
    RAISE EXCEPTION
      'secret-sync-heal-30min still scheduled after unschedule — refusing to record this migration as applied';
  END IF;
END;
$verify$;
