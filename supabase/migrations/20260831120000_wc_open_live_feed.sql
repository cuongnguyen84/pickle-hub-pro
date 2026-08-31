-- ============================================================================
-- World Cup 2026 (Đà Nẵng) — OPEN national-team live feed.
--
-- Backs the /live World Cup panel: the 16 OPEN groups, their 64 national
-- teams, and the team ties as they are played. Data is scraped from the
-- organizers' public site (sporttora.com/pwc2026) by the wc-open-scraper
-- worker and written here through the service role; the public reads it.
--
-- Scope is deliberately ONLY the OPEN national-team competition — amateur,
-- junior, senior and master tiers are filtered out at the scraper before they
-- ever reach these tables (entryId prefix `open_team_coed__`), so nothing here
-- needs a tier column to exclude them.
--
-- ── Why three tables, not one ──────────────────────────────────────────────
--   wc_open_teams      one row per nation (64). Group letter, seed, bilingual
--                      name. This is the ONLY table with real data before the
--                      team competition starts on 2026-09-03 — the draw exists,
--                      the matches do not.
--   wc_open_matches    one row per nation-vs-nation tie. Scores stay null until
--                      a tie is played; `status` carries scheduled/live/final
--                      so the UI can render "chưa đấu" without inventing a 0-0.
--   wc_open_standings  computed group table (W/L, ties, points). A view would
--                      be cleaner, but the scraper reads the organizers' own
--                      standings rather than recomputing from matches, so this
--                      is a real table the worker writes.
--
-- ── Timeline this schema has to survive ────────────────────────────────────
--   Aug 31 – Sep 2   only wc_open_teams has rows; matches/standings empty.
--   Sep 3 – Sep 6    matches fill in; scores and standings update ~1-2 min.
--   after Sep 6      final. The /live panel is retired; tables can be dropped
--                    in a later migration or kept as a record.
--
-- All three are public-read (results are public information the organizers
-- already publish) and service-role-write only. No user ever writes here.
-- ============================================================================

-- ── 1. Teams — the draw ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wc_open_teams (
  -- organizers' own stable key, e.g. "viet_nam", "cayman_islands".
  slug           text PRIMARY KEY,
  group_letter   text NOT NULL,               -- "A".."P"
  seed           integer,                      -- null until seeded
  name_vi        text NOT NULL,
  name_en        text NOT NULL,
  country_code   text,                         -- ISO-ish, for a flag; may be null
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wc_open_teams IS
  'World Cup 2026 OPEN national teams (64), scraped from sporttora.com. Public read.';

CREATE INDEX IF NOT EXISTS wc_open_teams_group_idx
  ON public.wc_open_teams (group_letter, seed);

-- ── 2. Matches — the ties ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wc_open_matches (
  -- organizers' match id when known; synthesized as
  -- "<group>__<homeSlug>__<awaySlug>" until the source assigns one, so a tie
  -- has a stable identity before it is scheduled.
  match_id       text PRIMARY KEY,
  group_letter   text NOT NULL,
  round          text,                          -- "group" | "qf" | "sf" | "final" | "third"
  home_slug      text NOT NULL REFERENCES public.wc_open_teams(slug) ON DELETE CASCADE,
  away_slug      text NOT NULL REFERENCES public.wc_open_teams(slug) ON DELETE CASCADE,
  -- ties are decided over sub-matches; we store the tie score (matches won),
  -- not per-game points, because that is what a group table needs.
  home_score     integer,                       -- null until played
  away_score     integer,
  status         text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'live', 'final')),
  court          text,
  start_time     timestamptz,                   -- Vietnam time stored as UTC
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wc_open_matches IS
  'World Cup 2026 OPEN national-team ties. Scores null until played (team comp starts 2026-09-03). Public read.';

CREATE INDEX IF NOT EXISTS wc_open_matches_group_idx
  ON public.wc_open_matches (group_letter, start_time);
CREATE INDEX IF NOT EXISTS wc_open_matches_status_idx
  ON public.wc_open_matches (status);

-- ── 3. Standings — the group table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wc_open_standings (
  slug           text PRIMARY KEY REFERENCES public.wc_open_teams(slug) ON DELETE CASCADE,
  group_letter   text NOT NULL,
  rank           integer,                       -- 1..4 within group, null until computed
  ties_won       integer NOT NULL DEFAULT 0,
  ties_lost      integer NOT NULL DEFAULT 0,
  points_for     integer NOT NULL DEFAULT 0,    -- sub-match points aggregate
  points_against integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wc_open_standings IS
  'World Cup 2026 OPEN group standings, as published by the organizers. Public read.';

CREATE INDEX IF NOT EXISTS wc_open_standings_group_idx
  ON public.wc_open_standings (group_letter, rank);

-- ── 4. RLS — public read, service-role write ────────────────────────────────
-- Results are public information the organizers already publish, so SELECT is
-- open to everyone (anon + authenticated). No policy grants INSERT/UPDATE/
-- DELETE, so only the service role (which bypasses RLS) can write — exactly
-- the scraper. A logged-in user has no more write access than an anonymous one.
ALTER TABLE public.wc_open_teams     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_open_matches   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wc_open_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WC open teams are publicly viewable"
  ON public.wc_open_teams FOR SELECT USING (true);
CREATE POLICY "WC open matches are publicly viewable"
  ON public.wc_open_matches FOR SELECT USING (true);
CREATE POLICY "WC open standings are publicly viewable"
  ON public.wc_open_standings FOR SELECT USING (true);

-- ── 5. Realtime — the /live panel subscribes to changes ─────────────────────
-- The client listens for postgres_changes so a scraped update repaints the
-- panel without a refresh. Add the tables to the supabase_realtime publication.
-- Guarded: ALTER PUBLICATION ADD TABLE errors if the table is already a member.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wc_open_teams;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wc_open_matches;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wc_open_standings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
