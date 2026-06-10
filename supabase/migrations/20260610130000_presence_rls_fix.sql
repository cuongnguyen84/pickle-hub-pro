-- Corrective for 20260610110000 (applied same day).
--
-- That migration revoked SELECT from anon/authenticated to stop them reading the
-- full presence table. But the client heartbeat is an upsert
-- (INSERT ... ON CONFLICT (session_id) DO UPDATE), and PostgreSQL requires SELECT
-- privilege to read the conflicting row for the DO UPDATE branch. Revoking SELECT
-- therefore broke ALL heartbeat writes (anon + authenticated) with
-- "permission denied for table presence_heartbeats". Verified by simulating the
-- exact upsert under SET ROLE anon.
--
-- Fix: restore SELECT/INSERT/UPDATE so the upsert works again. We KEEP the one
-- safe win from the previous migration — DELETE stays revoked (no policy + no
-- grant), so a client can no longer wipe other sessions' rows.
--
-- Remaining exposure (documented, NOT fixed here): anon/authenticated can still
-- SELECT the presence table (who's online + page_path). Properly closing that
-- requires moving the write behind a SECURITY DEFINER RPC (e.g. record_heartbeat)
-- and revoking all direct table access — a client change tracked as follow-up.

DROP POLICY IF EXISTS "presence_insert" ON public.presence_heartbeats;
DROP POLICY IF EXISTS "presence_update" ON public.presence_heartbeats;
DROP POLICY IF EXISTS "presence_select" ON public.presence_heartbeats;

-- DELETE intentionally NOT granted; TRUNCATE/REFERENCES/TRIGGER stay revoked.
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.presence_heartbeats FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.presence_heartbeats TO anon, authenticated;

CREATE POLICY "presence_select" ON public.presence_heartbeats
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "presence_insert" ON public.presence_heartbeats
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "presence_update" ON public.presence_heartbeats
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
-- No DELETE policy: deletion is denied for anon/authenticated.

COMMENT ON TABLE public.presence_heartbeats IS
  'Online-presence heartbeats (client upsert by session_id). anon/authenticated: SELECT/INSERT/UPDATE only, DELETE denied. Read aggregate via get_online_now(). NOTE: direct SELECT still open — lock down via a record_heartbeat RPC follow-up. RLS revised 2026-06-10.';
