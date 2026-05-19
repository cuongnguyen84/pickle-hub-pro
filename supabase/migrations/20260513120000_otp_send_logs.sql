-- ============================================================================
-- Social Events MVP — PR61: OTP-send channel telemetry
-- ============================================================================
-- phone-otp-send now tries Zalo ZNS first and falls back to eSMS. We need
-- a tiny log to monitor channel mix vs. the Zalo OA free tier limit (50
-- ZNS/day) and to debug delivery failures.
--
-- Service-role-only — the log contains phone numbers and should never
-- leak to anon/auth clients.
--
-- IDEMPOTENT.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.otp_send_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164  TEXT NOT NULL,
  event_id    UUID,
  channel     TEXT NOT NULL,
  success     BOOLEAN NOT NULL,
  error_code  TEXT,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_send_logs
  DROP CONSTRAINT IF EXISTS otp_send_logs_channel_chk;
ALTER TABLE public.otp_send_logs
  ADD CONSTRAINT otp_send_logs_channel_chk
  CHECK (channel IN ('zalo', 'sms', 'dev'));

ALTER TABLE public.otp_send_logs
  DROP CONSTRAINT IF EXISTS otp_send_logs_phone_format;
ALTER TABLE public.otp_send_logs
  ADD CONSTRAINT otp_send_logs_phone_format
  CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

CREATE INDEX IF NOT EXISTS idx_otp_send_logs_channel_date
  ON public.otp_send_logs (channel, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_otp_send_logs_phone_recent
  ON public.otp_send_logs (phone_e164, sent_at DESC);

ALTER TABLE public.otp_send_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.otp_send_logs FROM PUBLIC;
REVOKE ALL ON public.otp_send_logs FROM anon, authenticated;

COMMENT ON TABLE public.otp_send_logs IS
  'Per-OTP channel telemetry from phone-otp-send. Service-role only. Query channel mix + delivery success against Zalo OA free-tier limits (50 ZNS/day).';
