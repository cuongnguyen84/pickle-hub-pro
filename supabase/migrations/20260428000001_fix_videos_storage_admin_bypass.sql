-- ============================================================================
-- Fix: admin bypass for videos bucket storage RLS
--
-- Bug: 2026-04-28 thecuong@gmail.com (admin) trying to upload video via
-- mobile Safari → Creator Studio → "new row violates row-level security
-- policy".
--
-- Root cause: storage.objects policies for `videos` bucket (added in
-- migration 20251222113744) require BOTH (a) folder name match user's
-- profile.organization_id AND (b) is_creator OR is_admin. Admin without
-- profile.organization_id, or admin uploading on behalf of another org,
-- fails (a). Compare with `thumbnails` bucket (migration 20251222132621)
-- which has the correct pattern: admin bypass first, otherwise creator
-- must match own org folder.
--
-- This migration realigns the `videos` bucket policies to the same
-- structure used by `thumbnails`. Existing creator behavior unchanged
-- (still constrained to their own org folder); admin can now upload to
-- any org folder.
--
-- MANUAL APPLY: paste into Supabase Dashboard → SQL Editor → Run.
-- Per .claude/memory/lessons-learned.md, do NOT use `supabase db push`
-- (40+ stale migrations make push risky).
-- ============================================================================

-- DROP existing creator-only INSERT/UPDATE/DELETE storage policies
DROP POLICY IF EXISTS "Creators can upload videos to their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Creators can update videos in their org folder" ON storage.objects;
DROP POLICY IF EXISTS "Creators can delete videos from their org folder" ON storage.objects;

-- Recreate with admin bypass (matches `thumbnails` bucket pattern)

CREATE POLICY "Creators can upload videos to their org folder"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'videos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (
      public.is_creator()
      AND (storage.foldername(name))[1] = 'org'
      AND (storage.foldername(name))[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
);

CREATE POLICY "Creators can update videos in their org folder"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'videos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (
      public.is_creator()
      AND (storage.foldername(name))[1] = 'org'
      AND (storage.foldername(name))[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
);

CREATE POLICY "Creators can delete videos from their org folder"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'videos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_admin()
    OR (
      public.is_creator()
      AND (storage.foldername(name))[1] = 'org'
      AND (storage.foldername(name))[2] = public.get_user_organization_id(auth.uid())::text
    )
  )
);

-- Reload PostgREST schema cache so changes apply immediately
NOTIFY pgrst, 'reload schema';
