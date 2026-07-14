BEGIN;

SELECT plan(10);

SELECT has_function(
  'public',
  'feed_event_milestone_candidates',
  ARRAY['integer'],
  'event milestone aggregate exists'
);

SELECT has_function(
  'public',
  'feed_dupr_band_crossings',
  ARRAY['timestamp with time zone', 'numeric'],
  'DUPR band crossing aggregate exists'
);

SELECT has_function(
  'public',
  'feed_dupr_weekly_climbers',
  ARRAY['timestamp with time zone', 'integer'],
  'DUPR weekly climber aggregate exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.feed_event_milestone_candidates(integer)',
    'EXECUTE'
  ),
  'anon cannot execute the event milestone aggregate'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.feed_dupr_band_crossings(timestamp with time zone, numeric)',
    'EXECUTE'
  ),
  'authenticated users cannot execute the DUPR crossing aggregate'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.feed_dupr_weekly_climbers(timestamp with time zone, integer)',
    'EXECUTE'
  ),
  'service_role can execute the weekly climber aggregate'
);

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
  '00000000-0000-0000-0000-00000000f002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'hot02-fixture@thepicklehub.test',
  '',
  NOW(),
  '{"provider":"test","providers":["test"]}'::jsonb,
  '{"display_name":"HOT-02 Fixture"}'::jsonb,
  NOW(),
  NOW()
);

UPDATE public.profiles
SET display_name = 'HOT-02 Fixture',
    is_public_profile = true
WHERE id = '00000000-0000-0000-0000-00000000f002';

-- Avoid unrelated badge and notification side effects while seeding the
-- regression fixture. ROLLBACK restores trigger state and all fixture rows.
ALTER TABLE public.event_registrations DISABLE TRIGGER USER;

INSERT INTO public.social_events (
  slug,
  title_vi,
  start_at,
  end_at,
  created_by
)
SELECT
  'hot02-fixture-' || n,
  'HOT-02 Fixture ' || n,
  NOW() + (n || ' days')::interval,
  NOW() + (n || ' days')::interval + INTERVAL '2 hours',
  '00000000-0000-0000-0000-00000000f002'
FROM generate_series(1, 1001) AS fixture(n);

INSERT INTO public.event_registrations (
  event_id,
  profile_id,
  display_name,
  status
)
SELECT
  e.id,
  '00000000-0000-0000-0000-00000000f002',
  'HOT-02 Fixture',
  'registered'
FROM public.social_events AS e
WHERE e.slug LIKE 'hot02-fixture-%';

INSERT INTO public.dupr_rating_history (
  profile_id,
  dupr_doubles,
  recorded_at
)
SELECT
  '00000000-0000-0000-0000-00000000f002',
  CASE WHEN n = 1001 THEN 3.60 ELSE 2.90 END,
  NOW() - INTERVAL '2 hours' + (n || ' seconds')::interval
FROM generate_series(1, 1001) AS fixture(n);

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.event_registrations
    WHERE profile_id = '00000000-0000-0000-0000-00000000f002'
  ),
  1001::BIGINT,
  'event registration fixture exceeds the PostgREST 1,000-row cap'
);

SELECT is(
  (
    SELECT registration_count
    FROM public.feed_event_milestone_candidates(5)
    WHERE profile_id = '00000000-0000-0000-0000-00000000f002'
  ),
  1001::BIGINT,
  'event milestone aggregate counts every fixture row'
);

SELECT is(
  (
    SELECT reached_band
    FROM public.feed_dupr_band_crossings(NOW() - INTERVAL '1 day', 3.0)
    WHERE profile_id = '00000000-0000-0000-0000-00000000f002'
  ),
  3.5::NUMERIC,
  'DUPR crossing after row 1,000 is detected'
);

SELECT results_eq(
  $$
    SELECT rating_delta, current_rating
    FROM public.feed_dupr_weekly_climbers(NOW() - INTERVAL '1 day', 5)
    WHERE profile_id = '00000000-0000-0000-0000-00000000f002'
  $$,
  $$VALUES (0.70::NUMERIC, 3.60::NUMERIC)$$,
  'weekly climber aggregate uses the first and last rows across the full fixture'
);

SELECT * FROM finish();
ROLLBACK;
