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

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

/**
 * The description is escaped for HTML in the markup, so `&amp;` costs 5 bytes
 * in the attribute but 1 byte in the string the byte budget applies to.
 * Compare against the unescaped form the budget actually governs.
 */
const unescape = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

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
    expect(desc.startsWith("Đảo Sen Pickleball tại Hà Nội.")).toBe(true);
  });

  it("does not repeat the pickleball keyword when the name already carries it", async () => {
    const desc = unescape(metaDescription(await render(BASE)));

    expect(desc).not.toContain("Sân pickleball Đảo Sen Pickleball");
  });

  it("labels a name that lacks the keyword, in both languages", async () => {
    const row = { ...BASE, name: "Tăng Bạt Hổ" };

    expect(unescape(metaDescription(await render(row)))).toContain(
      "Sân pickleball Tăng Bạt Hổ tại Hà Nội.",
    );
    expect(unescape(metaDescription(await render(row, "en")))).toContain(
      "Tăng Bạt Hổ pickleball court in Hà Nội.",
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
    // The city keyword survives: the lead is elided at a word boundary rather
    // than the whole string being hard-cut mid-word inside "tại Hà Nội".
    expect(desc).toContain("tại Hà Nội.");
    expect(desc).toMatch(/…\s?tại Hà Nội\.$/);
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
