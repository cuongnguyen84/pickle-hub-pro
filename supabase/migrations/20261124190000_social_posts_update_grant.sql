-- =====================================================================
-- social_posts: grant the UPDATE privilege the RLS policies assume.
--
-- The original migration (20261123100000_social_posts_photo_posts)
-- created the RLS policies, including social_posts_update_admin,
-- but never granted the table-level UPDATE privilege to the
-- authenticated role. Postgres checks GRANTs before RLS, so every
-- PostgREST update from the admin moderation queue failed with
-- 42501 "permission denied for table social_posts" even though the
-- policy was correct. (Post creation never exposed this: inserts go
-- through the create-post edge function as service_role.)
--
-- Column-scoped on purpose: the moderation flow only ever sets
-- status (updated_at is maintained by the shared trigger). Content
-- columns stay writable by the service role only. The existing RLS
-- policies and the status-guard trigger keep deciding WHICH rows a
-- caller may change - this grant only lets the question be asked.
-- =====================================================================

GRANT UPDATE (status, updated_at) ON public.social_posts TO authenticated;
