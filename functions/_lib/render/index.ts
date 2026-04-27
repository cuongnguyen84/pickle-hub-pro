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
  type Lang,
  DEFAULT_OG_IMAGE,
} from "../utils";

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

  const title = "ThePickleHub - Pickleball Tournaments, Livestream & News — Built for Asia";
  const description = "The only bilingual pickleball platform built for Asia. Tournaments, livestream, and news in Vietnamese and English — free for organizers and players.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: siteUrl,
    siteUrl,
    lang: "en",
    extraMeta: `<link rel="alternate" hreflang="en" href="${siteUrl}/"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`,
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
    title: "ThePickleHub - Giải đấu Pickleball, Livestream & Tin tức — Xây cho Châu Á",
    description: "Nền tảng pickleball song ngữ duy nhất xây cho châu Á. Giải đấu, livestream và tin tức bằng tiếng Việt và tiếng Anh — miễn phí cho BTC và người chơi.",
    url: `${siteUrl}/vi`,
    siteUrl,
    lang: "vi",
    extraMeta: `<link rel="alternate" hreflang="vi" href="${siteUrl}/vi"/>\n<link rel="alternate" hreflang="en" href="${siteUrl}/"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}/"/>`,
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

export async function renderTournaments(supabase: SupabaseClient, siteUrl: string, rawPath = "/tournaments"): Promise<Response> {
  const { data: tournaments } = await supabase.from("tournaments").select("id, name, slug, status").in("status", ["ongoing", "upcoming"]).order("start_date", { ascending: false }).limit(20);
  const items = (tournaments || []).map((t: any) => `<li><a href="${siteUrl}/tournament/${t.slug}">${escapeHtml(t.name)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Giải đấu Pickleball | ThePickleHub",
    description: "Danh sách các giải đấu pickleball đang diễn ra và sắp tới tại Việt Nam. Xem lịch thi đấu, bảng đấu, kết quả trực tiếp và đăng ký tham gia giải pickleball.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Giải đấu</h2><ul>${items}</ul>` : "",
  }));
}

// ─── Videos / News / Forum list pages ─────────────────────

export async function renderVideos(supabase: SupabaseClient, siteUrl: string, rawPath = "/videos"): Promise<Response> {
  const { data: videos } = await supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(20);
  const items = (videos || []).map((v: any) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Video Pickleball | ThePickleHub",
    description: "Xem video pickleball chất lượng cao: highlight giải đấu, replay trận đấu, hướng dẫn kỹ thuật và chiến thuật chơi pickleball trên ThePickleHub.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Video</h2><ul>${items}</ul>` : "",
  }));
}

export async function renderNews(supabase: SupabaseClient, siteUrl: string, rawPath = "/news"): Promise<Response> {
  const { data: news } = await supabase.from("news_items").select("id, title, summary").eq("status", "published").order("published_at", { ascending: false }).limit(20);
  const items = (news || []).map((n: any) => `<li>${escapeHtml(n.title)}: ${escapeHtml(n.summary?.slice(0, 80) || "")}</li>`).join("");

  return htmlResponse(buildHtml({
    title: "Tin tức Pickleball | ThePickleHub",
    description: "Tin tức pickleball mới nhất tại Việt Nam và thế giới: kết quả giải đấu PPA Tour Asia, World Cup Pickleball, sự kiện cộng đồng, và phân tích chuyên sâu từ ThePickleHub.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Tin tức</h2><ul>${items}</ul>` : "",
  }));
}

