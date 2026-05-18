/**
 * SSR render functions for bot prerendering.
 * Ported from supabase/functions/prerender/index.ts
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  escapeJsonLd,
  buildTitle,
  buildMetaDescription,
  absImage,
  normalizeImagesInHtml,
  breadcrumb,
  relatedBlogLinks,
  relatedToolLinks,
  detectLang,
  type Lang,
  DEFAULT_OG_IMAGE,
} from "../utils";
import {
  buildPersonJsonLd,
  buildProfileFallbackDescription,
  pickProfileMetaDescription,
  buildTimelineFeedJsonLd,
  feedTeamLabel,
  feedScoreCompact,
  type FeedSeoParticipant,
  type TimelineRowForSeo,
} from "../seo-helpers";
import {
  buildMatchDescription,
  buildMatchSchema,
  roundLabel,
} from "./match-seo";

// ─── Home ───────────────────────────���─────────────────────

export async function renderHome(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  const [liveRes, videoRes, viBlogRes] = await Promise.all([
    supabase.from("public_livestreams").select("id, title, status").in("status", ["live", "scheduled"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(3),
  ]);

  const liveItems = (liveRes.data || []).map((l: any) => `<li><a href="${siteUrl}/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v: any) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const viBlogItems = (viBlogRes.data || []).map((b: any) => `<li><a href="${siteUrl}/vi/blog/${b.slug}" hreflang="vi">${escapeHtml(b.title)}</a></li>`).join("");

  const viBlogSection = viBlogItems
    ? `<h2>Pickleball in Vietnam</h2><p>Vietnamese pickleball content from our local team:</p><ul>${viBlogItems}</ul><p><a href="${siteUrl}/vi" hreflang="vi">Visit Vietnamese site</a></p>`
    : "";

  const title = "ThePickleHub – Pickleball Asia: Live, Brackets & News";
  const description = "The only bilingual pickleball platform built for Asia. Tournaments, livestream, and news in Vietnamese and English — free for organizers and players.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: siteUrl,
    siteUrl,
    lang: "en",
    // PR73 Phase 2D (audit I-12) — canonical (set via `url: siteUrl` above)
    // has no trailing slash, but the hreflang en + x-default previously
    // pointed at `${siteUrl}/` (with slash). Mismatched canonical and
    // hreflang values are a Google "invalid signal" — fixed by dropping
    // the trailing slash from hreflang en + x-default so all three refer
    // to the same URL string.
    extraMeta: `<link rel="alternate" hreflang="en" href="${siteUrl}"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}"/>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}#org`,
          name: "ThePickleHub",
          url: siteUrl,
          logo: DEFAULT_OG_IMAGE,
          description: "Editorial coverage of professional pickleball — PPA, APP, MLP, European Open, Asia Pacific Series. Bilingual Vietnamese-English. Headquartered in Ho Chi Minh City.",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Ho Chi Minh City",
            addressCountry: "VN",
          },
          sameAs: [
            "https://www.facebook.com/ThePickleHub",
            "https://www.instagram.com/thepicklehub",
            "https://www.youtube.com/@thepicklehub",
          ],
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}#website`,
          url: siteUrl,
          name: "ThePickleHub",
          publisher: { "@id": `${siteUrl}#org` },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${siteUrl}/search?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    },
    bodyContent: `
      <p>ThePickleHub — editorial coverage of professional pickleball, headquartered in Ho Chi Minh City and reporting from PPA, APP, MLP, European Open, and Asia Pacific Series venues worldwide.</p>
      <ul>
        <li><a href="${siteUrl}/live">Live courts</a> — Watch matches streaming right now</li>
        <li><a href="${siteUrl}/tournaments">Tournaments</a> — Schedules, brackets, results across PPA Asia and beyond</li>
        <li><a href="${siteUrl}/social">Community events</a> — Open pickleball events you can register for by phone</li>
        <li><a href="${siteUrl}/clubs">Clubs</a> — Pickleball clubs across Vietnam with schedules + events</li>
        <li><a href="${siteUrl}/feed">Match feed</a> — Latest community matches, scores, and DUPR ratings</li>
        <li><a href="${siteUrl}/tools">Bracket Lab</a> — Free tournament tools (round robin, single/double elimination, MLP)</li>
        <li><a href="${siteUrl}/rankings">Rankings</a> — Player rankings (placeholder, coming soon)</li>
        <li><a href="${siteUrl}/blog">Stories</a> — Match reports and longform coverage</li>
        <li><a href="${siteUrl}/news">News</a> — Daily pickleball updates</li>
        <li><a href="${siteUrl}/videos">Videos</a> — Match highlights (Courtside)</li>
        <li><a href="${siteUrl}/forum">Forum</a> — Community discussions</li>
      </ul>
      ${liveItems ? `<h2>Currently streaming</h2><ul>${liveItems}</ul>` : ""}
      ${videoItems ? `<h2>Latest videos</h2><ul>${videoItems}</ul>` : ""}
      ${viBlogSection}
    `,
  }));
}

export async function renderHomeVi(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  const [liveRes, videoRes, blogRes] = await Promise.all([
    supabase.from("public_livestreams").select("id, title, status").in("status", ["live", "scheduled"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(6),
  ]);

  const liveItems = (liveRes.data || []).map((l: any) => `<li><a href="${siteUrl}/vi/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v: any) => `<li><a href="${siteUrl}/vi/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const blogItems = (blogRes.data || []).map((b: any) => `<li><a href="${siteUrl}/vi/blog/${b.slug}"><h3>${escapeHtml(b.title)}</h3><p>${escapeHtml(b.excerpt || "")}</p></a></li>`).join("");

  const blogSection = blogItems ? `<h2>Bài viết mới nhất</h2><ul>${blogItems}</ul><p><a href="${siteUrl}/vi/blog">Xem tất cả bài viết</a></p>` : "";

  return htmlResponse(buildHtml({
    title: "ThePickleHub – Pickleball Châu Á: Live & Giải đấu",
    description: "Nền tảng pickleball song ngữ duy nhất xây cho châu Á. Giải đấu, livestream và tin tức bằng tiếng Việt và tiếng Anh — miễn phí cho BTC và người chơi.",
    url: `${siteUrl}/vi`,
    siteUrl,
    lang: "vi",
    // PR73 Phase 2D (audit I-12) — see renderHome above. Same trailing-
    // slash mismatch (canonical without slash vs hreflang en/x-default
    // with slash). Aligned to the no-trailing-slash convention.
    extraMeta: `<link rel="alternate" hreflang="vi" href="${siteUrl}/vi"/>\n<link rel="alternate" hreflang="en" href="${siteUrl}"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}"/>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}#org`,
          name: "ThePickleHub",
          url: siteUrl,
          logo: DEFAULT_OG_IMAGE,
          description: "Đưa tin pickleball chuyên nghiệp toàn cầu — PPA, APP, MLP, European Open, Asia Pacific Series. Song ngữ Việt-Anh. Trụ sở tại TP.HCM.",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Ho Chi Minh City",
            addressCountry: "VN",
          },
          sameAs: [
            "https://www.facebook.com/ThePickleHub",
            "https://www.instagram.com/thepicklehub",
            "https://www.youtube.com/@thepicklehub",
          ],
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}#website`,
          url: siteUrl,
          name: "ThePickleHub",
          publisher: { "@id": `${siteUrl}#org` },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${siteUrl}/search?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    },
    bodyContent: `
      <p>ThePickleHub — đưa tin pickleball chuyên nghiệp toàn cầu, trụ sở tại TP.HCM, tường thuật từ PPA, APP, MLP, European Open và Asia Pacific Series.</p>
      <ul>
        <li><a href="${siteUrl}/vi/live">Sân trực tiếp</a> — Xem trận đấu đang diễn ra</li>
        <li><a href="${siteUrl}/vi/tournaments">Giải đấu</a> — Lịch, bracket, kết quả</li>
        <li><a href="${siteUrl}/social">Sự kiện cộng đồng</a> — Đăng ký sự kiện pickleball mở bằng số điện thoại</li>
        <li><a href="${siteUrl}/clubs">Câu lạc bộ</a> — CLB pickleball khắp Việt Nam, lịch sinh hoạt và sự kiện</li>
        <li><a href="${siteUrl}/vi/feed">Bảng tin trận đấu</a> — Trận đấu cộng đồng mới nhất + rating DUPR</li>
        <li><a href="${siteUrl}/vi/tools">Bracket Lab</a> — Công cụ tổ chức miễn phí</li>
        <li><a href="${siteUrl}/vi/rankings">Bảng xếp hạng</a> — Sắp ra mắt</li>
        <li><a href="${siteUrl}/vi/blog">Bài viết</a> — Tường thuật và bài chuyên sâu</li>
        <li><a href="${siteUrl}/vi/news">Tin tức</a> — Cập nhật pickleball hàng ngày</li>
        <li><a href="${siteUrl}/vi/videos">Video</a> — Highlights trận đấu</li>
        <li><a href="${siteUrl}/vi/forum">Diễn đàn</a> — Thảo luận cộng đồng</li>
      </ul>
      ${blogSection}
      ${liveItems ? `<h2>Livestream</h2><ul>${liveItems}</ul>` : ""}
      ${videoItems ? `<h2>Video mới</h2><ul>${videoItems}</ul>` : ""}
    `,
  }));
}

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
    { label: "Livestream", href: `${siteUrl}/livestream` },
    { label: ls.title },
  ]);

  const statusLabel = isLive ? "Đang phát trực tiếp" : isEnded ? "Replay" : "Sắp diễn ra";
  const dateDisplay = ls.scheduled_start_at
    ? new Date(ls.scheduled_start_at).toLocaleDateString("vi-VN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: pageUrl,
    siteUrl,
    image: absImage(ls.thumbnail_url, siteUrl),
    type: videoUrl ? "video.other" : "website",
    extraMeta: `${robotsMeta}\n${ogVideoMeta}`,
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
<li><a href="${siteUrl}/livestream">Tất cả livestream pickleball</a></li>
<li><a href="${siteUrl}/videos">Video pickleball</a></li>
<li><a href="${siteUrl}/tournaments">Giải đấu pickleball</a></li>
</ul></nav>`,
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

  const [orgRes, tournRes] = await Promise.all([
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

  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Video", href: `${siteUrl}/videos` },
    { label: v.title },
  ]);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/watch/${id}`,
    siteUrl,
    image: absImage(v.thumbnail_url, siteUrl),
    type: videoUrl ? "video.other" : "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: v.title,
      description: desc,
      thumbnailUrl: absImage(v.thumbnail_url, siteUrl),
      uploadDate: v.published_at || v.created_at,
      ...(videoUrl ? { contentUrl: videoUrl } : {}),
      ...(durationIso ? { duration: durationIso } : {}),
    },
    bodyContent: `${bc}<section><h2>Xem thêm</h2><ul><li><a href="${siteUrl}/videos">Xem thêm video pickleball</a></li><li><a href="${siteUrl}/livestream">Xem livestream trực tiếp</a></li></ul></section>`,
  }));
}

// ─── Tournament ─────────────────────────────────��─────────

export async function renderTournamentDetail(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name, description, status, start_date, end_date, slug")
    .eq("slug", slug)
    .single();

  if (!t) return render404(`/tournament/${slug}`, siteUrl);

  const statusText = t.status === "ongoing" ? "Đang diễn ra" : t.status === "upcoming" ? "Sắp diễn ra" : "Đã kết thúc";
  const title = buildTitle(t.name, " | Pickleball Tournament");
  const desc = buildMetaDescription(t.description, { type: "default", title: t.name });

  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Giải đấu", href: `${siteUrl}/tournaments` },
    { label: t.name },
  ]);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/tournament/${t.slug}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: t.name,
      description: desc,
      url: `${siteUrl}/tournament/${t.slug}`,
      sport: "Pickleball",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      location: { "@type": "VirtualLocation", url: `${siteUrl}/tournament/${t.slug}` },
      organizer: { "@type": "Organization", name: "ThePickleHub", url: siteUrl },
      ...(t.start_date ? { startDate: t.start_date } : {}),
      ...(t.end_date ? { endDate: t.end_date } : {}),
    },
    bodyContent: `${bc}<p>${statusText}</p>`,
  }));
}

export async function renderTournaments(supabase: SupabaseClient, siteUrl: string, rawPath = "/tournaments", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: tournaments } = await supabase.from("tournaments").select("id, name, slug, status").in("status", ["ongoing", "upcoming"]).order("start_date", { ascending: false }).limit(20);
  const items = (tournaments || []).map((t: any) => `<li><a href="${siteUrl}/tournament/${t.slug}">${escapeHtml(t.name)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Giải đấu Pickleball | ThePickleHub",
    description: "Danh sách các giải đấu pickleball đang diễn ra và sắp tới tại Việt Nam. Xem lịch thi đấu, bảng đấu, kết quả trực tiếp và đăng ký tham gia giải pickleball.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Giải đấu</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

// ─── Videos / News / Forum list pages ─────────────────────

export async function renderVideos(supabase: SupabaseClient, siteUrl: string, rawPath = "/videos", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: videos } = await supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(20);
  const items = (videos || []).map((v: any) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Video Pickleball | ThePickleHub",
    description: "Xem video pickleball chất lượng cao: highlight giải đấu, replay trận đấu, hướng dẫn kỹ thuật và chiến thuật chơi pickleball trên ThePickleHub.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Video</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

export async function renderNews(supabase: SupabaseClient, siteUrl: string, rawPath = "/news", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: news } = await supabase.from("news_items").select("id, title, summary").eq("status", "published").order("published_at", { ascending: false }).limit(20);
  const items = (news || []).map((n: any) => `<li>${escapeHtml(n.title)}: ${escapeHtml(n.summary?.slice(0, 80) || "")}</li>`).join("");

  return htmlResponse(buildHtml({
    title: "Tin tức Pickleball | ThePickleHub",
    description: "Tin pickleball mới nhất Việt Nam và thế giới: PPA Tour Asia, World Cup, sự kiện cộng đồng, phân tích chuyên sâu — ThePickleHub.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Tin tức</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

export async function renderForum(supabase: SupabaseClient, siteUrl: string, rawPath = "/forum", lang: "en" | "vi" = "en"): Promise<Response> {
  const { data: posts } = await supabase.from("forum_posts").select("id, title").eq("is_hidden", false).order("created_at", { ascending: false }).limit(20);
  const items = (posts || []).map((p: any) => `<li><a href="${siteUrl}/forum/post/${p.id}">${escapeHtml(p.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Diễn đàn Pickleball | ThePickleHub",
    description: "Diễn đàn pickleball Việt Nam lớn nhất - thảo luận kỹ thuật, review thiết bị, tìm sân chơi, kết nối VĐV. Tham gia cộng đồng pickleball ThePickleHub.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Bài viết mới</h2><ul>${items}</ul>` : "",
    lang,
  }));
}

export async function renderForumPost(supabase: SupabaseClient, postId: string, siteUrl: string): Promise<Response> {
  const { data: post } = await supabase.from("forum_posts").select("id, title, content").eq("id", postId).eq("is_hidden", false).single();

  if (!post) return render404(`/forum/post/${postId}`, siteUrl);

  const rawDesc = (post.content || "").replace(/<[^>]*>/g, "").slice(0, 200);
  const desc = buildMetaDescription(rawDesc, { type: "forum-post", title: post.title });
  const title = buildTitle(post.title, "");

  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Diễn đàn", href: `${siteUrl}/forum` },
    { label: post.title.length > 40 ? post.title.slice(0, 40) + "\u2026" : post.title },
  ]);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/forum/post/${postId}`,
    siteUrl,
    jsonLd: { "@context": "https://schema.org", "@type": "DiscussionForumPosting", headline: title, text: desc, url: `${siteUrl}/forum/post/${postId}` },
    bodyContent: `${bc}<section><h2>Xem thêm</h2><ul><li><a href="${siteUrl}/forum">Quay lại diễn đàn</a></li><li><a href="${siteUrl}/blog">Đọc blog pickleball</a></li></ul></section>`,
  }));
}

// ─── Organization ──────────────────────���──────────────────

export async function renderOrgDetail(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const { data: org } = await supabase.from("organizations").select("id, name, description, slug, logo_url").eq("slug", slug).single();

  if (!org) return render404(`/org/${slug}`, siteUrl);

  const title = buildTitle(org.name, " | Pickleball Creator");
  const desc = buildMetaDescription(org.description, { type: "default", title: org.name });

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/org/${org.slug}`,
    siteUrl,
    image: absImage(org.logo_url, siteUrl),
    jsonLd: { "@context": "https://schema.org", "@type": "Organization", name: org.name, url: `${siteUrl}/org/${org.slug}`, ...(org.logo_url ? { logo: absImage(org.logo_url, siteUrl) } : {}) },
  }));
}

// ─── Tool instance pages (noindex) ────────────────────────

export async function renderQuickTable(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  const { data: qt } = await supabase.from("quick_tables").select("id, name, format, player_count, status, share_id").eq("share_id", shareId).single();
  if (!qt) return render404(`/tools/quick-tables/${shareId}`, siteUrl);

  const title = buildTitle(qt.name, " | Bảng đấu Pickleball");
  const desc = `Bảng đấu ${qt.name} – ${qt.player_count} VĐV, ${qt.format}. Xem kết quả trực tiếp trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Quick Tables", href: `${siteUrl}/tools/quick-tables` }, { label: qt.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/quick-tables/${shareId}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("quick-tables", siteUrl)}` }));
}

export async function renderTeamMatch(supabase: SupabaseClient, id: string, siteUrl: string): Promise<Response> {
  const { data: tm } = await supabase.from("team_match_tournaments").select("id, name, status").eq("id", id).single();
  if (!tm) return render404(`/tools/team-match/${id}`, siteUrl);

  const title = buildTitle(tm.name, " | Team Match Pickleball");
  const desc = `Giải đấu đội ${tm.name}. Xem lineup, kết quả và bảng xếp hạng trực tiếp trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Team Match", href: `${siteUrl}/tools/team-match` }, { label: tm.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/team-match/${id}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("team-match", siteUrl)}` }));
}

export async function renderDoublesElimination(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  const { data: de } = await supabase.from("doubles_elimination_tournaments").select("id, name, team_count, status, share_id").eq("share_id", shareId).single();
  if (!de) return render404(`/tools/doubles-elimination/${shareId}`, siteUrl);

  const title = buildTitle(de.name, " | Doubles Elimination");
  const desc = `Giải đấu loại trực tiếp ${de.name} – ${de.team_count} đội. Xem bracket và kết quả trực tiếp trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Doubles Elimination", href: `${siteUrl}/tools/doubles-elimination` }, { label: de.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/doubles-elimination/${shareId}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("doubles-elimination", siteUrl)}` }));
}

export async function renderFlexTournament(supabase: SupabaseClient, shareId: string, siteUrl: string): Promise<Response> {
  const { data: ft } = await supabase.from("flex_tournaments").select("id, name, status, share_id").eq("share_id", shareId).single();
  if (!ft) return render404(`/tools/flex-tournament/${shareId}`, siteUrl);

  const title = buildTitle(ft.name, " | Flex Tournament");
  const desc = `Giải đấu ${ft.name}. Tạo nhóm, xếp lịch thi đấu linh hoạt trên ThePickleHub.`.slice(0, 160);
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Công cụ", href: `${siteUrl}/tools` }, { label: "Flex Tournament", href: `${siteUrl}/tools/flex-tournament` }, { label: ft.name }]);

  return htmlResponse(buildHtml({ title, description: desc, url: `${siteUrl}/tools/flex-tournament/${shareId}`, siteUrl, extraMeta: `<meta name="robots" content="noindex, follow"/>`, bodyContent: `${bc}${relatedToolLinks("flex-tournament", siteUrl)}` }));
}

// ─── Tools hub ─────────────────────────────���──────────────

export function renderTools(siteUrl: string, rawPath = "/tools", lang: "en" | "vi" = "en"): Response {
  return htmlResponse(buildHtml({
    title: "Free Pickleball Tournament Tools | ThePickleHub",
    description: "Free pickleball tournament bracket generator, round robin scheduler, MLP team match manager, and doubles elimination tools. No signup required.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebApplication",
          "@id": `${siteUrl}/tools#app`,
          name: "Bracket Lab — Free Pickleball Tournament Bracket Generator",
          url: `${siteUrl}/tools`,
          applicationCategory: "SportsApplication",
          operatingSystem: "Web",
          browserRequirements: "Requires JavaScript. Requires HTML5.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description: "Free pickleball tournament bracket generator — round robin, single and double elimination, MLP team match, flex format. Live scoring, shareable scoreboard, no signup.",
          // Note: aggregateRating intentionally omitted. Google Rich Results
          // requires verified user reviews; previous fake "4.8 / 120 reviews"
          // value (removed 2026-04-28) was non-compliant. Re-add only when we
          // ship real review collection.
        },
        {
          "@type": "ItemList",
          "@id": `${siteUrl}/tools#formats`,
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Quick Tables (Round Robin)", url: `${siteUrl}/tools/quick-tables` },
            { "@type": "ListItem", position: 2, name: "Doubles Elimination Bracket", url: `${siteUrl}/tools/doubles-elimination` },
            { "@type": "ListItem", position: 3, name: "Flex Tournament", url: `${siteUrl}/tools/flex-tournament` },
            { "@type": "ListItem", position: 4, name: "Team Match (MLP Format)", url: `${siteUrl}/tools/team-match` },
          ],
        },
      ],
    },
    // Bot-visible body — mirrors hero + pillar copy from src/pages/Tools.tsx
    // (lines 151-159 hero, 277-308 'What Bracket Lab actually does' section).
    // Without this, Googlebot only saw a 4-link skeleton and missed the
    // commercial keywords commit dd05713 added to the React source. Bing's
    // bot runs JS so it already saw the copy, but Googlebot is SSR-only.
    // Verified 2026-04-29 (curl `-A "Googlebot" /tools` was 5056 chars vs
    // 7361 for homepage). Keep this block in sync if Tools.tsx hero or
    // pillar prose changes — set a search alert for "free pickleball
    // tournament bracket generator".
    // H2 (not H1) here — buildHtml already emits <h1>${title}</h1>
    // at the top of <main>; a second H1 in bodyContent caused Ahrefs
    // Site Audit to flag /tools + /vi/tools as "Multiple H1 tags".
    bodyContent: `<h2>60 seconds to a pickleball bracket.</h2>
<p>A free pickleball tournament bracket generator — round robin, single and double elimination, MLP team match, and flex format. Live scoring on your phone, shareable scoreboard URL, printable bracket. No apps, no signup, no catch.</p>
<h2>Tournament formats</h2>
<ul>
  <li><a href="${siteUrl}/tools/quick-tables">Quick Tables – Round Robin &amp; Single Elimination</a></li>
  <li><a href="${siteUrl}/tools/team-match">Team Match – MLP Format</a></li>
  <li><a href="${siteUrl}/tools/doubles-elimination">Doubles Elimination Bracket</a></li>
  <li><a href="${siteUrl}/tools/flex-tournament">Flex Tournament</a></li>
</ul>
<h2>What Bracket Lab actually does</h2>
<p>Bracket Lab is a free pickleball tournament bracket generator built for clubs, weekend organizers, and pro events across Asia. Pick a format — round robin, single elimination, double elimination, MLP team match, or a fully custom flex tournament — and the tool builds the bracket, schedules matches, rotates courts, and tracks live scores. Share a single link with players and spectators; print a wall bracket if you need one.</p>
<p>No signup. No download. No 14-day trial that turns into a $99/month subscription. Built and maintained by <a href="${siteUrl}/blog/tournament-organizer-hub">ThePickleHub</a>, a bilingual Vietnamese-English platform reporting on PPA Tour Asia, MLP, and the regional pro circuit.</p>`,
    lang,
  }));
}

const TOOL_PAGE_META: Record<string, { title: string; description: string }> = {
  "quick-tables": {
    title: "Quick Tables – Round Robin & Single Elimination | ThePickleHub",
    description: "Free round-robin & single elimination bracket generator. Auto-scheduling, real-time scoring, shareable links. No signup — ThePickleHub.",
  },
  "team-match": {
    title: "Team Match – MLP Format Pickleball | ThePickleHub",
    description: "Free MLP-style team match pickleball bracket tool. Manage team lineups, track singles and doubles results, and generate instant standings. No signup required.",
  },
  "doubles-elimination": {
    title: "Doubles Elimination Bracket Generator | ThePickleHub",
    description: "Free doubles elimination bracket generator. Auto bracket draw, live scoring, shareable results. No signup — ThePickleHub.",
  },
  "flex-tournament": {
    title: "Flex Tournament Generator – Flexible Bracket | ThePickleHub",
    description: "Free flex-format tournament generator. Custom groups, flexible scheduling, live scoring. Perfect for clubs — ThePickleHub.",
  },
};

export function renderToolPage(toolSlug: string, siteUrl: string, rawPath: string, lang: "en" | "vi" = "en"): Response {
  const meta = TOOL_PAGE_META[toolSlug];
  if (!meta) return renderTools(siteUrl, rawPath, lang);

  return htmlResponse(buildHtml({
    title: meta.title,
    description: meta.description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: meta.title,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    bodyContent: `<h2>${meta.title}</h2><p>${meta.description}</p>
      <p><a href="${siteUrl}/tools">← All Tournament Tools</a></p>`,
  }));
}

// W1.1 (2026-05-15) — page-specific metadata for /tools/{tool}/new
// setup pages. Previously these were caught by the
// /^\/(?:vi\/)?tools\/[^/]+\/new(?:\/|$)/ noindex pattern in
// _middleware.ts so bots saw the renderNoindexShell — wasting all of
// their organic SEO potential. Now the bot path serves a real
// SoftwareApplication-typed shell with create-flow copy. Quick Tables
// has no /new variant (the list page IS the create flow), so only 3
// tools are mapped here.
const TOOL_NEW_PAGE_META: Record<string, {
  en: { title: string; description: string };
  vi: { title: string; description: string };
}> = {
  "doubles-elimination": {
    en: {
      title: "Create Doubles Elimination Bracket | ThePickleHub",
      description: "Free doubles elimination bracket generator. Auto bracket draw, live scoring, shareable results. No signup — ThePickleHub.",
    },
    vi: {
      title: "Tạo Doubles Elimination Bracket | ThePickleHub",
      description: "Công cụ miễn phí tạo bracket loại kép pickleball. Bốc thăm tự động, chấm điểm trực tiếp, chia sẻ kết quả qua link. Không cần đăng ký — ThePickleHub.",
    },
  },
  "flex-tournament": {
    en: {
      title: "Create Flex Tournament | ThePickleHub",
      description: "Free flexible tournament generator. Custom groups, brackets, and match formats. No signup — ThePickleHub.",
    },
    vi: {
      title: "Tạo Flex Tournament | ThePickleHub",
      description: "Công cụ miễn phí tạo giải đấu pickleball với cấu trúc tự do. Tự thiết kế nhóm, bracket, và thể thức trận đấu. Không cần đăng ký — ThePickleHub.",
    },
  },
  "team-match": {
    en: {
      title: "Create MLP Team Match | ThePickleHub",
      description: "Free MLP-style team match software. Lineup management, multi-round scoring, dreambreaker support. No signup — ThePickleHub.",
    },
    vi: {
      title: "Tạo Team Match (MLP) | ThePickleHub",
      description: "Phần mềm miễn phí cho đấu đồng đội theo format MLP. Quản lý lineup, chấm điểm nhiều ván, hỗ trợ dreambreaker. Không cần đăng ký — ThePickleHub.",
    },
  },
};

export function renderToolNewPage(toolSlug: string, siteUrl: string, rawPath: string, lang: "en" | "vi" = "en"): Response {
  const entry = TOOL_NEW_PAGE_META[toolSlug];
  // Unknown tool → fall back to noindex shell rather than a generic
  // shell. /tools/<unknown>/new is almost certainly a typo or stale
  // link; better to signal noindex than serve a thin 200.
  if (!entry) return renderNoindexShell(siteUrl, rawPath, lang);
  const meta = entry[lang] || entry.en;

  return htmlResponse(buildHtml({
    title: meta.title,
    description: meta.description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: meta.title,
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    },
    bodyContent: `<h2>${meta.title}</h2><p>${meta.description}</p>
      <p><a href="${siteUrl}/tools/${toolSlug}">← ${lang === "vi" ? "Quay lại" : "Back to"} ${toolSlug}</a></p>`,
  }));
}

// ─── Blog ─────────────────────��───────────────────────────

// Prerender metadata for bot-rendered EN blog posts. MUST stay in sync with
// src/content/blog/posts/*.ts + src/content/blog/metadata.ts — if a slug is
// missing here, Googlebot/Bingbot get a 404 even though the React app renders
// fine for humans, and the URL cannot be indexed (verified 2026-04-23 with
// the world-cup-pickleball-2026-da-nang post).
const BLOG_POST_META: Record<string, {
  title: string;
  description: string;
  /** PR79 Phase 2G — datePublished + image used by the BlogPosting
   *  JSON-LD so the EN side reaches schema parity with VI (which
   *  drives the fields from vi_blog_posts.published_at +
   *  cover_image_url). When a new post lands, copy the
   *  `publishedDate` + `heroImage.src` from
   *  src/content/blog/posts/<slug>.ts. Posts with empty image
   *  fall back to DEFAULT_OG_IMAGE in the renderer. */
  datePublished?: string;
  image?: string;
}> = {
  "professional-pickleball-tours-guide-2026": { title: "Pro Pickleball Tours 2026 | PPA vs MLP vs APP vs PPA Asia Compared", description: "Complete 2026 guide to professional pickleball tours — PPA Tour, MLP, PPA Tour Asia, APP — schedules, prize money, formats, top players, and how to watch from Asia.", datePublished: "2026-05-18", image: "/images/blog/professional-pickleball-tours-guide-2026-hero.webp" },
  "dupr-algorithm-explained-performance-vs-expectation": { title: "DUPR Algorithm Explained 2025: Why You Lose Points After Winning | Part 2 of 3", description: "DUPR's July 2025 algorithm rewrite explained. Why you can win a match and still lose rating points, or lose a match and gain them. Match weights, exclusion rules, reliability score — Part 2 of 3.", datePublished: "2026-05-14", image: "/images/blog/dupr-algorithm-performance-vs-expectation-hero.webp" },
  "tama-shimabukuro-ppa-atlanta-final-15-year-old": { title: "Tama Shimabukuro Reaches PPA Atlanta Final at 15 | Beats Hunter Johnson & Staksrud", description: "15-year-old Tama Shimabukuro just beat world #1 Hunter Johnson and #2 Federico Staksrud at PPA Veolia Atlanta Championships to reach the final. His self-taught Hawaii origin story.", datePublished: "2026-05-11", image: "/images/blog/tama-shimabukuro-atlanta-hero.webp" },
  "what-is-dupr-pickleball-rating-system": { title: "What Is DUPR? Pickleball Rating System Explained | Part 1 of 3 Series", description: "DUPR explained: the global pickleball rating system used by PPA Tour, MLP, USA Pickleball, and Pickleball World Cup. How it works, who runs it, and why Vietnamese players need it.", datePublished: "2026-05-11", image: "/images/blog/dupr-pickleball-rating-hero.webp" },
  "dupr-vietnam-partnership-ta-pickleball-thepicklehub": { title: "DUPR Vietnam Partnership Announced | TA Pickleball x ThePickleHub First Step", description: "DUPR, TA Pickleball, and ThePickleHub have signed a preliminary partnership to bring the global pickleball rating system to Vietnam. First step of a three-phase roadmap.", datePublished: "2026-05-13", image: "/images/blog/dupr-ta-picklehub-partnership-hero.webp" },
  "pickleball-tour-wars-2023-explained": { title: "Pickleball Tour Wars 2023 Explained | 10 Days That Changed Pro Pickleball", description: "Pickleball Tour Wars 2023: how PPA and MLP fought for 10 days, why Gold Contracts only exist from that window, and what it means for Vietnamese pros today.", datePublished: "2026-05-05", image: "/images/blog/pickleball-tour-wars-2023-hero.webp" },
  "app-tour-vs-ppa-tour-contracts-2026": { title: "APP Tour vs PPA Tour 2026 | Contracts, Money & Exclusivity Compared", description: "APP Tour vs PPA Tour 2026: contract structures, prize money, exclusivity, the Global Pickleball Alliance, and Quang Duong's APP deal explained.", datePublished: "2026-05-05", image: "/images/blog/app-tour-vs-ppa-tour-contracts-hero.webp" },
  "pickleball-world-cup-2026-da-nang": { title: "Pickleball World Cup 2026 Da Nang | Dates, Teams, Venues, How to Watch", description: "Pickleball World Cup 2026 in Da Nang, Vietnam (Aug 30–Sep 6). Up to 80 nations, 4,000 athletes. Dates, venues, format, Vietnam team.", datePublished: "2026-04-23", image: "/images/blog/pickleball-world-cup-2026-da-nang-hero.webp" },
  "how-to-watch-ppa-tour-live-2026": { title: "How to Watch PPA Tour Live 2026 | Streaming Platforms, Schedules & Free Options", description: "Watch PPA Tour live in 2026 on PBTV, Amazon Prime, CBS, ESPN, and Fox Sports. Plus free YouTube highlights + ThePickleHub livestreams.", datePublished: "2026-04-16", image: "/images/blog/how-to-watch-ppa-tour-live-2026-hero.webp?v=2" },
  "ppa-tour-asia-2026-complete-guide": { title: "PPA Tour Asia 2026: Complete Schedule, Prize Money & How to Play", description: "PPA Tour Asia 2026 complete guide — 10 tournament stops in Vietnam, Japan, Korea, Thailand. Schedule, prize money, registration, live streams.", datePublished: "2026-04-16", image: "/images/blog/ppa-tour-asia-2026-hero.webp" },
  "best-pickleball-tournament-software-2026": { title: "Best Pickleball Tournament Software 2026", description: "Compare the best pickleball tournament software in 2026: free bracket generators, round robin tools, MLP team match platforms. No signup.", datePublished: "2025-12-15" },
  "how-to-create-pickleball-bracket": { title: "How to Create a Pickleball Bracket", description: "How to create a pickleball bracket for round robin, single elimination, and double elimination — with a free bracket generator + live scoring.", datePublished: "2025-11-20" },
  "pickleball-round-robin-generator-guide": { title: "Pickleball Round Robin Generator Guide 2026", description: "Free pickleball round robin generator with auto scheduling, court rotation, and live scoring. Organize a perfect round robin tournament.", datePublished: "2025-10-10" },
  "pickleball-scoring-rules-guide": { title: "Pickleball Scoring Rules 2026 | Beginner Guide", description: "Learn pickleball scoring rules for singles, doubles, and tournament play. Rally scoring vs side-out explained. Free digital scoring tool included.", datePublished: "2026-03-15" },
  "how-to-organize-pickleball-tournament": { title: "How to Organize a Pickleball Tournament 2026", description: "Step-by-step guide to organize a pickleball tournament: venue, format, registration, scheduling, scoring, and free tools to run the event.", datePublished: "2026-03-20" },
  "pickleball-doubles-strategy-guide": { title: "Pickleball Doubles Strategy & Tips 2026", description: "Pickleball doubles strategy for tournaments: partner communication, court positioning, stacking, and when to attack the kitchen line.", datePublished: "2026-03-22" },
  "pickleball-tournament-formats-explained": { title: "Pickleball Tournament Formats | Round Robin & More", description: "Pickleball tournament formats explained: round robin, single + double elimination, MLP team match, flex. Choose the right format for your event.", datePublished: "2026-03-25" },
  "pickleball-live-streaming-guide": { title: "Pickleball Live Streaming Guide 2026", description: "Watch pickleball live streams for free. Learn how to stream your own pickleball tournament online with The Pickle Hub's free livestreaming platform.", datePublished: "2026-03-29" },
  "mlp-format-explained": { title: "MLP Format Explained 2026 | Major League Pickleball", description: "MLP format explained: Major League Pickleball team match rules, dreambreaker, lineup strategy, and how to organize your own MLP-style event.", datePublished: "2026-03-29" },
  "free-pickleball-bracket-generator": { title: "Free Pickleball Bracket Generator 2026", description: "Free pickleball bracket generator: round robin, single + double elimination, with real-time scoring. Build a tournament bracket in 60 seconds.", datePublished: "2026-03-29" },
  "pickleball-bracket-templates": { title: "Pickleball Bracket Templates 2026 | Free Download", description: "Free pickleball bracket templates for round robin, single + double elimination. Sizes for 4, 8, 16, 32, 64 players with live scoring.", datePublished: "2026-03-29" },
  "pickleball-rules-complete-guide": { title: "Pickleball Rules 2026 | Complete Guide with Asia's Hardest Calls Explained", description: "The 2026 pickleball rulebook simplified: serve, two-bounce, kitchen/NVZ, scoring, faults. Plus 5 disputed calls in Asian tournaments.", datePublished: "2026-04-19" },
  "tournament-organizer-hub": { title: "Pickleball Tournament Organizer Hub | Formats, Brackets, Tools 2026", description: "Pickleball tournament organizer hub 2026: choose a format, build brackets, manage scoring, livestream, and compare free software — all from one page.", datePublished: "2026-04-25", image: "/images/blog/tournament-organizer-hub-hero.webp" },
  "how-to-play-pickleball": { title: "How to Play Pickleball | 7-Day Beginner Plan Tested in Vietnam", description: "How to play pickleball: beginner gear, grip, 6 core shots, and a 7-day practice plan tested with 200+ Vietnamese players. Start playing in week one.", datePublished: "2026-04-26", image: "/images/blog/how-to-play-pickleball-hero.webp" },
};

