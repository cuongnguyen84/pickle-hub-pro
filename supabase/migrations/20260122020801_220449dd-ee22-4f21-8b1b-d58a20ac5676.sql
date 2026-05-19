-- Create doubles elimination tournaments table
CREATE TABLE public.doubles_elimination_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  share_id TEXT UNIQUE NOT NULL,
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_count INTEGER NOT NULL CHECK (team_count >= 32),
  has_third_place_match BOOLEAN DEFAULT FALSE,
  early_rounds_format TEXT DEFAULT 'bo1' CHECK (early_rounds_format IN ('bo1', 'bo3', 'bo5')),
  finals_format TEXT DEFAULT 'bo3' CHECK (finals_format IN ('bo3', 'bo5')),
  status TEXT NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'ongoing', 'completed')),
  current_round INTEGER DEFAULT 0,
  court_count INTEGER DEFAULT 1,
  start_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create doubles elimination teams table
CREATE TABLE public.doubles_elimination_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.doubles_elimination_tournaments(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  player1_name TEXT NOT NULL,
  player2_name TEXT,
  seed INTEGER,
  total_points_for INTEGER DEFAULT 0,
  total_points_against INTEGER DEFAULT 0,
  point_diff INTEGER GENERATED ALWAYS AS (total_points_for - total_points_against) STORED,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'eliminated')),
  eliminated_at_round INTEGER,
  final_placement INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create doubles elimination matches table
CREATE TABLE public.doubles_elimination_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.doubles_elimination_tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_type TEXT NOT NULL CHECK (round_type IN ('winner_r1', 'loser_r2', 'merge_r3', 'elimination', 'quarterfinal', 'semifinal', 'third_place', 'final')),
  bracket_type TEXT NOT NULL CHECK (bracket_type IN ('winner', 'loser', 'merged', 'single')),
  match_number INTEGER NOT NULL,
  team_a_id UUID REFERENCES public.doubles_elimination_teams(id),
  team_b_id UUID REFERENCES public.doubles_elimination_teams(id),
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  winner_id UUID REFERENCES public.doubles_elimination_teams(id),
  best_of INTEGER DEFAULT 1 CHECK (best_of IN (1, 3, 5)),
  games JSONB DEFAULT '[]'::jsonb,
  games_won_a INTEGER DEFAULT 0,
  games_won_b INTEGER DEFAULT 0,
  source_a JSONB,
  source_b JSONB,
  dest_winner JSONB,
  dest_loser JSONB,
  is_bye BOOLEAN DEFAULT FALSE,
  display_order INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'completed')),
  live_referee_id UUID REFERENCES auth.users(id),
  court_number INTEGER,
  start_time TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create doubles elimination referees table
CREATE TABLE public.doubles_elimination_referees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID REFERENCES public.doubles_elimination_tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Enable RLS
ALTER TABLE public.doubles_elimination_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubles_elimination_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubles_elimination_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubles_elimination_referees ENABLE ROW LEVEL SECURITY;

-- Tournament policies
CREATE POLICY "Anyone can view tournaments" ON public.doubles_elimination_tournaments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tournaments" ON public.doubles_elimination_tournaments
  FOR INSERT WITH CHECK (auth.uid() = creator_user_id);

CREATE POLICY "Creators can update their tournaments" ON public.doubles_elimination_tournaments
  FOR UPDATE USING (auth.uid() = creator_user_id);

CREATE POLICY "Creators can delete their tournaments" ON public.doubles_elimination_tournaments
  FOR DELETE USING (auth.uid() = creator_user_id);

-- Teams policies
CREATE POLICY "Anyone can view teams" ON public.doubles_elimination_teams
  FOR SELECT USING (true);

CREATE POLICY "Tournament creators can manage teams" ON public.doubles_elimination_teams
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.doubles_elimination_tournaments t
      WHERE t.id = tournament_id AND t.creator_user_id = auth.uid()
    )
  );

-- Matches policies
CREATE POLICY "Anyone can view matches" ON public.doubles_elimination_matches
  FOR SELECT USING (true);

CREATE POLICY "Creators and referees can update matches" ON public.doubles_elimination_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.doubles_elimination_tournaments t
      WHERE t.id = tournament_id AND t.creator_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.doubles_elimination_referees r
      WHERE r.tournament_id = tournament_id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Creators can insert matches" ON public.doubles_elimination_matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doubles_elimination_tournaments t
      WHERE t.id = tournament_id AND t.creator_user_id = auth.uid()
    )
  );

-- Referees policies
CREATE POLICY "Anyone can view referees" ON public.doubles_elimination_referees
  FOR SELECT USING (true);

CREATE POLICY "Creators can manage referees" ON public.doubles_elimination_referees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.doubles_elimination_tournaments t
      WHERE t.id = tournament_id AND t.creator_user_id = auth.uid()
    )
  );

-- Create updated_at trigger
CREATE TRIGGER update_doubles_elimination_tournaments_updated_at
  BEFORE UPDATE ON public.doubles_elimination_tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doubles_elimination_matches_updated_at
  BEFORE UPDATE ON public.doubles_elimination_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for matches
ALTER PUBLICATION supabase_realtime ADD TABLE public.doubles_elimination_matches;

-- Helper function to check if user is tournament creator
CREATE OR REPLACE FUNCTION public.is_doubles_elimination_creator(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doubles_elimination_tournaments
    WHERE id = _tournament_id
      AND creator_user_id = _user_id
  )
$$;

-- Helper function to check if user is referee
CREATE OR REPLACE FUNCTION public.is_doubles_elimination_referee(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doubles_elimination_referees
    WHERE tournament_id = _tournament_id
      AND user_id = _user_id
  )
$$;

-- Helper function to check edit permissions
CREATE OR REPLACE FUNCTION public.can_edit_doubles_elimination_scores(_tournament_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_doubles_elimination_creator(_tournament_id, _user_id) 
      OR public.is_doubles_elimination_referee(_tournament_id, _user_id)
$$;