-- Create team match referees table
CREATE TABLE public.team_match_referees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.team_match_tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);

-- Enable RLS
ALTER TABLE public.team_match_referees ENABLE ROW LEVEL SECURITY;

-- Anyone can view referees
CREATE POLICY "Anyone can view team match referees"
  ON public.team_match_referees
  FOR SELECT
  USING (true);

-- Only tournament creator can manage referees
CREATE POLICY "Tournament creator can add referees"
  ON public.team_match_referees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_match_tournaments t
      WHERE t.id = tournament_id AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "Tournament creator can remove referees"
  ON public.team_match_referees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_match_tournaments t
      WHERE t.id = tournament_id AND t.created_by = auth.uid()
    )
  );

-- Create function to check if user can edit team match scores
CREATE OR REPLACE FUNCTION public.can_edit_team_match_scores(_tournament_id UUID, _user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if user is tournament creator
  IF EXISTS (
    SELECT 1 FROM public.team_match_tournaments
    WHERE id = _tournament_id AND created_by = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user is a referee
  IF EXISTS (
    SELECT 1 FROM public.team_match_referees
    WHERE tournament_id = _tournament_id AND user_id = _user_id
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;