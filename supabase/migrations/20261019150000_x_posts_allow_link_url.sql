-- 19/10/2026: X is posted from Cuong's Chrome (scripts/ops/x_browser_post.py,
-- worker X_VIA_BROWSER=1), where a link reply is free. x-draft now files the EN
-- article URL in link_url and the browser job replies it under the post.
-- This is the reversal 20260816090500 documented: drop the constraint, nothing
-- else. If X goes back to the API, re-add it (link replies cost $0.20 there).
ALTER TABLE public.x_posts DROP CONSTRAINT IF EXISTS x_posts_no_link_url;
