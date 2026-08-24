import { describe, expect, it } from "vitest";
import {
  renderVenueDetail, isVerifiedSource, shortPrice, longPrice,
  priceRangeText, uniformHours, hoursLabel,
} from "../venues";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

type Row = Record<string, unknown> | null;

/**
 * Minimal Supabase stub. renderVenueDetail makes two calls:
 *   1. from("venues").select().eq().maybeSingle()  → the venue itself
 *   2. from("venues").select()...                  → nearby venues (awaited
 *      directly, so the chain must be thenable and resolve to a list)
 */
function stubClient(row: Row): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
    then: (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: [], error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

const BASE = {
  slug: "dao-sen-pickleball-ha-noi",
  name: "Đảo Sen Pickleball",
  name_vi: null,
  address: "Số 1 Đường Hoàng Cầu",
  district: "Đống Đa",
  city: "Hà Nội",
  country: "VN",
  latitude: 21.02,
  longitude: 105.82,
  num_courts: 4,
  surface_type: null,
  is_indoor: false,
  phone: "0825 815 815",
  website: null,
  amenities: null,
  hours_json: null,
  cover_image_url: null,
  price_min_vnd: null,
  price_max_vnd: null,
  price_source: null,
  hours_source: null,
};

const render = async (row: Row, lang: "vi" | "en" = "vi") =>
  (await renderVenueDetail(stubClient(row), "s", SITE, lang)).text();

const metaDescription = (html: string) =>
  html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";

const titleTag = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * The description is escaped for HTML in the markup, so `&amp;` costs 5 bytes
 * in the attribute but 1 byte in the string the byte budget applies to.
 * Compare against the unescaped form the budget actually governs.
 */
// `&amp;` is unescaped LAST. Doing it first turns "&amp;#39;" into "&#39;",
// which the next replace then unescapes again — one round-trip too many, and
// what CodeQL's js/double-escaping rule is pointing at.
const unescape = (s: string) =>
  s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

describe("renderVenueDetail — meta description budget (CTR-01)", () => {
  it("never ships a mid-word truncated snippet for a long Vietnamese venue", async () => {
    // Regression: the old fixed template appended a ~95-byte generic tail, so
    // 78% of venue rows blew the 160-byte budget and pickMetaDescription cut
    // them mid-word — production served snippets ending "…ở Hà…".
    const html = await render({
      ...BASE,
      name: "Sân Pickleball Trung tâm Văn hoá Thể thao Cầu Giấy",
      city: "Hà Nội",
    });
    const desc = unescape(metaDescription(html));

    expect(desc).not.toMatch(/\.\.\.$/);
    expect(utf8Bytes(desc)).toBeLessThanOrEqual(160);
  });

  it("front-loads the booking phone number ahead of the generic tail", async () => {
    const desc = unescape(metaDescription(await render(BASE)));

    expect(desc).toContain("Đặt sân: 0825 815 815.");
    expect(desc.indexOf("Đặt sân")).toBeLessThan(desc.indexOf("Địa chỉ"));
  });

  it("keeps the city keyword — the segment the old byte cut always ate", async () => {
    const desc = unescape(metaDescription(await render(BASE)));

    expect(desc).toContain("Hà Nội");
    // CTR-02: the tail now leads with the district, which is what venue
    // searchers actually type ("sân pickleball quận 2"). The city keyword
    // still survives immediately after it.
    expect(desc.startsWith("Đảo Sen Pickleball tại Đống Đa, Hà Nội.")).toBe(true);
  });

  it("does not repeat the pickleball keyword when the name already carries it", async () => {
    const desc = unescape(metaDescription(await render(BASE)));

    expect(desc).not.toContain("Sân pickleball Đảo Sen Pickleball");
  });

  it("labels a name that lacks the keyword, in both languages", async () => {
    const row = { ...BASE, name: "Tăng Bạt Hổ" };

    expect(unescape(metaDescription(await render(row)))).toContain(
      "Sân pickleball Tăng Bạt Hổ tại Đống Đa, Hà Nội.",
    );
    expect(unescape(metaDescription(await render(row, "en")))).toContain(
      "Tăng Bạt Hổ pickleball court in Đống Đa, Hà Nội.",
    );
  });

  it("drops boilerplate rather than facts when the name is pathologically long", async () => {
    const html = await render({
      ...BASE,
      name: "Sân Pickleball " + "Rất Dài ".repeat(12).trim(),
    });
    const desc = unescape(metaDescription(html));

    expect(utf8Bytes(desc)).toBeLessThanOrEqual(160);
    expect(desc).not.toMatch(/\.\.\.$/);
    // The generic tail is the first thing sacrificed, not the venue name.
    expect(desc).toContain("Sân Pickleball Rất Dài");
    expect(desc).not.toContain("trên ThePickleHub");
    // The location keywords survive: the lead is elided at a word boundary
    // rather than the whole string being hard-cut mid-word inside the tail.
    expect(desc).toContain("tại Đống Đa, Hà Nội.");
    expect(desc).toMatch(/…\s?tại Đống Đa, Hà Nội\.$/);
  });

  // ── CTR-02: district in title + snippet ────────────────────────────────
  it("leads the title with the district, then the city", async () => {
    const title = titleTag(await render(BASE));

    expect(title).toContain("Đảo Sen Pickleball – Đống Đa, Hà Nội");
  });

  it("falls back to the district alone when the full pair blows the 60-byte title budget", async () => {
    // 38-byte name: " – Đống Đa" lands it at 54 bytes (fits), while
    // " – Đống Đa, Hà Nội" would be 65 (over). District beats city because it
    // is the segment that actually narrows a 136-venue city.
    const title = titleTag(
      await render({ ...BASE, name: "Sân Pickleball Khu Đô Thị Ciputra" }),
    );

    expect(utf8Bytes(unescape(title))).toBeLessThanOrEqual(60);
    expect(title).toContain("Đống Đa");
    expect(title).not.toContain("Đống Đa, Hà Nội");
  });

  it("never ellipsises the title — it degrades to a shorter variant instead", async () => {
    const title = unescape(titleTag(await render({ ...BASE, name: "Sân Pickleball " + "Rất Dài ".repeat(4).trim() })));

    expect(utf8Bytes(title)).toBeLessThanOrEqual(60);
    expect(title).not.toContain("…");
  });

  it("omits the district when the venue name already carries it", async () => {
    const title = titleTag(await render({ ...BASE, name: "Pickleball Đống Đa" }));

    expect(title).not.toContain("Đống Đa, Hà Nội");
    expect(title).not.toContain("– Đống Đa");
  });

  it("still renders city-only for the 70 rows with no district", async () => {
    const row = { ...BASE, district: null };

    expect(titleTag(await render(row))).toContain("Đảo Sen Pickleball – Hà Nội");
    expect(unescape(metaDescription(await render(row)))).toContain(
      "Đảo Sen Pickleball tại Hà Nội.",
    );
  });

  it("omits absent facts instead of emitting empty punctuation", async () => {
    const desc = unescape(
      metaDescription(
        await render({ ...BASE, num_courts: null, is_indoor: null, phone: null }),
      ),
    );

    expect(desc).not.toMatch(/\.\s*\./);
    expect(desc).not.toContain("Đặt sân");
    expect(utf8Bytes(desc)).toBeLessThanOrEqual(160);
  });

  it("stays within budget in English too", async () => {
    const desc = unescape(metaDescription(await render(BASE, "en")));

    expect(utf8Bytes(desc)).toBeLessThanOrEqual(160);
    expect(desc).toContain("Booking: 0825 815 815.");
    expect(desc).not.toMatch(/\.\.\.$/);
  });
});

/**
 * SEO-GUARD-01 (2026-08-19) — venue JSON-LD carried only name/address/geo/
 * phone, so two courts in the same district looked near-identical to a parser
 * even though we hold court count and indoor/outdoor for them.
 *
 * Deliberately NOT covered here: the meta description. Commit 88520b58 (18/8)
 * rebuilt it and the GSC read that would measure it only runs to 16/8 — the
 * description is left untouched so that experiment stays clean.
 */
describe("renderVenueDetail — amenityFeature + openingHoursSpecification", () => {
  const jsonLd = (html: string) => {
    const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(block, "no JSON-LD emitted").toBeTruthy();
    return JSON.parse(block![1]) as Record<string, unknown>;
  };
  const features = (html: string) =>
    (jsonLd(html).amenityFeature ?? []) as { name: string; value: unknown }[];

  it("exposes court count and indoor/outdoor as structured features", async () => {
    const f = features(await render(BASE));
    expect(f.find((x) => x.name === "Sân ngoài trời")?.value).toBe(true);
    expect(f.find((x) => x.name === "Số sân pickleball")?.value).toBe(4);
  });

  it("localizes the feature names for the EN cluster", async () => {
    const f = features(await render(BASE, "en"));
    expect(f.map((x) => x.name)).toContain("Outdoor courts");
    expect(f.map((x) => x.name)).toContain("Number of pickleball courts");
  });

  it("omits amenityFeature rather than emitting empty facts", async () => {
    // num_courts is null on 61% of rows and surface_type on 99% — the absent
    // case is the common one, so it must not produce a stub node.
    const f = features(await render({ ...BASE, num_courts: null, is_indoor: null }));
    expect(f).toHaveLength(0);
    expect(await render({ ...BASE, num_courts: null, is_indoor: null })).not.toContain(
      "amenityFeature",
    );
  });

  it("adds free-form amenities when the column is eventually populated", async () => {
    const f = features(await render({ ...BASE, amenities: ["Bãi đỗ xe", "Đèn ban đêm"] }));
    expect(f.map((x) => x.name)).toEqual(
      expect.arrayContaining(["Bãi đỗ xe", "Đèn ban đêm"]),
    );
  });

  it("builds openingHoursSpecification from the per-day object form", async () => {
    const html = await render({
      ...BASE,
      // PRICE-01: hours schema is now gated on a verified hours_source, so a
      // fixture that only sets hours_json emits nothing. That gate is the point
      // — the blanket 06:00-24:00 on 741 rows must not become structured data.
      hours_json: { mon: "6:00-22:00", sat: "5h30 - 23h", bogus: "x", sun: "" },
      hours_source: "partner",
    });
    const spec = jsonLd(html).openingHoursSpecification as Record<string, unknown>[];

    expect(spec).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Monday", opens: "06:00", closes: "22:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "https://schema.org/Saturday", opens: "05:30", closes: "23:00" },
    ]);
  });

  it("emits no hours schema for the free-text form it cannot parse per day", async () => {
    // "6h-22h hằng ngày" has no day breakdown; schema.org needs dayOfWeek +
    // opens + closes, and guessing them would be invented data. The visible
    // body line still renders.
    const html = await render({ ...BASE, hours_json: ["6h-22h hằng ngày"] });
    expect(html).not.toContain("openingHoursSpecification");
    expect(html).toContain("6h-22h hằng ngày");
  });

  it("keeps the existing hreflang triple and SportsActivityLocation type", async () => {
    const html = await render(BASE);
    expect(jsonLd(html)["@type"]).toBe("SportsActivityLocation");
    expect(html).toContain('hreflang="en"');
    expect(html).toContain('hreflang="vi"');
    expect(html).toContain('hreflang="x-default"');
  });
});


