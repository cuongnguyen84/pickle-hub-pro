// ============================================================================
// useClubMembers / useMyMembership — CLB member management hooks.
// ----------------------------------------------------------------------------
// Wraps the RPCs added in migration 20260522120000_club_members.sql:
//   - list_club_members      (active + pending rows, organizers see emails)
//   - my_club_membership_status (creator|manager|active|pending|none|anonymous)
//   - invite_club_member     (organizer-initiated, lands ACTIVE)
//   - request_to_join_club   (self-service, lands PENDING)
//   - approve_club_member    (organizer flips pending → active)
//   - remove_club_member     (organizer or self, rejects or removes)
//
// PR 20260527 — list_club_members RPC now returns 4 DUPR columns
// (migration 20260527130000); UI renders connection badge per member.
//
// PR 20260527 (mobile UX) — useClubMembers wires 3 refetch triggers so
// the organizer dashboard updates without manual refresh:
//   1. Supabase realtime channel listening to INSERT/UPDATE/DELETE on
//      club_members filtered by club_id.
//   2. document.visibilitychange (web) — refetch when tab regains focus.
//   3. Capacitor App appStateChange (iOS/Android native) — refetch when
//      WebView app resumes from background.
// `refetchOnWindowFocus: true` is set per-query to override the global
// `false` default (App.tsx defaultOptions).
//
// The shape mirrors useClubManagers so the UI components stay consistent.
// ============================================================================

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNativeApp } from "@/lib/capacitor-utils";

export type ClubMemberStatus = "pending" | "active";

export type DuprConnectionMethod = "manual" | "sso" | "pending_reconnect";

export interface ClubMember {
  profile_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: ClubMemberStatus;
  added_at: string;
  added_by: string | null;
  approved_at: string | null;
  /** DUPR id from profiles.dupr_id (PR 20260527). NULL when not connected. */
  dupr_id: string | null;
  /** Singles rating, NULL when no recent DUPR sync. */
  dupr_singles: number | null;
  /** Doubles rating. */
  dupr_doubles: number | null;
  /** Connection method tracked by useDuprConnection — 'sso' is the
   *  official one, 'manual' is legacy, 'pending_reconnect' means user
   *  had manual rating before SSO and hasn't reconnected. */
  dupr_connected_via: DuprConnectionMethod | null;
}

export type MyMembershipStatus =
  | "anonymous"
  | "none"
  | "pending"
  | "active"
  | "manager"
  | "creator";

export interface MutationError {
  code: string;
  message: string;
}

function toMutationError(error: unknown): MutationError {
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: unknown }).message ?? "").trim();
    return { code: msg, message: msg };
  }
  return { code: "unknown", message: "Unknown error" };
}

/**
 * Fetch the membership list + expose invite / approve / remove mutations.
 * The list returned to non-organizer viewers only contains active members
 * (the RPC filters pending rows server-side).
 */
export function useClubMembers(clubId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading, refetch } = useQuery<ClubMember[]>({
    queryKey: ["club-members", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.rpc("list_club_members", {
        p_club_id: clubId,
      });
      if (error) return [];
      return (data ?? []) as ClubMember[];
    },
    enabled: Boolean(clubId),
    staleTime: 15_000, // 15s; realtime + visibility will cover gaps
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
    void queryClient.invalidateQueries({ queryKey: ["my-club-membership", clubId] });
  }

  // ─── Realtime + foreground refetch (PR 20260527) ───────────────────────
  useEffect(() => {
    if (!clubId) return;

    // 1. Supabase Realtime — subscribe to club_members changes for this club.
    const channel = supabase
      .channel(`club-members-${clubId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "club_members",
          filter: `club_id=eq.${clubId}`,
        },
        () => {
          invalidate();
        },
      )
      .subscribe();

    // 2. Document visibilitychange — refetch when web tab regains focus.
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void refetch();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    // 3. Capacitor App appStateChange — refetch when native WebView resumes.
    let nativeListenerCleanup: (() => void) | null = null;
    if (isNativeApp()) {
      void (async () => {
        try {
          const { App } = await import("@capacitor/app");
          const handle = await App.addListener("appStateChange", ({ isActive }) => {
            if (isActive) void refetch();
          });
          nativeListenerCleanup = () => {
            void handle.remove();
          };
        } catch {
          // Plugin not available — ignore.
        }
      })();
    }

    return () => {
      void supabase.removeChannel(channel);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      nativeListenerCleanup?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const inviteMember = useMutation<ClubMember, MutationError, { profileId: string }>({
    mutationFn: async ({ profileId }) => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("invite_club_member", {
        p_club_id: clubId,
        p_profile_id: profileId,
      });
      if (error) throw toMutationError(error);
      return data as unknown as ClubMember;
    },
    onSuccess: invalidate,
  });

  const approveMember = useMutation<ClubMember, MutationError, { profileId: string }>({
    mutationFn: async ({ profileId }) => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("approve_club_member", {
        p_club_id: clubId,
        p_profile_id: profileId,
      });
      if (error) throw toMutationError(error);
      return data as unknown as ClubMember;
    },
    onSuccess: invalidate,
  });

  const removeMember = useMutation<number, MutationError, { profileId: string }>({
    mutationFn: async ({ profileId }) => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("remove_club_member", {
        p_club_id: clubId,
        p_profile_id: profileId,
      });
      if (error) throw toMutationError(error);
      return Number(data ?? 0);
    },
    onSuccess: invalidate,
  });

  return {
    members,
    isLoading,
    refetch,
    inviteMember,
    approveMember,
    removeMember,
  };
}

/**
 * Viewer's relationship with a club. Drives the ClubLanding join button +
 * the RegistrationModal "skip OTP" path.
 *
 *   anonymous → no user logged in
 *   none      → logged-in user, not in any role for this club
 *   pending   → requested to join, awaiting approval
 *   active    → confirmed member (skip OTP at event registration)
 *   manager   → in club_managers table
 *   creator   → clubs.created_by
 */
export function useMyMembership(clubId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery<MyMembershipStatus>({
    queryKey: ["my-club-membership", clubId, user?.id ?? null],
    queryFn: async () => {
      if (!clubId) return "anonymous";
      const { data, error } = await supabase.rpc("my_club_membership_status", {
        p_club_id: clubId,
      });
      if (error) return "none";
      return ((data as MyMembershipStatus) ?? "none");
    },
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });

  const requestJoin = useMutation<MyMembershipStatus, MutationError>({
    mutationFn: async () => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("request_to_join_club", {
        p_club_id: clubId,
      });
      if (error) throw toMutationError(error);
      return (data as MyMembershipStatus) ?? "pending";
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-club-membership", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
    },
  });

  const leaveClub = useMutation<number, MutationError>({
    mutationFn: async () => {
      if (!clubId || !user?.id) throw new Error("missing_args");
      const { data, error } = await supabase.rpc("remove_club_member", {
        p_club_id: clubId,
        p_profile_id: user.id,
      });
      if (error) throw toMutationError(error);
      return Number(data ?? 0);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-club-membership", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club-members", clubId] });
    },
  });

  return {
    status: query.data ?? "anonymous",
    isLoading: query.isLoading,
    requestJoin,
    leaveClub,
  };
}
