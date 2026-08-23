import { describe, expect, it } from "vitest";
import {
  homepageMarkdown,
  isHtmlSpaFallback,
  isPagesApiPath,
  isWellKnownPath,
  jsonNotFound,
  onRequest,
} from "../_middleware";

const invoke = (
  pathname: string,
  nextResponse: Response,
  accept = "text/html",
) => onRequest({
  request: new Request(`https://www.thepicklehub.net${pathname}`, {
    headers: { Accept: accept },
  }),
  env: {
    CANONICAL_HOST: "https://www.thepicklehub.net",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test",
  },
  next: async () => nextResponse,
} as never);

describe("Pages API middleware bypass", () => {
  it.each([
    "/api",
    "/api/",
    "/api/rum-context",
    "/api/indexnow",
    "/api/future/nested-endpoint",
  ])("recognizes %s as a Pages API path", (pathname) => {
    expect(isPagesApiPath(pathname)).toBe(true);
  });

  it.each(["/", "/apis", "/api-docs", "/tools/api"]) (
    "does not bypass normal route handling for %s",
    (pathname) => {
      expect(isPagesApiPath(pathname)).toBe(false);
    },
  );

  it("recognizes machine-readable discovery paths without matching lookalikes", () => {
    expect(isWellKnownPath("/.well-known/agent-card.json")).toBe(true);
    expect(isWellKnownPath("/.well-known")).toBe(true);
    expect(isWellKnownPath("/.well-knownish/card.json")).toBe(false);
  });

  it("detects only successful HTML SPA fallbacks", () => {
    expect(isHtmlSpaFallback(new Response("<html></html>", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    }))).toBe(true);
    expect(isHtmlSpaFallback(Response.json({ ok: true }))).toBe(false);
    expect(isHtmlSpaFallback(new Response("missing", {
      status: 404,
      headers: { "Content-Type": "text/html" },
    }))).toBe(false);
  });

  it("returns a typed, non-indexable JSON 404", async () => {
    const response = jsonNotFound("/api/missing");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    await expect(response.json()).resolves.toEqual({
      error: "not_found",
      path: "/api/missing",
    });
  });

  it("serves a discoverable markdown homepage with content negotiation headers", async () => {
    const response = homepageMarkdown("https://www.thepicklehub.net", "en");
    const body = await response.text();
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("vary")).toBe("Accept");
    expect(body).toContain("# ThePickleHub");
    expect(body).toContain("/openapi.json");
    expect(body).toContain("/llms.txt");
  });

  it("converts an unknown API SPA rewrite into JSON 404", async () => {
    const response = await invoke(
      "/api/missing",
      new Response("<html>SPA</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
      "application/json",
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("converts a phantom discovery document into JSON 404", async () => {
    const response = await invoke(
      "/.well-known/agent-card.json",
      new Response("<html>SPA</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
      "application/json",
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: "not_found",
      path: "/.well-known/agent-card.json",
    });
  });

  it("preserves a real well-known machine-readable document", async () => {
    const source = Response.json({ issuer: "https://issuer.example" });
    const response = await invoke("/.well-known/openid-configuration", source);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ issuer: "https://issuer.example" });
  });
});
