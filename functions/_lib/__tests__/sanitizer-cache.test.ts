import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { prerenderCacheKey } from "../prerender-cache-key";
import { sanitizeBlogHtml } from "../sanitize-blog-html";
it.each([false, true])("old cached HTML misses the new renderer namespace (human=%s)", async (human) => {
  const cache = new Map([[`pr:v157:${human ? "human:" : ""}/vi/blog/test`, '<img src=x onerror="attack()">']]);
  const render = vi.fn(() => sanitizeBlogHtml('<h2>Article</h2><img src=x onerror="attack()">'));
  const key = prerenderCacheKey("/vi/blog/test", human);
  const read = () => { const hit = cache.get(key); if (hit) return hit; const html = render(); cache.set(key, html); return html; };
  expect(read()).toBe('<h2>Article</h2><img>');
  expect(read()).not.toContain("onerror");
  expect(render).toHaveBeenCalledTimes(1);
  const middleware = readFileSync(new URL("../../_middleware.ts", import.meta.url), "utf8");
  expect(middleware).toContain(human ? "prerenderCacheKey(url.pathname, true)" : "prerenderCacheKey(url.pathname)");
  expect(middleware).not.toContain("`pr:v157:");
});
