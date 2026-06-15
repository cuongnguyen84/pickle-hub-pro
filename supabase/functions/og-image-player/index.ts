/**
 * og-image-player — 1200x630 PNG OG image for /nguoi-choi/{username}.
 *
 * Phase B (shareable rating card), redesigned: a dark-luxury sports
 * "credential" — deep green-black field, a radial green glow behind a giant
 * hero DUPR numeral (Inter Black), editorial left-aligned identity, brand
 * eyebrow. Reads like a pro player passport, not a flat marketing banner.
 *
 * URL contract: GET /functions/v1/og-image-player?username={username}
 * Public URL wired by functions/og/player/[username].png.ts (KV cache).
 *
 * Built with @vercel/og (Satori → resvg-wasm → PNG). React.createElement
 * only. Two Inter weights (Black 900 for the hero number, Bold 700 for the
 * rest) fetched once from rsms.me; falls back to OS default on fetch error.
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

const URL_SAFE_USERNAME = /^[a-zA-Z0-9_-]{1,64}$/;

// ─── Palette (dark-luxury sports credential) ───────────────────────────────
const C = {
  bg: "#070B09", // deep green-black field
  panel: "#0E1512", // raised surface
  ink: "#F4F7F5", // near-white text
  muted: "rgba(244,247,245,0.56)",
  faint: "rgba(244,247,245,0.10)",
  green: "#15E08A", // bright accent for dark bg
  greenDeep: "#00B86B",
};

const FONTS: Record<string, string> = {
  bold: "https://rsms.me/inter/font-files/Inter-Bold.woff",
  black: "https://rsms.me/inter/font-files/Inter-Black.woff",
};

let _fonts: Promise<{ name: string; data: ArrayBuffer; weight: 700 | 900; style: "normal" }[]> | null = null;
function getFonts() {
  if (!_fonts) {
    _fonts = Promise.all([
      fetch(FONTS.bold).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
      fetch(FONTS.black).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null),
    ]).then(([bold, black]) => {
      const out: { name: string; data: ArrayBuffer; weight: 700 | 900; style: "normal" }[] = [];
      if (bold) out.push({ name: "Inter", data: bold, weight: 700, style: "normal" });
      if (black) out.push({ name: "Inter", data: black, weight: 900, style: "normal" });
      return out;
    });
  }
  return _fonts;
}

export interface PlayerOgData {
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

const initial = (name: string): string => name.trim().charAt(0).toUpperCase() || "?";
const fmt = (v: number | null): string => (v != null ? v.toFixed(2) : "—");

const el = React.createElement;

function eyebrow(text: string, color: string) {
  return el(
    "div",
    { style: { display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: "0.22em", color, textTransform: "uppercase" } },
    text,
  );
}

export function buildImageResponse(data: PlayerOgData): Promise<Response> {
  return getFonts().then((fonts) => {
    const location = [data.city, data.country].filter(Boolean).join(", ") || "Vietnam";

    // Hero = doubles when present, else singles, else unrated.
    const hasDoubles = data.dupr_doubles != null;
    const hasSingles = data.dupr_singles != null;
    const heroLabel = hasDoubles ? "ĐÔI" : hasSingles ? "ĐƠN" : "DUPR";
    const heroVal = hasDoubles ? fmt(data.dupr_doubles) : hasSingles ? fmt(data.dupr_singles) : "—";
    const secLabel = hasDoubles ? "ĐƠN" : "ĐÔI";
    const secVal = hasDoubles ? fmt(data.dupr_singles) : hasSingles ? fmt(data.dupr_doubles) : "—";
    const unrated = !hasDoubles && !hasSingles;

    const root = el(
      "div",
      {
        style: {
          position: "relative",
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background: C.bg,
          color: C.ink,
          fontFamily: "Inter",
          padding: "58px 64px",
          overflow: "hidden",
        },
      },
      // Radial green glow behind the hero number (atmosphere + depth)
      el("div", {
        style: {
          position: "absolute",
          right: "-160px",
          top: "60px",
          width: "780px",
          height: "780px",
          borderRadius: "9999px",
          background: "radial-gradient(circle, rgba(21,224,138,0.26) 0%, rgba(21,224,138,0.06) 42%, rgba(21,224,138,0) 70%)",
          display: "flex",
        },
      }),
      // Thin top brand accent rule
      el("div", {
        style: { position: "absolute", left: 0, top: 0, width: "210px", height: "6px", background: `linear-gradient(90deg, ${C.green}, ${C.greenDeep})`, display: "flex" },
      }),

      // ── Top: brand + eyebrow ──────────────────────────────────────────
      el(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "12px" } },
          el("div", { style: { display: "flex", width: "14px", height: "14px", borderRadius: "9999px", background: C.green } }),
          el("div", { style: { display: "flex", fontSize: 26, fontWeight: 700, letterSpacing: "0.01em" } }, "ThePickleHub"),
        ),
        eyebrow("DUPR Rating", C.green),
      ),

      // ── Middle: identity (left) + hero number (right) ─────────────────
      el(
        "div",
        { style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "40px" } },
        // Identity column
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "18px", maxWidth: "560px" } },
          el(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "92px",
                height: "92px",
                borderRadius: "9999px",
                background: C.panel,
                border: `2px solid ${C.green}`,
                fontSize: 46,
                fontWeight: 900,
                color: C.green,
              },
            },
            initial(data.display_name),
          ),
          el(
            "div",
            { style: { display: "flex", fontSize: 58, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.0, maxWidth: "560px" } },
            data.display_name,
          ),
          el("div", { style: { display: "flex", fontSize: 26, fontWeight: 700, color: C.muted } }, `@${data.username}`),
        ),
        // Hero number column
        unrated
          ? el(
              "div",
              { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" } },
              eyebrow("DUPR", C.green),
              el("div", { style: { display: "flex", fontSize: 72, fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1, color: C.ink } }, "Chưa xếp hạng"),
              el("div", { style: { display: "flex", fontSize: 24, fontWeight: 700, color: C.green } }, "Kết nối DUPR để hiện rating"),
            )
          : el(
              "div",
              { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" } },
              eyebrow(heroLabel, C.green),
              el(
                "div",
                { style: { display: "flex", fontSize: 210, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.92, color: C.ink } },
                heroVal,
              ),
              el(
                "div",
                { style: { display: "flex", alignItems: "baseline", gap: "10px", marginTop: "6px" } },
                el("div", { style: { display: "flex", fontSize: 22, fontWeight: 700, letterSpacing: "0.16em", color: C.muted, textTransform: "uppercase" } }, secLabel),
                el("div", { style: { display: "flex", fontSize: 34, fontWeight: 900, color: C.ink } }, secVal),
              ),
            ),
      ),

      // ── Bottom: rule + url + location ─────────────────────────────────
      el("div", { style: { display: "flex", width: "100%", height: "1px", background: C.faint, marginBottom: "20px" } }),
      el(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24, fontWeight: 700 } },
        el("div", { style: { display: "flex", color: C.muted } }, "thepicklehub.net"),
        el("div", { style: { display: "flex", color: C.muted } }, location),
      ),
    );

    return new ImageResponse(root, {
      width: 1200,
      height: 630,
      fonts: fonts.length ? fonts : undefined,
      headers: {
        "Cache-Control": "public, max-age=604800, immutable",
        ...corsHeaders,
      },
    });
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
