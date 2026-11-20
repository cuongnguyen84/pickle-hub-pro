import { describe, expect, it } from "vitest";
import { buildHtml } from "../html";

describe("SSR shared live navigation", () => {
  it.each(["en", "vi"] as const)("links directly to the canonical %s live route", (lang) => {
    const siteUrl = "https://www.thepicklehub.net";
    const html = buildHtml({ title: "Test", description: "Test", url: `${siteUrl}/tools`, siteUrl, lang });
    const header = html.match(/<header>[\s\S]*?<\/header>/)?.[0];
    expect(header).toContain(`href="${siteUrl}${lang === "vi" ? "/vi" : ""}/live"`);
    expect(header).not.toContain("/livestream");
  });
});
