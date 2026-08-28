// @vitest-environment jsdom
// ============================================================================
// The Privacy Policy has to keep naming Shop's data — CP16
// ----------------------------------------------------------------------------
// Seller Rules §14 puts itself UNDER the Privacy Policy: if the two disagree,
// the policy wins and we have to update it. That makes this page load-bearing
// rather than boilerplate, and the failure it can have is silent — a section
// deleted in a refactor, a translation that drops a promise, a bullet that
// slowly starts describing internal data as public.
//
// So the assertions come in two shapes, deliberately:
//
//   · through the PAGE, because a section that exists only in the dictionary
//     is a section nobody is shown. That is the seam the last four bugs in
//     this repo lived in.
//   · through the DICTIONARY, per language, because "the Vietnamese says the
//     pickup address is private and the English forgets to" is invisible to
//     any test that renders one language.
//
// Vietnamese is the source of business meaning here (95% of readers); English
// must carry the same commitments, not merely exist.
// ============================================================================

import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi as viTranslations } from "@/i18n/vi";
import { en as enTranslations } from "@/i18n/en";

/** Swapped per test so one render helper can serve both languages. */
const active = { t: viTranslations as typeof viTranslations };

vi.mock("@/components/layout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: active.t,
    language: "vi",
    setLanguage: vi.fn(),
    setLanguageFromUrl: vi.fn(),
  }),
}));

const Privacy = (await import("../Privacy")).default;

const renderIn = (dict: typeof viTranslations) => {
  active.t = dict;
  render(
    <MemoryRouter>
      <Privacy />
    </MemoryRouter>,
  );
  return document.body.textContent ?? "";
};

afterEach(cleanup);

const LANGUAGES = [
  { name: "vi", dict: viTranslations },
  { name: "en", dict: enTranslations as unknown as typeof viTranslations },
] as const;

describe("Privacy page — the Shop section reaches the reader", () => {
  it.each(LANGUAGES)("renders all four Shop data groups in $name", ({ dict }) => {
    const text = renderIn(dict);
    const shop = dict.privacy.shop;

    expect(text).toContain(shop.title);
    expect(text).toContain(shop.description);
    // Four groups, and each one named individually: a loop over
    // Object.values would still pass if a <li> were dropped from the JSX and
    // the key left in the dictionary.
    expect(text).toContain(shop.groups.public);
    expect(text).toContain(shop.groups.internal);
    expect(text).toContain(shop.groups.consent);
    expect(text).toContain(shop.groups.moderation);
    expect(text).toContain(shop.purpose);
    expect(text).toContain(shop.retention);
  });

  it("shows the effective date the policy was actually updated on", () => {
    // Orders, payment confirmation and refunds changed what this section says
    // on 2026-08-28. The date is a page literal, so pin it here.
    const text = renderIn(viTranslations);
    expect(text).toContain("28/08/2026");
    expect(text).not.toContain("14/08/2026");
  });

  it("keeps the Shop section above the security section, not appended at the end", () => {
    // Order is meaning here: the data groups belong with what we collect, not
    // after "your rights" where a reader has stopped.
    const text = renderIn(viTranslations);
    expect(text.indexOf(viTranslations.privacy.shop.title)).toBeGreaterThan(
      text.indexOf(viTranslations.privacy.sharing.title),
    );
    expect(text.indexOf(viTranslations.privacy.shop.title)).toBeLessThan(
      text.indexOf(viTranslations.privacy.rights.title),
    );
  });
});

