-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Players can be updated by table owner" ON quick_table_players;

-- Create new policy that allows both creator AND referees to update players
CREATE POLICY "Players can be updated by creator or referee"
ON quick_table_players
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM quick_tables
    WHERE quick_tables.id = quick_table_players.table_id
    AND (
      quick_tables.creator_user_id = auth.uid()
      OR is_quick_table_referee(quick_table_players.table_id, auth.uid())
    )
  )
);
