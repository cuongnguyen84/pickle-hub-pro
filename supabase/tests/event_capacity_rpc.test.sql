-- DB-01 regression: atomic event/slot capacity RPCs.
-- The race itself (two concurrent transactions) cannot run inside one pgTAP
-- transaction; these tests pin the functional contract every interleaving
-- reduces to under the advisory lock: capacity is checked and consumed in the
-- same transaction, so the "full" answer and the write can never disagree.

BEGIN;

SELECT plan(18);

SELECT has_function(
  'public',
  'social_event_reactivate_registration',
  ARRAY['uuid'],
  'reactivate capacity RPC exists'
);

SELECT has_function(
  'public',
  'social_event_guest_register',
  ARRAY['uuid', 'uuid', 'text', 'text', 'numeric', 'text', 'text', 'integer'],
  'guest register capacity RPC exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.social_event_reactivate_registration(uuid)',
    'EXECUTE'
  ),
  'anon cannot execute the reactivate RPC'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.social_event_guest_register(uuid, uuid, text, text, numeric, text, text, integer)',
    'EXECUTE'
  ),
  'authenticated cannot execute the guest register RPC'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.social_event_reactivate_registration(uuid)',
    'EXECUTE'
  ),
  'service_role can execute the reactivate RPC'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.social_event_guest_register(uuid, uuid, text, text, numeric, text, text, integer)',
    'EXECUTE'
  ),
  'service_role can execute the guest register RPC'
);

-- ─── Fixture ────────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-00000000f003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'db01-fixture@thepicklehub.test',
  '',
  NOW(),
  '{"provider":"test","providers":["test"]}'::jsonb,
  '{"display_name":"DB-01 Fixture"}'::jsonb,
  NOW(),
  NOW()
);

-- Avoid unrelated badge/notification side effects while seeding.
ALTER TABLE public.event_registrations DISABLE TRIGGER USER;

INSERT INTO public.social_events (
  id, slug, title_vi, start_at, end_at, created_by, max_players
) VALUES
  (
    '00000000-0000-0000-0000-0000db01e001',
    'db01-capacity-two',
    'DB-01 Capacity 2',
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day 2 hours',
    '00000000-0000-0000-0000-00000000f003',
    2
  ),
  (
    '00000000-0000-0000-0000-0000db01e002',
    'db01-capacity-ten',
    'DB-01 Capacity 10',
    NOW() + INTERVAL '2 days',
    NOW() + INTERVAL '2 days 2 hours',
    '00000000-0000-0000-0000-00000000f003',
    10
  );

INSERT INTO public.event_registrations (event_id, phone, display_name, status)
VALUES ('00000000-0000-0000-0000-0000db01e001', '+84900000001', 'Seed 1', 'registered');

-- ─── Guest register: event capacity ─────────────────────────────────────────

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01e001', NULL, '+84900000002', 'Guest 2',
    NULL, 'unpaid', NULL, NULL)),
  'registered',
  'second registration on a 2-cap event succeeds'
);

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01e001', NULL, '+84900000003', 'Guest 3',
    NULL, 'unpaid', NULL, NULL)),
  'event_full',
  'third registration on a 2-cap event is rejected'
);

SELECT is(
  (SELECT COUNT(*)::int FROM public.event_registrations
   WHERE event_id = '00000000-0000-0000-0000-0000db01e001'
     AND status <> 'cancelled'),
  2,
  'a full event holds exactly max_players active registrations'
);

-- ─── Guest register: duplicate + slot capacity ──────────────────────────────

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01e002', NULL, '+84900000004', 'Guest 4',
    NULL, 'unpaid', NULL, NULL)),
  'registered',
  'registration on an open event succeeds'
);

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01e002', NULL, '+84900000004', 'Guest 4 again',
    NULL, 'unpaid', NULL, NULL)),
  'already_registered',
  'same phone re-registering maps the unique violation to already_registered'
);

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01e002', NULL, '+84900000005', 'Guest 5',
    NULL, 'unpaid', 'slot-1', 1)),
  'registered',
  'first registration into a 1-cap slot succeeds'
);

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01e002', NULL, '+84900000006', 'Guest 6',
    NULL, 'unpaid', 'slot-1', 1)),
  'slot_full',
  'second registration into a 1-cap slot is rejected'
);

SELECT is(
  (SELECT outcome FROM public.social_event_guest_register(
    '00000000-0000-0000-0000-0000db01dead', NULL, '+84900000009', 'Ghost event',
    NULL, 'unpaid', NULL, NULL)),
  'event_missing',
  'unknown event id returns event_missing'
);

-- ─── Reactivate ─────────────────────────────────────────────────────────────

INSERT INTO public.event_registrations (
  id, event_id, phone, display_name, status, cancelled_at, cancelled_reason
) VALUES (
  '00000000-0000-0000-0000-0000db01a001',
  '00000000-0000-0000-0000-0000db01e001',
  '+84900000007',
  'Cancelled 7',
  'cancelled',
  NOW(),
  'test'
);

SELECT is(
  public.social_event_reactivate_registration('00000000-0000-0000-0000-0000db01a001'),
  'event_full',
  'reactivation into a full event is rejected'
);

UPDATE public.social_events
SET max_players = 3
WHERE id = '00000000-0000-0000-0000-0000db01e001';

SELECT is(
  public.social_event_reactivate_registration('00000000-0000-0000-0000-0000db01a001'),
  'reactivated',
  'reactivation succeeds once capacity is available'
);

SELECT is(
  public.social_event_reactivate_registration('00000000-0000-0000-0000-0000db01a001'),
  'already_active',
  'reactivating an active registration is an idempotent no-op'
);

SELECT is(
  public.social_event_reactivate_registration('00000000-0000-0000-0000-0000db01dead'),
  'not_found',
  'unknown registration id returns not_found'
);

SELECT * FROM finish();

ROLLBACK;
