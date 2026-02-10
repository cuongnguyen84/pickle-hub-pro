import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ViewEvent {
  target_type: "video" | "livestream";
  target_id: string;
  viewer_user_id?: string | null;
  organization_id?: string | null;
}

// In-memory batch storage (per instance)
const pendingEvents: ViewEvent[] = [];
let lastFlush = Date.now();
const FLUSH_INTERVAL_MS = 10000; // 10 seconds
const MAX_BATCH_SIZE = 100;

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "POST") {
      const body = await req.json();
      
      // Validate input
      if (!body.target_type || !body.target_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: target_type, target_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate target_type enum
      if (body.target_type !== "video" && body.target_type !== "livestream") {
        return new Response(
          JSON.stringify({ error: "target_type must be 'video' or 'livestream'" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(body.target_id)) {
        return new Response(
          JSON.stringify({ error: "target_id must be a valid UUID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Add to pending batch
      pendingEvents.push({
        target_type: body.target_type,
        target_id: body.target_id,
        viewer_user_id: body.viewer_user_id || null,
        organization_id: body.organization_id || null,
      });

      // Check if we should flush
      const shouldFlush = 
        pendingEvents.length >= MAX_BATCH_SIZE || 
        Date.now() - lastFlush >= FLUSH_INTERVAL_MS;

      if (shouldFlush && pendingEvents.length > 0) {
        // Flush batch to database
        const eventsToInsert = [...pendingEvents];
        pendingEvents.length = 0; // Clear pending
        lastFlush = Date.now();

        console.log(`[batch-view-events] Flushing ${eventsToInsert.length} events`);

        const { error } = await supabase
          .from("view_events")
          .insert(eventsToInsert);

        if (error) {
          console.error("[batch-view-events] Error inserting batch:", error);
          // Put events back if insert failed
          pendingEvents.push(...eventsToInsert);
          return new Response(
            JSON.stringify({ error: "Failed to record view events" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            queued: false, 
            flushed: eventsToInsert.length 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          queued: true, 
          pending: pendingEvents.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Manual flush endpoint (for testing/admin)
    if (req.method === "GET" && new URL(req.url).searchParams.get("flush") === "true") {
      if (pendingEvents.length === 0) {
        return new Response(
          JSON.stringify({ message: "No pending events to flush" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const eventsToInsert = [...pendingEvents];
      pendingEvents.length = 0;
      lastFlush = Date.now();

      const { error } = await supabase
        .from("view_events")
        .insert(eventsToInsert);

      if (error) {
        console.error("[batch-view-events] Manual flush error:", error);
        pendingEvents.push(...eventsToInsert);
        return new Response(
          JSON.stringify({ error: "Flush failed" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          flushed: eventsToInsert.length 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[batch-view-events] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
