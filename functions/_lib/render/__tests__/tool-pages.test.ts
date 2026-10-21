import { describe, expect, it } from "vitest";
import { renderToolNewPage, renderToolPage } from "../tools";

const SITE = "https://www.thepicklehub.net";
const bytes = (s: string) => new TextEncoder().encode(s).length;

const titleOf = (html: string) => html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
const h1Of = (html: string) => html.match(/<h1>([^<]*)<\/h1>/)?.[1] ?? "";
const h2Of = (html: string) => html.match(/<h2>([^<]*)<\/h2>/)?.[1] ?? "";

const pages: Array<[string, "en" | "vi", string]> = [
  ["quick-tables", "en", "/tools/quick-tables"],
  ["quick-tables", "vi", "/vi/tools/quick-tables"],
  ["flex-tournament", "en", "/tools/flex-tournament"],
  ["flex-tournament", "vi", "/vi/tools/flex-tournament"],
  ["team-match", "en", "/tools/team-match"],
  ["doubles-elimination", "vi", "/vi/tools/doubles-elimination"],
];

describe("tool landing pages", () => {
  it.each(pages)("%s %s has a full title, one h1, a different h2, and both languages", async (slug, lang, path) => {
    const html = await renderToolPage(slug, SITE, path, lang).text();
    const title = titleOf(html);
    expect(title).not.toContain("…");
    expect(bytes(title)).toBeLessThanOrEqual(60);
    expect(title.endsWith("| ThePickleHub")).toBe(true);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h1Of(html)).not.toBe(h2Of(html));
    expect(h1Of(html)).not.toContain("ThePickleHub");
    expect(html).toContain(`hreflang="en" href="${SITE}/tools/${slug}"`);
    expect(html).toContain(`hreflang="vi" href="${SITE}/vi/tools/${slug}"`);
    expect(html).toContain(`<html lang="${lang}">`);
  });

  it("gives /new pages the same heading and hreflang treatment", async () => {
    const html = await renderToolNewPage("flex-tournament", SITE, "/vi/tools/flex-tournament/new", "vi").text();
    const title = titleOf(html);
    expect(title).not.toContain("…");
    expect(bytes(title)).toBeLessThanOrEqual(60);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(h1Of(html)).not.toBe(title);
    expect(html).toContain(`hreflang="vi" href="${SITE}/vi/tools/flex-tournament/new"`);
    expect(html).toContain('<html lang="vi">');
  });
});
