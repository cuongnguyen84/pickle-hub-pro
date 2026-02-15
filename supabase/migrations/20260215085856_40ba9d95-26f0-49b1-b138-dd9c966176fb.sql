
-- Add geo-blocking settings to system_settings
INSERT INTO public.system_settings (key, value)
VALUES 
  ('geo_block_enabled', 'true'::jsonb),
  ('blocked_countries', '["US"]'::jsonb)
ON CONFLICT (key) DO NOTHING;
