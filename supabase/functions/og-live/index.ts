import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = "https://thepicklehub.net";
const DEFAULT_OG_IMAGE = "https://thepicklehub.net/og-image.png";
const SITE_NAME = "ThePickleHub";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const livestreamId = url.searchParams.get("id");

    if (!livestreamId) {
      return new Response("Missing livestream ID", { status: 400 });
    }

    // Fetch livestream data
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    const { data: livestream, error } = await supabase
      .from("public_livestreams")
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        status,
        scheduled_start_at,
        created_at,
        organization_id
      `)
      .eq("id", livestreamId)
      .single();

    if (error || !livestream) {
      console.error("Livestream not found:", error);
      return new Response("Livestream not found", { status: 404 });
    }

    // Fetch organization name
    let organizationName = "";
    if (livestream.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", livestream.organization_id)
        .single();
      organizationName = org?.name || "";
    }

    // Build OG meta data
    const title = livestream.title || "Livestream";
    const fullTitle = `${title} | ${SITE_NAME}`;
    const description = livestream.description 
      ? livestream.description.slice(0, 160) 
      : `Xem livestream ${title} trên ${SITE_NAME}. ${organizationName ? `Phát bởi ${organizationName}.` : ''} Trực tiếp các giải đấu pickleball.`;
    
    const ogImage = livestream.thumbnail_url || DEFAULT_OG_IMAGE;
    const canonicalUrl = `${SITE_URL}/live/${livestreamId}`;
    const publishedTime = livestream.scheduled_start_at || livestream.created_at;

    // Generate HTML with OG tags
    const html = `<!DOCTYPE html>
<html lang="vi" prefix="og: https://ogp.me/ns#">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="title" content="${escapeHtml(fullTitle)}">
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="video.other">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta property="og:locale" content="vi_VN">
  ${organizationName ? `<meta property="article:author" content="${escapeHtml(organizationName)}">` : ''}
  ${publishedTime ? `<meta property="article:published_time" content="${publishedTime}">` : ''}
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${canonicalUrl}">
  <meta name="twitter:title" content="${escapeHtml(fullTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(ogImage)}">
  
  <!-- Canonical -->
  <link rel="canonical" href="${canonicalUrl}">
  
  <!-- Redirect to actual page for browsers -->
  <meta http-equiv="refresh" content="0; url=${canonicalUrl}">
  <script>window.location.replace("${canonicalUrl}");</script>
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">${escapeHtml(title)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("Error generating OG page:", err);
    return new Response("Internal server error", { status: 500 });
  }
});

// Helper to escape HTML entities
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