describe.each(LANGUAGES)("Privacy Shop copy in $name says what the implementation does", ({ dict }) => {
  const shop = dict.privacy.shop;
  const all = Object.values(shop.groups).join(" ") + shop.description + shop.purpose + shop.retention;

  it("contains no pilot or test-stage wording", () => {
    expect(all + shop.title).not.toMatch(/thử nghiệm|closed pilot|\bpilot\b|\bMVP\b/i);
  });

  it("never describes internal data as public", () => {
    // The public bullet lists what anybody can see on a shop page. The three
    // fields below are in shop_applications and are visible to the applicant
    // and administrators only — if one of them migrates into this sentence,
    // the policy starts authorising a leak we do not perform.
    const internalOnly = [
      /địa chỉ (lấy|giao) hàng|pickup|delivery address/i,
      /họ tên|full name|recipient name/i,
      /số điện thoại|phone number/i,
      /ghi chú.*quản trị|administrator notes/i,
    ];
    for (const field of internalOnly) {
      expect(shop.groups.public, `public bullet must not name ${field}`).not.toMatch(field);
    }
  });

  it("states pickup and delivery addresses are not shown publicly", () => {
    expect(shop.groups.internal).toMatch(/địa chỉ lấy hàng và giao hàng không hiển thị công khai|pickup and delivery addresses are never shown publicly/i);
  });

  it("states that an account email or phone does not become a public contact channel on its own", () => {
    expect(shop.groups.internal).toMatch(
      /không bao giờ tự động trở thành kênh liên hệ|never becomes a public contact channel/i,
    );
  });

  it("keeps the no-IP, no-fingerprint promise the schema actually enforces", () => {
    // migration 20260814090000 has nowhere to store either, and a test forbids
    // adding one. This is the sentence that promise is written in.
    expect(shop.groups.consent).toMatch(/không kèm địa chỉ IP|no IP address/i);
    expect(shop.groups.consent).toMatch(/dấu vết thiết bị|device fingerprint/i);
  });

  it("says the moderation log records the type of contact channel, not its value", () => {
    expect(shop.groups.moderation).toMatch(
      /không ghi giá trị|never records the value/i,
    );
  });

  it("covers order, payment, refund, and sensitive banking data accurately", () => {
    expect(all).toMatch(/đơn hàng|orders?/i);
    expect(all).toMatch(/thanh toán|payments?/i);
    expect(all).toMatch(/hoàn tiền|refunds?/i);
    expect(shop.description).toMatch(/mật khẩu ngân hàng|online-banking passwords?/i);
    expect(shop.description).toMatch(/dữ liệu thẻ|payment-card data/i);
  });

  it("describes deletion only as far as the foreign keys go", () => {
    // Application + acceptance CASCADE. Orders keep their recipient snapshot
    // but lose the buyer_user_id link. A shop OWNER cannot delete the account.
    expect(shop.retention).toMatch(/xoá cùng tài khoản|deleted with your account/i);
    expect(shop.retention).toMatch(/liên kết tới tài khoản được gỡ|account link is removed/i);
    expect(shop.retention).toMatch(/thông tin giao nhận|delivery details/i);
    expect(shop.retention).toMatch(
      /shop phải được xử lý trước|shop must be dealt with before/i,
    );
  });
});

describe("Vietnamese and English carry the same commitments", () => {
  it("has the identical key shape in both dictionaries", () => {
    const shape = (o: object): string =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(o).map(([k, v]) => [k, typeof v === "object" && v ? shape(v) : "s"]),
        ),
      );
    expect(shape(enTranslations.privacy.shop)).toBe(shape(viTranslations.privacy.shop));
  });

  it("names the same four groups in the same order", () => {
    expect(Object.keys(enTranslations.privacy.shop.groups)).toEqual(
      Object.keys(viTranslations.privacy.shop.groups),
    );
    expect(Object.keys(viTranslations.privacy.shop.groups)).toEqual([
      "public",
      "internal",
      "consent",
      "moderation",
    ]);
  });

  it("does not leave a translation as a copy of the other language", () => {
    // A dictionary that satisfies the type by pasting the Vietnamese into
    // en.ts passes every assertion above. This one it does not.
    for (const key of ["description", "purpose", "retention"] as const) {
      expect(enTranslations.privacy.shop[key]).not.toBe(viTranslations.privacy.shop[key]);
    }
  });
});
