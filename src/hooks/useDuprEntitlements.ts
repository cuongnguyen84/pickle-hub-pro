// ============================================================================
// useDuprEntitlements — React Query hook for DUPR entitlement gating
// ----------------------------------------------------------------------------
// Reads the dupr_user_entitlements cache row directly via RLS (self-read
// policy from migration 20260516010000). Falls through to the
// `dupr-entitlements` edge function when the row is missing or expired —
// the edge fn fetches POST /subscription/active from DUPR, caches 24h, and
// returns the merged entitlements payload.
//
// Per DUPR spec (https://dupr.gitbook.io/dupr-raas/integration-requirements/
// user-gating): BASIC_L1 on `tournaments` is mandatory for any platform
// action; PREMIUM_L1 is required for DUPR+ tournaments; VERIFIED_L1
// indicates ID verification.
//
// The hook returns derived booleans (hasBasic / hasPremium / hasVerified)
// plus a `refresh` mutation that bypasses the 24h cache.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type DuprEntitlementsPayload = {
  display_name: string | null;
  status: string | null;
  entitlements: Record<string, string[]>;
  fetched_at: string;
  expires_at: string;
};

export type DuprEntitlementsResult = {
  loading: boolean;
  /** True iff a fresh cache row exists OR edge fn returned a payload. */
  connected: boolean;
  payload: DuprEntitlementsPayload | null;
  /** Tournament-resource booleans (the only resource currently in use). */
  hasBasic: boolean;
  hasPremium: boolean;
  hasVerified: boolean;
  /** Generic check across any resource (default "tournaments"). */
  has: (entitlement: string, resource?: string) => boolean;
  /** Force-refresh via the edge function (bypasses 24h cache). */
  refresh: () => Promise<void>;
  refreshing: boolean;
};

function entitlementSet(
  payload: DuprEntitlementsPayload | null,
  resource: string,
): Set<string> {
  if (!payload) return new Set();
  const list = payload.entitlements?.[resource] ?? [];
  return new Set(list);
}

async function fetchCached(
  userId: string,
): Promise<DuprEntitlementsPayload | null> {
  const { data, error } = await supabase
    .from("dupr_user_entitlements")
    .select("display_name, status, entitlements, fetched_at, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw error;
  }
  if (!data) return null;
  const fresh = new Date(data.expires_at).getTime() > Date.now();
  return fresh ? (data as DuprEntitlementsPayload) : null;
}

async function fetchFromEdge(
  force = false,
): Promise<DuprEntitlementsPayload | null> {
  const { data, error } = await supabase.functions.invoke<
    DuprEntitlementsPayload & { cached?: boolean; error?: string }
  >("dupr-entitlements", {
    body: force ? { force: true } : {},
  });
  if (error) {
    // 412 = dupr_not_connected; supabase-js exposes the upstream Response
    // on error.context — read the actual status instead of relying on
    // string matching (which silently breaks if error.message changes).
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 412) return null;
    throw error;
  }
  if (!data || (data as { error?: string }).error) return null;
  return data;
}

export function useDuprEntitlements(): DuprEntitlementsResult {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? null;

  const query = useQuery({
    queryKey: ["dupr", "entitlements", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!userId) return null;
      const cached = await fetchCached(userId);
      if (cached) return cached;
      return fetchFromEdge(false);
    },
  });

  const refreshMut = useMutation({
    mutationFn: () => fetchFromEdge(true),
    onSuccess: (payload) => {
      qc.setQueryData(["dupr", "entitlements", userId], payload);
    },
  });

  const payload = query.data ?? null;
  const tSet = entitlementSet(payload, "tournaments");

  return {
    loading: query.isLoading,
    connected: !!payload,
    payload,
    hasBasic: tSet.has("BASIC_L1"),
    hasPremium: tSet.has("PREMIUM_L1"),
    hasVerified: tSet.has("VERIFIED_L1"),
    has: (entitlement: string, resource = "tournaments") =>
      entitlementSet(payload, resource).has(entitlement),
    refresh: async () => {
      await refreshMut.mutateAsync();
    },
    refreshing: refreshMut.isPending,
  };
}

/** Used by `useInvalidateDuprConnection` to also clear entitlements. */
export function useInvalidateDuprEntitlements() {
  const qc = useQueryClient();
  return () =>
    qc.invalidateQueries({ queryKey: ["dupr", "entitlements"], exact: false });
}
