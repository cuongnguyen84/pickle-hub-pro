/**
 * og-image-player — 1200x630 PNG OG image for /nguoi-choi/{username}.
 *
 * Phase B (shareable rating card). Generates a branded DUPR rating card a
 * player can share to Facebook/Zalo/Messenger to "khoe" their rating. Built
 * with @vercel/og (Satori → resvg-wasm → PNG), same pipeline as
 * og-image-match.
 *
 * URL contract
 * ============
 * GET /functions/v1/og-image-player?username={username}
 *
 * Public URL is wired by the Cloudflare Pages Function at
 * functions/og/player/[username].png.ts which proxies + caches in KV
 * (og:player:v1:, 1-week TTL).
 *
 * Layout (1200 × 630)
 * ===================
 * - Background: linear gradient #00B86B → #008C52
 * - Top: ThePickleHub wordmark · "DUPR RATING"
 * - Center: avatar initial · display name · @username
 * - Ratings: Đôi (doubles) + Đơn (singles) stat blocks
 * - Bottom: thepicklehub.net · city
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

// username route param: human username OR hex profile_slug.
const URL_SAFE_USERNAME = /^[a-zA-Z0-9_-]{1,64}$/;

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

interface PlayerOgData {
  username: string;
  display_name: string;
  dupr_singles: number | null;
  dupr_doubles: number | null;
  city: string | null;
  country: string | null;
}

async function fetchPlayerData(username: string): Promise<PlayerOgData | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const isHexSlug = /^[0-9a-f]{8,12}$/i.test(username);
  const orFilter = isHexSlug
    ? `username.eq.${username},profile_slug.like.${username}%`
    : `username.eq.${username}`;

  const { data: row } = await supabase
    .from("profiles")
    .select("username, display_name, dupr_singles, dupr_doubles, city, country")
    .or(orFilter)
    .eq("is_ghost", false)
    .limit(1)
    .maybeSingle();

  if (!row) return null;
  const p = row as Record<string, unknown>;
  return {
    username: (p.username as string) ?? username,
    display_name: (p.display_name as string | null) ?? (p.username as string) ?? "Player",
    dupr_singles: (p.dupr_singles as number | null) ?? null,
    dupr_doubles: (p.dupr_doubles as number | null) ?? null,
    city: (p.city as string | null) ?? null,
    country: (p.country as string | null) ?? null,
  };
}

function initial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

function fmtRating(v: number | null): string {
  return v != null ? v.toFixed(2) : "—";
}

function statBlock(label: string, value: string): React.ReactNode {
  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "6px",
        padding: "0 36px",
      },
    },
    React.createElement(
      "div",
      { style: { display: "flex", fontSize: "26px", opacity: 0.8, letterSpacing: "0.12em" } },
      label,
    ),
    React.createElement(
      "div",
      { style: { display: "flex", fontSize: "92px", fontWeight: 700, fontFamily: "monospace", lineHeight: 1 } },
      value,
    ),
  );
}

function buildImageResponse(data: PlayerOgData): Promise<Response> {
  return getInterBold().then((fontBuffer) => {
    const fonts = fontBuffer
      ? [{ name: "Inter", data: fontBuffer, weight: 700 as const, style: "normal" as const }]
      : undefined;

    const location = [data.city, data.country].filter(Boolean).join(", ");

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
        },
      },
      // Top: brand
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
          { style: { display: "flex", textTransform: "uppercase", letterSpacing: "0.12em" } },
          "DUPR Rating",
        ),
      ),
      // Center: identity
      React.createElement(
        "div",
        {
          style: {
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
          },
        },
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "120px",
              height: "120px",
              borderRadius: "60px",
              background: "rgba(255,255,255,0.18)",
              border: "3px solid rgba(255,255,255,0.55)",
              fontSize: "60px",
              fontWeight: 700,
              marginBottom: "14px",
            },
          },
          initial(data.display_name),
        ),
        React.createElement(
          "div",
          { style: { display: "flex", fontSize: "64px", fontWeight: 700, maxWidth: "1000px" } },
          data.display_name,
        ),
        React.createElement(
          "div",
          { style: { display: "flex", fontSize: "26px", opacity: 0.8 } },
          `@${data.username}`,
        ),
        // Ratings
        React.createElement(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              marginTop: "26px",
            },
          },
          statBlock("ĐÔI", fmtRating(data.dupr_doubles)),
          React.createElement(
            "div",
            { style: { display: "flex", width: "2px", height: "96px", background: "rgba(255,255,255,0.3)" } },
          ),
          statBlock("ĐƠN", fmtRating(data.dupr_singles)),
        ),
      ),
      // Bottom
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "26px",
            opacity: 0.85,
          },
        },
        React.createElement("div", { style: { display: "flex" } }, "thepicklehub.net"),
        React.createElement("div", { style: { display: "flex" } }, location),
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
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const username = url.searchParams.get("username")?.trim();

    if (!username || !URL_SAFE_USERNAME.test(username)) {
      return new Response("Invalid or missing username", {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    const data = await fetchPlayerData(username);
    if (!data) {
      return new Response("Player not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return await buildImageResponse(data);
  } catch (err) {
    console.error("og-image-player error:", err);
    return new Response("Server error generating OG image", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
