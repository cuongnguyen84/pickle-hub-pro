/**
 * Pure helpers for the Sprint 4 Phase 4D prerender additions.
 *
 * Extracted from functions/_lib/render/index.ts so the JSON-LD shape and
 * team-label fallbacks can be unit-tested without spinning up a full
 * Cloudflare Pages Functions runtime. Imported back into render/index.ts.
 *
 * No Cloudflare Workers types in this file so the same module is loadable
 * by the Vitest runtime (which uses src/ tsconfig). Tests live at
 * src/lib/social/__tests__/seo-helpers.test.ts and import via relative
 * path.
 */

import type { Lang } from "./utils";

/* ─── Profile (Person) ────────────────────────────────────────────────── */

export interface ProfileForSeo {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  country: string | null;
  dupr_singles: number | null;
  dupr_doubles: number | null;
}

export interface PersonJsonLdInput {
  profile: ProfileForSeo;
  url: string;
  siteUrl: string;
  /** Pass an absolute image url (call absImage outside). */
  absoluteImageUrl?: string;
}

export function buildPersonJsonLd(input: PersonJsonLdInput): Record<string, unknown> {
  const { profile, url, siteUrl, absoluteImageUrl } = input;
  const displayName = profile.display_name ?? profile.username;
  const country = profile.country ?? "VN";

  const additionalProperty: Array<{ "@type": string; name: string; value: number }> = [];
  if (profile.dupr_doubles != null) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "DUPR Doubles Rating",
      value: profile.dupr_doubles,
    });
  }
  if (profile.dupr_singles != null) {
    additionalProperty.push({
      "@type": "PropertyValue",
      name: "DUPR Singles Rating",
      value: profile.dupr_singles,
    });
  }

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    alternateName: `@${profile.username}`,
    url,
    knowsAbout: ["Pickleball"],
    memberOf: {
      "@type": "SportsOrganization",
      name: "ThePickleHub",
      url: siteUrl,
    },
  };
  if (absoluteImageUrl) jsonLd.image = absoluteImageUrl;
  if (profile.bio) jsonLd.description = profile.bio;
  if (profile.city) {
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: profile.city,
      addressCountry: country,
    };
  }
  if (additionalProperty.length > 0) jsonLd.additionalProperty = additionalProperty;
  return jsonLd;
}

/**
 * Bilingual fallback description for profiles with empty/short bio. Used
 * when buildMetaDescription's bio path comes up short.
 */
export function buildProfileFallbackDescription(profile: ProfileForSeo): string {
  const displayName = profile.display_name ?? profile.username;
  const duprBits: string[] = [];
  if (profile.dupr_doubles != null) duprBits.push(`DUPR đôi ${profile.dupr_doubles.toFixed(2)}`);
  if (profile.dupr_singles != null) duprBits.push(`DUPR đơn ${profile.dupr_singles.toFixed(2)}`);
  const cityBit = profile.city ? ` tại ${profile.city}` : "";
  const duprBit = duprBits.length ? `, ${duprBits.join(", ")}` : "";
  // PR (2026-05-18 Ahrefs Site Audit Round 2 fix) — pad description so
  // even profiles without bio/city/DUPR produce ≥120 chars (was 93-99,
  // flagged as meta desc too short on 5 profile pages).
  return `Hồ sơ pickleball của ${displayName}${cityBit}${duprBit} — lịch sử trận đấu, thống kê, rating DUPR và kết quả giải pickleball trên ThePickleHub Việt Nam.`;
}

/**
 * Pick the meta description for a profile and clamp to 160 chars.
 *
 * Codex P2 fix on PR #19: the original wiring did
 *   `buildMetaDescription(bio, …) || buildMetaDescription(fallback, …)`
 * but buildMetaDescription always returns a non-empty string (it pads
 * short input with a generic platform fallback rather than returning
 * falsy), so the `||` branch was dead code and the city/DUPR-aware
 * fallback never reached bots when bio was empty/short.
 *
 * This helper makes the bio-vs-fallback choice explicit BEFORE
 * truncation:
 *   - trimmed bio ≥ MIN_BIO_LENGTH (30 chars) → use bio
 *   - otherwise                              → use the city/DUPR fallback
 *
 * 30 chars is roughly "DUPR 4.0 player from Saigon" — a meaningful
 * sentence. Below that, the structured fallback (which references
 * city + ratings explicitly) gives Google more useful snippet text
 * than a 1-line bio padded with generic platform copy.
 *
 * Truncation tail mirrors buildMetaDescription's "..." pattern so the
 * description stays under Google's 160-char display cap.
 */
