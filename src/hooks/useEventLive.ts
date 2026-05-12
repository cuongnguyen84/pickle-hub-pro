// ============================================================================
// useEventLive — Live event data + realtime subscription for /su-kien/:slug/live
// ----------------------------------------------------------------------------
// Returns:
//   - allMatches:        every social_event_matches row for the event
//   - standings:         match-derived stats, **seeded** with every registered
//                        player at 0-0 so the Standings zone renders something
//                        useful immediately after the schedule is saved (no
//                        completed matches yet)
//   - currentMatch:      the in_progress OR earliest scheduled match for the
//                        identified player. Page uses currentInProgress to
//                        decide whether to show score input or a "start" CTA.
//   - currentInProgress: true iff currentMatch.status === 'in_progress'
//   - firstScheduled:    event-wide first scheduled match (round asc, court
//                        asc). Used by the spectator-visible Next zone.
//   - me:                resolved registration row when identified, else null
//
// Realtime pattern follows useFlexRealtime — channel per event, single
// postgres_changes subscription on social_event_matches filtered by event_id,
// callback re-runs the React-Query fetch via queryClient.invalidateQueries.
// ============================================================================

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEventRegistrations } from "@/hooks/useEventRegistrations";
import {
  computeStandings,
  findStanding,
  seedStandingsWithRoster,
  type StandingRow,
  type RosterEntry,
} from "@/lib/social-events/standings";

const MAGIC_TOKEN_STORAGE_PREFIX = "tph-event-magic:";

export interface LiveMatchRow {
  id: string;
  event_id: string;
  round: number;
  court: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  status: "scheduled" | "in_progress" | "completed";
  confirmed_by_team_a: boolean;
  confirmed_by_team_b: boolean;
  winning_team: "a" | "b" | null;
  created_at: string;
  updated_at: string;
}

interface MagicTokenEntry {
  token: string;
  registration_id: string;
  registered_at: string;
  expires_at: string;
}

export interface MyRegistration {
  registration_id: string;
  profile_id: string;
  display_name: string;
  magic_token: string | null;
  /** Whether the identification came from auth.uid() or the magic token. */
  via: "auth" | "magic_token";
}

export interface LiveData {
  allMatches: LiveMatchRow[];
  standings: StandingRow[];
  currentMatch: LiveMatchRow | null;
  currentInProgress: boolean;
  firstScheduled: LiveMatchRow | null;
}

interface StoredEntry {
  token: string;
  registration_id: string;
}

/**
 * Read both the magic_token AND the registration_id that RegistrationModal
 * persisted at OTP-verify time. After PR47 bug 1 the token is private —
 * the frontend looks up its registration row by id (which is public-readable
 * for published events) and keeps the token client-side for passing to
 * submit-match-score.
 */
function readStoredEntry(eventId: string | undefined): StoredEntry | null {
  if (!eventId) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${MAGIC_TOKEN_STORAGE_PREFIX}${eventId}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<MagicTokenEntry>;
    if (!parsed.token || !parsed.registration_id) return null;
    if (parsed.expires_at && new Date(parsed.expires_at).getTime() < Date.now()) {
      return null;
    }
    return { token: parsed.token, registration_id: parsed.registration_id };
  } catch {
    return null;
  }
}

/**
 * Identify the current player either from auth.uid() OR from the
 * { token, registration_id } pair stored at registration time. Both paths
 * read public columns only — the magic_token never appears in any SELECT
 * against event_registrations (it lives in registration_secrets, service
 * role only).
 */
function useMyRegistration(eventId: string | undefined): MyRegistration | null {
  const { user } = useAuth();
  const stored = useMemo(() => readStoredEntry(eventId), [eventId]);

  const { data } = useQuery<MyRegistration | null>({
    queryKey: [
      "my-event-registration",
      eventId,
      user?.id ?? null,
      stored?.registration_id ?? null,
    ],
    queryFn: async () => {
      if (!eventId) return null;
      if (user?.id) {
        const { data: row } = await supabase
          .from("event_registrations")
          .select("id, profile_id, display_name")
          .eq("event_id", eventId)
          .eq("profile_id", user.id)
          .neq("status", "cancelled")
          .maybeSingle();
        if (row) {
          const r = row as {
            id: string;
            profile_id: string;
            display_name: string;
          };
          return {
            registration_id: r.id,
            profile_id: r.profile_id,
            display_name: r.display_name,
            // Most authed users also went through the OTP modal which
            // wrote a token into localStorage; reuse it so score
            // submission still works. Authed organizers (who didn't
            // self-register) get null and rely on the organizer override
            // button instead.
            magic_token:
              stored && stored.registration_id === r.id ? stored.token : null,
            via: "auth",
          };
        }
      }
      if (stored) {
        const { data: row } = await supabase
          .from("event_registrations")
          .select("id, profile_id, display_name, event_id")
          .eq("id", stored.registration_id)
          .neq("status", "cancelled")
          .maybeSingle();
        if (row) {
          const r = row as {
            id: string;
            profile_id: string | null;
            display_name: string;
            event_id: string;
          };
          // Defensive: localStorage entry is keyed by event_id but verify
          // the row's event matches in case of stale / tampered storage.
          if (r.event_id === eventId && r.profile_id) {
            return {
              registration_id: r.id,
              profile_id: r.profile_id,
              display_name: r.display_name,
              magic_token: stored.token,
              via: "magic_token",
            };
          }
        }
      }
      return null;
    },
    enabled: Boolean(eventId),
    staleTime: 60_000,
  });

  return data ?? null;
}

