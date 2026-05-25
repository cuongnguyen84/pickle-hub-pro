// ============================================================================
// useDuprClubs — React Query hook for DUPR club memberships
// ----------------------------------------------------------------------------
// Reads dupr_user_clubs cache directly via RLS (self-read policy from
// migration 20260516040000). Falls through to dupr-clubs edge fn when no
// fresh row exists. Exposes helpers for the common gating questions.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type DuprClubRole = "DIRECTOR" | "ORGANIZER" | "PLAYER";

export interface DuprClubMembership {
  club_id: number;
  club_name: string | null;
  role: DuprClubRole;
}

async function fetchCached(userId: string): Promise<DuprClubMembership[] | null> {
  // Freshness lives in dupr_user_clubs_meta so empty membership lists still
  // count as a fresh cache hit (zero-club users would otherwise re-fetch on
  // every render).
  const { data: meta, error: metaErr } = await supabase
    .from("dupr_user_clubs_meta")
    .select("expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (metaErr) throw metaErr;
  if (!meta || new Date(meta.expires_at).getTime() <= Date.now()) return null;

  const { data, error } = await supabase
    .from("dupr_user_clubs")
    .select("club_id, club_name, role")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as DuprClubMembership[];
}

async function fetchFromEdge(force = false): Promise<DuprClubMembership[]> {
  const { data, error } = await supabase.functions.invoke<{
    clubs?: DuprClubMembership[];
    error?: string;
  }>("dupr-clubs", { body: force ? { force: true } : {} });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 412) return [];
    throw error;
  }
  return data?.clubs ?? [];
}

export function useDuprClubs() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["dupr", "clubs", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return [];
      const cached = await fetchCached(userId);
      if (cached) return cached;
      return fetchFromEdge(false);
    },
  });

  const refreshMut = useMutation({
    mutationFn: () => fetchFromEdge(true),
    onSuccess: (clubs) => {
      qc.setQueryData(["dupr", "clubs", userId], clubs);
    },
  });

  const clubs = query.data ?? [];
  const submitterClubs = clubs.filter(
    (c) => c.role === "DIRECTOR" || c.role === "ORGANIZER",
  );

  return {
    loading: query.isLoading,
    clubs,
    submitterClubs,
    canSubmitForClub: (clubId: number) =>
      submitterClubs.some((c) => c.club_id === clubId),
    refresh: () => refreshMut.mutateAsync(),
    refreshing: refreshMut.isPending,
  };
}

export function useInvalidateDuprClubs() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["dupr", "clubs"], exact: false });
}
