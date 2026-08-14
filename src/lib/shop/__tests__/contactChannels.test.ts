/**
 * The client mirror of shop_contact_normalize(). Every case here is also
 * asserted in supabase/tests/shop_phase2a_profile.test.sql against the real
 * function — this file only proves the seller gets the same answer while
 * typing that they would get from the server.
 */
import { describe, expect, it } from "vitest";
import { publicityLabel, validateChannel } from "../contactChannels";

describe("validateChannel — business phone", () => {
  it.each([
    ["0901234567", "+84901234567"],
    ["0901 234 567", "+84901234567"],
    ["0901.234.567", "+84901234567"],
    ["0901-234-567", "+84901234567"],
    ["+84901234567", "+84901234567"],
    ["+84 901 234 567", "+84901234567"],
    ["84901234567", "+84901234567"],
    ["0084901234567", "+84901234567"],
    // A real Vinaphone number whose national form starts with the digits 84.
    // Stripping those as a country code leaves 7 digits and a wrong rejection.
    ["0847123456", "+84847123456"],
  ])("mobile %s → %s", (input, expected) => {
    expect(validateChannel("phone", input)).toEqual({ ok: true, normalized: expected });
  });

  it.each([
    // Two-digit area codes: 24 Hà Nội, 28 TP.HCM — 8-digit subscriber number.
    ["02438251234", "+842438251234"],
    ["024 3825 1234", "+842438251234"],
    ["(024) 3825-1234", "+842438251234"],
    ["+84 24 3825 1234", "+842438251234"],
    ["02838221234", "+842838221234"],
    // Three-digit area codes: 225 Hải Phòng, 236 Đà Nẵng — 7-digit subscriber.
    ["0225 3823 456", "+842253823456"],
    ["0236 3888 999", "+842363888999"],
  ])("landline %s → %s — D2 asks for a BUSINESS phone", (input, expected) => {
    expect(validateChannel("phone", input)).toEqual({ ok: true, normalized: expected });
  });

  it.each([
    ["091234567", "one digit short"],
    ["09123456789", "one digit long"],
    ["0243825123", "landline one digit short"],
    ["024382512345", "landline one digit long"],
    ["0212345678", "area code that is not a real one"],
    ["113", "short code"],
    ["abc", "no digits at all"],
    ["", "nothing"],
  ])("refuses %s (%s)", (input) => {
    expect(validateChannel("phone", input).ok).toBe(false);
  });

  it("names the 1900/1800 service lines instead of leaving them to digit count", () => {
    for (const input of ["19001234", "1800 1080", "01900 1234"]) {
      const result = validateChannel("phone", input);
      expect(result.ok).toBe(false);
      expect(result.error).toContain("1900/1800");
    }
  });

  it("tells a business phone and a Zalo number apart in the error copy", () => {
    // The whole point of the split: the same landline is valid as a shop phone
    // and impossible as a Zalo account, and the seller must be told which.
    expect(validateChannel("phone", "02438251234").ok).toBe(true);
    const zalo = validateChannel("zalo", "02438251234");
    expect(zalo.ok).toBe(false);
    expect(zalo.error).toContain("Zalo");
    expect(zalo.error).not.toContain("số bàn (028");
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

  it("refuses a landline in its own words — a fixed line cannot hold a Zalo account", () => {
    const result = validateChannel("zalo", "024 3825 1234");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("số bàn không đăng ký được Zalo");
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
