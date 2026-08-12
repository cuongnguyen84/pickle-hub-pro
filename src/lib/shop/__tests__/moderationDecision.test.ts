// The branch that decides whether "Gửi quyết định" is clickable. The server
// enforces all of this anyway; the point of testing it here is that a
// moderator should learn why the button is disabled BEFORE writing three
// paragraphs, not from a 22023 afterwards.

import { describe, expect, it } from "vitest";
import {
  DECISIONS,
  DECISION_CONSEQUENCE,
  NEEDS_APPLICANT_NOTE,
  NEEDS_TARGETS,
  decisionBlocker,
  emptyDraft,
  isTargetPicked,
  moderationErrorMessage,
  targetLabel,
  targetsPayload,
  toggleTarget,
  type DecisionDraft,
  type ModerationTarget,
} from "../moderationDecision";
import { waitingLabel } from "../moderationQueue";

const draft = (over: Partial<DecisionDraft> = {}): DecisionDraft => ({
  ...emptyDraft(),
  ...over,
});

const ALL = [...DECISIONS];

describe("decisionBlocker", () => {
  it("asks for a decision first", () => {
    expect(decisionBlocker(draft(), ALL)).toMatch(/Chọn một quyết định/);
  });

  it("refuses a decision the server would not allow in this state", () => {
    // allowed_decisions comes from product_moderation_detail. A screen holding
    // a stale copy must not offer a button the server will refuse.
    expect(decisionBlocker(draft({ decision: "approve" }), ["reopen"])).toMatch(/đã đổi trạng thái/);
  });

  it("requires at least one target for request_changes and reopen", () => {
    for (const d of NEEDS_TARGETS) {
      expect(
        decisionBlocker(draft({ decision: d, applicantNote: "sửa giúp em", confirmed: true }), ALL),
      ).toMatch(/ít nhất một chỗ cần sửa/);
    }
  });

  it("requires a seller-visible note for every decision except approve", () => {
    for (const d of NEEDS_APPLICANT_NOTE) {
      const withTargets = NEEDS_TARGETS.includes(d)
        ? [{ section: "media" } as ModerationTarget]
        : [];
      expect(
        decisionBlocker(draft({ decision: d, targets: withTargets, confirmed: true }), ALL),
        d,
      ).toMatch(/lời nhắn cho người bán/);
    }
  });

  it("does not demand a note for approve", () => {
    expect(decisionBlocker(draft({ decision: "approve", confirmed: true }), ALL)).toBeNull();
  });

  it("still demands the confirmation tick", () => {
    expect(decisionBlocker(draft({ decision: "approve" }), ALL)).toMatch(/Xác nhận/);
  });

  it("clears once everything is present", () => {
    expect(
      decisionBlocker(
        draft({
          decision: "request_changes",
          applicantNote: "Ảnh mờ quá",
          targets: [{ section: "media" }],
          confirmed: true,
        }),
        ALL,
      ),
    ).toBeNull();
  });

  it("treats whitespace as no note", () => {
    expect(
      decisionBlocker(
        draft({ decision: "reject", applicantNote: "   \n ", confirmed: true }),
        ALL,
      ),
    ).toMatch(/lời nhắn/);
  });
});

describe("targets", () => {
  it("identity is the whole tuple, not the section", () => {
    // Two media targets on DIFFERENT photos are two targets. Keying on the
    // section would silently collapse them into one.
    const a: ModerationTarget = { section: "media", media_id: "m1" };
    const b: ModerationTarget = { section: "media", media_id: "m2" };
    const picked = toggleTarget(toggleTarget([], a), b);
    expect(picked).toHaveLength(2);
    expect(isTargetPicked(picked, a)).toBe(true);
    expect(isTargetPicked(picked, b)).toBe(true);
  });

  it("toggles off the exact tuple it toggled on", () => {
    const a: ModerationTarget = { section: "price", variant_id: "v1" };
    expect(toggleTarget(toggleTarget([], a), a)).toEqual([]);
  });

  it("never carries a positional index", () => {
    // The server refuses index/position/nth outright; nothing here should be
    // able to produce one.
    const payload = targetsPayload(
      draft({ decision: "request_changes", targets: [{ section: "media", media_id: "m1" }] }),
    );
    expect(JSON.stringify(payload)).not.toMatch(/"(index|position|nth)"/);
  });

  it("sends no targets for decisions that take none", () => {
    expect(
      targetsPayload(draft({ decision: "reject", targets: [{ section: "media" }] })),
    ).toEqual([]);
  });

  it("labels a target by name, never by number", () => {
    expect(targetLabel({ section: "media", media_id: "m1" }, undefined, "ảnh chính")).toContain("ảnh chính");
    expect(targetLabel({ section: "price", variant_id: "v1" }, "Trắng / 40")).toContain("Trắng / 40");
  });
});

describe("consequence copy", () => {
  it("every decision says what happens after the click", () => {
    for (const d of DECISIONS) {
      expect(DECISION_CONSEQUENCE[d], d).toBeTruthy();
      expect(DECISION_CONSEQUENCE[d].length, d).toBeGreaterThan(40);
    }
  });

  it("suspend and reopen both say the product does not go back on sale by itself", () => {
    // Q5. If somebody softens this copy, the screen starts implying a button
    // that does not exist.
    expect(DECISION_CONSEQUENCE.suspend).toMatch(/KHÔNG tự bán lại|mở lại/);
    expect(DECISION_CONSEQUENCE.reopen).toMatch(/duyệt lần nữa|VẪN KHÔNG hiển thị/);
  });

  it("approve does not claim the product becomes visible immediately", () => {
    // It does not: the worker still has to copy the bytes.
    expect(DECISION_CONSEQUENCE.approve).toMatch(/sau khi ảnh lên xong|xếp hàng/);
  });
});

describe("moderationErrorMessage", () => {
  it("explains a stale version as the seller having edited, not as a crash", () => {
    expect(moderationErrorMessage({ message: "PT409: bản 4" })).toMatch(/đã sửa sản phẩm/);
  });

  it("tells an admin without 2FA what to do", () => {
    expect(moderationErrorMessage({ message: "admin required" })).toMatch(/2FA/);
  });

  it("says the seller received nothing when the cause is unknown", () => {
    expect(moderationErrorMessage(new Error("boom"))).toMatch(/CHƯA nhận được gì/);
  });
});

describe("waitingLabel", () => {
  it("is coarse on purpose", () => {
    expect(waitingLabel(30)).toBe("vừa xong");
    expect(waitingLabel(60 * 5)).toBe("5 phút");
    expect(waitingLabel(60 * 60 * 3)).toBe("3 giờ");
    expect(waitingLabel(60 * 60 * 24 * 4)).toBe("4 ngày");
  });

  it("does not render a negative or missing duration as a number", () => {
    expect(waitingLabel(-1)).toBe("—");
    expect(waitingLabel(Number.NaN)).toBe("—");
  });
});
