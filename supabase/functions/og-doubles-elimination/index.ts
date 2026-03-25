const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://thepicklehub.net";
const DEFAULT_OG_IMAGE = "https://thepicklehub.net/og-image.png";
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

    const isBot = /facebookexternalhit|facebot|Facebot|zalobot|Twitterbot|TelegramBot|WhatsApp|LinkedInBot|Slackbot|Discordbot|Googlebot|bingbot/i.test(userAgent);

    const canonicalUrl = shareId
      ? `${SITE_URL}/tools/doubles-elimination/${shareId}`
      : `${SITE_URL}/tools/doubles-elimination`;

    if (!isBot) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, Location: canonicalUrl },
      });
    }

    if (!shareId) {
      return serveHtml({
        title: "Doubles Elimination – Giải đấu loại trực tiếp đôi | ThePickleHub",
        description: "Tạo bracket giải đấu loại trực tiếp dành cho đôi. Quản lý vòng sơ loại, playoff, theo dõi điểm số real-time. Miễn phí trên ThePickleHub.",
        image: DEFAULT_OG_IMAGE,
        url: canonicalUrl,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: tournament, error } = await supabase
      .from("doubles_elimination_tournaments")
      .select("id, name, share_id, status, team_count, early_rounds_format, finals_format, created_at")
      .eq("share_id", shareId)
      .single();

    if (error || !tournament) {
      return serveHtml({
        title: "Giải đấu không tồn tại | ThePickleHub",
        description: "Giải đấu này không tồn tại hoặc đã bị xóa.",
        image: DEFAULT_OG_IMAGE,
        url: canonicalUrl,
      });
    }

    const { count: matchCount } = await supabase
      .from("doubles_elimination_matches")
      .select("*", { count: "exact", head: true })
      .eq("tournament_id", tournament.id);

    const statusMap: Record<string, string> = {
      setup: "🔧 Đang thiết lập",
      ongoing: "⚡ Đang diễn ra",
      completed: "✅ Đã kết thúc",
    };
    const statusText = statusMap[tournament.status] || tournament.status;

    const ogTitle = `${tournament.name} | Doubles Elimination`;
    const ogDescription = `${statusText} • ${tournament.team_count} đội • ${matchCount || 0} trận • ${(tournament.early_rounds_format || "bo1").toUpperCase()} / ${(tournament.finals_format || "bo3").toUpperCase()}. Xem bracket và kết quả trên ThePickleHub.`;

    return serveHtml({
      title: ogTitle,
      description: ogDescription,
      image: DEFAULT_OG_IMAGE,
      url: canonicalUrl,
    });
  } catch (error) {
    console.error("Error in og-doubles-elimination:", error);
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
