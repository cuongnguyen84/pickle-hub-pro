-- ============================================================================
-- OPS-04 inc3 — error-budget burn alert state (D2 converged spec)
-- ----------------------------------------------------------------------------
-- One row per burn-tracked SLO signal. errors-telegram-alert (service role)
-- reads/writes it for state-transition dedup: alert on ok→burning, REQUIRED
-- recovery message on burning→ok. RLS on, no policies — service role only,
-- same posture as ops_cron_alert_state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ops_slo_burn_state (
  slo_key         text PRIMARY KEY CHECK (slo_key IN (
    'client_errors_volume', 'client_errors_budget'
  )),
  state           text NOT NULL DEFAULT 'ok' CHECK (state IN ('ok', 'burning')),
  since           timestamptz NOT NULL DEFAULT now(),
  last_alerted_at timestamptz,
  last_value      numeric,
  last_burn_rate  numeric,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ops_slo_burn_state ENABLE ROW LEVEL SECURITY;

INSERT INTO public.ops_slo_burn_state (slo_key) VALUES
  ('client_errors_volume'),
  ('client_errors_budget')
ON CONFLICT (slo_key) DO NOTHING;
