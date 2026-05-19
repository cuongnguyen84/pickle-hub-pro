/**
 * og-image-match — 1200x630 PNG OG image generator for /tran-dau/{slug}.
 *
 * Sprint 2 Phase 3B.3 deliverable 3.
 *
 * Generates a Vietnamese-pickleball-themed scoreboard card using @vercel/og
 * (Satori → resvg-wasm → PNG pipeline). The image is fetched by social
 * scrapers (Facebook, Twitter/X, LinkedIn, Slack, Discord, Zalo) when a
 * /tran-dau/{slug} URL is shared.
 *
 * URL contract
 * ============
 * GET /functions/v1/og-image-match?slug={slug}
 *
 * Public-facing URL is wired by the Cloudflare Pages Function at
 * functions/og/match/[slug].png.ts which proxies + caches in KV with a
 * 1-week TTL — see that file for the cache key + TTL details.
 *
 * Font
 * ====
 * Inter Bold is fetched once at module init from rsms.me (the canonical
 * Inter mirror) and reused per request. If the fetch fails, we fall back
 * to the OS default which Satori handles gracefully.
 *
 * Layout (1200 × 630)
 * ===================
 * - Background: linear gradient #00B86B → #008C52 (social-primary tokens)
 * - Top-right: ThePickleHub wordmark
 * - Center stack:
 *     Team A names (white, bold)              ┆  Team A score (huge, JetBrains)
 *     "vs"                                    ┆
 *     Team B names                            ┆  Team B score
 *     winner gets a ✓ checkmark prefix
 * - Bottom: venue name + date (DD/MM/YYYY VN)
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

const FONT_URL =
  "https://rsms.me/inter/font-files/Inter-Bold.woff";

let _fontPromise: Promise<ArrayBuffer | null> | null = null;
function getInterBold(): Promise<ArrayBuffer | null> {
  if (!_fontPromise) {
    _fontPromise = fetch(FONT_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .catch(() => null);
  }
  return _fontPromise;
}

interface MatchOgData {
  slug: string;
  format: string;
  played_at: string;
  team_a_score: number[];
  team_b_score: number[];
  winning_team: "a" | "b" | null;
  venue_name: string | null;
  team_a_label: string;
  team_b_label: string;
}

async function fetchMatchData(slug: string): Promise<MatchOgData | null> {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: matchRow } = await supabase
    .from("matches")
    .select(
      `id, slug, format, played_at, team_a_score, team_b_score, winning_team,
       venue_id, venue_name_override,
       venues:venue_id ( name )`,
    )
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!matchRow) return null;

  const m = matchRow as Record<string, unknown>;
  const venue = m.venues as { name: string } | null;
  const venueName = venue?.name ?? (m.venue_name_override as string | null) ?? null;

  const { data: parts } = await supabase
    .from("match_participants")
    .select(
      `team, position,
       profile:profiles!match_participants_player_id_fkey ( username, display_name )`,
    )
    .eq("match_id", m.id as string)
    .order("team", { ascending: true })
    .order("position", { ascending: true });

  const labelFor = (team: "a" | "b") =>
    (parts ?? [])
      .filter((p: any) => p.team === team)
      .map((p: any) => p.profile?.display_name ?? p.profile?.username ?? "?")
      .filter(Boolean)
      .join(" & ") || "?";

  return {
    slug,
    format: m.format as string,
    played_at: m.played_at as string,
    team_a_score: (m.team_a_score as number[]) ?? [],
    team_b_score: (m.team_b_score as number[]) ?? [],
    winning_team: (m.winning_team as "a" | "b") ?? null,
    venue_name: venueName,
    team_a_label: labelFor("a"),
    team_b_label: labelFor("b"),
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

function fmtScoreLine(scores: number[]): string {
  if (!scores.length) return "—";
  return scores.join(" · ");
}

async function buildImageResponse(data: MatchOgData): Promise<Response> {
  const dateVi = fmtDateVN(data.played_at);
  const scoreA = fmtScoreLine(data.team_a_score);
  const scoreB = fmtScoreLine(data.team_b_score);
  const winnerA = data.winning_team === "a";
  const winnerB = data.winning_team === "b";

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
        { style: { display: "flex", textTransform: "uppercase" } },
        data.format === "singles" ? "Đơn" : data.format === "mixed" ? "Đôi nam-nữ" : "Đôi",
      ),
    ),
    // Center: scoreboard
    React.createElement(
      "div",
      {
        style: {
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: "32px",
          marginTop: "20px",
        },
      },
      // Team A row
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: winnerA || !winnerB ? 1 : 0.7,
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", fontSize: "56px", fontWeight: 700, maxWidth: "780px" } },
          (winnerA ? "✓ " : "") + data.team_a_label,
        ),
        React.createElement(
          "div",
          { style: { display: "flex", fontSize: "72px", fontWeight: 700, fontFamily: "monospace" } },
          scoreA,
        ),
      ),
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "center",
            fontSize: "28px",
            opacity: 0.6,
            letterSpacing: "0.2em",
          },
        },
        "—  vs  —",
      ),
      // Team B row
      React.createElement(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            opacity: winnerB || !winnerA ? 1 : 0.7,
          },
        },
        React.createElement(
          "div",
          { style: { display: "flex", fontSize: "56px", fontWeight: 700, maxWidth: "780px" } },
          (winnerB ? "✓ " : "") + data.team_b_label,
        ),
        React.createElement(
          "div",
          { style: { display: "flex", fontSize: "72px", fontWeight: 700, fontFamily: "monospace" } },
          scoreB,
        ),
      ),
    ),
    // Bottom: venue + date
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
      React.createElement("div", { style: { display: "flex" } }, data.venue_name ?? ""),
      React.createElement("div", { style: { display: "flex" } }, dateVi),
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

    const data = await fetchMatchData(slug);
    if (!data) {
      return new Response("Match not found", {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return await buildImageResponse(data);
  } catch (err) {
    console.error("og-image-match error:", err);
    return new Response("Server error generating OG image", {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }
});
