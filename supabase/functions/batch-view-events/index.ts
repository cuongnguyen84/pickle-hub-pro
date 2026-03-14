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
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  };
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

    console.log(`[batch-view-events] Inserting ${validated.length} events`);

    const { error } = await supabase.from("view_events").insert(validated);

    if (error) {
      console.error("[batch-view-events] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to insert events" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, inserted: validated.length }),
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
