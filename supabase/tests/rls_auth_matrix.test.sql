-- QA-03 — RLS/auth matrix.
-- Blanket guarantees (every policied table actually enforces RLS, every
-- sensitive table has RLS on) plus behavioral probes for the highest-value
-- escalation paths: role self-grant, cross-user profile writes, api_keys.
-- Convention notes: this pgTAP build lacks the *_policy helpers — assert
-- against pg_policies/pg_tables catalogs instead (see notification_insert_rls).

BEGIN;

SELECT plan(19);

-- ─── Blanket matrix ─────────────────────────────────────────────────────────

-- A policy on a table with RLS disabled is dead config that reads as
-- protection while enforcing nothing.
SELECT is(
  (
    SELECT COUNT(*)::int
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND NOT t.rowsecurity
      AND EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.tablename = t.tablename
      )
  ),
  0,
  'no public table carries policies while RLS is disabled'
);

SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_roles'), 'RLS enabled on user_roles');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles'), 'RLS enabled on profiles');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'event_registrations'), 'RLS enabled on event_registrations');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'notifications'), 'RLS enabled on notifications');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'chat_messages'), 'RLS enabled on chat_messages');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'payment_orders'), 'RLS enabled on payment_orders');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'api_keys'), 'RLS enabled on api_keys');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'livestreams'), 'RLS enabled on livestreams');
SELECT ok((SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'social_events'), 'RLS enabled on social_events');

-- ─── Fixture: two users (handle_new_user trigger seeds profiles + viewer) ──

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '0a030001-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'qa03-user-a@thepicklehub.test', '', NOW(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"QA03 User A"}'::jsonb, NOW(), NOW()
  ),
  (
    '0a030002-0000-4000-8000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'qa03-user-b@thepicklehub.test', '', NOW(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"QA03 User B"}'::jsonb, NOW(), NOW()
  );

SELECT is(
  (SELECT role::text FROM public.user_roles WHERE user_id = '0a030001-0000-4000-8000-000000000001'::uuid),
  'viewer',
  'fixture user is seeded as viewer by the signup trigger'
);

-- ─── Probes as authenticated user A ─────────────────────────────────────────

-- The disposable local db lacks the platform's table grants, and the probes
-- must prove RLS holds even when grants are wide (same rationale as
-- notification_insert_rls.test.sql). Rolled back with the transaction.
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT INSERT ON public.api_keys TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '0a030001-0000-4000-8000-000000000001', true);
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"0a030001-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

-- Positive control FIRST: if the role/JWT plumbing above were broken,
-- auth.uid() would be NULL, this own-row update would touch 0 rows, and the
-- assertion below would fail — proving the deny probes fail for the right
-- reason and not because the harness never authenticated.
UPDATE public.profiles SET display_name = 'QA03 Self Updated'
WHERE id = '0a030001-0000-4000-8000-000000000001'::uuid;

-- user_roles writes are admin-only (policy "Admins can manage all roles");
-- a viewer self-granting admin must fail loudly...
SELECT throws_ok(
  $$INSERT INTO public.user_roles (user_id, role)
    VALUES ('0a030001-0000-4000-8000-000000000001'::uuid, 'admin')$$,
  '42501',
  NULL,
  'authenticated user cannot INSERT an admin role for themselves'
);

-- ...while UPDATE/DELETE are silently filtered to 0 rows by RLS (verified
-- against the catalog after RESET ROLE below).
UPDATE public.user_roles SET role = 'admin'
WHERE user_id = '0a030001-0000-4000-8000-000000000001'::uuid;
DELETE FROM public.user_roles
WHERE user_id = '0a030001-0000-4000-8000-000000000001'::uuid;

-- Cross-user profile write must not stick.
UPDATE public.profiles SET display_name = 'QA03 Hacked B'
WHERE id = '0a030002-0000-4000-8000-000000000002'::uuid;

-- api_keys is admin-only in every direction.
SELECT throws_ok(
  $$INSERT INTO public.api_keys (name, key_hash, key_prefix)
    VALUES ('qa03', 'x', 'qa03_')$$,
  '42501',
  NULL,
  'authenticated non-admin cannot INSERT into api_keys'
);

RESET ROLE;

-- ─── Verify what actually stuck ─────────────────────────────────────────────

SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '0a030001-0000-4000-8000-000000000001'::uuid),
  'QA03 Self Updated',
  'positive control: a user CAN update their own profile'
);

SELECT is(
  (SELECT role::text FROM public.user_roles WHERE user_id = '0a030001-0000-4000-8000-000000000001'::uuid),
  'viewer',
  'self role UPDATE to admin did not stick (RLS filtered 0 rows)'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.user_roles WHERE user_id = '0a030001-0000-4000-8000-000000000001'::uuid),
  1,
  'self role DELETE did not stick'
);

SELECT is(
  (SELECT display_name FROM public.profiles WHERE id = '0a030002-0000-4000-8000-000000000002'::uuid),
  'QA03 User B',
  'cross-user profile UPDATE did not stick'
);

-- ─── Policy presence for admin-gated api_keys reads ─────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'api_keys'
      AND policyname = 'Admins can view all api_keys'
  ),
  'api_keys SELECT stays behind the admin-only policy'
);

-- user_roles carries exactly two policies: "Admins can manage all roles"
-- (ALL, is_admin()) and "Users can view their own roles" (SELECT). Any new
-- write policy here is a privilege-escalation surface and must be reviewed.
SELECT is(
  (
    SELECT COUNT(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_roles'
      AND cmd <> 'SELECT'
      AND policyname <> 'Admins can manage all roles'
  ),
  0,
  'the only write policy on user_roles is the admin-gated one'
);

SELECT * FROM finish();
ROLLBACK;
