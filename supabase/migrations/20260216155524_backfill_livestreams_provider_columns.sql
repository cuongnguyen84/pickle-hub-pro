-- ============================================================================
-- Backfill: livestreams.streaming_provider + livestreams.hls_url columns
-- ============================================================================
-- These columns exist on prod (confirmed via src/integrations/supabase/types.ts
-- regen 2026-04 + active use in src/pages/creator/CreatorLivestreamForm.tsx)
-- but were added directly via the Lovable Cloud schema editor and never
-- committed as a migration. Preview branches that build the database from
-- the migrations folder fresh (Supabase Branching) hit a hard error at
-- migration 20260216155525 (`Add vod_url + recreate public_livestreams`)
-- because the view SELECTs columns that don't exist yet.
--
-- This migration is idempotent (`ADD COLUMN IF NOT EXISTS`) so:
--   - Prod (where columns already exist): no-op, no schema change.
--   - Preview branch (fresh DB): adds the columns so the next migration's
--     view creation succeeds.
--
-- Timestamp 20260216155524 is intentionally one second BEFORE the failing
-- migration so this runs first when migrations replay alphabetically.
-- ============================================================================

ALTER TABLE public.livestreams ADD COLUMN IF NOT EXISTS streaming_provider TEXT;
ALTER TABLE public.livestreams ADD COLUMN IF NOT EXISTS hls_url             TEXT;
