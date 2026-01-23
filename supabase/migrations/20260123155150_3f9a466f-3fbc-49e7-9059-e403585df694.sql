-- Add counts_for_standings column to flex_matches (default true)
ALTER TABLE public.flex_matches 
ADD COLUMN IF NOT EXISTS counts_for_standings boolean NOT NULL DEFAULT true;

-- Add include_doubles_in_singles column to flex_groups (for singles tab filter)
ALTER TABLE public.flex_groups 
ADD COLUMN IF NOT EXISTS include_doubles_in_singles boolean NOT NULL DEFAULT true;