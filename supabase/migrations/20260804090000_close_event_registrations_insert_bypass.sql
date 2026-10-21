-- Close the direct-INSERT bypass on event_registrations (P1, audit 2026-08-04).
--
-- 20260511130000 granted table-level INSERT to authenticated and
-- 20260511120000 added the permissive "event_registrations_insert_self"
-- policy (WITH CHECK profile_id = auth.uid() — no predicate on
-- payment_status). Every legitimate write path has since moved behind
-- SECURITY DEFINER RPCs (register_event_as_member, add_walk_in_registration)
-- or service_role edge functions (phone-otp-verify, reactivate-registration);
-- no web or native client calls .insert() on this table. The only remaining
-- consumer of the grant+policies was a direct PostgREST INSERT forging
-- payment_status='paid' and skipping the DB-01 capacity advisory lock.
--
-- Both INSERT policies go, not just insert_self: a policy left behind with
-- no matching grant reads as "missing grant" to a future grants sweep
-- (pg_policies × has_table_privilege) and invites the grant — and the hole —
-- back. Organizer manual adds have used the add_walk_in_registration RPC
-- since 20260512120000.
--
-- SELECT (anon+authenticated) and UPDATE/DELETE (authenticated) grants are
-- untouched — the web roster admin UI and the native organizer screens
-- update status/payment via .update() under their own policies.
--
-- Rollback: re-CREATE the two policies (20260511120000:301, 20260511130000:93)
-- and re-GRANT INSERT — but any caller that needs that should be routed
-- through register_event_as_member instead.

DROP POLICY IF EXISTS "event_registrations_insert_self" ON public.event_registrations;
DROP POLICY IF EXISTS "event_registrations_insert_organizer" ON public.event_registrations;

REVOKE INSERT ON public.event_registrations FROM authenticated;
