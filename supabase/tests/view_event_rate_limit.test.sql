BEGIN;

SELECT plan(9);

SELECT has_table(
  'public',
  'view_event_rate_limits',
  'view-event rate-limit table exists'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.view_event_rate_limits'::regclass),
  'view-event rate-limit table has RLS enabled'
);

SELECT has_function(
  'public',
  'consume_view_event_rate_limit',
  ARRAY['text', 'integer', 'integer', 'integer'],
  'atomic view-event rate-limit function exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.consume_view_event_rate_limit(text, integer, integer, integer)',
    'EXECUTE'
  ),
  'anon cannot call the rate limiter directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.consume_view_event_rate_limit(text, integer, integer, integer)',
    'EXECUTE'
  ),
  'authenticated cannot call the rate limiter directly'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.consume_view_event_rate_limit(text, integer, integer, integer)',
    'EXECUTE'
  ),
  'service_role can call the rate limiter'
);

SELECT results_eq(
  $$
    SELECT allowed, remaining
    FROM public.consume_view_event_rate_limit(repeat('a', 64), 10, 20, 600)
  $$,
  $$VALUES (true, 10)$$,
  'first request atomically consumes capacity'
);

SELECT results_eq(
  $$
    SELECT allowed, remaining
    FROM public.consume_view_event_rate_limit(repeat('a', 64), 11, 20, 600)
  $$,
  $$VALUES (false, 10)$$,
  'request over remaining capacity is rejected without consuming it'
);

SELECT hasnt_policy(
  'public',
  'view_events',
  'Validated view event inserts',
  'browser INSERT policy cannot bypass the Edge Function'
);

SELECT * FROM finish();
ROLLBACK;
