-- ============================================================================
-- CP18 — where a scheduled job is allowed to send a request
-- ----------------------------------------------------------------------------
-- Every cron job and every trigger in this database that calls an Edge Function
-- used to carry the production host as a literal:
--
--     url := 'https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/…'
--
-- That was true and harmless for exactly as long as this repo had one
-- environment. It stops being either the moment a second project applies the
-- same migrations: a staging database would schedule jobs that POST to
-- PRODUCTION, carrying staging's own secret, every five minutes.
--
-- The reason it has never happened is worth writing down, because it is not the
-- reason anyone would assume. Locally, `cron.job` holds twenty active jobs
-- pointing at production right now — and `net._http_response` is empty, with
-- twenty-five failed runs. They all abort one line before the request, at
-- `cron_secret is not configured`. **A missing secret is the only thing
-- standing between this repo and cross-environment traffic.**
--
-- Staging is the first environment where we deliberately CREATE that secret.
-- The protection that has been holding the line is exactly the one we are about
-- to remove, which is why this lands before any remote migration.
--
-- ── The contract ───────────────────────────────────────────────────────────
--
--   · The target host comes from vault, key `project_url`, per environment.
--   · Missing → exception. Malformed → exception. **No fallback.** A default
--     that resolves to production is how a misconfigured staging quietly
--     becomes a second production client; an exception is a job that fails
--     loudly and deletes nothing.
--   · The host and the secret are two separate pieces of configuration. They
--     answer different questions — "where" and "may I" — and a deployment that
--     gets one right and the other wrong must fail, not half-work.
--   · Resolved at RUN time, not baked into the job command. Re-pointing an
--     environment is a vault write, not a re-schedule, so there is no window
--     where a job exists with the wrong host.
--
-- ── What this function deliberately cannot do ──────────────────────────────
--
-- It cannot verify that the configured URL belongs to the database it is
-- running in. Postgres has no reliable self-identity here — `cluster_name` is
-- "main" on every Supabase project, checked on staging rather than assumed. So
-- the last mile is a deployment assertion, not a runtime one: after configuring
-- an environment, prove `SELECT public.ops_project_url()` returns that
-- environment's host before enabling any schedule. The packets do that, and
-- the value never appears in a job command where it could go stale.
--
-- Ordering: this file is dated to sort immediately before
-- 20260519010100_news_translate_rpc_and_cron.sql, the earliest migration that
-- needs it, so a clean `db reset` defines the helper before its first caller.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ops_project_url()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault, pg_catalog
AS $$
DECLARE
  _url TEXT;
BEGIN
  SELECT decrypted_secret INTO _url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  IF _url IS NULL OR btrim(_url) = '' THEN
    RAISE EXCEPTION 'project_url is not configured'
      USING ERRCODE = 'invalid_parameter_value',
            HINT = 'Set it per environment: SELECT vault.create_secret(''https://<ref>.supabase.co'', ''project_url''). There is deliberately no default.';
  END IF;

  -- Trailing slashes are the one forgiving thing here: a pasted dashboard URL
  -- often has one, and '…co//functions/v1/x' is a 404 nobody enjoys tracing.
  _url := regexp_replace(btrim(_url), '/+$', '');

  -- Shape, not identity. A Supabase project ref is 20 lowercase letters; this
  -- refuses a bare hostname, an http:// URL, a path, and a placeholder that
  -- somebody forgot to fill in.
  IF _url !~ '^https://[a-z]{20}\.supabase\.co$' THEN
    RAISE EXCEPTION 'project_url is malformed: expected https://<20-char-ref>.supabase.co'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN _url;
END $$;

COMMENT ON FUNCTION public.ops_project_url() IS
  'The base URL this environment may send scheduled requests to, from vault key `project_url`. Fails closed: no default, no production fallback. See migration 20260519010050.';

-- Called only from SECURITY DEFINER functions and from cron jobs running as the
-- table owner, so no role needs EXECUTE of its own. Nothing holding a user JWT
-- can ask this database where it is allowed to send requests.
REVOKE ALL ON FUNCTION public.ops_project_url() FROM PUBLIC;
