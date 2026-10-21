import { describe, expect, it } from "vitest";
import {
  renderVenueDetail, isVerifiedSource, shortPrice, longPrice,
  priceRangeText, uniformHours, hoursLabel, haversineKm, formatKm,
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
function stubClient(row: Row, pool: unknown[] = []): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    neq: () => chain,
    not: () => chain,
    order: () => chain,
    limit: () => chain,
    maybeSingle: async () => ({ data: row, error: null }),
    then: (resolve: (r: { data: unknown[]; error: null }) => unknown) =>
      resolve({ data: pool, error: null }),
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

const render = async (row: Row, lang: "vi" | "en" = "vi", pool: unknown[] = []) =>
  (await renderVenueDetail(stubClient(row, pool), "s", SITE, lang)).text();

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

/**
 * NEAR-01 (2026-08-24) — the "other courts" block used to be a deterministic
 * city-wide query, so all 136 Hà Nội venue pages shipped the byte-identical
 * list of 8 links (verified in production against three live URLs). That block
 * is ~40% of a venue page's word count, which made most of the /san cluster's
 * "unique" content one boilerplate list repeated hundreds of times.
 *
 * It is now ranked by real distance from the venue being viewed, using the
 * lat/long columns — the only two populated on 760/760 rows.
 */
describe("renderVenueDetail — proximity block (NEAR-01)", () => {
  // BASE sits at 21.02, 105.82. Roughly: 0.01 lat ≈ 1.1 km.
  const POOL = [
    { slug: "xa-nhat", name: "Xa Nhất", name_vi: null, district: "Ba Đình", latitude: 21.12, longitude: 105.82, num_courts: 9 },
    { slug: "gan-nhi", name: "Gần Nhì", name_vi: null, district: "Đống Đa", latitude: 21.03, longitude: 105.82, num_courts: 2 },
    { slug: "gan-nhat", name: "Gần Nhất", name_vi: null, district: "Đống Đa", latitude: 21.021, longitude: 105.82, num_courts: 1 },
    { slug: "cung-quan-xa", name: "Cùng Quận Xa", name_vi: null, district: "Đống Đa", latitude: 21.09, longitude: 105.82, num_courts: 7 },
    // Five more Đống Đa courts, all farther out than the four above, so the
    // nearest-6 cut leaves some over for the district block to pick up. Without
    // a pool bigger than NEAREST_COUNT the dedup would empty that block.
    ...[0, 1, 2, 3, 4].map((i) => ({
      slug: `xa-${i}`,
      name: `Xa ${i}`,
      name_vi: null,
      district: "Đống Đa",
      latitude: 21.3 + i / 100,
      longitude: 105.82,
      num_courts: 5 - i,
    })),
  ];

  const slugsUnder = (html: string, heading: RegExp) => {
    const block = html.match(new RegExp(`<h2>${heading.source}[^<]*</h2><ul>([\\s\\S]*?)</ul>`));
    return block ? [...block[1].matchAll(/\/san\/([a-z0-9-]+)"/g)].map((m) => m[1]) : [];
  };

  it("orders the nearby list by real distance, nearest first", async () => {
    const html = await render(BASE, "vi", POOL);
    const slugs = slugsUnder(html, /Sân pickleball gần/);

    expect(slugs.slice(0, 3)).toEqual(["gan-nhat", "gan-nhi", "cung-quan-xa"]);
    expect(slugs).toContain("xa-nhat");
  });

  it("is genuinely different for two venues in the same city — the NEAR-01 defect", async () => {
    const a = slugsUnder(await render(BASE, "vi", POOL), /Sân pickleball gần/);
    // Same city + same pool, different coordinates: the far corner of Hà Nội.
    const b = slugsUnder(
      await render({ ...BASE, slug: "khac", latitude: 21.13, longitude: 105.82 }, "vi", POOL),
      /Sân pickleball gần/,
    );

    expect(a).not.toEqual(b);
    expect(b[0]).toBe("xa-nhat");
  });

  it("prints a distance next to every nearby court", async () => {
    const html = await render(BASE, "vi", POOL);

    // 0.001 lat ≈ 110 m, rendered in metres under 1 km.
    expect(html).toMatch(/Gần Nhất<\/a> — \d+ m/);
    // 0.01 lat ≈ 1.1 km, rendered in km with a VI comma decimal.
    expect(html).toMatch(/Gần Nhì<\/a> — 1,1 km/);
  });

  it("uses a dot decimal separator in the EN cluster", async () => {
    expect(await render(BASE, "en", POOL)).toMatch(/Gần Nhì<\/a> — 1\.1 km/);
  });

  it("adds a district block and never repeats a slug already shown as nearby", async () => {
    const html = await render(BASE, "vi", POOL);
    const near = slugsUnder(html, /Sân pickleball gần/);
    const district = slugsUnder(html, /Sân pickleball khác ở/);

    expect(html).toContain("Sân pickleball khác ở Đống Đa");
    for (const slug of district) expect(near).not.toContain(slug);
  });

  it("drops zero-distance rows — duplicate coordinates read as a data bug", async () => {
    const html = await render(BASE, "vi", [
      { slug: "trung-toa-do", name: "Trùng Toạ Độ", name_vi: null, district: "Đống Đa", latitude: 21.02, longitude: 105.82, num_courts: 3 },
      ...POOL,
    ]);

    expect(slugsUnder(html, /Sân pickleball gần/)).not.toContain("trung-toa-do");
  });

  it("omits the proximity block rather than guessing when the venue has no coordinates", async () => {
    const html = await render({ ...BASE, latitude: null, longitude: null }, "vi", POOL);

    expect(html).not.toContain("Sân pickleball gần");
    // The district block does not depend on geo, so it still renders.
    expect(html).toContain("Sân pickleball khác ở Đống Đa");
  });

  it("survives an empty city pool without emitting an empty list", async () => {
    const html = await render(BASE, "vi", []);

    expect(html).not.toContain("<ul></ul>");
    expect(html).not.toContain("Sân pickleball gần");
  });
});

describe("haversineKm / formatKm", () => {
  it("matches a known Hà Nội → TP.HCM great-circle distance", () => {
    // ~1138 km by great circle; allow 15 km for the spherical approximation.
    expect(haversineKm(21.028, 105.854, 10.823, 106.63)).toBeGreaterThan(1123);
    expect(haversineKm(21.028, 105.854, 10.823, 106.63)).toBeLessThan(1153);
  });

  it("is zero for identical points and symmetric between two points", () => {
    expect(haversineKm(21.02, 105.82, 21.02, 105.82)).toBe(0);
    expect(haversineKm(21.02, 105.82, 21.03, 105.83)).toBeCloseTo(
      haversineKm(21.03, 105.83, 21.02, 105.82),
      9,
    );
  });

  it("switches from metres to km at 1 km, localizing the decimal separator", () => {
    expect(formatKm(0.45, "vi")).toBe("450 m");
    expect(formatKm(1.25, "vi")).toBe("1,3 km");
    expect(formatKm(1.25, "en")).toBe("1.3 km");
  });
});

/**
 * GEO-01 (2026-08-24) — the venue opening broke two rules from CLAUDE.md's GEO
 * section on all 896 pages: it never named ThePickleHub, and it ENDED by
 * pointing further down the page ("Xem địa chỉ, bản đồ, chỉ đường … bên dưới")
 * instead of answering. CLAUDE.md is explicit that a passage which promises the
 * answer loses to one that contains it.
 *
 * The rule had only ever been applied to blog posts. These tests hold it on the
 * route that carries 68% of site impressions.
 */
describe("renderVenueDetail — GEO opening (GEO-01)", () => {
  // Loop to a fixpoint rather than strip once: `<<b>b>` survives a single pass
  // and reassembles into a tag. Harmless in a test helper, but CodeQL's
  // js/incomplete-multi-character-sanitization cannot tell test code from the
  // real sanitizer and failed the security gate on every PR — the same shape
  // functions/_lib/utils.ts:238 already uses.
  const stripTags = (text: string) => {
    let out = text;
    let prev: string;
    do {
      prev = out;
      out = out.replace(/<[^>]+>/g, "");
    } while (out !== prev);
    return out;
  };

  const opening = (html: string) => {
    const ps = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1]).trim());
    return unescape(ps.find((p) => p.length > 40) ?? "");
  };

  const PRICED = {
    ...BASE,
    price_min_vnd: 100000,
    price_max_vnd: 160000,
    price_source: "partner",
    hours_json: Object.fromEntries(
      ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, "05:00-22:00"]),
    ),
    hours_source: "partner",
  };

  it("names ThePickleHub once, so an AI answer can attribute the passage", async () => {
    const p = opening(await render(BASE));

    expect(p).toContain("ThePickleHub");
    expect(p.match(/ThePickleHub/g)).toHaveLength(1);
    // The spaced variant dilutes the entity and is alternateName-only.
    expect(p).not.toContain("The Pickle Hub");
  });

  it("no longer ends by pointing at content further down the page", async () => {
    const p = opening(await render(BASE));

    expect(p).not.toContain("bên dưới");
    expect(p).not.toContain("Xem địa chỉ, bản đồ");
  });

  it("front-loads the facts the row actually holds", async () => {
    const p = opening(await render(PRICED));

    expect(p).toContain("4 sân");
    expect(p).toContain("ngoài trời");
    expect(p).toContain("Đống Đa, Hà Nội");
    expect(p).toContain("Giá thuê 100.000đ–160.000đ/giờ.");
    expect(p).toContain("Mở cửa 05:00-22:00.");
    expect(p).toContain("0825 815 815");
  });

  it("keeps an unverified price out of the opening", async () => {
    const p = opening(
      await render({
        ...PRICED,
        price_min_vnd: 80000,
        price_max_vnd: 200000,
        price_source: "default",
        hours_source: "default",
      }),
    );

    expect(p).not.toContain("Giá thuê");
    expect(p).not.toContain("80.000đ");
    expect(p).not.toContain("Mở cửa");
  });

  it("degrades to name plus location on a bare row rather than padding", async () => {
    const p = opening(
      await render({
        ...BASE,
        num_courts: null,
        is_indoor: null,
        surface_type: null,
        phone: null,
        address: null,
      }),
    );

    expect(p).toContain("Đảo Sen Pickleball là sân pickleball ở Đống Đa, Hà Nội, có trên ThePickleHub.");
    expect(p).not.toMatch(/\.\s*\./);
    expect(p).not.toContain("undefined");
    expect(p).not.toContain("null");
  });

  it("says the same thing in English", async () => {
    const p = opening(await render(PRICED, "en"));

    expect(p).toContain("listed on ThePickleHub");
    expect(p).toContain("Courts rent for 100.000đ–160.000đ per hour.");
    expect(p).not.toContain("below.");
  });
});
