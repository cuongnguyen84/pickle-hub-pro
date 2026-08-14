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
    // The Shop section was added on 2026-08-14. A policy that gains new
    // content while still claiming to be effective from 2024 is a quiet
    // untruth, and the date is a literal in the page rather than a value
    // anything computes — so this is the only thing that pins it.
    const text = renderIn(viTranslations);
    expect(text).toContain("14/08/2026");
    expect(text).not.toContain("28/12/2024");
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

  it("never describes internal data as public", () => {
    // The public bullet lists what anybody can see on a shop page. The three
    // fields below are in shop_applications and are visible to the applicant
    // and administrators only — if one of them migrates into this sentence,
    // the policy starts authorising a leak we do not perform.
    const internalOnly = [
      /địa chỉ lấy hàng|pickup address/i,
      /họ tên|full name/i,
      /số điện thoại|phone number/i,
      /ghi chú.*quản trị|administrator notes/i,
    ];
    for (const field of internalOnly) {
      expect(shop.groups.public, `public bullet must not name ${field}`).not.toMatch(field);
    }
  });

  it("states the pickup address is not shown publicly", () => {
    expect(shop.groups.internal).toMatch(/không hiển thị công khai|never shown publicly/i);
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

  it("never claims ThePickleHub handles money", () => {
    // The closed pilot has no cart, no orders, no payments and no payouts.
    // A privacy policy that implies otherwise creates an expectation the
    // product cannot meet, and it is the kind of sentence that gets added by
    // someone copying wording from a real marketplace.
    const custodyClaims = [
      /giữ tiền|ký quỹ|ví điện tử|thanh toán qua ThePickleHub/i,
      /holds? funds|escrow|process(es|ing)? payments?|handles? payments?/i,
    ];
    for (const claim of custodyClaims) {
      expect(all, `must not claim ${claim}`).not.toMatch(claim);
    }
    // …and it says the opposite explicitly.
    expect(shop.description).toMatch(
      /số tài khoản ngân hàng|bank account numbers?/i,
    );
    expect(shop.description).toMatch(/thông tin chi trả|payout details/i);
  });

  it("describes deletion only as far as the foreign keys go", () => {
    // Application + acceptance CASCADE with the account; moderation history
    // survives with the actor nulled; a shop OWNER cannot delete their account
    // at all (shops.owner_user_id is ON DELETE RESTRICT). Promising a clean
    // "everything is deleted" would be the untrue version of this paragraph.
    expect(shop.retention).toMatch(/xoá cùng tài khoản|deleted with your account/i);
    expect(shop.retention).toMatch(/không còn gắn với tài khoản đã xoá|no longer tied to a deleted account/i);
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
