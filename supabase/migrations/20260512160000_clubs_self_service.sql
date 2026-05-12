-- ============================================================================
-- Social Events MVP — PR55: clubs self-service infrastructure
-- ============================================================================
-- The clubs table itself was shipped in PR42 (foundation). This migration
-- adds the indexes + helper function + storage bucket the new
-- /clubs (public list) + /clubs/new (create form) surfaces need.
--
-- Spam mitigation: cap 1 user at 3 clubs via a SECURITY DEFINER function
-- the CreateClub page calls before INSERT. The frontend also gates the
-- "Tạo CLB" button on this count so a normal user can't accidentally
-- hit the cap; the function is the authoritative check.
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. Search indexes ──────────────────────────────────────────────────────
-- GIN indexes over to_tsvector(name) + to_tsvector(location_text) so the
-- /clubs search bar can do ILIKE prefix + full-text matches without a
-- seq-scan as the table grows. Both filters use the 'simple' config —
-- Vietnamese diacritics survive the index, matching the language data.

CREATE INDEX IF NOT EXISTS clubs_name_search_idx
  ON public.clubs
  USING gin (to_tsvector('simple', name));

CREATE INDEX IF NOT EXISTS clubs_location_search_idx
  ON public.clubs
  USING gin (to_tsvector('simple', coalesce(location_text, '')));

-- For the "X / Y clubs" sort + filter on the list page.
CREATE INDEX IF NOT EXISTS clubs_created_at_idx
  ON public.clubs (created_at DESC);

-- ─── 2. user_club_count — spam-mitigation helper ────────────────────────────
-- Returns the number of clubs a given user has created. CreateClub calls
-- this via supabase.rpc() before INSERT to enforce the 3-club cap.
-- STABLE so it can be cached within a single statement.

CREATE OR REPLACE FUNCTION public.user_club_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COUNT(*)::INTEGER FROM public.clubs WHERE created_by = p_user_id;
$$;

REVOKE ALL ON FUNCTION public.user_club_count(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_club_count(UUID) FROM anon;
GRANT  EXECUTE ON FUNCTION public.user_club_count(UUID) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.user_club_count(UUID) TO service_role;

-- ─── 3. club_listing view — per-club upcoming-event count ──────────────────
-- The /clubs page sorts clubs by upcoming-event count desc, then
-- created_at desc, and needs the count per card. A regular view keeps
-- it refresh-free; PR57 will fold this into a richer `club_stats`
-- view with player counts.

CREATE OR REPLACE VIEW public.club_listing AS
SELECT
  c.id,
  c.slug,
  c.name,
  c.description,
  c.logo_url,
  c.location_text,
  c.created_by,
  c.created_at,
  COALESCE(ev.upcoming_events, 0) AS upcoming_events
FROM public.clubs c
LEFT JOIN (
  SELECT
    club_id,
    COUNT(*) AS upcoming_events
  FROM public.social_events
  WHERE status = 'published'
    AND visibility = 'public'
    AND start_at > now()
  GROUP BY club_id
) ev ON ev.club_id = c.id;

GRANT SELECT ON public.club_listing TO anon;
GRANT SELECT ON public.club_listing TO authenticated;

-- ─── 4. Storage bucket for club logos ──────────────────────────────────────
-- `clubs-logos` — public read, authenticated write under their own user
-- folder. Mirrors the avatars bucket convention. Bucket creation is
-- idempotent via ON CONFLICT.

INSERT INTO storage.buckets (id, name, public)
VALUES ('clubs-logos', 'clubs-logos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies on storage.objects. The path convention is
-- `<auth.uid()>/<random>.<ext>` — the user can upload to their own
-- folder, anyone can read.

DROP POLICY IF EXISTS "clubs_logos_select_public" ON storage.objects;
CREATE POLICY "clubs_logos_select_public" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'clubs-logos');

DROP POLICY IF EXISTS "clubs_logos_insert_self" ON storage.objects;
CREATE POLICY "clubs_logos_insert_self" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'clubs-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "clubs_logos_update_self" ON storage.objects;
CREATE POLICY "clubs_logos_update_self" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'clubs-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "clubs_logos_delete_self" ON storage.objects;
CREATE POLICY "clubs_logos_delete_self" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'clubs-logos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON FUNCTION public.user_club_count(UUID) IS
  'Count of clubs created by a user. Used by /clubs/new to enforce the 3-club self-service cap before INSERT. See migration 20260512160000.';

COMMENT ON VIEW public.club_listing IS
  'Read view powering /clubs: every club + count of published+public upcoming events. PR57 will fold this into a richer club_stats view. See migration 20260512160000.';
