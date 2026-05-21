-- ============================================================================
-- DUPR RaaS — Webhook subscriptions + event log (PR3)
-- ----------------------------------------------------------------------------
-- Tracks (1) whether each connected user has been subscribed to RATING
-- webhook events on DUPR's side, and (2) a thin event log so we can debug
-- missed/duplicate events.
--
-- Subscription state lives on dupr_user_tokens as a single timestamp
-- column to avoid a 1:1 join. Unsubscribe sets it back to NULL.
-- ============================================================================

ALTER TABLE public.dupr_user_tokens
  ADD COLUMN IF NOT EXISTS webhook_subscribed_at timestamptz;

COMMENT ON COLUMN public.dupr_user_tokens.webhook_subscribed_at IS
  'When the user was subscribed to RATING webhook events via POST /user/v1.0/subscribe/webhook-event. NULL = not subscribed (or unsubscribed by dupr-disconnect).';

-- ─── dupr_webhook_events ───────────────────────────────────────────────────
-- Append-only event log. Used for debugging missed events; no business
-- logic reads from it. Retention: keep ~30d via a future cron.
CREATE TABLE IF NOT EXISTS public.dupr_webhook_events (
  id              bigserial PRIMARY KEY,
  received_at     timestamptz NOT NULL DEFAULT now(),
  topic           text NOT NULL,
  dupr_id         text,
  client_id       text,
  payload         jsonb NOT NULL,
  processed_at    timestamptz,
  processing_error text
);

CREATE INDEX IF NOT EXISTS dupr_webhook_events_received_idx
  ON public.dupr_webhook_events (received_at DESC);
CREATE INDEX IF NOT EXISTS dupr_webhook_events_dupr_id_idx
  ON public.dupr_webhook_events (dupr_id)
  WHERE dupr_id IS NOT NULL;

COMMENT ON TABLE public.dupr_webhook_events IS
  'Raw payloads received from DUPR webhooks. Used for debugging; profile updates happen inline in the dupr-webhook edge fn before the row is persisted.';

ALTER TABLE public.dupr_webhook_events ENABLE ROW LEVEL SECURITY;
-- No grants — service-role only.

-- ─── Extend dupr_rating_history.source whitelist ───────────────────────────
-- The existing CHECK constraint only allowed 'dupr_scrape' / 'manual' /
-- 'match_inferred'. PR1 inserts 'dupr_sso_initial' and PR3 (this PR)
-- inserts 'dupr_webhook'. Both were being silently rejected.
ALTER TABLE public.dupr_rating_history
  DROP CONSTRAINT IF EXISTS dupr_rating_history_source_check;
ALTER TABLE public.dupr_rating_history
  ADD CONSTRAINT dupr_rating_history_source_check
  CHECK (source = ANY (ARRAY[
    'dupr_scrape'::text,
    'manual'::text,
    'match_inferred'::text,
    'dupr_sso_initial'::text,
    'dupr_webhook'::text
  ]));

NOTIFY pgrst, 'reload schema';
