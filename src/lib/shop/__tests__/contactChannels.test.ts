/**
 * The client mirror of shop_contact_normalize(). Every case here is also
 * asserted in supabase/tests/shop_phase2a_profile.test.sql against the real
 * function — this file only proves the seller gets the same answer while
 * typing that they would get from the server.
 */
import { describe, expect, it } from "vitest";
import { publicityLabel, validateChannel } from "../contactChannels";

describe("validateChannel — phone", () => {
  it.each([
    ["0901234567", "+84901234567"],
    ["0901 234 567", "+84901234567"],
    ["+84901234567", "+84901234567"],
    ["84901234567", "+84901234567"],
  ])("%s → %s", (input, expected) => {
    expect(validateChannel("phone", input)).toEqual({ ok: true, normalized: expected });
  });

  it.each(["012345", "0201234567", "abc", ""])("refuses %s", (input) => {
    expect(validateChannel("phone", input).ok).toBe(false);
  });
});

describe("validateChannel — zalo", () => {
  it("keeps a zalo.me handle", () => {
    expect(validateChannel("zalo", "https://zalo.me/shopcuatoi").normalized).toBe(
      "https://zalo.me/shopcuatoi",
    );
  });

  it("drops tracking query strings rather than storing them", () => {
    expect(validateChannel("zalo", "zalo.me/shopcuatoi?utm_source=x").normalized).toBe(
      "https://zalo.me/shopcuatoi",
    );
  });

  it("accepts a bare phone number — the commonest case for a pilot seller", () => {
    expect(validateChannel("zalo", "0901234567").normalized).toBe("https://zalo.me/84901234567");
  });

  it("refuses a zalo.me link with an unusable handle", () => {
    expect(validateChannel("zalo", "https://zalo.me/a").ok).toBe(false);
  });
});

describe("validateChannel — messenger", () => {
  it.each([
    ["https://m.me/shop.pickle", "https://m.me/shop.pickle"],
    ["facebook.com/shop.pickle", "https://m.me/shop.pickle"],
    ["messenger.com/shop.pickle", "https://m.me/shop.pickle"],
    ["shop.pickle", "https://m.me/shop.pickle"],
  ])("%s → %s", (input, expected) => {
    expect(validateChannel("messenger", input).normalized).toBe(expected);
  });

  it("refuses a handle with a space", () => {
    expect(validateChannel("messenger", "https://m.me/a b").ok).toBe(false);
  });
});

describe("validateChannel — schemes that must never reach an href", () => {
  it.each([
    "javascript:alert(1)",
    "  JavaScript:alert(1)",
    "data:text/html,<script>",
    "vbscript:msgbox(1)",
    "file:///etc/passwd",
    "blob:https://x/y",
  ])("refuses %s", (input) => {
    for (const type of ["zalo", "messenger", "phone"] as const) {
      expect(validateChannel(type, input).ok).toBe(false);
    }
  });
});

describe("publicityLabel — says what is true, not what was asked for", () => {
  it("a channel the seller has not opted public is private, whatever its state", () => {
    expect(publicityLabel({ is_public: false, state: "approved" })).toEqual({
      text: "Chỉ mình bạn thấy",
      tone: "muted",
    });
  });

  it("opting public is not being public — approval decides", () => {
    expect(publicityLabel({ is_public: true, state: "pending_review" }).text).toBe(
      "Chờ duyệt — chưa hiển thị",
    );
    expect(publicityLabel({ is_public: true, state: "draft" }).text).toBe(
      "Chưa gửi duyệt — chưa hiển thị",
    );
    expect(publicityLabel({ is_public: true, state: "rejected" }).tone).toBe("warn");
    expect(publicityLabel({ is_public: true, state: "disabled" }).tone).toBe("warn");
  });

  it("only both together read as public", () => {
    expect(publicityLabel({ is_public: true, state: "approved" })).toEqual({
      text: "Đang hiển thị công khai",
      tone: "ok",
    });
  });
});
