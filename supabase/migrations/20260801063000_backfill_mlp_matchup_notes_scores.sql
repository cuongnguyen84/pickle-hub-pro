-- Repair MLP notes captured while fixtures were still pending. The canonical
-- score arrays and winning_team were refreshed when results arrived, but the
-- card-specific notes JSON stayed at 0-0 and sometimes omitted Dreambreaker.
WITH resolved_mlp AS (
  SELECT
    m.id,
    m.notes::jsonb AS note,
    m.team_a_score,
    m.team_b_score,
    GREATEST(
      COALESCE(array_length(m.team_a_score, 1), 0),
      COALESCE(array_length(m.team_b_score, 1), 0),
      COALESCE(jsonb_array_length(m.notes::jsonb -> 'games'), 0)
    ) AS game_count,
    (
      SELECT COUNT(*)
      FROM generate_subscripts(m.team_a_score, 1) AS game(i)
      WHERE m.team_a_score[game.i] > COALESCE(m.team_b_score[game.i], 0)
    ) AS team_a_wins,
    (
      SELECT COUNT(*)
      FROM generate_subscripts(m.team_b_score, 1) AS game(i)
      WHERE m.team_b_score[game.i] > COALESCE(m.team_a_score[game.i], 0)
    ) AS team_b_wins
  FROM public.matches m
  WHERE m.source_provider = 'mlp'
    AND m.winning_team IS NOT NULL
    AND m.notes IS NOT NULL
    AND m.notes::jsonb ->> 'format' = 'mlp_team_matchup'
),
rebuilt AS (
  SELECT
    r.id,
    jsonb_set(
      jsonb_set(
        jsonb_set(r.note, '{team_a,matchup_wins}', to_jsonb(r.team_a_wins), true),
        '{team_b,matchup_wins}', to_jsonb(r.team_b_wins), true
      ),
      '{games}',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  COALESCE(
                    r.note -> 'games' -> (game.i - 1),
                    jsonb_build_object(
                      'label', (ARRAY['WD', 'MD', 'MXD1', 'MXD2', 'DB'])[game.i],
                      'players_a', '[]'::jsonb,
                      'players_b', '[]'::jsonb
                    )
                  ),
                  '{score_a}', to_jsonb(COALESCE(r.team_a_score[game.i], 0)), true
                ),
                '{score_b}', to_jsonb(COALESCE(r.team_b_score[game.i], 0)), true
              ),
              '{winner}',
              CASE
                WHEN COALESCE(r.team_a_score[game.i], 0) > COALESCE(r.team_b_score[game.i], 0)
                  THEN '"a"'::jsonb
                WHEN COALESCE(r.team_b_score[game.i], 0) > COALESCE(r.team_a_score[game.i], 0)
                  THEN '"b"'::jsonb
                ELSE 'null'::jsonb
              END,
              true
            )
            ORDER BY game.i
          )
          FROM generate_series(1, r.game_count) AS game(i)
        ),
        '[]'::jsonb
      ),
      true
    )::text AS repaired_notes
  FROM resolved_mlp r
)
UPDATE public.matches m
SET notes = rebuilt.repaired_notes
FROM rebuilt
WHERE m.id = rebuilt.id
  AND m.notes IS DISTINCT FROM rebuilt.repaired_notes;
