-- Audit fix 2026-06-10 — tighten presence_heartbeats RLS.
--
-- Before: a single `FOR ALL USING(true) WITH CHECK(true)` policy + GRANT ALL to
-- anon/authenticated. That let ANY client SELECT the full presence table (who is
-- online, their user_id, current page_path = user activity tracking) and
-- UPDATE/DELETE arbitrary sessions.
--
-- Constraint: heartbeats are upserted by a client-generated `session_id` for BOTH
-- anonymous (user_id = NULL) and logged-in users (src/hooks/usePresenceHeartbeat.ts),
-- so writes cannot be cryptographically scoped to the caller. What we CAN do
-- safely without breaking the heartbeat:
--   * remove all SELECT exposure  -> reads go only through get_online_now()
--     (SECURITY DEFINER, bypasses RLS), so the admin dashboard still works.
--   * remove DELETE -> nobody can wipe other sessions.
--   * keep INSERT + UPDATE so the upsert (INSERT ... ON CONFLICT DO UPDATE) works.
-- Residual (low): a client could still UPDATE another session if it guesses that
-- session's random id. Acceptable vs. the prior full read/delete exposure.

DROP POLICY IF EXISTS "presence_upsert_own" ON public.presence_heartbeats;

-- No SELECT / DELETE policy is intentional: with RLS enabled and no such policy,
-- non-admin SELECT/DELETE return zero rows / are denied.
REVOKE SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.presence_heartbeats FROM anon, authenticated;
GRANT INSERT, UPDATE ON TABLE public.presence_heartbeats TO anon, authenticated;

CREATE POLICY "presence_insert" ON public.presence_heartbeats
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "presence_update" ON public.presence_heartbeats
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.presence_heartbeats IS
  'Online-presence heartbeats. Upsert-only for anon/authenticated (no SELECT/DELETE). Read aggregate online count via get_online_now() (SECURITY DEFINER). RLS hardened 2026-06-10.';
