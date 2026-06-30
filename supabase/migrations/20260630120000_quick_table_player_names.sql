-- Quick Table: individual athlete names for doubles entries.
-- `name` stays the combined display label ("An & Bình") used by ALL existing
-- logic (groups, matches, standings, playoff). player1_name / player2_name carry
-- the two athletes so the referee screen can show per-player serve/receive.
-- Singles: player1_name = name, player2_name = NULL.
ALTER TABLE public.quick_table_players
  ADD COLUMN IF NOT EXISTS player1_name text,
  ADD COLUMN IF NOT EXISTS player2_name text;

COMMENT ON COLUMN public.quick_table_players.player1_name IS 'First athlete name (doubles or singles).';
COMMENT ON COLUMN public.quick_table_players.player2_name IS 'Second athlete name (doubles only; NULL for singles).';
