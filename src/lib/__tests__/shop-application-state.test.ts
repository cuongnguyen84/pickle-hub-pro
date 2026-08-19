// Seller application state machine + validation.
//
// These rules exist twice on purpose — here for the message next to the field,
// and in shop_application_submit() / shop_application_decide() for the
// authority. This suite pins the client half; supabase/tests/shop_phase1_rls
// .test.sql pins the server half. If the two ever disagree, the server wins
// and this file is the bug.

import { describe, expect, it } from "vitest";
import {
  APPLICATION_RULES,
  applicationDeepLink,
  canDecide,
  canEdit,
  canPerform,
  decisionBlocker,
  failingRules,
  failingSteps,
  isSubmittable,
  isTerminal,
  REQUEST_TARGETS,
  targetByField,
  type ApplicationDraft,
  type ApplicationStatus,
} from "../shop/applicationState";

const complete: ApplicationDraft = {
  seller_type: "ho-kinh-doanh",
  full_name: "Nguyễn Thị Thanh Hương",
  phone: "0901234567",
  shop_name: "Pickle Gear Sài Gòn",
  city: "TP. Hồ Chí Minh",
};

const ALL: ApplicationStatus[] = [
  "draft", "submitted", "under_review", "needs_changes",
  "approved", "rejected", "withdrawn",
];

describe("application state machine", () => {
  it("only draft and needs_changes are editable", () => {
    expect(ALL.filter(canEdit)).toEqual(["draft", "needs_changes"]);
  });

  it("only approved, rejected and withdrawn are terminal", () => {
    expect(ALL.filter(isTerminal)).toEqual(["approved", "rejected", "withdrawn"]);
  });

  it("a moderator can only act on an application that is actually open", () => {
    expect(ALL.filter(canDecide)).toEqual(["submitted", "under_review", "needs_changes"]);
  });

  it("a terminal application can no longer be withdrawn", () => {
    for (const s of ALL) {
      expect(canPerform(s, "withdraw")).toBe(!isTerminal(s));
    }
  });

  it("an approved application can never be edited or re-decided", () => {
    expect(canPerform("approved", "save")).toBe(false);
    expect(canPerform("approved", "submit")).toBe(false);
    expect(canPerform("approved", "decide")).toBe(false);
  });

  it("an unknown action is denied, not allowed by accident", () => {
    expect(canPerform("draft", "activate" as never)).toBe(false);
  });
});

describe("field validation", () => {
  it("a complete draft is submittable", () => {
    expect(isSubmittable(complete)).toBe(true);
    expect(failingRules(complete)).toEqual([]);
  });

  it("an empty draft fails every required rule", () => {
    expect(failingRules({})).toHaveLength(APPLICATION_RULES.length);
  });

  it("rejects a phone that is not 10 digits starting with 0", () => {
    const bad = ["123", "0901", "1901234567", "+84901234567", "09012345678"];
    for (const phone of bad) {
      expect(isSubmittable({ ...complete, phone })).toBe(false);
    }
  });

  it("accepts a phone typed with spaces — people paste them that way", () => {
    expect(isSubmittable({ ...complete, phone: "0901 234 567" })).toBe(true);
  });

  it("treats whitespace-only text as missing", () => {
    expect(isSubmittable({ ...complete, shop_name: "   " })).toBe(false);
    expect(isSubmittable({ ...complete, full_name: "  " })).toBe(false);
  });

  it("summarises failures by step for the stepper", () => {
    expect(failingSteps({})).toEqual([0, 1, 2, 3]);
    expect(failingSteps({ ...complete, phone: "" })).toEqual([1]);
    expect(failingSteps(complete)).toEqual([]);
  });

  it("every rule has a unique field id — a deep link must be unambiguous", () => {
    const ids = REQUEST_TARGETS.map((t) => t.field);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("deep links", () => {
  it("points at the step that owns the field", () => {
    expect(applicationDeepLink("f-phone")).toBe("/seller/application?step=1&focus=f-phone");
    expect(applicationDeepLink("f-city")).toBe("/seller/application?step=3&focus=f-city");
  });

  it("degrades to the form root for an unknown field instead of a broken URL", () => {
    expect(applicationDeepLink("f-nope")).toBe("/seller/application");
    expect(targetByField("f-nope")).toBeUndefined();
  });
});

describe("decision guards", () => {
  it("approve needs neither a note nor a target", () => {
    expect(decisionBlocker({ decision: "approve", applicantNote: "", requestedFields: [] })).toBeNull();
  });

  it("reject needs a real note, not a word", () => {
    expect(decisionBlocker({ decision: "reject", applicantNote: "khong", requestedFields: [] })).toContain("Viết rõ");
    expect(
      decisionBlocker({ decision: "reject", applicantNote: "Sản phẩm vi phạm quy định hàng giả.", requestedFields: [] }),
    ).toBeNull();
  });

  it("request-changes needs a note AND at least one target field", () => {
    const note = "Ảnh giấy phép thiếu góc dưới, chụp lại đủ 4 góc giúp mình.";
    expect(decisionBlocker({ decision: "request-changes", applicantNote: note, requestedFields: [] })).toContain("Tick ít nhất một ô");
    expect(decisionBlocker({ decision: "request-changes", applicantNote: note, requestedFields: ["f-phone"] })).toBeNull();
  });

  it("blocks an empty decision", () => {
    expect(decisionBlocker({ decision: "", applicantNote: "", requestedFields: [] })).toBe("Chọn một quyết định.");
  });
});
