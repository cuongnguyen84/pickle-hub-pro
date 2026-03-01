import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AuditLogFilters {
  eventCategory?: string;
  severity?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogEntry {
  id: string;
  created_at: string;
  actor_id: string | null;
  actor_type: string;
  event_type: string;
  event_category: string;
  resource_type: string | null;
  resource_id: string | null;
  severity: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  actor_profile?: { display_name: string | null; email: string } | null;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const { eventCategory, severity, dateFrom, dateTo, page = 1, pageSize = 50 } = filters;

  return useQuery({
    queryKey: ["admin", "audit-logs", filters],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (eventCategory) {
        query = query.eq("event_category", eventCategory);
      }
      if (severity) {
        query = query.eq("severity", severity);
      }
      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }
      if (dateTo) {
        query = query.lte("created_at", dateTo + "T23:59:59.999Z");
      }

      const { data, error, count } = await query;
      if (error) throw error;

      // Fetch actor profiles for entries with actor_id
      const actorIds = [...new Set((data as any[])?.filter((d: any) => d.actor_id).map((d: any) => d.actor_id))];
      
      let profilesMap: Record<string, { display_name: string | null; email: string }> = {};
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .rpc("get_public_profiles", { profile_ids: actorIds });
        
        if (profiles) {
          // Also get emails from profiles table for admin context
          const { data: fullProfiles } = await supabase
            .from("profiles")
            .select("id, display_name, email")
            .in("id", actorIds);
          
          if (fullProfiles) {
            fullProfiles.forEach((p: any) => {
              profilesMap[p.id] = { display_name: p.display_name, email: p.email };
            });
          }
        }
      }

      const entries: AuditLogEntry[] = (data as any[])?.map((d: any) => ({
        ...d,
        actor_profile: d.actor_id ? profilesMap[d.actor_id] || null : null,
      })) || [];

      return { entries, totalCount: count || 0 };
    },
  });
}

// Helper to call log_audit_event RPC from client-side admin hooks
export async function logAuditEvent(params: {
  eventType: string;
  eventCategory: string;
  resourceType?: string;
  resourceId?: string;
  severity?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.rpc("log_audit_event" as any, {
      _event_type: params.eventType,
      _event_category: params.eventCategory,
      _resource_type: params.resourceType || null,
      _resource_id: params.resourceId || null,
      _severity: params.severity || "info",
      _metadata: params.metadata || {},
    });
  } catch (e) {
    // Audit log failure should never break the main action
    console.warn("Audit log failed:", e);
  }
}
