import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ViewEvent {
  target_type: "video" | "livestream";
  target_id: string;
  viewer_user_id?: string | null;
  organization_id?: string | null;
  source?: string;
  is_replay?: boolean;
}

interface InsertEvent extends ViewEvent {
  viewer_ip?: string | null;
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEDUP_WINDOW_SECONDS = 30;

function validateEvent(e: unknown): ViewEvent | null {
  if (!e || typeof e !== "object") return null;
  const ev = e as Record<string, unknown>;
  if (ev.target_type !== "video" && ev.target_type !== "livestream") return null;
  if (typeof ev.target_id !== "string" || !uuidRegex.test(ev.target_id)) return null;
  return {
    target_type: ev.target_type as "video" | "livestream",
    target_id: ev.target_id,
    viewer_user_id: (typeof ev.viewer_user_id === "string" ? ev.viewer_user_id : null),
    organization_id: (typeof ev.organization_id === "string" ? ev.organization_id : null),
    ...(typeof ev.source === "string" ? { source: ev.source } : {}),
    is_replay: ev.is_replay === true,
  };
}

function getClientIp(req: Request): string | null {
  // Supabase Edge Functions forward client IP via these headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const clientIp = getClientIp(req);
    const body = await req.json();

    // Support both batch array and single event
    let rawEvents: unknown[];
    if (Array.isArray(body.events)) {
      rawEvents = body.events;
    } else if (body.target_type && body.target_id) {
      rawEvents = [body];
    } else {
      return new Response(
        JSON.stringify({ error: "Missing 'events' array or single event fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate and cap at 500
    const validated: ViewEvent[] = [];
    for (const raw of rawEvents.slice(0, 500)) {
      const v = validateEvent(raw);
      if (v) validated.push(v);
    }

    if (validated.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid events" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Server-side deduplication ---
    // Group events by unique (viewer_user_id || ip, target_id) to dedup
    const dedupKeys = new Map<string, ViewEvent>();
    for (const ev of validated) {
      const viewerKey = ev.viewer_user_id || `ip:${clientIp || "unknown"}`;
      const key = `${viewerKey}:${ev.target_id}`;
      // Keep last event per key (they're all the same anyway)
      dedupKeys.set(key, ev);
    }

    const uniqueEvents = Array.from(dedupKeys.values());

    // Check recent events in DB for each unique viewer+target pair
    const cutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString();
    const eventsToInsert: InsertEvent[] = [];

    // Batch check: for authenticated users
    const authedEvents = uniqueEvents.filter(e => e.viewer_user_id);
    const anonEvents = uniqueEvents.filter(e => !e.viewer_user_id);

    if (authedEvents.length > 0) {
      const userTargetPairs = authedEvents.map(e => ({
        user_id: e.viewer_user_id!,
        target_id: e.target_id,
      }));

      // Check all at once: find any recent events for these user+target combos
      const { data: recentUserEvents } = await supabase
        .from("view_events")
        .select("viewer_user_id, target_id")
        .gte("created_at", cutoff)
        .not("viewer_user_id", "is", null)
        .in("viewer_user_id", [...new Set(userTargetPairs.map(p => p.user_id))])
        .in("target_id", [...new Set(userTargetPairs.map(p => p.target_id))]);

      const recentSet = new Set(
        (recentUserEvents ?? []).map(r => `${r.viewer_user_id}:${r.target_id}`)
      );

      for (const ev of authedEvents) {
        if (!recentSet.has(`${ev.viewer_user_id}:${ev.target_id}`)) {
          eventsToInsert.push({ ...ev, viewer_ip: clientIp });
        }
      }
    }

    if (anonEvents.length > 0 && clientIp) {
      // Check recent anonymous events by IP
      const { data: recentIpEvents } = await supabase
        .from("view_events")
        .select("viewer_ip, target_id")
        .gte("created_at", cutoff)
        .is("viewer_user_id", null)
        .eq("viewer_ip", clientIp)
        .in("target_id", [...new Set(anonEvents.map(e => e.target_id))]);

      const recentIpSet = new Set(
        (recentIpEvents ?? []).map(r => `${r.viewer_ip}:${r.target_id}`)
      );

      for (const ev of anonEvents) {
        if (!recentIpSet.has(`${clientIp}:${ev.target_id}`)) {
          eventsToInsert.push({ ...ev, viewer_ip: clientIp });
        }
      }
    } else if (anonEvents.length > 0 && !clientIp) {
      // No IP available, allow but mark
      for (const ev of anonEvents) {
        eventsToInsert.push({ ...ev, viewer_ip: null });
      }
    }

    if (eventsToInsert.length === 0) {
      console.log(`[batch-view-events] All ${validated.length} events deduplicated`);
      return new Response(
        JSON.stringify({ success: true, inserted: 0, deduplicated: validated.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[batch-view-events] Inserting ${eventsToInsert.length}/${validated.length} events (${validated.length - eventsToInsert.length} deduped)`);

    const { error } = await supabase.from("view_events").insert(eventsToInsert);

    if (error) {
      console.error("[batch-view-events] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to insert events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, inserted: eventsToInsert.length, deduplicated: validated.length - eventsToInsert.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[batch-view-events] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
