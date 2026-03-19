/**
 * Batch-fetch organization display logos in a single RPC call.
 * Replaces N+1 individual `get_organization_display_logo` calls.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchOrgDisplayLogos(
  orgIds: string[]
): Promise<Record<string, string | null>> {
  if (orgIds.length === 0) return {};

  const uniqueIds = [...new Set(orgIds)];

  const { data, error } = await supabase.rpc("get_organization_display_logos", {
    org_ids: uniqueIds,
  });

  if (error) {
    console.warn("Failed to batch-fetch org logos:", error.message);
    return {};
  }

  const logoMap: Record<string, string | null> = {};
  (data as Array<{ org_id: string; display_logo: string | null }>)?.forEach(
    (row) => {
      logoMap[row.org_id] = row.display_logo;
    }
  );

  return logoMap;
}

/**
 * Attach display logos to items that have organization & organization_id.
 */
export function attachOrgLogos<
  T extends {
    organization_id?: string | null;
    organization?: { logo_url?: string | null; display_logo?: string | null } | null;
  }
>(items: T[], logoMap: Record<string, string | null>): void {
  items.forEach((item) => {
    if (item.organization && item.organization_id) {
      item.organization.display_logo =
        logoMap[item.organization_id] || item.organization.logo_url || null;
    }
  });
}