/**
 * PRICE-01 (2026-08-24) — venues now carry a price range and opening hours, and
 * `price_source`/`hours_source` say where each came from.
 *
 * 108 of 850 rows hold a real figure imported from a booking source. The other
 * 741 carry a blanket 80.000–200.000 đ / 06:00–24:00 that is identical across
 * all of them, so it is not a fact about any one venue. These tests pin the
 * line between the two: a verified figure may be asserted anywhere, a default
 * may appear only as visible, labelled body copy.
 */
const WEEK = (range) =>
  Object.fromEntries(["mon","tue","wed","thu","fri","sat","sun"].map((d) => [d, range]));

const PARTNER = {
  ...BASE,
  price_min_vnd: 100000,
  price_max_vnd: 160000,
  price_source: "partner",
  hours_json: WEEK("05:00-22:00"),
  hours_source: "partner",
};
const DEFAULTED = {
  ...BASE,
  price_min_vnd: 80000,
  price_max_vnd: 200000,
  price_source: "default",
  hours_json: WEEK("06:00-24:00"),
  hours_source: "default",
};

const jsonLdOf = (html: string) => {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : {};
};

describe("renderVenueDetail — verified price reaches every surface", () => {
  it("puts the price in the title, after the location", async () => {
    const title = titleTag(await render(PARTNER));

    expect(title).toContain("100K–160K");
    expect(utf8Bytes(unescape(title))).toBeLessThanOrEqual(60);
  });

  it("front-loads the price in the snippet, ahead of court count and phone", async () => {
    const desc = unescape(metaDescription(await render(PARTNER)));

    expect(desc).toContain("Giá 100.000đ–160.000đ/giờ.");
    expect(desc.indexOf("Giá")).toBeLessThan(desc.indexOf("Đặt sân"));
    expect(utf8Bytes(desc)).toBeLessThanOrEqual(160);
  });

  it("emits priceRange and openingHoursSpecification in JSON-LD", async () => {
    const ld = jsonLdOf(await render(PARTNER));

    expect(ld.priceRange).toBe("100.000đ–160.000đ");
    expect(Array.isArray(ld.openingHoursSpecification)).toBe(true);
    expect(ld.openingHoursSpecification).toHaveLength(7);
    expect(ld.openingHoursSpecification[0].opens).toBe("05:00");
  });

  it("states the price plainly in the body", async () => {
    const html = await render(PARTNER);

    expect(html).toContain("Giá thuê");
    expect(html).toContain("100.000đ–160.000đ/giờ");
  });

  it("collapses a uniform week to one line instead of seven identical rows", async () => {
    const html = await render(PARTNER);

    expect(html).toContain("05:00-22:00");
    expect(html).not.toContain("Thứ 2: 05:00-22:00");
  });
});

