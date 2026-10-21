/**
 * Reading the machine-readable half of an order refusal.
 *
 * The screens branch on `reason`, which lives inside DETAIL as a JSON STRING.
 * Two failure modes are worth a test and neither is hypothetical:
 *
 *   · JSON.parse throwing inside a render. Plenty of Postgres errors carry a
 *     DETAIL nobody wrote as JSON, and a 42501 from a table grant carries no
 *     DETAIL at all.
 *   · a reason this build has no branch for leaking to the buyer as a raw
 *     code. Every unknown gets the default sentence instead.
 */
import { describe, expect, it } from "vitest";
import {
  SHOP_ORDER_REASONS,
  isConflict,
  shopErrorDetail,
  shopErrorMessage,
  shopErrorReason,
  shopReasonMessage,
} from "../errors";

const raise = (code: string, message: string, detail: unknown) => ({
  code,
  message,
  details: typeof detail === "string" ? detail : JSON.stringify(detail),
  hint: null,
});

describe("shopErrorReason / shopErrorDetail", () => {
  it("reads the reason out of DETAIL", () => {
    const err = raise("PT409", "Giá vừa thay đổi.", {
      reason: "price_changed",
      variant_id: "v1",
      expected: 100000,
      current: 200000,
    });
    expect(shopErrorReason(err)).toBe("price_changed");
    expect(shopErrorDetail(err)).toMatchObject({ expected: 100000, current: 200000 });
  });

  it("does not throw when DETAIL is not JSON", () => {
    const err = raise("23514", "vi phạm ràng buộc", "Failing row contains (1, 2, 3).");
    expect(() => shopErrorReason(err)).not.toThrow();
    expect(shopErrorReason(err)).toBeNull();
    expect(shopErrorDetail(err)).toBeNull();
  });

  it("answers null for an error with no details at all", () => {
    expect(shopErrorReason({ code: "42501", message: "permission denied" })).toBeNull();
    expect(shopErrorReason(null)).toBeNull();
    expect(shopErrorReason(new Error("network"))).toBeNull();
  });

  it("refuses a DETAIL that parses to something that is not an object", () => {
    expect(shopErrorDetail(raise("PT409", "x", '"price_changed"'))).toBeNull();
    expect(shopErrorDetail(raise("PT409", "x", "[1,2]"))).toBeNull();
  });
});

describe("shopReasonMessage", () => {
  it("has a distinct Vietnamese sentence for every reason the RPCs raise", () => {
    expect(SHOP_ORDER_REASONS).toHaveLength(11);
    const sentences = SHOP_ORDER_REASONS.map((reason) =>
      shopReasonMessage(raise("PT409", "…", { reason })),
    );
    expect(new Set(sentences).size).toBe(11);
    for (const s of sentences) {
      expect(s.length).toBeGreaterThan(20);
      // Nothing technical reaches the buyer.
      expect(s).not.toMatch(/PT4\d\d|SQLSTATE|null|undefined/);
    }
  });

  it("never uses the banned wording for a paused shop", () => {
    const paused = shopReasonMessage(raise("PT403", "…", { reason: "ordering_disabled" }));
    expect(paused).toContain("Shop đang tạm ngưng bán.");
    expect(paused).not.toContain("Shop bị tạm ngưng");
  });

  it("falls back to one sentence for a reason this build does not know", () => {
    const unknown = shopReasonMessage(raise("PT409", "…", { reason: "wormhole_collapsed" }));
    expect(unknown).toBe("Chưa thực hiện được thao tác này. Anh/chị thử lại sau ít phút.");
    expect(unknown).not.toContain("wormhole");
  });

  it("falls back the same way when there is no reason at all", () => {
    expect(shopReasonMessage(new Error("Failed to fetch"))).toContain("Chưa thực hiện được");
  });
});

describe("the existing exports still behave", () => {
  it("shopErrorMessage still prefers the RPC's own Vietnamese", () => {
    expect(shopErrorMessage({ code: "PT409", message: "Giá vừa thay đổi trong lúc anh/chị điền." }))
      .toBe("Giá vừa thay đổi trong lúc anh/chị điền.");
    expect(shopErrorMessage({ code: "42501", message: "permission denied for table shops" }))
      .toBe("Bạn không có quyền thực hiện thay đổi này.");
  });

  it("isConflict still recognises both spellings", () => {
    expect(isConflict({ code: "PT409" })).toBe(true);
    expect(isConflict({ code: "40001" })).toBe(true);
    expect(isConflict({ code: "23505" })).toBe(false);
  });
});
