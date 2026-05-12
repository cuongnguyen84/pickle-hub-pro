-- ============================================================================
-- Social Events MVP — PR47 (SUPERSEDED, kept as no-op for sequence integrity)
-- ============================================================================
-- This migration originally added `magic_token UUID` directly on
-- `event_registrations`, which exposed the token via the public SELECT
-- policy (Codex review bug 1). It has been superseded by
-- `20260512110000_registration_secrets.sql`, which puts the token in a
-- private sibling table with zero public access.
--
-- The file remains in the repo only to keep the migration filename
-- timestamps monotonic (Cuong's SQL Editor flow assumes ordered apply).
-- The split-table migration that follows is idempotent: it drops the
-- magic_token column on event_registrations if it exists, so a fresh DB
-- that never ran this no-op is unaffected, and a DB that did get the
-- column from a previous test cycle still has it cleanly removed.
--
-- Intentional no-op. Pasting it into SQL Editor does nothing.
-- ============================================================================

SELECT 1 AS noop;
