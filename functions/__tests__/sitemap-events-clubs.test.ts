import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(import.meta.dirname, "../sitemap-events.xml.ts"),
  "utf8",
);

/**
 * 2026-08-27 site audit, measured on the live file:
 *
 *   /sitemap-events.xml listed 12 /clb/ URLs. `club_listing` — the view the
 *   /clubs page and renderClubList read — returned 9. The three extras were
 *   archived clubs (/clb/kim-lien, /clb/175-dinh-cong, /clb/test), the last
 *   a QA fixture named "test" with a 4-character description. The sitemap
 *   query read the base `clubs` table with no filter at all.
 *
 *   Every one of those 12 entries also carried
 *     <xhtml:link hreflang="en|vi|x-default" href="<the same URL>"/>
 *   while /clb/{slug} itself emits no <link rel="alternate"> — a same-URL
 *   annotation with no return tag, invalid under Google's spec and the
 *   source of the Ahrefs pair "no return-tag" + "referenced for more than
 *   one language".
 *
 * The assertions below are scoped to the club branch on purpose. Social
 * events genuinely have two URLs (/social/{slug} + /vi/social/{slug}) and
 * must keep their hreflang block.
 */
const clubBranch = source.slice(source.indexOf("const clubEntries"));
const eventBranch = source.slice(
  source.indexOf("const eventEntries"),
  source.indexOf("const clubEntries"),
);

describe("sitemap-events.xml — club entries", () => {
  it("splits into two distinguishable branches", () => {
    // An indexOf that misses returns -1 and slices a passing string out of
    // thin air, so every assertion below would go quietly vacuous.
    expect(source.indexOf("const clubEntries")).toBeGreaterThan(0);
    expect(source.indexOf("const eventEntries")).toBeGreaterThan(0);
    expect(clubBranch).toContain("/clb/");
    expect(eventBranch).toContain("/social/");
  });

  it("excludes archived clubs at the query", () => {
    // Scoped to the clubs query, not to the whole file: `.is()` asserted
    // against `source` would also pass if the filter were bolted onto the
    // social_events query by mistake.
    const clubsQuery = source.slice(
      source.indexOf('.from("clubs")'),
      source.indexOf("const eventEntries"),
    );
    expect(source.indexOf('.from("clubs")')).toBeGreaterThan(0);
    expect(clubsQuery).toContain('.is("archived_at", null)');

    // Column-order independent — a reordered .select() is not a regression.
    const select = clubsQuery.match(/\.select\(\s*"([^"]+)"\s*\)/);
    expect(select).not.toBeNull();
    for (const column of ["slug", "created_at", "updated_at", "archived_at"]) {
      expect(select![1]).toContain(column);
    }
  });

  it("410s the /clb/test QA fixture instead of leaving it crawlable", () => {
    // Dropping it from the sitemap withdraws the recommendation but does not
    // remove a URL Google already has. Its three siblings (/clb/clb-test,
    // /clb/test-3, /clb/test-5) were 410'd on 2026-07-30; this one was missed.
    const middleware = readFileSync(
      resolve(import.meta.dirname, "../_middleware.ts"),
      "utf8",
    );
    const goneList = middleware.slice(
      middleware.indexOf("const GONE_EXACT"),
      middleware.indexOf("const GONE_PATTERNS"),
    );
    expect(middleware.indexOf("const GONE_EXACT")).toBeGreaterThan(0);
    expect(goneList).toContain('"/clb/test"');
  });

  it("emits no hreflang for the single-canonical /clb/ route", () => {
    expect(clubBranch).not.toContain('lang: "en", href: loc');
    expect(clubBranch).not.toContain('lang: "vi", href: loc');
    expect(clubBranch).not.toContain('lang: "x-default", href: loc');
    expect(clubBranch).not.toContain("hreflang: [");
  });

  it("keeps hreflang on social events, which really do have two URLs", () => {
    expect(eventBranch).toContain('lang: "en", href: enLoc');
    expect(eventBranch).toContain('lang: "vi", href: viLoc');
    expect(eventBranch).toContain('lang: "x-default", href: enLoc');
  });

  it("still emits loc, lastmod, changefreq and priority for a club", () => {
    for (const field of ["loc,", "lastmod:", "changefreq:", "priority:"]) {
      expect(clubBranch).toContain(field);
    }
  });

  it("prefers updated_at over created_at as the club lastmod", () => {
    // created_at as lastmod claims a club edited last week is unchanged since
    // the day it was created — the false-freshness class the 2026-08-25
    // sitemap-hygiene suite exists to hold.
    expect(clubBranch).toContain("c.updated_at ?? c.created_at");
  });

  it("records why the annotation was removed, so it is not restored by reflex", () => {
    expect(source).toContain("genuinely invalid signal");
    expect(source).toContain("singleCanonicalHreflang()");
  });

  it("records why archived clubs are dropped but not noindexed", () => {
    expect(source).toContain("Deliberately NOT paired with a noindex");
  });
});
