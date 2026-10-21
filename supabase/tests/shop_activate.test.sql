-- shop_activate() — the activation button's whole contract.
--
-- The error STRINGS are asserted verbatim, not just the errcodes:
-- activateErrorMessage() on the client matches on the message text, so a
-- reworded RAISE would silently break the admin UI copy while every
-- errcode-only assertion stayed green.
--
-- Convention follows shop_phase1_rls.test.sql (fixtures as postgres,
-- SET LOCAL role + request.jwt.claims for impersonation, rolled back).

BEGIN;

SELECT plan(22);

-- ─── Fixture: admin, non-admin, one owner, five shops ───────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('50020001-0000-4000-8000-000000000001'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'activate-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Activate Admin"}'::jsonb, NOW(), NOW()),
  ('50020002-0000-4000-8000-000000000002'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'activate-user@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Plain User"}'::jsonb, NOW(), NOW()),
  ('50020003-0000-4000-8000-000000000003'::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'activate-owner@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{"display_name":"Shop Owner"}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50020001-0000-4000-8000-000000000001'::uuid, 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO public.shops (id, slug, name, state, owner_user_id) VALUES
  ('50021001-0000-4000-8000-000000000001'::uuid, 'act-pending-a', 'Pending A', 'pending_activation', '50020003-0000-4000-8000-000000000003'::uuid),
  ('50021002-0000-4000-8000-000000000002'::uuid, 'act-pending-b', 'Pending B', 'pending_activation', '50020003-0000-4000-8000-000000000003'::uuid),
  ('50021003-0000-4000-8000-000000000003'::uuid, 'act-suspended', 'Suspended C', 'suspended', '50020003-0000-4000-8000-000000000003'::uuid),
  ('50021004-0000-4000-8000-000000000004'::uuid, 'act-closed', 'Closed D', 'closed', '50020003-0000-4000-8000-000000000003'::uuid),
  ('50021005-0000-4000-8000-000000000005'::uuid, 'act-pending-e', 'Pending E', 'pending_activation', '50020003-0000-4000-8000-000000000003'::uuid);

-- ─── 1. Non-admin is refused with the exact string the client matches ───────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020002-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  $$ SELECT public.shop_activate('50021001-0000-4000-8000-000000000001'::uuid, 'gap-truc-tiep') $$,
  '42501',
  'admin_required',
  'non-admin gets admin_required'
);

RESET role;
SELECT is(
  (SELECT state::text FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'pending_activation',
  'shop untouched after refused call'
);

-- ─── 2. Admin session (aal2 — is_admin() requires it) ───────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

-- Bogus method: refused BEFORE any row is touched.
SELECT throws_ok(
  $$ SELECT public.shop_activate('50021001-0000-4000-8000-000000000001'::uuid, 'cmnd-photo') $$,
  '22023',
  'invalid_verified_method',
  'bogus verified_method gets invalid_verified_method'
);
SELECT is(
  (SELECT state::text FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'pending_activation',
  'shop unchanged after invalid method'
);

-- Happy path with 'gap-truc-tiep': state flips, verified pair set together.
SELECT is(
  public.shop_activate('50021001-0000-4000-8000-000000000001'::uuid, 'gap-truc-tiep'),
  'active',
  'admin activates a pending shop'
);
SELECT is(
  (SELECT state::text FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'active',
  'state is active'
);
SELECT is(
  (SELECT verified_method FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'gap-truc-tiep',
  'verified_method recorded'
);
SELECT ok(
  (SELECT verified_at IS NOT NULL FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'verified_at set with its method (shops_verified_pair)'
);

-- Exactly one audit row — an ambiguous log_audit_event call (42725) would
-- have aborted the activation above; zero or two rows would both be bugs.
-- audit_logs has no SELECT grant for authenticated, so the count reads as
-- postgres; the write under test already happened in the admin session.
RESET role;
SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE event_type = 'shop_activated'
     AND resource_id = '50021001-0000-4000-8000-000000000001'),
  1,
  'exactly one shop_activated audit row'
);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

-- ─── 3. Idempotent replay: no error, no overwrite, no second audit row ──────

SELECT is(
  public.shop_activate('50021001-0000-4000-8000-000000000001'::uuid, NULL),
  'active',
  'replay on an active shop returns active without error'
);
SELECT is(
  (SELECT verified_method FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'gap-truc-tiep',
  'replay with NULL does not clear the recorded method'
);
SELECT is(
  public.shop_activate('50021001-0000-4000-8000-000000000001'::uuid, 'giay-phep-kinh-doanh'),
  'active',
  'replay with a different method still succeeds'
);
SELECT is(
  (SELECT verified_method FROM public.shops WHERE id = '50021001-0000-4000-8000-000000000001'::uuid),
  'gap-truc-tiep',
  'replay does NOT overwrite the original verified_method'
);
RESET role;
SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
   WHERE event_type = 'shop_activated'
     AND resource_id = '50021001-0000-4000-8000-000000000001'),
  1,
  'replays write no additional audit rows'
);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

-- ─── 4. NULL method: activation without touching the verified pair ──────────

SELECT is(
  public.shop_activate('50021002-0000-4000-8000-000000000002'::uuid, NULL),
  'active',
  'activation with NULL method succeeds'
);
SELECT ok(
  (SELECT verified_method IS NULL AND verified_at IS NULL
   FROM public.shops WHERE id = '50021002-0000-4000-8000-000000000002'::uuid),
  'verified pair stays NULL/NULL'
);

-- ─── 5. The other accepted method ──────────────────────────────────────────

SELECT is(
  public.shop_activate('50021005-0000-4000-8000-000000000005'::uuid, 'giay-phep-kinh-doanh'),
  'active',
  'giay-phep-kinh-doanh is accepted'
);
SELECT is(
  (SELECT verified_method FROM public.shops WHERE id = '50021005-0000-4000-8000-000000000005'::uuid),
  'giay-phep-kinh-doanh',
  'giay-phep-kinh-doanh recorded'
);

-- ─── 6. Forbidden states carry the state in the error string ────────────────

SELECT throws_ok(
  $$ SELECT public.shop_activate('50021003-0000-4000-8000-000000000003'::uuid) $$,
  '22023',
  'shop_not_activatable:suspended',
  'suspended shop is not activatable'
);
SELECT throws_ok(
  $$ SELECT public.shop_activate('50021004-0000-4000-8000-000000000004'::uuid) $$,
  '22023',
  'shop_not_activatable:closed',
  'closed shop is not activatable'
);
RESET role;
SELECT ok(
  (SELECT bool_and(state::text IN ('suspended','closed')) FROM public.shops
   WHERE id IN ('50021003-0000-4000-8000-000000000003'::uuid, '50021004-0000-4000-8000-000000000004'::uuid)),
  'forbidden-state shops untouched'
);
SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';

-- ─── 7. Unknown id ─────────────────────────────────────────────────────────

SELECT throws_ok(
  $$ SELECT public.shop_activate('50029999-0000-4000-8000-000000000009'::uuid) $$,
  'P0002',
  'shop_not_found',
  'unknown shop id gets shop_not_found'
);

SELECT * FROM finish();
ROLLBACK;
