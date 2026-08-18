import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

// The Organization sameAs list is the brand entity's set of "this is also us"
// claims, on the page that ranks for the brand's own name. Every entry has to
// resolve — a 404 in here is a dirty signal on exactly the entity these blocks
// exist to consolidate.
//
// Source-level rather than render-level on purpose: renderHome needs a live
// Supabase client, and the thing worth guarding is the literal list, not the
// rendering of it. There is no other test covering these fields.
const source = readFileSync("functions/_lib/render/home.ts", "utf8");

function sameAsBlocks(): string[][] {
  const blocks = [...source.matchAll(/sameAs:\s*\[([\s\S]*?)\]/g)];
  return blocks.map((b) => [...b[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
}

describe("Organization sameAs", () => {
  const blocks = sameAsBlocks();

  it("exists in both the EN and VI Organization blocks", () => {
    expect(blocks).toHaveLength(2);
  });

  it("keeps EN and VI identical — one entity, one set of profiles", () => {
    expect(blocks[0]).toEqual(blocks[1]);
  });

  it("lists only absolute https URLs", () => {
    for (const list of blocks) {
      for (const url of list) expect(url).toMatch(/^https:\/\/[^\s"]+$/);
    }
  });

  it("does not claim a Google Play listing while the Android app is unpublished", () => {
    // Verified 2026-07-27: play.google.com/store/apps/details?id=net.thepicklehub.app
    // returns 404 on every locale and app-id variant. The 2026-07-24 SEO brief
    // asked for this URL; adding it would point the brand entity at a dead page.
    // DELETE THIS TEST the day the Android app ships, and add the URL.
    for (const list of blocks) {
      expect(list.some((u) => u.includes("play.google.com"))).toBe(false);
    }
  });

  it("includes the App Store listing, which is live", () => {
    for (const list of blocks) {
      expect(list).toContain("https://apps.apple.com/app/id6759968026");
    }
  });

  it("points Facebook at our page, not the Indian business with the same name", () => {
    // BRAND-01, 2026-08-18. The list previously carried
    // facebook.com/ThePickleHub. It returns 200, so the "every entry has to
    // resolve" rule above passed it — but Facebook resolves that vanity URL to
    // facebook.com/thepicklehub/ = "Pickle Hub | Guntur", a business in Andhra
    // Pradesh, India. Resolving is not enough; it has to resolve to US, or the
    // schema asserts we are a different company that shares the brand name.
    // Ours is https://www.facebook.com/thepicklehubnet — the URL Cuong
    // supplied, page ID 61579261671499, og:title "thepicklehub.net".
    for (const list of blocks) {
      expect(list).toContain("https://www.facebook.com/thepicklehubnet");
      expect(list.some((u) => /facebook\.com\/ThePickleHub\/?$/i.test(u))).toBe(false);
    }
  });

  it("does not claim an Instagram profile — there is no Instagram presence", () => {
    // Removed 2026-08-18, confirmed by Cuong. instagram.com/thepicklehub is
    // not ours: it matched the brand name, which is precisely how the wrong
    // Facebook page got in. A plausible handle is not evidence of ownership.
    for (const list of blocks) {
      expect(list.some((u) => u.includes("instagram.com"))).toBe(false);
    }
  });

  it("claims the X account the social poster actually authenticates as", () => {
    // workers/social-poster/wrangler.toml documents X_CLIENT_ID as
    // "console.x.com, @thepicklehub". Confirmed by Cuong 2026-08-18.
    for (const list of blocks) {
      expect(list).toContain("https://x.com/thepicklehub");
    }
  });

  it("lists only profiles of this entity, not partner brands", () => {
    // TA Pickleball (FB_SECONDARY_PAGE_ID 376956272170210) is also Cuong's
    // page, but it is a separate brand. sameAs means "this IS us" — putting a
    // second entity in here repeats the Guntur mistake with a friendlier face.
    for (const list of blocks) {
      expect(list.some((u) => /tapickleball|376956272170210/i.test(u))).toBe(false);
    }
  });
});
