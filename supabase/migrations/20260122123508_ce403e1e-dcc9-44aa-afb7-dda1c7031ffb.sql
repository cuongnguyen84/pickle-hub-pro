-- Add columns for Single Elimination support
ALTER TABLE public.team_match_tournaments 
ADD COLUMN IF NOT EXISTS has_third_place_match BOOLEAN DEFAULT false;

ALTER TABLE public.team_match_tournaments 
ADD COLUMN IF NOT EXISTS bracket_pairing_type TEXT DEFAULT 'random';

-- Add third place match marker to matches
ALTER TABLE public.team_match_matches 
ADD COLUMN IF NOT EXISTS is_third_place BOOLEAN DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.team_match_tournaments.has_third_place_match IS 'Whether to create a third place match in single elimination';
COMMENT ON COLUMN public.team_match_tournaments.bracket_pairing_type IS 'How to pair teams: random or manual';
COMMENT ON COLUMN public.team_match_matches.is_third_place IS 'Whether this is the third place match';