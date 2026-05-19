/**
 * og-image-social-event — 1200×630 PNG OG image for /social/{slug}.
 *
 * PR79 Phase 2E (audit I-6). Mirrors the og-image-match pattern:
 * Satori → resvg-wasm → PNG via @vercel/og. Public-facing URL is wired
 * by the CF Pages Function at functions/og/social/[slug].png.ts which
 * proxies + caches in KV (7d TTL).
 *
 * URL contract
 * ============
 * GET /functions/v1/og-image-social-event?slug={slug}
 *
 * Layout (1200 × 630)
 * ===================
 * - Background: linear gradient #00B86B → #008C52 (social-primary tokens)
 * - Top row: ThePickleHub wordmark · "Sự kiện cộng đồng" eyebrow
 * - Center: event title (clamped 2 lines), club name, date · time
 * - Bottom row: location · price (Miễn phí / VND)
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

interface EventOgData {
  title: string;
  club_name: string | null;
  start_at: string;
  end_at: string;
  location_text: string | null;
  price_vnd: number;
}

async function fetchEventData(slug: string): Promise<EventOgData | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from("social_events")
    .select(
      `title_vi, start_at, end_at, location_text, price_vnd, status, visibility,
       club:clubs!social_events_club_id_fkey ( name )`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();

  if (error || !data) return null;

  const ev = data as unknown as {
    title_vi: string;
    start_at: string;
    end_at: string;
    location_text: string | null;
    price_vnd: number;
    club: { name: string } | null;
  };

  return {
    title: ev.title_vi,
    club_name: ev.club?.name ?? null,
    start_at: ev.start_at,
    end_at: ev.end_at,
    location_text: ev.location_text,
    price_vnd: ev.price_vnd,
  };
}

function fmtDateVN(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtTimeVN(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function fmtPrice(vnd: number): string {
  if (vnd <= 0) return "Miễn phí";
  return `${vnd.toLocaleString("vi-VN")}₫`;
}

async function buildImageResponse(data: EventOgData): Promise<Response> {
  const dateStr = fmtDateVN(data.start_at);
  const startTime = fmtTimeVN(data.start_at);
  const endTime = fmtTimeVN(data.end_at);
  const timeRange = startTime && endTime ? `${startTime} – ${endTime}` : startTime;
  const priceLabel = fmtPrice(data.price_vnd);

  const fontBuffer = await getInterBold();
  const fonts = fontBuffer
    ? [{ name: "Inter", data: fontBuffer, weight: 700 as const, style: "normal" as const }]
    : undefined;

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
        "Sự kiện cộng đồng",
      ),
    ),
    // Center: title + club + date+time
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "20px",
          marginTop: "20px",
        },
      },
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "64px",
            fontWeight: 700,
            lineHeight: 1.15,
            // Clamp visually by limiting maxHeight (Satori doesn't support line-clamp).
            maxWidth: "1040px",
            overflow: "hidden",
          },
        },
        data.title,
      ),
      data.club_name
        ? React.createElement(
            "div",
            {
              style: {
                display: "flex",
                fontSize: "30px",
                opacity: 0.9,
              },
            },
            `Tổ chức bởi ${data.club_name}`,
          )
        : React.createElement("div", { style: { display: "flex" } }, ""),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            fontSize: "32px",
            opacity: 0.95,
            fontFamily: "monospace",
            letterSpacing: "0.02em",
          },
        },
        `${dateStr}${timeRange ? `  ·  ${timeRange}` : ""}`,
      ),
    ),
    // Bottom: location + price
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "26px",
          opacity: 0.9,
        },
      },
      React.createElement(
        "div",
        { style: { display: "flex", maxWidth: "780px" } },
        data.location_text ?? "ThePickleHub",
      ),
      React.createElement(
        "div",
        { style: { display: "flex", fontWeight: 700 } },
        priceLabel,
      ),
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

    const data = await fetchEventData(slug);
    if (!data) {
      return new Response("Event not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return await buildImageResponse(data);
  } catch (err) {
    console.error("og-image-social-event error:", err);
    return new Response("Server error generating OG image", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
