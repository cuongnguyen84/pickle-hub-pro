import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://www.thepicklehub.net";
const DEFAULT_OG_IMAGE = "https://www.thepicklehub.net/og-image.png";
const SITE_NAME = "ThePickleHub";

// ─── Helpers ───────────────────────────────────────────────

function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildHtml(opts: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
  bodyContent?: string;
  extraMeta?: string;
}): string {
  const {
    title,
    description,
    url,
    image = DEFAULT_OG_IMAGE,
    type = "website",
    jsonLd,
    bodyContent = "",
    extraMeta = "",
  } = opts;

  const jsonLdScript = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}"/>
<link rel="canonical" href="${escapeHtml(url)}"/>
<meta property="og:type" content="${type}"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:title" content="${escapeHtml(title)}"/>
<meta property="og:description" content="${escapeHtml(description)}"/>
<meta property="og:image" content="${escapeHtml(image)}"/>
<meta property="og:site_name" content="${SITE_NAME}"/>
<meta property="og:locale" content="vi_VN"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
${extraMeta}
${jsonLdScript}
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
${bodyContent}
</body>
</html>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "Vary": "User-Agent",
    },
  });
}

function absImage(url: string | null | undefined): string {
  if (!url) return DEFAULT_OG_IMAGE;
  if (url.startsWith("http")) return url;
  return `${SITE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

// ─── Route Handlers ────────────────────────────────────────

type Supabase = ReturnType<typeof createClient>;

async function renderHome(supabase: Supabase): Promise<Response> {
  const [liveRes, videoRes] = await Promise.all([
    supabase
      .from("public_livestreams")
      .select("id, title, status")
      .in("status", ["live", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("videos")
      .select("id, title")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(10),
  ]);

  const liveItems = (liveRes.data || []).map((l) => `<li>${escapeHtml(l.title)} (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v) => `<li>${escapeHtml(v.title)}</li>`).join("");

  const html = buildHtml({
    title: "ThePickleHub – Pickleball Tournaments, Livestream & Community",
    description: "ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với livestream trực tiếp, giải đấu, bracket miễn phí và cộng đồng sôi động.",
    url: SITE_URL,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ThePickleHub",
      url: SITE_URL,
      logo: DEFAULT_OG_IMAGE,
      sameAs: [],
    },
    bodyContent: `
      ${liveItems ? `<h2>Livestream</h2><ul>${liveItems}</ul>` : ""}
      ${videoItems ? `<h2>Video mới</h2><ul>${videoItems}</ul>` : ""}
    `,
  });
  return htmlResponse(html);
}

