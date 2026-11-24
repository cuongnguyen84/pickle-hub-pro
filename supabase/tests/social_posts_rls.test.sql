BEGIN;

SELECT plan(15);

-- pgTAP in this environment lacks the *_policy helpers; assert against
-- the native catalogs instead (see notification_insert_rls.test.sql).
-- Behavioral probes run inside this transaction and roll back.

-- 1. RLS is on for the table.
SELECT ok(
  (SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = 'social_posts'),
  'RLS enabled on social_posts'
);

-- 2. Guests read APPROVED posts only (Cuong decision, 2026-11-24,
-- migration 20261124220000): exactly one policy includes the anon
-- role - a narrow SELECT policy restricted to approved posts.
-- Pending / rejected / hidden stay invisible to guests.
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'social_posts'
      AND policyname = 'social_posts_select_approved_anon'
      AND cmd = 'SELECT'
      AND 'anon' = ANY (roles)
      AND array_length(roles, 1) = 1
  ),
  'anon approved-read policy exists (SELECT, anon only)'
);
SELECT ok(
  (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'social_posts'
      AND 'anon' = ANY (roles)
  ) = 1,
  'exactly one social_posts policy includes the anon role'
);
SELECT ok(
  (
    SELECT qual FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'social_posts'
      AND policyname = 'social_posts_select_approved_anon'
  ) LIKE '%approved%',
  'anon policy is restricted to approved posts'
);

-- 3-6. The read/insert policy set from migration 20261123100000 exists.
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'social_posts' AND policyname = 'social_posts_select_approved'),
  'approved-read policy exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'social_posts' AND policyname = 'social_posts_select_own'),
  'own-read policy exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'social_posts' AND policyname = 'social_posts_select_admin'),
  'admin-read policy exists'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'social_posts' AND policyname = 'social_posts_insert_own'),
  'insert-own policy exists'
);

-- 7. There is deliberately no DELETE policy (posts are hidden, not deleted).
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'social_posts' AND cmd = 'DELETE'
  ),
  'no DELETE policy on social_posts'
);

-- 8. Reports can target posts.
SELECT ok(
  (
    SELECT pg_get_constraintdef(oid) LIKE '%''post''%'
    FROM pg_constraint
    WHERE conname = 'content_reports_content_type_check'
  ),
  'content_reports accepts content_type post'
);

-- 9. The image bucket exists and is public-read.
SELECT ok(
  EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'post-images' AND public),
  'post-images bucket exists and is public'
);

-- 10. The initial-status trigger is installed.
SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'social_posts'
      AND t.tgname = 'social_posts_initial_status'
      AND NOT t.tgisinternal
  ),
  'initial-status trigger installed on social_posts'
);

-- Fixtures: two users (the signup trigger seeds their profiles, which
-- social_posts.author_id references).
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  (
    '0a0a0001-0000-4000-8000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ugc-user-a@thepicklehub.test', '', NOW(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"UGC User A"}'::jsonb, NOW(), NOW()
  ),
  (
    '0a0a0002-0000-4000-8000-000000000002'::uuid,
    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'ugc-user-b@thepicklehub.test', '', NOW(),
    '{"provider":"test","providers":["test"]}'::jsonb,
    '{"display_name":"UGC User B"}'::jsonb, NOW(), NOW()
  );

-- 11. A first-time author's post starts pending (trust graduation).
INSERT INTO public.social_posts (author_id, kind, body, image_url)
VALUES ('0a0a0001-0000-4000-8000-000000000001', 'post', 'first post', 'https://example.test/ugc-a1.webp');
SELECT is(
  (SELECT status FROM public.social_posts WHERE image_url = 'https://example.test/ugc-a1.webp'),
  'pending',
  'first post from a new author starts pending'
);

-- 12. An author with 3 approved posts graduates: the next post is
-- approved immediately. The seed posts are flipped to approved with a
-- service_role claim, the only non-admin path the guard allows.
INSERT INTO public.social_posts (author_id, kind, body, image_url) VALUES
  ('0a0a0002-0000-4000-8000-000000000002', 'post', 'seed 1', 'https://example.test/ugc-b1.webp'),
  ('0a0a0002-0000-4000-8000-000000000002', 'post', 'seed 2', 'https://example.test/ugc-b2.webp'),
  ('0a0a0002-0000-4000-8000-000000000002', 'post', 'seed 3', 'https://example.test/ugc-b3.webp');
SELECT set_config('request.jwt.claim.role', 'service_role', true);
UPDATE public.social_posts SET status = 'approved'
WHERE author_id = '0a0a0002-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
INSERT INTO public.social_posts (author_id, kind, body, image_url)
VALUES ('0a0a0002-0000-4000-8000-000000000002', 'post', 'fourth post', 'https://example.test/ugc-b4.webp');
SELECT is(
  (SELECT status FROM public.social_posts WHERE image_url = 'https://example.test/ugc-b4.webp'),
  'approved',
  'author with 3 approved posts posts approved immediately'
);

-- 13. The status guard silently reverts a non-admin status change.
UPDATE public.social_posts SET status = 'rejected'
WHERE image_url = 'https://example.test/ugc-b4.webp';
SELECT is(
  (SELECT status FROM public.social_posts WHERE image_url = 'https://example.test/ugc-b4.webp'),
  'approved',
  'non-admin status change is reverted by the guard trigger'
);

SELECT * FROM finish();
ROLLBACK;
