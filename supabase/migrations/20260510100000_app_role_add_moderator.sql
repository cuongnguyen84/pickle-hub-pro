-- ============================================================================
-- Backfill: app_role enum + 'moderator' value
-- ============================================================================
-- Drift case documented in docs/schema-drift-audit-2026-05.md (PR #20):
-- the 'moderator' enum value exists on prod (visible in
-- src/integrations/supabase/types.ts) but no migration adds it. The chat
-- moderation policies (20251222092727, 20260215190351) reference
-- moderators via a per-livestream can_moderate_chat() function but never
-- extend the global app_role enum.
--
-- This migration officially adds 'moderator' so:
--   1. Preview branch deploy from scratch matches prod state
--   2. Sprint 5 PR-B (comment moderation) can grant moderator role via
--      the existing user_roles table without further drift
--
-- IDEMPOTENT via DO block + IF NOT EXISTS guard. Safe to replay against
-- prod (no-op when value already exists).
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role'
      AND e.enumlabel = 'moderator'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'moderator';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