export async function renderForum(supabase: SupabaseClient, siteUrl: string, rawPath = "/forum"): Promise<Response> {
  const { data: posts } = await supabase.from("forum_posts").select("id, title").eq("is_hidden", false).order("created_at", { ascending: false }).limit(20);
  const items = (posts || []).map((p: any) => `<li><a href="${siteUrl}/forum/post/${p.id}">${escapeHtml(p.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Diễn đàn Pickleball | ThePickleHub",
    description: "Diễn đàn pickleball Việt Nam lớn nhất - thảo luận kỹ thuật, review thiết bị, tìm sân chơi, kết nối VĐV. Tham gia cộng đồng pickleball ThePickleHub.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    bodyContent: items ? `<h2>Bài viết mới</h2><ul>${items}</ul>` : "",
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

export function renderTools(siteUrl: string, rawPath = "/tools"): Response {
  return htmlResponse(buildHtml({
    title: "Free Pickleball Tournament Tools | ThePickleHub",
    description: "Free pickleball tournament bracket generator, round robin scheduler, MLP team match manager, and doubles elimination tools. No signup required.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "ThePickleHub Tournament Tools",
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "120" },
    },
    bodyContent: `<h2>Tournament Tools</h2><ul>
      <li><a href="${siteUrl}/tools/quick-tables">Quick Tables – Round Robin &amp; Single Elimination</a></li>
      <li><a href="${siteUrl}/tools/team-match">Team Match – MLP Format</a></li>
      <li><a href="${siteUrl}/tools/doubles-elimination">Doubles Elimination Bracket</a></li>
      <li><a href="${siteUrl}/tools/flex-tournament">Flex Tournament</a></li>
    </ul>`,
  }));
}

const TOOL_PAGE_META: Record<string, { title: string; description: string }> = {
  "quick-tables": {
    title: "Quick Tables – Round Robin & Single Elimination | ThePickleHub",
    description: "Free round robin and single elimination bracket generator for pickleball tournaments. Automatic scheduling, real-time scoring, shareable links. No signup required.",
  },
  "team-match": {
    title: "Team Match – MLP Format Pickleball | ThePickleHub",
    description: "Free MLP-style team match pickleball bracket tool. Manage team lineups, track singles and doubles results, and generate instant standings. No signup required.",
  },
  "doubles-elimination": {
    title: "Doubles Elimination Bracket Generator | ThePickleHub",
    description: "Free doubles elimination bracket generator for pickleball tournaments. Automatic bracket draw, real-time scoring, and shareable results pages. No signup required.",
  },
  "flex-tournament": {
    title: "Flex Tournament Generator – Flexible Bracket | ThePickleHub",
    description: "Free flex-format pickleball tournament generator. Customizable groups, flexible scheduling, and live scoring. Perfect for club and community events. No signup required.",
  },
};

export function renderToolPage(toolSlug: string, siteUrl: string, rawPath: string): Response {
  const meta = TOOL_PAGE_META[toolSlug];
  if (!meta) return renderTools(siteUrl, rawPath);

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

// ─── Blog ─────────────────────��───────────────────────────

// Prerender metadata for bot-rendered EN blog posts. MUST stay in sync with
// src/content/blog/posts/*.ts + src/content/blog/metadata.ts — if a slug is
// missing here, Googlebot/Bingbot get a 404 even though the React app renders
// fine for humans, and the URL cannot be indexed (verified 2026-04-23 with
// the world-cup-pickleball-2026-da-nang post).
const BLOG_POST_META: Record<string, { title: string; description: string }> = {
  "pickleball-world-cup-2026-da-nang": { title: "Pickleball World Cup 2026 Da Nang | Dates, Teams, Venues, How to Watch", description: "Pickleball World Cup 2026 comes to Da Nang, Vietnam (Aug 30 – Sep 6). Up to 80 nations and 4,000 athletes. Dates, venues, format, Vietnam team — complete guide." },
  "how-to-watch-ppa-tour-live-2026": { title: "How to Watch PPA Tour Live 2026 | Streaming Platforms, Schedules & Free Options", description: "Watch PPA Tour live in 2026 on PBTV, Amazon Prime, CBS Sports, ESPN, and Fox Sports. Free YouTube highlights and ThePickleHub's free tournament livestreams included." },
  "ppa-tour-asia-2026-complete-guide": { title: "PPA Tour Asia 2026: Complete Schedule, Prize Money & How to Play", description: "Complete guide to PPA Tour Asia 2026 — all 10 tournament stops across Vietnam, Japan, Korea, Thailand & more. Schedule, prize money, registration, and how to watch live." },
  "best-pickleball-tournament-software-2026": { title: "Best Pickleball Tournament Software 2026", description: "Compare the best pickleball tournament software in 2026. Free bracket generators, round robin tools, and MLP team match platforms for organizers. No signup required." },
  "how-to-create-pickleball-bracket": { title: "How to Create a Pickleball Bracket", description: "Learn how to create a pickleball bracket for round robin, single elimination, and double elimination tournaments. Free bracket generator with real-time scoring." },
  "pickleball-round-robin-generator-guide": { title: "Pickleball Round Robin Generator Guide 2026", description: "Free pickleball round robin generator with automatic scheduling, court rotation, and live scoring. Learn how to organize the perfect round robin tournament." },
  "pickleball-scoring-rules-guide": { title: "Pickleball Scoring Rules 2026 | Beginner Guide", description: "Learn pickleball scoring rules for singles, doubles, and tournament play. Rally scoring vs side-out explained. Free digital scoring tool included." },
  "how-to-organize-pickleball-tournament": { title: "How to Organize a Pickleball Tournament 2026", description: "Step-by-step guide to organizing a pickleball tournament. Venue, format selection, registration, scheduling, scoring, and free tools." },
  "pickleball-doubles-strategy-guide": { title: "Pickleball Doubles Strategy & Tips 2026", description: "Master pickleball doubles strategy for tournaments. Partner communication, court positioning, stacking, and when to attack the kitchen." },
  "pickleball-tournament-formats-explained": { title: "Pickleball Tournament Formats | Round Robin & More", description: "Complete guide to pickleball tournament formats: round robin, single elimination, double elimination, MLP team match, and flex tournaments." },
  "pickleball-live-streaming-guide": { title: "Pickleball Live Streaming Guide 2026", description: "Watch pickleball live streams for free. Learn how to stream your own pickleball tournament online with The Pickle Hub's free livestreaming platform." },
  "mlp-format-explained": { title: "MLP Format Explained 2026 | Major League Pickleball", description: "Learn how the MLP format works in pickleball. Complete guide to Major League Pickleball team match rules, dreambreaker, lineup strategy." },
  "free-pickleball-bracket-generator": { title: "Free Pickleball Bracket Generator 2026", description: "Create free pickleball tournament brackets instantly. Round robin, single elimination, and double elimination bracket generator with real-time scoring." },
  "pickleball-bracket-templates": { title: "Pickleball Bracket Templates 2026 | Free Download", description: "Free pickleball bracket templates for round robin, single elimination, and double elimination. Templates for 4, 8, 16, 32, and 64 players." },
  "pickleball-rules-complete-guide": { title: "Pickleball Rules 2026 | Complete Guide with Asia's Hardest Calls Explained", description: "The complete 2026 Pickleball rulebook simplified: serve, two-bounce, kitchen/NVZ, scoring, faults. Plus: the 5 calls that start fights in Asian tournaments — and how to settle them." },
  "tournament-organizer-hub": { title: "Pickleball Tournament Organizer Hub | Formats, Brackets, Tools 2026", description: "The complete hub for pickleball tournament organizers in 2026. Choose a format, build a bracket, manage scoring, livestream matches, and compare free software — all linked from one page." },
  "how-to-play-pickleball": { title: "How to Play Pickleball | 7-Day Beginner Plan Tested in Vietnam", description: "How to play pickleball as a beginner: gear to buy, correct grip, 6 core shots, and a 7-day practice plan that took 200+ Vietnamese players from zero to playing their first real match." },
};

export function renderBlogPost(slug: string, siteUrl: string): Response {
  const meta = BLOG_POST_META[slug];
  if (!meta) return render404(`/blog/${slug}`, siteUrl);

  const title = buildTitle(meta.title, " | ThePickleHub");
  const bc = breadcrumb([{ label: "Trang chủ", href: siteUrl }, { label: "Blog", href: `${siteUrl}/blog` }, { label: meta.title }]);

  return htmlResponse(buildHtml({
    title,
    description: meta.description,
    url: `${siteUrl}/blog/${slug}`,
    siteUrl,
    type: "article",
    jsonLd: { "@context": "https://schema.org", "@type": "BlogPosting", headline: title, description: meta.description, url: `${siteUrl}/blog/${slug}`, publisher: { "@type": "Organization", name: "ThePickleHub", url: siteUrl } },
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
  const { data: post } = await supabase
    .from("vi_blog_posts")
    .select("title, meta_title, meta_description, content_html, cover_image_url, faq_items, alternate_en_slug, published_at, updated_at")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

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

  const { data: related } = await supabase.from("vi_blog_posts").select("slug, title").eq("status", "published").neq("slug", slug).limit(3);
  const relatedItems = (related || []) as { slug: string; title: string }[];
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
    description: "Chính sách bảo mật của ThePickleHub - nền tảng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
  }));
}

export function renderTerms(siteUrl: string, rawPath: string, lang: Lang): Response {
  return htmlResponse(buildHtml({
    title: lang === "vi" ? "Điều khoản sử dụng | ThePickleHub" : "Terms of Service | ThePickleHub",
    description: "Điều khoản sử dụng của ThePickleHub - nền tảng pickleball Việt Nam.",
    url: `${siteUrl}${rawPath}`,
    siteUrl,
    lang,
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
  return htmlResponse(buildHtml({
    title: "404 - Không tìm thấy trang | ThePickleHub",
    description: "Trang bạn tìm không tồn tại. Quay lại trang chủ ThePickleHub để khám phá giải đấu, livestream và cộng đồng pickleball Việt Nam.",
    url: `${siteUrl}${path}`,
    siteUrl,
    bodyContent: `<p>Trang bạn tìm không tồn tại.</p><p><a href="${siteUrl}/">Quay lại trang chủ</a></p>`,
  }), 404);
}
