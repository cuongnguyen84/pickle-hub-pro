-- ============================================================================
-- Sprint 4 Phase 4B — Kudos toggle RPC + orphan cleanup trigger
-- ============================================================================
-- Path B: reuses the polymorphic public.kudos table from Sprint 1
-- (20260503131017_bet1_social_layer.sql). target_type = 'match',
-- target_id = matches.id. No new table.
--
-- The kudos table has UNIQUE (user_id, target_type, target_id) so the toggle
-- semantics are encoded in the schema — there is at most one row per
-- (user, target_type, target). Idempotent.
--
-- Orphan protection: the polymorphic kudos.target_id has no FK enforcement.
-- When a match is deleted (rare for verified matches, but possible for
-- pending/disputed/expired), kudos rows would orphan with no cascade.
-- A BEFORE DELETE trigger on matches scrubs them. social_comments has the
-- same orphan exposure today (Sprint 1) but is out-of-scope for this PR;
-- Phase 4C will likely mirror the trigger.
-- ============================================================================

-- ─── 1. cleanup_match_kudos trigger ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cleanup_match_kudos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.kudos
  WHERE target_type = 'match' AND target_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS cleanup_kudos_on_match_delete ON public.matches;
CREATE TRIGGER cleanup_kudos_on_match_delete
  BEFORE DELETE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_match_kudos();

-- ─── 2. toggle_match_kudos RPC ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.toggle_match_kudos(UUID);

CREATE OR REPLACE FUNCTION public.toggle_match_kudos(p_match_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_existed   BOOLEAN;
  v_new_count INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  -- Verify the match exists. The polymorphic kudos table has no FK to
  -- matches.id, so without this guard a typo'd match_id would silently
  -- insert a kudos row pointing nowhere.
  IF NOT EXISTS (SELECT 1 FROM public.matches WHERE id = p_match_id) THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.kudos
    WHERE target_type = 'match'
      AND target_id   = p_match_id
      AND user_id     = v_user_id
  ) INTO v_existed;

  IF v_existed THEN
    DELETE FROM public.kudos
    WHERE target_type = 'match'
      AND target_id   = p_match_id
      AND user_id     = v_user_id;
  ELSE
    -- ON CONFLICT DO NOTHING guards against the (rare) race where the
    -- viewer's parallel tab inserted the same row between our SELECT and
    -- INSERT. UNIQUE (user_id, target_type, target_id) is the underlying
    -- constraint we're absorbing here.
    INSERT INTO public.kudos (user_id, target_type, target_id)
    VALUES (v_user_id, 'match', p_match_id)
    ON CONFLICT (user_id, target_type, target_id) DO NOTHING;
  END IF;

  SELECT COUNT(*)::INT INTO v_new_count
  FROM public.kudos
  WHERE target_type = 'match' AND target_id = p_match_id;

  RETURN jsonb_build_object(
    'kudoed', NOT v_existed,
    'count',  v_new_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_match_kudos(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
