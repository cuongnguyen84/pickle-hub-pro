import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, mux-signature",
};

interface MuxWebhookEvent {
  type: string;
  data: {
    id: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    live_stream_id?: string;
    passthrough?: string;
    status?: string;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const event: MuxWebhookEvent = JSON.parse(body);

    console.log("Received Mux webhook:", event.type);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle asset ready event - this fires when livestream recording is ready
    if (event.type === "video.asset.ready") {
      const assetId = event.data.id;
      const liveStreamId = event.data.live_stream_id;
      const playbackIds = event.data.playback_ids;

      if (!liveStreamId) {
        console.log("Asset is not from a livestream, skipping");
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const assetPlaybackId = playbackIds?.[0]?.id;

      if (!assetPlaybackId) {
        console.error("No playback ID found for asset");
        return new Response(JSON.stringify({ error: "No playback ID" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      console.log(`Updating livestream with mux_stream_id=${liveStreamId}, asset_id=${assetId}, playback_id=${assetPlaybackId}`);

      // Find and update the livestream by mux_stream_id
      const { data, error } = await supabase
        .from("livestreams")
        .update({
          mux_asset_id: assetId,
          mux_asset_playback_id: assetPlaybackId,
        })
        .eq("mux_stream_id", liveStreamId)
        .select();

      if (error) {
        console.error("Error updating livestream:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!data || data.length === 0) {
        console.log("No livestream found with mux_stream_id:", liveStreamId);
      } else {
        console.log("Successfully updated livestream:", data[0].id);
      }
    }

    // Handle livestream idle event - stream has stopped
    if (event.type === "video.live_stream.idle") {
      const liveStreamId = event.data.id;
      
      console.log(`Livestream ${liveStreamId} is now idle`);

      // Update status to ended if still live
      const { error } = await supabase
        .from("livestreams")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("mux_stream_id", liveStreamId)
        .eq("status", "live");

      if (error) {
        console.error("Error updating livestream status:", error);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
