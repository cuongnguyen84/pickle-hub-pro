import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response("Missing slug parameter", { status: 400 });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const isCrawler = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Zalobot|WhatsApp|Discordbot|Slackbot|bingbot|Googlebot/i.test(userAgent);

    // For regular browsers: immediately 302 redirect
    if (!isCrawler) {
      return new Response(null, {
        status: 302,
        headers: { ...corsHeaders, "Location": `${SITE_URL}/tournament/${slug}` },
      });
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch tournament data
    const { data: tournament, error } = await supabase
      .from("tournaments")
      .select("id, name, description, status, start_date, end_date, slug")
      .eq("slug", slug)
      .single();

    if (error || !tournament) {
      console.error("Tournament not found:", error);
      // Redirect to 404 or home
      return new Response(
        `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${SITE_URL}/tournament/${slug}">
  <title>Giải đấu không tồn tại | ${SITE_NAME}</title>
</head>
<body>
  <script>window.location.href = "${SITE_URL}/tournament/${slug}";</script>
</body>
</html>`,
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/html; charset=utf-8",
          },
        }
      );
    }

    // Build OG meta content
    const statusText = tournament.status === "ongoing" 
      ? "🔴 Đang diễn ra" 
      : tournament.status === "upcoming" 
        ? "📅 Sắp diễn ra" 
        : "✅ Đã kết thúc";

    const ogTitle = `${tournament.name} | Pickleball Tournament`;
    
    const ogDescription = tournament.description 
      || `${statusText}: ${tournament.name}. Xem lịch thi đấu, bảng đấu và kết quả trực tiếp trên ThePickleHub.`;

    const ogImage = DEFAULT_OG_IMAGE;
    const canonicalUrl = `${SITE_URL}/tournament/${tournament.slug}`;

    // Format dates if available
    let dateInfo = "";
    if (tournament.start_date) {
      const startDate = new Date(tournament.start_date).toLocaleDateString("vi-VN");
      if (tournament.end_date) {
        const endDate = new Date(tournament.end_date).toLocaleDateString("vi-VN");
        dateInfo = `${startDate} - ${endDate}`;
      } else {
        dateInfo = startDate;
      }
    }

    // Generate HTML with OG tags
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Prevent indexing of share URLs -->
  <meta name="robots" content="noindex, nofollow">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="title" content="${escapeHtml(ogTitle)}">
  <meta name="description" content="${escapeHtml(ogDescription)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="vi_VN">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${ogImage}">
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Redirect to actual page -->
  <meta http-equiv="refresh" content="0;url=${canonicalUrl}">
</head>
<body>
  <p>Đang chuyển hướng đến ${escapeHtml(tournament.name)}${dateInfo ? ` (${dateInfo})` : ""}...</p>
  <script>window.location.href = "${canonicalUrl}";</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=600",
      },
    });
  } catch (error) {
    console.error("Error in og-tournament:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
