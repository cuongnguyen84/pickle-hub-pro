import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackJourneyStep } from "@/lib/journeys";
import { trackSocialRegistrationFailure } from "../registrationAnalytics";
vi.mock("@/lib/journeys", () => ({ trackJourneyStep: vi.fn() }));

describe("Social Event registration failure analytics", () => {
  beforeEach(() => vi.clearAllMocks());
  it("preserves approved stage/code and safe journey dimensions", () => {
    trackSocialRegistrationFailure("otp_verify", "otp_expired", { price_type: "free" });
    expect(trackJourneyStep).toHaveBeenCalledWith("player_registration", "player_registration_failed", {
      price_type: "free", failure_stage: "otp_verify", failure_code: "otp_expired",
    });
  });
  it.each(["auth_required", "slot_capacity_invalid", "zalo_send_failed", "registration_insert_failed"])("retains known API diagnostic %s", (code) => {
    trackSocialRegistrationFailure("member_register", code, {});
    expect(trackJourneyStep).toHaveBeenCalledWith("player_registration", "player_registration_failed", { failure_stage: "member_register", failure_code: code });
  });
  it.each(["person@example.com", "+84901234567", "token_abc_secret", "otp_expired person@example.com", "arbitrary_server_error", undefined, {}, 123])("redacts unapproved response code %j", (code) => {
    trackSocialRegistrationFailure("otp_send", code, {});
    expect(trackJourneyStep).toHaveBeenCalledExactlyOnceWith("player_registration", "player_registration_failed", {
      failure_stage: "otp_send", failure_code: "unknown",
    });
  });
});
