import { describe, it, expect } from "vitest";
import {
  buildPersonJsonLd,
  buildProfileFallbackDescription,
  buildFeedJsonLd,
  feedTeamLabel,
  feedScoreCompact,
  type ProfileForSeo,
  type FeedRowForSeo,
  type FeedSeoParticipant,
} from "../../../../functions/_lib/seo-helpers";

/**
 * Pure helper tests for the Sprint 4 Phase 4D prerender additions.
 *
 * The render functions in functions/_lib/render/index.ts are integration
 * code (Supabase + HTML stitching). The shape of the JSON-LD they emit
 * lives in functions/_lib/seo-helpers.ts so the edge cases can be pinned
 * here without standing up a Cloudflare Pages Functions runtime — same
 * pattern as the comment-helpers / kudos-cache tests.
 */

const baseProfile: ProfileForSeo = {
  username: "tran-thi-b",
  display_name: "Trần Thị B",
  avatar_url: null,
  bio: null,
  city: null,
  country: null,
  dupr_singles: null,
  dupr_doubles: null,
};

const SITE = "https://www.thepicklehub.net";
const URL_TTB = `${SITE}/nguoi-choi/tran-thi-b`;

describe("buildPersonJsonLd", () => {
  it("emits a minimal Person with required schema.org bones", () => {
    const out = buildPersonJsonLd({
      profile: baseProfile,
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("Person");
    expect(out.name).toBe("Trần Thị B");
    expect(out.alternateName).toBe("@tran-thi-b");
    expect(out.url).toBe(URL_TTB);
    expect(out.knowsAbout).toEqual(["Pickleball"]);
    expect(out.memberOf).toEqual({
      "@type": "SportsOrganization",
      name: "ThePickleHub",
      url: SITE,
    });
  });

  it("falls back to username when display_name is null", () => {
    const out = buildPersonJsonLd({
      profile: { ...baseProfile, display_name: null },
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out.name).toBe("tran-thi-b");
  });

  it("omits image / address / additionalProperty when source fields are null", () => {
    const out = buildPersonJsonLd({
      profile: baseProfile,
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out.image).toBeUndefined();
    expect(out.address).toBeUndefined();
    expect(out.additionalProperty).toBeUndefined();
    expect(out.description).toBeUndefined();
  });

  it("includes both DUPR ratings when both present", () => {
    const out = buildPersonJsonLd({
      profile: { ...baseProfile, dupr_singles: 4.21, dupr_doubles: 4.55 },
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out.additionalProperty).toEqual([
      { "@type": "PropertyValue", name: "DUPR Doubles Rating", value: 4.55 },
      { "@type": "PropertyValue", name: "DUPR Singles Rating", value: 4.21 },
    ]);
  });

  it("includes only doubles DUPR when singles is null", () => {
    const out = buildPersonJsonLd({
      profile: { ...baseProfile, dupr_doubles: 4.0 },
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out.additionalProperty).toEqual([
      { "@type": "PropertyValue", name: "DUPR Doubles Rating", value: 4.0 },
    ]);
  });

  it("emits address with country defaulting to VN when null", () => {
    const out = buildPersonJsonLd({
      profile: { ...baseProfile, city: "Đà Nẵng" },
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out.address).toEqual({
      "@type": "PostalAddress",
      addressLocality: "Đà Nẵng",
      addressCountry: "VN",
    });
  });

  it("preserves explicit country when provided", () => {
    const out = buildPersonJsonLd({
      profile: { ...baseProfile, city: "Hanoi", country: "VN" },
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect((out.address as { addressCountry?: string }).addressCountry).toBe("VN");
  });

  it("forwards an absolute image URL when provided", () => {
    const out = buildPersonJsonLd({
      profile: baseProfile,
      url: URL_TTB,
      siteUrl: SITE,
      absoluteImageUrl: "https://cdn.example.com/avatar.png",
    });
    expect(out.image).toBe("https://cdn.example.com/avatar.png");
  });

  it("includes bio as description when bio is non-empty", () => {
    const out = buildPersonJsonLd({
      profile: { ...baseProfile, bio: "DUPR 4.0 player from Saigon." },
      url: URL_TTB,
      siteUrl: SITE,
    });
    expect(out.description).toBe("DUPR 4.0 player from Saigon.");
  });
});

describe("buildProfileFallbackDescription", () => {
  it("name + city + DUPR fold into one Vietnamese sentence", () => {
    const out = buildProfileFallbackDescription({
      ...baseProfile,
      city: "Đà Nẵng",
      dupr_doubles: 4.55,
      dupr_singles: 4.21,
    });
    expect(out).toContain("Trần Thị B");
    expect(out).toContain("Đà Nẵng");
    expect(out).toContain("DUPR đôi 4.55");
    expect(out).toContain("DUPR đơn 4.21");
  });

  it("omits the per-rating DUPR clause when both ratings null", () => {
    // The trailing copy "...Xem lịch sử trận đấu, thống kê và rating DUPR
    // trên ThePickleHub." is intentional — the closing line always advertises
    // the surface. We only verify the per-rating clause is absent.
    const out = buildProfileFallbackDescription({ ...baseProfile, city: "Hà Nội" });
    expect(out).toContain("Hà Nội");
    expect(out).not.toMatch(/DUPR (đôi|đơn) \d/);
  });
});

/* ─── Feed helpers ────────────────────────────────────────────────────── */

const buildPart = (
  team: "a" | "b",
  position: number | null,
  display_name: string | null,
  username: string | null = null,
): FeedSeoParticipant => ({ team, position, display_name, username });

describe("feedTeamLabel", () => {
  it("joins doubles team names by ampersand sorted by position", () => {
    const parts = [
      buildPart("a", 2, "Bob"),
      buildPart("a", 1, "Alice"),
      buildPart("b", 1, "Carol"),
    ];
    expect(feedTeamLabel(parts, "a")).toBe("Alice & Bob");
  });

  it("returns just the singles player for one-deep team", () => {
    const parts = [buildPart("a", 1, "Alice")];
    expect(feedTeamLabel(parts, "a")).toBe("Alice");
  });

  it("falls back to username then '?' when display_name is null", () => {
    const parts = [
      buildPart("a", 1, null, "alice42"),
      buildPart("a", 2, null, null),
    ];
    expect(feedTeamLabel(parts, "a")).toBe("alice42 & ?");
  });

  it("returns 'Team A' / 'Team B' for empty team (corrupted row)", () => {
    expect(feedTeamLabel([], "a")).toBe("Team A");
    expect(feedTeamLabel([], "b")).toBe("Team B");
    expect(feedTeamLabel([buildPart("a", 1, "X")], "b")).toBe("Team B");
  });
});

describe("feedScoreCompact", () => {
  it("zips parallel arrays into 'a-b' games joined by space", () => {
    expect(feedScoreCompact([11, 9, 11], [7, 11, 8])).toBe("11-7 9-11 11-8");
  });

  it("coalesces missing trailing values to 0", () => {
    expect(feedScoreCompact([11, 11], [9])).toBe("11-9 11-0");
  });

  it("returns empty string when both arrays are empty", () => {
    expect(feedScoreCompact([], [])).toBe("");
  });
});

describe("buildFeedJsonLd", () => {
  const buildRow = (i: number, overrides: Partial<FeedRowForSeo> = {}): FeedRowForSeo => ({
    match_id: `m${i}`,
    slug: `match-${i}`,
    played_at: `2026-05-0${i}T10:00:00Z`,
    venue_name: `Court ${i}`,
    team_a_score: [11],
    team_b_score: [9],
    participants: [
      buildPart("a", 1, `Alice${i}`),
      buildPart("b", 1, `Bob${i}`),
    ],
    ...overrides,
  });

  it("emits a CollectionPage with ItemList of SportsEvent", () => {
    const out = buildFeedJsonLd({
      rows: [buildRow(1), buildRow(2)],
      canonical: `${SITE}/feed`,
      siteUrl: SITE,
      title: "Pickleball Feed",
      description: "Latest matches",
      lang: "en",
    });
    expect(out["@type"]).toBe("CollectionPage");
    expect(out.url).toBe(`${SITE}/feed`);
    expect(out.inLanguage).toBe("en-US");
    const main = out.mainEntity as {
      "@type": string;
      numberOfItems: number;
      itemListElement: unknown[];
    };
    expect(main["@type"]).toBe("ItemList");
    expect(main.numberOfItems).toBe(2);
    expect(main.itemListElement).toHaveLength(2);
  });

  it("sets inLanguage='vi-VN' when lang='vi'", () => {
    const out = buildFeedJsonLd({
      rows: [],
      canonical: `${SITE}/vi/feed`,
      siteUrl: SITE,
      title: "Bảng tin",
      description: "Trận mới",
      lang: "vi",
    });
    expect(out.inLanguage).toBe("vi-VN");
    expect(out.url).toBe(`${SITE}/vi/feed`);
  });

  it("each ListItem points to /tran-dau/<slug> and carries team-vs-team name", () => {
    const out = buildFeedJsonLd({
      rows: [buildRow(1)],
      canonical: `${SITE}/feed`,
      siteUrl: SITE,
      title: "T",
      description: "D",
      lang: "en",
    });
    const list = (out.mainEntity as { itemListElement: Array<{ position: number; item: { url: string; name: string } }> }).itemListElement;
    expect(list[0].position).toBe(1);
    expect(list[0].item.url).toBe(`${SITE}/tran-dau/match-1`);
    expect(list[0].item.name).toBe("Alice1 vs Bob1");
  });

  it("omits item.location when venue_name is null", () => {
    const out = buildFeedJsonLd({
      rows: [buildRow(1, { venue_name: null })],
      canonical: `${SITE}/feed`,
      siteUrl: SITE,
      title: "T",
      description: "D",
      lang: "en",
    });
    const item = (out.mainEntity as { itemListElement: Array<{ item: Record<string, unknown> }> })
      .itemListElement[0].item;
    expect(item.location).toBeUndefined();
  });

  it("renders an empty ItemList when rows is empty (rather than omitting mainEntity)", () => {
    const out = buildFeedJsonLd({
      rows: [],
      canonical: `${SITE}/feed`,
      siteUrl: SITE,
      title: "T",
      description: "D",
      lang: "en",
    });
    const main = out.mainEntity as { numberOfItems: number; itemListElement: unknown[] };
    expect(main.numberOfItems).toBe(0);
    expect(main.itemListElement).toEqual([]);
  });
});
