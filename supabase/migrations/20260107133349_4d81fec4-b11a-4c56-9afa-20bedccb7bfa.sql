-- =============================================
-- PHASE 2: Team Match Database Schema
-- =============================================

-- 1. Create Enums
CREATE TYPE team_game_type AS ENUM ('WD', 'MD', 'MX', 'WS', 'MS');
CREATE TYPE game_scoring_type AS ENUM ('rally21', 'sideout11');
CREATE TYPE player_gender AS ENUM ('male', 'female');
CREATE TYPE team_match_status AS ENUM ('setup', 'registration', 'ongoing', 'completed');
CREATE TYPE team_match_match_status AS ENUM ('pending', 'lineup', 'in_progress', 'completed');

-- 2. Create team_match_tournaments table
CREATE TABLE public.team_match_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  share_id TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  name TEXT NOT NULL,
  team_roster_size INTEGER NOT NULL CHECK (team_roster_size IN (4, 6, 8)),
  team_count INTEGER NOT NULL CHECK (team_count >= 2),
  
  -- Format settings
  format TEXT NOT NULL DEFAULT 'round_robin' CHECK (format IN ('round_robin', 'single_elimination', 'rr_playoff')),
  playoff_team_count INTEGER,
  
  -- Registration settings
  require_registration BOOLEAN DEFAULT false,
  
  -- DreamBreaker settings
  has_dreambreaker BOOLEAN DEFAULT false,
  dreambreaker_game_type team_game_type,
  dreambreaker_scoring_type game_scoring_type,
  
  -- Lineup constraints
  require_min_games_per_player BOOLEAN DEFAULT false,
  
  status team_match_status DEFAULT 'setup',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create team_match_game_templates table
CREATE TABLE public.team_match_game_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.team_match_tournaments(id) ON DELETE CASCADE NOT NULL,
  order_index INTEGER NOT NULL,
  game_type team_game_type NOT NULL,
  display_name TEXT,
  scoring_type game_scoring_type NOT NULL DEFAULT 'rally21',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create team_match_teams table
CREATE TABLE public.team_match_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.team_match_tournaments(id) ON DELETE CASCADE NOT NULL,
  team_name TEXT NOT NULL,
  captain_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(8), 'hex'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  seed INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Create team_match_roster table
