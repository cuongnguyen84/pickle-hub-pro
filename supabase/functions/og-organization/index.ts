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
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response("Missing slug parameter", { status: 400 });
    }

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch organization data
    const { data: org, error } = await supabase
      .from("organizations")
      .select("id, name, description, slug, logo_url, display_logo")
      .eq("slug", slug)
      .single();

    if (error || !org) {
      console.error("Organization not found:", error);
      // Redirect to 404 or home
      return new Response(
        `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="refresh" content="0;url=${SITE_URL}/org/${slug}">
  <title>Tổ chức không tồn tại | ${SITE_NAME}</title>
</head>
<body>
  <script>window.location.href = "${SITE_URL}/org/${slug}";</script>
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
    const ogTitle = `${org.name} | Pickleball Creator`;
    
    const ogDescription = org.description 
      || `${org.name} - Nhà tổ chức giải đấu Pickleball. Xem livestream, video và các giải đấu trên ThePickleHub.`;

    // Use display_logo first, fallback to logo_url, then default
    let ogImage = DEFAULT_OG_IMAGE;
    if (org.display_logo) {
      ogImage = org.display_logo.startsWith("http") 
        ? org.display_logo 
        : `${SITE_URL}${org.display_logo}`;
    } else if (org.logo_url) {
      ogImage = org.logo_url.startsWith("http") 
        ? org.logo_url 
        : `${SITE_URL}${org.logo_url}`;
    }

    const canonicalUrl = `${SITE_URL}/org/${org.slug}`;

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
  <p>Đang chuyển hướng đến ${escapeHtml(org.name)}...</p>
  <script>window.location.href = "${canonicalUrl}";</script>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Error in og-organization:", error);
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
