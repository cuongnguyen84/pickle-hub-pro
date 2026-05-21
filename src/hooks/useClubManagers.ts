// ============================================================================
// useClubManagers — fetch + mutate the manager list for one club.
// ----------------------------------------------------------------------------
// Wraps the list_club_managers / add_club_manager / remove_club_manager
// RPCs added in migration 20260521130000_club_managers.sql. RLS still
// applies on top of these RPCs — list_club_managers only returns rows
// when the caller can see them (creator + manager + admin).
//
// Returns:
//   * managers     — array of ClubManager rows (ordered by added_at ASC)
//   * isLoading    — initial fetch
//   * addManager   — mutation: add by profile_id, throws structured error
//   * removeManager — mutation: remove by profile_id
//
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClubManager {
  profile_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  added_at: string;
  added_by: string;
}

export interface ProfileSearchResult {
  profile_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

/** Result of a mutation; `code` matches the SQL RAISE EXCEPTION message. */
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

export function useClubManagers(clubId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: managers = [], isLoading, refetch } = useQuery<ClubManager[]>({
    queryKey: ["club-managers", clubId],
    queryFn: async () => {
      if (!clubId) return [];
      const { data, error } = await supabase.rpc("list_club_managers", {
        p_club_id: clubId,
      });
      if (error) {
        // RLS / RPC errors surface as data=null. Caller can refetch.
        return [];
      }
      return (data ?? []) as ClubManager[];
    },
    enabled: Boolean(clubId),
    staleTime: 30_000,
  });

  const addManager = useMutation<
    ClubManager,
    MutationError,
    { profileId: string }
  >({
    mutationFn: async ({ profileId }) => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("add_club_manager", {
        p_club_id: clubId,
        p_profile_id: profileId,
      });
      if (error) throw toMutationError(error);
      // The RPC returns a single row (record) — supabase-js wraps it.
      return data as unknown as ClubManager;
    },
    onSuccess: () => {
      // Invalidate the managers list + the membership cache for the new
      // manager so an immediate page refresh shows them as such.
      void queryClient.invalidateQueries({ queryKey: ["club-managers", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club-manager-membership"] });
    },
  });

  const removeManager = useMutation<number, MutationError, { profileId: string }>({
    mutationFn: async ({ profileId }) => {
      if (!clubId) throw new Error("missing_club_id");
      const { data, error } = await supabase.rpc("remove_club_manager", {
        p_club_id: clubId,
        p_profile_id: profileId,
      });
      if (error) throw toMutationError(error);
      return Number(data ?? 0);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club-managers", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["club-manager-membership"] });
    },
  });

  return { managers, isLoading, refetch, addManager, removeManager };
}

/**
 * One-off search wrapper around search_profile_for_manager. Returns at
 * most 1 row. Email + phone exact match (case-insensitive for email,
 * exact E.164 for phone).
 */
export async function searchProfileForManager(
  query: string,
): Promise<ProfileSearchResult | null> {
  const trimmed = query.trim();
  if (trimmed.length < 4) return null;
  const { data, error } = await supabase.rpc("search_profile_for_manager", {
    p_query: trimmed,
  });
  if (error) return null;
  const rows = (data ?? []) as ProfileSearchResult[];
  return rows.length > 0 ? rows[0] : null;
}
