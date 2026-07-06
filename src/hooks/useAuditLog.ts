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
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  actor_profile?: { display_name: string | null; email: string } | null;
}

export function useAuditLogs(filters: AuditLogFilters = {}) {
  const { eventCategory, severity, dateFrom, dateTo, page = 1, pageSize = 50 } = filters;

  return useQuery({
    queryKey: ["admin", "audit-logs", filters],
    queryFn: async () => {
      let query = supabase
        // audit_logs is not in the generated types (admin-only table).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      const rows = (data as unknown as AuditLogEntry[] | null) ?? [];
      const actorIds = [...new Set(rows.filter((d) => d.actor_id).map((d) => d.actor_id as string))];
      
      const profilesMap: Record<string, { display_name: string | null; email: string }> = {};
      if (actorIds.length > 0) {
        // Admin-only id→email map via SECURITY DEFINER RPC (gated by is_admin()).
        // Direct `profiles.select("email")` no longer works for the
        // authenticated role after the PII column lockdown.
        const { data: fullProfiles } = await supabase
          .rpc("admin_get_profile_emails", { p_ids: actorIds });

        if (fullProfiles) {
          (fullProfiles as Array<{ id: string; display_name: string | null; email: string }>).forEach((p) => {
            profilesMap[p.id] = { display_name: p.display_name, email: p.email };
          });
        }
      }

      const entries: AuditLogEntry[] = rows.map((d) => ({
        ...d,
        actor_profile: d.actor_id ? profilesMap[d.actor_id] || null : null,
      }));

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
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
}) {
  try {
    // log_audit_event is not in the generated types (admin-only RPC).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.rpc("log_audit_event" as any, {
      _event_type: params.eventType,
      _event_category: params.eventCategory,
      _resource_type: params.resourceType || null,
      _resource_id: params.resourceId || null,
      _severity: params.severity || "info",
      _metadata: params.metadata || {},
      _before_data: params.beforeData || null,
      _after_data: params.afterData || null,
    });
  } catch (e) {
    console.warn("Audit log failed:", e);
  }
}
