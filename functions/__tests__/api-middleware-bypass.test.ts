import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  homepageMarkdown,
  isHtmlSpaFallback,
  isPagesApiPath,
  isWellKnownPath,
  jsonNotFound,
  onRequest,
  serveAppleAppSiteAssociation,
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

  it("serves apple-app-site-association as application/json", async () => {
    const body = JSON.stringify({ applinks: { apps: [] } });
    const response = await invoke(
      "/.well-known/apple-app-site-association",
      new Response(body, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Cache-Control": "public, max-age=0, must-revalidate",
          ETag: "\"abc\"",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("public, max-age=0, must-revalidate");
    expect(response.headers.get("etag")).toBe("\"abc\"");
    await expect(response.json()).resolves.toEqual({ applinks: { apps: [] } });
  });

  it("keeps an association file that Pages already labeled as JSON", () => {
    const source = new Response("{}", {
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
    const response = serveAppleAppSiteAssociation(source);
    expect(response).toBe(source);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });

  it("does not relabel other well-known documents", async () => {
    const response = await invoke(
      "/.well-known/openid-configuration",
      new Response("{}", { headers: { "Content-Type": "application/octet-stream" } }),
    );
    expect(response.headers.get("content-type")).toBe("application/octet-stream");
  });

  it("claims only the blog, news, and court paths the native app opens", () => {
    const aasa = JSON.parse(
      readFileSync("public/.well-known/apple-app-site-association", "utf8"),
    ) as {
      applinks: { details: Array<{ appIDs: string[]; paths: string[] }> };
    };
    const prod = aasa.applinks.details.find((detail) =>
      detail.appIDs.includes("5S49Q7AB7M.net.thepicklehub.app"),
    );
    const dev = aasa.applinks.details.find((detail) =>
      detail.appIDs.includes("5S49Q7AB7M.net.thepicklehub.app.dev"),
    );
    expect(prod).toBeDefined();
    expect(dev?.paths).toEqual(["/dang-ky/*", "/vi/dang-ky/*", "/join/*"]);

    const paths = prod?.paths ?? [];
    const exclusions = [
      ["NOT /blog/*/*", "/blog/*"],
      ["NOT /vi/blog/*/*", "/vi/blog/*"],
      ["NOT /news/*/*", "/news/*"],
      ["NOT /vi/news/*/*", "/vi/news/*"],
      ["NOT /san/*/*", "/san/*"],
      ["NOT /vi/san/*/*", "/vi/san/*"],
      ["NOT /san/them", "/san/*"],
      ["NOT /vi/san/them", "/vi/san/*"],
    ] as const;
    for (const [excluded, included] of exclusions) {
      expect(paths.indexOf(excluded)).toBeGreaterThanOrEqual(0);
      expect(paths.indexOf(excluded)).toBeLessThan(paths.indexOf(included));
    }
  });

  it("serves a static markdown agent instruction file instead of SPA 404", async () => {
    const source = new Response("# Agent instructions", {
      headers: { "Content-Type": "text/markdown; charset=utf-8" },
    });
    const response = await invoke("/agents.md", source, "text/markdown");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    await expect(response.text()).resolves.toContain("# Agent instructions");
  });
});