describe("renderVenueDetail — a default price is never asserted as fact", () => {
  it("keeps the default out of the title", async () => {
    const title = titleTag(await render(DEFAULTED));

    expect(title).not.toContain("80K");
    expect(title).not.toContain("200K");
  });

  it("keeps the default out of the meta description", async () => {
    const desc = unescape(metaDescription(await render(DEFAULTED)));

    expect(desc).not.toContain("80.000đ");
    expect(desc).not.toContain("Giá ");
  });

  it("keeps the default out of JSON-LD — the worst place for an unchecked number", async () => {
    const ld = jsonLdOf(await render(DEFAULTED));

    expect(ld.priceRange).toBeUndefined();
    expect(ld.openingHoursSpecification).toBeUndefined();
  });

  it("shows it in the body as a regional guide, explicitly not this venue's rate", async () => {
    const html = await render(DEFAULTED);

    expect(html).toContain("Chưa có bảng giá riêng của sân này");
    expect(html).toContain("80.000đ–200.000đ");
    expect(html).toContain("gọi sân để hỏi giá chính xác");
    // Never under the "Giá thuê" label, which reads as a quote for this court.
    expect(html).not.toContain("<strong>Giá thuê:</strong>");
  });

  it("says the same thing in English", async () => {
    const html = await render(DEFAULTED, "en");

    expect(html).toContain("No confirmed rate for this court yet");
    expect(html).toContain("call ahead for the exact price");
  });

  it("omits the hours row rather than showing an unverified 06:00-24:00", async () => {
    const html = await render(DEFAULTED);

    expect(html).not.toContain("<strong>Giờ mở cửa:</strong>");
  });
});

