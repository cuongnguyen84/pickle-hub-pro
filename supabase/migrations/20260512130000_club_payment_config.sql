-- ============================================================================
-- Social Events MVP — PR49 (Payment): club_payment_config
-- ============================================================================
-- One row per club storing the bank account that VietQR-rendered codes
-- will pay into. Players quote the reference code (PHUB-XXXXXX) in the
-- transfer memo so the organizer can match transfers in their banking
-- app — ThePickleHub never sees the money.
--
-- Public SELECT is intentional: the bank account is meant to be shared
-- with payers, and the QR rendering happens client-side directly from
-- these columns. INSERT / UPDATE / DELETE are gated to the club's
-- creator + admin role (matching the social_events ownership model).
--
-- IDEMPOTENT: replay-safe.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.club_payment_config (
  club_id              UUID PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
  bank_code            TEXT NOT NULL,
  bank_account_number  TEXT NOT NULL,
  bank_account_name    TEXT NOT NULL,
  enabled              BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Light validation. Bank codes are short alphanumeric (e.g. "VCB",
-- "TCB"); account numbers are digits only (3..30 chars); account name
-- is capped at 100 (VietQR's addInfo line limit is well above this).
ALTER TABLE public.club_payment_config
  DROP CONSTRAINT IF EXISTS club_payment_config_bank_code_format;
ALTER TABLE public.club_payment_config
  ADD CONSTRAINT club_payment_config_bank_code_format
  CHECK (bank_code ~ '^[A-Z0-9]{2,16}$');

ALTER TABLE public.club_payment_config
  DROP CONSTRAINT IF EXISTS club_payment_config_account_number_format;
ALTER TABLE public.club_payment_config
  ADD CONSTRAINT club_payment_config_account_number_format
  CHECK (bank_account_number ~ '^[0-9]{3,30}$');

ALTER TABLE public.club_payment_config
  DROP CONSTRAINT IF EXISTS club_payment_config_account_name_len;
ALTER TABLE public.club_payment_config
  ADD CONSTRAINT club_payment_config_account_name_len
  CHECK (length(trim(bank_account_name)) BETWEEN 1 AND 100);

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.club_payment_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "club_payment_config_select_public" ON public.club_payment_config;
CREATE POLICY "club_payment_config_select_public" ON public.club_payment_config
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "club_payment_config_insert_owner_or_admin" ON public.club_payment_config;
CREATE POLICY "club_payment_config_insert_owner_or_admin" ON public.club_payment_config
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_payment_config.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_payment_config_update_owner_or_admin" ON public.club_payment_config;
CREATE POLICY "club_payment_config_update_owner_or_admin" ON public.club_payment_config
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_payment_config.club_id
        AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_payment_config.club_id
        AND c.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS "club_payment_config_delete_owner_or_admin" ON public.club_payment_config;
CREATE POLICY "club_payment_config_delete_owner_or_admin" ON public.club_payment_config
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = club_payment_config.club_id
        AND c.created_by = auth.uid()
    )
  );

-- ─── GRANTs ─────────────────────────────────────────────────────────────────

GRANT SELECT                         ON public.club_payment_config TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_payment_config TO authenticated;

-- ─── updated_at trigger ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_club_payment_config_touch_updated_at ON public.club_payment_config;
CREATE TRIGGER trg_club_payment_config_touch_updated_at
  BEFORE UPDATE ON public.club_payment_config
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_social_events_touch_updated_at();

COMMENT ON TABLE public.club_payment_config IS
  'Per-club VietQR bank account config. Public SELECT — payers need the bank info to render the QR. Owner/admin INSERT+UPDATE+DELETE. See migration 20260512130000.';
