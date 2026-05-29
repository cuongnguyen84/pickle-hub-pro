-- ============================================================================
-- Client-side error tracking — solo-dev grade Sentry replacement
-- ============================================================================
-- Captures three kinds of events the production frontend can encounter
-- without anyone noticing:
--
--   - 'js_error'             — window.onerror catches (uncaught exception,
--                              script load failure, etc.)
--   - 'unhandled_rejection'  — unhandled Promise rejections
--   - 'csp_violation'        — CSP Report-Only reports (helps preview
--                              policy changes before they break things,
--                              mirrors the DUPR iframe CSP bug we hit
--                              2026-05-29)
--
-- The edge function log-client-event writes rows here. RLS lets only
-- admins read so we don't leak user agents / URLs to anyone else.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.client_errors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL,
  message      text,
  stack        text,
  url          text,
  user_agent   text,
  user_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details      jsonb,
  recorded_at  timestamptz NOT NULL DEFAULT now()
);

-- Constraint: type whitelist so noise stays bounded.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_client_errors_type'
  ) THEN
    ALTER TABLE public.client_errors
      ADD CONSTRAINT chk_client_errors_type
      CHECK (type IN ('js_error', 'unhandled_rejection', 'csp_violation'));
  END IF;
END $$;

-- Lookup indexes — admin dashboard filters by type + recency.
CREATE INDEX IF NOT EXISTS idx_client_errors_recorded_at
  ON public.client_errors (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_errors_type_recorded
  ON public.client_errors (type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_errors_user_id
  ON public.client_errors (user_id)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.client_errors IS
  'Solo-dev error tracker. Populated by edge function log-client-event via window.onerror + CSP report-uri.';

-- ─── RLS — admin-only read, service-role write ───────────────────────────
ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_errors_admin_read ON public.client_errors;
CREATE POLICY client_errors_admin_read
  ON public.client_errors
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insert path is service-role only (edge function writes; no client
-- token ever inserts directly).
GRANT SELECT ON public.client_errors TO authenticated;
GRANT INSERT, SELECT ON public.client_errors TO service_role;

NOTIFY pgrst, 'reload schema';
