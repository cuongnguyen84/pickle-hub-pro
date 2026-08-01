import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LivestreamWithLogo } from "@/hooks/useLivestreamData";
import { blogMetadata } from "@/content/blog/metadata";
import {
  composeTickerItems,
  formatProMatchTicker,
  lastNameFromDisplayName,
  resolveTickerMode,
  type Language,
  type TickerItem,
  type TickerMode,
  type ProMatchTickerInput,
} from "@/lib/ticker/ticker-mode-resolver";

/**
 * Composed data source for the global header ticker (Index.tsx).
 *
 * Three visual modes (resolved by `resolveTickerMode`):
 *   1. LIVE     — live now OR scheduled within the next 24h; fresh verified
 *                 results are mixed between live and upcoming items
 *   2. MATCHES  — pro-tour matches played within the last 3 days
 *   3. BLOG     — recent published posts (always-on fallback)
 *
 * Each mode's data is fetched in parallel (cheap individually; React
 * Query's queryKey isolation means cache hits don't cascade between
 * modes when the resolved mode changes). The hook returns a flattened
 * `{ mode, items }` so the UI doesn't need to know which mode won.
 */

const UPCOMING_WINDOW_HOURS = 24;
const MATCH_WINDOW_DAYS = 3;
const MATCH_LIMIT = 8;
const BLOG_LIMIT = 6;

interface UseTickerDataResult {
  mode: TickerMode;
  items: TickerItem[];
  isLoading: boolean;
}

interface TickerSources {
  live: LivestreamWithLogo[];
  scheduled: LivestreamWithLogo[];
  isLoading?: boolean;
}

export function useTickerData(language: Language, sources: TickerSources): UseTickerDataResult {
  const matchesQ = useRecentProMatches();

  const upcomingStreams = useMemo(
    () => filterUpcomingWithin24h(sources.scheduled),
    [sources.scheduled],
  );

  const liveItems = useMemo(
    () => buildLivestreamItems(sources.live, "live", language),
    [sources.live, language],
  );

  const upcomingItems = useMemo(
    () => buildLivestreamItems(upcomingStreams, "upcoming", language),
    [upcomingStreams, language],
  );

  const matchItems = useMemo(
    () => (matchesQ.data ?? []).map((m) => formatProMatchTicker(m, language)),
    [matchesQ.data, language],
  );

  const blogItems = useMemo(
    () => buildBlogItems(language),
    [language],
  );

  const mode = resolveTickerMode({
    liveCount: sources.live.length,
    upcomingCount: upcomingStreams.length,
    matchCount: matchItems.length,
    blogCount: blogItems.length,
  });

  const composedItems = composeTickerItems({
    mode,
    liveItems,
    matchItems,
    upcomingItems,
    blogItems,
  });
  const items = composedItems.length > 0
    ? composedItems
    : [
              {
                id: "empty",
                lead: "",
                body:
                  language === "vi"
                    ? "Hiện không có nội dung — quay lại sau"
                    : "No headlines right now — check back soon",
                href: "/feed",
              },
      ];

  return {
    mode,
    items,
    isLoading: Boolean(sources.isLoading) || matchesQ.isLoading,
  };
}

/* ─── Live + upcoming (Mode 1) ───────────────────────────────────────── */
//
// Time window for "upcoming": the stream's scheduled_start_at must fall
// in [now - LATE_GRACE_MINUTES, now + UPCOMING_WINDOW_HOURS]. Two
// boundaries matter:
//
//   Lower bound (Codex P1 fix on PR #38): without it, stale rows whose
//   start time is in the past — operators forgot to flip status to
//   'live' or 'ended', or the row was orphaned — kept qualifying as
//   upcoming and pinned the ticker to LIVE mode forever, hiding the
//   matches/blog fallback. Real upcoming streams haven't started yet
//   by definition.
//
//   Late grace: a stream that "should have started 3 minutes ago" but
//   whose status is still 'scheduled' is plausibly about to flip live.
//   Keeping it visible for a short window absorbs the human/operator
//   delay between scheduled_start_at and the actual go-live moment.
//   Five minutes is enough cushion without dragging in genuinely stale
//   rows from yesterday.

const LATE_GRACE_MINUTES = 5;

function filterUpcomingWithin24h(
  scheduled: LivestreamWithLogo[],
): LivestreamWithLogo[] {
  const now = Date.now();
  const lower = now - LATE_GRACE_MINUTES * 60_000;
  const upper = now + UPCOMING_WINDOW_HOURS * 3600_000;
  return scheduled.filter((s) => {
    if (!s.scheduled_start_at) return false;
    const ts = new Date(s.scheduled_start_at).getTime();
    return Number.isFinite(ts) && ts >= lower && ts <= upper;
  });
}

