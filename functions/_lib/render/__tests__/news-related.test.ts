import { describe, expect, it } from "vitest";
import { renderViNewsPost, formatNewsDate } from "../news";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

/** A slice of the VI news timeline, oldest first. */
const CORPUS = Array.from({ length: 12 }, (_, i) => ({
  slug: `tin-${i}`,
  title: `Tin pickleball ${i}`,
  published_at: `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`,
  category: i % 2 === 0 ? "tournament" : "player",
}));

function article(idx: number, over: Record<string, unknown> = {}) {
  const c = CORPUS[idx];
  return {
    id: `id-${idx}`,
    title: c.title,
    summary: "Tóm tắt tin pickleball.",
    source: "The Dink Pickleball",
    category: c.category,
    image_url: null,
    language: "vi",
    slug: c.slug,
    published_at: c.published_at,
    updated_at: c.published_at,
    parent_news_id: null,
    ai_translated: true,
    content_html: "<p>Nội dung bài viết.</p>",
    ...over,
  };
}

/** Mirrors the filters renderNews actually applies, so ordering bugs surface. */
function stubClient(row: Record<string, unknown>) {
  const build = () => {
    const st: { neq?: string; lt?: string; gt?: string; category?: string; asc?: boolean } = {};
    const chain: Record<string, unknown> = {};
    Object.assign(chain, {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        if (col === "category") st.category = val as string;
        return chain;
      },
      neq: (_col: string, val: unknown) => { st.neq = val as string; return chain; },
      lt: (_col: string, val: unknown) => { st.lt = val as string; return chain; },
      gt: (_col: string, val: unknown) => { st.gt = val as string; return chain; },
      order: (_col: string, o?: { ascending?: boolean }) => { st.asc = o?.ascending; return chain; },
      maybeSingle: () => Promise.resolve({ data: row, error: null }),
      limit: (n: number) => {
        let out = CORPUS.filter((c) => c.slug !== st.neq);
        if (st.lt) out = out.filter((c) => c.published_at < st.lt!);
        if (st.gt) out = out.filter((c) => c.published_at > st.gt!);
        if (st.category) out = out.filter((c) => c.category === st.category);
        out = [...out].sort((a, b) =>
          st.asc ? a.published_at.localeCompare(b.published_at) : b.published_at.localeCompare(a.published_at),
        );
        return Promise.resolve({ data: out.slice(0, n), error: null });
      },
    });
    return chain;
  };
  return { from: () => build() } as unknown as SupabaseClient;
}

async function relatedSlugs(idx: number, over: Record<string, unknown> = {}) {
  const html = await (await renderViNewsPost(stubClient(article(idx, over)), CORPUS[idx].slug, SITE)).text();
  // Scope to the strip: canonical, og:url, hreflang and the breadcrumb all
  // carry this article's own URL, and matching the whole document would count
  // those as "related" links.
  const aside = html.match(/<aside>[\s\S]*?<\/aside>/)?.[0] ?? "";
  return [...aside.matchAll(/href="[^"]*\/vi\/news\/([^"]+)"/g)].map((m) => m[1]);
}

describe("news related strip", () => {
  it("gives different articles different neighbours", async () => {
    // THE REGRESSION (Ahrefs, 2026-08-28): the strip was
    // `order(published_at desc).limit(6)` with no reference to the current
    // article, so all 843 VI URLs linked to the same six newest items and
    // 823 of them ended up orphaned. Two articles far apart in the timeline
    // must not produce the same neighbour set.
    const early = await relatedSlugs(1);
    const late = await relatedSlugs(10);
    expect(early.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
    // Set inequality alone is too weak to catch this: the old code excluded
    // only the current slug, so two articles still differed by one item while
    // sharing five. Require the overlap to be a minority of the strip.
    const shared = early.filter((s) => late.includes(s));
    expect(shared.length).toBeLessThan(Math.min(early.length, late.length) / 2);
  });

  it("links the articles immediately either side of this one", async () => {
    // prev/next is what actually chains the timeline together: with it, every
    // article is inbound-linked by its neighbours, so no position is stranded.
    const slugs = await relatedSlugs(5);
    expect(slugs).toContain("tin-4");
    expect(slugs).toContain("tin-6");
  });

  it("never links to itself", async () => {
    expect(await relatedSlugs(7)).not.toContain("tin-7");
  });

  it("still renders for the newest article, which has no next", async () => {
    const slugs = await relatedSlugs(CORPUS.length - 1);
    expect(slugs).toContain("tin-10");
    expect(slugs).not.toContain("tin-11");
  });

  it("still renders for the oldest article, which has no prev", async () => {
    expect(await relatedSlugs(0)).toContain("tin-1");
  });
});

describe("news dateline", () => {
  it("names ThePickleHub, dates the article, and credits the source", async () => {
    const html = await (await renderViNewsPost(stubClient(article(3)), "tin-3", SITE)).text();
    const dateline = html.match(/<p class="dateline">[\s\S]*?<\/p>/)?.[0] ?? "";
    expect(dateline).toContain("ThePickleHub");
    expect(dateline).toContain("The Dink Pickleball");
    expect(dateline).toContain("04/08/2026");
    expect(dateline).toContain('<time datetime="2026-08-04T00:00:00Z">');
  });

  it("keeps the source credit as text, never an outbound link", async () => {
    // Pinned by src/lib/__tests__/news-editorial-surfaces.test.ts too:
    // source_url is private and these pages ship no outbound CTA.
    const html = await (await renderViNewsPost(stubClient(article(3)), "tin-3", SITE)).text();
    const dateline = html.match(/<p class="dateline">[\s\S]*?<\/p>/)?.[0] ?? "";
    expect(dateline).not.toContain("<a href");
  });
});

describe("formatNewsDate", () => {
  it("formats per locale and survives bad input", () => {
    expect(formatNewsDate("2026-08-04T00:00:00Z", "vi")).toBe("04/08/2026");
    expect(formatNewsDate("2026-08-04T00:00:00Z", "en")).toBe("August 4, 2026");
    expect(formatNewsDate("", "vi")).toBe("");
    expect(formatNewsDate("not-a-date", "en")).toBe("");
  });
});
