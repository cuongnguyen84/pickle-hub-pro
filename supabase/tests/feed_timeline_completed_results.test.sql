BEGIN;

SELECT plan(9);

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

-- Completed, but played in the future: must stay off the feed even though
-- it is already verified. The backfill row was inserted last and would
-- have led the old verify-time order.
INSERT INTO public.matches (
  id, slug, format, match_type, played_at, team_a_score, team_b_score,
  winning_team, verification_status, verified_at, is_public, recorded_by,
  source_provider, external_match_id, tournament_name, updated_at, created_at
) VALUES
  (
    '00000000-0000-0000-0000-00000000a005', 'feed-future-verified', 'doubles', 'tournament',
    NOW() + INTERVAL '2 hours', ARRAY[11], ARRAY[7], 'a', 'verified', NOW(), TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-future-verified',
    'Feed future verified', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-00000000a006', 'feed-backfill-nations', 'doubles', 'tournament',
    NOW() - INTERVAL '5 days', ARRAY[11], ARRAY[6], 'b', 'verified', NOW(), TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-backfill-nations',
    'MLP Nations Cup', NOW(), NOW()
  ),
  (
    '00000000-0000-0000-0000-00000000a007', 'feed-tie-newer-insert', 'doubles', 'tournament',
    NOW() - INTERVAL '3 days', ARRAY[11], ARRAY[4], 'a', 'verified', NOW() - INTERVAL '3 days', TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-tie-newer-insert',
    'Feed tie', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 hour'
  ),
  (
    '00000000-0000-0000-0000-00000000a008', 'feed-tie-older-insert', 'doubles', 'tournament',
    NOW() - INTERVAL '3 days', ARRAY[11], ARRAY[3], 'a', 'verified', NOW() - INTERVAL '3 days', TRUE,
    '00000000-0000-0000-0000-00000000f003', 'mlp', 'feed-tie-older-insert',
    'Feed tie', NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 hours'
  ),
  (
    '00000000-0000-0000-0000-00000000a009', 'feed-tie-id-low', 'doubles', 'tournament',
    NOW() - INTERVAL '4 days', ARRAY[11], ARRAY[2], 'a', 'verified', NOW() - INTERVAL '4 days', TRUE,
    '00000000-0000-0000-0000-00000000f003', 'ppa_tour', 'feed-tie-id-low',
    'Feed id tie', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day'
  ),
  (
    '00000000-0000-0000-0000-00000000a010', 'feed-tie-id-high', 'doubles', 'tournament',
    NOW() - INTERVAL '4 days', ARRAY[11], ARRAY[1], 'b', 'verified', NOW() - INTERVAL '4 days', TRUE,
    '00000000-0000-0000-0000-00000000f003', 'ppa_tour', 'feed-tie-id-high',
    'Feed id tie', NOW() - INTERVAL '4 days', NOW() - INTERVAL '1 day'
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
  (SELECT score FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a004')
    >
  (SELECT score FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a003'),
  'the more recently played pro result ranks ahead of one verified later'
);

SELECT is(
  (SELECT COUNT(*) FROM feed_result_rows WHERE item_id = '00000000-0000-0000-0000-00000000a005'),
  0::BIGINT,
  'a verified match played in the future is excluded'
);

SELECT is(
  (
    SELECT COUNT(*) FROM public.get_feed_recent_results(24)
    WHERE item_id = '00000000-0000-0000-0000-00000000a005'
  ),
  0::BIGINT,
  'recent results omit a match with played_at in the future'
);

SELECT is(
  (
    SELECT ranked_at FROM public.get_feed_recent_results(24)
    WHERE item_id = '00000000-0000-0000-0000-00000000a004'
  ),
  (SELECT played_at FROM public.matches WHERE id = '00000000-0000-0000-0000-00000000a004'),
  'pro result ranked_at is played_at, not the insert clock'
);

SELECT is(
  (
    SELECT array_agg(item_id ORDER BY ordinality)
    FROM public.get_feed_recent_results(24) WITH ORDINALITY
    WHERE item_id IN (
      '00000000-0000-0000-0000-00000000a003',
      '00000000-0000-0000-0000-00000000a004',
      '00000000-0000-0000-0000-00000000a006',
      '00000000-0000-0000-0000-00000000a007',
      '00000000-0000-0000-0000-00000000a008',
      '00000000-0000-0000-0000-00000000a009',
      '00000000-0000-0000-0000-00000000a010'
    )
  ),
  ARRAY[
    '00000000-0000-0000-0000-00000000a004',
    '00000000-0000-0000-0000-00000000a003',
    '00000000-0000-0000-0000-00000000a007',
    '00000000-0000-0000-0000-00000000a008',
    '00000000-0000-0000-0000-00000000a010',
    '00000000-0000-0000-0000-00000000a009',
    '00000000-0000-0000-0000-00000000a006'
  ]::uuid[],
  'recent results order by played_at, then created_at, then id'
);

SELECT * FROM finish();

ROLLBACK;
