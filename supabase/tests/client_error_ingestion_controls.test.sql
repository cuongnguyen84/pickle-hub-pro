BEGIN;

SELECT plan(14);

SELECT has_table(
  'public',
  'client_error_rate_limits',
  'client-error rate-limit table exists'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.client_error_rate_limits'::regclass),
  'client-error rate-limit table has RLS enabled'
);

SELECT has_function(
  'public',
  'consume_client_error_rate_limit',
  ARRAY['text', 'integer', 'integer', 'integer'],
  'atomic client-error rate limiter exists'
);

SELECT ok(
  NOT has_function_privilege(
    'anon',
    'public.consume_client_error_rate_limit(text, integer, integer, integer)',
    'EXECUTE'
  ),
  'anon cannot call the limiter directly'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.consume_client_error_rate_limit(text, integer, integer, integer)',
    'EXECUTE'
  ),
  'authenticated cannot call the limiter directly'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.consume_client_error_rate_limit(text, integer, integer, integer)',
    'EXECUTE'
  ),
  'service_role can call the limiter'
);

SELECT results_eq(
  $$
    SELECT allowed, remaining
    FROM public.consume_client_error_rate_limit(repeat('b', 64), 10, 20, 600)
  $$,
  $$VALUES (true, 10)$$,
  'first request atomically consumes capacity'
);

SELECT results_eq(
  $$
    SELECT allowed, remaining
    FROM public.consume_client_error_rate_limit(repeat('b', 64), 11, 20, 600)
  $$,
  $$VALUES (false, 10)$$,
  'request over remaining capacity is rejected without consuming it'
);

SELECT has_function(
  'public',
  'prune_client_errors',
  ARRAY['integer'],
  'client-error retention function exists'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.prune_client_errors(integer)', 'EXECUTE'),
  'anon cannot invoke retention cleanup'
);

INSERT INTO public.client_errors (type, message, recorded_at)
VALUES
  ('js_error', 'pgtap-sec03-expired', now() - interval '91 days'),
  ('js_error', 'pgtap-sec03-current', now() - interval '89 days');

SELECT public.prune_client_errors(90);

SELECT is(
  (SELECT count(*) FROM public.client_errors WHERE message = 'pgtap-sec03-expired'),
  0::bigint,
  'retention removes client errors older than 90 days'
);

SELECT is(
  (SELECT count(*) FROM public.client_errors WHERE message = 'pgtap-sec03-current'),
  1::bigint,
  'retention preserves client errors inside 90 days'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.client_errors', 'SELECT'),
  'anon has no client_errors table grant'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname = 'client-errors-retention-daily'
      AND schedule = '17 3 * * *'
      AND active
  ),
  'daily 90-day retention job is active'
);

SELECT * FROM finish();
ROLLBACK;
