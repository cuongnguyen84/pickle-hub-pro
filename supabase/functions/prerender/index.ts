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

function buildTitle(rawTitle: string, suffix = " | ThePickleHub"): string {
  const maxTotal = 60;
  const maxRaw = maxTotal - suffix.length;
  if ((rawTitle + suffix).length <= maxTotal) return rawTitle + suffix;
  if (rawTitle.length <= maxTotal) return rawTitle;
  return rawTitle.slice(0, maxTotal - 1).trim() + "…";
}

function buildMetaDescription(
  rawDesc: string | null | undefined,
  context: { type: string; title: string },
): string {
  const MIN_LENGTH = 120;
  const MAX_LENGTH = 160;

  if (rawDesc && rawDesc.length >= MIN_LENGTH && rawDesc.length <= MAX_LENGTH) {
    return rawDesc;
  }

  if (!rawDesc || rawDesc.length < MIN_LENGTH) {
    const fallbacks: Record<string, string> = {
      video: `${context.title} - Xem video pickleball miễn phí tại ThePickleHub. Cập nhật highlight, kỹ thuật, và những khoảnh khắc đỉnh nhất từ giải đấu pickleball Việt Nam và quốc tế.`,
      "forum-post": `${context.title} - Thảo luận trên diễn đàn ThePickleHub. Tham gia cộng đồng pickleball Việt Nam để trao đổi kinh nghiệm, kỹ thuật, và tìm bạn chơi pickleball.`,
      blog: `${context.title} - Hướng dẫn chi tiết về pickleball từ ThePickleHub. Khám phá luật chơi, kỹ thuật, chiến thuật và mẹo chơi pickleball cho mọi trình độ.`,
      default: `${context.title} - ThePickleHub là nền tảng pickleball hàng đầu Việt Nam với giải đấu, livestream, tools và cộng đồng sôi động.`,
    };
    const fb = fallbacks[context.type] || fallbacks.default;
    return fb.slice(0, MAX_LENGTH);
  }

  return rawDesc.slice(0, MAX_LENGTH - 3).trim() + "...";
}

// ─── Language Detection ────────────────────────────────────

type Lang = "en" | "vi";

function detectLang(path: string): Lang {
  return path === "/vi" || path.startsWith("/vi/") ? "vi" : "en";
}

function stripLangPrefix(path: string): string {
  if (path === "/vi") return "/";
  if (path.startsWith("/vi/")) return path.substring(3);
  return path;
}

// ─── Header / Footer / Breadcrumb ──────────────────────────

function getHeaderHtml(lang: Lang): string {
  const prefix = lang === "vi" ? "/vi" : "";
  if (lang === "vi") {
    return `<header><nav>
<a href="${SITE_URL}${prefix}/">Trang chủ</a>
<a href="${SITE_URL}${prefix}/blog">Blog</a>
<a href="${SITE_URL}${prefix}/tools">Công cụ</a>
<a href="${SITE_URL}${prefix}/tournaments">Giải đấu</a>
<a href="${SITE_URL}${prefix}/livestream">Livestream</a>
<a href="${SITE_URL}${prefix}/news">Tin tức</a>
<a href="${SITE_URL}${prefix}/videos">Video</a>
<a href="${SITE_URL}${prefix}/forum">Diễn đàn</a>
</nav></header>`;
  }
  return `<header><nav>
<a href="${SITE_URL}/">Home</a>
<a href="${SITE_URL}/blog">Blog</a>
<a href="${SITE_URL}/tools">Tools</a>
<a href="${SITE_URL}/tournaments">Tournaments</a>
<a href="${SITE_URL}/livestream">Livestream</a>
<a href="${SITE_URL}/news">News</a>
<a href="${SITE_URL}/videos">Videos</a>
<a href="${SITE_URL}/forum">Forum</a>
</nav></header>`;
}

function getFooterHtml(lang: Lang): string {
  const prefix = lang === "vi" ? "/vi" : "";
  if (lang === "vi") {
    return `<footer>
<p>&copy; 2026 ThePickleHub - Cộng đồng Pickleball Việt Nam</p>
<nav>
<a href="${SITE_URL}${prefix}/privacy">Chính sách bảo mật</a>
<a href="${SITE_URL}${prefix}/terms">Điều khoản sử dụng</a>
</nav>
</footer>`;
  }
  return `<footer>
<p>&copy; 2026 ThePickleHub - Pickleball Tournaments, Livestream &amp; Community</p>
<nav>
<a href="${SITE_URL}/privacy">Privacy Policy</a>
<a href="${SITE_URL}/terms">Terms of Service</a>
</nav>
</footer>`;
}