async function renderLive(supabase: Supabase, id: string): Promise<Response> {
  const { data: ls } = await supabase
    .from("public_livestreams")
    .select("id, title, description, thumbnail_url, status, scheduled_start_at, ended_at, created_at, organization_id, tournament_id, mux_playback_id")
    .eq("id", id)
    .single();

  if (!ls) return renderFallback(`/live/${id}`);

  const [orgRes, tournRes] = await Promise.all([
    ls.organization_id ? supabase.from("organizations").select("name").eq("id", ls.organization_id).single() : Promise.resolve({ data: null }),
    ls.tournament_id ? supabase.from("tournaments").select("name").eq("id", ls.tournament_id).single() : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name || "";
  const tournName = tournRes.data?.name || "";

  const isEnded = ls.status === "ended";
  const suffix = isEnded ? "Pickleball Replay" : "Pickleball Livestream";
  const title = tournName ? `${tournName} – ${ls.title} | ${suffix}` : `${ls.title} | ${suffix}`;
  const desc = ls.description || (isEnded
    ? `Xem lại: ${ls.title}. ${tournName ? `Giải đấu: ${tournName}. ` : ""}${orgName ? `Bởi ${orgName}. ` : ""}Full replay trên ${SITE_NAME}.`
    : `Xem trực tiếp: ${ls.title}. ${tournName ? `Giải đấu: ${tournName}. ` : ""}${orgName ? `Phát bởi ${orgName}. ` : ""}Trực tiếp trên ${SITE_NAME}.`
  );

  const videoUrl = ls.mux_playback_id ? `https://stream.mux.com/${ls.mux_playback_id}.m3u8` : null;

  const extraMeta = videoUrl ? `
<meta property="og:type" content="video.other"/>
<meta property="og:video" content="${escapeHtml(videoUrl)}"/>
<meta property="og:video:type" content="text/html"/>
<meta property="og:video:width" content="1280"/>
<meta property="og:video:height" content="720"/>
${orgName ? `<meta property="article:author" content="${escapeHtml(orgName)}"/>` : ""}` : "";

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/live/${id}`,
    image: absImage(ls.thumbnail_url),
    type: videoUrl ? "video.other" : "website",
    extraMeta,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: ls.title,
      description: desc.slice(0, 160),
      thumbnailUrl: absImage(ls.thumbnail_url),
      uploadDate: ls.created_at,
      ...(videoUrl ? { contentUrl: videoUrl } : {}),
    },
  }));
}

async function renderVideo(supabase: Supabase, id: string): Promise<Response> {
  const { data: v } = await supabase
    .from("videos")
    .select("id, title, description, thumbnail_url, duration_seconds, published_at, created_at, organization_id, tournament_id, mux_playback_id")
    .eq("id", id)
    .single();

  if (!v) return renderFallback(`/watch/${id}`);

  const [orgRes, tournRes] = await Promise.all([
    v.organization_id ? supabase.from("organizations").select("name").eq("id", v.organization_id).single() : Promise.resolve({ data: null }),
    v.tournament_id ? supabase.from("tournaments").select("name").eq("id", v.tournament_id).single() : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name || "";
  const tournName = tournRes.data?.name || "";

  const title = tournName ? `${tournName} – ${v.title} | Pickleball Video` : `${v.title} | Pickleball Video`;
  const desc = v.description || `Xem video: ${v.title}. ${tournName ? `Giải đấu: ${tournName}. ` : ""}${orgName ? `Bởi ${orgName}. ` : ""}Video pickleball trên ${SITE_NAME}.`;
  const videoUrl = v.mux_playback_id ? `https://stream.mux.com/${v.mux_playback_id}.m3u8` : null;

  let durationIso = "";
  if (v.duration_seconds && v.duration_seconds > 0) {
    const h = Math.floor(v.duration_seconds / 3600);
    const m = Math.floor((v.duration_seconds % 3600) / 60);
    const s = Math.floor(v.duration_seconds % 60);
    durationIso = "PT" + (h > 0 ? `${h}H` : "") + (m > 0 ? `${m}M` : "") + `${s}S`;
  }

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/watch/${id}`,
    image: absImage(v.thumbnail_url),
    type: videoUrl ? "video.other" : "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      name: v.title,
      description: desc.slice(0, 160),
      thumbnailUrl: absImage(v.thumbnail_url),
      uploadDate: v.published_at || v.created_at,
      ...(videoUrl ? { contentUrl: videoUrl } : {}),
      ...(durationIso ? { duration: durationIso } : {}),
    },
  }));
}

async function renderTournamentDetail(supabase: Supabase, slug: string): Promise<Response> {
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name, description, status, start_date, end_date, slug")
    .eq("slug", slug)
    .single();

  if (!t) return renderFallback(`/tournament/${slug}`);

  const statusText = t.status === "ongoing" ? "🔴 Đang diễn ra" : t.status === "upcoming" ? "📅 Sắp diễn ra" : "✅ Đã kết thúc";
  const title = `${t.name} | Pickleball Tournament`;
  const desc = t.description || `${statusText}: ${t.name}. Xem lịch thi đấu, bảng đấu và kết quả trực tiếp trên ThePickleHub.`;

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/tournament/${t.slug}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: t.name,
      description: desc.slice(0, 160),
      url: `${SITE_URL}/tournament/${t.slug}`,
      sport: "Pickleball",
      eventStatus: "https://schema.org/EventScheduled",
      ...(t.start_date ? { startDate: t.start_date } : {}),
      ...(t.end_date ? { endDate: t.end_date } : {}),
    },
  }));
}

async function renderTournaments(supabase: Supabase): Promise<Response> {
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, slug, status")
    .in("status", ["ongoing", "upcoming"])
    .order("start_date", { ascending: false })
    .limit(20);

  const items = (tournaments || []).map((t) => `<li><a href="${SITE_URL}/tournament/${t.slug}">${escapeHtml(t.name)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Giải đấu Pickleball | ThePickleHub",
    description: "Danh sách các giải đấu pickleball đang diễn ra và sắp tới. Xem lịch thi đấu, bảng đấu và kết quả trực tiếp.",
    url: `${SITE_URL}/tournaments`,
    bodyContent: items ? `<h2>Giải đấu</h2><ul>${items}</ul>` : "",
  }));
}

