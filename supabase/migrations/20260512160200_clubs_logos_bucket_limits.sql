-- ============================================================================
-- Social Events MVP — PR55 follow-up: clubs-logos bucket size + MIME limits
-- ============================================================================
-- Codex review bug 3: the original bucket creation in 20260512160000
-- omitted file_size_limit + allowed_mime_types, leaving the bucket
-- accepting any file type up to Supabase's global default (50MB). The
-- client-side useClubLogoUpload hook enforces 2 MB + jpeg/png/webp, but
-- anyone calling the Storage API directly bypasses that.
--
-- Belt + braces: also fix the original migration's INSERT to include
-- these fields (so a fresh deploy gets it right on first run), and patch
-- existing rows here so already-deployed environments converge.
--
-- IDEMPOTENT.
-- ============================================================================

UPDATE storage.buckets
SET
  file_size_limit    = 2097152, -- 2 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'clubs-logos';

-- Belt: in case the bucket wasn't created at all (replays on a fresh
-- database that somehow skipped 20260512160000), create it with the
-- right limits in one go.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clubs-logos',
  'clubs-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
