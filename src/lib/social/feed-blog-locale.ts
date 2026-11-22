import { BLOG_TYPE_BONUS } from "./feed-ranking";

/** Same window as get_feed_timeline's blog branch and useFeedTimeline. */
export const FEED_BLOG_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const HALF_LIFE_HOURS = 48;

export interface FeedBlogLocaleRow {
  item_type: string;
  item_id: string;
  published_at: string;
  ranked_at?: string | null;
  score?: number | null;
  slug?: string | null;
  title?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  blog_lang?: "en" | "vi" | null;
}

export interface FeedBlogLocalePost {
  slug: string;
  publishedDate: string;
  titleEn: string;
  titleVi: string;
  metaDescriptionEn?: string | null;
  excerptVi?: string | null;
  heroSrc?: string | null;
}

function publishedMs(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function blogScore(publishedAtMs: number, nowMs: number): number {
  const ageHours = Math.max(0, (nowMs - publishedAtMs) / 3_600_000);
  return Math.exp(-ageHours / HALF_LIFE_HOURS) + BLOG_TYPE_BONUS;
}

function titleFor(post: FeedBlogLocalePost, lang: "en" | "vi"): string {
  const primary = (lang === "en" ? post.titleEn : post.titleVi).trim();
  const fallback = (lang === "en" ? post.titleVi : post.titleEn).trim();
  return primary || fallback;
}

/**
 * RPC blog rows are Vietnamese (vi_blog_posts). The English page lists the
 * static EN posts instead, and links them at /blog/:slug. A post with no
 * title in that language uses the other language's title. If the English
 * window is empty, the Vietnamese rows stay so the page is not stripped
 * of articles.
 */
export function localizeFeedBlogs<T extends FeedBlogLocaleRow>(
  rows: readonly T[],
  lang: "en" | "vi",
  posts: readonly FeedBlogLocalePost[],
  nowMs: number,
): T[] {
  if (lang === "vi") {
    return rows.flatMap((row) => {
      if (row.item_type !== "blog") return [row];
      const post = posts.find((item) => item.slug === row.slug);
      const title = row.title?.trim() || (post ? titleFor(post, "vi") : "");
      if (!title) return [];
      return [{ ...row, title, blog_lang: "vi" as const }];
    });
  }

  const english = posts.flatMap((post): T[] => {
    const ts = publishedMs(post.publishedDate);
    if (Number.isNaN(ts) || ts > nowMs || nowMs - ts > FEED_BLOG_WINDOW_MS) return [];
    const title = titleFor(post, "en");
    if (!title) return [];
    const usedEnglish = post.titleEn.trim().length > 0;
    return [{
      item_type: "blog",
      item_id: `en-blog:${post.slug}`,
      published_at: new Date(ts).toISOString(),
      ranked_at: new Date(ts).toISOString(),
      score: blogScore(ts, nowMs),
      slug: post.slug,
      title,
      excerpt: (usedEnglish ? post.metaDescriptionEn : post.excerptVi) ?? post.excerptVi ?? null,
      cover_image_url: post.heroSrc ?? null,
      blog_lang: "en",
    } as T];
  });

  if (english.length === 0) {
    return rows.flatMap((row) => {
      if (row.item_type !== "blog") return [row];
      if (!row.title?.trim() || !row.slug) return [];
      return [{ ...row, blog_lang: "vi" as const }];
    });
  }

  return [...rows.filter((row) => row.item_type !== "blog"), ...english];
}
