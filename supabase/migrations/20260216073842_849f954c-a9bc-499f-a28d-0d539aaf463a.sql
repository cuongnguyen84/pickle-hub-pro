
-- Add new columns for Red5 Cloud integration
ALTER TABLE public.livestreams 
  ADD COLUMN IF NOT EXISTS streaming_provider TEXT DEFAULT 'red5',
  ADD COLUMN IF NOT EXISTS red5_stream_name TEXT,
  ADD COLUMN IF NOT EXISTS red5_server_url TEXT,
  ADD COLUMN IF NOT EXISTS hls_url TEXT;

-- Update existing livestreams to use 'mux' provider
UPDATE public.livestreams SET streaming_provider = 'mux' WHERE streaming_provider IS NULL OR streaming_provider = 'red5';

-- Set default for new livestreams to 'red5'
ALTER TABLE public.livestreams ALTER COLUMN streaming_provider SET DEFAULT 'red5';

-- Recreate public_livestreams view with new columns
CREATE OR REPLACE VIEW public.public_livestreams AS
SELECT 
  id,
  title,
  description,
  status,
  scheduled_start_at,
  started_at,
  ended_at,
  thumbnail_url,
  mux_playback_id,
  mux_asset_id,
  mux_asset_playback_id,
  organization_id,
  tournament_id,
  created_at,
  streaming_provider,
  hls_url
FROM livestreams;
