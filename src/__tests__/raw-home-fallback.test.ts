import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const root = html.match(/<div id="root">([\s\S]*?)<script type="module"/)?.[1] ?? "";

describe("raw homepage fallback for agents without JavaScript", () => {
  it("ships one H1 and semantic page landmarks", () => {
    expect(root.match(/<h1\b/gi)).toHaveLength(1);
    expect(root).toMatch(/<header\b/i);
    expect(root).toMatch(/<nav\b/i);
    expect(root).toMatch(/<main\b/i);
    expect(root).toMatch(/<footer\b/i);
  });

  it("contains more than 500 characters of readable content", () => {
    const text = root
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    expect(text.length).toBeGreaterThan(500);
    expect(text).not.toContain("Loading...");
  });

  it("publishes valid Organization and WebSite JSON-LD", () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
    expect(blocks.length).toBeGreaterThan(0);

    const nodes = blocks.flatMap((block) => {
      const value = JSON.parse(block[1]);
      return Array.isArray(value["@graph"]) ? value["@graph"] : [value];
    });

    expect(nodes.some((node) => node["@type"] === "Organization")).toBe(true);
    expect(nodes.some((node) => node["@type"] === "WebSite")).toBe(true);
    expect(
      nodes.find((node) => node["@type"] === "Organization")?.contactPoint,
    ).toEqual(expect.objectContaining({
      "@type": "ContactPoint",
      url: "https://www.thepicklehub.net/contact",
    }));
  });

  it("links machine-readable developer resources", () => {
    expect(root).toContain('href="/openapi.json"');
    expect(root).toContain('href="/llms.txt"');
  });

  it("keeps the React bootstrap that replaces the fallback", () => {
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
  });
});
