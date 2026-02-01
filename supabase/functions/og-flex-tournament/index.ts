import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://thepicklehub.net";
const DEFAULT_OG_IMAGE = "https://thepicklehub.net/og-image.png";
const SITE_NAME = "ThePickleHub";

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("id");

    // If no shareId, serve list page OG
    if (!shareId) {
      return serveListPageOG();
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tournament data by share_id
    const { data: tournament, error } = await supabase
      .from("flex_tournaments")
      .select(`
        id,
        name,
        share_id,
        is_public,
        status,
        created_at,
        creator_user_id
      `)
      .eq("share_id", shareId)
      .single();

    if (error || !tournament) {
      console.error("Tournament not found:", error);
      return serveNotFoundOG(shareId);
    }

    // Get player count
    const { count: playerCount } = await supabase
      .from("flex_players")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament.id);

    // Get match count
    const { count: matchCount } = await supabase
      .from("flex_matches")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament.id);

    // Build OG meta content
    const ogTitle = `${tournament.name} | Flex Tournament`;
    
    const statusText = tournament.status === "active" ? "Đang diễn ra" : 
                       tournament.status === "completed" ? "Đã kết thúc" : "Chuẩn bị";
    
    const ogDescription = `${statusText} • ${playerCount || 0} VĐV • ${matchCount || 0} trận đấu. Xem bracket và kết quả trực tiếp trên ThePickleHub.`;

    const canonicalUrl = `${SITE_URL}/tools/flex-tournament/${tournament.share_id}`;

    // Generate HTML with OG tags
    const html = generateOGHtml({
      title: ogTitle,
      description: ogDescription,
      image: DEFAULT_OG_IMAGE,
      url: canonicalUrl,
      type: "website",
    });

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error in og-flex-tournament:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

function serveListPageOG() {
  const ogTitle = "Flex Tournament - Custom Tournament Bracket Maker | ThePickleHub";
  const ogDescription = "Tạo bracket giải đấu pickleball linh hoạt với Flex Tournament. Tự do thiết kế format, quản lý nhóm, theo dõi điểm số real-time. Miễn phí, không cần đăng ký.";
  const canonicalUrl = `${SITE_URL}/tools/flex-tournament`;

  const html = generateOGHtml({
    title: ogTitle,
    description: ogDescription,
    image: DEFAULT_OG_IMAGE,
    url: canonicalUrl,
    type: "website",
  });

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function serveNotFoundOG(shareId: string) {
  const canonicalUrl = `${SITE_URL}/tools/flex-tournament/${shareId}`;
  
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
  <title>Giải đấu không tồn tại | ${SITE_NAME}</title>
</head>
<body>
  <script>window.location.href = "${canonicalUrl}";</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

interface OGParams {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
}

function generateOGHtml({ title, description, image, url, type }: OGParams): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Prevent indexing of share URLs -->
  <meta name="robots" content="noindex, nofollow">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(title)}</title>
  <meta name="title" content="${escapeHtml(title)}">
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="vi_VN">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${url}">
  
  <!-- Redirect to actual page -->
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>Đang chuyển hướng...</p>
  <script>window.location.href = "${url}";</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
