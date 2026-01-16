import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RevokeRequest {
  id?: string;
  key_prefix?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Authenticate: Only allow service_role key
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Service key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== expectedKey) {
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid service key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: RevokeRequest = await req.json();

    // Validate: need either id or key_prefix
    if (!body.id && !body.key_prefix) {
      return new Response(
        JSON.stringify({ error: "Either 'id' or 'key_prefix' is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Build query
    let query = supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("is_active", true); // Only revoke active keys

    if (body.id) {
      query = query.eq("id", body.id);
    } else if (body.key_prefix) {
      query = query.eq("key_prefix", body.key_prefix);
    }

    const { data, error, count } = await query.select("id, name, key_prefix");

    if (error) {
      console.error("[api-keys-revoke] Update error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to revoke API key", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ error: "API key not found or already revoked" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[api-keys-revoke] Revoked API key:", data[0].key_prefix);

    return new Response(
      JSON.stringify({
        success: true,
        message: "API key revoked successfully",
        revoked: data[0],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[api-keys-revoke] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
