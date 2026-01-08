-- Create team_match_groups table (similar to quick_table_groups)
CREATE TABLE public.team_match_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.team_match_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add group_id to team_match_teams
ALTER TABLE public.team_match_teams 
ADD COLUMN group_id UUID REFERENCES public.team_match_groups(id) ON DELETE SET NULL;

-- Add group_id to team_match_matches
ALTER TABLE public.team_match_matches 
ADD COLUMN group_id UUID REFERENCES public.team_match_groups(id) ON DELETE SET NULL;

-- Add group_count and top_per_group to team_match_tournaments for rr_playoff format
ALTER TABLE public.team_match_tournaments 
ADD COLUMN group_count INTEGER,
ADD COLUMN top_per_group INTEGER DEFAULT 2;

-- Enable RLS on team_match_groups
ALTER TABLE public.team_match_groups ENABLE ROW LEVEL SECURITY;

-- RLS policies for team_match_groups
CREATE POLICY "Groups are publicly viewable"
ON public.team_match_groups
FOR SELECT
USING (true);

CREATE POLICY "Creator can insert groups"
ON public.team_match_groups
FOR INSERT
WITH CHECK (is_team_match_creator(tournament_id, auth.uid()));

CREATE POLICY "Creator can update groups"
ON public.team_match_groups
FOR UPDATE
USING (is_team_match_creator(tournament_id, auth.uid()));

CREATE POLICY "Creator can delete groups"
ON public.team_match_groups
FOR DELETE
USING (is_team_match_creator(tournament_id, auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_team_match_groups_tournament ON public.team_match_groups(tournament_id);
CREATE INDEX idx_team_match_teams_group ON public.team_match_teams(group_id);
CREATE INDEX idx_team_match_matches_group ON public.team_match_matches(group_id);