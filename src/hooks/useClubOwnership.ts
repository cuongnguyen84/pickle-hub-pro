// ============================================================================
// useClubOwnership / useEventOwnership — organizer-permission gates
// ----------------------------------------------------------------------------
// Page-level guards for PR3 organizer surfaces. Decision matrix:
//   - loading             : auth still resolving / fetch in flight
//   - allowed             : current user is creator OR admin
//   - denied              : current user doesn't have access
//   - anonymous           : no auth — redirect to /login
// ============================================================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PermissionState =
  | { state: "loading" }
  | { state: "anonymous" }
  | { state: "allowed" }
  | { state: "denied" };

export function useClubOwnership(slug: string | undefined): PermissionState {
  const { user, loading } = useAuth();
  const enabled = Boolean(user && slug);
  const { data, isLoading } = useQuery<{ ownerId: string } | null>({
    queryKey: ["club-ownership", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: club, error } = await supabase
        .from("clubs")
        .select("created_by")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !club) return null;
      return { ownerId: (club as { created_by: string }).created_by };
    },
    enabled,
    staleTime: 60_000,
  });
  const { data: roles } = useQuery<string[]>({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return ((data ?? []) as { role: string }[]).map((r) => r.role);
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  });

  if (loading) return { state: "loading" };
  if (!user) return { state: "anonymous" };
  if (isLoading) return { state: "loading" };
  if (!data) return { state: "denied" };
  if (data.ownerId === user.id) return { state: "allowed" };
  if (roles?.includes("admin")) return { state: "allowed" };
  return { state: "denied" };
}

/**
 * Event-level guard. Resolves the event by slug, then checks `created_by`.
 * Admin override applies as well.
 */
export function useEventOwnership(slug: string | undefined): PermissionState {
  const { user, loading } = useAuth();
  const { data, isLoading } = useQuery<{ ownerId: string } | null>({
    queryKey: ["event-ownership", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data: ev, error } = await supabase
        .from("social_events")
        .select("created_by")
        .eq("slug", slug)
        .maybeSingle();
      if (error || !ev) return null;
      return { ownerId: (ev as { created_by: string }).created_by };
    },
    enabled: Boolean(user && slug),
    staleTime: 60_000,
  });
  const { data: roles } = useQuery<string[]>({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return ((data ?? []) as { role: string }[]).map((r) => r.role);
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60_000,
  });

  if (loading) return { state: "loading" };
  if (!user) return { state: "anonymous" };
  if (isLoading) return { state: "loading" };
  if (!data) return { state: "denied" };
  if (data.ownerId === user.id) return { state: "allowed" };
  if (roles?.includes("admin")) return { state: "allowed" };
  return { state: "denied" };
}
