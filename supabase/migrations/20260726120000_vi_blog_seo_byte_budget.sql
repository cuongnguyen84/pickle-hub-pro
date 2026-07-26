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

-- Trim any row that is still over budget BEFORE the constraint lands. On prod
-- this is a no-op (all 52 published rows were rewritten by hand the same day);
-- it exists so a fresh database built from migrations + seed data — which is
-- what the pgTAP CI job does — does not fail on fixture rows.
--
-- Byte-safe trim: cut at the last character whose cumulative UTF-8 cost still
-- fits, never mid-character (left(x, n) counts characters, so a Vietnamese
-- string can still be over budget after it).
create or replace function pg_temp.trim_to_bytes(txt text, max_bytes int)
returns text language sql immutable as $$
  select coalesce(string_agg(ch, '' order by idx), '')
  from (
    select ch, idx, sum(octet_length(ch)) over (order by idx) as running
    from regexp_split_to_table(txt, '') with ordinality as t(ch, idx)
  ) s
  where running <= max_bytes;
$$;

update vi_blog_posts
set meta_title = pg_temp.trim_to_bytes(meta_title, 60)
where meta_title is not null and octet_length(meta_title) > 60;

update vi_blog_posts
set meta_description = pg_temp.trim_to_bytes(meta_description, 160)
where meta_description is not null and octet_length(meta_description) > 160;

alter table vi_blog_posts
  drop constraint if exists vi_blog_posts_meta_title_seo_bytes;
alter table vi_blog_posts
  add constraint vi_blog_posts_meta_title_seo_bytes
  check (meta_title is null or octet_length(meta_title) <= 60);

alter table vi_blog_posts
  drop constraint if exists vi_blog_posts_meta_description_seo_bytes;
alter table vi_blog_posts
  add constraint vi_blog_posts_meta_description_seo_bytes
  check (meta_description is null or octet_length(meta_description) <= 160);
