-- ============================================================================
-- Sprint 7 follow-up — matches.verified_at column
-- ============================================================================
-- Two related bugs noticed on /feed:
--
-- 1. Card timestamp wrong: cards render `played_at` (the bracket's
--    scheduled match start), which can be many hours older than when
--    we actually scraped the result. Users see a freshly-resolved
--    match labelled "16h ago" and assume it's stale news.
--
-- 2. Fresh results don't surface: get_feed_timeline's score uses
--    played_at as the recency anchor, so a match whose pending→verified
--    flip just happened sinks into the middle of the feed instead of
--    surfacing at the top.
--
-- Fix shape: add `verified_at TIMESTAMPTZ`, set it on the
-- pending→verified flip in pro-tour-ingest, and have the feed RPC
-- COALESCE(verified_at, played_at) when ranking. The card UI keeps
-- showing played_at (the actual match time) — only the *ranking anchor*
-- shifts to "when this became news".
--
-- Backfill: leave existing rows at NULL. COALESCE falls back to
-- played_at so legacy verified matches keep their current feed age. Only
-- fresh pending→verified flips going forward get the new behavior.
--
-- Index: partial DESC index on verified_at IS NOT NULL. The feed RPC
-- doesn't filter on this column directly (it's read via COALESCE in the
-- match_rows CTE), so the index isn't strictly required for the feed
-- query — but admins will want to query "recently verified pro tour
-- matches" via the dashboard, and the index makes that O(log n).
--
-- IDEMPOTENT — IF NOT EXISTS on column + index.
-- ============================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.matches.verified_at IS
  'Timestamp when this match transitioned from pending to verified '
  'via pro-tour-ingest. NULL for matches that landed verified-from-the-'
  'start (retroactive imports) and for community matches. Read via '
  'COALESCE(verified_at, played_at) by get_feed_timeline as the feed '
  'recency anchor.';

CREATE INDEX IF NOT EXISTS idx_matches_verified_at
  ON public.matches(verified_at DESC)
  WHERE verified_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
