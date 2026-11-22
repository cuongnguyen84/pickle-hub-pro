-- Overlay RPC returns a completed Quick Table final, and the helper that
-- builds those rows is not callable by anon.

BEGIN;

SELECT plan(6);

SELECT ok(
  has_function_privilege('anon', 'public.get_feed_recent_results(integer)', 'EXECUTE'),
  'anon can execute get_feed_recent_results'
);
SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.feed_result_rows(uuid, interval, integer)',
    'EXECUTE'
  ),
  'anon cannot execute feed_result_rows'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.feed_result_rows(uuid, interval, integer)',
    'EXECUTE'
  ),
  'authenticated cannot execute feed_result_rows'
);

INSERT INTO public.quick_tables (
  id, name, player_count, format, status, share_id, is_public, is_doubles
) VALUES
  (
    'f11d0000-0000-4000-8000-000000000001',
    'Feed final cup', 2, 'round_robin', 'completed', 'feed-qt-final', TRUE, FALSE
  ),
  (
    'f11d0000-0000-4000-8000-000000000002',
    'Feed legacy cup', 2, 'round_robin', 'completed', 'feed-qt-legacy', TRUE, FALSE
  );

INSERT INTO public.quick_table_players (id, table_id, name, display_order) VALUES
  ('f11d0000-0000-4000-8000-000000000011', 'f11d0000-0000-4000-8000-000000000001', 'Lan Pham', 1),
  ('f11d0000-0000-4000-8000-000000000012', 'f11d0000-0000-4000-8000-000000000001', 'Minh Vo', 2),
  ('f11d0000-0000-4000-8000-000000000013', 'f11d0000-0000-4000-8000-000000000002', 'Hoa Le', 1),
  ('f11d0000-0000-4000-8000-000000000014', 'f11d0000-0000-4000-8000-000000000002', 'Khoa Do', 2);

INSERT INTO public.quick_table_matches (
  id, table_id, is_playoff, bracket_position, playoff_round, playoff_division,
  player1_id, player2_id, score1, score2, winner_id, status, display_order, updated_at
) VALUES
  (
    'f11d0000-0000-4000-8000-000000000021',
    'f11d0000-0000-4000-8000-000000000001',
    TRUE, 'final', 2, 0,
    'f11d0000-0000-4000-8000-000000000011',
    'f11d0000-0000-4000-8000-000000000012',
    11, 7,
    'f11d0000-0000-4000-8000-000000000011',
    'completed', 1, NOW() - INTERVAL '1 hour'
  ),
  -- Higher round, but not the labelled final. Must not replace the final.
  (
    'f11d0000-0000-4000-8000-000000000022',
    'f11d0000-0000-4000-8000-000000000001',
    TRUE, 'upper', 9, 0,
    'f11d0000-0000-4000-8000-000000000011',
    'f11d0000-0000-4000-8000-000000000012',
    11, 1,
    'f11d0000-0000-4000-8000-000000000011',
    'completed', 2, NOW()
  ),
  -- Legacy row: bracket_position is null, so the max round is the final.
  (
    'f11d0000-0000-4000-8000-000000000023',
    'f11d0000-0000-4000-8000-000000000002',
    TRUE, NULL, 4, 0,
    'f11d0000-0000-4000-8000-000000000013',
    'f11d0000-0000-4000-8000-000000000014',
    11, 9,
    'f11d0000-0000-4000-8000-000000000014',
    'completed', 1, NOW() - INTERVAL '2 hours'
  ),
  (
    'f11d0000-0000-4000-8000-000000000024',
    'f11d0000-0000-4000-8000-000000000002',
    TRUE, NULL, 1, 0,
    'f11d0000-0000-4000-8000-000000000013',
    'f11d0000-0000-4000-8000-000000000014',
    11, 3,
    'f11d0000-0000-4000-8000-000000000013',
    'completed', 2, NOW() - INTERVAL '3 hours'
  );

SELECT is(
  (
    SELECT item_id
    FROM public.get_feed_recent_results(24)
    WHERE slug = 'feed-qt-final'
  ),
  'f11d0000-0000-4000-8000-000000000021'::uuid,
  'a labelled quick-table final is returned, not the higher round'
);

SELECT is(
  (
    SELECT winning_team
    FROM public.get_feed_recent_results(24)
    WHERE item_id = 'f11d0000-0000-4000-8000-000000000023'
  ),
  'b',
  'a legacy final uses winner_id and the max unlabelled round'
);

CREATE TEMP TABLE feed_anon_final (item_id uuid);
GRANT INSERT, SELECT ON feed_anon_final TO anon;

SET LOCAL ROLE anon;
INSERT INTO feed_anon_final
SELECT item_id
FROM public.get_feed_recent_results(24)
WHERE slug = 'feed-qt-final';
RESET ROLE;

SELECT is(
  (SELECT count(*) FROM feed_anon_final),
  1::bigint,
  'anon still receives the final through the public RPC'
);

SELECT * FROM finish();

ROLLBACK;
