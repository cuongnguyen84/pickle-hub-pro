-- ============================================================================
-- Make team_match_games slot creation atomic — UNIQUE (match_id, order_index).
-- ============================================================================
-- Codex review 2026-07-21: ARCH-03 (#422) fixed the seat-clobber race at the
-- third-place / next match, but createGamesIfMissing (src/lib/teamMatchAdvancement.ts)
-- is itself a check-then-insert: it bails if any game exists, else inserts the
-- full set. Two propagations can reach the same just-filled match at once (both
-- semifinals resolving together, or a re-scored playoff), both read zero games,
-- and both insert — with no uniqueness on (match_id, order_index) the table
-- accepted duplicate slots. The ARCH-03 race test verified guarded seating,
-- never atomic game creation, so it stayed green.
--
-- Prod pre-flight (2026-07-21): 0 existing duplicate (match_id, order_index)
-- pairs across 114 rows, so the constraint applies cleanly. Paired with an
-- ignore-duplicates upsert in createGamesIfMissing, the second concurrent
-- creator now no-ops at the DB instead of doubling the game list.
-- ============================================================================

ALTER TABLE public.team_match_games
  ADD CONSTRAINT team_match_games_match_slot_key UNIQUE (match_id, order_index);
