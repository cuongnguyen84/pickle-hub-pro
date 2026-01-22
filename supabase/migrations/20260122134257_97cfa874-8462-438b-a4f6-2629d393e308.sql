-- Drop old restrictive policies for UPDATE on team_match_games and team_match_matches
DROP POLICY IF EXISTS "Creator or captains can update games" ON public.team_match_games;
DROP POLICY IF EXISTS "Creator or captains can update matches" ON public.team_match_matches;

-- Create new policies that allow referees to update as well
CREATE POLICY "Creator, referees or captains can update games" 
ON public.team_match_games 
FOR UPDATE 
USING (
  can_edit_team_match_scores(get_tournament_from_match(match_id), auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM team_match_matches m
    WHERE m.id = team_match_games.match_id 
    AND (is_team_captain(m.team_a_id, auth.uid()) OR is_team_captain(m.team_b_id, auth.uid()))
  )
);

CREATE POLICY "Creator, referees or captains can update matches" 
ON public.team_match_matches 
FOR UPDATE 
USING (
  can_edit_team_match_scores(tournament_id, auth.uid()) 
  OR is_team_captain(team_a_id, auth.uid()) 
  OR is_team_captain(team_b_id, auth.uid())
);