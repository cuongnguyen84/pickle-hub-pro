import { describe, it, expect } from "vitest";
import { renderSectionLink } from "../render/blog-body";

// Guards the SSR half of BlogSection.internalLinks. Before 2026-07-27 the
// renderer concatenated every path onto siteUrl, so an absolute URL shipped to
// Googlebot as `https://www.thepicklehub.nethttps://ticketbox.vn/...`. Nothing
// threw, nothing logged, and no test covered it — the only symptom was a dead
// outbound link in the bot view.
const SITE = "https://www.thepicklehub.net";

describe("renderSectionLink", () => {
  it("prefixes siteUrl on an internal path", () => {
    const html = renderSectionLink(SITE, { text: "Live", path: "/live" });
    expect(html).toBe(`<li><a href="${SITE}/live">Live</a></li>`);
  });

  it("leaves an absolute URL alone instead of concatenating it", () => {
    const url = "https://ticketbox.vn/ppa-asia-500-mb-hcmc-open-2026-26355";
    const html = renderSectionLink(SITE, { text: "Mua vé", path: url });

    expect(html).toContain(`href="${url}"`);
    // The exact shape of the old bug.
    expect(html).not.toContain(`${SITE}https://`);
  });

  it("marks outbound links nofollow noopener, and internal ones not at all", () => {
    const out = renderSectionLink(SITE, { text: "x", path: "https://example.com/a" });
    const inn = renderSectionLink(SITE, { text: "x", path: "/blog/a" });

    expect(out).toContain('rel="nofollow noopener"');
    expect(inn).not.toContain("rel=");
    // "sponsored" claims paid placement; this helper cannot know that.
    expect(out).not.toContain("sponsored");
  });

  it("treats http:// and mixed case as absolute too", () => {
    for (const url of ["http://example.com/a", "HTTPS://Example.com/a"]) {
      expect(renderSectionLink(SITE, { text: "x", path: url })).toContain(`href="${url}"`);
    }
  });

  it("escapes both branches — attribute values and link text", () => {
    const nasty = 'https://example.com/?a=1&b="2"';
    const html = renderSectionLink(SITE, { text: '<script>x</script>', path: nasty });

    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
    expect(html).not.toContain("<script>");
    // A raw quote would close the href attribute early.
    expect(html).not.toContain('="2"');

    const internal = renderSectionLink(SITE, { text: "a & b", path: "/x?y=1&z=2" });
    expect(internal).toContain("&amp;");
  });
});
