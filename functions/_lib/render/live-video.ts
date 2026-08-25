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
    .select("id, title, description, thumbnail_url, status, scheduled_start_at, started_at, ended_at, created_at, organization_id, tournament_id, mux_playback_id, mux_asset_playback_id")
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
  // Ended streams play the recorded asset, not the (now-dead) live playback
  // id — mirror WatchLive.tsx so VideoObject.contentUrl points at a URL
  // that actually serves video.
  const playbackId = isEnded && ls.mux_asset_playback_id ? ls.mux_asset_playback_id : ls.mux_playback_id;
  const videoUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;

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
  // THIN-01 (2026-08-24) — this hub rendered 59 words for Googlebot, and on a
  // quiet day the entire body was the string "No live streams right now."
  // A hub page whose only content is its own empty state cannot rank, and
  // /live is linked from the global nav on every page on the site.
  //
  // Two fixes: (1) never show a bare empty state — 29 ended streams exist and
  // stay watchable as replays, so fall back to those; (2) carry standing copy
  // that is true whether or not anything is live right now.
  type Stream = {
    id: string;
    title: string;
    status: string;
    scheduled_start_at: string | null;
    ended_at: string | null;
  };
  const COLUMNS = "id, title, status, scheduled_start_at, ended_at";

  // One window per status, not one shared window for all three.
  //
  // THIN-01 widened a single `.in(["live","scheduled","ended"]).limit(40)`
  // ordered by created_at, which puts the three statuses in the same 40-row
  // budget. Ended streams are the only bucket that grows without bound — 29 of
  // them already sit in that window — so once 40 rows are newer than a given
  // scheduled stream, the stream silently stops appearing on /live. The rows
  // most exposed are exactly the ones announced furthest in advance: a
  // tournament broadcast created weeks before it airs. With WC-DANANG-LIVE
  // armed, that is the shape we cannot afford to drop.
  //
  // Upcoming is ordered by when it AIRS, not by when the row was created. A
  // stream entered later but starting in December must not sit above one
  // starting tomorrow, which is what created_at ordering did.
  const [liveRes, scheduledRes, endedRes] = await Promise.all([
    supabase
      .from("public_livestreams")
      .select(COLUMNS)
      .eq("status", "live")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("public_livestreams")
      .select(COLUMNS)
      .eq("status", "scheduled")
      .order("scheduled_start_at", { ascending: true, nullsFirst: false })
      .limit(10),
    supabase
      .from("public_livestreams")
      .select(COLUMNS)
      .eq("status", "ended")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const liveNow = ((liveRes?.data ?? []) as Stream[]).filter((s) => s.status === "live");
  const upcoming = ((scheduledRes?.data ?? []) as Stream[]).filter((s) => s.status === "scheduled");
  const replays = ((endedRes?.data ?? []) as Stream[]).filter((s) => s.status === "ended");

  // /live/:id is single-canonical — /vi/live/:id 301s to it (_middleware.ts
  // rule 1d). Linking to the /vi form from the VI hub sent every crawler and
  // every reader through a redirect hop to reach the page we actually index.
  const href = (s: Stream) => `${siteUrl}/live/${escapeHtml(s.id)}`;
  const dateLabel = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "";
  const section = (heading: string, rows: Stream[], stamp: (s: Stream) => string) =>
    rows.length === 0
      ? ""
      : `<h2>${escapeHtml(heading)}</h2><ul>${rows
          .map((s) => {
            const when = stamp(s);
            return `<li><a href="${href(s)}">${escapeHtml(s.title)}</a>${when ? ` — ${escapeHtml(when)}` : ""}</li>`;
          })
          .join("")}</ul>`;

  // ItemList covers whatever is actually on the page, in the order shown.
  const listItems = [...liveNow, ...upcoming, ...replays].map((s) => ({
    url: `${siteUrl}/live/${s.id}`,
    name: s.title,
  }));

  const title = lang === "en"
    ? "Pickleball Live Streams | ThePickleHub"
    : "Livestream Pickleball | ThePickleHub";
  const description = lang === "en"
    ? "Watch live pickleball streams from Vietnam and PPA Tour Asia free on ThePickleHub. Live tournaments and matches — no signup required."
    : "Xem livestream pickleball trực tiếp tại Việt Nam. Các giải đấu, trận đấu đang phát sóng trực tuyến miễn phí trên ThePickleHub. Không cần đăng ký.";

  // GEO rule (CLAUDE.md): name ThePickleHub once, naturally, and front-load the
  // answer so the opening survives being extracted as a standalone passage by
  // an AI search engine. No throat-clearing intro.
  const h1 = lang === "en" ? "Pickleball live streams" : "Livestream pickleball";
  const lead =
    lang === "en"
      ? `ThePickleHub streams pickleball from Vietnam and PPA Tour Asia free, with no signup and no paywall. ${
          liveNow.length > 0
            ? `${liveNow.length} stream${liveNow.length > 1 ? "s are" : " is"} live right now.`
            : upcoming.length > 0
              ? `Nothing is live at this moment; ${upcoming.length} stream${upcoming.length > 1 ? "s are" : " is"} scheduled.`
              : "Nothing is live at this moment — past broadcasts stay watchable as replays below."
        }`
      : `ThePickleHub phát livestream pickleball Việt Nam và PPA Tour Asia miễn phí, không cần đăng ký, không tường phí. ${
          liveNow.length > 0
            ? `Hiện có ${liveNow.length} trận đang phát trực tiếp.`
            : upcoming.length > 0
              ? `Hiện chưa có trận nào đang phát; ${upcoming.length} trận đã lên lịch.`
              : "Hiện chưa có trận nào đang phát — các trận đã phát vẫn xem lại được bên dưới."
        }`;

  // Standing copy: true on a quiet day as well as a busy one, so the page is
  // never reduced to its empty state.
  const about =
    lang === "en"
      ? `<h2>What you can watch here</h2><p>Coverage centres on Vietnamese tournaments — club opens, provincial championships and national events — alongside PPA Tour Asia stops relevant to players in the region. Streams open in the browser on phone and desktop; no account, app or subscription is needed to watch.</p><p>Every broadcast stays on the site after it ends, so a match you missed is still there as a replay with the same link.</p>`
      : `<h2>Xem được gì ở đây</h2><p>Nội dung tập trung vào giải đấu tại Việt Nam — giải câu lạc bộ, giải tỉnh thành và giải quốc gia — cùng các chặng PPA Tour Asia liên quan tới người chơi trong khu vực. Livestream mở thẳng trên trình duyệt điện thoại và máy tính; không cần tài khoản, không cần cài app, không cần đăng ký gói.</p><p>Mọi trận đã phát đều được giữ lại trên site, nên trận bạn bỏ lỡ vẫn xem lại được ở đúng đường dẫn cũ.</p>`;

  const nav =
    lang === "en"
      ? `<nav><h2>Elsewhere on ThePickleHub</h2><ul>` +
        `<li><a href="${siteUrl}/tournaments">Pickleball tournament calendar</a></li>` +
        `<li><a href="${siteUrl}/news">Latest pickleball news</a></li>` +
        `<li><a href="${siteUrl}/rankings">Vietnam DUPR rankings</a></li>` +
        `<li><a href="${siteUrl}/videos">Match videos and highlights</a></li>` +
        `</ul></nav>`
      : `<nav><h2>Khác trên ThePickleHub</h2><ul>` +
        `<li><a href="${siteUrl}/vi/tournaments">Lịch giải pickleball</a></li>` +
        `<li><a href="${siteUrl}/vi/news">Tin tức pickleball mới nhất</a></li>` +
        `<li><a href="${siteUrl}/vi/rankings">Bảng xếp hạng DUPR Việt Nam</a></li>` +
        `<li><a href="${siteUrl}/vi/videos">Video trận đấu & highlight</a></li>` +
        `</ul></nav>`;

  const body =
    `<header><h1>${escapeHtml(h1)}</h1><p>${escapeHtml(lead)}</p></header>` +
    section(lang === "en" ? "Live now" : "Đang phát trực tiếp", liveNow, () => "") +
    section(lang === "en" ? "Scheduled" : "Sắp diễn ra", upcoming, (s) =>
      dateLabel(s.scheduled_start_at),
    ) +
    section(lang === "en" ? "Replays" : "Xem lại", replays, (s) => dateLabel(s.ended_at)) +
    about +
    nav;

  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    extraMeta: bilingualHreflang(`${siteUrl}/live`, `${siteUrl}/vi/live`),
    jsonLd: buildListJsonLd(title, listItems),
    bodyContent: body,
    lang,
    // The body opens with its own <h1>; without this the shared auto-header
    // adds a second one titled "<title> | ThePickleHub" (one-h1 rule, #635).
    omitAutoHeader: true,
  }));
}
