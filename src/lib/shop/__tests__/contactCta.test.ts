// The only place ThePickleHub hands a buyer to an outside app. Every one of
// these is a way that could go wrong in someone's browser.

import { describe, expect, it } from "vitest";
import {
  NO_CONTACT_COPY,
  contactAnalyticsPayload,
  contactHref,
  usableContacts,
  type PublicContact,
} from "../contactCta";

const c = (type: PublicContact["type"], href: string): PublicContact =>
  ({ id: `${type}-1`, type, href, label: null });

describe("contactHref", () => {
  it("builds tel: from an E.164 number", () => {
    expect(contactHref(c("phone", "+84912345678"))).toBe("tel:+84912345678");
  });

  it("refuses a phone value that is not E.164", () => {
    // The server normalises to E.164. Anything else did not come from there.
    for (const bad of ["0912345678", "+84 912 345 678", "tel:+84912345678", "javascript:alert(1)"]) {
      expect(contactHref(c("phone", bad)), bad).toBeNull();
    }
  });

  it("accepts only the exact hosts each channel normalises to", () => {
    expect(contactHref(c("zalo", "https://zalo.me/912345678"))).toBe("https://zalo.me/912345678");
    expect(contactHref(c("messenger", "https://m.me/shopa"))).toBe("https://m.me/shopa");
    // Right shape, wrong host — a lookalike domain is the whole attack.
    expect(contactHref(c("zalo", "https://zalo.me.evil.example/x"))).toBeNull();
    expect(contactHref(c("messenger", "https://facebook.com/shopa"))).toBeNull();
  });

  it("refuses every scheme but https, whatever slipped into the row", () => {
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<script>x</script>",
      "file:///etc/passwd",
      "blob:https://zalo.me/abc",
      "http://zalo.me/912345678",
    ]) {
      expect(contactHref(c("zalo", bad)), bad).toBeNull();
    }
  });

  it("strips query and fragment", () => {
    // That is where a buyer's identity, or the product they were looking at,
    // would end up. D2 forbids both.
    expect(contactHref(c("zalo", "https://zalo.me/912345678?from=buyer&pid=abc#x")))
      .toBe("https://zalo.me/912345678");
  });

  it("refuses an empty or malformed value instead of rendering a dead link", () => {
    expect(contactHref(c("zalo", ""))).toBeNull();
    expect(contactHref(c("zalo", "not a url"))).toBeNull();
  });
});

describe("usableContacts", () => {
  it("drops anything that would not produce a safe link", () => {
    const list = [c("zalo", "javascript:alert(1)"), c("phone", "+84912345678")];
    expect(usableContacts(list).map((x) => x.type)).toEqual(["phone"]);
  });

  it("is stable and handles no contacts at all", () => {
    const list = [c("phone", "+84912345678"), c("messenger", "https://m.me/a"), c("zalo", "https://zalo.me/b")];
    expect(usableContacts(list).map((x) => x.type)).toEqual(["zalo", "messenger", "phone"]);
    expect(usableContacts(undefined)).toEqual([]);
  });
});

describe("analytics", () => {
  it("records the channel TYPE and public ids — never the destination", () => {
    const payload = contactAnalyticsPayload(c("zalo", "https://zalo.me/912345678"), "p-1", "shop-a");
    expect(payload).toEqual({ channel_type: "zalo", product_id: "p-1", shop_slug: "shop-a" });
    // A funnel is not worth a seller's number sitting in an analytics store.
    expect(JSON.stringify(payload)).not.toMatch(/912345678|zalo\.me/);
  });
});

describe("no approved channel", () => {
  it("says so, and does not imply a button is coming back", () => {
    expect(NO_CONTACT_COPY).toMatch(/chưa cung cấp/);
    expect(NO_CONTACT_COPY).not.toMatch(/giỏ|đặt hàng|thanh toán/i);
  });
});
