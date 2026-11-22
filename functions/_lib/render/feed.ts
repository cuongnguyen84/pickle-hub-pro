/**
 * SSR render handler — mixed timeline feed (/feed + /vi/feed).
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";
import {
  buildTimelineFeedJsonLd,
  feedTeamLabel,
  feedScoreCompact,
  type FeedSeoParticipant,
  type TimelineRowForSeo,
} from "../seo-helpers";
import {
  dedupeFeedItems,
  FEED_PAGE_SIZE,
  FEED_RESULT_EVERY,
  FEED_RESULT_WIDE_WINDOW_MS,
  FEED_STANDARD_WINDOW_MS,
  FEED_WIDE_RESULT_CAP,
  hideQuickTableMatchCopies,
  interleaveFeedResults,
  isMatchResult,
  selectFeedResults,
} from "../../../src/lib/social/feed-ranking";
import { blogTeasers } from "../../../src/content/blog/teasers";
import {
  localizeFeedBlogs,
  type FeedBlogLocalePost,
} from "../../../src/lib/social/feed-blog-locale";

// ─── Feed (Sprint 7 mixed timeline) ────────────────────────
//
// /feed (en) and /vi/feed (vi) — discovery surface. Sprint 7 swapped the
// matches-only trending RPC for get_feed_timeline, which UNION-ALLs
// matches + VI blog posts + videos into one recency-sorted stream.
//
// The prerender mirrors that shape so Googlebot indexes the same mixed
// content that a human sees — SportsEvent items for matches, BlogPosting
// for blog rows, VideoObject for videos. /feed lists the English posts
// (static metadata). /vi/feed lists the Vietnamese rows from the RPC.
// A language with no title of its own falls back to the other language.
// If the English window is empty, the Vietnamese rows stay.
//
// Anonymous viewer (NULL) so viewer_kudoed comes back false uniformly.
// Canonical strips ?tab=* so /feed and /feed?tab=trending dedupe to one
// indexed URL.

export interface RenderFeedOptions {
  nowMs?: number;
  posts?: readonly FeedBlogLocalePost[];
}

export async function renderFeed(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
  options: RenderFeedOptions = {},
): Promise<Response> {
  const path = lang === "vi" ? "/vi/feed" : "/feed";
  const canonical = `${siteUrl}${path}`;

  let rows: TimelineRowForSeo[] = [];
  try {
    const { data, error } = await supabase.rpc("get_feed_timeline", {
      p_limit: 20,
      p_cursor_score: null,
      p_cursor_item_id: null,
      p_viewer_id: null,
    });
    if (error) {
      console.error("renderFeed: get_feed_timeline error:", error);
    } else {
      rows = (data ?? []) as TimelineRowForSeo[];
    }
  } catch (err) {
    // Don't fail the whole prerender on RPC error — emit the SEO shell
    // with empty list so bots still get title + description + canonical.
    console.error("renderFeed: RPC fatal:", err);
  }

  let recent: TimelineRowForSeo[] = [];
  try {
    const { data, error } = await supabase.rpc("get_feed_recent_results", {
      p_limit: 12,
    });
    if (error) {
      console.error("renderFeed: get_feed_recent_results error:", error);
    } else {
      recent = (data ?? []) as TimelineRowForSeo[];
    }
  } catch (err) {
    console.error("renderFeed: recent results fatal:", err);
  }
  const nowMs = options.nowMs ?? Date.now();
  const posts = options.posts ?? blogTeasers.map((post) => ({
    slug: post.slug,
    publishedDate: post.publishedDate,
    titleEn: post.titleEn,
    titleVi: post.titleVi,
    metaDescriptionEn: post.metaDescriptionEn,
    excerptVi: post.excerptVi,
    heroSrc: post.heroImage?.src ?? null,
  }));
  rows = localizeFeedBlogs(rows, lang, posts, nowMs);
  rows = mixFeedResults(rows, recent, nowMs);

  const titleVi = "Bảng tin pickleball — Trận đấu, bài viết & video mới | ThePickleHub";
  const titleEn = "Pickleball Feed — Latest Matches, Posts & Videos | ThePickleHub";
  const descVi =
    "Bảng tin pickleball — trận đấu, bài viết, video mới nhất từ cộng đồng pickleball Việt Nam và châu Á trên ThePickleHub.";
  const descEn =
    "Pickleball community feed — the latest matches, articles, and videos from Vietnam and across Asia on ThePickleHub.";

  const title = lang === "vi" ? titleVi : titleEn;
  const description = lang === "vi" ? descVi : descEn;

  const extraMeta = [
    `<link rel="alternate" hreflang="en" href="${siteUrl}/feed"/>`,
    `<link rel="alternate" hreflang="vi" href="${siteUrl}/vi/feed"/>`,
    `<link rel="alternate" hreflang="x-default" href="${siteUrl}/feed"/>`,
  ].join("\n");

  const jsonLd = buildTimelineFeedJsonLd({
    rows,
    canonical,
    siteUrl,
    title,
    description,
    lang,
  });

  // Body content — semantic list per item type so a fully-text bot like
  // the legacy IA Crawler still sees structure even before parsing JSON-LD.
  const items = rows
    .map((row) => renderTimelineRowHtml(row, siteUrl, lang))
    .filter((html): html is string => html != null)
    .join("");

  const headingVi = "Cập nhật mới nhất";
  const headingEn = "Latest updates";
  const heading = lang === "vi" ? headingVi : headingEn;
  const empty =
    lang === "vi"
      ? "Chưa có bài viết hay video trong 14 ngày gần đây. Kết quả trận có thể cũ hơn."
      : "No posts or videos from the last 14 days. Match results can be older.";

  const bodyContent = `<section>
<h2>${heading}</h2>
${rows.length > 0 ? `<ol>${items}</ol>` : `<p>${empty}</p>`}
</section>
<nav><h2>${lang === "vi" ? "Khám phá" : "Discover"}</h2><ul>
<li><a href="${siteUrl}/tournaments">${lang === "vi" ? "Giải đấu pickleball" : "Tournaments"}</a></li>
<li><a href="${siteUrl}/live">Livestream</a></li>
<li><a href="${siteUrl}/blog">${lang === "vi" ? "Blog" : "Blog"}</a></li>
</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonical,
      siteUrl,
      type: "website",
      jsonLd,
      bodyContent,
      extraMeta,
      lang,
    }),
  );
}

function rowRankedAtMs(row: TimelineRowForSeo): number {
  const ms = Date.parse(row.ranked_at || row.published_at);
  return Number.isNaN(ms) ? Number.NaN : ms;
}

/** Same page-1 rule as the React feed: 14-day posts, widened results, then interleave. */
function mixFeedResults(
  timeline: TimelineRowForSeo[],
  recent: TimelineRowForSeo[],
  nowMs: number,
): TimelineRowForSeo[] {
  const deduped = dedupeFeedItems([timeline, recent], (row) => row.item_id);
  const selected = hideQuickTableMatchCopies(selectFeedResults(deduped, {
    isResult: isMatchResult,
    rankedAtMs: rowRankedAtMs,
    nowMs,
    standardWindowMs: FEED_STANDARD_WINDOW_MS,
    wideWindowMs: FEED_RESULT_WIDE_WINDOW_MS,
    maxWideResults: FEED_WIDE_RESULT_CAP,
  }));
  const sorted = [...selected].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return interleaveFeedResults(sorted, isMatchResult, {
    windowSize: FEED_PAGE_SIZE,
    every: FEED_RESULT_EVERY,
  });
}

