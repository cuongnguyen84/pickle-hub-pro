
-- Add new columns to quick_table_matches for multi-set, timer, serving, undo
ALTER TABLE public.quick_table_matches
  ADD COLUMN IF NOT EXISTS set_scores jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_set integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS total_sets integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS serving_side integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sides_swapped boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS score_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS match_timer_started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS match_timer_elapsed_seconds integer DEFAULT 0;

-- Add default_sets to quick_tables for tournament-level configuration
ALTER TABLE public.quick_tables
  ADD COLUMN IF NOT EXISTS default_sets integer DEFAULT 1;