export const PROFILE_BIO_MIN_LENGTH = 30;
const PROFILE_DESCRIPTION_MAX = 160;

export function pickProfileMetaDescription(
  bio: string | null | undefined,
  fallback: string,
): string {
  const trimmedBio = (bio ?? "").trim();
  const source =
    trimmedBio.length >= PROFILE_BIO_MIN_LENGTH ? trimmedBio : fallback;
  if (source.length <= PROFILE_DESCRIPTION_MAX) return source;
  return source.slice(0, PROFILE_DESCRIPTION_MAX - 3).trim() + "...";
}

/**
 * Generic version of pickProfileMetaDescription — pick rawDesc when
 * meaningful, otherwise fall through to a caller-provided fallback.
 *
 * PR73 Phase 2C (audit I-3) — fixes the dead-code fallback pattern in
 * renderSocialEvent + renderClub:
 *   const description = buildMetaDescription(ev.description_vi, …) || fallbackDesc;
 * buildMetaDescription always returns a non-empty string (it pads short
 * input with generic "ThePickleHub là nền tảng pickleball…" copy), so
 * the `|| fallbackDesc` branch never fired. Every event/club without a
 * description got the generic snippet instead of the
 * date/venue/capacity/price one — exact same class of bug as Codex P2
 * fixed for profile bio in PR #19.
 *
 * This helper makes the choice explicit:
 *   - rawDesc trimmed length >= MIN → use rawDesc
 *   - otherwise → use fallback
 * Then clamp to MAX chars with the same "..." tail buildMetaDescription
 * uses for long input.
 */
const PICK_META_MIN_LENGTH = 30;
const PICK_META_MAX_LENGTH = 160;

export function pickMetaDescription(
  rawDesc: string | null | undefined,
  fallback: string,
  maxLength = PICK_META_MAX_LENGTH,
): string {
  const trimmed = (rawDesc ?? "").trim();
  const source =
    trimmed.length >= PICK_META_MIN_LENGTH ? trimmed : fallback;
  // Budget in BYTES: buildHtml's truncateForSeo cuts the final meta description
  // at 160 UTF-8 bytes, and Vietnamese diacritics cost 2-3 bytes each. Counting
  // chars here passed 160-char/200+-byte strings through, and the downstream
  // byte cut then sliced off exactly the local-intent tail (city keyword) on
  // every Vietnamese venue page — same unit bug as buildTitle #468.
  const byteLength = (s: string) => new TextEncoder().encode(s).length;
  if (byteLength(source) <= maxLength) return source;
  const budget = maxLength - 3;
  let out = "";
  for (const ch of source) {
    if (byteLength(out + ch) > budget) break;
    out += ch;
  }
  return out.trim() + "...";
}

