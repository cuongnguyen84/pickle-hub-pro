-- Drop stale Phase 4A feed RPC overloads left behind by Phase 4B.
--
-- 20260508120000_feed_rpcs.sql (Phase 4A) created partial-return signatures:
--   get_following_feed(p_viewer_id uuid, p_limit int, p_cursor_played_at timestamptz)
--   get_trending_feed(p_limit int, p_cursor_played_at timestamptz,
--                     p_kudos_weight int, p_comments_weight int, p_recency_decay_hours int)
-- 20260508130001_feed_rpcs_with_kudos.sql (Phase 4B) added the full-return
-- signatures (with p_cursor_match_id / p_pro_boost + kudos_count/comment_count/
-- viewer_kudoed/notes) but did NOT drop these Phase 4A originals, so both
-- overloads lingered. The generated TS types then unioned the two Returns
-- shapes, and the union's first member lacks kudos_count/comment_count/
-- viewer_kudoed → 9 false tsc errors (7 RPC-contract tests + useFeedTimeline +
-- useTrendingFeed).
--
-- Safe to drop: the only callers (src/hooks/social/useFollowingFeed.ts,
-- useTrendingFeed.ts) pass p_cursor_match_id (and p_viewer_id for trending),
-- which by named-argument resolution can ONLY bind to the full overloads.
-- No edge function or internal SQL calls these RPCs. Verified 2026-06-09.

DROP FUNCTION IF EXISTS public.get_following_feed(uuid, integer, timestamptz);
DROP FUNCTION IF EXISTS public.get_trending_feed(integer, timestamptz, integer, integer, integer);

NOTIFY pgrst, 'reload schema';
