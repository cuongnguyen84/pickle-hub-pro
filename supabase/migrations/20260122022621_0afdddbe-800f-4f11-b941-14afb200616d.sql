-- Add semifinals_format column to doubles_elimination_tournaments
ALTER TABLE public.doubles_elimination_tournaments 
ADD COLUMN IF NOT EXISTS semifinals_format TEXT DEFAULT 'bo3';