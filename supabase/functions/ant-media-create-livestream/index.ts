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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
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

    const isCreatorOrAdmin = roles?.some(
      (r: { role: string }) => r.role === "creator" || r.role === "admin"
    );
    if (!isCreatorOrAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden: creator or admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title } = await req.json();
    if (!title) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const antMediaServerUrl = Deno.env.get("ANT_MEDIA_SERVER_URL");
    const antMediaAppName = Deno.env.get("ANT_MEDIA_APP_NAME") || "LiveApp";

    if (!antMediaServerUrl) {
      return new Response(
        JSON.stringify({ error: "ANT_MEDIA_SERVER_URL not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create broadcast on Ant Media Server
    const apiUrl = `${antMediaServerUrl}/${antMediaAppName}/rest/v2/broadcasts/create`;
    const requestBody = JSON.stringify({
      name: title,
      type: "liveStream",
    });
    console.log(`[ant-media] Creating broadcast at: ${apiUrl}`);
    console.log(`[ant-media] Request body: ${requestBody}`);

    const antResponse = await fetch(apiUrl, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: requestBody,
    });

    if (!antResponse.ok) {
      const errorText = await antResponse.text();
      console.error(`[ant-media] API error: ${antResponse.status} ${errorText}`);
      return new Response(
        JSON.stringify({
          error: "Failed to create Ant Media broadcast",
          details: errorText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const broadcast = await antResponse.json();
    const streamId = broadcast.streamId;

    // Parse server URL to build RTMP and HLS URLs
    // ANT_MEDIA_SERVER_URL format: https://domain.com:5443
    const serverUrlObj = new URL(antMediaServerUrl);
    const rtmpHost = serverUrlObj.hostname;
    // RTMP uses port 1935 by default
    const rtmpUrl = `rtmp://${rtmpHost}/${antMediaAppName}/${streamId}`;
    // HLS URL uses the HTTPS server URL
    const hlsUrl = `${antMediaServerUrl}/${antMediaAppName}/streams/${streamId}.m3u8`;

    console.log(`[ant-media] Broadcast created: ${streamId}`);

    return new Response(
      JSON.stringify({
        streamId,
        rtmpUrl,
        hlsUrl,
        streamKey: streamId, // Ant Media uses streamId as the stream key
        serverUrl: antMediaServerUrl,
        appName: antMediaAppName,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[ant-media] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
