// ============================================================================
// PublicProfile (`/u/:slug`) — public read-only profile page (PR53).
// ----------------------------------------------------------------------------
// Four zones:
//   1. Header — avatar + name + level + counts
//   2. Stats grid — events / matches / wins(%) / streak
//   3. Badges — every BADGE_DEFINITIONS card + locked progress hint
//   4. Match history — latest 20 with "Xem thêm" pagination
//
// Slug resolution: 8-char prefix of profile.id. Lookup uses `ilike`
// against the stringified UUID. Collisions resolve to the first match
// (rare at the scale we'll see; 12-char fallback supported in the
// helper if/when needed).
// ============================================================================

import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { StatsGrid } from "@/components/profile/StatsGrid";
import { BadgesGrid } from "@/components/profile/BadgesGrid";
import {
  MatchHistoryList,
  type HistoryMatchRow,
} from "@/components/profile/MatchHistoryList";
import { normalizeSlug } from "@/lib/badges/profileSlug";

const PAGE_SIZE = 20;

interface ResolvedProfile {
  id: string;
  display_name: string;
  is_ghost: boolean;
  self_rating: number | null;
}

interface PlayerStatsRow {
  player_id: string;
  events_played: number;
  matches_played: number;
  wins: number;
  losses: number;
}

interface MatchRaw {
  id: string;
  round: number;
  court: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  winning_team: "a" | "b" | null;
  updated_at: string;
  event: {
    slug: string;
    title_vi: string;
    title_en: string | null;
  } | null;
}

function pickName(id: string | null, names: Record<string, string>): string {
  if (!id) return "—";
  return names[id] ?? "?";
}