CREATE TABLE public.team_match_roster (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.team_match_teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  gender player_gender NOT NULL,
  skill_level NUMERIC,
  is_captain BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Create team_match_matches table (Team vs Team)
CREATE TABLE public.team_match_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.team_match_tournaments(id) ON DELETE CASCADE NOT NULL,
  team_a_id UUID REFERENCES public.team_match_teams(id) ON DELETE SET NULL,
  team_b_id UUID REFERENCES public.team_match_teams(id) ON DELETE SET NULL,
  
  -- Aggregated results
  games_won_a INTEGER DEFAULT 0,
  games_won_b INTEGER DEFAULT 0,
  total_points_a INTEGER DEFAULT 0,
  total_points_b INTEGER DEFAULT 0,
  
  winner_team_id UUID REFERENCES public.team_match_teams(id) ON DELETE SET NULL,
  status team_match_match_status DEFAULT 'pending',
  
  -- Round robin info
  round_number INTEGER,
  
  -- Playoff info
  is_playoff BOOLEAN DEFAULT false,
  playoff_round INTEGER,
  bracket_position INTEGER,
  next_match_id UUID REFERENCES public.team_match_matches(id) ON DELETE SET NULL,
  next_match_slot INTEGER CHECK (next_match_slot IN (1, 2)),
  
  -- Lineup status
  lineup_a_submitted BOOLEAN DEFAULT false,
  lineup_b_submitted BOOLEAN DEFAULT false,
  
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Create team_match_games table (Individual games within a match)
CREATE TABLE public.team_match_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.team_match_matches(id) ON DELETE CASCADE NOT NULL,
  template_id UUID REFERENCES public.team_match_game_templates(id) ON DELETE SET NULL,
  order_index INTEGER NOT NULL,
  game_type team_game_type NOT NULL,
  display_name TEXT,
  scoring_type game_scoring_type NOT NULL,
  
  -- Lineup (roster player ids as array)
  lineup_team_a UUID[],
  lineup_team_b UUID[],
  
  -- Score
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  winner_team_id UUID REFERENCES public.team_match_teams(id) ON DELETE SET NULL,
  
  is_dreambreaker BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Enable Row Level Security
-- =============================================

ALTER TABLE public.team_match_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_game_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_games ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Helper Functions
-- =============================================

-- Check if user is tournament creator
CREATE OR REPLACE FUNCTION public.is_team_match_creator(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_match_tournaments
    WHERE id = _tournament_id
      AND created_by = _user_id
  )
$$;

-- Check if user is team captain
CREATE OR REPLACE FUNCTION public.is_team_captain(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_match_teams
    WHERE id = _team_id
      AND captain_user_id = _user_id
  )
$$;

-- Get tournament ID from team
CREATE OR REPLACE FUNCTION public.get_tournament_from_team(_team_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tournament_id
  FROM public.team_match_teams
  WHERE id = _team_id
$$;

-- Get tournament ID from match
CREATE OR REPLACE FUNCTION public.get_tournament_from_match(_match_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tournament_id
  FROM public.team_match_matches
  WHERE id = _match_id
$$;

-- =============================================
-- RLS Policies for team_match_tournaments
-- =============================================

-- Public can view all tournaments (share link access)
CREATE POLICY "Tournaments are publicly viewable"
ON public.team_match_tournaments
FOR SELECT
USING (true);

-- Authenticated users can create tournaments
CREATE POLICY "Authenticated users can create tournaments"
ON public.team_match_tournaments
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Creator can update their tournaments
CREATE POLICY "Creator can update their tournaments"
ON public.team_match_tournaments
FOR UPDATE
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- Creator can delete their tournaments
CREATE POLICY "Creator can delete their tournaments"
ON public.team_match_tournaments
FOR DELETE
TO authenticated
USING (created_by = auth.uid());

-- =============================================
-- RLS Policies for team_match_game_templates
-- =============================================

-- Templates viewable with tournament
CREATE POLICY "Game templates are publicly viewable"
ON public.team_match_game_templates
FOR SELECT
USING (true);

-- Creator can manage templates
CREATE POLICY "Creator can insert game templates"
ON public.team_match_game_templates
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_match_creator(tournament_id, auth.uid()));

CREATE POLICY "Creator can update game templates"
ON public.team_match_game_templates
FOR UPDATE
TO authenticated
USING (public.is_team_match_creator(tournament_id, auth.uid()));

CREATE POLICY "Creator can delete game templates"
ON public.team_match_game_templates
FOR DELETE
TO authenticated
USING (public.is_team_match_creator(tournament_id, auth.uid()));

-- =============================================
-- RLS Policies for team_match_teams
-- =============================================

-- Teams are publicly viewable
CREATE POLICY "Teams are publicly viewable"
ON public.team_match_teams
FOR SELECT
USING (true);

-- Authenticated users can create teams (registration)
CREATE POLICY "Authenticated users can create teams"
ON public.team_match_teams
FOR INSERT
TO authenticated
WITH CHECK (captain_user_id = auth.uid());

-- Captain or creator can update team
CREATE POLICY "Captain or creator can update team"
ON public.team_match_teams
FOR UPDATE
TO authenticated
USING (
  captain_user_id = auth.uid() 
  OR public.is_team_match_creator(tournament_id, auth.uid())
);

-- Creator can delete teams
CREATE POLICY "Creator can delete teams"
ON public.team_match_teams
FOR DELETE
TO authenticated
USING (public.is_team_match_creator(tournament_id, auth.uid()));

-- =============================================
-- RLS Policies for team_match_roster
-- =============================================

-- Roster is publicly viewable
CREATE POLICY "Roster is publicly viewable"
ON public.team_match_roster
FOR SELECT
USING (true);

-- Captain or creator can add roster members
CREATE POLICY "Captain or creator can insert roster"
ON public.team_match_roster
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_captain(team_id, auth.uid())
  OR public.is_team_match_creator(public.get_tournament_from_team(team_id), auth.uid())
);

-- Captain or creator can update roster
CREATE POLICY "Captain or creator can update roster"
ON public.team_match_roster
FOR UPDATE
TO authenticated
USING (
  public.is_team_captain(team_id, auth.uid())
  OR public.is_team_match_creator(public.get_tournament_from_team(team_id), auth.uid())
);

-- Captain or creator can delete roster
CREATE POLICY "Captain or creator can delete roster"
ON public.team_match_roster
FOR DELETE
TO authenticated
USING (
  public.is_team_captain(team_id, auth.uid())
  OR public.is_team_match_creator(public.get_tournament_from_team(team_id), auth.uid())
);

-- =============================================
-- RLS Policies for team_match_matches
-- =============================================

-- Matches are publicly viewable
CREATE POLICY "Matches are publicly viewable"
ON public.team_match_matches
FOR SELECT
USING (true);

-- Creator can manage matches
CREATE POLICY "Creator can insert matches"
ON public.team_match_matches
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_match_creator(tournament_id, auth.uid()));

