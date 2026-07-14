-- HOT-01: authenticated users must not be able to forge notifications for
-- themselves or other users. service_role clients bypass RLS, and the database
-- trigger runs through its SECURITY DEFINER owner, so neither needs a permissive
-- INSERT policy.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'notify_followers_on_livestream'
      AND p.prosecdef
  ) THEN
    RAISE EXCEPTION
      'HOT-01 safety check failed: public.notify_followers_on_livestream must remain SECURITY DEFINER';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger AS t
    JOIN pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'livestreams'
      AND t.tgname = 'on_livestream_notify_followers'
      AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION
      'HOT-01 safety check failed: livestream notification trigger is missing';
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Service can insert notifications"
ON public.notifications;
