// ============================================================================
// useOrganizationDuprClub — read + mutate the DUPR-club link on an org (PR5)
// ----------------------------------------------------------------------------
// Used by the OrganizationDuprClubCard. Wraps:
//   - Reading organizations.dupr_club_* (RLS-friendly self select).
//   - Calling dupr-org-link-club / dupr-org-unlink-club edge functions.
//   - Cache invalidation on mutate.
// ============================================================================

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrganizationDuprClubRow {
  id: string;
  name: string;
  slug: string;
  dupr_club_id: string | null;
  dupr_club_name: string | null;
  dupr_club_role: "DIRECTOR" | "ORGANIZER" | null;
  dupr_linked_at: string | null;
  dupr_linked_by: string | null;
}

async function fetchOrgRow(orgId: string): Promise<OrganizationDuprClubRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, dupr_club_id, dupr_club_name, dupr_club_role, dupr_linked_at, dupr_linked_by",
    )
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as OrganizationDuprClubRow | null) ?? null;
}

export function useOrganizationDuprClub(orgId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["organization", "dupr-club", orgId],
    enabled: !!orgId,
    queryFn: () => (orgId ? fetchOrgRow(orgId) : Promise.resolve(null)),
    staleTime: 60 * 1000,
  });

  const linkMut = useMutation({
    mutationFn: async (input: {
      dupr_club_id: string;
      dupr_club_name?: string | null;
    }) => {
      if (!orgId) throw new Error("missing_organization_id");
      const { data, error } = await supabase.functions.invoke<{
        organization: OrganizationDuprClubRow;
        error?: string;
        code?: string;
      }>("dupr-org-link-club", {
        body: {
          organization_id: orgId,
          dupr_club_id: input.dupr_club_id,
          dupr_club_name: input.dupr_club_name ?? undefined,
        },
      });
      if (error) {
        const ctx = (error as { context?: { status?: number; body?: unknown } }).context;
        throw Object.assign(new Error(error.message ?? "link_failed"), {
          status: ctx?.status,
          body: ctx?.body,
        });
      }
      if (!data?.organization) throw new Error(data?.error ?? "link_failed");
      return data.organization;
    },
    onSuccess: (row) => {
      qc.setQueryData(["organization", "dupr-club", orgId], row);
    },
  });

  const unlinkMut = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error("missing_organization_id");
      const { data, error } = await supabase.functions.invoke<{
        organization: OrganizationDuprClubRow;
        error?: string;
      }>("dupr-org-unlink-club", {
        body: { organization_id: orgId },
      });
      if (error) {
        const ctx = (error as { context?: { status?: number } }).context;
        throw Object.assign(new Error(error.message ?? "unlink_failed"), {
          status: ctx?.status,
        });
      }
      if (!data?.organization) throw new Error(data?.error ?? "unlink_failed");
      return data.organization;
    },
    onSuccess: (row) => {
      qc.setQueryData(["organization", "dupr-club", orgId], row);
    },
  });

  return {
    organization: query.data ?? null,
    loading: query.isLoading,
    linked: !!query.data?.dupr_club_id,
    link: linkMut.mutateAsync,
    linking: linkMut.isPending,
    linkError: linkMut.error as
      | (Error & { status?: number; body?: unknown })
      | null,
    unlink: unlinkMut.mutateAsync,
    unlinking: unlinkMut.isPending,
  };
}