export async function renderBlogPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const meta = BLOG_POST_META[slug];
  if (!meta) return render404(`/blog/${slug}`, siteUrl);

  // Look up Vietnamese alternate (returns null if no VI translation exists).
  // Required for reciprocal hreflang — Ahrefs Site Audit 2026-04-24 flagged
  // "Missing reciprocal hreflang (no return-tag)" because EN page wasn't
  // emitting <link hreflang="vi"> back to its VI counterpart even when one
  // existed. The VI side already emits hreflang en correctly via renderViBlogPost.
  const { data: viPost } = await supabase
    .from("vi_blog_posts")
    .select("slug")
    .eq("alternate_en_slug", slug)
    .eq("status", "published")
    .maybeSingle();

  const enUrl = `${siteUrl}/blog/${slug}`;
  const viSlug = (viPost as { slug: string } | null)?.slug;
  const extraMeta = viSlug
    ? `<link rel="alternate" hreflang="en" href="${enUrl}"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi/blog/${viSlug}"/>\n<link rel="alternate" hreflang="x-default" href="${enUrl}"/>`
    : `<link rel="alternate" hreflang="en" href="${enUrl}"/>\n<link rel="alternate" hreflang="x-default" href="${enUrl}"/>`;

  const title = buildTitle(meta.title, " | ThePickleHub");
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Blog", href: `${siteUrl}/blog` }, { label: meta.title }]);

  // PR79 Phase 2G (audit I-9 + I-10 + I-17) — bring the EN BlogPosting
  // schema to parity with the VI side (renderViBlogPost). Previously
  // emitted only { headline, description, url, publisher } so EN posts
  // were ineligible for the Article rich card (Google requires
  // datePublished + image + author + publisher.logo for the snippet).
  //
  // VI parity adds:
  //   image           — absolute heroImage URL (DEFAULT_OG_IMAGE fallback)
  //   datePublished   — from BLOG_POST_META (mirrored from src/content/
  //                     blog/posts/<slug>.ts.publishedDate)
  //   dateModified    — same as datePublished for now; we don't track
  //                     the EN updatedDate separately in BLOG_POST_META.
  //                     VI side reads vi_blog_posts.updated_at; can add
  //                     when EN edits start landing.
  //   author          — Organization (matches VI; future per-post bylines
  //                     can override when needed)
  //   publisher.logo  — promote the existing string `logo` field to a
  //                     proper ImageObject so Google's Article validator
  //                     stops flagging "logo must be ImageObject"
  //   inLanguage      — "en-US"
  const blogImage = absImage(meta.image ?? "", siteUrl);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description: meta.description,
    image: blogImage,
    url: enUrl,
    author: { "@type": "Organization", name: "ThePickleHub", url: siteUrl },
    publisher: {
      "@type": "Organization",
      name: "ThePickleHub",
      url: siteUrl,
      logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE },
    },
    inLanguage: "en-US",
  };
  if (meta.datePublished) {
    jsonLd.datePublished = meta.datePublished;
    jsonLd.dateModified = meta.datePublished;
  }

  return htmlResponse(buildHtml({
    title,
    description: meta.description,
    url: enUrl,
    siteUrl,
    image: blogImage,
    type: "article",
    extraMeta,
    jsonLd,
    bodyContent: `${bc}${relatedBlogLinks(slug, siteUrl)}`,
  }));
}

