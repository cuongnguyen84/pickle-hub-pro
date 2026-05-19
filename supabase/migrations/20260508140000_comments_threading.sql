-- ============================================================================
-- Sprint 4 Phase 4C — social_comments threading + cleanup trigger
-- ============================================================================
-- Path: minimal-modify the existing Sprint 1 social_comments table
-- (20260503140000_social_optionA_tables.sql). The table is unused in code
-- today (legacy public.comments handles blog/news/video; social_comments
-- is the polymorphic match/clip surface waiting for this PR).
--
-- What's already there:
--   id, user_id (→ profiles), target_type, target_id, parent_id (→ self),
--   body CHECK 1..2000, is_deleted boolean, created_at, updated_at
--   RLS: SELECT (is_deleted=false), INSERT (auth.uid=user_id),
--        UPDATE (auth.uid=user_id) — soft delete is the convention
--
-- Phase 4C changes:
--   1. ADD depth INT NOT NULL DEFAULT 0  with CHECK depth IN [0,4]
--   2. Tighten body CHECK 1..2000 → 1..500 (table empty, no migration risk)
--   3. updated_at default now() → NULL  so "edited" indicator is reliable
--      (created_at always set; updated_at NULL until first edit)
--   4. Partial indexes WHERE is_deleted = FALSE for hot read paths
--   5. UPDATE WITH CHECK on the self_update policy (was missing)
--   6. cleanup_match_comments() BEFORE DELETE trigger on matches —
--      mirrors Phase 4B kudos cleanup; polymorphic target_id has no FK
--
-- IDEMPOTENT: every ADD/DROP guarded by IF NOT EXISTS / IF EXISTS, every
-- CREATE OR REPLACE for functions/triggers.
-- ============================================================================

-- ─── 1. ADD depth column ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'social_comments'
      AND column_name = 'depth'
  ) THEN
    ALTER TABLE public.social_comments
      ADD COLUMN depth INT NOT NULL DEFAULT 0;
  END IF;
END $$;

ALTER TABLE public.social_comments
  DROP CONSTRAINT IF EXISTS social_comments_depth_max;
ALTER TABLE public.social_comments
  ADD CONSTRAINT social_comments_depth_max CHECK (depth >= 0 AND depth <= 4);

-- ─── 2. Tighten body length 2000 → 500 ───────────────────────────────────
-- Drop the original constraint then re-add narrower. Existing constraint
-- name varies by Postgres version; query pg_constraint to find it.
DO $$
DECLARE
  v_conname TEXT;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.social_comments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%length(body)%';
  IF v_conname IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.social_comments DROP CONSTRAINT %I',
      v_conname
    );
  END IF;
END $$;

ALTER TABLE public.social_comments
  DROP CONSTRAINT IF EXISTS social_comments_body_length;
ALTER TABLE public.social_comments
  ADD CONSTRAINT social_comments_body_length
    CHECK (LENGTH(body) BETWEEN 1 AND 500);

-- ─── 3. updated_at: drop NOW() default so NULL means "never edited" ──────
ALTER TABLE public.social_comments
  ALTER COLUMN updated_at DROP DEFAULT;
-- For any rows that already have updated_at = created_at (default-on-insert
-- artifact), null them out so the "edited" indicator doesn't lie. Empty
-- table today, but defensive.
UPDATE public.social_comments
   SET updated_at = NULL
 WHERE updated_at = created_at;

-- ─── 4. Partial indexes for active comments ──────────────────────────────
-- The Sprint 1 migration created idx_social_comments_target on
-- (target_type, target_id, created_at DESC). Keep it (covers everything
-- including deleted rows for cleanup queries). Add narrower indexes that
-- match the hot read paths Phase 4C uses (get_match_comments + parent
-- lookups), filtered to is_deleted = FALSE so deleted rows skip the seek.
CREATE INDEX IF NOT EXISTS idx_social_comments_target_active
  ON public.social_comments (target_type, target_id, created_at ASC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_social_comments_parent_active
  ON public.social_comments (parent_id)
  WHERE is_deleted = FALSE AND parent_id IS NOT NULL;

-- ─── 5. UPDATE WITH CHECK on self-update policy ──────────────────────────
-- The existing policy uses USING but no WITH CHECK, so a malicious viewer
-- could in theory UPDATE a row to set user_id to themselves. Tighten.
DROP POLICY IF EXISTS "social_comments_self_update" ON public.social_comments;
CREATE POLICY "social_comments_self_update"
  ON public.social_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 6. cleanup_match_comments trigger ───────────────────────────────────
-- Polymorphic target_id has no FK to matches.id, so a match delete would
-- otherwise leave orphan comment rows. Mirror Phase 4B's kudos cleanup
-- pattern. We DELETE outright (not soft-delete) on cascade because the
-- parent match is gone — there is nothing left to thread under.
CREATE OR REPLACE FUNCTION public.cleanup_match_comments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.social_comments
  WHERE target_type = 'match' AND target_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_comments_on_match_delete ON public.matches;
CREATE TRIGGER cleanup_comments_on_match_delete
  BEFORE DELETE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_match_comments();

NOTIFY pgrst, 'reload schema';
