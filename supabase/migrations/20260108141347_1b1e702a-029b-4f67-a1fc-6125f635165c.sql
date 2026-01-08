-- Create master_teams table for reusable teams
CREATE TABLE IF NOT EXISTS public.master_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captain_user_id UUID NOT NULL,
  team_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create master_team_roster table for original team members
CREATE TABLE IF NOT EXISTS public.master_team_roster (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  master_team_id UUID NOT NULL REFERENCES public.master_teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  gender public.player_gender NOT NULL,
  skill_level NUMERIC,
  user_id UUID,
  is_captain BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add master_team_id to team_match_teams for linking to original team
ALTER TABLE public.team_match_teams 
ADD COLUMN IF NOT EXISTS master_team_id UUID REFERENCES public.master_teams(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.master_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_team_roster ENABLE ROW LEVEL SECURITY;

-- RLS policies for master_teams
DROP POLICY IF EXISTS "Captains can view their own master teams" ON public.master_teams;
CREATE POLICY "Captains can view their own master teams"
ON public.master_teams FOR SELECT
USING (captain_user_id = auth.uid());

DROP POLICY IF EXISTS "Captains can create master teams" ON public.master_teams;
CREATE POLICY "Captains can create master teams"
ON public.master_teams FOR INSERT
WITH CHECK (captain_user_id = auth.uid());

DROP POLICY IF EXISTS "Captains can update their own master teams" ON public.master_teams;
CREATE POLICY "Captains can update their own master teams"
ON public.master_teams FOR UPDATE
USING (captain_user_id = auth.uid());

DROP POLICY IF EXISTS "Captains can delete their own master teams" ON public.master_teams;
CREATE POLICY "Captains can delete their own master teams"
ON public.master_teams FOR DELETE
USING (captain_user_id = auth.uid());

-- RLS policies for master_team_roster
DROP POLICY IF EXISTS "Roster viewable by team captain" ON public.master_team_roster;
CREATE POLICY "Roster viewable by team captain"
ON public.master_team_roster FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.master_teams 
  WHERE id = master_team_roster.master_team_id 
  AND captain_user_id = auth.uid()
));

DROP POLICY IF EXISTS "Captain can manage roster" ON public.master_team_roster;
CREATE POLICY "Captain can manage roster"
ON public.master_team_roster FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.master_teams 
  WHERE id = master_team_roster.master_team_id 
  AND captain_user_id = auth.uid()
));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at for master_teams
DROP TRIGGER IF EXISTS update_master_teams_updated_at ON public.master_teams;
CREATE TRIGGER update_master_teams_updated_at
BEFORE UPDATE ON public.master_teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_teams_captain ON public.master_teams(captain_user_id);
CREATE INDEX IF NOT EXISTS idx_master_team_roster_team ON public.master_team_roster(master_team_id);
CREATE INDEX IF NOT EXISTS idx_team_match_teams_master ON public.team_match_teams(master_team_id);