async function renderVideos(supabase: Supabase): Promise<Response> {
  const { data: videos } = await supabase
    .from("videos")
    .select("id, title")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const items = (videos || []).map((v) => `<li><a href="${SITE_URL}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Video Pickleball | ThePickleHub",
    description: "Xem video pickleball chất lượng cao: highlight, replay giải đấu, hướng dẫn kỹ thuật trên ThePickleHub.",
    url: `${SITE_URL}/videos`,
    bodyContent: items ? `<h2>Video</h2><ul>${items}</ul>` : "",
  }));
}

async function renderNews(supabase: Supabase): Promise<Response> {
  const { data: news } = await supabase
    .from("news_items")
    .select("id, title, summary")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const items = (news || []).map((n) => `<li>${escapeHtml(n.title)}: ${escapeHtml(n.summary?.slice(0, 80) || "")}</li>`).join("");

  return htmlResponse(buildHtml({
    title: "Tin tức Pickleball | ThePickleHub",
    description: "Cập nhật tin tức pickleball mới nhất: giải đấu, kết quả, sự kiện và cộng đồng pickleball Việt Nam.",
    url: `${SITE_URL}/news`,
    bodyContent: items ? `<h2>Tin tức</h2><ul>${items}</ul>` : "",
  }));
}

async function renderForum(supabase: Supabase): Promise<Response> {
  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, title")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const items = (posts || []).map((p) => `<li><a href="${SITE_URL}/forum/post/${p.id}">${escapeHtml(p.title)}</a></li>`).join("");

  return htmlResponse(buildHtml({
    title: "Diễn đàn Pickleball | ThePickleHub",
    description: "Thảo luận về pickleball: kỹ thuật, thiết bị, giải đấu, tìm bạn chơi. Cộng đồng pickleball Việt Nam.",
    url: `${SITE_URL}/forum`,
    bodyContent: items ? `<h2>Bài viết mới</h2><ul>${items}</ul>` : "",
  }));
}

async function renderOrgDetail(supabase: Supabase, slug: string): Promise<Response> {
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, description, slug, logo_url")
    .eq("slug", slug)
    .single();

  if (!org) return renderFallback(`/org/${slug}`);

  const title = `${org.name} | Pickleball Creator`;
  const desc = org.description || `${org.name} - Nhà tổ chức giải đấu Pickleball. Xem livestream, video và các giải đấu trên ThePickleHub.`;

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/org/${org.slug}`,
    image: absImage(org.logo_url),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: org.name,
      url: `${SITE_URL}/org/${org.slug}`,
      ...(org.logo_url ? { logo: absImage(org.logo_url) } : {}),
    },
  }));
}

