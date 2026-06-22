-- ============================================================================
-- secret-sync Worker infrastructure
-- ----------------------------------------------------------------------------
-- Supporting objects for the secret-sync Cloudflare Worker that auto-heals
-- drift between vault values and Supabase project env secrets. The Worker
-- needs (a) a way to read vault values via REST, (b) a place to log every
-- check pass for audit.
-- ============================================================================

-- RPC: read a vault secret by name. service_role only.
CREATE OR REPLACE FUNCTION public.get_vault_secret(p_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, extensions
AS $$
DECLARE
  v_value TEXT;
BEGIN
  SELECT decrypted_secret INTO v_value
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;
  RETURN v_value;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_secret(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vault_secret(TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_vault_secret(TEXT) TO service_role;

-- Audit log for every secret-sync check pass.
CREATE TABLE IF NOT EXISTS public.secret_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline        TEXT NOT NULL,                -- e.g. SCRAPER_AUTH_SECRET
  initial_status  INT,                          -- HTTP status of edge function ping
  action          TEXT NOT NULL                 -- no_op | synced | verify_failed | vault_missing | mgmt_failed
                  CHECK (action IN ('no_op','synced','verify_failed','vault_missing','mgmt_failed')),
  final_status    INT,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS secret_sync_log_created_idx
  ON public.secret_sync_log (created_at DESC);

CREATE INDEX IF NOT EXISTS secret_sync_log_action_idx
  ON public.secret_sync_log (action, created_at DESC) WHERE action <> 'no_op';

ALTER TABLE public.secret_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS secret_sync_log_service_role_all ON public.secret_sync_log;
CREATE POLICY secret_sync_log_service_role_all
  ON public.secret_sync_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS secret_sync_log_admin_select ON public.secret_sync_log;
CREATE POLICY secret_sync_log_admin_select
  ON public.secret_sync_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.secret_sync_log IS 'Audit log of secret-sync Worker check passes. Non-no_op rows = drift detected/fixed.';

-- ----------------------------------------------------------------------------
-- Cron job 9: trigger secret-sync every 30 min via vault-stored heal secret
-- ----------------------------------------------------------------------------
-- Vault secret 'secret_sync_heal_secret' must be set out-of-band to match the
-- Worker's HEAL_AUTH_SECRET env var. The DO block warns instead of failing
-- if it's missing, so this migration is safe to apply before the secret is
-- in place.

DO $check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'secret_sync_heal_secret') THEN
    RAISE WARNING 'vault.secrets.secret_sync_heal_secret missing — cron 9 will skip until set';
  END IF;
END$check$;

DO $schedule$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'secret-sync-heal-30min') THEN
    PERFORM cron.schedule(
      'secret-sync-heal-30min',
      '*/30 * * * *',
      $cmd$
DO $do$
DECLARE v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'secret_sync_heal_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RAISE WARNING 'secret_sync_heal_secret missing from vault — skip secret-sync';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := 'https://secret-sync.thecuong.workers.dev/heal',
    headers := jsonb_build_object('Content-Type','application/json','X-Heal-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
END
$do$;
      $cmd$
    );
  END IF;
END$schedule$;
