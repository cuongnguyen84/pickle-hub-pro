-- ============================================================================
-- Bug #19: One DUPR account → one ThePickleHub user
-- ----------------------------------------------------------------------------
-- profiles.dupr_id has UNIQUE NOT NULL semantics already (constraint
-- profiles_dupr_id_key). dupr_user_tokens didn't — a second user could
-- INSERT a token row for the same dupr_id and trigger a confusing 500 at
-- the profile UPDATE step (observed 2026-05-18 with tranthib-test trying
-- to claim ZNYDZP after testuser104 had already linked it).
--
-- Lock it down at the data layer too, so the SPA can no longer reach
-- an inconsistent state where a token row exists but the profile fields
-- never persisted.
--
-- Two changes:
--   1. Drop the non-unique helper index from migration 20260515000000.
--   2. Replace it with a partial UNIQUE index — only active rows count,
--      so a user who disconnects (revoked_at != NULL) can be replaced
--      by a fresh link from a different platform user.
-- ============================================================================

DROP INDEX IF EXISTS public.dupr_user_tokens_dupr_id_idx;

CREATE UNIQUE INDEX IF NOT EXISTS dupr_user_tokens_active_dupr_id_uidx
  ON public.dupr_user_tokens (dupr_id)
  WHERE revoked_at IS NULL;

COMMENT ON INDEX public.dupr_user_tokens_active_dupr_id_uidx IS
  'One ThePickleHub user per DUPR account at a time. Disconnecting (revoked_at != NULL) frees the slot.';

-- ─── Backfill cleanup: revoke duplicate active rows ────────────────────────
-- For any dupr_id with more than one active row, keep the earliest
-- connected_at and revoke the rest. Rare; only relevant if the bug
-- already produced duplicates in this environment.
WITH duplicates AS (
  SELECT
    user_id,
    dupr_id,
    ROW_NUMBER() OVER (PARTITION BY dupr_id ORDER BY connected_at) AS rn
  FROM public.dupr_user_tokens
  WHERE revoked_at IS NULL
)
UPDATE public.dupr_user_tokens t
   SET revoked_at = now(),
       webhook_subscribed_at = NULL
  FROM duplicates d
 WHERE t.user_id = d.user_id
   AND d.rn > 1;

NOTIFY pgrst, 'reload schema';
