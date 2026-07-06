-- ============================================================================
-- SECURITY M1 (2026-07-06): close direct read of presence_heartbeats
-- ----------------------------------------------------------------------------
-- presence_heartbeats had SELECT/INSERT/UPDATE granted to anon+authenticated
-- with policies USING(true), because the client heartbeat was a direct upsert
-- (INSERT ... ON CONFLICT DO UPDATE) which needs SELECT on the conflict row.
-- Side effect: anyone could `select * from presence_heartbeats` and scrape the
-- whole online-presence table (who is online + which page_path they are on).
--
-- Fix: move the write behind a SECURITY DEFINER RPC (record_heartbeat) so the
-- client no longer needs any direct table privilege, then revoke direct
-- SELECT/INSERT/UPDATE. Reads already go through the aggregate get_online_now()
-- (SECURITY DEFINER, returns only a count).
--
-- Phasing (applied via Management API): the CREATE FUNCTION runs first
-- (additive), the frontend deploys to call the RPC, THEN the REVOKE runs — so
-- the currently-deployed client (direct upsert) is not broken mid-deploy.
-- ============================================================================

-- ─── 1. Heartbeat writer RPC (additive) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_heartbeat(
  p_session_id TEXT,
  p_page_path  TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_session_id IS NULL OR length(p_session_id) = 0 OR length(p_session_id) > 100 THEN
    RETURN; -- ignore malformed session ids
  END IF;
  INSERT INTO public.presence_heartbeats (session_id, user_id, last_seen_at, page_path)
  VALUES (p_session_id, auth.uid(), now(), left(coalesce(p_page_path, ''), 300))
  ON CONFLICT (session_id) DO UPDATE
    SET user_id      = EXCLUDED.user_id,
        last_seen_at = now(),
        page_path    = EXCLUDED.page_path;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_heartbeat(TEXT, TEXT) TO anon, authenticated;

-- ─── 2. Lock down direct table access (run AFTER frontend deploy) ────────────
REVOKE SELECT, INSERT, UPDATE ON public.presence_heartbeats FROM anon, authenticated;
DROP POLICY IF EXISTS "presence_select" ON public.presence_heartbeats;
DROP POLICY IF EXISTS "presence_insert" ON public.presence_heartbeats;
DROP POLICY IF EXISTS "presence_update" ON public.presence_heartbeats;

COMMENT ON TABLE public.presence_heartbeats IS
  'Online-presence heartbeats. Writes go through record_heartbeat() (SECURITY DEFINER); reads via get_online_now() aggregate. Direct anon/authenticated table access revoked 2026-07-06 (M1).';

NOTIFY pgrst, 'reload schema';
