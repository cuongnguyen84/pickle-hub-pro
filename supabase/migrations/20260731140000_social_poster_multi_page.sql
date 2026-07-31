-- Multi-page Facebook publishing with independent idempotency and first-link
-- comment state. Existing rows belong to the original ThePickleHub Page and
-- are marked comment-skipped so rollout never comments on historical posts.
ALTER TABLE public.fb_post_log
  ADD COLUMN IF NOT EXISTS page_id text,
  ADD COLUMN IF NOT EXISTS page_key text,
  ADD COLUMN IF NOT EXISTS link_comment_id text,
  ADD COLUMN IF NOT EXISTS link_comment_status text
    CHECK (link_comment_status IN ('pending', 'posted', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS link_comment_error text,
  ADD COLUMN IF NOT EXISTS link_comment_attempt_count integer NOT NULL DEFAULT 0;

UPDATE public.fb_post_log
SET page_id = '733412503190219',
    page_key = 'thepicklehub',
    link_comment_status = 'skipped'
WHERE page_id IS NULL;

ALTER TABLE public.fb_post_log
  ALTER COLUMN page_id SET NOT NULL,
  ALTER COLUMN page_key SET NOT NULL,
  ALTER COLUMN link_comment_status SET DEFAULT 'pending';

DROP INDEX IF EXISTS public.fb_post_log_news_item_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS fb_post_log_news_item_page_key
  ON public.fb_post_log (news_item_id, page_id);

CREATE INDEX IF NOT EXISTS fb_post_log_page_posted_at_idx
  ON public.fb_post_log (page_id, posted_at DESC)
  WHERE status = 'posted';

CREATE INDEX IF NOT EXISTS fb_post_log_comment_retry_idx
  ON public.fb_post_log (page_id, updated_at)
  WHERE status = 'posted'
    AND link_comment_status IN ('pending', 'failed');

COMMENT ON TABLE public.fb_post_log IS
  'Per-news, per-Facebook-Page post and first-link-comment audit trail for social-poster.';
