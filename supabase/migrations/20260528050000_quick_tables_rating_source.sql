-- ============================================================================
-- quick_tables.rating_source — DUPR enforcement opt-in
-- ----------------------------------------------------------------------------
-- Sprint B1.1 (2026-05-27). Cuong's locked decisions:
--   - ENUM 3 values: 'self' | 'dupr' | 'either'
--   - Default 'self' → preserves current behavior (skill_level free-text)
--   - Existing tables backfilled to 'self'
--   - min_skill_level + max_skill_level already exist (nullable, optional)
--   - When rating_source IN ('dupr','either'), the registration form
--     auto-fills from profiles.dupr_doubles or dupr_singles (per
--     quick_tables.is_doubles) for users with active SSO.
--   - When rating_source = 'dupr' AND user has no SSO → block submit,
--     show <DuprConnectButton>.
--
-- Why TEXT + CHECK instead of true ENUM type:
--   - Easier to add values later without ALTER TYPE migration drama
--   - Matches existing pattern in this codebase (status fields)
-- ============================================================================

ALTER TABLE public.quick_tables
  ADD COLUMN IF NOT EXISTS rating_source TEXT
    NOT NULL DEFAULT 'self'
    CHECK (rating_source IN ('self', 'dupr', 'either'));

COMMENT ON COLUMN public.quick_tables.rating_source IS
  'Sprint B1.1 (2026-05-27). How player rating is sourced at registration. self=user typed free-text (legacy, default). dupr=must SSO DUPR + auto-fill from profile. either=user chooses. When dupr/either, min_skill_level + max_skill_level optionally constrain the accepted range.';

-- Sprint B1.1 — also bump dupr_required_min_rating + max for clarity in
-- public-facing copy. The column reuses existing min_skill_level /
-- max_skill_level for storage so no schema duplication.
-- (No-op block kept for code review legibility — the storage columns
-- already exist from earlier migration.)
