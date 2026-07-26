-- ============================================================================
-- vi_blog_posts: enforce the SERP byte budget in the database.
-- ----------------------------------------------------------------------------
-- functions/_lib/html.ts truncates <title> at 60 UTF-8 BYTES and the meta
-- description at 160 (truncateForSeo), and the truncated string is what the
-- SERP and the bot-visible <h1> show. Vietnamese diacritics cost 2-3 bytes per
-- character, so VI copy that looks short in characters ships ellipsised.
--
-- Audit 2026-07-26 before this migration: 39 of 52 published rows had a title
-- over budget and 50 had a description over budget — i.e. almost every
-- Vietnamese SERP entry was truncated, on a site whose audience is ~95%
-- Vietnamese. All rows were rewritten the same day; this constraint stops the
-- admin CMS and the Gemini translation path from reintroducing the problem.
--
-- The EN half of the same class is guarded in CI by
-- src/content/blog/__tests__/seo-byte-budget.test.ts.
--
-- NULLs are allowed (the columns are nullable and the renderer has fallbacks).
-- ============================================================================

-- The two retired posts (status='merged', both 301'd away) are the only rows
-- still over budget. They are not served anywhere, but a table-wide constraint
-- has to hold for them too — trim rather than exempt.
update vi_blog_posts
set meta_title = left(meta_title, 40),
    meta_description = left(meta_description, 100)
where status = 'merged'
  and (octet_length(meta_title) > 60 or octet_length(meta_description) > 160);

alter table vi_blog_posts
  add constraint vi_blog_posts_meta_title_seo_bytes
  check (meta_title is null or octet_length(meta_title) <= 60);

alter table vi_blog_posts
  add constraint vi_blog_posts_meta_description_seo_bytes
  check (meta_description is null or octet_length(meta_description) <= 160);
