-- ============================================================================
-- Sprint 7 PR-A — Live scoring + alerts foundation
-- ============================================================================
-- Skeleton schema for live match support + admin scrape-failure alert
-- preferences. SSE parser + email-send wiring land in subsequent PRs;
-- this migration ships the columns / tables they'll write to so the
-- surrounding integration code (Worker Durable Object, alert trigger,
-- admin UI tab) can be reviewable in PR-A.
--
-- Anti-scope:
--   - No realtime channel publication (Sprint 7 PR-B once SSE format
--     captured from a live PPA event)
--   - No actual email send job (PR-B wires Resend integration)
--   - No DUPR API tie-in (defer)
--
-- IDEMPOTENT: replay-safe via DO blocks + IF NOT EXISTS guards.
-- ============================================================================

-- ─── 1. matches — live state columns ──────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='is_live') THEN
    ALTER TABLE public.matches ADD COLUMN is_live BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='live_started_at') THEN
    ALTER TABLE public.matches ADD COLUMN live_started_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='live_ended_at') THEN
    ALTER TABLE public.matches ADD COLUMN live_ended_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='matches' AND column_name='current_game') THEN
    -- 1..5 for best-of-5 doubles, 1..3 for best-of-3 singles. NULL when
    -- match isn't currently live.
    ALTER TABLE public.matches ADD COLUMN current_game INT;
  END IF;
END $$;

ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_current_game_range;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_current_game_range
  CHECK (current_game IS NULL OR (current_game >= 1 AND current_game <= 5));

-- Partial index — hot-path query is "matches currently live" for the
-- live-now feed surface (Sprint 7 PR-B). Tiny because is_live=true is
-- rare; partial index ~free.
CREATE INDEX IF NOT EXISTS idx_matches_live
  ON public.matches (live_started_at DESC)
  WHERE is_live = TRUE;

-- ─── 2. pro_tour_alert_subscriptions ─────────────────────────────────────
-- Admin-level email preferences for scrape-failure alerts. Trigger on
-- pro_tour_ingestion_logs (PR-B) reads this table to decide which
-- admins to email. Subscriptions vs binary prefs because future
-- variants (per-source, severity threshold) extend the row shape.

CREATE TABLE IF NOT EXISTS public.pro_tour_alert_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  alert_on_failed BOOLEAN NOT NULL DEFAULT TRUE,
  alert_on_partial BOOLEAN NOT NULL DEFAULT FALSE,
  -- Per-source filter — empty array = all sources, otherwise restricts.
  source_filter   TEXT[] DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, email)
);

ALTER TABLE public.pro_tour_alert_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alert_subs_admin_all" ON public.pro_tour_alert_subscriptions;
CREATE POLICY "alert_subs_admin_all"
  ON public.pro_tour_alert_subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.pro_tour_alert_subscriptions TO authenticated;

NOTIFY pgrst, 'reload schema';
