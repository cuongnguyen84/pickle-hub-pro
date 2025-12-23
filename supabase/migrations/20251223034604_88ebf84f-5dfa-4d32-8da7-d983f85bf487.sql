-- =============================================
-- QUICK TABLES FEATURE - "Chia bảng nhanh"
-- =============================================

-- Enum for table format type
CREATE TYPE public.quick_table_format AS ENUM ('round_robin', 'large_playoff');

-- Enum for match status
CREATE TYPE public.quick_match_status AS ENUM ('pending', 'completed');

-- Enum for table status
CREATE TYPE public.quick_table_status AS ENUM ('setup', 'group_stage', 'playoff', 'completed');

-- Main quick_tables table
CREATE TABLE public.quick_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Creator info
  creator_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Basic info
  name TEXT NOT NULL DEFAULT 'Bảng đấu mới',
  player_count INTEGER NOT NULL CHECK (player_count >= 2),
  format quick_table_format NOT NULL,
  status quick_table_status NOT NULL DEFAULT 'setup',
  
  -- Config
  group_count INTEGER, -- Number of groups for round robin
  top_per_group INTEGER DEFAULT 2, -- How many advance from each group
  use_wildcard BOOLEAN DEFAULT false,
  wildcard_count INTEGER DEFAULT 0,
  
  -- Share settings
  share_id TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  is_public BOOLEAN NOT NULL DEFAULT true
);

-- Groups/Pools for round robin
CREATE TABLE public.quick_table_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- 'A', 'B', 'C', etc.
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Players
CREATE TABLE public.quick_table_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.quick_table_groups(id) ON DELETE SET NULL,
  
  -- Player info
  name TEXT NOT NULL,
  team TEXT, -- CLB / nhóm
  seed INTEGER, -- Hạt giống (higher = stronger)
  
  -- Stats for group stage
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  points_for INTEGER NOT NULL DEFAULT 0,
  points_against INTEGER NOT NULL DEFAULT 0,
  point_diff INTEGER GENERATED ALWAYS AS (points_for - points_against) STORED,
  
  -- Playoff status
  is_qualified BOOLEAN DEFAULT false,
  is_wildcard BOOLEAN DEFAULT false,
  playoff_seed INTEGER, -- Seed trong vòng playoff
  
  -- Large playoff specific
  round1_result TEXT, -- 'win' or 'loss'
  round2_result TEXT,
  round1_point_diff INTEGER DEFAULT 0,
  is_bye BOOLEAN DEFAULT false, -- BYE vào thẳng round 4
  
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Matches (both group stage and playoff)
CREATE TABLE public.quick_table_matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.quick_tables(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.quick_table_groups(id) ON DELETE SET NULL, -- NULL for playoff matches
  
  -- Match type
  is_playoff BOOLEAN NOT NULL DEFAULT false,
  playoff_round INTEGER, -- 1=Round of 16, 2=QF, 3=SF, 4=Final, etc.
  playoff_match_number INTEGER, -- Position in bracket
  bracket_position TEXT, -- 'upper' or 'lower' for bracket display
  
  -- For large playoff: which round (lượt)
  large_playoff_round INTEGER, -- 1, 2, 3, 4, etc.
  
  -- Players
  player1_id UUID REFERENCES public.quick_table_players(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES public.quick_table_players(id) ON DELETE SET NULL,
  
  -- Result
  score1 INTEGER, -- Score of player 1
  score2 INTEGER, -- Score of player 2
  winner_id UUID REFERENCES public.quick_table_players(id) ON DELETE SET NULL,
  status quick_match_status NOT NULL DEFAULT 'pending',
  
  -- Next match linkage for playoff
  next_match_id UUID REFERENCES public.quick_table_matches(id) ON DELETE SET NULL,
  next_match_slot INTEGER, -- 1 or 2 (which player slot in next match)
  
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_quick_tables_share_id ON public.quick_tables(share_id);
CREATE INDEX idx_quick_tables_creator ON public.quick_tables(creator_user_id);
CREATE INDEX idx_quick_table_groups_table ON public.quick_table_groups(table_id);
CREATE INDEX idx_quick_table_players_table ON public.quick_table_players(table_id);
CREATE INDEX idx_quick_table_players_group ON public.quick_table_players(group_id);
CREATE INDEX idx_quick_table_matches_table ON public.quick_table_matches(table_id);
CREATE INDEX idx_quick_table_matches_group ON public.quick_table_matches(group_id);

-- Enable RLS
ALTER TABLE public.quick_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_table_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_table_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_table_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for quick_tables
-- Anyone can read public tables (by share_id)
CREATE POLICY "Public tables are viewable by anyone"
  ON public.quick_tables FOR SELECT
  USING (is_public = true);

-- Authenticated users can view their own tables
CREATE POLICY "Users can view their own tables"
  ON public.quick_tables FOR SELECT
  USING (creator_user_id = auth.uid());

-- Authenticated users can create tables
CREATE POLICY "Authenticated users can create tables"
  ON public.quick_tables FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

-- Only creator can update/delete their tables
CREATE POLICY "Creators can update their tables"
  ON public.quick_tables FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Creators can delete their tables"
  ON public.quick_tables FOR DELETE
  USING (creator_user_id = auth.uid());

-- RLS Policies for quick_table_groups
CREATE POLICY "Groups are viewable with table"
  ON public.quick_table_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND (is_public = true OR creator_user_id = auth.uid())
    )
  );

CREATE POLICY "Groups can be created by table owner"
  ON public.quick_table_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Groups can be updated by table owner"
  ON public.quick_table_groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Groups can be deleted by table owner"
  ON public.quick_table_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

-- RLS Policies for quick_table_players
CREATE POLICY "Players are viewable with table"
  ON public.quick_table_players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND (is_public = true OR creator_user_id = auth.uid())
    )
  );

CREATE POLICY "Players can be created by table owner"
  ON public.quick_table_players FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Players can be updated by table owner"
  ON public.quick_table_players FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Players can be deleted by table owner"
  ON public.quick_table_players FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

-- RLS Policies for quick_table_matches
CREATE POLICY "Matches are viewable with table"
  ON public.quick_table_matches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND (is_public = true OR creator_user_id = auth.uid())
    )
  );

CREATE POLICY "Matches can be created by table owner"
  ON public.quick_table_matches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Matches can be updated by table owner"
  ON public.quick_table_matches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

CREATE POLICY "Matches can be deleted by table owner"
  ON public.quick_table_matches FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quick_tables 
      WHERE id = table_id AND creator_user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_quick_table_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_quick_tables_timestamp
  BEFORE UPDATE ON public.quick_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_quick_table_timestamp();

CREATE TRIGGER update_quick_table_matches_timestamp
  BEFORE UPDATE ON public.quick_table_matches
  FOR EACH ROW EXECUTE FUNCTION public.update_quick_table_timestamp();