describe("price + hours helpers", () => {
  it("treats only partner and manual as verified", () => {
    expect(isVerifiedSource("partner")).toBe(true);
    expect(isVerifiedSource("manual")).toBe(true);
    expect(isVerifiedSource("default")).toBe(false);
    expect(isVerifiedSource(null)).toBe(false);
  });

  it("formats prices short for titles and long for prose", () => {
    expect(shortPrice(100000)).toBe("100K");
    expect(longPrice(100000)).toBe("100.000đ");
    expect(longPrice(1250000)).toBe("1.250.000đ");
  });

  it("collapses an equal min and max to a single figure", () => {
    expect(priceRangeText(100000, 100000, "long")).toBe("100.000đ");
    expect(priceRangeText(100000, 160000, "short")).toBe("100K–160K");
    expect(priceRangeText(null, 160000, "long")).toBeNull();
  });

  it("returns a week range only when all seven days agree", () => {
    expect(uniformHours(WEEK("06:00-22:00"))).toBe("06:00-22:00");
    expect(uniformHours({ ...WEEK("06:00-22:00"), sun: "08:00-20:00" })).toBeNull();
    expect(uniformHours({ mon: "06:00-22:00" })).toBeNull();
    expect(uniformHours(null)).toBeNull();
  });

  it("renders a full day as words, not as a clock range", () => {
    expect(hoursLabel("00:00-24:00", "vi")).toBe("Mở cả ngày");
    expect(hoursLabel("00:00-24:00", "en")).toBe("Open 24 hours");
    expect(hoursLabel("06:00-22:00", "vi")).toBe("06:00-22:00");
  });
});
