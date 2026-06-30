-- LIVE badge + referee claim for MLP (team match) games. Mirrors
-- quick_table_matches.live_referee_id / doubles_elimination_matches.live_referee_id.
ALTER TABLE public.team_match_games
  ADD COLUMN IF NOT EXISTS live_referee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.team_match_games.live_referee_id IS
  'Referee currently live-scoring this game; powers the LIVE badge. Cleared when the game completes.';
