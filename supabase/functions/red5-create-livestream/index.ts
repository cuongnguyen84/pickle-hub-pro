import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check creator/admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const hasAccess = roles?.some(
      (r: { role: string }) => r.role === "creator" || r.role === "admin"
    );
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { livestream_id } = await req.json();
    if (!livestream_id) {
      return new Response(
        JSON.stringify({ error: "Missing livestream_id" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Strip protocol prefix if user included it in the secret
    const rawHost = Deno.env.get("RED5_SM_HOST")!;
    const SM_HOST = rawHost.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    const SM_USER = Deno.env.get("RED5_SM_USER")!;
    const SM_PASS = Deno.env.get("RED5_SM_PASSWORD")!;
    const NODE_GROUP = Deno.env.get("RED5_NODE_GROUP") || "Baseline";

    // Generate unique stream name
    const shortId = livestream_id.replace(/-/g, "").substring(0, 8);
    const streamName = `pkh_${shortId}`;

    // Step 1: Auth - get JWT from Stream Manager
    const authUrl = `https://${SM_HOST}/as/v1/auth/login`;
    const basicAuth = btoa(`${SM_USER}:${SM_PASS}`);

    const authResp = await fetch(authUrl, {
      method: "PUT",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
    });

    if (!authResp.ok) {
      const errText = await authResp.text();
      console.error("[Red5] Auth failed:", authResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Red5 authentication failed", details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const authData = await authResp.json();
    const smToken = authData.token;

    // Step 2: Get Origin server for broadcast
    const originUrl = `https://${SM_HOST}/as/v1/streams/stream/${NODE_GROUP}/live/${streamName}?action=broadcast`;

    const originResp = await fetch(originUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${smToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!originResp.ok) {
      const errText = await originResp.text();
      console.error("[Red5] Get origin failed:", originResp.status, errText);
      return new Response(
        JSON.stringify({ error: "Failed to get origin server", details: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const originData = await originResp.json();
    const originAddress = originData.serverAddress || originData.host;

    const rtmpUrl = `rtmp://${originAddress}:1935/live`;
    const hlsUrl = `https://${SM_HOST}/${NODE_GROUP}/live/${streamName}.m3u8`;

    // Step 3: Save to DB using service role
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { error: updateError } = await adminClient
      .from("livestreams")
      .update({
        streaming_provider: "red5",
        red5_stream_name: streamName,
        red5_server_url: rtmpUrl,
        hls_url: hlsUrl,
      })
      .eq("id", livestream_id);

    if (updateError) {
      console.error("[Red5] DB update error:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to save stream info", details: updateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        rtmp_url: rtmpUrl,
        stream_name: streamName,
        hls_url: hlsUrl,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[Red5] Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
