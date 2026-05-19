ALTER TABLE public.view_events ADD COLUMN IF NOT EXISTS viewer_ip text;
ALTER TABLE public.view_events ADD COLUMN IF NOT EXISTS is_replay boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_view_events_dedup_user ON public.view_events (viewer_user_id, target_id, created_at DESC) WHERE viewer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_view_events_dedup_ip ON public.view_events (viewer_ip, target_id, created_at DESC) WHERE viewer_ip IS NOT NULL AND viewer_user_id IS NULL;