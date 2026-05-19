-- ============================================================================
-- Sprint 6 Codex P1 fix — system profile for pro_tour match attribution
-- ============================================================================
-- The matches.recorded_by column is NOT NULL UUID REFERENCES profiles(id)
-- (Sprint 1 schema 20260503131017_bet1_social_layer.sql line 168). Pro tour
-- ingestion has no real user recording the match — the scrape Worker writes
-- on behalf of the system. We attribute via a synthetic system profile.
--
-- Codex P1 (preview branch SQLSTATE 23503): the original migration
-- INSERTed only into public.profiles, but profiles.id has a hard FK to
-- auth.users(id) with no DEFERRABLE clause (Sprint 0 schema
-- 20251221153808 line 80). The synthetic UUID had no auth.users
-- counterpart → FK violation on every fresh-schema replay.
--
-- Correct shape: seed auth.users FIRST with the same UUID, let the
-- handle_new_user trigger (20260123092501) auto-create the matching
-- profiles row, then UPSERT the system-specific fields onto it.
--
-- Note on the existing CreateGhostProfileModal pattern: that component
-- inserts into public.profiles WITHOUT setting id, which would fail
-- on a fresh schema replay too (no DEFAULT on id, hard FK to
-- auth.users). It works on prod only because the prod schema has
-- drifted — likely the FK was dropped/altered or a DEFAULT
-- gen_random_uuid() was added via Lovable Cloud editor. That drift is
-- a separate bug from this migration; do NOT replicate the
-- "id-omitted INSERT" pattern. The drift-audit doc
-- (docs/schema-drift-audit-2026-05.md) is the right place to surface
-- the CreateGhostProfileModal issue if it bites prod again.
--
-- Risk on auth schema mutation:
-- auth.users is Supabase-managed. INSERTing into it from a migration
-- requires the postgres-role privileges that supabase db push uses by
-- default. Required column floor (per Supabase Auth schema):
--   id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
--   created_at, updated_at, instance_id, email_confirmed_at
-- Everything else (encrypted_password, confirmation_token, phone,
-- recovery_*) is nullable. We confirm the row immediately so it
-- never sits unconfirmed.
--
-- The handle_new_user trigger that fires here also inserts a
-- (user_id, role='viewer') row into user_roles — harmless for the
-- system identity (it's never authenticated against). Cleanup not
-- needed.
--
-- IDEMPOTENT: ON CONFLICT DO NOTHING on auth.users (so re-applying
-- skips the trigger fire); ON CONFLICT DO UPDATE on profiles (so the
-- system-specific fields converge to the right values even if a prior
-- run created the row from the trigger only).
-- ============================================================================

-- ─── 1. Seed auth.users (synthetic system identity) ─────────────────────
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'system+pro-tour@thepicklehub.net',
  '',                                    -- no real password; this account never signs in
  NOW(),                                 -- pre-confirmed so no email-flow side effects
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"display_name":"Pro Tour Importer"}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- ─── 2. UPSERT public.profiles ──────────────────────────────────────────
-- handle_new_user trigger (SECURITY DEFINER, fires AFTER INSERT auth.users)
-- has already INSERTed a basic profiles row with display_name derived from
-- email local-part. Override with the system-specific fields.

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
) ON CONFLICT (id) DO UPDATE SET
  username        = EXCLUDED.username,
  display_name    = EXCLUDED.display_name,
  is_ghost        = EXCLUDED.is_ghost,
  source_provider = EXCLUDED.source_provider,
  external_id     = EXCLUDED.external_id;

NOTIFY pgrst, 'reload schema';
