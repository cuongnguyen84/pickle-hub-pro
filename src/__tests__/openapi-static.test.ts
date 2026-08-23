import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const document = JSON.parse(readFileSync("public/openapi.json", "utf8"));

describe("public OpenAPI document", () => {
  it("uses OpenAPI 3.1 and the canonical production server", () => {
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toContainEqual(
      expect.objectContaining({ url: "https://www.thepicklehub.net" }),
    );
  });

  it("documents every public Pages API route", () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      "/api/indexnow",
      "/api/rum-context",
    ]);
    expect(document.paths["/api/indexnow"].get.security).toBeDefined();
    expect(document.paths["/api/indexnow"].post.security).toBeDefined();
    expect(document.paths["/api/rum-context"].get.responses["200"]).toBeDefined();
  });

  it("does not expose an example or default administrative secret", () => {
    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(/example[^}]*key|default[^}]*key/i);
  });
});
