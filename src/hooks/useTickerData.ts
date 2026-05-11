import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLivestreams, type LivestreamWithLogo } from "@/hooks/useLivestreamData";
import { blogMetadata } from "@/content/blog/metadata";
import { usePublishedViBlogPosts } from "@/hooks/useViBlogPosts";
import {
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
 * Three priority modes (resolved by `resolveTickerMode`):
 *   1. LIVE     — live now OR scheduled within the next 24h
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

export function useTickerData(language: Language): UseTickerDataResult {
  const liveQ = useLivestreams("live");
  const scheduledQ = useLivestreams("scheduled");
  const matchesQ = useRecentProMatches();
  const viBlogQ = usePublishedViBlogPosts();

  const upcomingStreams = useMemo(
    () => filterUpcomingWithin24h(scheduledQ.data ?? []),
    [scheduledQ.data],
  );

  const liveItems = useMemo(
    () => buildLivestreamItems(liveQ.data ?? [], upcomingStreams, language),
    [liveQ.data, upcomingStreams, language],
  );

  const matchItems = useMemo(
    () => (matchesQ.data ?? []).map((m) => formatProMatchTicker(m, language)),
    [matchesQ.data, language],
  );

  const blogItems = useMemo(
    () => buildBlogItems(language, viBlogQ.data ?? []),
    [language, viBlogQ.data],
  );

  const mode = resolveTickerMode({
    liveCount: liveQ.data?.length ?? 0,
    upcomingCount: upcomingStreams.length,
    matchCount: matchItems.length,
    blogCount: blogItems.length,
  });

  const items =
    mode === "live"
      ? liveItems
      : mode === "matches"
        ? matchItems
        : mode === "blog"
          ? blogItems
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
    isLoading: liveQ.isLoading || scheduledQ.isLoading || matchesQ.isLoading,
  };
}

/* ─── Live + upcoming (Mode 1) ───────────────────────────────────────── */

function filterUpcomingWithin24h(
  scheduled: LivestreamWithLogo[],
): LivestreamWithLogo[] {
  const cutoff = Date.now() + UPCOMING_WINDOW_HOURS * 3600_000;
  return scheduled.filter((s) => {
    if (!s.scheduled_start_at) return false;
    const ts = new Date(s.scheduled_start_at).getTime();
    return Number.isFinite(ts) && ts <= cutoff;
  });
}

function buildLivestreamItems(
  live: LivestreamWithLogo[],
  upcoming: LivestreamWithLogo[],
  language: Language,
): TickerItem[] {
  const items: TickerItem[] = [];
  const tLive = language === "vi" ? "TRỰC TIẾP" : "LIVE";
  const tUpcoming = language === "vi" ? "SẮP TỚI" : "UPCOMING";
  const tFallback = language === "vi" ? "Trận trực tiếp" : "Live match";

  for (const s of live.slice(0, 5)) {
    items.push({
      id: `live-${s.id}`,
      lead: tLive,
      body: s.title ?? tFallback,
      trail: s.organization?.name ?? undefined,
      href: `/live/${s.id}`,
    });
  }
  for (const s of upcoming.slice(0, 3)) {
    items.push({
      id: `upcoming-${s.id}`,
      lead: tUpcoming,
      body: s.title ?? tFallback,
      trail: s.organization?.name ?? undefined,
      href: `/live/${s.id}`,
    });
  }
  return items;
}

/* ─── Pro-tour matches (Mode 2) ──────────────────────────────────────── */

interface ParticipantRow {
  team: "a" | "b";
  position: number | null;
  player: { display_name: string | null; username: string | null } | null;
}

interface RawMatchRow {
  id: string;
  slug: string;
  played_at: string;
  tournament_name: string | null;
  round_name: string | null;
  team_a_score: number[] | null;
  team_b_score: number[] | null;
  winning_team: string | null;
  match_participants: ParticipantRow[] | null;
}

function useRecentProMatches() {
  return useQuery({
    queryKey: ["ticker", "pro-tour-matches"],
    staleTime: 60_000, // 1 min — cron writes new rows every 6h, ticker
    // doesn't need second-by-second freshness
    queryFn: async (): Promise<ProMatchTickerInput[]> => {
      const cutoff = new Date(Date.now() - MATCH_WINDOW_DAYS * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("matches")
        .select(
          `id, slug, played_at, tournament_name, round_name,
           team_a_score, team_b_score, winning_team,
           match_participants:match_participants(
             team, position,
             player:profiles(display_name, username)
           )`,
        )
        .eq("source_provider", "ppa_tour")
        .eq("is_public", true)
        .gte("played_at", cutoff)
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
    team_a_lastnames: aLast,
    team_b_lastnames: bLast,
  };
}

/* ─── Blog (Mode 3) ──────────────────────────────────────────────────── */

interface ViBlogPost {
  slug?: string;
  title?: string | null;
  meta_description?: string | null;
  published_at?: string | null;
}

function buildBlogItems(language: Language, viPosts: ViBlogPost[]): TickerItem[] {
  if (language === "vi") {
    return viPosts.slice(0, BLOG_LIMIT).map((p, idx) => ({
      id: `blog-${p.slug ?? idx}`,
      lead: "TIN TỨC",
      body: p.title ?? "",
      trail: truncateExcerpt(p.meta_description),
      href: `/vi/blog/${p.slug ?? ""}`,
    }));
  }
  // EN: static metadata, sort DESC by publishedDate
  return [...blogMetadata]
    .sort((a, b) => b.publishedDate.localeCompare(a.publishedDate))
    .slice(0, BLOG_LIMIT)
    .map((p) => ({
      id: `blog-${p.slug}`,
      lead: "BLOG",
      body: p.titleEn,
      trail: truncateExcerpt(p.metaDescriptionEn),
      href: `/blog/${p.slug}`,
    }));
}

function truncateExcerpt(s: string | null | undefined): string | undefined {
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed.length <= 90) return trimmed;
  return `${trimmed.slice(0, 87).trimEnd()}…`;
}