// Keep backwards compat constants for existing code
const HEADER_HTML = getHeaderHtml("en");
const FOOTER_HTML = getFooterHtml("en");

function breadcrumb(crumbs: { label: string; href?: string }[]): string {
  return `<nav aria-label="breadcrumb"><ol>${crumbs
    .map((c, i) =>
      i < crumbs.length - 1
        ? `<li><a href="${c.href}">${escapeHtml(c.label)}</a></li>`
        : `<li>${escapeHtml(c.label)}</li>`,
    )
    .join(" &gt; ")}</ol></nav>`;
}

// ─── Related Links ─────────────────────────────────────────

const ALL_BLOGS = [
  { slug: "mlp-format-explained", title: "MLP Format Explained 2026" },
  { slug: "how-to-organize-pickleball-tournament", title: "Hướng dẫn tổ chức giải Pickleball" },
  { slug: "pickleball-round-robin-generator-guide", title: "Round Robin Generator Guide" },
  { slug: "pickleball-tournament-formats-explained", title: "Tournament Formats Explained" },
  { slug: "pickleball-bracket-templates", title: "Bracket Templates 2026" },
  { slug: "pickleball-scoring-rules-guide", title: "Pickleball Scoring Rules" },
  { slug: "pickleball-doubles-strategy-guide", title: "Doubles Strategy Guide" },
  { slug: "pickleball-live-streaming-guide", title: "Live Streaming Guide" },
  { slug: "best-pickleball-tournament-software-2026", title: "Best Tournament Software 2026" },
  { slug: "free-pickleball-bracket-generator", title: "Free Bracket Generator" },
  { slug: "how-to-create-pickleball-bracket", title: "How to Create a Bracket" },
];

const ALL_TOOLS = [
  { slug: "flex-tournament", title: "Flex Tournament Generator" },
  { slug: "doubles-elimination", title: "Double Elimination Bracket" },
  { slug: "quick-tables", title: "Quick Tables" },
  { slug: "team-match", title: "Team Match" },
];

function relatedBlogLinks(currentSlug: string): string {
  const related = ALL_BLOGS.filter((b) => b.slug !== currentSlug).slice(0, 3);
  return `<section><h2>Bài viết liên quan</h2><ul>${related
    .map((p) => `<li><a href="${SITE_URL}/blog/${p.slug}">${escapeHtml(p.title)}</a></li>`)
    .join("")}</ul></section>`;
}

function relatedToolLinks(currentSlug: string): string {
  const related = ALL_TOOLS.filter((t) => t.slug !== currentSlug);
  return `<section><h2>Công cụ khác</h2><ul>${related
    .map((t) => `<li><a href="${SITE_URL}/tools/${t.slug}">${escapeHtml(t.title)}</a></li>`)
    .join("")}</ul></section>`;
}

// ─── buildHtml ─────────────────────────────────────────────

