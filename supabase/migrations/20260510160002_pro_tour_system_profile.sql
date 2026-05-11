-- ============================================================================
-- Sprint 6 Codex P1 fix — system profile for pro_tour match attribution
-- ============================================================================
-- The matches.recorded_by column is NOT NULL UUID REFERENCES profiles(id)
-- (Sprint 1 schema 20260503131017_bet1_social_layer.sql line 168). Community
-- matches set this to the auth.uid() of the user who recorded the match;
-- pro_tour ingestion has no such user — the scrape Worker writes on behalf
-- of the system, not on behalf of any specific person.
--
-- Codex P1 on PR #29: pro-tour-ingest INSERT was silently dropping the
-- recorded_by field, which violates NOT NULL and would have failed every
-- match insert on prod. This migration creates a deterministic system
-- profile (is_ghost=true, source_provider='other') whose UUID the ingest
-- function references for recorded_by attribution.
--
-- Deliberate choice — system profile vs Cuong's admin profile:
--   - System profile keeps "show me all matches Cuong recorded" queries
--     accurate (excludes pro imports).
--   - Avoids tying pro matches to a specific person's identity.
--   - Future provider (APP / MLP) can reuse the same row, or get its own
--     system profile if attribution-per-provider becomes useful.
--
-- The UUID 11111111-1111-1111-1111-111111111111 is a chosen synthetic value
-- — easy to recognize in logs, clearly NOT a real auth.users.id, and
-- stable across deploys so the edge function constant matches forever.
--
-- IDEMPOTENT: ON CONFLICT DO NOTHING — re-applying the migration after
-- a deploy is a no-op.
-- ============================================================================

INSERT INTO public.profiles (
  id,
  email,
  username,
  display_name,
  is_ghost,
  source_provider,
  external_id,
  external_url,
  country_code
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'system+pro-tour@thepicklehub.net',
  'system-pro-tour',
  'Pro Tour Importer',
  TRUE,
  'other',
  'system-pro-tour',
  NULL,
  NULL
) ON CONFLICT (id) DO NOTHING;

-- The profiles.id FK to auth.users(id) is intentionally bypassed here —
-- this is a synthetic system row with no auth.users counterpart. The FK
-- on prod must be DEFERRABLE INITIALLY DEFERRED OR not enforced; if this
-- INSERT fails with FK violation, the existing CreateGhostProfileModal
-- ghost insert pattern would also be broken on prod. Track + fix at the
-- FK level if needed (one-off ALTER TABLE … DEFERRABLE).

NOTIFY pgrst, 'reload schema';
