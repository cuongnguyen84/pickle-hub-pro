-- ============================================================================
-- Bet #1 Social Layer — Test Data RESET
-- ============================================================================
-- Reverses everything social-test-data.sql inserted, in FK-safe order.
-- Tables themselves are NOT dropped — only `-test`-suffixed data removed.
--
-- ⚠ DO NOT RUN ON PRODUCTION (project ajvlcamxemgbxduhiqrl).
-- Same environment guard as the seed script.
-- ============================================================================

DO $$
DECLARE
  v_url TEXT := COALESCE(current_setting('app.supabase_url', true), '');
BEGIN
  IF v_url ILIKE '%ajvlcamxemgbxduhiqrl%' THEN
    RAISE EXCEPTION 'REFUSED: this reset must not run against the production Supabase project (ajvlcamxemgbxduhiqrl).';
  END IF;
  RAISE NOTICE 'Resetting social test data in database: %', current_database();
END $$;

-- Children → parents (respect FK ON DELETE CASCADE chains, but be explicit)
DELETE FROM public.social_notifications WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.session_participants WHERE session_id IN (
  SELECT id FROM public.open_play_sessions WHERE created_by IN (
    SELECT id FROM public.profiles WHERE username LIKE '%-test'
  )
);
DELETE FROM public.open_play_sessions WHERE created_by IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.clips WHERE uploaded_by IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.social_comments WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.kudos WHERE user_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.social_follows WHERE follower_id IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.match_participants WHERE match_id IN (
  SELECT id FROM public.matches WHERE recorded_by IN (
    SELECT id FROM public.profiles WHERE username LIKE '%-test'
  )
);
DELETE FROM public.matches WHERE recorded_by IN (
  SELECT id FROM public.profiles WHERE username LIKE '%-test'
);
DELETE FROM public.venues WHERE slug LIKE 'test-%';
DELETE FROM public.profiles WHERE username LIKE '%-test';
DELETE FROM auth.users WHERE email LIKE '%@thepicklehub.test';

DO $$
BEGIN
  RAISE NOTICE 'Reset complete.';
  RAISE NOTICE '  remaining test profiles: %',  (SELECT COUNT(*) FROM public.profiles WHERE username LIKE '%-test');
  RAISE NOTICE '  remaining test auth users: %',(SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@thepicklehub.test');
END $$;
