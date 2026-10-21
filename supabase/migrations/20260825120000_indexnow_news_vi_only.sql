-- C3 (2026-08-25) — stop announcing EN news URLs to IndexNow.
--
-- The EN news feed is now noindex (functions/_lib/render/news.ts) and is no
-- longer emitted in sitemap-news.xml. This job was still pushing every new EN
-- article to Bing/IndexNow every hour, which is the opposite instruction: it
-- asks a search engine to come and fetch a URL we are telling it not to index.
--
-- Why EN is out at all: every row in news_items is a third-party article the
-- fetcher pulled in, so the EN page competes head-on with the publisher it was
-- taken from — same content, published later, less authority. GSC over
-- 2026-05-23..08-22 put the whole /news/ segment at 48 clicks and 447
-- impressions from 12 pages out of 1,551, and every attributable page in that
-- set was a /vi/ one. The VI half is kept: a Vietnamese rendering of something
-- that exists only in English is a real service to a ~95%-Vietnamese audience.
--
-- Only the SELECT changes; schedule, window, key and payload shape are
-- unchanged from 20260823060000_indexnow_ping_news.sql.

SELECT cron.unschedule('indexnow-news-hourly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'indexnow-news-hourly');

SELECT cron.schedule(
  'indexnow-news-hourly',
  '7 * * * *',
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
      SELECT 'https://www.thepicklehub.net/vi/news/' || slug AS u
      FROM public.news_items
      WHERE status = 'published'
        AND language = 'vi'   -- C3: EN is noindex, never announce it
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
