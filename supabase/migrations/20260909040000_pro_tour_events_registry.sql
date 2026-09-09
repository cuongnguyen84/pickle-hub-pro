-- Pro-tour event registry moves from src/content/pro-tour-events.ts (code,
-- needs a deploy per event) into the database, so adding an event in
-- /admin/pro-tour makes the homepage/live strip + /live/pro/<slug> page
-- appear on their own (Cuong, 2026-09-09).
--
-- Read: public (the strip and the SSR renderer serve anonymous traffic).
-- Write: admin only, same shape as pro_tour_watchlist policies.

CREATE TABLE IF NOT EXISTS public.pro_tour_events (
  slug          TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{3,80}$'),
  -- ilike pattern matched against matches.tournament_name (scraper output).
  name_pattern  TEXT NOT NULL,
  name_en       TEXT NOT NULL,
  name_vi       TEXT NOT NULL,
  tier          TEXT NOT NULL,
  tour          TEXT NOT NULL DEFAULT 'PPA Tour Asia',
  sponsor       TEXT,
  city          TEXT NOT NULL,
  country       TEXT NOT NULL,
  country_code  TEXT NOT NULL DEFAULT 'MY',
  venue         TEXT,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  official_url  TEXT NOT NULL,
  brackets_url  TEXT NOT NULL,
  prize_money   TEXT,
  logo_url      TEXT,
  brand_bg      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

ALTER TABLE public.pro_tour_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_tour_events_public_read" ON public.pro_tour_events;
CREATE POLICY "pro_tour_events_public_read"
  ON public.pro_tour_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pro_tour_events_admin_write" ON public.pro_tour_events;
CREATE POLICY "pro_tour_events_admin_write"
  ON public.pro_tour_events FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- GRANT trước RLS (bài học missing-grants sweep 02/08): RLS không thay GRANT.
GRANT SELECT ON public.pro_tour_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pro_tour_events TO authenticated;

-- Seed: the four events the code registry shipped with (#753/#756).
INSERT INTO public.pro_tour_events
  (slug, name_pattern, name_en, name_vi, tier, tour, sponsor, city, country,
   country_code, venue, start_date, end_date, official_url, brackets_url,
   prize_money, logo_url, brand_bg)
VALUES
  ('ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026',
   '%Leapmotor%Kuala Lumpur%2026%',
   'PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026',
   'PPA Asia 1000 Leapmotor Kuala Lumpur Cup 2026',
   'PPA Asia 1000', 'PPA Tour Asia', 'Leapmotor', 'Kuala Lumpur', 'Malaysia',
   'MY', 'The Hood, Jalan Ipoh', '2026-09-09', '2026-09-13',
   'https://www.ppatour-asia.com/tournament/2026/kuala-lumpur-cup/',
   'https://pickleballtournaments.com/tournaments/ppa-asia-1000-leapmotor-kuala-lumpur-cup-2026/events',
   'US$300,000', '/images/events/kl-cup-2026-badge.png',
   'linear-gradient(135deg, #10283d 0%, #1c405f 55%, #16324a 100%)'),
  ('ppa-asia-500-skechers-shenzhen-open-2026',
   '%Shenzhen Open 2026%',
   'PPA Asia 500 Skechers Shenzhen Open 2026',
   'PPA Asia 500 Skechers Shenzhen Open 2026',
   'PPA Asia 500', 'PPA Tour Asia', 'Skechers', 'Shenzhen', 'China', 'CN',
   NULL, '2026-08-19', '2026-08-23',
   'https://www.ppatour-asia.com/',
   'https://pickleballtournaments.com/tournaments/ppa-asia-500-skechers-shenzhen-open-2026/events',
   NULL, NULL, NULL),
  ('ppa-asia-500-mb-ho-chi-minh-city-open-2026',
   '%Ho Chi Minh City Open 2026%',
   'PPA Asia 500 MB Ho Chi Minh City Open 2026',
   'PPA Asia 500 MB Ho Chi Minh City Open 2026',
   'PPA Asia 500', 'PPA Tour Asia', 'MB', 'Ho Chi Minh City', 'Vietnam', 'VN',
   NULL, '2026-08-05', '2026-08-09',
   'https://www.ppatour-asia.com/',
   'https://pickleballtournaments.com/tournaments/ppa-asia-500-mb-ho-chi-minh-city-open-2026/events',
   NULL, NULL, NULL),
  ('ppa-asia-500-leapmotor-singapore-open-2026',
   '%Leapmotor Singapore Open 2026%',
   'PPA Asia 500 Leapmotor Singapore Open 2026',
   'PPA Asia 500 Leapmotor Singapore Open 2026',
   'PPA Asia 500', 'PPA Tour Asia', 'Leapmotor', 'Singapore', 'Singapore',
   'SG', NULL, '2026-07-22', '2026-07-26',
   'https://www.ppatour-asia.com/',
   'https://pickleballtournaments.com/tournaments/ppa-asia-500-singapore-open-2026/events',
   NULL, NULL, NULL)
ON CONFLICT (slug) DO NOTHING;