export function renderBlog(siteUrl: string): Response {
  const blogLinks = Object.entries(BLOG_POST_META).map(([slug, m]) => `<li><a href="${siteUrl}/blog/${slug}">${escapeHtml(m.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Pickleball Blog – Tips & Guides | ThePickleHub",
    description: "Read the latest pickleball articles: tournament tips, software reviews, strategy guides and community stories on ThePickleHub.",
    url: `${siteUrl}/blog`,
    siteUrl,
    bodyContent: `<h2>Blog Posts</h2><ul>${blogLinks}</ul>`,
  }));
}

// ─── Vietnamese Blog (database) ───────────────────────────

export async function renderViBlogPost(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  // Fire post + related queries in parallel — `related` doesn't depend on
  // post data (filters by slug !== current), so waiting for post first is
  // wasted latency. Saves ~200-300ms for bot-prerender on cold cache.
  const [postRes, relatedRes] = await Promise.all([
    supabase
      .from("vi_blog_posts")
      .select("title, meta_title, meta_description, content_html, cover_image_url, faq_items, alternate_en_slug, published_at, updated_at")
      .eq("slug", slug)
      .eq("status", "published")
      .single(),
    supabase
      .from("vi_blog_posts")
      .select("slug, title")
      .eq("status", "published")
      .neq("slug", slug)
      .limit(3),
  ]);
  const post = postRes.data;

  if (!post) return render404(`/vi/blog/${slug}`, siteUrl);

  const p = post as any;
  const url = `${siteUrl}/vi/blog/${slug}`;

  let extraMeta = "";
  if (p.alternate_en_slug) {
    extraMeta = `<link rel="alternate" hreflang="en" href="${siteUrl}/blog/${p.alternate_en_slug}"/>\n<link rel="alternate" hreflang="vi" href="${url}"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}/blog/${p.alternate_en_slug}"/>`;
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: p.title,
    description: p.meta_description,
    image: absImage(p.cover_image_url, siteUrl),
    datePublished: p.published_at,
    dateModified: p.updated_at,
    author: { "@type": "Organization", name: "ThePickleHub", url: siteUrl },
    publisher: { "@type": "Organization", name: "ThePickleHub", logo: { "@type": "ImageObject", url: DEFAULT_OG_IMAGE } },
    inLanguage: "vi-VN",
  };
  extraMeta += `\n<script type="application/ld+json">${escapeJsonLd(JSON.stringify(articleSchema))}</script>`;

  if (p.faq_items && Array.isArray(p.faq_items) && p.faq_items.length > 0) {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq_items.map((item: any) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    };
    extraMeta += `\n<script type="application/ld+json">${escapeJsonLd(JSON.stringify(faqSchema))}</script>`;
  }

  const bc = breadcrumb([{ label: "Trang chủ", href: `${siteUrl}/vi` }, { label: "Blog", href: `${siteUrl}/vi/blog` }, { label: p.title }]);

  const relatedItems = (relatedRes.data || []) as { slug: string; title: string }[];
  const relatedSection = relatedItems.length > 0
    ? `<section><h2>Bài viết liên quan</h2><ul>${relatedItems.map((r) => `<li><a href="${siteUrl}/vi/blog/${r.slug}">${escapeHtml(r.title)}</a></li>`).join("")}</ul></section>`
    : "";

  return htmlResponse(buildHtml({
    title: buildTitle(p.meta_title.replace(/ \| ThePickleHub$/, "")),
    description: p.meta_description,
    url,
    siteUrl,
    image: absImage(p.cover_image_url, siteUrl),
    type: "article",
    lang: "vi",
    extraMeta,
    bodyContent: `${bc}<article>${normalizeImagesInHtml(p.content_html)}</article>${relatedSection}`,
  }));
}

