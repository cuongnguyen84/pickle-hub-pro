/**
 * SSR render handlers — livestream + video pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  buildMetaDescription,
  absImage,
  breadcrumb,
  bilingualHreflang,
  singleCanonicalHreflang,
  buildBreadcrumbJsonLd,
  type Lang,
} from "../utils";
import { buildListJsonLd } from "./shared";
import { render404 } from "./static-pages";

// ─── Livestream ────────────────────────────��──────────────

export async function renderLive(supabase: SupabaseClient, id: string, siteUrl: string): Promise<Response> {
  const { data: ls } = await supabase
    .from("public_livestreams")
    .select("id, title, description, thumbnail_url, status, scheduled_start_at, started_at, ended_at, created_at, organization_id, tournament_id, mux_playback_id")
    .eq("id", id)
    .single();

  if (!ls) return render404(`/live/${id}`, siteUrl);

  const [orgRes, tournRes] = await Promise.all([
    ls.organization_id ? supabase.from("organizations").select("name, slug").eq("id", ls.organization_id).single() : Promise.resolve({ data: null }),
    ls.tournament_id ? supabase.from("tournaments").select("name").eq("id", ls.tournament_id).single() : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name || "";
  const orgSlug = orgRes.data?.slug || "";
  const tournName = tournRes.data?.name || "";

  const isEnded = ls.status === "ended";
  const isLive = ls.status === "live";
  const suffix = isEnded ? "Pickleball Replay" : "Pickleball Livestream";
  const rawTitle = tournName ? `${tournName} – ${ls.title}` : ls.title;
  const title = buildTitle(rawTitle, ` | ${suffix}`);
  const desc = buildMetaDescription(ls.description, { type: "video", title: ls.title });

  const pageUrl = `${siteUrl}/live/${id}`;
  const embedUrl = `${siteUrl}/embed/live/${id}`;
  const videoUrl = ls.mux_playback_id ? `https://stream.mux.com/${ls.mux_playback_id}.m3u8` : null;

  // ISO 8601 duration
  let durationIso = "";
  if (ls.started_at && ls.ended_at) {
    const diffSec = Math.max(0, Math.floor((new Date(ls.ended_at).getTime() - new Date(ls.started_at).getTime()) / 1000));
    if (diffSec > 0) {
      const h = Math.floor(diffSec / 3600);
      const m = Math.floor((diffSec % 3600) / 60);
      const s = diffSec % 60;
      durationIso = "PT" + (h > 0 ? `${h}H` : "") + (m > 0 ? `${m}M` : "") + `${s}S`;
    }
  }

  const robotsMeta = `<meta name="robots" content="max-video-preview:-1, max-image-preview:large, max-snippet:-1"/>`;
  const ogVideoMeta = videoUrl
    ? `<meta property="og:video" content="${escapeHtml(videoUrl)}"/>\n<meta property="og:video:type" content="text/html"/>\n<meta property="og:video:width" content="1280"/>\n<meta property="og:video:height" content="720"/>\n${orgName ? `<meta property="article:author" content="${escapeHtml(orgName)}"/>` : ""}`
    : "";

  // @graph: VideoObject + SportsEvent
  const videoObjectSchema: Record<string, unknown> = {
    "@type": "VideoObject",
    "@id": `${pageUrl}#video`,
    name: rawTitle,
    description: desc,
    thumbnailUrl: absImage(ls.thumbnail_url, siteUrl),
    uploadDate: ls.scheduled_start_at || ls.created_at,
    isFamilyFriendly: true,
    isAccessibleForFree: false,
    hasPart: { "@type": "Clip", name: "Free preview", startOffset: 0, endOffset: 30, url: pageUrl },
    embedUrl,
  };
  if (durationIso) videoObjectSchema.duration = durationIso;
  if (videoUrl) videoObjectSchema.contentUrl = videoUrl;

  const sportsEventSchema: Record<string, unknown> = {
    "@type": "SportsEvent",
    "@id": `${pageUrl}#event`,
    name: rawTitle,
    description: desc,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: pageUrl },
    organizer: { "@type": "Organization", name: "ThePickleHub", url: siteUrl },
    sport: "Pickleball",
  };
  if (ls.scheduled_start_at || ls.started_at) sportsEventSchema.startDate = ls.started_at || ls.scheduled_start_at;
  if (ls.ended_at) sportsEventSchema.endDate = ls.ended_at;
  if (ls.thumbnail_url) sportsEventSchema.image = absImage(ls.thumbnail_url, siteUrl);

  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Livestream", href: `${siteUrl}/live` },
    { label: ls.title },
  ]);

  const statusLabel = isLive ? "Đang phát trực tiếp" : isEnded ? "Replay" : "Sắp diễn ra";
  const dateDisplay = ls.scheduled_start_at
    ? new Date(ls.scheduled_start_at).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  // SEO audit 2026-05-28 (batch 8) — Related livestreams + Latest news.
  // Live detail SSR was ~143 words of body text, well below SEOnaut's
  // little-content threshold and with no inbound internal links from
  // other live pages → flagged on both. Fetch 5 sibling livestreams +
  // 3 latest VI news items to render at the bottom, adding ~400 chars
  // and 8 internal links per page.
  const [relatedLiveRes, relatedNewsRes] = await Promise.all([
    supabase.from("public_livestreams")
      .select("id, title, status")
      .neq("id", id)
      .in("status", ["live", "scheduled", "ended"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.from("news_items")
      .select("slug, title")
      .eq("language", "vi")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(3),
  ]);
  const relatedLiveItems = ((relatedLiveRes.data || []) as Array<{ id: string; title: string; status: string }>)
    .map((l) => `<li><a href="${siteUrl}/live/${l.id}">${escapeHtml(l.title)}</a></li>`)
    .join("");
  const relatedNewsItems = ((relatedNewsRes.data || []) as Array<{ slug: string; title: string }>)
    .map((n) => `<li><a href="${siteUrl}/vi/news/${escapeHtml(n.slug)}">${escapeHtml(n.title)}</a></li>`)
    .join("");
  const liveRelatedHtml =
    (relatedLiveItems ? `<section><h2>Livestream khác</h2><ul>${relatedLiveItems}</ul></section>` : "") +
    (relatedNewsItems ? `<section><h2>Tin pickleball mới nhất</h2><ul>${relatedNewsItems}</ul></section>` : "");

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: pageUrl,
    siteUrl,
    lang: "vi",
    image: absImage(ls.thumbnail_url, siteUrl),
    type: videoUrl ? "video.other" : "website",
    // SEO-1.2 (2026-05-28) — add reciprocal hreflang for the /live/:id
    // route. Single-canonical (same URL serves both locales via SPA
    // toggle) — pattern documented in renderProfile.
    extraMeta: `${robotsMeta}\n${ogVideoMeta}\n${singleCanonicalHreflang(pageUrl, "vi")}`,
    jsonLd: { "@context": "https://schema.org", "@graph": [videoObjectSchema, sportsEventSchema] },
    bodyContent: `${bc}
<dl>
${orgName ? `<dt>Tổ chức</dt><dd>${orgSlug ? `<a href="${siteUrl}/org/${escapeHtml(orgSlug)}">${escapeHtml(orgName)}</a>` : escapeHtml(orgName)}</dd>` : ""}
${tournName ? `<dt>Giải đấu</dt><dd>${escapeHtml(tournName)}</dd>` : ""}
<dt>Trạng thái</dt><dd>${statusLabel}</dd>
${dateDisplay ? `<dt>Thời gian</dt><dd>${dateDisplay}</dd>` : ""}
</dl>
${ls.description ? `<p>${escapeHtml(ls.description)}</p>` : ""}
<p>Xem trực tiếp ${escapeHtml(ls.title)} trên ThePickleHub.</p>
<nav><h2>Xem thêm</h2><ul>
${orgSlug ? `<li><a href="${siteUrl}/org/${escapeHtml(orgSlug)}">${escapeHtml(orgName)} - Tất cả livestream</a></li>` : ""}
<li><a href="${siteUrl}/live">Tất cả livestream pickleball</a></li>
<li><a href="${siteUrl}/videos">Video pickleball</a></li>
<li><a href="${siteUrl}/tournaments">Giải đấu pickleball</a></li>
</ul></nav>${liveRelatedHtml}`,
  }));
}

// ─── Video ────────────────────────────────��───────────────

export async function renderVideo(supabase: SupabaseClient, id: string, siteUrl: string): Promise<Response> {
  const { data: v } = await supabase
    .from("videos")
    .select("id, title, description, thumbnail_url, duration_seconds, published_at, created_at, organization_id, tournament_id, mux_playback_id")
    .eq("id", id)
    .single();

  if (!v) return render404(`/watch/${id}`, siteUrl);

  const [, tournRes] = await Promise.all([
    v.organization_id ? supabase.from("organizations").select("name").eq("id", v.organization_id).single() : Promise.resolve({ data: null }),
    v.tournament_id ? supabase.from("tournaments").select("name").eq("id", v.tournament_id).single() : Promise.resolve({ data: null }),
  ]);
  const tournName = tournRes.data?.name || "";

  const rawTitle = tournName ? `${tournName} – ${v.title}` : v.title;
  const title = buildTitle(rawTitle, " | Pickleball Video");
  const desc = buildMetaDescription(v.description, { type: "video", title: v.title });
  const videoUrl = v.mux_playback_id ? `https://stream.mux.com/${v.mux_playback_id}.m3u8` : null;

  let durationIso = "";
  if (v.duration_seconds && v.duration_seconds > 0) {
    const h = Math.floor(v.duration_seconds / 3600);
    const m = Math.floor((v.duration_seconds % 3600) / 60);
    const s = Math.floor(v.duration_seconds % 60);
    durationIso = "PT" + (h > 0 ? `${h}H` : "") + (m > 0 ? `${m}M` : "") + `${s}S`;
  }

  const crumbs = [
    { label: "Trang chủ", href: siteUrl },
    { label: "Video", href: `${siteUrl}/videos` },
    { label: v.title },
  ];
  const bc = breadcrumb(crumbs);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/watch/${id}`,
    siteUrl,
    lang: "vi",
    image: absImage(v.thumbnail_url, siteUrl),
    type: videoUrl ? "video.other" : "website",
    extraMeta: singleCanonicalHreflang(`${siteUrl}/watch/${id}`, "vi"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "VideoObject",
          name: v.title,
          description: desc,
          thumbnailUrl: absImage(v.thumbnail_url, siteUrl),
          uploadDate: v.published_at || v.created_at,
          ...(videoUrl ? { contentUrl: videoUrl } : {}),
          ...(durationIso ? { duration: durationIso } : {}),
        },
        buildBreadcrumbJsonLd(crumbs),
      ],
    },
    bodyContent: `${bc}<section><h2>Xem thêm</h2><ul><li><a href="${siteUrl}/videos">Xem thêm video pickleball</a></li><li><a href="${siteUrl}/live">Xem livestream trực tiếp</a></li></ul></section>`,
  }));
}

export async function renderVideos(supabase: SupabaseClient, siteUrl: string, rawPath = "/videos", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: videos } = await supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(20);
  const items = (videos || []).map((v) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const listItems = (videos || []).map((v) => ({
    url: `${siteUrl}/watch/${v.id}`,
    name: v.title,
  }));

  const title = lang === "en"
    ? "Pickleball Videos & Match Replays | ThePickleHub"
    : "Video Pickleball | ThePickleHub";
  const description = lang === "en"
    ? "Pickleball video library: tournament highlights, full match replays, technique tutorials, and strategy guides from PPA Tour Asia and Vietnamese events."
    : "Xem video pickleball chất lượng cao: highlight giải đấu, replay trận đấu, hướng dẫn kỹ thuật và chiến thuật chơi pickleball trên ThePickleHub.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/videos`, `${siteUrl}/vi/videos`),
    jsonLd: buildListJsonLd(title, listItems),
    bodyContent: items ? `<h2>${lang === "en" ? "Videos" : "Video"}</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

// SEO-2.1 + SEO-2.2 (2026-05-28) — locale-aware copy + ItemList JSON-LD
// + live/upcoming streams in the body so bots have something to crawl
// beyond the noindex shell. Promoted to async; middleware updated to
// `await renderLivestreamList(supabase, ...)`.
export async function renderLivestreamList(
  supabase: SupabaseClient,
  siteUrl: string,
  rawPath: string,
  lang: Lang,
): Promise<Response> {
  const { data: streams } = await supabase
    .from("public_livestreams")
    .select("id, title, status")
    .in("status", ["live", "scheduled"])
    .order("created_at", { ascending: false })
    .limit(20);

  const items = (streams ?? [])
    .map((s: { id: string; title: string; status: string }) =>
      `<li><a href="${siteUrl}${lang === "vi" ? "/vi" : ""}/live/${escapeHtml(s.id)}">${escapeHtml(s.title)}</a> (${escapeHtml(s.status)})</li>`,
    )
    .join("");
  const listItems = (streams ?? []).map((s: { id: string; title: string }) => ({
    url: `${siteUrl}${lang === "vi" ? "/vi" : ""}/live/${s.id}`,
    name: s.title,
  }));

  const title = lang === "en"
    ? "Pickleball Live Streams | ThePickleHub"
    : "Livestream Pickleball | ThePickleHub";
  const description = lang === "en"
    ? "Watch live pickleball streams from Vietnam and PPA Tour Asia free on ThePickleHub. Live tournaments and matches — no signup required."
    : "Xem livestream pickleball trực tiếp tại Việt Nam. Các giải đấu, trận đấu đang phát sóng trực tuyến miễn phí trên ThePickleHub. Không cần đăng ký.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/live`, `${siteUrl}/vi/live`),
    jsonLd: buildListJsonLd(title, listItems),
    bodyContent: items
      ? `<h2>${lang === "en" ? "Now streaming" : "Đang phát sóng"}</h2><ul>${items}</ul>`
      : `<p>${lang === "en" ? "No live streams right now. Check back soon." : "Hiện chưa có livestream. Quay lại sau."}</p>`,
    lang,
  }));
}
