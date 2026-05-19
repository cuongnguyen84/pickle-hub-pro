-- Add admin permissions for team_match_tournaments and related tables

-- 1. team_match_tournaments - Admin can view, update, delete any tournament
DROP POLICY IF EXISTS "Admins can delete any tournament" ON public.team_match_tournaments;
CREATE POLICY "Admins can delete any tournament"
ON public.team_match_tournaments
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any tournament" ON public.team_match_tournaments;
CREATE POLICY "Admins can update any tournament"
ON public.team_match_tournaments
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 2. team_match_teams - Admin can delete any team
DROP POLICY IF EXISTS "Admins can delete any team" ON public.team_match_teams;
CREATE POLICY "Admins can delete any team"
ON public.team_match_teams
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any team" ON public.team_match_teams;
CREATE POLICY "Admins can update any team"
ON public.team_match_teams
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 3. team_match_matches - Admin can delete/update any match
DROP POLICY IF EXISTS "Admins can delete any match" ON public.team_match_matches;
CREATE POLICY "Admins can delete any match"
ON public.team_match_matches
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any match" ON public.team_match_matches;
CREATE POLICY "Admins can update any match"
ON public.team_match_matches
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 4. team_match_groups - Admin can delete/update any group
DROP POLICY IF EXISTS "Admins can delete any group" ON public.team_match_groups;
CREATE POLICY "Admins can delete any group"
ON public.team_match_groups
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any group" ON public.team_match_groups;
CREATE POLICY "Admins can update any group"
ON public.team_match_groups
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 5. team_match_games - Admin can delete/update any game
DROP POLICY IF EXISTS "Admins can delete any game" ON public.team_match_games;
CREATE POLICY "Admins can delete any game"
ON public.team_match_games
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any game" ON public.team_match_games;
CREATE POLICY "Admins can update any game"
ON public.team_match_games
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 6. team_match_roster - Admin can delete/update any roster
DROP POLICY IF EXISTS "Admins can delete any roster" ON public.team_match_roster;
CREATE POLICY "Admins can delete any roster"
ON public.team_match_roster
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any roster" ON public.team_match_roster;
CREATE POLICY "Admins can update any roster"
ON public.team_match_roster
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 7. team_match_game_templates - Admin can delete/update any template
DROP POLICY IF EXISTS "Admins can delete any game template" ON public.team_match_game_templates;
CREATE POLICY "Admins can delete any game template"
ON public.team_match_game_templates
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any game template" ON public.team_match_game_templates;
CREATE POLICY "Admins can update any game template"
ON public.team_match_game_templates
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- 8. team_match_referees - Admin can delete/add any referee
DROP POLICY IF EXISTS "Admins can delete any referee" ON public.team_match_referees;
CREATE POLICY "Admins can delete any referee"
ON public.team_match_referees
FOR DELETE
TO authenticated
USING (public.is_admin());

-- Also ensure admin policies exist for doubles_elimination related tables
DROP POLICY IF EXISTS "Admins can update any tournament" ON public.doubles_elimination_tournaments;
CREATE POLICY "Admins can update any tournament"
ON public.doubles_elimination_tournaments
FOR UPDATE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any team" ON public.doubles_elimination_teams;
CREATE POLICY "Admins can delete any team"
ON public.doubles_elimination_teams
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any team" ON public.doubles_elimination_teams;
CREATE POLICY "Admins can update any team"
ON public.doubles_elimination_teams
FOR UPDATE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any match" ON public.doubles_elimination_matches;
CREATE POLICY "Admins can delete any match"
ON public.doubles_elimination_matches
FOR DELETE
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update any match" ON public.doubles_elimination_matches;
CREATE POLICY "Admins can update any match"
ON public.doubles_elimination_matches
FOR UPDATE
TO authenticated
USING (public.is_admin());

-- Flex tournaments - admin can update
DROP POLICY IF EXISTS "Admins can update any tournament" ON public.flex_tournaments;
CREATE POLICY "Admins can update any tournament"
ON public.flex_tournaments
FOR UPDATE
TO authenticated
USING (public.is_admin());