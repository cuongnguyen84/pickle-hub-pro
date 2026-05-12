-- ============================================================================
-- Social Events MVP — PR51 (payment refactor): event_payment_config
-- ============================================================================
-- PR49 stored the bank account at the club level (`club_payment_config`)
-- on the assumption that one club ↔ one organizer ↔ one bank account.
-- In practice a single club hosts events run by several organizers and
-- those organizers want their own bank accounts collecting fees per
-- event. PR51 moves payment config one level down — onto the event row.
--
-- Migration order:
--   1. CREATE `event_payment_config` (new) with the same shape as the
--      old club_payment_config but keyed on event_id.
--   2. DROP `club_payment_config` — no production data yet, CASCADE
--      is safe (`payment_orders` references event_registrations, not
--      club_payment_config, so nothing breaks).
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

-- ─── 1. New event-level table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_payment_config (
  event_id             UUID PRIMARY KEY REFERENCES public.social_events(id) ON DELETE CASCADE,
  bank_code            TEXT NOT NULL,
  bank_account_number  TEXT NOT NULL,
  bank_account_name    TEXT NOT NULL,
  enabled              BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.event_payment_config
  DROP CONSTRAINT IF EXISTS event_payment_config_bank_code_format;
ALTER TABLE public.event_payment_config
  ADD CONSTRAINT event_payment_config_bank_code_format
  CHECK (bank_code ~ '^[A-Z0-9]{2,16}$');

ALTER TABLE public.event_payment_config
  DROP CONSTRAINT IF EXISTS event_payment_config_account_number_format;
ALTER TABLE public.event_payment_config
  ADD CONSTRAINT event_payment_config_account_number_format
  CHECK (bank_account_number ~ '^[0-9]{3,30}$');

ALTER TABLE public.event_payment_config
  DROP CONSTRAINT IF EXISTS event_payment_config_account_name_len;
ALTER TABLE public.event_payment_config
  ADD CONSTRAINT event_payment_config_account_name_len
  CHECK (length(trim(bank_account_name)) BETWEEN 1 AND 100);

-- ─── 2. RLS ─────────────────────────────────────────────────────────────────

ALTER TABLE public.event_payment_config ENABLE ROW LEVEL SECURITY;

-- Public SELECT — only when the parent event is published+public, so
-- draft / club-only event bank info never leaks.
DROP POLICY IF EXISTS "event_payment_config_select_public" ON public.event_payment_config;
CREATE POLICY "event_payment_config_select_public" ON public.event_payment_config
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.status = 'published'
        AND e.visibility = 'public'
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.created_by = auth.uid()
    )
  );

-- INSERT/UPDATE/DELETE: event creator + admin only.
DROP POLICY IF EXISTS "event_payment_config_insert_owner" ON public.event_payment_config;
CREATE POLICY "event_payment_config_insert_owner" ON public.event_payment_config
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_payment_config_update_owner" ON public.event_payment_config;
CREATE POLICY "event_payment_config_update_owner" ON public.event_payment_config
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "event_payment_config_delete_owner" ON public.event_payment_config;
CREATE POLICY "event_payment_config_delete_owner" ON public.event_payment_config
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.social_events e
      WHERE e.id = event_payment_config.event_id
        AND e.created_by = auth.uid()
    )
  );

-- ─── 3. GRANTs — gate BEFORE RLS, missing them surfaces as 42501 ────────────

GRANT SELECT                         ON public.event_payment_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_payment_config TO authenticated;

-- ─── 4. updated_at trigger ──────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_event_payment_config_touch_updated_at ON public.event_payment_config;
CREATE TRIGGER trg_event_payment_config_touch_updated_at
  BEFORE UPDATE ON public.event_payment_config
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_social_events_touch_updated_at();

COMMENT ON TABLE public.event_payment_config IS
  'Per-event VietQR bank account. Public SELECT only when parent event is published+public. Owner/admin INSERT+UPDATE+DELETE. Supersedes club_payment_config from PR49. See migration 20260512140000.';

-- ─── 5. Drop the now-obsolete club-level table ──────────────────────────────
-- No production data yet; CASCADE is safe.

DROP TABLE IF EXISTS public.club_payment_config CASCADE;
