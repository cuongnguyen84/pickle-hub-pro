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

// SECURITY: Verify Mux webhook signature using MUX_WEBHOOK_SECRET
// Mux sends header: mux-signature: t=<timestamp>,v1=<signature>
const verifyMuxSignature = async (rawBody: string, signatureHeader: string | null): Promise<boolean> => {
  const secret = Deno.env.get("MUX_WEBHOOK_SECRET");
  
  if (!secret) {
    console.warn("MUX_WEBHOOK_SECRET not configured, skipping signature verification");
    return true; // Backward compat — allow if not yet configured
  }
  
  if (!signatureHeader) {
    console.error("No mux-signature header provided");
    return false;
  }
  
  try {
    // Parse header: "t=<timestamp>,v1=<hex_signature>"
    const parts: Record<string, string> = {};
    for (const part of signatureHeader.split(",")) {
      const [key, ...valueParts] = part.split("=");
      parts[key.trim()] = valueParts.join("=");
    }
    
    const timestamp = parts["t"];
    const expectedSignature = parts["v1"];
    
    if (!timestamp || !expectedSignature) {
      console.error("Missing timestamp or signature in mux-signature header");
      return false;
    }
    
    // Check timestamp tolerance (5 minutes)
    const timestampAge = Math.abs(Date.now() / 1000 - parseInt(timestamp));
    if (timestampAge > 300) {
      console.error(`Mux signature timestamp too old: ${timestampAge}s`);
      return false;
    }
    
    // Compute HMAC-SHA256 of "timestamp.body"
    const payload = `${timestamp}.${rawBody}`;
    const encoder = new TextEncoder();
    
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
    const computedHex = Array.from(new Uint8Array(signatureBytes))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
    
    // Constant-time comparison
    if (computedHex.length !== expectedSignature.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < computedHex.length; i++) {
      result |= computedHex.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
    }
    
    return result === 0;
  } catch (error) {
    console.error("Mux signature verification error:", error);
    return false;
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    
    // SECURITY: Verify Mux webhook signature
    const signatureHeader = req.headers.get("mux-signature");
    const isValid = await verifyMuxSignature(rawBody, signatureHeader);
    
    if (!isValid) {
      console.error("Invalid Mux webhook signature — request rejected");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    const event: MuxWebhookEvent = JSON.parse(rawBody);

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

      const { data, error } = await supabase
        .from("livestreams")
        .update({
          mux_asset_id: assetId,
          mux_asset_playback_id: assetPlaybackId,
        })
        .eq("mux_live_stream_id", liveStreamId)
        .select();

      if (error) {
        console.error("Error updating livestream:", error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!data || data.length === 0) {
        console.log("No livestream found with mux_live_stream_id:", liveStreamId);
      } else {
        console.log("Successfully updated livestream:", data[0].id);
      }
    }

    // Handle livestream idle event - stream has stopped
    if (event.type === "video.live_stream.idle") {
      const liveStreamId = event.data.id;
      
      console.log(`Livestream ${liveStreamId} is now idle`);

      const { error } = await supabase
        .from("livestreams")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("mux_live_stream_id", liveStreamId)
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
