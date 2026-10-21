-- internal_note must be unreadable by the applicant AT THE TABLE, not just
-- absent from the view they are supposed to use. CP27 case 6c proved the
-- production UI was clean while the REST surface leaked; these assertions pin
-- the grant layer itself, so a future "GRANT SELECT ON shop_applications TO
-- authenticated" (the one-liner that reopens the hole) turns this file red.

BEGIN;

SELECT plan(10);

-- ─── Fixture: applicant A (pilot), admin D, one application with a note ─────

INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000000', '50020001-0000-4000-8000-000000000001'::uuid,
   'authenticated', 'authenticated', 'note-priv-a@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000000', '50020004-0000-4000-8000-000000000004'::uuid,
   'authenticated', 'authenticated', 'note-priv-admin@thepicklehub.test', '', NOW(),
   '{"provider":"test","providers":["test"]}'::jsonb, '{}'::jsonb, NOW(), NOW());

INSERT INTO public.user_roles (user_id, role)
VALUES ('50020004-0000-4000-8000-000000000004'::uuid, 'admin')
ON CONFLICT DO NOTHING;

-- A verified factor, so is_admin()'s aal enforcement is ACTIVE for this admin
-- (it self-activates per user; without a factor, aal1 would still be admin
-- and the aal1 assertion below would measure nothing).
INSERT INTO auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
VALUES ('50020008-0000-4000-8000-000000000008'::uuid, '50020004-0000-4000-8000-000000000004'::uuid,
        'test-totp', 'totp', 'verified', NOW(), NOW(), 'JBSWY3DPEHPK3PXP');

INSERT INTO public.shop_pilot_members (user_id)
VALUES ('50020001-0000-4000-8000-000000000001'::uuid);

INSERT INTO public.shop_applications (applicant_user_id, seller_type, full_name, phone, shop_name, city)
VALUES ('50020001-0000-4000-8000-000000000001'::uuid, 'ca-nhan', 'Nguyen Note', '0900000001', 'Shop Note', 'Ha Noi');

SELECT set_config('shop.privileged_write', 'on', true);
UPDATE public.shop_applications
SET internal_note = 'pgTAP internal only'
WHERE applicant_user_id = '50020001-0000-4000-8000-000000000001'::uuid;
SELECT set_config('shop.privileged_write', 'off', true);

-- ─── The grant layer itself ─────────────────────────────────────────────────

SELECT is(
  has_column_privilege('authenticated', 'public.shop_applications', 'internal_note', 'SELECT'),
  false,
  'authenticated holds NO select privilege on internal_note'
);
SELECT is(
  has_column_privilege('authenticated', 'public.shop_applications', 'applicant_note', 'SELECT'),
  true,
  'the applicant-facing note column is still granted'
);

-- ─── The applicant, at the surfaces a JWT can reach ─────────────────────────

SET LOCAL role authenticated;
SET LOCAL request.jwt.claims TO '{"sub":"50020001-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

SELECT throws_ok(
  $$ SELECT internal_note FROM public.shop_applications $$,
  '42501',
  NULL,
  'the applicant asking the TABLE for internal_note is refused outright'
);
SELECT throws_ok(
  $$ SELECT * FROM public.shop_applications $$,
  '42501',
  NULL,
  'select=* on the table dies with the column, instead of carrying it'
);
SELECT is(
  (SELECT count(*)::int FROM public.my_shop_application),
  1,
  'the applicant still reads their application through the view'
);
SELECT is(
  (SELECT shop_name FROM public.my_shop_application),
  'Shop Note',
  'and the view answers with their own row'
);
SELECT is(
  (SELECT count(*)::int FROM public.shop_applications_admin),
  0,
  'the admin view answers a non-admin with zero rows, not an error'
);

-- ─── The moderator still sees the note, aal2 required ───────────────────────

SET LOCAL request.jwt.claims TO '{"sub":"50020004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}';

SELECT is(
  (SELECT internal_note FROM public.shop_applications_admin
   WHERE applicant_user_id = '50020001-0000-4000-8000-000000000001'::uuid),
  'pgTAP internal only',
  'the admin reads internal_note through the admin view'
);

-- aal1 admin is not an admin: is_admin() requires the verified factor level.
SET LOCAL request.jwt.claims TO '{"sub":"50020004-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
SELECT is(
  (SELECT count(*)::int FROM public.shop_applications_admin),
  0,
  'an admin stuck at aal1 gets zero rows from the admin view'
);

-- anon never sees the admin view at all.
SET LOCAL role anon;
SELECT throws_ok(
  $$ SELECT count(*) FROM public.shop_applications_admin $$,
  '42501',
  NULL,
  'anon has no privilege on the admin view'
);

SELECT * FROM finish();
ROLLBACK;
