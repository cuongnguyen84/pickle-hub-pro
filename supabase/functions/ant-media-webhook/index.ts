import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Ant Media Server Webhook Handler
 * 
 * Ant Media sends POST requests when broadcast events occur.
 * Content-Type: application/x-www-form-urlencoded or application/json
 * Key actions: "liveStreamStarted", "liveStreamEnded", "vodReady"
 * 
 * Configure in Ant Media Dashboard → Application Settings → Webhook URL:
 * https://<supabase-project>.supabase.co/functions/v1/ant-media-webhook
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Ant Media may send as JSON or form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string>;
    
    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      body = Object.fromEntries(new URLSearchParams(text));
    }

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
    const antMediaServerUrl = Deno.env.get("ANT_MEDIA_SERVER_URL") || "";
    const antMediaAppName = Deno.env.get("ANT_MEDIA_APP_NAME") || "LiveApp";
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

    // Handle VoD ready - recording of live stream is complete
    // Ant Media sends multiple vodReady events for each quality level.
    // We prefer the highest quality: 1080p > 720p > 480p > original.
    if (action === "vodReady") {
      const vodName = body.vodName;
      console.log(`[ant-media-webhook] VoD ready for stream: ${streamId}, vodName: ${vodName}`);

      if (vodName && antMediaServerUrl) {
        // Build VoD URL with .mp4 extension
        const vodUrl = `${antMediaServerUrl}/${antMediaAppName}/streams/${vodName}.mp4`;
        console.log(`[ant-media-webhook] VoD URL: ${vodUrl}`);

        // Determine quality priority from vodName suffix
        // e.g. streamId_1080p2500kbps → 1080, streamId_720p2000kbps → 720, streamId (original) → 0
        const qualityMatch = vodName.match(/_(\d+)p\d+kbps$/);
        const newQuality = qualityMatch ? parseInt(qualityMatch[1], 10) : 0;

        // Check existing vod_url to see if we should overwrite
        const { data: existing } = await supabase
          .from("livestreams")
          .select("id, vod_url")
          .eq("red5_stream_name", streamId)
          .limit(1);

        if (existing && existing.length > 0) {
          const currentVodUrl = existing[0].vod_url || "";
          const currentMatch = currentVodUrl.match(/_(\d+)p\d+kbps/);
          const currentQuality = currentMatch ? parseInt(currentMatch[1], 10) : 0;

          if (newQuality >= currentQuality) {
            const { error } = await supabase
              .from("livestreams")
              .update({ vod_url: vodUrl })
              .eq("id", existing[0].id);

            if (error) {
              console.error("[ant-media-webhook] Error saving VoD URL:", error);
            } else {
              console.log(`[ant-media-webhook] Saved VoD URL (${newQuality}p > ${currentQuality}p) for stream ${streamId}`);
            }
          } else {
            console.log(`[ant-media-webhook] Skipping lower quality VoD (${newQuality}p < ${currentQuality}p)`);
          }
        } else {
          console.log(`[ant-media-webhook] No stream found with red5_stream_name: ${streamId}`);
        }
      } else {
        console.log("[ant-media-webhook] Missing vodName or ANT_MEDIA_SERVER_URL, skipping VoD save");
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
