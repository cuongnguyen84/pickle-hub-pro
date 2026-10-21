import { describe, expect, it } from "vitest";
import { renderClub } from "../social-event";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

const CLUB = {
  id: "c1",
  slug: "marites-pickle-club",
  name: "Marites Pickle Club",
  description: "CLB pickleball sinh hoạt hằng tuần tại Tân Phú.",
  location_text: "Tân Phú, TP.HCM",
  logo_url: "https://cdn.example.com/marites.png",
};

const EVENTS = [
  { slug: "giao-luu-thu-7", title_vi: "Giao lưu thứ 7", start_at: "2026-09-05T01:00:00Z", end_at: "2026-09-05T04:00:00Z", status: "published", visibility: "public" },
];

/** Stubs the two chains renderClub walks: clubs.maybeSingle, then events.limit. */
function stubClient(events: typeof EVENTS) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    maybeSingle: () => Promise.resolve({ data: CLUB, error: null }),
    limit: () => Promise.resolve({ data: events, error: null }),
  });
  return { from: () => chain } as unknown as SupabaseClient;
}

async function render(events = EVENTS) {
  return await (await renderClub(stubClient(events), CLUB.slug, SITE)).text();
}

function jsonLd(html: string) {
  const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return m ? JSON.parse(m[1]) : null;
}

describe("renderClub structured data", () => {
  it("describes the club itself even when it has no upcoming events", async () => {
    // The regression: jsonLd was the upcoming-events ItemList, which is
    // undefined with no future event — so a quiet club shipped a page with NO
    // structured data and the organisation was never stated to a crawler.
    const html = await render([]);
    const ld = jsonLd(html);
    expect(ld).not.toBeNull();
    const org = ld["@graph"].find((n: { "@type": string }) => n["@type"] === "SportsOrganization");
    expect(org).toBeDefined();
    expect(org.name).toBe(CLUB.name);
    expect(org.url).toBe(`${SITE}/clb/${CLUB.slug}`);
    expect(org.sport).toBe("Pickleball");
    expect(org.address.addressLocality).toBe(CLUB.location_text);
    expect(org.logo).toBe(CLUB.logo_url);
  });

  it("adds the event ItemList alongside the organisation when events exist", async () => {
    const ld = jsonLd(await render());
    const types = ld["@graph"].map((n: { "@type": string }) => n["@type"]).sort();
    expect(types).toEqual(["ItemList", "SportsOrganization"]);
  });

  it("renders exactly one h1", async () => {
    expect((await render()).match(/<h1[\s>]/g) ?? []).toHaveLength(1);
  });

  it("emits no hreflang — /clb/{slug} is deliberately single-canonical", async () => {
    // Same-URL hreflang was stripped from /social and /clubs by the
    // 2026-05-18 Ahrefs fix as an invalid signal. Do not reintroduce it here
    // without first splitting the canonical into a real bilingual pair.
    expect(await render()).not.toContain("hreflang=");
  });
});
