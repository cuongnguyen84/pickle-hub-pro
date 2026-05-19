/**
 * og-image-club — 1200×630 PNG OG image for /clb/{slug}.
 *
 * PR79 Phase 2E (audit I-6). Mirrors the og-image-match pattern:
 * Satori → resvg-wasm → PNG via @vercel/og. Public-facing URL is wired
 * by the CF Pages Function at functions/og/clb/[slug].png.ts which
 * proxies + caches in KV (7d TTL).
 *
 * URL contract
 * ============
 * GET /functions/v1/og-image-club?slug={slug}
 *
 * Layout (1200 × 630)
 * ===================
 * - Background: linear gradient #00B86B → #008C52
 * - Top: ThePickleHub wordmark · "Câu lạc bộ" eyebrow
 * - Center: club name (clamped 2 lines), location, upcoming-event count
 * - Bottom: tagline "Đăng ký bằng số điện thoại trên ThePickleHub"
 */

// @ts-expect-error — Deno npm: imports
import { ImageResponse } from "npm:@vercel/og@0.6.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import React from "npm:react@18.3.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URL_SAFE_SLUG = /^[a-z0-9-]+$/;
const FONT_URL = "https://rsms.me/inter/font-files/Inter-Bold.woff";

let _fontPromise: Promise<ArrayBuffer | null> | null = null;
function getInterBold(): Promise<ArrayBuffer | null> {
  if (!_fontPromise) {
    _fontPromise = fetch(FONT_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return _fontPromise;
}

interface ClubOgData {
  name: string;
  location_text: string | null;
  upcoming_events: number;
}

async function fetchClubData(slug: string): Promise<ClubOgData | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: club, error } = await supabase
    .from("clubs")
    .select("id, name, location_text")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !club) return null;
  const c = club as { id: string; name: string; location_text: string | null };

  // Upcoming count is a nice-to-have; if the query fails just default to 0
  // and the card still renders cleanly.
  let upcoming = 0;
  try {
    const { count } = await supabase
      .from("social_events")
      .select("id", { count: "exact", head: true })
      .eq("club_id", c.id)
      .eq("status", "published")
      .eq("visibility", "public")
      .gte("end_at", new Date().toISOString());
    upcoming = count ?? 0;
  } catch {
    // non-fatal
  }

  return {
    name: c.name,
    location_text: c.location_text,
    upcoming_events: upcoming,
  };
}

async function buildImageResponse(data: ClubOgData): Promise<Response> {
  const fontBuffer = await getInterBold();
  const fonts = fontBuffer
    ? [{ name: "Inter", data: fontBuffer, weight: 700 as const, style: "normal" as const }]
    : undefined;

  const upcomingLabel = data.upcoming_events > 0
    ? `${data.upcoming_events} sự kiện sắp diễn ra`
    : "Sẵn sàng mở sự kiện mới";

  const root = React.createElement(
    "div",
    {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(135deg, #00B86B 0%, #008C52 100%)",
        color: "#FFFFFF",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: "60px 80px",
        position: "relative",
      },
    },
    // Top brand row
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "24px",
          opacity: 0.9,
          letterSpacing: "0.04em",
        },
      },
      React.createElement("div", { style: { display: "flex", fontWeight: 700 } }, "ThePickleHub"),
      React.createElement(
        "div",
        { style: { display: "flex", textTransform: "uppercase" } },
        "Câu lạc bộ",
      ),
    ),
    // Center: name + location + event count
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "24px",
          marginTop: "20px",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "72px",
            fontWeight: 700,
            lineHeight: 1.15,
            maxWidth: "1040px",
            overflow: "hidden",
          },
        },
        data.name,
      ),
      data.location_text
        ? React.createElement(
            "div",
            { style: { display: "flex", fontSize: "34px", opacity: 0.9 } },
            data.location_text,
          )
        : React.createElement("div", { style: { display: "flex" } }, ""),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "30px",
            opacity: 0.95,
            fontFamily: "monospace",
            letterSpacing: "0.02em",
          },
        },
        upcomingLabel,
      ),
    ),
    // Bottom tagline
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          fontSize: "24px",
          opacity: 0.85,
        },
      },
      "Đăng ký bằng số điện thoại trên ThePickleHub",
    ),
  );

  return new ImageResponse(root, {
    width: 1200,
    height: 630,
    fonts,
    headers: {
      "Cache-Control": "public, max-age=604800, immutable",
      ...corsHeaders,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get("slug")?.trim().toLowerCase();

    if (!slug || !URL_SAFE_SLUG.test(slug)) {
      return new Response("Invalid or missing slug", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const data = await fetchClubData(slug);
    if (!data) {
      return new Response("Club not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return await buildImageResponse(data);
  } catch (err) {
    console.error("og-image-club error:", err);
    return new Response("Server error generating OG image", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