-- Creator or team captains can update matches (for lineup submission)
CREATE POLICY "Creator or captains can update matches"
ON public.team_match_matches
FOR UPDATE
TO authenticated
USING (
  public.is_team_match_creator(tournament_id, auth.uid())
  OR public.is_team_captain(team_a_id, auth.uid())
  OR public.is_team_captain(team_b_id, auth.uid())
);

-- Creator can delete matches
CREATE POLICY "Creator can delete matches"
ON public.team_match_matches
FOR DELETE
TO authenticated
USING (public.is_team_match_creator(tournament_id, auth.uid()));

-- =============================================
-- RLS Policies for team_match_games
-- =============================================

-- Games are publicly viewable
CREATE POLICY "Games are publicly viewable"
ON public.team_match_games
FOR SELECT
USING (true);

-- Creator can insert games
CREATE POLICY "Creator can insert games"
ON public.team_match_games
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_match_creator(public.get_tournament_from_match(match_id), auth.uid()));

-- Creator or captains can update games (for lineup and scoring)
CREATE POLICY "Creator or captains can update games"
ON public.team_match_games
FOR UPDATE
TO authenticated
USING (
  public.is_team_match_creator(public.get_tournament_from_match(match_id), auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.team_match_matches m
    WHERE m.id = match_id
    AND (
      public.is_team_captain(m.team_a_id, auth.uid())
      OR public.is_team_captain(m.team_b_id, auth.uid())
    )
  )
);

-- Creator can delete games
CREATE POLICY "Creator can delete games"
ON public.team_match_games
FOR DELETE
TO authenticated
USING (public.is_team_match_creator(public.get_tournament_from_match(match_id), auth.uid()));

-- =============================================
-- Triggers for updated_at
-- =============================================

CREATE TRIGGER update_team_match_tournaments_timestamp
BEFORE UPDATE ON public.team_match_tournaments
FOR EACH ROW
EXECUTE FUNCTION public.update_quick_table_timestamp();

CREATE TRIGGER update_team_match_teams_timestamp
BEFORE UPDATE ON public.team_match_teams
FOR EACH ROW
EXECUTE FUNCTION public.update_quick_table_timestamp();

CREATE TRIGGER update_team_match_matches_timestamp
BEFORE UPDATE ON public.team_match_matches
FOR EACH ROW
EXECUTE FUNCTION public.update_quick_table_timestamp();

CREATE TRIGGER update_team_match_games_timestamp
BEFORE UPDATE ON public.team_match_games
FOR EACH ROW
EXECUTE FUNCTION public.update_quick_table_timestamp();