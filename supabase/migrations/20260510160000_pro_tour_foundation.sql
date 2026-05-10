-- ============================================================================
-- Sprint 6 — PPA Tour data integration foundation
-- ============================================================================
-- Schema additions to support importing pro-tour match results from external
-- sources (PPA Tour, APP Tour, MLP, etc.) into the existing Feed/Trending
-- pipeline. Net-new tables for the watchlist + ingestion log; in-place
-- ALTERs on profiles + matches to attach source provenance.
--
-- Convention parity with prior Sprints:
--   - "Source provider" enum-like text + CHECK so future providers
--     (DUPR API, manual CSV upload) cost zero schema churn — just append
--     to the CHECK list.
--   - Indexes are idempotent (IF NOT EXISTS).
--   - RLS policies use DROP+CREATE pattern (no CREATE POLICY IF NOT EXISTS
--     since Postgres doesn't support that syntax — bit us in PR #16).
--   - Admin gates use the existing public.has_role() function from
--     20251221153808 + Sprint 5 PR-B's 'moderator' enum value
--     (20260510100000) — no new role plumbing needed.
--
-- Anti-scope (per spec):
--   - No live scoring fields here (Sprint 7 ships is_live + live_started_at)
--   - No DUPR snapshot fields tied to source (Sprint 7+)
--   - No tournament discovery table (Sprint 7 phase 1)
--   - No auto-merge of community profile when a real VN player matches a
--     pro_tour ghost (manual admin approve)
--
-- IDEMPOTENT: replay-safe via DO blocks + IF NOT EXISTS guards.
-- ============================================================================

-- ─── 1. profiles — source provenance ─────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='source_provider') THEN
    ALTER TABLE public.profiles ADD COLUMN source_provider TEXT NOT NULL DEFAULT 'community';
  END IF;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_source_provider_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_source_provider_check
  CHECK (source_provider IN ('community', 'ppa_tour', 'app_tour', 'mlp', 'other'));

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='external_id') THEN
    ALTER TABLE public.profiles ADD COLUMN external_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='external_url') THEN
    ALTER TABLE public.profiles ADD COLUMN external_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='country_code') THEN
    -- ISO 3166-1 alpha-2 (e.g. "VN", "US"). Length-2 enforced via CHECK.
    ALTER TABLE public.profiles ADD COLUMN country_code TEXT;
  END IF;
END $$;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_country_code_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_code_check
  CHECK (country_code IS NULL OR LENGTH(country_code) = 2);

-- Lookup index: idempotent re-import skips rows that already exist via
-- (source_provider, external_id) match. Partial index excludes the
-- community baseline (which always has external_id NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_source_external
  ON public.profiles (source_provider, external_id)
  WHERE source_provider <> 'community' AND external_id IS NOT NULL;

-- ─── 2. matches — source provenance + tournament context ─────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='source_provider') THEN
    ALTER TABLE public.matches ADD COLUMN source_provider TEXT NOT NULL DEFAULT 'community';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='source_url') THEN
    ALTER TABLE public.matches ADD COLUMN source_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='external_match_id') THEN
    ALTER TABLE public.matches ADD COLUMN external_match_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='tournament_name') THEN
    ALTER TABLE public.matches ADD COLUMN tournament_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='tournament_event') THEN
    ALTER TABLE public.matches ADD COLUMN tournament_event TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='round_name') THEN
    ALTER TABLE public.matches ADD COLUMN round_name TEXT;
  END IF;
END $$;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_source_provider_check;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_source_provider_check
  CHECK (source_provider IN ('community', 'ppa_tour', 'app_tour', 'mlp', 'other'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_source_external
  ON public.matches (source_provider, external_match_id)
  WHERE source_provider <> 'community' AND external_match_id IS NOT NULL;

-- ─── 3. pro_tour_watchlist ────────────────────────────────────────────────
-- Tournaments admins want re-scraped on a schedule. The Worker cron job
-- (workers/pro-tour-scraper) consults this table every 6h and triggers
-- a scrape for any row where next_scrape_at < NOW() AND status='active'.

CREATE TABLE IF NOT EXISTS public.pro_tour_watchlist (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_url      TEXT NOT NULL UNIQUE,
  tournament_name     TEXT,
  source_provider     TEXT NOT NULL DEFAULT 'ppa_tour'
                      CHECK (source_provider IN ('community','ppa_tour','app_tour','mlp','other')),
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','completed')),
  scrape_frequency    TEXT NOT NULL DEFAULT 'manual'
                      CHECK (scrape_frequency IN ('daily','weekly','on_event_end','manual')),
  last_scraped_at     TIMESTAMPTZ,
  next_scrape_at      TIMESTAMPTZ,
  added_by_user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watchlist_next_scrape
  ON public.pro_tour_watchlist (next_scrape_at)
  WHERE status = 'active';

ALTER TABLE public.pro_tour_watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist_admin_all" ON public.pro_tour_watchlist;
CREATE POLICY "watchlist_admin_all"
  ON public.pro_tour_watchlist FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_tour_watchlist TO authenticated;

-- ─── 4. pro_tour_ingestion_logs ───────────────────────────────────────────
-- Audit trail for every scrape attempt. Admin UI tab 3 paginates this
-- ordered by started_at DESC. Failed runs surface error_message + payload
-- so Cuong can debug without diving into Worker logs.

CREATE TABLE IF NOT EXISTS public.pro_tour_ingestion_logs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_provider          TEXT NOT NULL,
  source_url               TEXT NOT NULL,
  triggered_by             TEXT NOT NULL DEFAULT 'manual'
                           CHECK (triggered_by IN ('manual','scheduled')),
  triggered_by_user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  watchlist_id             UUID REFERENCES public.pro_tour_watchlist(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'queued'
                           CHECK (status IN ('queued','running','success','failed','partial')),
  matches_imported         INT NOT NULL DEFAULT 0,
  players_created          INT NOT NULL DEFAULT 0,
  players_matched          INT NOT NULL DEFAULT 0,
  duration_ms              INT,
  error_message            TEXT,
  payload                  JSONB,
  started_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at             TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_started
  ON public.pro_tour_ingestion_logs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status
  ON public.pro_tour_ingestion_logs (status, started_at DESC)
  WHERE status IN ('failed', 'partial');

ALTER TABLE public.pro_tour_ingestion_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ingestion_logs_admin_all" ON public.pro_tour_ingestion_logs;
CREATE POLICY "ingestion_logs_admin_all"
  ON public.pro_tour_ingestion_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE ON public.pro_tour_ingestion_logs TO authenticated;

-- ─── 5. Extend get_trending_feed RPC to include pro_tour matches ─────────
-- The current trending RPC (Phase 4C) hardcodes participation criteria
-- around community matches. Pro tour matches have ghost participants and
-- no user kudos/comments, so they'd score only on recency_decay — fine.
-- Just need to drop the implicit community-only filter (none today —
-- but the future-self filter would have wanted source_provider='community';
-- documenting here that the RPC accepts ALL source_providers as of Sprint 6).
--
-- No RPC body change needed in this migration: get_trending_feed already
-- selects all m.* without a source_provider filter. Pro tour matches will
-- start appearing once the ingest job inserts them. This comment serves
-- as a load-bearing note for Sprint 6 PR review — verify by reading
-- the RPC body in 20260508140002_feed_rpcs_with_comments.sql.

NOTIFY pgrst, 'reload schema';
