-- otp_send_logs: allow 'email' channel.
-- 2026-07-26: added email OTP delivery to social-event registration after the
-- Zalo OA lost its ZNS entitlement and eSMS was never configured. The channel
-- CHECK previously permitted only zalo/sms/dev, so logging an email send would
-- silently fail the insert (logSendAttempt swallows errors).
ALTER TABLE public.otp_send_logs
  DROP CONSTRAINT IF EXISTS otp_send_logs_channel_chk;
ALTER TABLE public.otp_send_logs
  ADD CONSTRAINT otp_send_logs_channel_chk
  CHECK (channel = ANY (ARRAY['zalo'::text, 'sms'::text, 'dev'::text, 'email'::text]));
