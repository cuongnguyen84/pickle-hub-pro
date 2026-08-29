-- Make editorial rewrite failures observable and automatically retry transient
-- or model-validation failures without permanently blocking the queue.
ALTER TABLE public.news_origins
  ADD COLUMN IF NOT EXISTS failure_kind text
    CHECK (failure_kind IN ('length', 'validation', 'gemini_http', 'publish', 'unknown')),
  ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_news_origins_retry_queue
  ON public.news_origins(next_retry_at, published_at)
  WHERE pipeline_status = 'failed' AND retryable = true;

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
       OR (
         o.pipeline_status = 'failed'
         AND o.retryable = true
         AND o.attempts < 5
         AND coalesce(o.next_retry_at, now()) <= now()
       )
    ORDER BY o.published_at
    LIMIT greatest(1, least(p_batch_size, 5))
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.news_origins o
  SET pipeline_status = 'rewriting',
      attempts = attempts + 1,
      last_error = NULL,
      failure_kind = NULL,
      retryable = false,
      next_retry_at = NULL
  FROM picked p
  WHERE o.id = p.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_news_origins(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pending_news_origins(integer)
  TO service_role;

-- Existing word-count failures are safe to retry immediately under the new
-- wider hard bounds and targeted repair flow. Other historical failures stay
-- manual so a deployment does not revive unknown or non-content errors.
UPDATE public.news_origins
SET failure_kind = 'length',
    retryable = attempts < 5,
    next_retry_at = CASE WHEN attempts < 5 THEN now() ELSE NULL END
WHERE pipeline_status = 'failed'
  AND last_error ~* 'body has [0-9]+ words';
