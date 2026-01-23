-- =============================================
-- FLEX TOURNAMENT - DATABASE SCHEMA
-- =============================================

-- 1. Main tournament table
CREATE TABLE public.flex_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  share_id TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  is_public BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(share_id)
);

-- 2. Player pool
CREATE TABLE public.flex_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.flex_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Teams
CREATE TABLE public.flex_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.flex_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Team members (many-to-many: player can be in multiple teams)
CREATE TABLE public.flex_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.flex_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.flex_players(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Groups (bảng đấu)
CREATE TABLE public.flex_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.flex_tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Group items (players or teams in a group)
CREATE TABLE public.flex_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.flex_groups(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- 'player' | 'team'
  player_id UUID REFERENCES public.flex_players(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.flex_teams(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_item_type CHECK (
    (item_type = 'player' AND player_id IS NOT NULL AND team_id IS NULL) OR
    (item_type = 'team' AND team_id IS NOT NULL AND player_id IS NULL)
  )
);

-- 7. Matches (singles or doubles)
CREATE TABLE public.flex_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.flex_tournaments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.flex_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  match_type TEXT NOT NULL DEFAULT 'singles', -- 'singles' | 'doubles'
  
  -- For player-based matches
  slot_a1_player_id UUID REFERENCES public.flex_players(id) ON DELETE SET NULL,
  slot_a2_player_id UUID REFERENCES public.flex_players(id) ON DELETE SET NULL,
  slot_b1_player_id UUID REFERENCES public.flex_players(id) ON DELETE SET NULL,
  slot_b2_player_id UUID REFERENCES public.flex_players(id) ON DELETE SET NULL,
  
  -- For team-based matches
  slot_a_team_id UUID REFERENCES public.flex_teams(id) ON DELETE SET NULL,
  slot_b_team_id UUID REFERENCES public.flex_teams(id) ON DELETE SET NULL,
  
  score_a INTEGER DEFAULT 0,
  score_b INTEGER DEFAULT 0,
  winner_side TEXT, -- 'a' | 'b' | null
  
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Player stats (per group)
CREATE TABLE public.flex_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.flex_groups(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.flex_players(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  point_diff INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, player_id)
);

-- 9. Pair stats (per group, for doubles)
CREATE TABLE public.flex_pair_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.flex_groups(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES public.flex_players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.flex_players(id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  point_diff INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, player1_id, player2_id)
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_flex_players_tournament ON public.flex_players(tournament_id);
CREATE INDEX idx_flex_teams_tournament ON public.flex_teams(tournament_id);
CREATE INDEX idx_flex_groups_tournament ON public.flex_groups(tournament_id);
CREATE INDEX idx_flex_matches_tournament ON public.flex_matches(tournament_id);
CREATE INDEX idx_flex_matches_group ON public.flex_matches(group_id);
CREATE INDEX idx_flex_team_members_team ON public.flex_team_members(team_id);
CREATE INDEX idx_flex_team_members_player ON public.flex_team_members(player_id);
CREATE INDEX idx_flex_group_items_group ON public.flex_group_items(group_id);
CREATE INDEX idx_flex_player_stats_group ON public.flex_player_stats(group_id);
CREATE INDEX idx_flex_pair_stats_group ON public.flex_pair_stats(group_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.flex_tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_group_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flex_pair_stats ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is tournament creator
CREATE OR REPLACE FUNCTION public.is_flex_tournament_creator(p_tournament_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.flex_tournaments
    WHERE id = p_tournament_id AND creator_user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function: check if tournament is viewable (public or owner)
CREATE OR REPLACE FUNCTION public.can_view_flex_tournament(p_tournament_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.flex_tournaments
    WHERE id = p_tournament_id 
    AND (is_public = true OR creator_user_id = p_user_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FLEX_TOURNAMENTS policies
CREATE POLICY "Users can create tournaments"
  ON public.flex_tournaments FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Users can view public tournaments or own"
  ON public.flex_tournaments FOR SELECT
  USING (is_public = true OR creator_user_id = auth.uid());

CREATE POLICY "Creators can update own tournaments"
  ON public.flex_tournaments FOR UPDATE
  USING (creator_user_id = auth.uid())
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Creators can delete own tournaments"
  ON public.flex_tournaments FOR DELETE
  USING (creator_user_id = auth.uid());

-- FLEX_PLAYERS policies
CREATE POLICY "Players viewable if tournament viewable"
  ON public.flex_players FOR SELECT
  USING (can_view_flex_tournament(tournament_id, auth.uid()));

CREATE POLICY "Creators can manage players"
  ON public.flex_players FOR ALL
  USING (is_flex_tournament_creator(tournament_id, auth.uid()));

-- FLEX_TEAMS policies
CREATE POLICY "Teams viewable if tournament viewable"
  ON public.flex_teams FOR SELECT
  USING (can_view_flex_tournament(tournament_id, auth.uid()));

CREATE POLICY "Creators can manage teams"
  ON public.flex_teams FOR ALL
  USING (is_flex_tournament_creator(tournament_id, auth.uid()));

-- FLEX_TEAM_MEMBERS policies
CREATE POLICY "Team members viewable if team viewable"
  ON public.flex_team_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flex_teams t
    WHERE t.id = team_id
    AND can_view_flex_tournament(t.tournament_id, auth.uid())
  ));

CREATE POLICY "Creators can manage team members"
  ON public.flex_team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.flex_teams t
    WHERE t.id = team_id
    AND is_flex_tournament_creator(t.tournament_id, auth.uid())
  ));

-- FLEX_GROUPS policies
CREATE POLICY "Groups viewable if tournament viewable"
  ON public.flex_groups FOR SELECT
  USING (can_view_flex_tournament(tournament_id, auth.uid()));

CREATE POLICY "Creators can manage groups"
  ON public.flex_groups FOR ALL
  USING (is_flex_tournament_creator(tournament_id, auth.uid()));

-- FLEX_GROUP_ITEMS policies
CREATE POLICY "Group items viewable if group viewable"
  ON public.flex_group_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flex_groups g
    WHERE g.id = group_id
    AND can_view_flex_tournament(g.tournament_id, auth.uid())
  ));

CREATE POLICY "Creators can manage group items"
  ON public.flex_group_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.flex_groups g
    WHERE g.id = group_id
    AND is_flex_tournament_creator(g.tournament_id, auth.uid())
  ));

