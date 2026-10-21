// ============================================================================
// The Shop launch gate — and what stays shut on the other side of it.
// ----------------------------------------------------------------------------
// Reads the Pages Functions source rather than a rendered page, because the
// thing being asserted is WHERE the decision is made. A <meta> written after
// hydration is not a robots directive to a crawler that never runs the bundle,
// and a test against a hydrated DOM could not tell the two apart.
//
// Phase 4 (2026-08-18) rewrote the expectations, not the method. This file used
// to pin "everything under /shop is noindex". That is no longer the product, so
// pinning it would have been a test defending a decision nobody holds. What it
// pins now is the shape the launch must keep:
//
//   * the gate is still exactly `=== "1"`, still read from env at request time
//   * the four catalogue surfaces open WITH the gate
//   * /shop/search does NOT — it left the gated set for the permanent one
//   * buyer PII surfaces and Seller/Admin do not open, whatever the gate says
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isPilotNoindexShopPath, shopIndexingEnabled, shouldNoindex } from "../../_middleware";

const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");

/** The surfaces the launch flag governs. */
const CATALOGUE_PATHS = [
  "/shop",
  "/shop/category/vot",
  "/shop/product/vot-joola",
  "/shop/store/pickle-gear",
];
const VI_CATALOGUE_PATHS = CATALOGUE_PATHS.map((p) => `/vi${p}`);
const ALL_CATALOGUE = [...CATALOGUE_PATHS, ...VI_CATALOGUE_PATHS];

describe("the launch gate governs the catalogue and nothing else", () => {
  it.each(ALL_CATALOGUE)("%s is gated, not permanently noindex", (path) => {
    expect(isPilotNoindexShopPath(path)).toBe(true);
    expect(shouldNoindex(path, {})).toBe(true);
    expect(shouldNoindex(path, { SHOP_PUBLIC_INDEXING: "1" })).toBe(false);
  });

  it("does not swallow unrelated paths that merely start with /shop", () => {
    expect(isPilotNoindexShopPath("/shopping")).toBe(false);
    expect(isPilotNoindexShopPath("/tournaments")).toBe(false);
  });

  it("is off unless the flag is exactly '1'", () => {
    // "true"/"yes"/"" must not open the gate by accident — this is the kind of
    // flag that gets set to the wrong string.
    for (const v of [undefined, "", "0", "true", "yes", "on"]) {
      expect(shopIndexingEnabled({ SHOP_PUBLIC_INDEXING: v }), String(v)).toBe(false);
    }
    expect(shopIndexingEnabled({ SHOP_PUBLIC_INDEXING: "1" })).toBe(true);
  });

  it("still reads its answer from env at request time", () => {
    const mw = read("../../_middleware.ts");
    expect(mw).toContain("shouldNoindex(pathname, env)");
    expect(mw).toContain('X_ROBOTS_NOINDEX = "noindex, nofollow, noarchive"');
  });
});

