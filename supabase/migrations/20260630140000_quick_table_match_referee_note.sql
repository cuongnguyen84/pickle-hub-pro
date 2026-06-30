-- Referee free-text note per Quick Table match (incidents, timeouts, disputes…).
ALTER TABLE public.quick_table_matches
  ADD COLUMN IF NOT EXISTS referee_note text;

COMMENT ON COLUMN public.quick_table_matches.referee_note IS 'Free-text note from the referee for this match.';