-- FLEX_MATCHES policies
CREATE POLICY "Matches viewable if tournament viewable"
  ON public.flex_matches FOR SELECT
  USING (can_view_flex_tournament(tournament_id, auth.uid()));

CREATE POLICY "Creators can manage matches"
  ON public.flex_matches FOR ALL
  USING (is_flex_tournament_creator(tournament_id, auth.uid()));

-- FLEX_PLAYER_STATS policies
CREATE POLICY "Player stats viewable if group viewable"
  ON public.flex_player_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flex_groups g
    WHERE g.id = group_id
    AND can_view_flex_tournament(g.tournament_id, auth.uid())
  ));

CREATE POLICY "Creators can manage player stats"
  ON public.flex_player_stats FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.flex_groups g
    WHERE g.id = group_id
    AND is_flex_tournament_creator(g.tournament_id, auth.uid())
  ));

-- FLEX_PAIR_STATS policies
CREATE POLICY "Pair stats viewable if group viewable"
  ON public.flex_pair_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.flex_groups g
    WHERE g.id = group_id
    AND can_view_flex_tournament(g.tournament_id, auth.uid())
  ));

CREATE POLICY "Creators can manage pair stats"
  ON public.flex_pair_stats FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.flex_groups g
    WHERE g.id = group_id
    AND is_flex_tournament_creator(g.tournament_id, auth.uid())
  ));

-- =============================================
-- ENABLE REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_team_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_group_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_player_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.flex_pair_stats;

-- =============================================
-- UPDATE TIMESTAMP TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.update_flex_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_flex_tournaments_updated_at
  BEFORE UPDATE ON public.flex_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_flex_updated_at();

CREATE TRIGGER update_flex_matches_updated_at
  BEFORE UPDATE ON public.flex_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_flex_updated_at();

CREATE TRIGGER update_flex_player_stats_updated_at
  BEFORE UPDATE ON public.flex_player_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_flex_updated_at();

CREATE TRIGGER update_flex_pair_stats_updated_at
  BEFORE UPDATE ON public.flex_pair_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_flex_updated_at();