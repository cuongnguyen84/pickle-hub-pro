-- Drop existing constraint and recreate with bo1 allowed
ALTER TABLE public.doubles_elimination_tournaments 
DROP CONSTRAINT IF EXISTS doubles_elimination_tournaments_finals_format_check;

ALTER TABLE public.doubles_elimination_tournaments 
ADD CONSTRAINT doubles_elimination_tournaments_finals_format_check 
CHECK (finals_format = ANY (ARRAY['bo1'::text, 'bo3'::text, 'bo5'::text]));