function renderTimelineRowHtml(
  row: TimelineRowForSeo,
  siteUrl: string,
  lang: Lang,
): string | null {
  if (row.item_type === "result" && row.source_url && row.source_url.startsWith("/")) {
    const parts = Array.isArray(row.participants)
      ? (row.participants as FeedSeoParticipant[])
      : [];
    const teamA = feedTeamLabel(parts, "a");
    const teamB = feedTeamLabel(parts, "b");
    const score = feedScoreCompact(row.team_a_score ?? [], row.team_b_score ?? []);
    const eventName = row.tournament_name ? `${escapeHtml(row.tournament_name)} — ` : "";
    return `<li><a href="${siteUrl}${escapeHtml(row.source_url)}">${eventName}${escapeHtml(`${teamA} vs ${teamB}`)}</a> — <strong>${escapeHtml(score)}</strong></li>`;
  }
  if (row.item_type === "match" && row.slug) {
    const parts = Array.isArray(row.participants)
      ? (row.participants as FeedSeoParticipant[])
      : [];
    const teamA = feedTeamLabel(parts, "a");
    const teamB = feedTeamLabel(parts, "b");
    const score = feedScoreCompact(
      row.team_a_score ?? [],
      row.team_b_score ?? [],
    );
    const venue = row.venue_name ? ` · ${escapeHtml(row.venue_name)}` : "";
    return `<li><a href="${siteUrl}/tran-dau/${escapeHtml(row.slug)}">${escapeHtml(`${teamA} vs ${teamB}`)}</a> — <strong>${escapeHtml(score)}</strong>${venue}</li>`;
  }
  if (row.item_type === "blog" && row.slug && row.title) {
    const blogLang = row.blog_lang === "en" || row.blog_lang === "vi"
      ? row.blog_lang
      : lang === "vi" ? "vi" : "en";
    const href = blogLang === "en"
      ? `${siteUrl}/blog/${escapeHtml(row.slug)}`
      : `${siteUrl}/vi/blog/${escapeHtml(row.slug)}`;
    const excerpt = row.excerpt ? ` — ${escapeHtml(row.excerpt)}` : "";
    return `<li><a href="${href}">${escapeHtml(row.title)}</a>${excerpt}</li>`;
  }
  if (row.item_type === "video" && row.title) {
    const desc = row.excerpt ? ` — ${escapeHtml(row.excerpt)}` : "";
    return `<li><a href="${siteUrl}/watch/${escapeHtml(row.item_id)}">${escapeHtml(row.title)}</a>${desc}</li>`;
  }
  return null;
}
