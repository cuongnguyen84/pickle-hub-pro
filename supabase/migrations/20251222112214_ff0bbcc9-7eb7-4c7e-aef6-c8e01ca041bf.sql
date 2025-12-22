-- Add source column to view_events to track embed vs direct views
ALTER TABLE public.view_events 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'direct';

-- Add comment for documentation
COMMENT ON COLUMN public.view_events.source IS 'Source of the view: direct (in-app), embed (external iframe)';

-- Create index for analytics queries filtering by source
CREATE INDEX IF NOT EXISTS idx_view_events_source ON public.view_events(source);