function buildHtml(opts: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: string;
  jsonLd?: Record<string, unknown>;
  bodyContent?: string;
  extraMeta?: string;
  lang?: Lang;
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
    lang = "en",
  } = opts;

  const jsonLdScript = jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : "";

  const htmlLang = lang === "vi" ? "vi" : "en";
  const ogLocale = lang === "vi" ? "vi_VN" : "en_US";
  const headerHtml = getHeaderHtml(lang);
  const footerHtml = getFooterHtml(lang);

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
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
<meta property="og:locale" content="${ogLocale}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${escapeHtml(title)}"/>
<meta name="twitter:description" content="${escapeHtml(description)}"/>
<meta name="twitter:image" content="${escapeHtml(image)}"/>
${extraMeta}
${jsonLdScript}
</head>
<body>
${headerHtml}
<main>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(description)}</p>
${bodyContent}
</main>
${footerHtml}
</body>
</html>`;
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      Vary: "User-Agent",
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

  const liveItems = (liveRes.data || [])
    .map((l) => `<li><a href="${SITE_URL}/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`)
    .join("");
  const videoItems = (videoRes.data || [])
    .map((v) => `<li><a href="${SITE_URL}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`)
    .join("");

  const title = "ThePickleHub - Cộng đồng Pickleball Việt Nam";
  const description =
    "Nền tảng pickleball hàng đầu Việt Nam: giải đấu PPA Tour Asia, livestream trực tiếp, công cụ tạo bracket miễn phí và cộng đồng sôi động cho mọi trình độ.";

  return htmlResponse(
    buildHtml({
      title,
      description,
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
        <p>ThePickleHub là điểm đến cho người yêu pickleball tại Việt Nam — từ người mới bắt đầu đến VĐV chuyên nghiệp.</p>
        <ul>
          <li><a href="${SITE_URL}/tournaments">Lịch giải đấu</a> - Cập nhật mọi giải pickleball lớn tại Việt Nam và khu vực</li>
          <li><a href="${SITE_URL}/livestream">Livestream</a> - Xem trực tiếp các trận đấu pickleball</li>
          <li><a href="${SITE_URL}/tools">Công cụ tạo bracket</a> - Miễn phí, dùng được ngay</li>
          <li><a href="${SITE_URL}/blog">Blog hướng dẫn</a> - Luật chơi, kỹ thuật, chiến thuật</li>
          <li><a href="${SITE_URL}/forum">Diễn đàn</a> - Thảo luận với cộng đồng</li>
        </ul>
        ${liveItems ? `<h2>Livestream</h2><ul>${liveItems}</ul>` : ""}
        ${videoItems ? `<h2>Video mới</h2><ul>${videoItems}</ul>` : ""}
      `,
    }),
  );
}

async function renderLive(supabase: Supabase, id: string): Promise<Response> {
  const { data: ls } = await supabase
    .from("public_livestreams")
    .select("id, title, description, thumbnail_url, status, scheduled_start_at, ended_at, created_at, organization_id, tournament_id, mux_playback_id")
    .eq("id", id)
    .single();

  if (!ls) return render404(`/live/${id}`);

  const [orgRes, tournRes] = await Promise.all([
    ls.organization_id ? supabase.from("organizations").select("name").eq("id", ls.organization_id).single() : Promise.resolve({ data: null }),
    ls.tournament_id ? supabase.from("tournaments").select("name").eq("id", ls.tournament_id).single() : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name || "";
  const tournName = tournRes.data?.name || "";

  const isEnded = ls.status === "ended";
  const suffix = isEnded ? "Pickleball Replay" : "Pickleball Livestream";
  const rawTitle = tournName ? `${tournName} – ${ls.title}` : ls.title;
  const title = buildTitle(rawTitle, ` | ${suffix}`);
  const desc = buildMetaDescription(ls.description, { type: "video", title: ls.title });

  const videoUrl = ls.mux_playback_id ? `https://stream.mux.com/${ls.mux_playback_id}.m3u8` : null;
  const extraMeta = videoUrl
    ? `<meta property="og:video" content="${escapeHtml(videoUrl)}"/>
<meta property="og:video:type" content="text/html"/>
<meta property="og:video:width" content="1280"/>
<meta property="og:video:height" content="720"/>
${orgName ? `<meta property="article:author" content="${escapeHtml(orgName)}"/>` : ""}`
    : "";

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Livestream", href: `${SITE_URL}/livestream` },
    { label: ls.title },
  ]);

  return htmlResponse(
    buildHtml({
      title,
      description: desc,
      url: `${SITE_URL}/live/${id}`,
      image: absImage(ls.thumbnail_url),
      type: videoUrl ? "video.other" : "website",
      extraMeta,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: ls.title,
        description: desc,
        thumbnailUrl: absImage(ls.thumbnail_url),
        uploadDate: ls.created_at,
        ...(videoUrl ? { contentUrl: videoUrl } : {}),
      },
      bodyContent: bc,
    }),
  );
}

async function renderVideo(supabase: Supabase, id: string): Promise<Response> {
  const { data: v } = await supabase
    .from("videos")
    .select("id, title, description, thumbnail_url, duration_seconds, published_at, created_at, organization_id, tournament_id, mux_playback_id")
    .eq("id", id)
    .single();

  if (!v) return render404(`/watch/${id}`);

  const [orgRes, tournRes] = await Promise.all([
    v.organization_id ? supabase.from("organizations").select("name").eq("id", v.organization_id).single() : Promise.resolve({ data: null }),
    v.tournament_id ? supabase.from("tournaments").select("name").eq("id", v.tournament_id).single() : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name || "";
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
    { label: "Trang chủ", href: SITE_URL },
    { label: "Video", href: `${SITE_URL}/videos` },
    { label: v.title },
  ]);

  const relatedSection = `<section><h2>Xem thêm</h2><ul>
<li><a href="${SITE_URL}/videos">Xem thêm video pickleball</a></li>
<li><a href="${SITE_URL}/livestream">Xem livestream trực tiếp</a></li>
</ul></section>`;

  return htmlResponse(
    buildHtml({
      title,
      description: desc,
      url: `${SITE_URL}/watch/${id}`,
      image: absImage(v.thumbnail_url),
      type: videoUrl ? "video.other" : "website",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: v.title,
        description: desc,
        thumbnailUrl: absImage(v.thumbnail_url),
        uploadDate: v.published_at || v.created_at,
        ...(videoUrl ? { contentUrl: videoUrl } : {}),
        ...(durationIso ? { duration: durationIso } : {}),
      },
      bodyContent: `${bc}${relatedSection}`,
    }),
  );
}

