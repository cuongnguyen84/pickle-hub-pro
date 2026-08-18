-- A terminal state for origins that will never be published.
--
-- news-repair declines a row once its repair budget is spent or the article is
-- past the age cap, and correctly calls that "needs a human". The problem is
-- there was nothing for the human to do: the row stayed at pipeline_status
-- 'failed', so every hourly run rescanned it, reported it again, and counted it
-- in `left` — which kept the cron health at partial_success indefinitely.
-- Pressing "Xử lý" re-ran the same decline. An alert that repeats forever with
-- no available action is the kind that teaches people to ignore the channel.
--
-- 'abandoned' says the decision was made and closes the row. The reason stays
-- in last_error, and the row is still in the table for anyone who wants to look
-- or to move it back to 'pending' by hand.

ALTER TABLE public.news_origins DROP CONSTRAINT IF EXISTS news_origins_pipeline_status_check;

ALTER TABLE public.news_origins
  ADD CONSTRAINT news_origins_pipeline_status_check
  CHECK (pipeline_status = ANY (ARRAY[
    'pending'::text, 'extracting'::text, 'rewriting'::text,
    'published'::text, 'failed'::text, 'abandoned'::text
  ]));

-- Close the four that are already stuck, with why on each row.
UPDATE public.news_origins
   SET pipeline_status = 'abandoned',
       last_error = coalesce(last_error, '') ||
         ' | abandoned 2026-08-18: repair budget spent, no automatic path left'
 WHERE pipeline_status = 'failed'
   AND attempts >= 3;
