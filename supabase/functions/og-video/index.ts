import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const videoId = url.searchParams.get("id");
    
    const userAgent = req.headers.get("user-agent") || "";
    const isCrawler = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Zalobot|WhatsApp|Discordbot|Slackbot|bingbot|Googlebot/i.test(userAgent);

    if (!videoId) {
      return new Response("Missing video ID", { status: 400 });
    }

    // For regular browsers: immediately 302 redirect to the actual page
    if (!isCrawler) {
      const redirectUrl = `${SITE_URL}/video/${videoId}`;
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": redirectUrl,
        },
      });
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Fetch video data with tournament info
    const { data: video, error } = await supabase
      .from("videos")
      .select(`
        id,
        title,
        description,
        thumbnail_url,
        duration_seconds,
        published_at,
        created_at,
        organization_id,
        tournament_id,
        mux_playback_id
      `)
      .eq("id", videoId)
      .single();

    if (error || !video) {
      console.error("Video not found:", error);
      return new Response("Video not found", { status: 404 });
    }

    // Fetch organization and tournament in parallel
    const [orgResult, tournamentResult] = await Promise.all([
      video.organization_id
        ? supabase.from("organizations").select("name").eq("id", video.organization_id).single()
        : Promise.resolve({ data: null }),
      video.tournament_id
        ? supabase.from("tournaments").select("name").eq("id", video.tournament_id).single()
        : Promise.resolve({ data: null }),
    ]);
    const organizationName = orgResult.data?.name || "";
    const tournamentName = tournamentResult.data?.name || "";

    // Build OG meta data with proper SEO format
    const rawTitle = video.title || "Video";
    
    // Title format: {Tournament Name} – {Video Title} | Pickleball Video
    let ogTitle: string;
    if (tournamentName) {
      ogTitle = `${tournamentName} – ${rawTitle} | Pickleball Video`;
    } else {
      ogTitle = `${rawTitle} | Pickleball Video`;
    }
    
    // Description format
    let ogDescription: string;
    if (video.description && video.description.trim()) {
      ogDescription = video.description.slice(0, 160);
    } else {
      const parts: string[] = [];
      parts.push(`Xem video: ${rawTitle}.`);
      if (tournamentName) {
        parts.push(`Giải đấu: ${tournamentName}.`);
      }
      if (organizationName) {
        parts.push(`Bởi ${organizationName}.`);
      }
      parts.push(`Video pickleball chất lượng cao trên ${SITE_NAME}.`);
      ogDescription = parts.join(" ").slice(0, 160);
    }
    
    // Ensure absolute URL for thumbnail
    let ogImage = DEFAULT_OG_IMAGE;
    if (video.thumbnail_url) {
      if (video.thumbnail_url.startsWith("http")) {
        ogImage = video.thumbnail_url;
      } else {
        ogImage = `${SITE_URL}${video.thumbnail_url.startsWith("/") ? "" : "/"}${video.thumbnail_url}`;
      }
    }
    
    // Canonical URL for redirect (where users end up)
    const canonicalUrl = `${SITE_URL}/video/${videoId}`;
    const ogUrl = `https://www.thepicklehub.net/video/${videoId}`;
    
    // Build og:type logic based on mux_playback_id
    const hasVideo = !!video.mux_playback_id;
    const videoUrl = hasVideo ? `https://stream.mux.com/${video.mux_playback_id}.m3u8` : null;

    // Published time and duration
    const publishedTime = video.published_at || video.created_at;
    const duration = video.duration_seconds ? Math.round(video.duration_seconds) : null;

    // Generate HTML with complete OG tags
    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- IMPORTANT: noindex for share URLs -->
  <meta name="robots" content="noindex, nofollow" />
  
  <!-- Primary Meta Tags -->
  <title>${escapeHtml(ogTitle)}</title>
  <meta name="title" content="${escapeHtml(ogTitle)}" />
  <meta name="description" content="${escapeHtml(ogDescription)}" />
  
  <!-- Open Graph / Facebook -->
  ${hasVideo ? `<meta property="og:type" content="video.other" />
  <meta property="og:video" content="${escapeHtml(videoUrl!)}" />
  <meta property="og:video:type" content="text/html" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
  ${duration ? `<meta property="video:duration" content="${duration}" />` : ""}` : `<meta property="og:type" content="article" />`}
  <meta property="og:url" content="${ogUrl}" />
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
  

</head>
<body>
  <h1>${escapeHtml(ogTitle)}</h1>
  <p>${escapeHtml(ogDescription)}</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=600",
      },
    });
  } catch (err) {
    console.error("Error generating OG page:", err);
    return new Response("Internal server error", { status: 500 });
  }
});

// Helper to escape HTML entities
function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