async function renderTournamentDetail(supabase: Supabase, slug: string): Promise<Response> {
  const { data: t } = await supabase
    .from("tournaments")
    .select("id, name, description, status, start_date, end_date, slug")
    .eq("slug", slug)
    .single();

  if (!t) return render404(`/tournament/${slug}`);

  const statusText = t.status === "ongoing" ? "🔴 Đang diễn ra" : t.status === "upcoming" ? "📅 Sắp diễn ra" : "✅ Đã kết thúc";
  const title = buildTitle(t.name, " | Pickleball Tournament");
  const desc = buildMetaDescription(t.description, { type: "default", title: t.name });

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Giải đấu", href: `${SITE_URL}/tournaments` },
    { label: t.name },
  ]);

  return htmlResponse(
    buildHtml({
      title,
      description: desc,
      url: `${SITE_URL}/tournament/${t.slug}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: t.name,
        description: desc,
        url: `${SITE_URL}/tournament/${t.slug}`,
        sport: "Pickleball",
        eventStatus: "https://schema.org/EventScheduled",
        ...(t.start_date ? { startDate: t.start_date } : {}),
        ...(t.end_date ? { endDate: t.end_date } : {}),
      },
      bodyContent: `${bc}<p>${statusText}</p>`,
    }),
  );
}

async function renderTournaments(supabase: Supabase): Promise<Response> {
  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("id, name, slug, status")
    .in("status", ["ongoing", "upcoming"])
    .order("start_date", { ascending: false })
    .limit(20);

  const items = (tournaments || []).map((t) => `<li><a href="${SITE_URL}/tournament/${t.slug}">${escapeHtml(t.name)}</a></li>`).join("");

  return htmlResponse(
    buildHtml({
      title: "Giải đấu Pickleball | ThePickleHub",
      description: "Danh sách các giải đấu pickleball đang diễn ra và sắp tới tại Việt Nam. Xem lịch thi đấu, bảng đấu, kết quả trực tiếp và đăng ký tham gia giải pickleball.",
      url: `${SITE_URL}/tournaments`,
      bodyContent: items ? `<h2>Giải đấu</h2><ul>${items}</ul>` : "",
    }),
  );
}

async function renderVideos(supabase: Supabase): Promise<Response> {
  const { data: videos } = await supabase
    .from("videos")
    .select("id, title")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const items = (videos || []).map((v) => `<li><a href="${SITE_URL}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");

  return htmlResponse(
    buildHtml({
      title: "Video Pickleball | ThePickleHub",
      description: "Xem video pickleball chất lượng cao: highlight giải đấu, replay trận đấu, hướng dẫn kỹ thuật và chiến thuật chơi pickleball trên ThePickleHub.",
      url: `${SITE_URL}/videos`,
      bodyContent: items ? `<h2>Video</h2><ul>${items}</ul>` : "",
    }),
  );
}

async function renderNews(supabase: Supabase): Promise<Response> {
  const { data: news } = await supabase
    .from("news_items")
    .select("id, title, summary")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(20);

  const items = (news || []).map((n) => `<li>${escapeHtml(n.title)}: ${escapeHtml(n.summary?.slice(0, 80) || "")}</li>`).join("");

  return htmlResponse(
    buildHtml({
      title: "Tin tức Pickleball | ThePickleHub",
      description: "Tin tức pickleball mới nhất tại Việt Nam và thế giới: kết quả giải đấu PPA Tour Asia, World Cup Pickleball, sự kiện cộng đồng, và phân tích chuyên sâu từ ThePickleHub.",
      url: `${SITE_URL}/news`,
      bodyContent: items ? `<h2>Tin tức</h2><ul>${items}</ul>` : "",
    }),
  );
}

async function renderForum(supabase: Supabase): Promise<Response> {
  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id, title")
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .limit(20);

  const items = (posts || []).map((p) => `<li><a href="${SITE_URL}/forum/post/${p.id}">${escapeHtml(p.title)}</a></li>`).join("");

  return htmlResponse(
    buildHtml({
      title: "Diễn đàn Pickleball | ThePickleHub",
      description: "Diễn đàn pickleball Việt Nam lớn nhất - thảo luận kỹ thuật, review thiết bị, tìm sân chơi, kết nối VĐV. Tham gia cộng đồng pickleball ThePickleHub để chia sẻ và học hỏi.",
      url: `${SITE_URL}/forum`,
      bodyContent: items ? `<h2>Bài viết mới</h2><ul>${items}</ul>` : "",
    }),
  );
}

async function renderOrgDetail(supabase: Supabase, slug: string): Promise<Response> {
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, description, slug, logo_url")
    .eq("slug", slug)
    .single();

  if (!org) return render404(`/org/${slug}`);

  const title = buildTitle(org.name, " | Pickleball Creator");
  const desc = buildMetaDescription(org.description, { type: "default", title: org.name });

  return htmlResponse(
    buildHtml({
      title,
      description: desc,
      url: `${SITE_URL}/org/${org.slug}`,
      image: absImage(org.logo_url),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: org.name,
        url: `${SITE_URL}/org/${org.slug}`,
        ...(org.logo_url ? { logo: absImage(org.logo_url) } : {}),
      },
    }),
  );
}

