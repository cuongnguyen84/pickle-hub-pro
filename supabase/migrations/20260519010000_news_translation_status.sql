-- ============================================================================
-- News Aggregator Phase 3 — AI Translation queue columns
-- ----------------------------------------------------------------------------
-- Adds `ai_translation_status` and `ai_translation_error` to news_items so
-- the `news-translate` edge function can:
--   1. Pick up EN rows that haven't been translated yet
--   2. Mark them as 'translating' during the API call (claim the row)
--   3. Mark 'done' on success or 'failed' on error (with error message)
--
-- VI rows themselves don't use these columns — they're written by the
-- translate function and are the END of the pipeline. EN rows are the
-- SOURCE that needs status tracking.
--
-- Status state machine:
--   NULL (default for VI rows + legacy EN rows) — no action
--   'pending'    — EN row, waiting for translate run
--   'translating'— EN row, currently being processed (claimed by a run)
--   'done'       — EN row, VI sibling exists in DB
--   'failed'     — EN row, API call failed (see ai_translation_error)
--
-- A separate index on (status='pending', published_at) lets the function
-- pick the oldest pending rows cheaply.
-- ============================================================================

ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS ai_translation_status TEXT
    CHECK (ai_translation_status IN ('pending', 'translating', 'done', 'failed')),
  ADD COLUMN IF NOT EXISTS ai_translation_error TEXT,
  ADD COLUMN IF NOT EXISTS ai_translated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.news_items.ai_translation_status IS
  'EN rows only: pending → translating → done | failed. NULL on VI rows.';
COMMENT ON COLUMN public.news_items.ai_translation_error  IS
  'Last error message from the translate function (truncated to 500 chars).';
COMMENT ON COLUMN public.news_items.ai_translated_at      IS
  'Timestamp when the VI sibling was inserted (or last failure).';

-- Backfill: every existing EN row that doesn't already have a VI sibling is
-- marked 'pending' so the first translate run picks them up.
UPDATE public.news_items en
SET ai_translation_status = 'pending'
WHERE en.language = 'en'
  AND en.ai_translation_status IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.news_items vi
    WHERE vi.parent_news_id = en.id AND vi.language = 'vi'
  );

-- Mark EN rows that already have a VI sibling as 'done' (none today, but
-- safe to keep idempotent for future re-runs of this migration).
UPDATE public.news_items en
SET ai_translation_status = 'done',
    ai_translated_at = now()
WHERE en.language = 'en'
  AND en.ai_translation_status IS NULL
  AND EXISTS (
    SELECT 1 FROM public.news_items vi
    WHERE vi.parent_news_id = en.id AND vi.language = 'vi'
  );

-- Queue index — cron query picks the oldest pending EN rows.
CREATE INDEX IF NOT EXISTS idx_news_items_translation_queue
  ON public.news_items(ai_translation_status, published_at DESC)
  WHERE ai_translation_status = 'pending';
