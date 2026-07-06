-- ============================================================================
-- SECURITY M4 (2026-07-06): block dangerous URL schemes at the database layer
-- ----------------------------------------------------------------------------
-- venues.website is inserted directly by the client (RLS venues_auth_insert),
-- and social_events.zalo_group_url likewise, then both are rendered as <a href>.
-- Client-side `type="url"` validation is bypassable via a direct PostgREST
-- call, so a stored `javascript:` / `data:text/html` value becomes a stored
-- XSS when the link is clicked. Enforce the scheme allowlist server-side with
-- CHECK constraints — this holds regardless of how the row is written.
--
-- We block the dangerous schemes rather than require https:// so scheme-less
-- entries (e.g. "facebook.com/pickle") that users commonly type still save.
-- ============================================================================

-- 1. Null out any already-stored dangerous values (so the constraint validates).
UPDATE public.venues
SET website = NULL
WHERE website ~* '^\s*(javascript|data|vbscript|file)\s*:';

UPDATE public.social_events
SET zalo_group_url = NULL
WHERE zalo_group_url ~* '^\s*(javascript|data|vbscript|file)\s*:';

-- 2. Add CHECK constraints (idempotent).
ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS venues_website_safe_scheme;
ALTER TABLE public.venues
  ADD CONSTRAINT venues_website_safe_scheme
  CHECK (website IS NULL OR website !~* '^\s*(javascript|data|vbscript|file)\s*:');

ALTER TABLE public.social_events DROP CONSTRAINT IF EXISTS social_events_zalo_url_safe_scheme;
ALTER TABLE public.social_events
  ADD CONSTRAINT social_events_zalo_url_safe_scheme
  CHECK (zalo_group_url IS NULL OR zalo_group_url !~* '^\s*(javascript|data|vbscript|file)\s*:');

NOTIFY pgrst, 'reload schema';