/** Uppercase only the first character; leaves the rest of the string alone. */
export function upperFirst(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Assemble a meta description from priority-ordered segments, appending each
 * one only while the running string still fits the byte budget.
 *
 * Why this exists (CTR-01, 2026-08-18): every caller that built a description
 * by concatenating a fixed template ran the same risk — Vietnamese diacritics
 * cost 2-3 UTF-8 bytes each, so a string that looks comfortably short in
 * characters blows the 160-byte budget and pickMetaDescription ellipsises it
 * mid-word. On the venue pages that cut landed on the generic boilerplate tail
 * AND took the city keyword with it, on 78% of rows.
 *
 * Ordering the segments by value and dropping from the end instead means a
 * long venue name loses boilerplate rather than facts, and the output is
 * truncation-free by construction. `core` is always included even if it alone
 * exceeds the budget — pickMetaDescription remains the single place allowed to
 * ellipsise, so a pathological name still degrades safely rather than throwing.
 */
export function fitSegments(
  core: string,
  segments: string[],
  maxLength = PICK_META_MAX_LENGTH,
): string {
  const byteLength = (s: string) => new TextEncoder().encode(s).length;
  let out = core;
  for (const segment of segments) {
    if (!segment) continue;
    if (byteLength(out + segment) <= maxLength) out += segment;
  }
  return out;
}

/**
 * Join a variable-length `lead` (a venue/tournament name we do not control)
 * to a fixed `tail` we must not lose, shrinking the lead at WORD boundaries
 * until the pair fits the budget.
 *
 * Without this, a pathologically long name pushes the pair past 160 bytes and
 * the downstream byte cut lands mid-word inside the tail — the venue test hit
 * exactly that, producing "…Rất Dài Rất Dài tại Hà...". Trimming whole words
 * off the lead instead keeps the tail (which carries the city keyword) intact
 * and ends the sentence cleanly.
 */
export function fitLead(
  lead: string,
  tail: string,
  maxLength = PICK_META_MAX_LENGTH,
): string {
  const byteLength = (s: string) => new TextEncoder().encode(s).length;
  if (byteLength(lead + tail) <= maxLength) return lead + tail;

  const words = lead.split(/\s+/).filter(Boolean);
  // "…" is one code point / 3 UTF-8 bytes, versus 3 bytes for "..." — same
  // cost, but it reads as an intentional elision rather than a broken string.
  while (words.length > 1) {
    words.pop();
    const candidate = `${words.join(" ")}…`;
    if (byteLength(candidate + tail) <= maxLength) return candidate + tail;
  }
  // Single unsplittable word longer than the budget: hand it to
  // pickMetaDescription, which stays the only place allowed to hard-cut.
  return lead + tail;
}

/* ─── Feed (CollectionPage / ItemList) ────────────────────────────────── */

export interface FeedSeoParticipant {
  team: "a" | "b";
  position: number | null;
  username?: string | null;
  display_name?: string | null;
}

export interface FeedRowForSeo {
  match_id: string;
  slug: string;
  played_at: string;
  format?: string;
  match_type?: string;
  venue_name: string | null;
  team_a_score: number[];
  team_b_score: number[];
  winning_team?: string | null;
  participants: unknown;
  kudos_count?: number;
  comment_count?: number;
}

/**
 * Build a "Team A & Team A2" label from a flat participants list, sorted
 * by position with display_name → username → "?" fallback chain. Falls
 * back to "Team A" / "Team B" when the team has zero participants (e.g.,
 * a corrupted match row).
 */
export function feedTeamLabel(
  participants: FeedSeoParticipant[],
  team: "a" | "b",
): string {
  const fallback = team === "a" ? "Team A" : "Team B";
  const names = participants
    .filter((p) => p.team === team)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((p) => p.display_name ?? p.username ?? "?");
  return names.length > 0 ? names.join(" & ") : fallback;
}

/**
 * Compact score string "11-9 9-11 11-7" from two score arrays. Trailing
 * games where one side is missing are coalesced to 0 so a partial
 * data row doesn't render an undefined.
 */
export function feedScoreCompact(a: number[], b: number[]): string {
  return (a || [])
    .map((s, i) => `${s}-${(b || [])[i] ?? 0}`)
    .join(" ");
}

export interface FeedJsonLdInput {
  rows: FeedRowForSeo[];
  canonical: string;
  siteUrl: string;
  title: string;
  description: string;
  lang: Lang;
}

export function buildFeedJsonLd(input: FeedJsonLdInput): Record<string, unknown> {
  const { rows, canonical, siteUrl, title, description, lang } = input;

  const itemListElement = rows.map((row, i) => {
    const parts = Array.isArray(row.participants)
      ? (row.participants as FeedSeoParticipant[])
      : [];
    const teamA = feedTeamLabel(parts, "a");
    const teamB = feedTeamLabel(parts, "b");
    const matchUrl = `${siteUrl}/tran-dau/${row.slug}`;
    const item: Record<string, unknown> = {
      "@type": "SportsEvent",
      name: `${teamA} vs ${teamB}`,
      sport: "Pickleball",
      startDate: row.played_at,
      url: matchUrl,
    };
    if (row.venue_name) {
      item.location = {
        "@type": "SportsActivityLocation",
        name: row.venue_name,
      };
    }
    return {
      "@type": "ListItem",
      position: i + 1,
      item,
    };
  });

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    inLanguage: lang === "vi" ? "vi-VN" : "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "ThePickleHub",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: rows.length,
      itemListElement,
    },
  };
}

