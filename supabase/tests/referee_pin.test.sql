BEGIN;

SELECT plan(10);

-- ── Structure ────────────────────────────────────────────────────────────

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'referee_pins' AND c.relrowsecurity
  ),
  'referee_pins exists with RLS enabled'
);

-- The whole design rests on this: the PIN table is NOT readable by the client
-- roles. A grant here would reopen the invite_code leak class (#430) on a new
-- secret. anon/authenticated must have zero table privileges.
SELECT is(
  (
    SELECT count(*)::int FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'referee_pins'
      AND grantee IN ('anon', 'authenticated')
  ),
  0,
  'referee_pins grants no table privileges to anon/authenticated'
);

-- ── Function shape ────────────────────────────────────────────────────────

SELECT is(
  (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'redeem_referee_pin'),
  true,
  'redeem_referee_pin is SECURITY DEFINER'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.redeem_referee_pin(text, uuid, text)', 'EXECUTE'),
  'anon cannot execute redeem_referee_pin'
);

SELECT ok(
  has_function_privilege('authenticated', 'public.redeem_referee_pin(text, uuid, text)', 'EXECUTE'),
  'authenticated can execute redeem_referee_pin'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.set_referee_pin(text, uuid)', 'EXECUTE'),
  'anon cannot execute set_referee_pin'
);

-- The internal helpers must not be client-callable at all.
SELECT ok(
  NOT has_function_privilege('authenticated', 'public.referee_pin_parent_completed(text, uuid)', 'EXECUTE'),
  'referee_pin_parent_completed is not callable by authenticated'
);

-- ── Behaviour: completed predicate covers all 4 formats ───────────────────

-- Non-existent parent → treated as completed (fail closed), so redeem on a
-- ghost tournament can never enroll anyone.
SELECT is(
  public.referee_pin_parent_completed('quick_table', '00000000-0000-0000-0000-000000000000'),
  true,
  'missing quick_table parent counts as completed (fail closed)'
);
SELECT is(
  public.referee_pin_parent_completed('doubles_elimination', '00000000-0000-0000-0000-000000000000'),
  true,
  'missing doubles_elimination parent counts as completed (fail closed)'
);

-- ── Anti-tamper: redeem never trusts a caller-supplied user id ─────────────

-- The function signature takes NO user id — enrollment is always auth.uid().
-- This asserts the contract that closes the self-INSERT hole (auditor #4).
SELECT is(
  (SELECT pg_get_function_identity_arguments(p.oid)
   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'redeem_referee_pin'),
  'p_format text, p_parent_id uuid, p_pin text',
  'redeem_referee_pin takes no user-id argument (enrolls auth.uid only)'
);

SELECT * FROM finish();
ROLLBACK;
