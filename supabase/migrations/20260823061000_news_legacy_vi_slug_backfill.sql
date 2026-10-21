-- 55 published news rows have had no slug since February. Found 2026-08-23.
--
-- Shape: Vietnamese title and summary, ~300 chars, no source_url, no
-- content_html, language = 'en' though not a word of them is English,
-- published 2026-02-01 → 2026-03-31. With no slug there is no URL — /news
-- renders them as dead, unclickable cards and no crawler can reach them.
--
-- The first instinct (give them slugs) was wrong, and the unique index
-- uniq_news_items_origin_language is what said so: 54 of the 55 share an
-- origin_id with a DIFFERENT vi row that is already published and already
-- has a slug. They are superseded drafts of articles we re-published later
-- — "Cấm dùng vợt Proton…" vs the live "PPA chính thức cấm sử dụng vợt
-- Proton…", same origin. Slugging them would have shipped 54 near-duplicate
-- Vietnamese pages competing with their own replacements.
--
-- So: retire the 54, publish the 1 that is genuinely unpaired.
--
-- Reversible: status is the only column touched on the 54, and the one
-- promoted row can be reverted by nulling slug and setting language back.

-- 1. The 54 superseded copies — draft removes them from /news and from every
--    sitemap without deleting anything.
UPDATE public.news_items AS old
SET status     = 'draft',
    updated_at = now()
WHERE old.status = 'published'
  AND old.slug IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.news_items AS live
    WHERE live.origin_id = old.origin_id
      AND live.id       <> old.id
      AND live.language  = 'vi'
      AND live.status    = 'published'
      AND live.slug IS NOT NULL
  );

-- 2. The remaining row has no sibling at all: real Vietnamese content that
--    simply predates the slug column. Give it the aggregator's own slug shape
--    (<slugified-title>-<first 8 of id>) using product_slug_from_title — the
--    Vietnamese-safe slugifier fixed in 433610ae — and label it 'vi' so it
--    serves from /vi/news/<slug> instead of claiming to be English.
UPDATE public.news_items
SET slug       = public.product_slug_from_title(title) || '-' || left(id::text, 8),
    language   = 'vi',
    updated_at = now()
WHERE status = 'published'
  AND slug IS NULL;
