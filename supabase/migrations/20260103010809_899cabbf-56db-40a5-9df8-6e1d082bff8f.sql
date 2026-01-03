-- Add unique constraint to prevent duplicate registrations
-- Each user can only have one team per table (as player1)
ALTER TABLE public.quick_table_teams
ADD CONSTRAINT unique_player1_per_table UNIQUE (table_id, player1_user_id);

-- Also prevent user from being player2 in multiple teams for same table
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_player2_per_table 
ON public.quick_table_teams (table_id, player2_user_id) 
WHERE player2_user_id IS NOT NULL;