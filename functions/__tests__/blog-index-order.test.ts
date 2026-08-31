/**
 * The bot view of /blog must carry the same order readers get.
 *
 * On 2026-08-31 blog listings moved from a publishedDate sort to "the later of
 * published/updated", so a post refreshed mid-event resurfaces. The React page
 * (Blog.tsx) and the VI SSR path were both moved in that change; renderBlog was
 * missed, because it never sorted at all — it leaned on BLOG_POST_META's
 * insertion order, which had been equivalent to a publishedDate sort for as
 * long as new entries were prepended.
 *
 * The result was visible on production: /vi/blog led with the refreshed Group A
 * article while /blog still led with a post from five days earlier. This test
 * exists so that the two paths cannot drift apart again silently — a listing
 * whose bot order disagrees with its reader order is invisible in every test
 * that only renders one of them.
 */

import { describe, it, expect } from "vitest";
import { BLOG_POST_META } from "../_lib/render/blog-meta";
import { renderBlog } from "../_lib/render/blog";
import { byEffectiveDateDesc, effectiveDateMs } from "../../src/lib/blogOrder";

const SITE = "https://www.thepicklehub.net";

const expectedOrder = () =>
  Object.entries(BLOG_POST_META)
    .sort(byEffectiveDateDesc(([, m]) => m.datePublished, ([, m]) => m.dateModified))
    .map(([slug]) => slug);

const renderedOrder = (html: string) => {
  const seen: string[] = [];
  for (const m of html.matchAll(/href="[^"]*\/blog\/([a-z0-9-]+)"/g)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
};

describe("renderBlog ordering", () => {
  it("lists posts newest-touched first, not by insertion order", async () => {
    const html = await new Response(renderBlog(SITE).body).text();
    const rendered = renderedOrder(html);
    const expected = expectedOrder().filter((s) => rendered.includes(s));
    expect(rendered.filter((s) => expected.includes(s))).toEqual(expected);
  });

  it("puts a post refreshed after publication above newer untouched posts", () => {
    // Guards the actual regression rather than restating the sort: assert that
    // at least one post is lifted above a post published more recently.
    const ordered = Object.entries(BLOG_POST_META).sort(
      byEffectiveDateDesc(([, m]) => m.datePublished, ([, m]) => m.dateModified),
    );
    const lifted = ordered.findIndex(([, m], i) =>
      ordered.slice(0, i).some(([, prev]) => (prev.datePublished ?? "") < (m.datePublished ?? "")),
    );
    // Either nothing is currently refreshed, or the lift is genuine.
    if (lifted !== -1) {
      const [, m] = ordered[lifted];
      expect(effectiveDateMs(m.datePublished, m.dateModified)).toBeGreaterThan(
        effectiveDateMs(m.datePublished, undefined),
      );
    }
  });

  it("emits ItemList positions in the same order it renders the links", async () => {
    const html = await new Response(renderBlog(SITE).body).text();
    const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
      .map((m) => JSON.parse(m[1]))
      .flatMap((d) => d["@graph"] ?? [d]);
    const itemList = jsonLd.find((n) => n["@type"] === "ItemList");
    expect(itemList).toBeTruthy();
    const fromJsonLd = itemList.itemListElement
      .sort((a, b) => a.position - b.position)
      .map((e) => e.url.replace(`${SITE}/blog/`, ""));
    expect(fromJsonLd).toEqual(renderedOrder(html).slice(0, fromJsonLd.length));
  });
});
