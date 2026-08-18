// ============================================================================
// Q4 — the closed-pilot Shop is not indexed, and the switch is server-side.
// ----------------------------------------------------------------------------
// Reads the Pages Functions source rather than a rendered page, because the
// thing being asserted is WHERE the decision is made. A <meta> written after
// hydration is not a robots directive to a crawler that never runs the bundle,
// and a test against a hydrated DOM could not tell the two apart.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isPilotNoindexShopPath, shopIndexingEnabled, shouldNoindex } from "../../_middleware";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

const BUYER_PATHS = [
  "/shop",
  "/shop/search",
  "/shop/category/vot",
  "/shop/product/vot-joola",
  "/shop/store/pickle-gear",
];
const VI_PATHS = BUYER_PATHS.map((p) => `/vi${p}`);

describe("the pilot Shop is noindex by default", () => {
  it.each([...BUYER_PATHS, ...VI_PATHS])("%s is matched for noindex", (path) => {
    expect(isPilotNoindexShopPath(path)).toBe(true);
  });

  it("does not swallow unrelated paths that merely start with /shop", () => {
    // /shop/sell is a SELLER surface with its own permanent noindex; it must
    // not depend on the launch flag, and neither must anything outside Shop.
    expect(isPilotNoindexShopPath("/shopping")).toBe(false);
    expect(isPilotNoindexShopPath("/tournaments")).toBe(false);
  });

  it("is off unless the flag is exactly '1'", () => {
    // Unset is the pilot default. "true"/"yes"/"" must not open the gate by
    // accident — this is the kind of flag that gets set to the wrong string.
    for (const v of [undefined, "", "0", "true", "yes", "on"]) {
      expect(shopIndexingEnabled({ SHOP_PUBLIC_INDEXING: v }), String(v)).toBe(false);
    }
    expect(shopIndexingEnabled({ SHOP_PUBLIC_INDEXING: "1" })).toBe(true);
  });
});

describe("the decision is made at the edge, not in the browser", () => {
  const mw = read("../../_middleware.ts");

  it("shouldNoindex actually applies the pilot rule", () => {
    // Called, not grepped. The first version of this file asserted the source
    // CONTAINED the check and stayed green when it was replaced by
    // `return false`.
    for (const path of [...BUYER_PATHS, ...VI_PATHS]) {
      expect(shouldNoindex(path, {}), path).toBe(true);
      expect(shouldNoindex(path, { SHOP_PUBLIC_INDEXING: "1" }), path).toBe(false);
    }
  });

  it("still reads its answer from env at request time", () => {
    expect(mw).toContain("shouldNoindex(pathname, env)");
    expect(mw).toContain('X_ROBOTS_NOINDEX = "noindex, nofollow, noarchive"');
  });

  it("Seller and Admin stay noindex whatever the launch flag says", () => {
    for (const path of [
      "/seller",
      "/seller/products",
      "/seller/orders",
      "/seller/orders/PH-2608-AB12",
      "/vi/seller",
      "/shop/sell",
      "/admin/shop/products",
    ]) {
      expect(shouldNoindex(path, { SHOP_PUBLIC_INDEXING: "1" }), path).toBe(true);
    }
  });

  it("the buyer's own order LIST is noindex, and is not a catalogue page", () => {
    // /shop/orders is one letter away from /shop/order, and
    // `^\/(?:vi\/)?shop\/order(?:\/|$)` does not match it: the next character
    // is an "s". It also must not be in SHOP_PUBLIC_PATTERNS, or opening the
    // launch gate would index a purchase history.
    for (const path of ["/shop/orders", "/vi/shop/orders"]) {
      expect(shouldNoindex(path, {}), path).toBe(true);
      expect(shouldNoindex(path, { SHOP_PUBLIC_INDEXING: "1" }), path).toBe(true);
      expect(isPilotNoindexShopPath(path), path).toBe(false);
    }
    // The order detail page it sits next to is still covered by its own rule.
    expect(shouldNoindex("/shop/order/PH-2608-AB12", { SHOP_PUBLIC_INDEXING: "1" })).toBe(true);
  });
});

describe("robots.txt", () => {
  const robots = read("../../robots.txt.ts");

  it("disallows the buyer catalogue during the pilot, in both languages", () => {
    for (const p of ["/shop/search", "/shop/category", "/shop/product", "/shop/store"]) {
      expect(robots).toContain(`Disallow: ${p}`);
      expect(robots).toContain(`Disallow: /vi${p}`);
    }
  });

  it("disallows the buyer's own order surfaces in both languages", () => {
    // /shop/orders is listed separately from /shop/order. robots.txt matches
    // by PREFIX so one would have covered the other — but the middleware
    // regexes do not, and a reader comparing the two files should not have to
    // work out which rule is doing the work.
    for (const p of ["/shop/cart", "/shop/checkout", "/shop/order", "/shop/orders"]) {
      expect(robots).toContain(`Disallow: ${p}`);
      expect(robots).toContain(`Disallow: /vi${p}`);
    }
  });

  it("keeps the seller surfaces disallowed unconditionally", () => {
    // Outside the flag-controlled block.
    const gated = robots.slice(robots.indexOf("shopPilotDisallow ="), robots.indexOf("`;", robots.indexOf("shopPilotDisallow =")));
    expect(gated).not.toContain("Disallow: /seller");
    expect(robots).toContain("Disallow: /seller");
    expect(robots).toContain("Disallow: /shop/sell");
  });
});

describe("no Shop URL reaches the sitemap or IndexNow during the pilot", () => {
  it("the sitemap index does not reference a shop segment", () => {
    const index = read("../../sitemap.xml.ts");
    expect(index).not.toMatch(/sitemap-shop/);
    expect(index).not.toMatch(/\/shop\//);
  });

  it("no sitemap function emits a /shop/product or /shop/store URL", () => {
    // A whole-directory sweep rather than a list, so a sitemap added later is
    // covered without anybody remembering to extend this test.
    const dir = resolve(__dirname, "../..");
    const files = readFileSync(resolve(dir, "sitemap.xml.ts"), "utf8");
    expect(files).not.toMatch(/shop\/(product|store|category|search)/);
  });

  it("nothing calls IndexNow for a Shop URL", () => {
    const indexnow = read("../../api/indexnow.ts");
    expect(indexnow).not.toMatch(/shop\/(product|store|category)/);
  });
});
