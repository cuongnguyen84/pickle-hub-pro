// ============================================================================
// P2b.7.5 — the noindex answer, read off the RESPONSE.
// ============================================================================
// shop-pilot-seo.test.ts calls `shouldNoindex` and proves the rule. It cannot
// prove the middleware USES it: the first version of that file asserted the
// source *contained* the pilot check, and replacing the check with
// `return false` changed nothing it looked at. The same shape as the P2b.5
// note about `activeMediaId` — the function was covered, the wiring was not.
//
// So this invokes `onRequest` — the production entry point Cloudflare Pages
// calls, the actual export — and asserts on the headers and the body of the
// Response it returns. Both audiences, because they take different branches:
//
//   human  → next() with X-Robots-Tag bolted on
//   bot    → renderNoindexShell, never the real page
//
// Red-proof, run before this was committed: replacing
// `const isNoindex = shouldNoindex(pathname, env)` with `= false` in
// _middleware.ts turns 26 of these red, on both branches, naming the paths.
// Deleting the `/shop` entry from PILOT_SHOP_NOINDEX reds the buyer half only.
// Neither is caught by any assertion that reads the source.
// ============================================================================

import { describe, expect, it } from "vitest";
import { onRequest } from "../../_middleware";

const HOST = "https://www.thepicklehub.net";
const HUMAN = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const BUYER = ["/shop", "/shop/search", "/shop/category/vot", "/shop/product/vot-joola", "/shop/store/pickle-gear"];
const VI_BUYER = BUYER.map((p) => `/vi${p}`);
const PRIVATE = ["/seller", "/seller/products", "/vi/seller", "/shop/sell", "/admin/shop/products"];

/** The SPA shell `next()` would hand back. Distinctive, so a test can tell
 *  whether the bot got the real page or the noindex shell. */
const spa = () =>
  new Response("<html><body data-spa=\"1\">shell</body></html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

async function edge(pathname: string, { ua = HUMAN, env = {} } = {}) {
  const context = {
    request: new Request(`${HOST}${pathname}`, { headers: { "user-agent": ua } }),
    env: { CANONICAL_HOST: HOST, ...env },
    next: async () => spa(),
    // Unused on these branches; present so the shape matches the platform's.
    params: {}, data: {}, functionPath: pathname, waitUntil: () => {}, passThroughOnException: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const response = await onRequest(context);
  return { response, body: await response.clone().text() };
}

describe("the pilot Shop answers noindex at the edge, to a human", () => {
  it.each([...BUYER, ...VI_BUYER])("%s carries X-Robots-Tag", async (path) => {
    const { response } = await edge(path);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it.each(PRIVATE)("%s carries X-Robots-Tag whatever the launch flag says", async (path) => {
    // Seller and Admin are matched by their own patterns, BEFORE the flag is
    // consulted. Opening the buyer catalogue must never open these.
    const { response } = await edge(path, { env: { SHOP_PUBLIC_INDEXING: "1" } });
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
  });

  it("still serves the page — noindex is a directive, not a block", async () => {
    const { response, body } = await edge("/shop");
    expect(response.status).toBe(200);
    expect(body).toContain('data-spa="1"');
  });

  it.each(BUYER)("%s stops carrying it once SHOP_PUBLIC_INDEXING is exactly '1'", async (path) => {
    const { response } = await edge(path, { env: { SHOP_PUBLIC_INDEXING: "1" } });
    expect(response.headers.get("X-Robots-Tag")).toBeNull();
  });

  it.each(["", "0", "true", "yes", "on", "TRUE"])(
    "a flag set to %o leaves the gate closed", async (value) => {
      const { response } = await edge("/shop/product/x", { env: { SHOP_PUBLIC_INDEXING: value } });
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    },
  );
});

describe("the pilot Shop answers noindex at the edge, to a crawler", () => {
  it.each([...BUYER, ...VI_BUYER])("%s gets the noindex shell, not the catalogue", async (path) => {
    const { response, body } = await edge(path, { ua: BOT });
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");
    // The HTML robots directive too: a crawler that ignores headers still
    // reads the meta, and the pilot cannot rely on it choosing the same one.
    expect(body).toContain('name="robots"');
    expect(body).toContain("noindex, nofollow, noarchive");
    // And it must NOT be the SPA shell — a bot served the app would index
    // whatever the app happens to render server-side.
    expect(body).not.toContain('data-spa="1"');
    expect(response.headers.get("X-Prerender-Cache")).toBe("BYPASS");
  });

  it("reads nothing from the database to answer", async () => {
    // The shell is built from the path and two constant strings. Nothing a
    // seller wrote — a title, a shop name, a price, a photo — may appear on a
    // surface for a catalogue that is not open to crawling. The URL echo in
    // canonical/og:url is the crawler's own input, not a disclosure.
    const { body } = await edge("/shop/product/vot-joola-cua-shop-abc", { ua: BOT });
    expect(body).toContain("Private page");
    expect(body).not.toMatch(/₫|price|availability|in_stock|zalo\.me/i);
    expect(body).not.toContain("storage/v1/object/public/shop-product-media");
  });

  it("cannot be made to reflect markup from a crafted slug", async () => {
    // Two layers, and the test asserts the OUTCOME rather than either one:
    // the URL parser percent-encodes the angle brackets, and buildHtml
    // escapes what is left before it goes into an attribute. What matters is
    // that no executable markup and no attribute break-out survives.
    const { body } = await edge('/shop/store/"><script>alert(1)</script>', { ua: BOT });
    expect(body).not.toMatch(/<script[^>]*>[^<]*alert/);
    expect(body).toContain("%3Cscript%3E");
    // The quote that would end the href attribute must not be raw either.
    expect(body).not.toMatch(/href="[^"]*"><script/);
  });

  it("answers in the language of the path", async () => {
    const { body: vi } = await edge("/vi/shop", { ua: BOT });
    expect(vi).toContain('lang="vi"');
    const { body: en } = await edge("/shop", { ua: BOT });
    expect(en).toContain('lang="en"');
  });
});

describe("robots.txt during the pilot", () => {
  it("disallows the buyer catalogue and cannot be opened by the flag alone", async () => {
    // Not a source grep: the Pages Function is called and its body read.
    const { onRequest: robots } = await import("../../robots.txt.ts");
    const call = async (env: Record<string, string>) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (await robots({ request: new Request(`${HOST}/robots.txt`), env } as any)).text();

    const pilot = await call({});
    for (const p of ["/shop/search", "/shop/category", "/shop/product", "/shop/store"]) {
      expect(pilot, p).toContain(`Disallow: ${p}`);
      expect(pilot, `/vi${p}`).toContain(`Disallow: /vi${p}`);
    }
    expect(pilot).toContain("Disallow: /seller");
    expect(pilot).toContain("Disallow: /shop/sell");

    const launched = await call({ SHOP_PUBLIC_INDEXING: "1" });
    expect(launched, "the seller surfaces are not the flag's to open")
      .toContain("Disallow: /seller");
    expect(launched).toContain("Disallow: /shop/sell");
    expect(launched, "the buyer catalogue opens with the flag")
      .not.toContain("Disallow: /shop/product");
  });
});