export async function renderViBlogIndex(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  const { data: posts } = await supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(20);
  const items = ((posts || []) as any[]).map((p) => `<li><a href="${siteUrl}/vi/blog/${p.slug}">${escapeHtml(p.title)}</a><p>${escapeHtml(p.excerpt || "")}</p></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Blog Pickleball Việt Nam | ThePickleHub",
    description: "Đọc blog pickleball Việt Nam: luật chơi, kỹ thuật, sân chơi, giải đấu, và mọi điều về cộng đồng pickleball Việt từ ThePickleHub.",
    url: `${siteUrl}/vi/blog`,
    siteUrl,
    lang: "vi",
    bodyContent: items ? `<ul>${items}</ul>` : "",
  }));
}

// ─── Static pages ─────────────────���───────────────────────

export function renderLivestreamList(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: "Livestream Pickleball | ThePickleHub",
    description: "Xem livestream pickleball trực tiếp tại Việt Nam. Các giải đấu, trận đấu đang phát sóng trực tuyến miễn phí trên ThePickleHub. Không cần đăng ký.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
  }));
}

export function renderPrivacy(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Chính sách bảo mật | ThePickleHub" : "Privacy Policy | ThePickleHub",
    description: "Chính sách bảo mật ThePickleHub — cách thu thập, lưu trữ, sử dụng dữ liệu cá nhân, cookie và quyền của người dùng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
  }));
}

export function renderTerms(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Điều khoản sử dụng | ThePickleHub" : "Terms of Service | ThePickleHub",
    description: "Điều khoản sử dụng ThePickleHub — quy định tài khoản, livestream, bracket, nội dung người dùng, sở hữu trí tuệ trên nền tảng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
  }));
}

// ─── Notifications page shell (Sprint 5 PR-C bot view) ────────────────────
//
// /notifications, /thong-bao, /vi/notifications, /vi/thong-bao all render
// the same Notifications React page (auth-gated). Bots get this noindex
// shell so they don't waste crawl budget on a private surface; real users
// bypass this branch entirely (middleware only routes here for bot UAs).

export function renderNotificationsShell(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Thông báo | ThePickleHub" : "Notifications | ThePickleHub",
    description: lang === "vi"
      ? "Thông báo cá nhân ThePickleHub — bình luận, kudo, theo dõi mới và lời nhắc đến từ cộng đồng pickleball."
      : "ThePickleHub personal notifications — new comments, likes, follows, and mentions from the pickleball community.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    extraMeta: `<meta name="robots" content="noindex, nofollow"/>`,
  }));
}

// ─── Noindex private-route shell (PR72 — SEO Phase 2A I-7) ────────────────
//
// Single bot-facing shell for every NOINDEX_PATTERNS match in
// functions/_middleware.ts. We deliberately don't embed any of the
// path's actual data (the magic_token, the club slug, etc.) — the
// crawler just needs a clean noindex signal + a link back to the
// public surface. The middleware also sets X-Robots-Tag on the
// response; the meta tag in this body is belt-and-braces for crawlers
// that ignore the header.

export function renderNoindexShell(siteUrl: string, rawPath: string, lang: Lang): Response {
  const title = lang === "vi"
    ? "Trang riêng tư | ThePickleHub"
    : "Private page | ThePickleHub";
  const description = lang === "vi"
    ? "Đây là một trang nội bộ trên ThePickleHub. Quay lại trang chủ để xem giải đấu, livestream và sự kiện công khai."
    : "This is a private surface on ThePickleHub. Return to the homepage for tournaments, livestreams, and public events.";
  return htmlResponse(buildHtml({
    title,
    description,
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
    extraMeta: `<meta name="robots" content="noindex, nofollow, noarchive"/>`,
    bodyContent: `<p>${escapeHtml(description)}</p><p><a href="${siteUrl}/">${lang === "vi" ? "Về trang chủ" : "Go to homepage"}</a></p>`,
  }));
}

// ─── Default fallback ───────────────��─────────────────────

export function renderDefault(path: string, siteUrl: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: "ThePickleHub - Pickleball Community",
    description: "ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với giải đấu, livestream, tools và cộng đồng sôi động.",
    url: `${siteUrl}${path}`,
    siteUrl,
    lang,
  }));
}

// ─── 404 ──────────────────────────────��───────────────────

export function render404(path: string, siteUrl: string): Response {
  const isVi = detectLang(path) === "vi";
  const title = isVi
    ? "404 - Không tìm thấy trang | ThePickleHub"
    : "404 - Page Not Found | ThePickleHub";
  const description = isVi
    ? "Trang bạn tìm không tồn tại. Quay lại trang chủ ThePickleHub để khám phá giải đấu, livestream và cộng đồng pickleball Việt Nam."
    : "The page you're looking for doesn't exist. Return to ThePickleHub for pickleball tournaments, livestreams, and Vietnam's pickleball community.";
  const homeHref = isVi ? `${siteUrl}/vi/` : `${siteUrl}/`;
  const homeLabel = isVi ? "Quay lại trang chủ" : "Return to home";
  // No canonical or og:url — emitting a canonical on a 404 sends a
  // contradictory signal (canonical = "this URL is authoritative" vs.
  // noindex = "don't index this"). Omitting both is correct for 404s.
  const html = `<!DOCTYPE html>
<html lang="${isVi ? "vi" : "en"}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<meta name="robots" content="noindex, nofollow"/>
<meta property="og:type" content="website"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:site_name" content="ThePickleHub"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:site" content="@ThePickleHub"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
<p><a href="${escapeHtml(homeHref)}">${escapeHtml(homeLabel)}</a></p>
</body>
</html>`;
  return htmlResponse(html, 404);
}

// ─── Player profile ──────────────────────────────────────
//
// /nguoi-choi/{username} — public player profile (Sprint 3 Phase 3B).
//
// Phase 4D moves the JSON-LD Person schema from src/pages/PlayerProfile.tsx
// (client-side DOM injection) to server-side prerender so bots see it on
// first byte. The client-side script is intentionally left in place — it's
// harmless when the server already injected the same structured data, and
// it covers preview/staging environments that don't run through the
// Pages Functions middleware.
//
// The /nguoi-choi/{username} URL is single-canonical (no /vi/nguoi-choi/*
// variant in src/App.tsx); the React page renders bilingual based on the
// language toggle. Server-side we render Vietnamese-first (95% audience)
// and emit hreflang en + vi pointing to the same canonical URL — same
// pattern Phase 4A used for /feed when only one path existed.

export async function renderProfile(
  supabase: SupabaseClient,
  username: string,
  siteUrl: string,
): Promise<Response> {
  // Mirror usePlayerProfile hook query (src/hooks/social/usePlayerProfile.ts).
  // is_ghost=false + onboarding_completed_at IS NOT NULL filters out shells
  // and unfinished signups so bots don't index zombie profiles.
  //
  // NOTE on `updated_at`: the profiles table has NO updated_at column on
  // prod (verified via src/integrations/supabase/types.ts; sitemap-players
  // comment also calls this out). The original Phase 4D select included
  // it as boilerplate copied from other handlers — the resulting
  // PostgREST 42703 error returned data=null + error=<column missing>,
  // and the original code only destructured `data`, silently routing
  // every profile lookup to the render404 fallback. Verified by Cuong's
  // seo-verify.sh run on commit 9c9c2fe (4/5 routes passed; profile
  // route returned the 404 SEO shell).
  //
  // Defensive: also destructure `error` and log it so a future column
  // drift can't silently regress this path again.
  //
  // PR79 Phase 2F follow-up — accept hex profile_slug too. The `:username`
  // route param is actually a slug-shaped value that can be EITHER a
  // human-readable username OR the 8-/12-char hex profile_slug derived
  // from profileIdToSlug(). SocialEventRoster, SocialEventLive, and
  // ClubCard all build /u/<hex> links that 301 to /nguoi-choi/<hex>,
  // so this resolver must accept both shapes or the in-app player
  // links 404. Single .or() PostgREST clause = one query, exact
  // username match preferred over prefix-LIKE on profile_slug.
  const isHexSlug = /^[0-9a-f]{8,12}$/i.test(username);
  const orFilter = isHexSlug
    ? `username.eq.${username},profile_slug.like.${username}%`
    : `username.eq.${username}`;
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select(
      `id, username, display_name, avatar_url, bio,
       city, country, skill_level,
       dupr_singles, dupr_doubles,
       is_ghost, onboarding_completed_at, created_at`,
    )
    .or(orFilter)
    .eq("is_ghost", false)
    .not("onboarding_completed_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (profileErr) {
    console.error("renderProfile: profile lookup error", {
      username,
      error: profileErr,
    });
  }

  if (!profileRow) return render404(`/nguoi-choi/${username}`, siteUrl);

  const p = profileRow as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    skill_level: string | null;
    dupr_singles: number | null;
    dupr_doubles: number | null;
    created_at: string;
  };

  const displayName = p.display_name ?? p.username;
  const url = `${siteUrl}/nguoi-choi/${p.username}`;

  // Bilingual title — primary clause Vietnamese, English in parens for
  // international discoverability.
  const rawTitle = `${displayName} (@${p.username})`;
  const title = buildTitle(rawTitle, " | ThePickleHub Pickleball");

  // Description: bio takes priority when meaningful (>= 30 chars after
  // trim); otherwise fall through to the city/DUPR fallback. Codex P2
  // fix on PR #19: the previous wiring used buildMetaDescription's
  // implicit fallback chain, but that helper always returns a non-empty
  // string (padding short input with generic platform copy), so the
  // city/DUPR-specific fallback was dead code.
  // pickProfileMetaDescription does the bio-vs-fallback choice
  // explicitly + clamps to 160 chars for Google's snippet display.
  const duprBits: string[] = [];
  if (p.dupr_doubles != null) duprBits.push(`DUPR đôi ${p.dupr_doubles.toFixed(2)}`);
  if (p.dupr_singles != null) duprBits.push(`DUPR đơn ${p.dupr_singles.toFixed(2)}`);
  const fallbackDesc = buildProfileFallbackDescription(p);
  const description = pickProfileMetaDescription(p.bio, fallbackDesc);

  // hreflang intentionally OMITTED. /nguoi-choi/{username} is single-
  // canonical — no separate /en/player/<u> URL serves different content.
  // Previous version emitted three <link hreflang> tags all pointing at
  // the same URL, which Google treats as an invalid signal (and Search
  // Console flags as "alternate page with proper canonical tag"). Same
  // policy as renderMatch (Codex P1 on PR #40). Re-add when the SPA
  // actually ships split-canonical bilingual URLs.
  const extraMeta = "";

  // JSON-LD Person — server-side variant of the schema PlayerProfile.tsx
  // injects client-side. Fields aligned with usePlayerProfile() shape so
  // bot view matches what humans see post-hydration (no cloaking). Pure
  // shape lives in functions/_lib/seo-helpers.ts so the JSON-LD edge
  // cases (no bio, no city, no DUPR, etc.) are unit-tested.
  const jsonLd = buildPersonJsonLd({
    profile: p,
    url,
    siteUrl,
    absoluteImageUrl: p.avatar_url ? absImage(p.avatar_url, siteUrl) : undefined,
  });

  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Người chơi" },
    { label: displayName },
  ]);

  // Bot-readable body — same pattern as renderMatch (no cloaking, gives
  // Google a text excerpt to preview). Mirrors PlayerHeroCard + PlayerStats
  // visible content roughly.
  const skillLine = p.skill_level
    ? `<p>Trình độ: <strong>${escapeHtml(p.skill_level)}</strong></p>`
    : "";
  const cityLine = p.city
    ? `<p>${escapeHtml(p.city)}${p.country ? `, ${escapeHtml(p.country)}` : ""}</p>`
    : "";
  const duprLine =
    duprBits.length > 0
      ? `<p>${escapeHtml(duprBits.join(" · "))}</p>`
      : "";
  const bioLine = p.bio ? `<p>${escapeHtml(p.bio)}</p>` : "";

  const bodyContent = `${bc}
<h1>${escapeHtml(displayName)} <span>@${escapeHtml(p.username)}</span></h1>
${cityLine}
${skillLine}
${duprLine}
${bioLine}
<nav><h2>Khám phá thêm</h2><ul>
<li><a href="${siteUrl}/feed">Bảng tin pickleball</a></li>
<li><a href="${siteUrl}/tournaments">Giải đấu</a></li>
</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url,
      siteUrl,
      image: p.avatar_url ? absImage(p.avatar_url, siteUrl) : undefined,
      type: "profile",
      jsonLd,
      bodyContent,
      extraMeta,
      lang: "vi",
    }),
  );
}

