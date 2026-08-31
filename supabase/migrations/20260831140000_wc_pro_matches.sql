-- ============================================================================
-- World Cup 2026 (Đà Nẵng) — OPEN/Pro individual events live feed.
--
-- The five Pro individual draws — men's & women's singles, men's & women's
-- doubles, and mixed doubles — are being played now (the individual tournament
-- started Aug 30) with live scores. This table backs the /live "Cá nhân Pro"
-- panel, which shows the matches being played (live score, ball by ball) and
-- every match involving a Vietnamese player, newest first.
--
-- Scope is ONLY the five pro_* individual events — amateur, junior, senior and
-- master draws are filtered out at the parser (categoryId prefix pro_).
--
-- ── Why this table looks the way it does ───────────────────────────────────
-- The organizers' /pwc2026/live page server-renders only scheduled and
-- in_progress matches; a match that FINISHES drops out of that payload
-- entirely, and no public page carries a completed match's final score (the
-- app lazy-loads that per match from Firestore, client-side). So "recent
-- results" cannot be scraped directly. Instead the worker keeps history: when
-- a match it last saw in_progress disappears from the feed, it marks the stored
-- row `completed` and KEEPS the last score it saw. That is why `status` here
-- includes 'completed' even though the source status never does, and why the
-- score columns are the last-observed score, not a guaranteed final.
--
-- ── Vietnamese players ─────────────────────────────────────────────────────
-- The source has no reliable per-player nationality (the registry leaves it
-- blank for most, Vietnamese players included). But entrants register under
-- their real names, and Vietnamese names carry diacritics no other Latin-script
-- name uses (đ, ơ, ư, ă/â/ê/ô families). `is_vietnam` is the parser's
-- best-effort call from the name; it is a heuristic, not an official flag, and
-- is stored so the UI can sort Vietnam first without re-deriving it per render.
--
-- Public-read, service-role-write, like the wc_open_* tables.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wc_pro_matches (
  -- organizers' own match id, e.g. "pro_singles_mens____pro_singles_mens__m105".
  match_id       text PRIMARY KEY,
  category_id    text NOT NULL,   -- pro_singles_mens | pro_singles_womens | pro_doubles_mens | pro_doubles_womens | pro_mixed
  division_name  text,
  round_name     text,            -- "Round of 32", "Quarterfinal", "Final"…
  round_num      integer,
  match_index    integer,

  -- entrants. teamName is one player (singles) or "A / B" (doubles), verbatim
  -- from the source so Vietnamese names keep their diacritics.
  entry_a_name   text,
  entry_a_seed   integer,
  entry_b_name   text,
  entry_b_seed   integer,

  -- score. current_game_* is the game in play; games_json is the array of
  -- finished games ([{a,b}, …]) so the UI can show "21-15, 12-15, 15-9". Both
  -- are the last values the scraper observed — see the header on completed.
  current_a      integer,
  current_b      integer,
  games_json     jsonb NOT NULL DEFAULT '[]'::jsonb,
  serving_side   text CHECK (serving_side IN ('A', 'B') OR serving_side IS NULL),
  -- 'A' | 'B' | null. For in_progress this is who leads the current game; for
  -- completed it is the last-observed leader — the closest we get to a winner
  -- without an official result field.
  leader_side    text CHECK (leader_side IN ('A', 'B') OR leader_side IS NULL),

  status         text NOT NULL DEFAULT 'scheduled'
                 CHECK (status IN ('scheduled', 'in_progress', 'completed')),
  is_vietnam     boolean NOT NULL DEFAULT false,

  venue_name     text,
  court_label    text,
  referee_name   text,
  scheduled_at   timestamptz,     -- Vietnam time stored as UTC
  -- when the scraper last saw this match in the source; drives the "kept as a
  -- result after it dropped out" logic and the newest-first ordering.
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.wc_pro_matches IS
  'World Cup 2026 Pro individual matches (5 events). Live + Vietnamese matches; completed rows keep last-observed score (source drops finished matches). Public read.';

CREATE INDEX IF NOT EXISTS wc_pro_matches_cat_idx    ON public.wc_pro_matches (category_id, round_num, match_index);
CREATE INDEX IF NOT EXISTS wc_pro_matches_status_idx ON public.wc_pro_matches (status);
CREATE INDEX IF NOT EXISTS wc_pro_matches_vn_idx     ON public.wc_pro_matches (is_vietnam) WHERE is_vietnam;
CREATE INDEX IF NOT EXISTS wc_pro_matches_seen_idx   ON public.wc_pro_matches (last_seen_at DESC);

ALTER TABLE public.wc_pro_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "WC pro matches are publicly viewable"
  ON public.wc_pro_matches FOR SELECT USING (true);

-- Realtime — the /live Pro panel repaints on every scraped score change.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wc_pro_matches;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
