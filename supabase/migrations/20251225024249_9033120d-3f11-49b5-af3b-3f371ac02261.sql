-- Add live_referee_id to track which referee is actively scoring a match
ALTER TABLE public.quick_table_matches
ADD COLUMN live_referee_id uuid DEFAULT NULL;

-- Add index for faster lookups
CREATE INDEX idx_quick_table_matches_live_referee ON public.quick_table_matches(live_referee_id) WHERE live_referee_id IS NOT NULL;

-- Enable realtime for quick_table_matches
ALTER TABLE public.quick_table_matches REPLICA IDENTITY FULL;

-- Add to realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'quick_table_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quick_table_matches;
  END IF;
END $$;