-- Add display_name_updated_at column to track nickname changes (limit 1 change/week)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS display_name_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Comment explaining the purpose
COMMENT ON COLUMN public.profiles.display_name_updated_at IS 'Tracks when display name was last updated to enforce weekly limit';