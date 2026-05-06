-- ============================================================================
-- Enable Supabase realtime on social_notifications
-- ----------------------------------------------------------------------------
-- Sprint 2 Phase 3B.2 NotificationBell uses Supabase realtime channel to
-- push INSERT events to logged-in users (bell badge updates without reload).
--
-- This migration adds public.social_notifications to the supabase_realtime
-- publication so the postgres logical replication slot streams change events
-- to the websocket subscribers.
--
-- Idempotent: ALTER PUBLICATION ... ADD TABLE errors if table already in
-- publication, so we wrap in DO block to swallow that one error code (42710).
-- ============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.social_notifications;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'social_notifications already in supabase_realtime publication';
END;
$$;