async function renderQuickTable(supabase: Supabase, shareId: string): Promise<Response> {
  const { data: qt } = await supabase
    .from("quick_tables")
    .select("id, name, format, player_count, status, share_id")
    .eq("share_id", shareId)
    .single();

  if (!qt) return render404(`/tools/quick-tables/${shareId}`);

  const title = buildTitle(qt.name, " | Bảng đấu Pickleball");
  const desc = `Bảng đấu ${qt.name} – ${qt.player_count} VĐV, ${qt.format}. Xem kết quả trực tiếp trên ThePickleHub.`;

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Công cụ", href: `${SITE_URL}/tools` },
    { label: "Quick Tables", href: `${SITE_URL}/tools/quick-tables` },
    { label: qt.name },
  ]);

  return htmlResponse(
    buildHtml({
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
      bodyContent: `${bc}${relatedToolLinks("quick-tables")}`,
    }),
  );
}

async function renderTeamMatch(supabase: Supabase, id: string): Promise<Response> {
  const { data: tm } = await supabase
    .from("team_match_tournaments")
    .select("id, name, status")
    .eq("id", id)
    .single();

  if (!tm) return render404(`/tools/team-match/${id}`);

  const title = buildTitle(tm.name, " | Team Match Pickleball");
  const desc = `Giải đấu đội ${tm.name}. Xem lineup, kết quả và bảng xếp hạng trực tiếp trên ThePickleHub.`;

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Công cụ", href: `${SITE_URL}/tools` },
    { label: "Team Match", href: `${SITE_URL}/tools/team-match` },
    { label: tm.name },
  ]);

  return htmlResponse(
    buildHtml({
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
      bodyContent: `${bc}${relatedToolLinks("team-match")}`,
    }),
  );
}

async function renderDoublesElimination(supabase: Supabase, shareId: string): Promise<Response> {
  const { data: de } = await supabase
    .from("doubles_elimination_tournaments")
    .select("id, name, team_count, status, share_id")
    .eq("share_id", shareId)
    .single();

  if (!de) return render404(`/tools/doubles-elimination/${shareId}`);

  const title = buildTitle(de.name, " | Doubles Elimination");
  const desc = `Giải đấu loại trực tiếp ${de.name} – ${de.team_count} đội. Xem bracket và kết quả trực tiếp trên ThePickleHub.`;

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Công cụ", href: `${SITE_URL}/tools` },
    { label: "Doubles Elimination", href: `${SITE_URL}/tools/doubles-elimination` },
    { label: de.name },
  ]);

  return htmlResponse(
    buildHtml({
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
      bodyContent: `${bc}${relatedToolLinks("doubles-elimination")}`,
    }),
  );
}

async function renderFlexTournament(supabase: Supabase, shareId: string): Promise<Response> {
  const { data: ft } = await supabase
    .from("flex_tournaments")
    .select("id, name, status, share_id")
    .eq("share_id", shareId)
    .single();

  if (!ft) return render404(`/tools/flex-tournament/${shareId}`);

  const title = buildTitle(ft.name, " | Flex Tournament");
  const desc = `Giải đấu ${ft.name}. Tạo nhóm, xếp lịch thi đấu linh hoạt trên ThePickleHub.`;

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Công cụ", href: `${SITE_URL}/tools` },
    { label: "Flex Tournament", href: `${SITE_URL}/tools/flex-tournament` },
    { label: ft.name },
  ]);

  return htmlResponse(
    buildHtml({
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
      bodyContent: `${bc}${relatedToolLinks("flex-tournament")}`,
    }),
  );
}

