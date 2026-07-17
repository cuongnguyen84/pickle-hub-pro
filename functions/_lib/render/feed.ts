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

// ─── Feed (Sprint 7 mixed timeline) ────────────────────────
//
// /feed (en) and /vi/feed (vi) — discovery surface. Sprint 7 swapped the
// matches-only trending RPC for get_feed_timeline, which UNION-ALLs
// matches + VI blog posts + videos into one recency-sorted stream.
//
// The prerender mirrors that shape so Googlebot indexes the same mixed
// content that a human sees — SportsEvent items for matches, BlogPosting
// for VI blog rows, VideoObject for videos. EN static blog metadata is
// intentionally NOT folded in here; those posts already render under
// /blog/<slug> with their own per-page schema, and dual-emitting the same
// BlogPosting from /feed risks duplicate-entity noise in Search Console.
//
// Anonymous viewer (NULL) so viewer_kudoed comes back false uniformly.
// Canonical strips ?tab=* so /feed and /feed?tab=trending dedupe to one
// indexed URL.

export async function renderFeed(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
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
    .map((row) => renderTimelineRowHtml(row, siteUrl))
    .filter((html): html is string => html != null)
    .join("");

  const headingVi = "Cập nhật mới nhất";
  const headingEn = "Latest updates";
  const heading = lang === "vi" ? headingVi : headingEn;
  const empty =
    lang === "vi"
      ? "Chưa có gì mới trong 30 ngày qua."
      : "Nothing new in the last 30 days.";

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

function renderTimelineRowHtml(
  row: TimelineRowForSeo,
  siteUrl: string,
): string | null {
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
    const excerpt = row.excerpt ? ` — ${escapeHtml(row.excerpt)}` : "";
    return `<li><a href="${siteUrl}/vi/blog/${escapeHtml(row.slug)}">${escapeHtml(row.title)}</a>${excerpt}</li>`;
  }
  if (row.item_type === "video" && row.title) {
    const desc = row.excerpt ? ` — ${escapeHtml(row.excerpt)}` : "";
    return `<li><a href="${siteUrl}/watch/${escapeHtml(row.item_id)}">${escapeHtml(row.title)}</a>${desc}</li>`;
  }
  return null;
}
