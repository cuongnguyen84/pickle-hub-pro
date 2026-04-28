-- ============================================================================
-- Fix: missing table grants on creator/admin write tables
--
-- Symptom (2026-04-28): Creator Studio video upload (after RLS storage fix
-- in 20260428000001) now fails with:
--   "Error creating video: permission denied for table videos"
--
-- Root cause: 4 tables (videos, tournaments, organizations, livestreams)
-- created in migration 20251221153808 with full RLS policies but ZERO GRANT
-- statements. Postgres checks object-level GRANT BEFORE RLS, so all
-- authenticated INSERT/UPDATE/DELETE calls from the frontend hit error
-- 42501 ("permission denied for table") before any RLS policy runs. The
-- SQL Editor in Dashboard worked because super-user bypasses both GRANT
-- and RLS — masking the bug at deploy time.
--
-- Pattern recurring — same fix already shipped twice:
--   migration 20260414000000 — vi_blog_posts
--   migration 20260425000000 — blog_post_views
--
-- Frontend hooks affected:
--   useCreatorData.ts → public.videos (INSERT/UPDATE/DELETE)
--   useAdminData.ts   → public.tournaments (INSERT)
--                       public.organizations (INSERT)
--                       public.livestreams (UPDATE/DELETE)
--
-- Note: livestreams INSERT goes through the mux-create-livestream edge
-- function with service_role, which bypasses GRANT — so only UPDATE/DELETE
-- on the client path needs the fix. We grant INSERT too for completeness
-- (RLS still gates writes; an unauthorized creator wouldn't pass the
-- existing INSERT policies).
--
-- MANUAL APPLY: paste into Supabase Dashboard → SQL Editor → Run.
-- Per .claude/memory/lessons-learned.md, do NOT use `supabase db push`
-- (40+ stale migrations make push risky).
-- ============================================================================

-- ── 1. Schema USAGE (likely already granted from earlier migrations,
--      but enforce so this migration is self-contained) ────────────────────
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── 2. Public read access (anon) for tables that show on /tournaments,
--      /videos, /live, /watch — same as existing app behavior ─────────────
GRANT SELECT ON public.videos        TO anon;
GRANT SELECT ON public.tournaments   TO anon;
GRANT SELECT ON public.organizations TO anon;
GRANT SELECT ON public.livestreams   TO anon;

-- ── 3. Authenticated CRUD — RLS policies are the actual gate ─────────────
--      (existing "Admins can manage all <table>" + "Creators can <verb>
--      their org <table>" policies remain in force; this just allows
--      Postgres to RUN them in the first place)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.livestreams   TO authenticated;

-- ── 4. Enum type USAGE — RLS policy comparisons against enum values
--      (status='live', type='short' etc.) need this to evaluate ───────────
GRANT USAGE ON TYPE public.video_type        TO anon, authenticated;
GRANT USAGE ON TYPE public.content_status    TO anon, authenticated;
GRANT USAGE ON TYPE public.tournament_status TO anon, authenticated;
GRANT USAGE ON TYPE public.livestream_status TO anon, authenticated;

-- ── 5. Reload PostgREST schema cache so changes apply immediately ─────────
NOTIFY pgrst, 'reload schema';
