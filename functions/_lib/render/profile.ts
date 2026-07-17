/**
 * SSR render handlers — public player profile (/nguoi-choi/{username}).
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  absImage,
  breadcrumb,
  DEFAULT_OG_IMAGE,
} from "../utils";
import {
  buildPersonJsonLd,
  buildProfileFallbackDescription,
  pickProfileMetaDescription,
} from "../seo-helpers";
import { render404 } from "./static-pages";

// ─── Player profile ──────────────────────────────────────
//
// /nguoi-choi/{username} — public player profile (Sprint 3 Phase 3B).
//
// Phase 4D moves the JSON-LD Person schema from src/pages/PlayerProfile.tsx
// (client-side DOM injection) to server-side prerender so bots see it on
// first byte. The client-side script is intentionally left in place — it's
// harmless when the server already injected the same structured data, and
// it covers preview/staging environments that don't run through the
// Pages Functions middleware.
//
// The /nguoi-choi/{username} URL is single-canonical (no /vi/nguoi-choi/*
// variant in src/App.tsx); the React page renders bilingual based on the
// language toggle. Server-side we render Vietnamese-first (95% audience)
// and emit hreflang en + vi pointing to the same canonical URL — same
// pattern Phase 4A used for /feed when only one path existed.

export async function renderProfile(
  supabase: SupabaseClient,
  username: string,
  siteUrl: string,
): Promise<Response> {
  // Mirror usePlayerProfile hook query (src/hooks/social/usePlayerProfile.ts).
  // is_ghost=false + onboarding_completed_at IS NOT NULL filters out shells
  // and unfinished signups so bots don't index zombie profiles.
  //
  // NOTE on `updated_at`: the profiles table has NO updated_at column on
  // prod (verified via src/integrations/supabase/types.ts; sitemap-players
  // comment also calls this out). The original Phase 4D select included
  // it as boilerplate copied from other handlers — the resulting
  // PostgREST 42703 error returned data=null + error=<column missing>,
  // and the original code only destructured `data`, silently routing
  // every profile lookup to the render404 fallback. Verified by Cuong's
  // seo-verify.sh run on commit 9c9c2fe (4/5 routes passed; profile
  // route returned the 404 SEO shell).
  //
  // Defensive: also destructure `error` and log it so a future column
  // drift can't silently regress this path again.
  //
  // PR79 Phase 2F follow-up — accept hex profile_slug too. The `:username`
  // route param is actually a slug-shaped value that can be EITHER a
  // human-readable username OR the 8-/12-char hex profile_slug derived
  // from profileIdToSlug(). SocialEventRoster, SocialEventLive, and
  // ClubCard all build /u/<hex> links that 301 to /nguoi-choi/<hex>,
  // so this resolver must accept both shapes or the in-app player
  // links 404. Single .or() PostgREST clause = one query, exact
  // username match preferred over prefix-LIKE on profile_slug.
  const isHexSlug = /^[0-9a-f]{8,12}$/i.test(username);
  const orFilter = isHexSlug
    ? `username.eq.${username},profile_slug.like.${username}%`
    : `username.eq.${username}`;
  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select(
      `id, username, display_name, avatar_url, bio,
       city, country, skill_level,
       dupr_singles, dupr_doubles,
       is_ghost, is_public_profile, onboarding_completed_at, created_at`,
    )
    .or(orFilter)
    .eq("is_ghost", false)
    // Sprint A2 — bots only see public-opt-in profiles. Authed users
    // viewing their own profile bypass via client-side hook
    // (usePlayerProfile) instead.
    .eq("is_public_profile", true)
    .not("onboarding_completed_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (profileErr) {
    console.error("renderProfile: profile lookup error", {
      username,
      error: profileErr,
    });
  }

  if (!profileRow) return render404(`/nguoi-choi/${username}`, siteUrl);

  const p = profileRow as {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    skill_level: string | null;
    dupr_singles: number | null;
    dupr_doubles: number | null;
    created_at: string;
  };

  const displayName = p.display_name ?? p.username;
  const url = `${siteUrl}/nguoi-choi/${p.username}`;

  // Bilingual title — primary clause Vietnamese, English in parens for
  // international discoverability.
  const rawTitle = `${displayName} (@${p.username})`;
  const title = buildTitle(rawTitle, " | ThePickleHub Pickleball");

  // Description: bio takes priority when meaningful (>= 30 chars after
  // trim); otherwise fall through to the city/DUPR fallback. Codex P2
  // fix on PR #19: the previous wiring used buildMetaDescription's
  // implicit fallback chain, but that helper always returns a non-empty
  // string (padding short input with generic platform copy), so the
  // city/DUPR-specific fallback was dead code.
  // pickProfileMetaDescription does the bio-vs-fallback choice
  // explicitly + clamps to 160 chars for Google's snippet display.
  const duprBits: string[] = [];
  if (p.dupr_doubles != null) duprBits.push(`DUPR đôi ${p.dupr_doubles.toFixed(2)}`);
  if (p.dupr_singles != null) duprBits.push(`DUPR đơn ${p.dupr_singles.toFixed(2)}`);
  const fallbackDesc = buildProfileFallbackDescription(p);
  const description = pickProfileMetaDescription(p.bio, fallbackDesc);

  // hreflang intentionally OMITTED. /nguoi-choi/{username} is single-
  // canonical — no separate /en/player/<u> URL serves different content.
  // Previous version emitted three <link hreflang> tags all pointing at
  // the same URL, which Google treats as an invalid signal (and Search
  // Console flags as "alternate page with proper canonical tag"). Same
  // policy as renderMatch (Codex P1 on PR #40). Re-add when the SPA
  // actually ships split-canonical bilingual URLs.
  //
  // og:image:width/height/type — the player card (og-image-player) is
  // generated on-demand by Satori (~1-2s on a cold KV cache), longer than
  // Facebook's synchronous scrape window. Without explicit dimensions FB
  // drops the image on first scrape ("og:image isn't available yet, it's
  // processed asynchronously"). Declaring the fixed 1200×630 size lets FB
  // render the card frame immediately and fetch the PNG async.
  const extraMeta = `<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:type" content="image/png"/>`;

  // JSON-LD Person — server-side variant of the schema PlayerProfile.tsx
  // injects client-side. Fields aligned with usePlayerProfile() shape so
  // bot view matches what humans see post-hydration (no cloaking). Pure
  // shape lives in functions/_lib/seo-helpers.ts so the JSON-LD edge
  // cases (no bio, no city, no DUPR, etc.) are unit-tested.
  // PR (2026-05-18 Ahrefs Site Audit Round 2 fix) — always pass an image
  // URL to the Person JSON-LD (fallback to DEFAULT_OG_IMAGE when the
  // profile has no avatar). Schema.org/Google validators flag missing
  // `image` on Person — Ahrefs reported 7 profile schema errors.
  const jsonLd = buildPersonJsonLd({
    profile: p,
    url,
    siteUrl,
    absoluteImageUrl: p.avatar_url ? absImage(p.avatar_url, siteUrl) : DEFAULT_OG_IMAGE,
  });

  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Người chơi" },
    { label: displayName },
  ]);

  // Bot-readable body — same pattern as renderMatch (no cloaking, gives
  // Google a text excerpt to preview). Mirrors PlayerHeroCard + PlayerStats
  // visible content roughly.
  const skillLine = p.skill_level
    ? `<p>Trình độ: <strong>${escapeHtml(p.skill_level)}</strong></p>`
    : "";
  const cityLine = p.city
    ? `<p>${escapeHtml(p.city)}${p.country ? `, ${escapeHtml(p.country)}` : ""}</p>`
    : "";
  const duprLine =
    duprBits.length > 0
      ? `<p>${escapeHtml(duprBits.join(" · "))}</p>`
      : "";
  const bioLine = p.bio ? `<p>${escapeHtml(p.bio)}</p>` : "";

  const bodyContent = `${bc}
<h1>${escapeHtml(displayName)} <span>@${escapeHtml(p.username)}</span></h1>
${cityLine}
${skillLine}
${duprLine}
${bioLine}
<nav><h2>Khám phá thêm</h2><ul>
<li><a href="${siteUrl}/feed">Bảng tin pickleball</a></li>
<li><a href="${siteUrl}/tournaments">Giải đấu</a></li>
</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url,
      siteUrl,
      // Phase B — share the branded DUPR rating card (og-image-player) instead
      // of the raw avatar, so a shared /nguoi-choi/ link previews as a card.
      // ?v=N is a cache-design version: the card PNG is served with an
      // immutable 7-day edge cache, so when the card layout changes the
      // bytes at a given URL can't refresh. Cloudflare keys its cache on the
      // query string here, so bumping v mints a fresh edge entry (and makes
      // Facebook/Zalo re-fetch) without needing a zone cache-purge token.
      // Bump this when og-image-player's design changes. v2 = dark-luxury card.
      image: `${siteUrl}/og/player/${p.username}.png?v=2`,
      type: "profile",
      jsonLd,
      bodyContent,
      extraMeta,
      lang: "vi",
    }),
  );
}
