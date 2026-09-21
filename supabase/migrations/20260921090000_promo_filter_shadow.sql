-- ============================================================================
-- Shadow log for the promotional-news filter.
--
-- `workers/social-poster/src/promo-filter.ts` decides with 26 hand-written
-- regexes whether a news item is an advert. It is binary: a title that matches
-- nothing is treated as certainly clean. That is how the Six Zero paddle
-- release got through to both Facebook pages on 2026-08-17 — it matched no
-- pattern, so there was no "not sure" to catch it.
--
-- This table records what TypeSafe's Jev model would have said about the same
-- item, WITHOUT changing any decision. The regex still decides. We collect two
-- weeks of both opinions and then look at where they disagree.
--
-- The read, after the trial:
--
--   SELECT pipeline, regex_blocked, count(*),
--          round(avg(jev_noul), 3) AS avg_noul
--     FROM public.promo_filter_shadow
--    GROUP BY 1, 2 ORDER BY 1, 2;
--
--   -- items the regex let through that Jev thinks are adverts (the Six Zero shape)
--   SELECT title, jev_noul FROM public.promo_filter_shadow
--    WHERE regex_blocked = false AND jev_noul > 0.6 ORDER BY jev_noul DESC;
--
--   -- items the regex blocked that Jev thinks are real news (over-blocking)
--   SELECT title, jev_noul FROM public.promo_filter_shadow
--    WHERE regex_blocked = true AND jev_noul < 0.3 ORDER BY jev_noul;
--
-- One row per (news item, pipeline): the Worker inserts with
-- `Prefer: resolution=ignore-duplicates`, so the first observation wins and a
-- cron that re-sees the same candidate every 5 minutes does not flood the
-- table.
--
-- Service-role only, same shape as wc_scraper_ops: RLS on with no policy, so
-- anon and authenticated see nothing and the Worker writes with the service
-- key. Drop the table when the trial is over — nothing reads it in the app.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.promo_filter_shadow (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  news_item_id  uuid NOT NULL REFERENCES public.news_items(id) ON DELETE CASCADE,
  -- 'facebook' posts the Vietnamese child row, 'x' the English parent. Jev is
  -- strongest in English, so the two are kept apart rather than pooled: the
  -- English half is the honest read on the model, the Vietnamese half is the
  -- thing we actually have to measure before trusting it here.
  pipeline      text NOT NULL CHECK (pipeline IN ('facebook', 'x')),
  language      text,
  title         text NOT NULL,
  /** What promo-filter.ts decided. This is the verdict that was acted on. */
  regex_blocked boolean NOT NULL,
  /** Jev's probability the item is an advert, 0..1. Recorded, never acted on. */
  jev_noul      numeric(5, 4) NOT NULL,
  model         text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (news_item_id, pipeline)
);

COMMENT ON TABLE public.promo_filter_shadow IS
  'Shadow-mode comparison between the regex promo filter and TypeSafe Jev. Observational only — no pipeline reads it. Service-role only.';

ALTER TABLE public.promo_filter_shadow ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promo_filter_shadow FROM anon, authenticated;