describe("what the gate must never open", () => {
  it("search results stay noindex on BOTH sides of the gate", () => {
    // One result page per query string is thin duplicate content wearing the
    // catalogue's own products. It sat in SHOP_PUBLIC_PATTERNS until Phase 4,
    // where "open the catalogue" would have opened the query-string surface
    // with it — and every one of those pages competes with the /shop/product
    // page that is its canonical home.
    // Pathname only — shouldNoindex is called with url.pathname, so the
    // query string never reaches it. That is also why the rule has to match
    // the bare path: `?q=vot` is not what makes the page thin, the path is.
    for (const path of ["/shop/search", "/vi/shop/search", "/shop/search/"]) {
      expect(shouldNoindex(path, {}), path).toBe(true);
      expect(shouldNoindex(path, { SHOP_PUBLIC_INDEXING: "1" }), path).toBe(true);
    }
    expect(isPilotNoindexShopPath("/shop/search")).toBe(false);
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

  it("the buyer's own cart, checkout, order and order LIST stay noindex", () => {
    // /shop/orders is one letter away from /shop/order, and
    // `^\/(?:vi\/)?shop\/order(?:\/|$)` does not match it: the next character
    // is an "s". These hold a recipient's name, phone number and home address.
    for (const path of [
      "/shop/cart",
      "/shop/checkout/thepicklehub",
      "/shop/order/PH-2608-AB12",
      "/shop/orders",
      "/vi/shop/cart",
      "/vi/shop/orders",
    ]) {
      expect(shouldNoindex(path, {}), path).toBe(true);
      expect(shouldNoindex(path, { SHOP_PUBLIC_INDEXING: "1" }), path).toBe(true);
      expect(isPilotNoindexShopPath(path), path).toBe(false);
    }
  });
});

describe("robots.txt tracks the same two sets", () => {
  const robots = read("../../robots.txt.ts");
  const gatedBlock = robots.slice(
    robots.indexOf("shopPilotDisallow ="),
    robots.indexOf("`;", robots.indexOf("shopPilotDisallow =")),
  );

  it("disallows the catalogue only inside the flag-controlled block", () => {
    for (const p of ["/shop/category", "/shop/product", "/shop/store"]) {
      expect(gatedBlock).toContain(`Disallow: ${p}`);
      expect(gatedBlock).toContain(`Disallow: /vi${p}`);
    }
  });

  it("disallows search unconditionally — outside the block", () => {
    expect(gatedBlock).not.toContain("Disallow: /shop/search");
    expect(robots).toContain("Disallow: /shop/search");
    expect(robots).toContain("Disallow: /vi/shop/search");
  });

  it("disallows the buyer's own order surfaces unconditionally", () => {
    // robots.txt matches by PREFIX so /shop/order would have covered
    // /shop/orders — but the middleware regexes do not, and a reader comparing
    // the two files should not have to work out which rule does the work.
    for (const p of ["/shop/cart", "/shop/checkout", "/shop/order", "/shop/orders"]) {
      expect(gatedBlock).not.toContain(`Disallow: ${p}`);
      expect(robots).toContain(`Disallow: ${p}`);
      expect(robots).toContain(`Disallow: /vi${p}`);
    }
  });

  it("keeps the seller surfaces disallowed unconditionally", () => {
    expect(gatedBlock).not.toContain("Disallow: /seller");
    expect(robots).toContain("Disallow: /seller");
    expect(robots).toContain("Disallow: /shop/sell");
  });
});

describe("the sitemap segment carries the gate too", () => {
  const seg = read("../../sitemap-shop.xml.ts");

  it("is referenced by the index unconditionally", () => {
    // Unconditional on purpose: a segment that 404s while the gate is shut
    // flags the whole index in Search Console. The segment answers an empty
    // urlset instead.
    expect(read("../../sitemap.xml.ts")).toContain("/sitemap-shop.xml");
  });

  it("reads the same flag, and returns an empty urlset when it is off", () => {
    expect(seg).toContain('context.env.SHOP_PUBLIC_INDEXING !== "1"');
    expect(seg).toMatch(/!== "1"\)\s*\{\s*return new Response\(wrapUrlset\(\[\]\)/);
  });

  it("lists products through the public RPC, never the products table", () => {
    // Reading the table here would put draft and rejected listings into the
    // one surface Google trusts most, while every rendered page correctly
    // hid them. The RPC is SECURITY DEFINER and carries the filter.
    expect(seg).toContain('supabase.rpc("shop_public_search"');
    expect(seg).not.toMatch(/\.from\(["']products["']\)/);
  });

  it("emits no buyer-PII or search URL", () => {
    expect(seg).not.toMatch(/shop\/(cart|checkout|orders?|search|sell)/);
  });

  it("says so in the log when it truncates", () => {
    // A sitemap that stops at MAX_PAGES and says nothing reads as complete.
    expect(seg).toContain("MAX_PAGES");
    expect(seg).toMatch(/console\.warn\([^)]*MAX_PAGES/);
  });
});

describe("IndexNow", () => {
  it("still does not ping a Shop URL", () => {
    // Submitting product URLs the moment a seller edits one is a reasonable
    // later step, but it is not part of this launch and it is not wired.
    const indexnow = read("../../api/indexnow.ts");
    expect(indexnow).not.toMatch(/shop\/(product|store|category)/);
  });
});
