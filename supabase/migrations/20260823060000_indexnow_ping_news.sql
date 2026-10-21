-- News articles were never submitted to IndexNow. Found 2026-08-23.
--
-- functions/api/indexnow.ts only ever built static routes + blog slugs, and
-- nothing called it on a schedule: no pg_cron job, no worker, no GitHub
-- Action. So in the ~4 months the aggregator has been publishing (709 EN +
-- 767 VI articles) Bing and Yandex were told about exactly zero of them.
--
-- Ping straight from Postgres instead of adding an edge function: the
-- IndexNow key is public by design (it has to be fetchable at
-- /<key>.txt for the ownership check), so there is no secret to store and
-- nothing to deploy. ~20 lines of SQL replaces a function + an env var + a
-- second place for the URL-building logic to drift out of sync.
--
-- Deliberately NOT registered in ops_job_registry / ops_cron_monitors: this
-- job is a no-op in any hour with no fresh articles, and a monitored job that
-- legitimately skips its dispatch produces a permanent false "never_ran"
-- alarm — exactly the defect 20260818060000 was written to fix.

SELECT cron.unschedule('indexnow-news-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'indexnow-news-hourly');

SELECT cron.schedule(
  'indexnow-news-hourly',
  '45 * * * *',
  $job$
  DO $inner$
  DECLARE
    v_urls jsonb;
  BEGIN
    -- created_at, not published_at: published_at is the source's timestamp
    -- and is often older than the moment the row (or its VI translation)
    -- first existed on our site. The window is 2h against an hourly cron so
    -- a slow translation still gets picked up; re-submitting a URL is free.
    SELECT jsonb_agg(u) INTO v_urls
    FROM (
      SELECT CASE
               WHEN language = 'vi'
                 THEN 'https://www.thepicklehub.net/vi/news/' || slug
               ELSE 'https://www.thepicklehub.net/news/' || slug
             END AS u
      FROM public.news_items
      WHERE status = 'published'
        AND slug IS NOT NULL
        AND created_at > now() - interval '2 hours'
      ORDER BY created_at DESC
      LIMIT 10000  -- IndexNow's per-request cap
    ) s;

    IF v_urls IS NULL THEN
      RETURN;  -- quiet hour, nothing to announce
    END IF;

    PERFORM net.http_post(
      url := 'https://api.indexnow.org/indexnow',
      -- pg_net validates this string and RAISEs on anything but exactly
      -- "application/json" — a "; charset=utf-8" suffix aborts the whole job.
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'host', 'www.thepicklehub.net',
        'key', '0c8f695e57d24623a239bd91164f95d6',
        'keyLocation', 'https://www.thepicklehub.net/0c8f695e57d24623a239bd91164f95d6.txt',
        'urlList', v_urls
      ),
      timeout_milliseconds := 30000
    );
  END
  $inner$;
  $job$
);
