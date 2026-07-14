BEGIN;

SELECT plan(4);

SELECT hasnt_policy(
  'public',
  'notifications',
  'Service can insert notifications',
  'the unrestricted notification INSERT policy is removed'
);

SELECT is(
  (
    SELECT p.prosecdef
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'notify_followers_on_livestream'
  ),
  true,
  'the livestream notification function remains SECURITY DEFINER'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'livestreams'
      AND t.tgname = 'on_livestream_notify_followers'
      AND NOT t.tgisinternal
  ),
  'the livestream notification trigger remains installed'
);

-- Exercise the RLS boundary directly even if table grants are tightened later.
-- The transaction rollback restores the original grants after this test.
GRANT INSERT ON TABLE public.notifications TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

SELECT throws_ok(
  $$
    INSERT INTO public.notifications (
      user_id,
      type,
      entity_type,
      entity_id,
      title
    ) VALUES (
      '00000000-0000-0000-0000-000000000002',
      'livestream_live',
      'organization',
      '00000000-0000-0000-0000-000000000003',
      'forged notification'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "notifications"',
  'an authenticated user cannot insert a notification for another user'
);

SELECT * FROM finish();
ROLLBACK;
