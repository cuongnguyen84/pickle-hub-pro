import { describe, expect, it } from "vitest";
import { renderPrivacy, renderTerms } from "../static-pages";

const SITE = "https://www.thepicklehub.net";

/** Every indexable bot page should state its topic in exactly one <h1>. */
function countH1(html: string): number {
  return (html.match(/<h1[\s>]/g) ?? []).length;
}

describe("single <h1> per rendered page", () => {
  // The regression: buildHtml() emits an auto-header <h1>{title}</h1> unless
  // omitAutoHeader is passed. Five renderers already opened their bodyContent
  // with their own <h1>, so every page they produced shipped two — the
  // decorated "… | ThePickleHub" title plus the real heading. At 100%
  // incidence inside the news and player segments that was ~1046 pages.
  it("renders privacy with one h1 in both locales", async () => {
    for (const [path, lang, heading] of [
      ["/privacy", "en", "Privacy Policy"],
      ["/vi/privacy", "vi", "Chính sách bảo mật"],
    ] as const) {
      const html = await renderPrivacy(SITE, path, lang).text();
      expect(countH1(html)).toBe(1);
      expect(html).toContain(heading);
      // The auto-header's signature is the decorated, pipe-separated title.
      expect(html).not.toMatch(/<h1[^>]*>[^<]*\| ThePickleHub<\/h1>/);
    }
  });

  it("keeps the auto-header on terms, which supplies no body heading of its own", async () => {
    // renderTerms passes no bodyContent, so the auto-header is its ONLY h1.
    // Copying omitAutoHeader here would leave the page with zero headings —
    // this case exists to stop that being "tidied up" later.
    for (const [path, lang] of [["/terms", "en"], ["/vi/terms", "vi"]] as const) {
      const html = await renderTerms(SITE, path, lang).text();
      expect(countH1(html)).toBe(1);
    }
  });

  it("still emits the bilingual hreflang pair on privacy and terms", async () => {
    for (const render of [renderPrivacy, renderTerms]) {
      const html = await render(SITE, "/privacy", "en").text();
      expect(html).toContain('hreflang="en"');
      expect(html).toContain('hreflang="vi"');
      expect(html).toContain('hreflang="x-default"');
    }
  });
});