export function useEventLive(eventId: string | undefined): {
  data: LiveData;
  isLoading: boolean;
  me: MyRegistration | null;
  myStanding: StandingRow | null;
} {
  const queryClient = useQueryClient();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const me = useMyRegistration(eventId);

  // Pull registrations so we can (a) seed standings with all registered
  // players at 0-0 even before a single match has completed, and (b) sort
  // initial standings by self-rated level descending.
  const { data: registrations } = useEventRegistrations(eventId);

  const { data: matches, isLoading } = useQuery<LiveMatchRow[]>({
    queryKey: ["social-event-matches", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("social_event_matches")
        .select(
          `id, event_id, round, court,
           team_a_player1_id, team_a_player2_id,
           team_b_player1_id, team_b_player2_id,
           team_a_score, team_b_score, status,
           confirmed_by_team_a, confirmed_by_team_b,
           winning_team, created_at, updated_at`,
        )
        .eq("event_id", eventId)
        .order("round", { ascending: true })
        .order("court", { ascending: true });
      if (error) {
        console.error("useEventLive: lookup error", { eventId, error });
        return [];
      }
      return (data ?? []) as LiveMatchRow[];
    },
    enabled: Boolean(eventId),
    staleTime: 5_000,
  });

  // Realtime: refetch the matches query on any change. The push payload
  // itself is discarded — React Query is the single source of truth so we
  // avoid divergent client-side state from a partial UPDATE event.
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase
      .channel(`social-event:${eventId}:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_event_matches",
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["social-event-matches", eventId] });
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [eventId, queryClient]);

  const standings = useMemo(() => {
    const base = computeStandings(matches ?? []);
    const roster: RosterEntry[] = (registrations ?? [])
      .filter((r) => r.profile_id !== null)
      .map((r) => ({
        profile_id: r.profile_id as string,
        level: r.self_rated_level,
      }));
    return seedStandingsWithRoster(base, roster);
  }, [matches, registrations]);

  const firstScheduled = useMemo<LiveMatchRow | null>(() => {
    if (!matches || matches.length === 0) return null;
    // matches is already round/court asc from the query — first scheduled
    // is the earliest in the queue.
    return matches.find((m) => m.status === "scheduled") ?? null;
  }, [matches]);

  const { currentMatch, currentInProgress } = useMemo(() => {
    if (!me || !matches || matches.length === 0) {
      return { currentMatch: null, currentInProgress: false };
    }
    const profileId = me.profile_id;
    const mine = matches.filter((m) => {
      return (
        m.team_a_player1_id === profileId ||
        m.team_a_player2_id === profileId ||
        m.team_b_player1_id === profileId ||
        m.team_b_player2_id === profileId
      );
    });
    if (mine.length === 0) {
      return { currentMatch: null, currentInProgress: false };
    }

    // "Current" = first in_progress OR first scheduled by (round, court).
    // The page renders score input only when currentInProgress is true; for
    // a scheduled match it shows a "Start playing" CTA instead.
    const inProgress = mine.find((m) => m.status === "in_progress");
    if (inProgress) {
      return { currentMatch: inProgress, currentInProgress: true };
    }
    const nextScheduled = mine
      .filter((m) => m.status === "scheduled")
      .sort((a, b) => a.round - b.round || a.court - b.court)[0];
    return {
      currentMatch: nextScheduled ?? null,
      currentInProgress: false,
    };
  }, [me, matches]);

  const myStanding = useMemo(() => {
    if (!me) return null;
    return findStanding(standings, me.profile_id);
  }, [me, standings]);

  return {
    data: {
      allMatches: matches ?? [],
      standings,
      currentMatch,
      currentInProgress,
      firstScheduled,
    },
    isLoading,
    me,
    myStanding,
  };
}
