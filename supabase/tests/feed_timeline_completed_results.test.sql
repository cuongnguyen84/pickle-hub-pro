BEGIN;

SELECT plan(5);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-00000000f003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'feed-result-fixture@thepicklehub.test', '', NOW(),
  '{"provider":"test","providers":["test"]}'::jsonb,
  '{"display_name":"Feed result fixture"}'::jsonb, NOW(), NOW()
);

UPDATE public.profiles
SET display_name = 'Feed result fixture'
WHERE id = '00000000-0000-0000-0000-00000000f003';

INSERT INTO public.matches (
  id, slug, format, match_type, played_at, team_a_score, team_b_score,
  winning_team, verification_status, verified_at, is_public, recorded_by,
  source_provider, external_match_id, tournament_name, updated_at
) VALUES
  (
    '00000000-0000-0000-0000-00000000a001', 'feed-future-pending', 'doubles', 'tournament',
    NOW() + INTERVAL '8 hours', ARRAY[0], ARRAY[0], NULL, 'pending', NULL, TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-future-pending',
    'Feed result regression', NOW()
  ),
  (
    '00000000-0000-0000-0000-00000000a002', 'feed-past-pending', 'doubles', 'tournament',
    NOW() - INTERVAL '1 hour', ARRAY[0], ARRAY[0], NULL, 'pending', NULL, TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-past-pending',
    'Feed result regression', NOW()
  ),
  (
    '00000000-0000-0000-0000-00000000a003', 'feed-new-result', 'doubles', 'tournament',
    NOW() - INTERVAL '1 day', ARRAY[11], ARRAY[8], 'a', 'verified', NOW() - INTERVAL '5 minutes', TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-new-result',
    'Feed result regression', NOW() - INTERVAL '5 minutes'
  ),
  (
    '00000000-0000-0000-0000-00000000a004', 'feed-older-result', 'doubles', 'tournament',
    NOW() - INTERVAL '30 minutes', ARRAY[11], ARRAY[9], 'a', 'verified', NOW() - INTERVAL '2 hours', TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-older-result',
    'Feed result regression', NOW() - INTERVAL '2 hours'
  );

CREATE TEMP TABLE feed_result_rows AS
SELECT * FROM public.get_feed_timeline(100, NULL, NULL, NULL)
WHERE item_id IN (
  '00000000-0000-0000-0000-00000000a001',
  '00000000-0000-0000-0000-00000000a002',
  '00000000-0000-0000-0000-00000000a003',
  '00000000-0000-0000-0000-00000000a004'
);

SELECT is(
  (SELECT COUNT(*) FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a001'),
  0::BIGINT,
  'future pending fixtures are excluded from the result feed'
);

SELECT is(
  (SELECT COUNT(*) FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a002'),
  0::BIGINT,
  'past matches without a winner are excluded from the result feed'
);

SELECT is(
  (SELECT COUNT(*) FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a003'),
  1::BIGINT,
  'a verified completed result is included'
);

SELECT is(
  (SELECT published_at FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a003'),
  (SELECT played_at FROM public.matches WHERE id = '00000000-0000-0000-0000-00000000a003'),
  'cards retain the actual played_at timestamp'
);

SELECT ok(
  (SELECT score FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a003')
    >
  (SELECT score FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a004'),
  'the more recently verified pro result ranks ahead of the older result'
);

SELECT * FROM finish();

ROLLBACK;
