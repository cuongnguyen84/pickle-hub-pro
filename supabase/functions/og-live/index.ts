import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const livestreamId = url.searchParams.get("id");

    if (!livestreamId) {
      return new Response("Missing livestream ID", { status: 400 });
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch livestream data with tournament info
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
        organization_id,
        tournament_id
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

    // Fetch tournament name if linked
    let tournamentName = "";
    if (livestream.tournament_id) {
      const { data: tournament } = await supabase
        .from("tournaments")
        .select("name")
        .eq("id", livestream.tournament_id)
        .single();
      tournamentName = tournament?.name || "";
    }

    // Build OG meta data with proper SEO format
    const rawTitle = livestream.title || "Livestream";
    
    // Title format: {Tournament Name} – {Livestream Title} | Pickleball Livestream
    // Or if no tournament: {Livestream Title} | Pickleball Livestream
    let ogTitle: string;
    if (tournamentName) {
      ogTitle = `${tournamentName} – ${rawTitle} | Pickleball Livestream`;
    } else {
      ogTitle = `${rawTitle} | Pickleball Livestream`;
    }
    
    // Description format: Watch live pickleball match. Streaming now on ThePickleHub.
    let ogDescription: string;
    if (livestream.description && livestream.description.trim()) {
      ogDescription = livestream.description.slice(0, 160);
    } else {
      const parts: string[] = [];
      parts.push(`Xem trực tiếp: ${rawTitle}.`);
      if (tournamentName) {
        parts.push(`Giải đấu: ${tournamentName}.`);
      }
      if (organizationName) {
        parts.push(`Phát bởi ${organizationName}.`);
      }
      parts.push(`Trực tiếp trên ${SITE_NAME}.`);
      ogDescription = parts.join(" ").slice(0, 160);
    }
    
    // Ensure absolute URL for thumbnail
    let ogImage = DEFAULT_OG_IMAGE;
    if (livestream.thumbnail_url) {
      if (livestream.thumbnail_url.startsWith("http")) {
        ogImage = livestream.thumbnail_url;
      } else {
        // If relative, make absolute
        ogImage = `${SITE_URL}${livestream.thumbnail_url.startsWith("/") ? "" : "/"}${livestream.thumbnail_url}`;
      }
    }
    
    // Canonical URL - the actual page URL (NOT the share URL)
    const canonicalUrl = `${SITE_URL}/live/${livestreamId}`;
    
    // Published time
    const publishedTime = livestream.scheduled_start_at || livestream.created_at;

    // Generate HTML with complete OG tags
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- IMPORTANT: noindex for share URLs - only canonical page should be indexed -->
  <meta name="robots" content="noindex, nofollow" />
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="title" content="${escapeHtml(ogTitle)}" />
  <meta name="description" content="${escapeHtml(ogDescription)}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="video.other" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(ogTitle)}" />
  <meta property="og:description" content="${escapeHtml(ogDescription)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:url" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:secure_url" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="${SITE_NAME}" />
  <meta property="og:locale" content="vi_VN" />
  ${organizationName ? `<meta property="article:author" content="${escapeHtml(organizationName)}" />` : ""}
  ${publishedTime ? `<meta property="article:published_time" content="${publishedTime}" />` : ""}
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  
  <!-- DO NOT set canonical here - this is a redirect page, not the real content -->
  
  <!-- Redirect to actual page for browsers -->
  <meta http-equiv="refresh" content="0; url=${canonicalUrl}" />
</head>
<body>
  <p>Redirecting to <a href="${canonicalUrl}">${escapeHtml(rawTitle)}</a>...</p>
  <script>window.location.replace("${canonicalUrl}");</script>
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

// Helper to escape HTML entities for safe embedding in HTML attributes
function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
