-- Create view_counts aggregate table for efficient view count lookups
CREATE TABLE public.view_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type public.target_type NOT NULL,
  target_id UUID NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(target_type, target_id)
);

-- Enable RLS
ALTER TABLE public.view_counts ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "View counts are publicly readable"
ON public.view_counts
FOR SELECT
USING (true);

-- Only allow system/functions to update
CREATE POLICY "View counts can only be modified via functions"
ON public.view_counts
FOR ALL
USING (false)
WITH CHECK (false);

-- Create index for fast lookups
CREATE INDEX idx_view_counts_target ON public.view_counts (target_type, target_id);

-- Function to increment view count (called by trigger)
CREATE OR REPLACE FUNCTION public.increment_view_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.view_counts (target_type, target_id, count, last_updated_at)
  VALUES (NEW.target_type, NEW.target_id, 1, now())
  ON CONFLICT (target_type, target_id)
  DO UPDATE SET 
    count = view_counts.count + 1,
    last_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-update view_counts when view_events is inserted
CREATE TRIGGER trigger_increment_view_count
AFTER INSERT ON public.view_events
FOR EACH ROW
EXECUTE FUNCTION public.increment_view_count();

-- Backfill existing view counts from view_events
INSERT INTO public.view_counts (target_type, target_id, count, last_updated_at)
SELECT 
  target_type,
  target_id,
  COUNT(*)::INTEGER as count,
  now() as last_updated_at
FROM public.view_events
GROUP BY target_type, target_id
ON CONFLICT (target_type, target_id) DO UPDATE SET
  count = EXCLUDED.count,
  last_updated_at = now();

-- Create function to get view count efficiently (from aggregate table)
CREATE OR REPLACE FUNCTION public.get_view_count(_target_type public.target_type, _target_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN COALESCE(
    (SELECT count FROM public.view_counts WHERE target_type = _target_type AND target_id = _target_id),
    0
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;