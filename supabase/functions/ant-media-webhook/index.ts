import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Ant Media Server Webhook Handler
 * 
 * Ant Media sends POST requests with JSON body when broadcast events occur.
 * Key actions: "liveStreamStarted", "liveStreamEnded", "vodReady"
 * 
 * Body format: { id, action, streamName, ... }
 * 
 * Configure in Ant Media Dashboard → Application Settings → Webhook URL:
 * https://<supabase-project>.supabase.co/functions/v1/ant-media-webhook
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;
    const streamId = body.id || body.streamName;

    console.log(`[ant-media-webhook] Received action: ${action}, streamId: ${streamId}`);
    console.log(`[ant-media-webhook] Full payload:`, JSON.stringify(body));

    if (!streamId) {
      console.log("[ant-media-webhook] No streamId found, skipping");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle stream started
    if (action === "liveStreamStarted") {
      console.log(`[ant-media-webhook] Stream started: ${streamId}`);

      const { error } = await supabase
        .from("livestreams")
        .update({
          status: "live",
          started_at: new Date().toISOString(),
        })
        .eq("red5_stream_name", streamId)
        .in("status", ["scheduled", "ended"]);

      if (error) {
        console.error("[ant-media-webhook] Error updating to live:", error);
      } else {
        console.log(`[ant-media-webhook] Updated stream ${streamId} to live`);
      }
    }

    // Handle stream ended
    if (action === "liveStreamEnded") {
      console.log(`[ant-media-webhook] Stream ended: ${streamId}`);

      const { data, error } = await supabase
        .from("livestreams")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("red5_stream_name", streamId)
        .eq("status", "live")
        .select("id");

      if (error) {
        console.error("[ant-media-webhook] Error updating to ended:", error);
      } else if (data && data.length > 0) {
        console.log(`[ant-media-webhook] Updated stream ${streamId} to ended, id: ${data[0].id}`);
      } else {
        console.log(`[ant-media-webhook] No live stream found with red5_stream_name: ${streamId}`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ant-media-webhook] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
