import { describe, it, expect } from "vitest";
import { REG_BADGE_MIN, regBadgeCount } from "../regBadge";

describe("regBadgeCount", () => {
  it("shows the count for an open-registration QuickTable at/above threshold", () => {
    expect(
      regBadgeCount({ status: "setup", requires_registration: true, registered_count: REG_BADGE_MIN }, "quick-tables"),
    ).toBe(REG_BADGE_MIN);
  });

  it("hides below threshold (anti-social-proof: '1 người đã đăng ký')", () => {
    expect(
      regBadgeCount({ status: "setup", requires_registration: true, registered_count: REG_BADGE_MIN - 1 }, "quick-tables"),
    ).toBeNull();
  });

  it("hides on a QuickTable that is NOT setup (already playing → 'đã đăng ký' is wrong)", () => {
    expect(
      regBadgeCount({ status: "group_stage", requires_registration: true, registered_count: 20 }, "quick-tables"),
    ).toBeNull();
    expect(
      regBadgeCount({ status: "playoff", requires_registration: true, registered_count: 20 }, "quick-tables"),
    ).toBeNull();
  });

  it("hides on a QuickTable that does not require registration (ad-hoc table)", () => {
    expect(
      regBadgeCount({ status: "setup", requires_registration: false, registered_count: 20 }, "quick-tables"),
    ).toBeNull();
  });

  it("shows for a Team Match in registration status, hides while ongoing", () => {
    expect(regBadgeCount({ status: "registration", registered_count: 8 }, "team-match")).toBe(8);
    expect(regBadgeCount({ status: "ongoing", registered_count: 8 }, "team-match")).toBeNull();
  });

  it("hides for formats without a badge (doubles-elim, flex)", () => {
    expect(regBadgeCount({ status: "setup", requires_registration: true, registered_count: 99 }, "doubles-elim")).toBeNull();
    expect(regBadgeCount({ status: "active", registered_count: 99 }, "flex")).toBeNull();
  });

  it("treats undefined/missing count as zero (degraded query → no badge)", () => {
    expect(regBadgeCount({ status: "setup", requires_registration: true }, "quick-tables")).toBeNull();
  });
});