export default function PublicProfile() {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const profileTr = t.socialEvents.profile;
  const [page, setPage] = useState(1);

  const slug = normalizeSlug(rawSlug);

  // ─── Profile row ────────────────────────────────────────────────────────
  const { data: resolved, isLoading: profileLoading } = useQuery<ResolvedProfile | null>({
    queryKey: ["public-profile", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, is_ghost, self_rating")
        .filter("id", "ilike", `${slug}%`)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("PublicProfile: lookup error", { slug, error });
        return null;
      }
      return data as ResolvedProfile | null;
    },
    enabled: Boolean(slug),
    staleTime: 60_000,
  });

  // ─── Stats ──────────────────────────────────────────────────────────────
  const { data: stats } = useQuery<PlayerStatsRow | null>({
    queryKey: ["player-stats", resolved?.id],
    queryFn: async () => {
      if (!resolved?.id) return null;
      const { data } = await supabase
        .from("player_stats")
        .select("player_id, events_played, matches_played, wins, losses")
        .eq("player_id", resolved.id)
        .maybeSingle();
      return (data as PlayerStatsRow | null) ?? null;
    },
    enabled: Boolean(resolved?.id),
    staleTime: 30_000,
  });

  // ─── Current win streak ────────────────────────────────────────────────
  const { data: streak } = useQuery<number>({
    queryKey: ["player-streak", resolved?.id],
    queryFn: async () => {
      if (!resolved?.id) return 0;
      const { data } = await supabase.rpc("compute_player_win_streak", {
        p_player_id: resolved.id,
      });
      return typeof data === "number" ? data : 0;
    },
    enabled: Boolean(resolved?.id),
    staleTime: 30_000,
  });

  // ─── Earned badges ──────────────────────────────────────────────────────
  const { data: badges } = useQuery<Record<string, string>>({
    queryKey: ["user-badges", resolved?.id],
    queryFn: async () => {
      if (!resolved?.id) return {};
      const { data } = await supabase
        .from("user_badges")
        .select("badge_code, earned_at")
        .eq("user_id", resolved.id);
      const map: Record<string, string> = {};
      for (const b of (data as { badge_code: string; earned_at: string }[]) ?? []) {
        map[b.badge_code] = b.earned_at;
      }
      return map;
    },
    enabled: Boolean(resolved?.id),
    staleTime: 30_000,
  });

  // ─── Match history (paginated) ─────────────────────────────────────────
  const { data: matchesRaw, isLoading: matchesLoading } = useQuery<MatchRaw[]>({
    queryKey: ["profile-matches", resolved?.id, page],
    queryFn: async () => {
      if (!resolved?.id) return [];
      const { data, error } = await supabase
        .from("social_event_matches")
        .select(
          `id, round, court,
           team_a_player1_id, team_a_player2_id,
           team_b_player1_id, team_b_player2_id,
           team_a_score, team_b_score, winning_team, updated_at,
           event:social_events!social_event_matches_event_id_fkey(slug, title_vi, title_en)`,
        )
        .eq("status", "completed")
        .or(
          `team_a_player1_id.eq.${resolved.id},team_a_player2_id.eq.${resolved.id},team_b_player1_id.eq.${resolved.id},team_b_player2_id.eq.${resolved.id}`,
        )
        .order("updated_at", { ascending: false })
        .limit(page * PAGE_SIZE);
      if (error) {
        console.error("profile-matches fetch error", error);
        return [];
      }
      return (data as MatchRaw[]) ?? [];
    },
    enabled: Boolean(resolved?.id),
    staleTime: 15_000,
  });

  // Build display_name lookup for each player_id referenced by the
  // visible matches so the partner/opponent columns aren't just UUIDs.
  // Single query for all 4 IDs per match — small N (≤ 20*3 = 60 unique).
  const otherIds = Array.from(
    new Set(
      (matchesRaw ?? []).flatMap((m) =>
        [
          m.team_a_player1_id,
          m.team_a_player2_id,
          m.team_b_player1_id,
          m.team_b_player2_id,
        ].filter((x): x is string => x != null && x !== resolved?.id),
      ),
    ),
  );

  const { data: nameMap } = useQuery<Record<string, string>>({
    queryKey: ["profile-name-map", otherIds.sort().join(",")],
    queryFn: async () => {
      if (otherIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", otherIds);
      const m: Record<string, string> = {};
      for (const p of (data as { id: string; display_name: string }[]) ?? []) {
        m[p.id] = p.display_name;
      }
      return m;
    },
    enabled: otherIds.length > 0,
    staleTime: 60_000,
  });

  // Loading / not-found rails.
  if (!slug) {
    return (
      <TheLineLayout title={profileTr.notFoundTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{profileTr.notFoundTitle}</h1>
        </div>
      </TheLineLayout>
    );
  }
  if (profileLoading) {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (!resolved) {
    return (
      <TheLineLayout title={profileTr.notFoundTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{profileTr.notFoundTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)" }}>{profileTr.notFoundBody}</p>
        </div>
      </TheLineLayout>
    );
  }

  const eventsPlayed = stats?.events_played ?? 0;
  const matchesPlayed = stats?.matches_played ?? 0;
  const wins = stats?.wins ?? 0;
  const currentStreak = streak ?? 0;

  const matches: HistoryMatchRow[] = (matchesRaw ?? []).map((m) => {
    const onTeamA =
      m.team_a_player1_id === resolved.id || m.team_a_player2_id === resolved.id;
    const myTeam: "a" | "b" = onTeamA ? "a" : "b";
    const partnerId = onTeamA
      ? m.team_a_player1_id === resolved.id
        ? m.team_a_player2_id
        : m.team_a_player1_id
      : m.team_b_player1_id === resolved.id
        ? m.team_b_player2_id
        : m.team_b_player1_id;
    const opp1Id = onTeamA ? m.team_b_player1_id : m.team_a_player1_id;
    const opp2Id = onTeamA ? m.team_b_player2_id : m.team_a_player2_id;
    return {
      id: m.id,
      updated_at: m.updated_at,
      event_slug: m.event?.slug ?? "",
      event_title:
        language === "vi"
          ? m.event?.title_vi ?? ""
          : m.event?.title_en && m.event.title_en.trim().length > 0
            ? m.event.title_en
            : m.event?.title_vi ?? "",
      round: m.round,
      court: m.court,
      team_a_score: m.team_a_score,
      team_b_score: m.team_b_score,
      winning_team: m.winning_team,
      my_team: myTeam,
      partner_name: pickName(partnerId, nameMap ?? {}),
      opponent1_name: pickName(opp1Id, nameMap ?? {}),
      opponent2_name: pickName(opp2Id, nameMap ?? {}),
    };
  });

  // `hasMore` is approximate — if the latest page returned exactly N*PAGE_SIZE
  // rows there's probably one more page. The query refetches with a larger
  // limit, not a true offset cursor.
  const hasMore = matchesPlayed > matches.length;

  return (
    <TheLineLayout title={resolved.display_name} active="events">
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 880, margin: "0 auto" }}>
        <ProfileHeader
          displayName={resolved.display_name}
          isGhost={resolved.is_ghost}
          level={resolved.self_rating ?? null}
          eventsPlayed={eventsPlayed}
          matchesPlayed={matchesPlayed}
        />

        <div className="mt-2">
          <StatsGrid
            eventsPlayed={eventsPlayed}
            matchesPlayed={matchesPlayed}
            wins={wins}
            currentStreak={currentStreak}
          />
        </div>

        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {profileTr.badgesHeading}
          </h2>
          <BadgesGrid
            earnedMap={badges ?? {}}
            progress={{
              events: eventsPlayed,
              matches: matchesPlayed,
              wins,
              streak: currentStreak,
            }}
          />
        </Card>

        <Card className="mt-6 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {profileTr.historyHeading}
          </h2>
          {matchesLoading && matches.length === 0 ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <MatchHistoryList
              matches={matches}
              hasMore={hasMore}
              onLoadMore={() => setPage((p) => p + 1)}
              loadingMore={matchesLoading && page > 1}
            />
          )}
        </Card>
      </div>
    </TheLineLayout>
  );
}
