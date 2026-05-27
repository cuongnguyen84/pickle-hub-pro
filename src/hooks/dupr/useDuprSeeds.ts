// ============================================================================
// useDuprSeeds — React Query wrapper around fetchDuprSeeds
// ----------------------------------------------------------------------------
// Sprint C1 (2026-05-27). Reusable hook for any surface that needs to map
// a batch of profile_ids → DUPR rating (Bracket setup, Mexicano matching,
// social event rosters).
//
// staleTime 2 minutes — short enough to pick up webhook-driven rating
// updates within a session, long enough to survive a few re-renders.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { fetchDuprSeeds, type SeedFormat } from "@/lib/dupr/seedFromDupr";

export interface UseDuprSeedsOptions {
  userIds: ReadonlyArray<string | null | undefined>;
  format: SeedFormat;
  enabled?: boolean;
}

export function useDuprSeeds({ userIds, format, enabled = true }: UseDuprSeedsOptions) {
  // Filter + sort once so the queryKey is stable even when caller passes
  // a fresh array each render (common for derived player lists).
  const cleaned = Array.from(
    new Set(userIds.filter((id): id is string => !!id)),
  ).sort();

  return useQuery({
    queryKey: ["dupr-seeds", format, cleaned],
    queryFn: () => fetchDuprSeeds(cleaned, format),
    enabled: enabled && cleaned.length > 0,
    staleTime: 2 * 60_000,
    gcTime: 30 * 60_000,
  });
}
