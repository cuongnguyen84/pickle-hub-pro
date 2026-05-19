-- Allow doubles_elimination tournament creators to lookup profiles by email (for adding referees)
CREATE POLICY "Doubles elimination creators can lookup profiles by email"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM doubles_elimination_tournaments 
      WHERE creator_user_id = auth.uid()
    )
  );

-- Allow team_match tournament creators to lookup profiles by email
CREATE POLICY "Team match creators can lookup profiles by email"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 
      FROM team_match_tournaments 
      WHERE created_by = auth.uid()
    )
  );