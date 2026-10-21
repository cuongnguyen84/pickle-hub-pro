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

describe("trailing slash on a known route", () => {
  it.each([
    ["/blog/", "/blog"],
    ["/tools/", "/tools"],
    ["/vi/blog/", "/vi/blog"],
    ["/vi/", "/vi"],
  ])("301s %s to %s", async (from, to) => {
    const res = await invoke(from);
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe(`${SITE}${to}`);
  });

  it("keeps the query string", async () => {
    const res = await invoke("/blog/?utm=1");
    expect(res.headers.get("location")).toBe(`${SITE}/blog?utm=1`);
  });

  it("does not invent a redirect for an unknown path", async () => {
    const res = await invoke("/not-a-real-route/");
    expect(res.status).not.toBe(301);
  });
});
