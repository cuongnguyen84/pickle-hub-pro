-- News editorial pipeline: source URLs and scraped copy are internal-only,
-- while public news_items contain independently rewritten EN/VI articles.

CREATE TABLE IF NOT EXISTS public.news_origins (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id          text REFERENCES public.news_sources(id)
                         ON UPDATE CASCADE ON DELETE SET NULL,
  source_name        text NOT NULL,
  source_url         text NOT NULL UNIQUE,
  source_image_url   text,
  raw_title          text NOT NULL DEFAULT '',
  raw_summary        text NOT NULL DEFAULT '',
  raw_body           text,
  content_kind       text NOT NULL DEFAULT 'brief'
                         CHECK (content_kind IN ('full', 'brief')),
  auto_publish       boolean NOT NULL DEFAULT true,
  pipeline_status    text NOT NULL DEFAULT 'pending'
                         CHECK (pipeline_status IN (
                           'pending', 'extracting', 'rewriting',
                           'published', 'failed'
                         )),
  attempts           integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error         text,
  published_at       timestamptz NOT NULL,
  en_news_id         uuid REFERENCES public.news_items(id) ON DELETE SET NULL,
  vi_news_id         uuid REFERENCES public.news_items(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.news_origins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.news_origins FROM anon, authenticated;
GRANT ALL ON public.news_origins TO service_role;
GRANT SELECT, UPDATE ON public.news_origins TO authenticated;

DROP POLICY IF EXISTS "Admins can read news origins" ON public.news_origins;
CREATE POLICY "Admins can read news origins"
  ON public.news_origins FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can retry news origins" ON public.news_origins;
CREATE POLICY "Admins can retry news origins"
  ON public.news_origins FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS set_news_origins_updated_at ON public.news_origins;
CREATE TRIGGER set_news_origins_updated_at
  BEFORE UPDATE ON public.news_origins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.news_items
  ALTER COLUMN source_url DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS origin_id uuid
    REFERENCES public.news_origins(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS content_kind text NOT NULL DEFAULT 'brief'
    CHECK (content_kind IN ('full', 'brief'));

-- Preserve origin URLs for audit/deduplication before removing them from the
-- publicly readable news_items rows. Existing articles intentionally remain
-- legacy briefs; they are not sent through the rewrite queue.
INSERT INTO public.news_origins (
  source_id,
  source_name,
  source_url,
  raw_title,
  raw_summary,
  content_kind,
  auto_publish,
  pipeline_status,
  published_at
)
SELECT DISTINCT ON (n.source_url)
  n.source_id,
  n.source,
  n.source_url,
  n.title,
  n.summary,
  'brief',
  true,
  'published',
  n.published_at
FROM public.news_items n
WHERE n.source_url IS NOT NULL
  AND btrim(n.source_url) <> ''
ORDER BY n.source_url, n.created_at;

UPDATE public.news_items n
SET origin_id = o.id
FROM public.news_origins o
WHERE n.source_url = o.source_url
  AND n.origin_id IS NULL;

UPDATE public.news_origins o
SET
  en_news_id = pair.en_id,
  vi_news_id = pair.vi_id
FROM (
  SELECT
    origin_id,
    (array_agg(id ORDER BY created_at) FILTER (WHERE language = 'en'))[1] AS en_id,
    (array_agg(id ORDER BY created_at) FILTER (WHERE language = 'vi'))[1] AS vi_id
  FROM public.news_items
  WHERE origin_id IS NOT NULL
  GROUP BY origin_id
) pair
WHERE o.id = pair.origin_id;

-- RLS is row-level, not column-level. Nulling this legacy public column is
-- required so an anonymous PostgREST caller cannot recover source URLs.
UPDATE public.news_items
SET source_url = NULL,
    image_url = NULL
WHERE source_url IS NOT NULL
   OR image_url IS NOT NULL;
DROP INDEX IF EXISTS public.uniq_news_items_source_url_lang;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_news_items_origin_language
  ON public.news_items(origin_id, language)
  WHERE origin_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_news_origins_pipeline
  ON public.news_origins(pipeline_status, published_at DESC);

CREATE OR REPLACE FUNCTION public.claim_pending_news_origins(
  p_batch_size integer DEFAULT 2
)
RETURNS SETOF public.news_origins
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT o.id
    FROM public.news_origins o
    WHERE o.pipeline_status = 'pending'
    ORDER BY o.published_at
    LIMIT greatest(1, least(p_batch_size, 5))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.news_origins o
  SET pipeline_status = 'rewriting',
      attempts = attempts + 1,
      last_error = NULL
  FROM picked p
  WHERE o.id = p.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_news_origins(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_news_origins(integer)
  TO service_role;

-- Publish the generated EN/VI pair and transition the origin in one database
-- transaction. Only service_role may call this function.
CREATE OR REPLACE FUNCTION public.publish_rewritten_news(
  p_origin_id uuid,
  p_en jsonb,
  p_vi jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origin public.news_origins%ROWTYPE;
  v_en_id uuid;
  v_vi_id uuid;
  v_en_slug text;
  v_vi_slug text;
  v_status public.news_status;
BEGIN
  SELECT * INTO v_origin
  FROM public.news_origins
  WHERE id = p_origin_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'news origin not found';
  END IF;

  IF v_origin.pipeline_status NOT IN ('pending', 'rewriting', 'failed') THEN
    RAISE EXCEPTION 'news origin cannot be published from status %',
      v_origin.pipeline_status;
  END IF;

  v_en_slug := p_en->>'slug';
  v_vi_slug := p_vi->>'slug';
  v_status := CASE
    WHEN v_origin.auto_publish THEN 'published'::public.news_status
    ELSE 'draft'::public.news_status
  END;
  IF coalesce(v_en_slug, '') = '' OR coalesce(v_vi_slug, '') = '' THEN
    RAISE EXCEPTION 'both language slugs are required';
  END IF;

  INSERT INTO public.news_items (
    title, summary, source, source_url, source_id, origin_id,
    published_at, status, language, slug, image_url, category,
    importance, ai_translated, ai_translation_status, content_html,
    content_kind
  ) VALUES (
    p_en->>'title',
    p_en->>'summary',
    v_origin.source_name,
    NULL,
    v_origin.source_id,
    v_origin.id,
    v_origin.published_at,
    v_status,
    'en',
    v_en_slug,
    NULL,
    NULLIF(p_en->>'category', ''),
    coalesce((p_en->>'importance')::integer, 3),
    false,
    'done',
    p_en->>'content_html',
    v_origin.content_kind
  )
  RETURNING id INTO v_en_id;

  INSERT INTO public.news_items (
    title, summary, source, source_url, source_id, origin_id,
    published_at, status, language, slug, image_url, category,
    importance, ai_translated, parent_news_id, content_html,
    content_kind
  ) VALUES (
    p_vi->>'title',
    p_vi->>'summary',
    v_origin.source_name,
    NULL,
    v_origin.source_id,
    v_origin.id,
    v_origin.published_at,
    v_status,
    'vi',
    v_vi_slug,
    NULL,
    NULLIF(p_vi->>'category', ''),
    coalesce((p_vi->>'importance')::integer, 3),
    true,
    v_en_id,
    p_vi->>'content_html',
    v_origin.content_kind
  )
  RETURNING id INTO v_vi_id;

  UPDATE public.news_origins
  SET pipeline_status = 'published',
      en_news_id = v_en_id,
      vi_news_id = v_vi_id,
      last_error = NULL
  WHERE id = v_origin.id;

  RETURN jsonb_build_object(
    'en_id', v_en_id,
    'vi_id', v_vi_id,
    'en_slug', v_en_slug,
    'vi_slug', v_vi_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_rewritten_news(uuid, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_rewritten_news(uuid, jsonb, jsonb)
  TO service_role;

-- The Kitchen moved from Shopify Atom to WordPress RSS.
UPDATE public.news_sources
SET feed_url = 'https://thekitchenpickle.com/blogs/category/news/feed/',
    feed_type = 'rss',
    notes = 'WordPress category RSS. Full article extraction falls back to a short brief when needed.'
WHERE id = 'kitchen';

-- Schedule the rewrite queue independently from the Cloudflare fetch cron.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_job_id bigint;
  v_command text;
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-translate-every-30m') THEN
    PERFORM cron.unschedule('news-translate-every-30m');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news-translate-daily-7am-ict') THEN
    PERFORM cron.unschedule('news-translate-daily-7am-ict');
  END IF;

  v_command := $command$
    SELECT net.http_post(
      url := public.ops_project_url() || '/functions/v1/news-rewrite',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'cron_secret'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $command$;

  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'news-rewrite-every-30m'
  LIMIT 1;

  IF v_job_id IS NULL THEN
    PERFORM cron.schedule('news-rewrite-every-30m', '*/30 * * * *', v_command);
  ELSE
    PERFORM cron.alter_job(
      job_id := v_job_id,
      schedule := '*/30 * * * *',
      command := v_command,
      active := true
    );
  END IF;
END $$;

INSERT INTO public.ops_cron_monitors (
  monitor_key,
  display_name,
  source,
  cron_job_name,
  expected_interval_seconds,
  grace_seconds,
  enabled
)
VALUES (
  'news-rewrite',
  'News bilingual editorial rewrite',
  'pg_net',
  'news-rewrite-every-30m',
  1800,
  900,
  true
)
ON CONFLICT (monitor_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  source = EXCLUDED.source,
  cron_job_name = EXCLUDED.cron_job_name,
  expected_interval_seconds = EXCLUDED.expected_interval_seconds,
  grace_seconds = EXCLUDED.grace_seconds,
  enabled = true;
