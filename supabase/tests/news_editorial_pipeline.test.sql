BEGIN;

SELECT plan(12);

SELECT has_table('public', 'news_origins', 'internal news origins table exists');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.news_origins'::regclass),
  'news origins has RLS enabled'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.news_origins', 'SELECT'),
  'anonymous callers cannot read source URLs'
);

SELECT ok(
  NOT has_table_privilege('anon', 'public.news_origins', 'INSERT'),
  'anonymous callers cannot enqueue source material'
);

SELECT ok(
  has_table_privilege('service_role', 'public.news_origins', 'SELECT'),
  'service role can process origins'
);

SELECT has_function(
  'public',
  'claim_pending_news_origins',
  ARRAY['integer'],
  'atomic origin claim function exists'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.claim_pending_news_origins(integer)',
    'EXECUTE'
  ),
  'authenticated callers cannot claim rewrite jobs'
);

SELECT ok(
  has_function_privilege(
    'service_role',
    'public.claim_pending_news_origins(integer)',
    'EXECUTE'
  ),
  'service role can claim rewrite jobs'
);

SELECT has_function(
  'public',
  'publish_rewritten_news',
  ARRAY['uuid', 'jsonb', 'jsonb'],
  'atomic bilingual publish function exists'
);

SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.publish_rewritten_news(uuid, jsonb, jsonb)',
    'EXECUTE'
  ),
  'authenticated callers cannot publish generated pairs'
);

SELECT is(
  (SELECT count(*) FROM public.news_items WHERE source_url IS NOT NULL),
  0::bigint,
  'public news rows no longer expose source URLs'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'news-rewrite-every-30m'
      AND schedule = '*/30 * * * *'
      AND active
  ),
  'news rewrite cron is active'
);

SELECT * FROM finish();
ROLLBACK;
