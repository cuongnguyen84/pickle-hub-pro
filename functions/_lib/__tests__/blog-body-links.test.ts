import { describe, it, expect } from "vitest";
import { renderEnBlogBody, renderSectionLink, storylinesHtml } from "../render/blog-body";

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

describe("tournament cluster + storylines (bot path)", () => {
  it("results post links its schedule sibling, watch guide, rankings and tools", async () => {
    const html = await renderEnBlogBody("hong-kong-slam-2026-results", SITE);
    const nav = html.match(/<nav class="tl-rb-chips" aria-label="Tournament coverage">.*?<\/nav>/)?.[0] ?? "";
    for (const path of ["/blog/hong-kong-slam-2026-schedule", "/blog/how-to-watch-ppa-tour-live-2026", "/rankings", "/tools"]) {
      expect(nav).toContain(`href="${SITE}${path}"`);
    }
  });

  it("Worlds results gets the cluster without a schedule sibling that does not exist", async () => {
    const html = await renderEnBlogBody("pickleball-world-championships-2026-results", SITE);
    expect(html).toContain('aria-label="Tournament coverage"');
    expect(html).not.toContain("pickleball-world-championships-2026-schedule");
  });

  it("no storylines = no empty section", async () => {
    expect(storylinesHtml(undefined, "Storylines")).toBe("");
    expect(storylinesHtml(" \n\n ", "Storylines")).toBe("");
    expect(storylinesHtml("A.\n\nB & C.", "Storylines")).toBe("<section><h2>Storylines</h2><p>A.</p><p>B &amp; C.</p></section>");
    expect(await renderEnBlogBody("hong-kong-slam-2026-results", SITE)).not.toContain("<h2>Storylines</h2>");
  });
});
