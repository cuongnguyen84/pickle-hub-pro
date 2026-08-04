import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { cronCorsHeaders as corsHeaders } from "../_shared/cors.ts";

// 2026-08-03 (incident 02/08): a live stream that reconnects mid-broadcast
// leaves several assets behind — short "errored" stubs plus the real ready
// recordings — and the webhook may miss the ready events entirely (per-region
// blob loss). The old sync only filled NULL playback ids and blindly took
// recent_asset_ids[0], so a row stuck on an errored stub never healed.
// Now: for recently-ended streams, verify the stored asset is actually
// "ready" on Mux; if it is, leave the row alone (protects manually stitched
// replacements, which are not in recent_asset_ids). Otherwise repoint the
// row at the longest ready asset of the live stream.

const REPAIR_WINDOW_DAYS = 7;

interface MuxAsset {
  id: string;
  status?: string;
  duration?: number;
  playback_ids?: { id: string; policy: string }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const muxTokenId = Deno.env.get("MUX_TOKEN_ID")!;
    const muxTokenSecret = Deno.env.get("MUX_TOKEN_SECRET")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const muxAuth = btoa(`${muxTokenId}:${muxTokenSecret}`);
    const muxHeaders = {
      Authorization: `Basic ${muxAuth}`,
      "Content-Type": "application/json",
    };

    const fetchAsset = async (assetId: string): Promise<MuxAsset | null> => {
      const res = await fetch(`https://api.mux.com/video/v1/assets/${assetId}`, { headers: muxHeaders });
      if (!res.ok) return null;
      const body = await res.json();
      return (body.data ?? null) as MuxAsset | null;
    };

    // Ended livestreams that are either unfilled or ended recently enough
    // to be worth re-verifying against Mux.
    const repairCutoff = new Date(Date.now() - REPAIR_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
    const { data: livestreams, error: fetchError } = await supabase
      .from("livestreams")
      .select("id, mux_live_stream_id, mux_asset_id, mux_asset_playback_id, ended_at, title")
      .eq("status", "ended")
      .not("mux_live_stream_id", "is", null)
      .or(`mux_asset_playback_id.is.null,ended_at.gte.${repairCutoff}`);

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
        // Stored asset already ready on Mux → nothing to do. This also
        // protects manually stitched/uploaded replacement assets, which do
        // not appear in the live stream's recent_asset_ids.
        if (livestream.mux_asset_id) {
          const current = await fetchAsset(livestream.mux_asset_id);
          if (current?.status === "ready") {
            results.push({ id: livestream.id, title: livestream.title, status: "ok" });
            continue;
          }
        }

        const liveStreamResponse = await fetch(
          `https://api.mux.com/video/v1/live-streams/${livestream.mux_live_stream_id}`,
          { headers: muxHeaders },
        );

        if (!liveStreamResponse.ok) {
          console.error(`Failed to fetch live stream ${livestream.mux_live_stream_id}:`, await liveStreamResponse.text());
          results.push({ id: livestream.id, title: livestream.title, status: "mux_fetch_failed" });
          continue;
        }

        const liveStreamData = await liveStreamResponse.json();
        const recentAssetIds: string[] = liveStreamData.data?.recent_asset_ids ?? [];

        if (recentAssetIds.length === 0) {
          console.log(`No assets found for livestream ${livestream.id}`);
          results.push({ id: livestream.id, title: livestream.title, status: "no_assets" });
          continue;
        }

        // A reconnecting encoder produces several assets; errored stubs
        // ("disconnected before sufficient video data") sit alongside real
        // recordings. Pick the longest READY asset, never just [0].
        let best: MuxAsset | null = null;
        for (const assetId of recentAssetIds) {
          const asset = await fetchAsset(assetId);
          if (asset?.status === "ready" && asset.playback_ids?.[0]?.id) {
            if (!best || (asset.duration ?? 0) > (best.duration ?? 0)) best = asset;
          }
        }

        if (!best) {
          console.log(`No ready asset yet for livestream ${livestream.id}`);
          results.push({ id: livestream.id, title: livestream.title, status: "no_ready_asset" });
          continue;
        }

        const assetPlaybackId = best.playback_ids![0].id;
        const { error: updateError } = await supabase
          .from("livestreams")
          .update({
            mux_asset_id: best.id,
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
          assetPlaybackId,
        });

      } catch (err) {
        console.error(`Error processing livestream ${livestream.id}:`, err);
        results.push({ id: livestream.id, title: livestream.title, status: "error" });
      }
    }

    return new Response(JSON.stringify({
      total: livestreams?.length ?? 0,
      synced: results.filter(r => r.status === "synced").length,
      results,
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
