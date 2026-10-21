import { describe, expect, it } from "vitest";
import { renderClubList } from "../social-list";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

const CLUBS = [
  { id: "1", slug: "thanh-dong", name: "Thành Đồng Pickleball", location_text: "175 Định Công, Hà Nội", logo_url: null, upcoming_events: 2 },
  { id: "2", slug: "tinhgiomay", name: "Tinhgiomay", location_text: "Tân Phú, Saigon", logo_url: null, upcoming_events: 0 },
];

/** Minimal Supabase stub — only the chain renderClubList actually walks. */
function stubClient(rows: typeof CLUBS | null): SupabaseClient {
  const result = Promise.resolve(rows ? { data: rows, error: null } : { data: null, error: new Error("view gone") });
  const chain = {
    select: () => chain,
    order: () => chain,
    limit: () => result,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

async function render(lang: "en" | "vi", rows: typeof CLUBS | null = CLUBS) {
  return await (await renderClubList(stubClient(rows), SITE, lang)).text();
}

describe("renderClubList — bilingual pair", () => {
  it("self-references the EN canonical on /clubs", async () => {
    const html = await render("en");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/clubs"/>`);
  });

  it("self-references the VI canonical on /vi/clubs instead of collapsing to /clubs", async () => {
    const html = await render("vi");
    // The regression this guards: /vi/clubs used to canonicalise to /clubs,
    // which threw the whole Vietnamese page away.
    expect(html).toContain(`<link rel="canonical" href="${SITE}/vi/clubs"/>`);
    expect(html).not.toContain(`<link rel="canonical" href="${SITE}/clubs"/>`);
  });

  it("emits hreflang pointing at two DISTINCT urls in both locales", async () => {
    for (const lang of ["en", "vi"] as const) {
      const html = await render(lang);
      expect(html).toContain(`hreflang="en" href="${SITE}/clubs"`);
      expect(html).toContain(`hreflang="vi" href="${SITE}/vi/clubs"`);
      expect(html).toContain(`hreflang="x-default" href="${SITE}/clubs"`);
    }
  });

  it("declares the matching html lang for each locale", async () => {
    expect(await render("en")).toContain('<html lang="en"');
    expect(await render("vi")).toContain('<html lang="vi"');
  });

  it("links each locale to its counterpart so the pair is crawlable", async () => {
    expect(await render("en")).toContain(`href="${SITE}/vi/clubs" hreflang="vi"`);
    expect(await render("vi")).toContain(`href="${SITE}/clubs" hreflang="en"`);
  });
});

describe("renderClubList — body", () => {
  it("names ThePickleHub once in the lead with the club count (GEO attribution)", async () => {
    const en = await render("en");
    const lead = en.slice(en.indexOf("<h1>"), en.indexOf("<section>"));

    expect(lead).toContain("ThePickleHub");
    expect(lead).toContain("2 pickleball clubs");
    expect(lead.match(/ThePickleHub/g)).toHaveLength(1);
  });

  it("writes the Vietnamese lead for the VI locale", async () => {
    const vi = await render("vi");
    expect(vi).toContain("2 câu lạc bộ pickleball");
    expect(vi).not.toContain("2 pickleball clubs");
  });

  it("emits exactly one h1, using the clean heading rather than the decorated title", async () => {
    for (const lang of ["en", "vi"] as const) {
      const html = await render(lang);
      expect(html.match(/<h1>/g)).toHaveLength(1);
      expect(html).not.toContain("<h1>Vietnam Pickleball Clubs | ThePickleHub</h1>");
    }
  });

  it("shows upcoming-session counts only for clubs that have them", async () => {
    const en = await render("en");
    expect(en).toContain("2 upcoming sessions");
    // The zero-session club must not render "0 upcoming sessions".
    expect(en).not.toContain("0 upcoming");
  });

  it("pluralises a single upcoming session", async () => {
    const one = [{ ...CLUBS[0], upcoming_events: 1 }];
    expect(await render("en", one)).toContain("1 upcoming session");
    expect(await render("en", one)).not.toContain("1 upcoming sessions");
  });

  it("degrades to an empty-state lead without inventing a count", async () => {
    const en = await render("en", []);
    expect(en).toContain("No clubs yet.");
    expect(en).toContain("ThePickleHub");
    expect(en).not.toContain("0 pickleball clubs");
  });

  it("still renders a valid bilingual page when the club_listing view is unreachable", async () => {
    // Fallback path: the base clubs table has no upcoming_events column.
    const html = await render("vi", null);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/vi/clubs"/>`);
    expect(html).toContain("ThePickleHub");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
  });
});
