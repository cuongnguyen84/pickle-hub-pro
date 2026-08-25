// ============================================================================
// /vi/<entity>/<id> → /<entity>/<id>, permanently.
// ----------------------------------------------------------------------------
// These six routes are single-canonical: one URL serves both locales and the
// SPA toggles language client-side. The renderers always emit the non-/vi
// canonical, so the /vi twin advertised someone else's URL as canonical while
// its own hreflang pointed at itself — SEOnaut's "Hreflang to non canonical"
// plus "Mismatching language". org/tournament/watch were redirected for that
// reason in audit batch 5; tran-dau, nguoi-choi and live/:id were left behind
// and only caught on 2026-08-25, when they were still answering 200.
//
// tran-dau and nguoi-choi were the worse pair: the SPA has no /vi route for
// either, so a human hard-navigating one landed on NotFound while bots got a
// full render off the same URL.
// ============================================================================

import { describe, expect, it } from "vitest";
import { onRequest } from "../_middleware";

const SITE = "https://www.thepicklehub.net";

const invoke = (pathname: string) => onRequest({
  request: new Request(`${SITE}${pathname}`, { headers: { Accept: "text/html" } }),
  env: {
    CANONICAL_HOST: SITE,
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  },
  next: async () => new Response("<html></html>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  }),
} as never);

describe("single-canonical /vi entity redirects", () => {
  it.each([
    ["/vi/org/canpickleball", "/org/canpickleball"],
    ["/vi/tournament/hcmc-open-2026", "/tournament/hcmc-open-2026"],
    ["/vi/watch/64a46348-e29b", "/watch/64a46348-e29b"],
    ["/vi/tran-dau/mlp-mlp-1f9fd1ac", "/tran-dau/mlp-mlp-1f9fd1ac"],
    ["/vi/nguoi-choi/sontung", "/nguoi-choi/sontung"],
    ["/vi/live/54ca7b79-9ee0", "/live/54ca7b79-9ee0"],
  ])("301s %s to %s", async (from, to) => {
    const res = await invoke(from);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE}${to}`);
  });

  it("carries the query string through", async () => {
    const res = await invoke("/vi/live/54ca7b79?utm_source=zalo");
    expect(res.headers.get("location")).toBe(`${SITE}/live/54ca7b79?utm_source=zalo`);
  });

  it.each([
    "/vi/live",
    "/vi/tournaments",
    "/vi/blog/luat-pickleball-co-ban",
    "/vi/san/09-hub-picleball",
    "/vi/news/some-article",
  ])("leaves %s alone — it is a real VI page, not an entity twin", async (pathname) => {
    const res = await invoke(pathname);
    expect(res.status).not.toBe(301);
  });

  it("does not touch the EN originals", async () => {
    for (const p of ["/live/54ca7b79", "/nguoi-choi/sontung", "/tran-dau/x"]) {
      expect((await invoke(p)).status).not.toBe(301);
    }
  });
});
