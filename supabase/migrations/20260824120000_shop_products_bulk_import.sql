-- ============================================================================
-- Bulk AI product import — adds enrichment metadata columns to public.products.
--
-- The products table and its RLS already exist (migration 20260811120000).
-- This migration only adds:
--   * import_batch_id — groups rows from one bulk upload
--   * ai_enriched / ai_confidence / ai_source_urls — Gemini enrichment audit
--
-- IDEMPOTENT — replay-safe.
-- ============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS import_batch_id UUID,
  ADD COLUMN IF NOT EXISTS ai_enriched BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS ai_source_urls TEXT[] DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_ai_confidence_range'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_ai_confidence_range CHECK (
        ai_confidence IS NULL OR (ai_confidence >= 0.00 AND ai_confidence <= 1.00)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_import_batch ON public.products (import_batch_id);

COMMENT ON COLUMN public.products.import_batch_id IS
  'Groups product rows created by the same bulk-import upload. NULL = manual creation.';
COMMENT ON COLUMN public.products.ai_enriched IS
  'TRUE when Gemini auto-filled this row from a bare product name.';