async function renderQuickTable(supabase: Supabase, shareId: string): Promise<Response> {
  const { data: qt } = await supabase
    .from("quick_tables")
    .select("id, name, format, player_count, status, share_id")
    .eq("share_id", shareId)
    .single();

  if (!qt) return renderFallback(`/tools/quick-tables/${shareId}`);

  const title = `${qt.name} | Bảng đấu Pickleball`;
  const desc = `Bảng đấu ${qt.name} – ${qt.player_count} VĐV, ${qt.format}. Xem kết quả trực tiếp trên ThePickleHub.`;

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/tools/quick-tables/${shareId}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: qt.name,
      url: `${SITE_URL}/tools/quick-tables/${shareId}`,
      sport: "Pickleball",
    },
  }));
}

async function renderTeamMatch(supabase: Supabase, id: string): Promise<Response> {
  const { data: tm } = await supabase
    .from("team_match_tournaments")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (!tm) return renderFallback(`/tools/team-match/${id}`);

  const title = `${tm.name} | Team Match Pickleball`;
  const desc = `Giải đấu đội ${tm.name}. Xem lineup, kết quả và bảng xếp hạng trực tiếp trên ThePickleHub.`;

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/tools/team-match/${id}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: tm.name,
      url: `${SITE_URL}/tools/team-match/${id}`,
      sport: "Pickleball",
    },
  }));
}

async function renderDoublesElimination(supabase: Supabase, shareId: string): Promise<Response> {
  const { data: de } = await supabase
    .from("doubles_elimination_tournaments")
    .select("id, name, team_count, status, share_id")
    .eq("share_id", shareId)
    .single();

  if (!de) return renderFallback(`/tools/doubles-elimination/${shareId}`);

  const title = `${de.name} | Doubles Elimination Pickleball`;
  const desc = `Giải đấu loại trực tiếp ${de.name} – ${de.team_count} đội. Xem bracket và kết quả trực tiếp trên ThePickleHub.`;

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/tools/doubles-elimination/${shareId}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: de.name,
      url: `${SITE_URL}/tools/doubles-elimination/${shareId}`,
      sport: "Pickleball",
    },
  }));
}

