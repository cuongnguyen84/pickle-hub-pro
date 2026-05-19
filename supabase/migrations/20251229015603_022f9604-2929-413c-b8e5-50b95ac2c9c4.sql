-- Add court and time fields to quick_tables
ALTER TABLE public.quick_tables
ADD COLUMN IF NOT EXISTS courts text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS start_time text DEFAULT NULL;

-- Add court and time fields to quick_table_matches
ALTER TABLE public.quick_table_matches
ADD COLUMN IF NOT EXISTS court_id integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS start_at text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rr_round_number integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS rr_match_index integer DEFAULT NULL;