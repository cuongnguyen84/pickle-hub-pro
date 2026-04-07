const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://www.thepicklehub.net";
const DEFAULT_OG_IMAGE = "https://www.thepicklehub.net/og-image.png";
const SITE_NAME = "ThePickleHub";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const shareId = url.searchParams.get("id");
    const userAgent = req.headers.get("user-agent") || "";

    // Detect bots (Facebook, Zalo, Telegram, Twitter, etc.)
    const isBot = /facebookexternalhit|facebot|Facebot|zalobot|Twitterbot|TelegramBot|WhatsApp|LinkedInBot|Slackbot|Discordbot|Googlebot|bingbot/i.test(userAgent);

    const canonicalUrl = shareId 
      ? `${SITE_URL}/tools/quick-tables/${shareId}` 
      : `${SITE_URL}/tools/quick-tables`;

    // Non-bot → redirect immediately
    if (!isBot) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: canonicalUrl },
      });
    }

    // No shareId → list page OG
    if (!shareId) {
      return serveHtml({
        title: "Quick Tournament – Tạo giải đấu pickleball nhanh | ThePickleHub",
        description: "Tạo giải đấu pickleball round-robin nhanh chóng. Chia bảng tự động, quản lý điểm số real-time, playoff. Miễn phí trên ThePickleHub.",
        image: DEFAULT_OG_IMAGE,
        url: canonicalUrl,
      });
    }

    // Fetch tournament data
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: table, error } = await supabase
      .from("quick_tables")
      .select("id, name, share_id, status, player_count, group_count, is_doubles, format, start_time")
      .eq("share_id", shareId)
      .single();

    if (error || !table) {
      return serveHtml({
        title: "Giải đấu không tồn tại | ThePickleHub",
        description: "Giải đấu này không tồn tại hoặc đã bị xóa.",
        image: DEFAULT_OG_IMAGE,
        url: canonicalUrl,
      });
    }

    // Get actual player count from quick_table_players
    const { count: actualPlayerCount } = await supabase
      .from("quick_table_players")
      .select("*", { count: "exact", head: true })
      .eq("table_id", table.id);

    // Get match count
    const { count: matchCount } = await supabase
      .from("quick_table_matches")
      .select("*", { count: "exact", head: true })
      .eq("table_id", table.id);

    const statusMap: Record<string, string> = {
      setup: "🔧 Đang thiết lập",
      "group-stage": "⚡ Vòng bảng",
      playoff: "🏆 Playoff",
      completed: "✅ Đã kết thúc",
    };
    const statusText = statusMap[table.status] || table.status;

    const formatText = table.is_doubles ? "Đôi" : "Đơn";
    const players = actualPlayerCount || table.player_count || 0;
    const groups = table.group_count || 1;

    const ogTitle = `${table.name} | Quick Tournament`;
    const ogDescription = `${statusText} • ${formatText} • ${players} VĐV • ${groups} bảng • ${matchCount || 0} trận. Xem kết quả trực tiếp trên ThePickleHub.`;

    return serveHtml({
      title: ogTitle,
      description: ogDescription,
      image: DEFAULT_OG_IMAGE,
      url: canonicalUrl,
    });
  } catch (error) {
    console.error("Error in og-quick-table:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

interface OGParams {
  title: string;
  description: string;
  image: string;
  url: string;
}

function serveHtml({ title, description, image, url }: OGParams) {
  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  
  <title>${esc(title)}</title>
  <meta name="title" content="${esc(title)}">
  <meta name="description" content="${esc(description)}">
  
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="vi_VN">
  
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${url}">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${image}">
  
  <link rel="canonical" href="${url}">
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>Đang chuyển hướng...</p>
  <script>window.location.href = "${url}";</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
