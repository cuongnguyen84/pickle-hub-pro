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

  it("is discoverable from the homepage fallback and agent guide", () => {
    const homepage = readFileSync("index.html", "utf8");
    const agentGuide = readFileSync("public/llms.txt", "utf8");
    expect(homepage).toContain('href="/openapi.json"');
    expect(agentGuide).toContain("https://www.thepicklehub.net/openapi.json");
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

  it("gives every operation a directly discoverable typed success response", () => {
    const operations = Object.values(document.paths).flatMap((path) =>
      Object.entries(path)
        .filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method))
        .map(([, operation]) => operation),
    );

    expect(operations).toHaveLength(3);
    for (const operation of operations) {
      expect(operation.responses["200"].content["application/json"].schema).toBeDefined();
    }
  });

  it("publishes actionable agent guidance and links it from llms.txt", () => {
    const instructions = readFileSync("public/agents.md", "utf8");
    const agentGuide = readFileSync("public/llms.txt", "utf8");

    expect(instructions).toContain("## When to use ThePickleHub");
    expect(instructions).toContain("## Source and citation guidance");
    expect(instructions).toContain("must not call, probe, or attempt to discover that secret");
    expect(instructions).toContain("Training crawlers such as GPTBot and ClaudeBot are intentionally blocked");
    expect(agentGuide).toContain("https://www.thepicklehub.net/agents.md");
  });

  it("does not expose an example or default administrative secret", () => {
    const serialized = JSON.stringify(document);
    expect(serialized).not.toMatch(/example[^}]*key|default[^}]*key/i);
  });
});