async function renderFlexTournament(supabase: Supabase, shareId: string): Promise<Response> {
  const { data: ft } = await supabase
    .from("flex_tournaments")
    .select("id, name, status, share_id")
    .eq("share_id", shareId)
    .single();

  if (!ft) return renderFallback(`/tools/flex-tournament/${shareId}`);

  const title = `${ft.name} | Flex Tournament Pickleball`;
  const desc = `Giải đấu ${ft.name}. Tạo nhóm, xếp lịch thi đấu linh hoạt trên ThePickleHub.`;

  return htmlResponse(buildHtml({
    title,
    description: desc.slice(0, 160),
    url: `${SITE_URL}/tools/flex-tournament/${shareId}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SportsEvent",
      name: ft.name,
      url: `${SITE_URL}/tools/flex-tournament/${shareId}`,
      sport: "Pickleball",
    },
  }));
}

function renderTools(): Response {
  return htmlResponse(buildHtml({
    title: "Free Pickleball Tournament Tools | ThePickleHub",
    description: "Free pickleball tournament bracket generator, round robin scheduler, MLP team match manager, and doubles elimination tools. No signup required.",
    url: `${SITE_URL}/tools`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "ThePickleHub Tournament Tools",
      applicationCategory: "SportsApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", reviewCount: "120" },
    },
    bodyContent: `
      <h2>Tournament Tools</h2>
      <ul>
        <li><a href="${SITE_URL}/tools/quick-tables">Quick Tables – Round Robin & Single Elimination</a></li>
        <li><a href="${SITE_URL}/tools/team-match">Team Match – MLP Format</a></li>
        <li><a href="${SITE_URL}/tools/doubles-elimination">Doubles Elimination Bracket</a></li>
        <li><a href="${SITE_URL}/tools/flex-tournament">Flex Tournament</a></li>
      </ul>
    `,
  }));
}

function renderBlog(): Response {
  return htmlResponse(buildHtml({
    title: "Pickleball Blog – Tips, News & Guides | ThePickleHub",
    description: "Read the latest pickleball articles: tournament tips, software reviews, strategy guides and community stories.",
    url: `${SITE_URL}/blog`,
    bodyContent: `
      <h2>Blog Posts</h2>
      <ul>
        <li><a href="${SITE_URL}/blog/best-pickleball-tournament-software-2026">Best Pickleball Tournament Software 2026</a></li>
      </ul>
    `,
  }));
}

async function renderForumPost(supabase: Supabase, postId: string): Promise<Response> {
  const { data: post } = await supabase
    .from("forum_posts")
    .select("id, title, content")
    .eq("id", postId)
    .eq("is_hidden", false)
    .single();

  if (!post) return renderFallback(`/forum/post/${postId}`);

  const desc = (post.content || "").replace(/<[^>]*>/g, "").slice(0, 160);

  return htmlResponse(buildHtml({
    title: `${post.title} | Diễn đàn Pickleball`,
    description: desc,
    url: `${SITE_URL}/forum/post/${postId}`,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      headline: post.title,
      text: desc,
      url: `${SITE_URL}/forum/post/${postId}`,
    },
  }));
}

function renderFallback(path: string): Response {
  return htmlResponse(buildHtml({
    title: "ThePickleHub – Pickleball Tournaments, Livestream & Community",
    description: "ThePickleHub là nền tảng pickleball hàng đầu với livestream trực tiếp, giải đấu, bracket miễn phí và cộng đồng sôi động.",
    url: `${SITE_URL}${path}`,
  }));
}

// ─── Router ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path") || "/";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Pattern matching
    let match: RegExpMatchArray | null;

    // Home
    if (path === "/" || path === "") {
      return await renderHome(supabase);
    }

    // Livestream detail: /live/:id
    match = path.match(/^\/live\/([^/]+)$/);
    if (match) return await renderLive(supabase, match[1]);

    // Video detail: /watch/:id
    match = path.match(/^\/watch\/([^/]+)$/);
    if (match) return await renderVideo(supabase, match[1]);

    // Tournament detail: /tournament/:slug
    match = path.match(/^\/tournament\/([^/]+)$/);
    if (match) return await renderTournamentDetail(supabase, match[1]);

    // Tournaments list
    if (path === "/tournaments") return await renderTournaments(supabase);

    // Videos list
    if (path === "/videos") return await renderVideos(supabase);

    // News
    if (path === "/news") return await renderNews(supabase);

    // Forum
    if (path === "/forum") return await renderForum(supabase);

    // Forum post detail: /forum/post/:id
    match = path.match(/^\/forum\/post\/([^/]+)$/);
    if (match) return await renderForumPost(supabase, match[1]);

    // Organization detail: /org/:slug
    match = path.match(/^\/org\/([^/]+)$/);
    if (match) return await renderOrgDetail(supabase, match[1]);

    // Quick Table: /tools/quick-tables/:shareId
    match = path.match(/^\/tools\/quick-tables\/([^/]+)$/);
    if (match) return await renderQuickTable(supabase, match[1]);

    // Team Match: /tools/team-match/:id
    match = path.match(/^\/tools\/team-match\/([^/]+)$/);
    if (match) return await renderTeamMatch(supabase, match[1]);

    // Doubles Elimination: /tools/doubles-elimination/:shareId
    match = path.match(/^\/tools\/doubles-elimination\/([^/]+)$/);
    if (match) return await renderDoublesElimination(supabase, match[1]);

    // Flex Tournament: /tools/flex-tournament/:shareId
    match = path.match(/^\/tools\/flex-tournament\/([^/]+)$/);
    if (match) return await renderFlexTournament(supabase, match[1]);

    // Tools (static)
    if (path.startsWith("/tools")) return renderTools();

    // Blog
    if (path === "/blog" || path.startsWith("/blog/")) return renderBlog();

    // Fallback
    return renderFallback(path);
  } catch (err) {
    console.error("Prerender error:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
