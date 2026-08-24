import { describe, expect, it } from "vitest";
import { renderVenueDetail } from "../venues";
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
      hours_json: { mon: "6:00-22:00", sat: "5h30 - 23h", bogus: "x", sun: "" },
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
