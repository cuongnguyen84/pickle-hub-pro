import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = JSON.parse(readFileSync("public/_routes.json", "utf8"));

describe("Cloudflare Pages function routing", () => {
  it("routes .well-known discovery requests through middleware", () => {
    expect(routes.include).toContain("/*");
    expect(routes.exclude).not.toContain("/.well-known/*");
  });

  it("still excludes deployment metadata and immutable root assets", () => {
    expect(routes.exclude).toEqual(expect.arrayContaining([
      "/_headers",
      "/_redirects",
      "/_routes.json",
      "/favicon.ico",
      "/og-image.png",
    ]));
  });
});
