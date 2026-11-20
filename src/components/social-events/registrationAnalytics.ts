import { trackJourneyStep } from "@/lib/journeys";
import type { JourneyProps } from "@/lib/journeys";

// Server errors are untrusted telemetry input. Keep UI translation separate:
// unknown values must never become analytics dimensions (or leak free text).
const FAILURE_CODES = new Set([
  "already_registered",
  "auth_required",
  "capacity_check_failed",
  "captcha_failed",
  "captcha_misconfigured",
  "daily_budget_exceeded",
  "event_full",
  "event_lookup_failed",
  "event_not_found",
  "event_not_public",
  "event_not_published",
  "event_started_or_ended",
  "ghost_profile_create_failed",
  "guests_not_allowed",
  "invalid_code_format",
  "invalid_display_name",
  "invalid_email",
  "invalid_event_id",
  "invalid_json",
  "invalid_phone",
  "invalid_self_rated_level",
  "method_not_allowed",
  "not_a_member",
  "otp_expired",
  "otp_lookup_failed",
  "otp_mismatch",
  "otp_not_found",
  "otp_persist_failed",
  "otp_too_many_attempts",
  "profile_lookup_failed",
  "rate_limit_check_failed",
  "registration_insert_failed",
  "registration_lookup_failed",
  "slot_capacity_invalid",
  "slot_full",
  "slot_not_found",
  "slot_required",
  "sms_send_failed",
  "too_many_otps",
  "too_many_otps_ip",
  "zalo_send_failed",
]);

type FailureStage = "otp_send" | "otp_verify" | "member_register";

export function trackSocialRegistrationFailure(
  stage: FailureStage,
  code: unknown,
  props: JourneyProps,
): void {
  trackJourneyStep("player_registration", "player_registration_failed", {
    ...props,
    failure_stage: stage,
    failure_code: typeof code === "string" && FAILURE_CODES.has(code) ? code : "unknown",
  });
}
