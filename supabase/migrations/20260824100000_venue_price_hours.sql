-- ============================================================================
-- venues: price range + provenance flags for price/hours
-- ----------------------------------------------------------------------------
-- PRICE-01 (2026-08-24). Until now `venues` held no price column at all and
-- `hours_json` was populated on 0 of 760 rows, so /san detail pages rendered
-- 155-271 words with no answer to the two questions a court searcher actually
-- has: what does it cost, and is it open.
--
-- The provenance columns are the important part. Court prices arrive from three
-- very different places and they must not be indistinguishable once stored:
--
--   'partner' — a real figure for THIS venue, imported from a booking source.
--   'manual'  — entered or corrected by an admin.
--   'default' — NOT a fact about this venue. A blanket placeholder applied to
--               rows we have no figure for. It is identical across hundreds of
--               venues, so it must never be presented as that venue's price:
--               keep it out of <title>/<meta description>, and label it in the
--               body as a regional guide rather than a quote.
--
-- Without the flag, a backfill silently turns a placeholder into an assertion,
-- and there is no way to find the placeholders again to correct them. With it,
-- "show me every venue still on a guessed price" is one WHERE clause, and the
-- renderer can decide display policy per source without re-importing anything.
-- ============================================================================

alter table public.venues
  add column if not exists price_min_vnd  integer,
  add column if not exists price_max_vnd  integer,
  add column if not exists price_source   text,
  add column if not exists hours_source   text,
  add column if not exists price_updated_at timestamptz;

-- Cheap sanity rails. 1 VND and 800k both appeared in the 2026-08-24 import
-- sample (a 1 đ "price" is a seed row, not a court), so the floor is deliberate
-- rather than decorative.
alter table public.venues
  drop constraint if exists venues_price_range_sane;
alter table public.venues
  add constraint venues_price_range_sane check (
    (price_min_vnd is null and price_max_vnd is null)
    or (
      price_min_vnd >= 20000
      and price_max_vnd >= price_min_vnd
      and price_max_vnd <= 2000000
    )
  );

alter table public.venues
  drop constraint if exists venues_price_source_known;
alter table public.venues
  add constraint venues_price_source_known check (
    price_source is null or price_source in ('partner', 'manual', 'default')
  );

alter table public.venues
  drop constraint if exists venues_hours_source_known;
alter table public.venues
  add constraint venues_hours_source_known check (
    hours_source is null or hours_source in ('partner', 'manual', 'default')
  );

comment on column public.venues.price_source is
  'partner|manual|default. ''default'' means a blanket placeholder, NOT a fact '
  'about this venue — never render it as this venue''s price.';
comment on column public.venues.hours_source is
  'partner|manual|default. Same contract as price_source.';

-- Partial index: "which venues still carry a guessed price" is the maintenance
-- query this table will be asked most often, and it targets a shrinking subset.
create index if not exists venues_price_source_default_idx
  on public.venues (city)
  where price_source = 'default';

-- The SSR renderer reads venues with the service role; anon reads go through
-- the existing venues select policy, which is column-agnostic. No new grants.
