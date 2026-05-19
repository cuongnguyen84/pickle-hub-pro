import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateLivestreamRequest {
  title: string;
  playback_policy?: "public" | "signed";
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID");
    const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET");

    // Check for Mux credentials
    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      console.error("Mux credentials not configured");
      return new Response(
        JSON.stringify({
          error: "Mux credentials not configured",
          message: "Please configure MUX_TOKEN_ID and MUX_TOKEN_SECRET secrets",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create Supabase client to verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is creator or admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["creator", "admin"]);

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ error: "User is not a creator or admin" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Parse request body
    const body: CreateLivestreamRequest = await req.json();
    const { title, playback_policy = "public" } = body;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Title is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Creating Mux livestream for user ${user.id}: "${title}"`);

    // Create live stream via Mux API
    const muxAuth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    const muxResponse = await fetch("https://api.mux.com/video/v1/live-streams", {
      method: "POST",
      headers: {
        Authorization: `Basic ${muxAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        playback_policy: [playback_policy],
        new_asset_settings: {
          playback_policy: [playback_policy],
        },
        reduced_latency: true,
        latency_mode: "low",
      }),
    });

    if (!muxResponse.ok) {
      const errorText = await muxResponse.text();
      console.error("Mux API error:", muxResponse.status, errorText);
      return new Response(
        JSON.stringify({
          error: "Failed to create Mux livestream",
          details: errorText,
        }),
        {
          status: muxResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const muxData = await muxResponse.json();
    const liveStream = muxData.data;

    console.log("Mux livestream created:", liveStream.id);

    // Extract the relevant fields
    const result = {
      mux_live_stream_id: liveStream.id,
      mux_playback_id: liveStream.playback_ids?.[0]?.id || null,
      mux_stream_key: liveStream.stream_key,
      rtmp_url: "rtmps://global-live.mux.com:443/app",
      status: liveStream.status,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in mux-create-livestream:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