function renderTools(): Response {
  return htmlResponse(
    buildHtml({
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
          <li><a href="${SITE_URL}/tools/quick-tables">Quick Tables – Round Robin &amp; Single Elimination</a></li>
          <li><a href="${SITE_URL}/tools/team-match">Team Match – MLP Format</a></li>
          <li><a href="${SITE_URL}/tools/doubles-elimination">Doubles Elimination Bracket</a></li>
          <li><a href="${SITE_URL}/tools/flex-tournament">Flex Tournament</a></li>
        </ul>
      `,
    }),
  );
}

// ─── Blog ──────────────────────────────────────────────────

const BLOG_POST_META: Record<string, { title: string; description: string }> = {
  "best-pickleball-tournament-software-2026": {
    title: "Best Pickleball Tournament Software 2026",
    description: "Compare the best pickleball tournament software in 2026. Free bracket generators, round robin tools, and MLP team match platforms for organizers. No signup required.",
  },
  "how-to-create-pickleball-bracket": {
    title: "How to Create a Pickleball Bracket",
    description: "Learn how to create a pickleball bracket for round robin, single elimination, and double elimination tournaments. Free bracket generator with real-time scoring.",
  },
  "pickleball-round-robin-generator-guide": {
    title: "Pickleball Round Robin Generator Guide 2026",
    description: "Free pickleball round robin generator with automatic scheduling, court rotation, and live scoring. Learn how to organize the perfect round robin tournament.",
  },
  "pickleball-scoring-rules-guide": {
    title: "Pickleball Scoring Rules 2026 | Beginner Guide",
    description: "Learn pickleball scoring rules for singles, doubles, and tournament play. Rally scoring vs side-out explained. Free digital scoring tool included.",
  },
  "how-to-organize-pickleball-tournament": {
    title: "How to Organize a Pickleball Tournament 2026",
    description: "Step-by-step guide to organizing a pickleball tournament. Venue, format selection, registration, scheduling, scoring, and free tools.",
  },
  "pickleball-doubles-strategy-guide": {
    title: "Pickleball Doubles Strategy & Tips 2026",
    description: "Master pickleball doubles strategy for tournaments. Partner communication, court positioning, stacking, and when to attack the kitchen.",
  },
  "pickleball-tournament-formats-explained": {
    title: "Pickleball Tournament Formats | Round Robin & More",
    description: "Complete guide to pickleball tournament formats: round robin, single elimination, double elimination, MLP team match, and flex tournaments.",
  },
  "pickleball-live-streaming-guide": {
    title: "Pickleball Live Streaming Guide 2026",
    description: "Watch pickleball live streams for free. Learn how to stream your own pickleball tournament online with The Pickle Hub's free livestreaming platform.",
  },
  "mlp-format-explained": {
    title: "MLP Format Explained 2026 | Major League Pickleball",
    description: "Learn how the MLP format works in pickleball. Complete guide to Major League Pickleball team match rules, dreambreaker, lineup strategy.",
  },
  "free-pickleball-bracket-generator": {
    title: "Free Pickleball Bracket Generator 2026",
    description: "Create free pickleball tournament brackets instantly. Round robin, single elimination, and double elimination bracket generator with real-time scoring.",
  },
  "pickleball-bracket-templates": {
    title: "Pickleball Bracket Templates 2026 | Free Download",
    description: "Free pickleball bracket templates for round robin, single elimination, and double elimination. Templates for 4, 8, 16, 32, and 64 players.",
  },
};

function renderBlogPost(slug: string): Response {
  const meta = BLOG_POST_META[slug];
  if (!meta) return render404(`/blog/${slug}`);

  const title = buildTitle(meta.title, " | ThePickleHub");

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Blog", href: `${SITE_URL}/blog` },
    { label: meta.title },
  ]);

  return htmlResponse(
    buildHtml({
      title,
      description: meta.description,
      url: `${SITE_URL}/blog/${slug}`,
      type: "article",
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: title,
        description: meta.description,
        url: `${SITE_URL}/blog/${slug}`,
        publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
      },
      bodyContent: `${bc}${relatedBlogLinks(slug)}`,
    }),
  );
}

function renderBlog(): Response {
  const blogLinks = Object.entries(BLOG_POST_META)
    .map(([slug, m]) => `<li><a href="${SITE_URL}/blog/${slug}">${escapeHtml(m.title)}</a></li>`)
    .join("");

  return htmlResponse(
    buildHtml({
      title: "Pickleball Blog – Tips & Guides | ThePickleHub",
      description: "Read the latest pickleball articles: tournament tips, software reviews, strategy guides and community stories on ThePickleHub.",
      url: `${SITE_URL}/blog`,
      bodyContent: `<h2>Blog Posts</h2><ul>${blogLinks}</ul>`,
    }),
  );
}

// ─── Forum Post ────────────────────────────────────────────

async function renderForumPost(supabase: Supabase, postId: string): Promise<Response> {
  const { data: post } = await supabase
    .from("forum_posts")
    .select("id, title, content")
    .eq("id", postId)
    .eq("is_hidden", false)
    .single();

  if (!post) return render404(`/forum/post/${postId}`);

  const rawDesc = (post.content || "").replace(/<[^>]*>/g, "").slice(0, 200);
  const desc = buildMetaDescription(rawDesc, { type: "forum-post", title: post.title });

  // Truncate forum post title
  const title = buildTitle(post.title, "");

  const bc = breadcrumb([
    { label: "Trang chủ", href: SITE_URL },
    { label: "Diễn đàn", href: `${SITE_URL}/forum` },
    { label: post.title.length > 40 ? post.title.slice(0, 40) + "…" : post.title },
  ]);

  const relatedSection = `<section><h2>Xem thêm</h2><ul>
<li><a href="${SITE_URL}/forum">Quay lại diễn đàn</a></li>
<li><a href="${SITE_URL}/blog">Đọc blog pickleball</a></li>
</ul></section>`;

  return htmlResponse(
    buildHtml({
      title,
      description: desc,
      url: `${SITE_URL}/forum/post/${postId}`,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "DiscussionForumPosting",
        headline: title,
        text: desc,
        url: `${SITE_URL}/forum/post/${postId}`,
      },
      bodyContent: `${bc}${relatedSection}`,
    }),
  );
}

// ─── 404 ───────────────────────────────────────────────────

function render404(path: string): Response {
  return htmlResponse(
    buildHtml({
      title: "404 - Không tìm thấy trang | ThePickleHub",
      description: "Trang bạn tìm không tồn tại. Quay lại trang chủ ThePickleHub để khám phá giải đấu, livestream và cộng đồng pickleball Việt Nam.",
      url: `${SITE_URL}${path}`,
      bodyContent: `<p>Trang bạn tìm không tồn tại.</p><p><a href="${SITE_URL}/">Quay lại trang chủ</a></p>`,
    }),
    404,
  );
}

// ─── Vietnamese Home ───────────────────────────────────────

async function renderHomeVi(supabase: Supabase): Promise<Response> {
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

  const liveItems = (liveRes.data || [])
    .map((l) => `<li><a href="${SITE_URL}/vi/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`)
    .join("");
  const videoItems = (videoRes.data || [])
    .map((v) => `<li><a href="${SITE_URL}/vi/watch/${v.id}">${escapeHtml(v.title)}</a></li>`)
    .join("");

  const title = "ThePickleHub - Cộng đồng Pickleball Việt Nam";
  const description =
    "Nền tảng pickleball hàng đầu Việt Nam: giải đấu PPA Tour Asia, livestream trực tiếp, công cụ tạo bracket miễn phí và cộng đồng sôi động cho mọi trình độ.";

  const hreflangMeta = `<link rel="alternate" hreflang="vi" href="${SITE_URL}/vi"/>
<link rel="alternate" hreflang="en" href="${SITE_URL}/"/>
<link rel="alternate" hreflang="x-default" href="${SITE_URL}/"/>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: `${SITE_URL}/vi`,
      lang: "vi",
      extraMeta: hreflangMeta,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "ThePickleHub",
        url: SITE_URL,
        logo: DEFAULT_OG_IMAGE,
      },
      bodyContent: `
        <p>ThePickleHub là điểm đến cho người yêu pickleball tại Việt Nam — từ người mới bắt đầu đến VĐV chuyên nghiệp.</p>
        <ul>
          <li><a href="${SITE_URL}/vi/tournaments">Lịch giải đấu</a> - Cập nhật mọi giải pickleball lớn tại Việt Nam và khu vực</li>
          <li><a href="${SITE_URL}/vi/livestream">Livestream</a> - Xem trực tiếp các trận đấu pickleball</li>
          <li><a href="${SITE_URL}/vi/tools">Công cụ tạo bracket</a> - Miễn phí, dùng được ngay</li>
          <li><a href="${SITE_URL}/vi/blog">Blog hướng dẫn</a> - Luật chơi, kỹ thuật, chiến thuật</li>
          <li><a href="${SITE_URL}/vi/forum">Diễn đàn</a> - Thảo luận với cộng đồng</li>
        </ul>
        ${liveItems ? `<h2>Livestream</h2><ul>${liveItems}</ul>` : ""}
        ${videoItems ? `<h2>Video mới</h2><ul>${videoItems}</ul>` : ""}
      `,
    }),
  );
}

// ─── Router ────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawPath = url.searchParams.get("path") || "/";
    const lang = detectLang(rawPath);
    const path = stripLangPrefix(rawPath);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let match: RegExpMatchArray | null;

    // Vietnamese home page (special handling with hreflang)
    if (lang === "vi" && (path === "/" || path === "")) {
      return await renderHomeVi(supabase);
    }

    // For /vi/* paths that map to same EN content, render with lang="vi" and correct canonical
    // For now, /vi/* pages use same content as EN but with Vietnamese header/footer/lang attribute
    // Vietnamese-specific content will be added in future phases

    // If it's a /vi/* path, we use the stripped path for routing but pass lang for rendering
    // For simplicity in this phase, /vi/* static pages get a basic Vietnamese wrapper

    // Home
    if (path === "/" || path === "") return await renderHome(supabase);

    // Livestream detail
    match = path.match(/^\/live\/([^/]+)$/);
    if (match) return await renderLive(supabase, match[1]);

    // Video detail
    match = path.match(/^\/watch\/([^/]+)$/);
    if (match) return await renderVideo(supabase, match[1]);

    // Tournament detail
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

    // Forum post detail
    match = path.match(/^\/forum\/post\/([^/]+)$/);
    if (match) return await renderForumPost(supabase, match[1]);

    // Organization detail
    match = path.match(/^\/org\/([^/]+)$/);
    if (match) return await renderOrgDetail(supabase, match[1]);

    // Quick Table
    match = path.match(/^\/tools\/quick-tables\/([^/]+)$/);
    if (match) return await renderQuickTable(supabase, match[1]);

    // Team Match
    match = path.match(/^\/tools\/team-match\/([^/]+)$/);
    if (match) return await renderTeamMatch(supabase, match[1]);

    // Doubles Elimination
    match = path.match(/^\/tools\/doubles-elimination\/([^/]+)$/);
    if (match) return await renderDoublesElimination(supabase, match[1]);

    // Flex Tournament
    match = path.match(/^\/tools\/flex-tournament\/([^/]+)$/);
    if (match) return await renderFlexTournament(supabase, match[1]);

    // Tools (static)
    if (path.startsWith("/tools")) return renderTools();

    // Blog post detail
    match = path.match(/^\/blog\/([^/]+)$/);
    if (match) return renderBlogPost(match[1]);

    // Blog index
    if (path === "/blog") return renderBlog();

    // Livestream listing
    if (path === "/livestream")
      return htmlResponse(
        buildHtml({
          title: "Livestream Pickleball | ThePickleHub",
          description: "Xem livestream pickleball trực tiếp tại Việt Nam. Các giải đấu, trận đấu đang phát sóng trực tuyến miễn phí trên ThePickleHub. Không cần đăng ký.",
          url: `${SITE_URL}${rawPath}`,
          lang,
        }),
      );

    // Privacy
    if (path === "/privacy")
      return htmlResponse(
        buildHtml({
          title: lang === "vi" ? "Chính sách bảo mật | ThePickleHub" : "Privacy Policy | ThePickleHub",
          description: "Chính sách bảo mật của ThePickleHub - nền tảng pickleball Việt Nam. Tìm hiểu cách chúng tôi thu thập, sử dụng và bảo vệ thông tin cá nhân của bạn khi sử dụng dịch vụ.",
          url: `${SITE_URL}${rawPath}`,
          lang,
        }),
      );

    // Terms
    if (path === "/terms")
      return htmlResponse(
        buildHtml({
          title: lang === "vi" ? "Điều khoản sử dụng | ThePickleHub" : "Terms of Service | ThePickleHub",
          description: "Điều khoản sử dụng của ThePickleHub - nền tảng pickleball Việt Nam. Đọc kỹ các quy định khi sử dụng dịch vụ livestream, công cụ bracket, blog và diễn đàn pickleball.",
          url: `${SITE_URL}${rawPath}`,
          lang,
        }),
      );

    // Fallback → 404
    return render404(rawPath);
  } catch (err) {
    console.error("Prerender error:", err);
    return new Response("Internal server error", {
      status: 500,
      headers: corsHeaders,
    });
  }
});
