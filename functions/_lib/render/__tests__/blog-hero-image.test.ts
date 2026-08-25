// ============================================================================
// Audit 2026-08-25, H1 — the prerendered HTML must carry the hero image.
// ----------------------------------------------------------------------------
// The bot path ships no application JS, so every image on the site used to be
// invisible to crawlers: 132 of 135 sampled pages had zero <img>. Blog is the
// segment with the best per-URL yield (33 URLs → 26% of organic clicks), and
// its heroes are the only first-party images we own outright, so they are what
// unblocks Google Images and Discover.
// ============================================================================

import { describe, expect, it } from "vitest";
import { renderEnBlogBody, blogImageAttrs, heroFigure } from "../blog-body";
import { withViCoverImage } from "../blog";
import { blogMetadata } from "../../../../src/content/blog/metadata";

const SITE = "https://www.thepicklehub.net";

describe("EN blog body hero image", () => {
  it("emits an <img> with the real intrinsic dimensions", async () => {
    const post = blogMetadata.find((m) => m.heroImage?.src.endsWith(".webp"));
    expect(post, "no post has a hero image to test").toBeTruthy();
    const html = await renderEnBlogBody(post!.slug, SITE);
    expect(html).toContain(`src="${post!.heroImage!.src}"`);
    expect(html).toMatch(/<img[^>]+width="\d+"[^>]+height="\d+"/);
    expect(html).toContain('loading="eager"');
    expect(html).toContain('fetchpriority="high"');
  });

  it("carries the alt text from metadata, escaped", async () => {
    const post = blogMetadata.find((m) => m.heroImage?.alt.includes('"')) ?? blogMetadata[0];
    const html = await renderEnBlogBody(post.slug, SITE);
    if (post.heroImage) expect(html).toContain('alt="');
    expect(html).not.toContain('alt=""');
  });

  it("puts the hero after the <h1>, inside the article", async () => {
    const post = blogMetadata.find((m) => m.heroImage)!;
    const html = await renderEnBlogBody(post.slug, SITE);
    expect(html.indexOf("</h1>")).toBeLessThan(html.indexOf("<img"));
    expect(html.indexOf("<img")).toBeLessThan(html.indexOf("</article>"));
  });

  it("offers a 768w candidate when the responsive sibling exists", () => {
    const attrs = blogImageAttrs("/images/blog/world-pickleball-rankings-wpr-hero.webp");
    expect(attrs).toContain("world-pickleball-rankings-wpr-hero-768.webp 768w");
    expect(attrs).toContain('sizes="(max-width: 900px) 100vw, 832px"');
  });

  it("omits dimensions rather than guessing for an unknown asset", () => {
    expect(blogImageAttrs("https://cdn.example.com/whatever.jpg")).toBe("");
    expect(heroFigure(undefined)).toBe("");
  });
});

describe("VI blog cover image", () => {
  const COVER = "/images/blog/world-pickleball-rankings-wpr-hero.webp";

  it("inserts the cover right after the h1 that lives in content_html", () => {
    const out = withViCoverImage("<h1>Luật</h1><p>Nội dung</p>", COVER, "Luật");
    expect(out.indexOf("</h1>")).toBeLessThan(out.indexOf("<img"));
    expect(out.indexOf("<img")).toBeLessThan(out.indexOf("<p>"));
    expect(out).toMatch(/width="1600" height="900"/);
  });

  it("falls back to the top of the article when the post has no h1", () => {
    const out = withViCoverImage("<p>Nội dung</p>", COVER, "Luật");
    expect(out.startsWith("<figure>")).toBe(true);
  });

  it("does not duplicate an image the editor already embedded", () => {
    const body = `<h1>Luật</h1><img src="${COVER}"/>`;
    expect(withViCoverImage(body, COVER, "Luật")).toBe(body);
  });

  it("is a no-op for a post with no cover", () => {
    expect(withViCoverImage("<p>x</p>", null, "Luật")).toBe("<p>x</p>");
  });

  it("escapes the title it uses as alt text", () => {
    const out = withViCoverImage("<p>x</p>", COVER, 'Luật "mới"');
    expect(out).toContain("&quot;");
    expect(out).not.toContain('alt="Luật "mới""');
  });
});
