
-- 1. Create parent_tournaments table
CREATE TABLE public.parent_tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  banner_url TEXT,
  event_date DATE,
  location TEXT,
  share_id TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(6), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(share_id)
);

-- Enable RLS
ALTER TABLE public.parent_tournaments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Anyone can view parent tournaments"
  ON public.parent_tournaments FOR SELECT USING (true);

CREATE POLICY "Creator can insert parent tournaments"
  ON public.parent_tournaments FOR INSERT
  WITH CHECK (creator_user_id = auth.uid());

CREATE POLICY "Creator can update parent tournaments"
  ON public.parent_tournaments FOR UPDATE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Creator can delete parent tournaments"
  ON public.parent_tournaments FOR DELETE
  USING (creator_user_id = auth.uid());

CREATE POLICY "Admin full access parent tournaments"
  ON public.parent_tournaments FOR ALL
  USING (is_admin()) WITH CHECK (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_parent_tournaments_updated_at
  BEFORE UPDATE ON public.parent_tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add parent_tournament_id FK to quick_tables (RESTRICT)
ALTER TABLE public.quick_tables
  ADD COLUMN parent_tournament_id UUID
  REFERENCES public.parent_tournaments(id) ON DELETE RESTRICT;

-- 3. Add court_name to quick_table_matches
ALTER TABLE public.quick_table_matches
  ADD COLUMN court_name TEXT;