function buildLivestreamItems(
  streams: LivestreamWithLogo[],
  kind: "live" | "upcoming",
  language: Language,
): TickerItem[] {
  const tLive = language === "vi" ? "TRỰC TIẾP" : "LIVE";
  const tUpcoming = language === "vi" ? "SẮP TỚI" : "UPCOMING";
  const tFallback = language === "vi" ? "Trận trực tiếp" : "Live match";

  const limit = kind === "live" ? 5 : 3;
  return streams.slice(0, limit).map((s) => ({
      id: `${kind}-${s.id}`,
      lead: kind === "live" ? tLive : tUpcoming,
      body: s.title ?? tFallback,
      trail: s.organization?.name ?? undefined,
      href: `/live/${s.id}`,
    }));
}

/* ─── Pro-tour matches (Mode 2) ──────────────────────────────────────── */

interface ParticipantRow {
  // matches.match_participants.team is a plain string column in the DB;
  // toProMatchInput narrows it via === "a" / === "b" comparisons.
  team: string;
  position: number | null;
  player: { display_name: string | null; username: string | null } | null;
}

interface RawMatchRow {
  id: string;
  slug: string;
  played_at: string;
  verified_at: string | null;
  updated_at: string | null;
  tournament_name: string | null;
  round_name: string | null;
  team_a_score: number[] | null;
  team_b_score: number[] | null;
  winning_team: string | null;
  notes: string | null;
  match_participants: ParticipantRow[] | null;
}

function useRecentProMatches() {
  return useQuery({
    queryKey: ["ticker", "pro-tour-matches"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async (): Promise<ProMatchTickerInput[]> => {
      const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("matches")
        .select(
          `id, slug, played_at, verified_at, updated_at, tournament_name, round_name,
           team_a_score, team_b_score, winning_team, notes,
           match_participants:match_participants(
             team, position,
             player:profiles(display_name, username)
           )`,
        )
        .in("source_provider", ["ppa_tour", "mlp", "app_tour"])
        .eq("is_public", true)
        .eq("verification_status", "verified")
        .gte("played_at", cutoff)
        // Only show matches with a determined winner. Unresolved rows
        // (winning_team IS NULL — partial ingest, in-progress match)
        // would render as "Team A 0:0 Team B" which reads as a tie /
        // misleads a casual viewer. Drop them at the query level so
        // they never enter the formatter; if a future scrape needs to
        // surface in-progress matches, lift this filter and have the
        // formatter render a "vs" separator instead of a score.
        .in("winning_team", ["a", "b"])
        .order("verified_at", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("played_at", { ascending: false })
        .limit(MATCH_LIMIT);
      if (error) throw error;
      return (data ?? []).map(toProMatchInput);
    },
  });
}

function toProMatchInput(row: RawMatchRow): ProMatchTickerInput {
  const aLast: string[] = [];
  const bLast: string[] = [];
  // Sort participants by position so doubles names render in the
  // canonical order (player 1 before player 2). Postgres returns them
  // in arbitrary order otherwise.
  const sorted = [...(row.match_participants ?? [])].sort(
    (x, y) => (x.position ?? 0) - (y.position ?? 0),
  );
  for (const p of sorted) {
    const name = p.player?.display_name ?? p.player?.username ?? "";
    const last = lastNameFromDisplayName(name);
    if (!last) continue;
    if (p.team === "a") aLast.push(last);
    else if (p.team === "b") bLast.push(last);
  }
  return {
    match_id: row.id,
    slug: row.slug,
    tournament_name: row.tournament_name,
    round_name: row.round_name,
    team_a_score: row.team_a_score ?? [],
    team_b_score: row.team_b_score ?? [],
    winning_team:
      row.winning_team === "a" || row.winning_team === "b"
        ? row.winning_team
        : null,
    notes: row.notes,
    team_a_lastnames: aLast,
    team_b_lastnames: bLast,
  };
}

/* ─── Blog (Mode 3) ──────────────────────────────────────────────────── */

function buildBlogItems(language: Language): TickerItem[] {
  return [...blogMetadata]
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, BLOG_LIMIT)
    .map((p) => ({
      id: `blog-${p.slug}`,
      lead: language === "vi" ? "TIN TỨC" : "BLOG",
      body: language === "vi" ? p.titleVi : p.titleEn,
      trail: truncateExcerpt(
        language === "vi" ? p.metaDescriptionVi : p.metaDescriptionEn,
      ),
      href: language === "vi" ? `/vi/blog/${p.slug}` : `/blog/${p.slug}`,
    }));
}

function truncateExcerpt(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed.length <= 90) return trimmed;
  return `${trimmed.slice(0, 87).trimEnd()}…`;
}
