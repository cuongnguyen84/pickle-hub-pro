import { trackJourneyStep } from "@/lib/journeys";
import type { JourneyProps } from "@/lib/journeys";

// Server errors are untrusted telemetry input. Keep UI translation separate:
// unknown values must never become analytics dimensions (or leak free text).
import { REGISTRATION_FAILURE_CODES as FAILURE_CODES } from "@/lib/social-events/registrationFailureCodes";

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
