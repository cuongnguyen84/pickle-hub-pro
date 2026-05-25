// ============================================================================
// useClubOwnership / useEventOwnership — organizer-permission gates
// ----------------------------------------------------------------------------
// Page-level guards for organizer surfaces. Decision matrix:
//   - loading             : auth still resolving / fetch in flight
//   - allowed             : current user is creator, club manager, OR admin
//   - denied              : current user doesn't have access
//   - anonymous           : no auth — redirect to /login
//
// Manager support (2026-05-21): a club can now have N managers in addition
// to its singular creator (see migration 20260521130000_club_managers.sql).
// Both hooks fan out to 3 parallel queries:
//   1. the ownership row (clubs.created_by / social_events.created_by)
//   2. the user's roles (admin override)
//   3. the club_managers rows that match the current user
//
// Race-condition note (PR49 fix): we MUST NOT return `denied` until every
// query has settled, otherwise a manager who isn't the creator gets
// flashed a "no permission" screen between the ownership query resolving
// (mismatched created_by) and the managers query resolving. Treat
// "creator? no — manager? still loading" as `loading`, not `denied`.
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PermissionState =
  | { state: "loading" }
  | { state: "anonymous" }
  | { state: "allowed" }
  | { state: "denied" };

/**
 * Fetch the roles array for the current user. Memoised across the app
 * via the shared queryKey, so an organizer page mount doesn't trigger
 * a roles re-fetch when other hooks already hydrated it.
 */
function useUserRoles(userId: string | undefined) {
  return useQuery<string[]>({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      return ((data ?? []) as { role: string }[]).map((r) => r.role);
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Return TRUE iff the current user has a club_managers row for this club.
 * Queried by club_id (UUID) rather than slug so we can share the same
 * key between the club + event variants of the gate.
 */
function useIsClubManager(clubId: string | undefined, userId: string | undefined) {
  return useQuery<boolean>({
    queryKey: ["club-manager-membership", clubId, userId],
    queryFn: async () => {
      if (!clubId || !userId) return false;
      const { data, error } = await supabase
        .from("club_managers")
        .select("club_id")
        .eq("club_id", clubId)
        .eq("profile_id", userId)
        .maybeSingle();
      if (error) return false;
      return Boolean(data);
    },
    enabled: Boolean(clubId && userId),
    staleTime: 60_000,
  });
}

export function useClubOwnership(slug: string | undefined): PermissionState {
  const { user, loading } = useAuth();
  const enabled = Boolean(user && slug);

  const { data, isLoading } = useQuery<{ ownerId: string; clubId: string } | null>({
    queryKey: ["club-ownership", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: club, error } = await supabase
        .from("clubs")
        .select("id, created_by")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !club) return null;
      const row = club as { id: string; created_by: string };
      return { ownerId: row.created_by, clubId: row.id };
    },
    enabled,
    staleTime: 60_000,
  });

  const { data: roles, isLoading: rolesLoading } = useUserRoles(user?.id);
  const { data: isManager, isLoading: managerLoading } = useIsClubManager(
    data?.clubId,
    user?.id,
  );

  if (loading) return { state: "loading" };
  if (!user) return { state: "anonymous" };
  if (isLoading) return { state: "loading" };
  if (!data) return { state: "denied" };
  if (data.ownerId === user.id) return { state: "allowed" };
  // Creator check failed — defer the verdict until BOTH roles + manager
  // queries resolve so a manager / admin doesn't see a denial flash.
  if (rolesLoading || managerLoading) return { state: "loading" };
  if (roles?.includes("admin")) return { state: "allowed" };
  if (isManager) return { state: "allowed" };
  return { state: "denied" };
}

/**
 * Event-level guard. Resolves the event by slug, then checks `created_by`
 * + club managers + admin role. Admin override applies as well.
 */
export function useEventOwnership(slug: string | undefined): PermissionState {
  const { user, loading } = useAuth();

  const { data, isLoading } = useQuery<{ ownerId: string; clubId: string | null } | null>({
    queryKey: ["event-ownership", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: ev, error } = await supabase
        .from("social_events")
        .select("created_by, club_id")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !ev) return null;
      const row = ev as { created_by: string; club_id: string | null };
      return { ownerId: row.created_by, clubId: row.club_id };
    },
    enabled: Boolean(user && slug),
    staleTime: 60_000,
  });

  const { data: roles, isLoading: rolesLoading } = useUserRoles(user?.id);
  const { data: isManager, isLoading: managerLoading } = useIsClubManager(
    data?.clubId ?? undefined,
    user?.id,
  );

  if (loading) return { state: "loading" };
  if (!user) return { state: "anonymous" };
  if (isLoading) return { state: "loading" };
  if (!data) return { state: "denied" };
  if (data.ownerId === user.id) return { state: "allowed" };
  // Same race-fix as useClubOwnership: defer denial until roles + manager
  // checks resolve.
  if (rolesLoading) return { state: "loading" };
  if (roles?.includes("admin")) return { state: "allowed" };
  // No club_id (solo organizer event) → manager check is N/A; the
  // create-by check above already covered the only possible owner.
  if (data.clubId == null) return { state: "denied" };
  if (managerLoading) return { state: "loading" };
  if (isManager) return { state: "allowed" };
  return { state: "denied" };
}
