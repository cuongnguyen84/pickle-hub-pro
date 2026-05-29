-- ============================================================================
-- Fix: news_items.ai_translation_status had no DEFAULT
-- ============================================================================
--
-- Bug history:
--   Migration 20260519010000_news_translation_status.sql added the column
--   `ai_translation_status TEXT` to news_items but forgot to set a DEFAULT.
--   news-fetcher Worker INSERTs without specifying this field, so every new
--   EN row landed with status=NULL. The claim RPC filters
--   `WHERE ai_translation_status = 'pending'`, so all NULL rows were silently
--   skipped — discovered 2026-05-21 when /news showed 15+ EN bài 24h without
--   any VI translation.
--
-- Fix:
--   1. ALTER COLUMN ... SET DEFAULT 'pending' — future INSERTs without the
--      field will land in pending state.
--   2. Backfill: UPDATE existing NULL rows to 'pending' so they get picked
--      up by the next cron run. Idempotent — only touches NULL rows.
-- ============================================================================

ALTER TABLE public.news_items
  ALTER COLUMN ai_translation_status SET DEFAULT 'pending';

-- Recover orphaned rows. Limit to language='en' to be safe — VI rows should
-- never have ai_translation_status set (they ARE the translation output).
UPDATE public.news_items
SET    ai_translation_status = 'pending'
WHERE  language = 'en'
  AND  ai_translation_status IS NULL;

COMMENT ON COLUMN public.news_items.ai_translation_status IS
  'Translation state machine for EN rows: pending → translating → done | failed. Defaults to pending so news-fetcher can rely on INSERT-without-field.';