// ─── Match permalink ─────────────────────────────────────
//
// /tran-dau/{slug} — public match page (RLS matches.is_public read).
// Renders SSR HTML matching the client-side SEO produced by
// src/pages/MatchPage.tsx#applyClientSeo so bots see a complete
// SportsEvent + meta tags identical to what humans see post-hydration.

interface MatchSeoParticipant {
  team: "a" | "b";
  position: number | null;
  username: string | null;
  display_name: string | null;
}

function fmtScoreCompact(a: number[], b: number[]): string {
  return a.map((s, i) => `${s}-${b[i] ?? 0}`).join(" ");
}

function fmtMatchDateVN(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtMatchFormatVi(format: string): string {
  if (format === "singles") return "Đơn";
  if (format === "mixed") return "Đôi nam-nữ";
  return "Đôi";
}

export async function renderMatch(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
): Promise<Response> {
  // Fetches mirror useMatch (src/hooks/social/useMatch.ts) PLUS the
  // pro-tour provenance columns added in Sprint 6 — we need
  // tournament_name / tournament_event / round_name / source_provider
  // to build a rich meta description and the SportsEvent schema's
  // superEvent. duration_minutes feeds the schema's endDate (falls
  // back to a 45-min default when the source didn't capture it).
  const { data: matchRow } = await supabase
    .from("matches")
    .select(
      `id, slug, format, played_at, team_a_score, team_b_score, winning_team,
       venue_id, venue_name_override, court_number, duration_minutes,
       source_provider, tournament_name, tournament_event, round_name,
       venues:venue_id ( slug, name, city )`,
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!matchRow) return render404(`/tran-dau/${slug}`, siteUrl);

  const m = matchRow as Record<string, unknown>;
  const venue = m.venues as { slug: string; name: string; city: string } | null;
  const venueName = venue?.name ?? (m.venue_name_override as string | null) ?? "";
  const venueCity = venue?.city ?? "";

  const { data: parts } = await supabase
    .from("match_participants")
    .select(
      `team, position,
       profile:profiles!match_participants_player_id_fkey ( username, display_name )`,
    )
    .eq("match_id", m.id as string)
    .order("team", { ascending: true })
    .order("position", { ascending: true });

  const participants: MatchSeoParticipant[] = (parts ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const p = (r.profile ?? {}) as { username?: string | null; display_name?: string | null };
    return {
      team: r.team as "a" | "b",
      position: (r.position as number) ?? null,
      username: p.username ?? null,
      display_name: p.display_name ?? null,
    };
  });

  const teamA = participants.filter((p) => p.team === "a");
  const teamB = participants.filter((p) => p.team === "b");
  const teamAPlayers = teamA
    .map((p) => p.display_name ?? p.username ?? "")
    .filter(Boolean);
  const teamBPlayers = teamB
    .map((p) => p.display_name ?? p.username ?? "")
    .filter(Boolean);
  const teamALabel = teamAPlayers.join(" & ") || "?";
  const teamBLabel = teamBPlayers.join(" & ") || "?";

  const playedAt = m.played_at as string;
  const teamAScore = (m.team_a_score as number[]) || [];
  const teamBScore = (m.team_b_score as number[]) || [];
  const winningTeam = m.winning_team as "a" | "b" | null;
  const format = m.format as string;
  const tournamentName = (m.tournament_name as string | null) ?? null;
  const tournamentEvent = (m.tournament_event as string | null) ?? null;
  const roundCode = (m.round_name as string | null) ?? null;
  const courtNumber = (m.court_number as string | null) ?? null;
  const durationMinutes = (m.duration_minutes as number | null) ?? null;

  const date = fmtMatchDateVN(playedAt);
  const fmtLabel = fmtMatchFormatVi(format);
  const venueLabel = venueName ? venueName : "";
  const compactScore = fmtScoreCompact(teamAScore, teamBScore);

  // Title — keep concise; tournament context lives in the description.
  const rawTitle = `${teamALabel} vs ${teamBLabel}, ${compactScore}${venueLabel ? ` — ${venueLabel}` : ""}, ${date}`;
  const title = buildTitle(rawTitle, " | ThePickleHub");

  // Dynamic description (Bug 3 fix): match-specific sentence with
  // tournament + round + scores + winners, replaces the previous
  // boilerplate "Trận pickleball... kết quả X-Y" line.
  const description = buildMatchDescription(
    {
      teamALabel,
      teamBLabel,
      teamAScore,
      teamBScore,
      winningTeam,
      format,
      playedAtIso: playedAt,
      tournamentName,
      tournamentEvent,
      roundCode,
      venueName,
    },
    "vi",
  );

  // OG image computed once + reused for both buildHtml's image opt
  // and the schema's image property — Rich Results warns when image
  // is absent on SportsEvent.
  const ogImage = `${siteUrl}/og/match/${encodeURIComponent(slug)}.png`;

  // Rich JSON-LD (Bug 5 fix): SportsTeam competitors for doubles, Place
  // location with court → venue containment, eventStatus, superEvent
  // (now SportsSeries — see match-seo.ts comment), endDate from
  // duration_minutes, organizer from source_provider, image from OG.
  const jsonLd = buildMatchSchema({
    url: `${siteUrl}/tran-dau/${slug}`,
    description,
    imageUrl: ogImage,
    teamAPlayers,
    teamBPlayers,
    teamAScore,
    teamBScore,
    winningTeam,
    format,
    playedAtIso: playedAt,
    durationMinutes,
    tournamentName,
    venueName,
    venueCity,
    courtNumber,
    sourceProvider: (m.source_provider as string | null) as
      | "community"
      | "ppa_tour"
      | "app_tour"
      | "mlp"
      | "other"
      | null,
  });

  // Breadcrumb (Bug 1 fix): the "Trận đấu" middle crumb now points at
  // /feed?tab=trending — the closest thing to a "matches index" we
  // have today. The breadcrumb helper itself was hardened to render
  // a plain <li> when href is missing, but we want a working link
  // here so users (and Google's breadcrumb path display) get a
  // navigable route.
  const bc = breadcrumb([
    { label: "Trang chủ", href: `${siteUrl}/` },
    { label: "Trận đấu", href: `${siteUrl}/feed?tab=trending` },
    { label: `${teamALabel} vs ${teamBLabel}` },
  ]);

  // Bot-readable body. The H1 (Bug 2 fix) is now emitted by buildHtml
  // from the page title; the in-body teams headline is demoted to H2
  // so there's exactly one H1 per document. Tournament context is
  // surfaced as a paragraph above the score so the bot excerpt has
  // strong matching against tournament search queries.
  const tournamentLine = tournamentName
    ? `<p><em>${escapeHtml([tournamentName, tournamentEvent, roundLabel(roundCode, "vi")].filter(Boolean).join(" · "))}</em></p>`
    : "";
  const winnerLabel =
    winningTeam === "a" ? teamALabel : winningTeam === "b" ? teamBLabel : "";
  const bodyContent = `${bc}
<h2>${escapeHtml(`${teamALabel} vs ${teamBLabel}`)}</h2>
${tournamentLine}
<p><strong>${escapeHtml(date)}</strong>${venueLabel ? ` · ${escapeHtml(venueLabel)}` : ""}${venueCity ? `, ${escapeHtml(venueCity)}` : ""}${courtNumber ? ` · ${escapeHtml(courtNumber)}` : ""}</p>
<p>Hình thức: ${escapeHtml(fmtLabel)}</p>
<p>Tỉ số: <strong>${escapeHtml(compactScore)}</strong></p>
${winnerLabel ? `<p>Đội thắng: <strong>${escapeHtml(winnerLabel)}</strong></p>` : ""}`;

  // ogImage already declared above for the schema's `image` field.
  // Bug 6 fix on PR #40: twitter:image is emitted by buildHtml from
  // the `image` opt — don't duplicate via extraMeta. We still pass
  // PNG dimensions/type because buildHtml only emits the bare
  // og:image URL.
  const extraMeta = [
    `<meta property="og:image:width" content="1200"/>`,
    `<meta property="og:image:height" content="630"/>`,
    `<meta property="og:image:type" content="image/png"/>`,
  ].join("\n");

  // hreflang intentionally OMITTED. /tran-dau/<slug> is single-canonical
  // — there is no separate /en/match/<slug> or /vi/tran-dau/<slug> URL
  // serving distinct localized content (renderMatch hard-codes lang:"vi"
  // and the SPA toggles language client-side via context).
  //
  // Codex P1 on PR #40: emitting three <link hreflang> tags all
  // pointing at the same canonical URL is an invalid SEO signal —
  // Google will either ignore it or flag it in Search Console as
  // "alternate page with proper canonical tag" / "incorrect hreflang
  // implementation". Better to omit entirely until the route actually
  // ships split-canonical bilingual URLs. The og:locale:alternate tag
  // that buildHtml emits is similarly gated below.
  const canonicalUrl = `${siteUrl}/tran-dau/${slug}`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonicalUrl,
      siteUrl,
      image: ogImage,
      type: "article",
      jsonLd,
      bodyContent,
      extraMeta,
      lang: "vi",
    }),
  );
}

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
<li><a href="${siteUrl}/livestream">Livestream</a></li>
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

// ─── Social Events MVP (Sprint 1 PR2) ─────────────────────
// Re-export the dedicated render module so functions/_middleware.ts can
// import { renderSocialEvent, renderClub } from "./_lib/render" alongside
// the other handlers. Implementation lives in ./social-event.ts to keep
// this file from sprawling further.
export { renderSocialEvent, renderClub } from "./social-event";

// PR73 Phase 2B (audit I-1 + I-2): hub list pages for /social + /clubs.
// Previously fell through to renderDefault → bot saw generic "ThePickleHub
// - Pickleball Community" with no upcoming-event content or schema.
export { renderSocialList, renderClubList } from "./social-list";