/* ─── Feed Timeline (Sprint 7 mixed-content) ──────────────────────────── */

/**
 * Sprint 7 — get_feed_timeline returns one wide row per item with
 * item_type discriminating the source. The prerender flattens that into
 * an ItemList containing SportsEvent (match) / BlogPosting (blog) /
 * VideoObject (video) so Googlebot indexes recent activity beyond
 * individual detail pages.
 *
 * Kept separate from FeedRowForSeo + buildFeedJsonLd so the existing
 * tests (and any other consumer of the matches-only shape) don't have to
 * change. renderFeed switches to this builder now that /feed is mixed.
 */
export interface TimelineRowForSeo {
  item_type: "match" | "blog" | "video" | string;
  item_id: string;
  published_at: string;
  // match-specific
  slug?: string | null;
  venue_name?: string | null;
  team_a_score?: number[] | null;
  team_b_score?: number[] | null;
  participants?: unknown;
  // blog/video shared
  title?: string | null;
  excerpt?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
  duration_seconds?: number | null;
}

export interface TimelineFeedJsonLdInput {
  rows: TimelineRowForSeo[];
  canonical: string;
  siteUrl: string;
  title: string;
  description: string;
  lang: Lang;
}

export function buildTimelineFeedJsonLd(
  input: TimelineFeedJsonLdInput,
): Record<string, unknown> {
  const { rows, canonical, siteUrl, title, description, lang } = input;

  const itemListElement = rows
    .map((row, i) => {
      const item = rowToSchemaItem(row, siteUrl, lang);
      if (!item) return null;
      return {
        "@type": "ListItem",
        position: i + 1,
        item,
      };
    })
    .filter((x): x is { "@type": string; position: number; item: Record<string, unknown> } => x != null);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonical,
    inLanguage: lang === "vi" ? "vi-VN" : "en-US",
    isPartOf: {
      "@type": "WebSite",
      name: "ThePickleHub",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: itemListElement.length,
      itemListElement,
    },
  };
}

function rowToSchemaItem(
  row: TimelineRowForSeo,
  siteUrl: string,
  lang: Lang,
): Record<string, unknown> | null {
  if (row.item_type === "match" && row.slug) {
    const parts = Array.isArray(row.participants)
      ? (row.participants as FeedSeoParticipant[])
      : [];
    const teamA = feedTeamLabel(parts, "a");
    const teamB = feedTeamLabel(parts, "b");
    const matchUrl = `${siteUrl}/tran-dau/${row.slug}`;
    const item: Record<string, unknown> = {
      "@type": "SportsEvent",
      name: `${teamA} vs ${teamB}`,
      sport: "Pickleball",
      startDate: row.published_at,
      url: matchUrl,
    };
    if (row.venue_name) {
      item.location = {
        "@type": "SportsActivityLocation",
        name: row.venue_name,
      };
    }
    return item;
  }
  if (row.item_type === "blog" && row.slug && row.title) {
    const blogUrl = `${siteUrl}/vi/blog/${row.slug}`;
    const item: Record<string, unknown> = {
      "@type": "BlogPosting",
      headline: row.title,
      datePublished: row.published_at,
      url: blogUrl,
      inLanguage: "vi-VN",
    };
    if (row.excerpt) item.description = row.excerpt;
    if (row.cover_image_url) item.image = row.cover_image_url;
    return item;
  }
  if (row.item_type === "video" && row.item_id && row.title) {
    const videoUrl = `${siteUrl}/watch/${row.item_id}`;
    const item: Record<string, unknown> = {
      "@type": "VideoObject",
      name: row.title,
      uploadDate: row.published_at,
      url: videoUrl,
      inLanguage: lang === "vi" ? "vi-VN" : "en-US",
    };
    if (row.excerpt) item.description = row.excerpt;
    if (row.cover_image_url) item.thumbnailUrl = row.cover_image_url;
    if (row.duration_seconds && row.duration_seconds > 0) {
      // ISO 8601 duration, schema.org standard for VideoObject.
      const m = Math.floor(row.duration_seconds / 60);
      const s = Math.floor(row.duration_seconds % 60);
      item.duration = `PT${m}M${s}S`;
    }
    return item;
  }
  return null;
}
