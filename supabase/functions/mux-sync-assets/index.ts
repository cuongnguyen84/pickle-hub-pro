import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const muxTokenId = Deno.env.get("MUX_TOKEN_ID")!;
    const muxTokenSecret = Deno.env.get("MUX_TOKEN_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const muxAuth = btoa(`${muxTokenId}:${muxTokenSecret}`);

    // Find ended livestreams without asset playback ID
    const { data: livestreams, error: fetchError } = await supabase
      .from("livestreams")
      .select("id, mux_live_stream_id, title")
      .eq("status", "ended")
      .is("mux_asset_playback_id", null)
      .not("mux_live_stream_id", "is", null);

    if (fetchError) {
      console.error("Error fetching livestreams:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${livestreams?.length ?? 0} livestreams to sync`);

    const results: { id: string; title: string; status: string; assetPlaybackId?: string }[] = [];

    for (const livestream of livestreams || []) {
      try {
        // Fetch live stream from Mux to get associated assets
        const liveStreamResponse = await fetch(
          `https://api.mux.com/video/v1/live-streams/${livestream.mux_live_stream_id}`,
          {
            headers: {
              Authorization: `Basic ${muxAuth}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!liveStreamResponse.ok) {
          console.error(`Failed to fetch live stream ${livestream.mux_live_stream_id}:`, await liveStreamResponse.text());
          results.push({ id: livestream.id, title: livestream.title, status: "mux_fetch_failed" });
          continue;
        }

        const liveStreamData = await liveStreamResponse.json();
        const recentAssetIds = liveStreamData.data?.recent_asset_ids;

        if (!recentAssetIds || recentAssetIds.length === 0) {
          console.log(`No assets found for livestream ${livestream.id}`);
          results.push({ id: livestream.id, title: livestream.title, status: "no_assets" });
          continue;
        }

        // Get the most recent asset
        const assetId = recentAssetIds[0];

        // Fetch asset details to get playback ID
        const assetResponse = await fetch(
          `https://api.mux.com/video/v1/assets/${assetId}`,
          {
            headers: {
              Authorization: `Basic ${muxAuth}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!assetResponse.ok) {
          console.error(`Failed to fetch asset ${assetId}:`, await assetResponse.text());
          results.push({ id: livestream.id, title: livestream.title, status: "asset_fetch_failed" });
          continue;
        }

        const assetData = await assetResponse.json();
        const playbackIds = assetData.data?.playback_ids;
        const assetPlaybackId = playbackIds?.[0]?.id;

        if (!assetPlaybackId) {
          console.log(`No playback ID for asset ${assetId}`);
          results.push({ id: livestream.id, title: livestream.title, status: "no_playback_id" });
          continue;
        }

        // Update the livestream with asset info
        const { error: updateError } = await supabase
          .from("livestreams")
          .update({
            mux_asset_id: assetId,
            mux_asset_playback_id: assetPlaybackId,
          })
          .eq("id", livestream.id);

        if (updateError) {
          console.error(`Failed to update livestream ${livestream.id}:`, updateError);
          results.push({ id: livestream.id, title: livestream.title, status: "update_failed" });
          continue;
        }

        console.log(`Successfully synced livestream ${livestream.id} with asset playback ID ${assetPlaybackId}`);
        results.push({ 
          id: livestream.id, 
          title: livestream.title, 
          status: "synced", 
          assetPlaybackId 
        });

      } catch (err) {
        console.error(`Error processing livestream ${livestream.id}:`, err);
        results.push({ id: livestream.id, title: livestream.title, status: "error" });
      }
    }

    return new Response(JSON.stringify({ 
      total: livestreams?.length ?? 0,
      synced: results.filter(r => r.status === "synced").length,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Sync error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
