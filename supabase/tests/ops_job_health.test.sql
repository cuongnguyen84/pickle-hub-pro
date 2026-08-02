BEGIN;

SELECT plan(14);

SELECT has_table('public', 'ops_job_registry', 'job registry exists');
SELECT has_table('public', 'ops_job_runs', 'job run ledger exists');
SELECT has_table('public', 'ops_job_digest_deliveries', 'digest delivery ledger exists');

SELECT is(
  (SELECT count(*) FROM public.ops_job_registry WHERE enabled),
  10::bigint,
  'exactly ten business jobs are enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.ops_job_runs', 'SELECT'),
  'anonymous callers cannot read operational runs'
);
SELECT ok(
  NOT has_table_privilege('authenticated', 'public.ops_job_runs', 'SELECT'),
  'authenticated callers cannot bypass the admin snapshot'
);
SELECT ok(
  has_table_privilege('service_role', 'public.ops_job_runs', 'INSERT'),
  'service role can record job runs'
);

SELECT has_function(
  'public', 'ops_record_job_run',
  ARRAY['text','text','text','timestamp with time zone','timestamp with time zone','text','text','jsonb','text','text','text'],
  'service job-run recorder exists'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.ops_record_job_run(text,text,text,timestamptz,timestamptz,text,text,jsonb,text,text,text)',
    'EXECUTE'
  ),
  'authenticated callers cannot forge job health'
);
SELECT ok(
  has_function_privilege(
    'service_role',
    'public.ops_record_job_run(text,text,text,timestamptz,timestamptz,text,text,jsonb,text,text,text)',
    'EXECUTE'
  ),
  'service role can record job health'
);

SELECT has_function('public', 'ops_admin_job_health', ARRAY[]::text[], 'admin snapshot RPC exists');
SELECT ok(
  NOT has_function_privilege('anon', 'public.ops_admin_job_health()', 'EXECUTE'),
  'anonymous callers cannot open the admin snapshot'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname='ops-job-digest-morning'
      AND schedule='15,35 2 * * *'
      AND active
  ),
  'morning digest primary and retry schedule is active'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.ops_cron_monitors
    WHERE monitor_key='ops-job-digest' AND enabled
  ),
  'morning digest monitors itself'
);

SELECT * FROM finish();
ROLLBACK;
