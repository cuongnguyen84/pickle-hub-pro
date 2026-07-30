import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { simpleCorsHeaders as corsHeaders } from "../_shared/cors.ts";

interface RevokeRequest {
  id?: string;
  key_prefix?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get JWT token from header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create client with user token to check permissions
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // Check if user is admin
    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabaseUser
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .single();

    if (roleError || roleData?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden - Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ADMIN-MFA: đã enroll 2FA thì phiên phải là aal2 mới được dùng quyền admin
    // (đồng bộ với is_admin() ở DB — migration 20260730090000)
    if ((userData.user.factors ?? []).some((f) => f.status === "verified")) {
      let aal: string | null = null;
      try {
        const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        aal = JSON.parse(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4))).aal ?? null;
      } catch {
        // token hỏng -> coi như aal1, chặn
      }
      if (aal !== "aal2") {
        return new Response(
          JSON.stringify({ error: "Forbidden - MFA (aal2) required" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const body: RevokeRequest = await req.json();

    if (!body.id && !body.key_prefix) {
      return new Response(
        JSON.stringify({ error: "Either 'id' or 'key_prefix' is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Revoke with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let query = supabase
      .from("api_keys")
      .update({ is_active: false })
      .eq("is_active", true);

    if (body.id) {
      query = query.eq("id", body.id);
    } else if (body.key_prefix) {
      query = query.eq("key_prefix", body.key_prefix);
    }

    const { data, error } = await query.select("id, name, key_prefix");

    if (error) {
      console.error("[api-keys-admin-revoke] Update error:", error);
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

    console.log("[api-keys-admin-revoke] Revoked API key:", data[0].key_prefix);

    return new Response(
      JSON.stringify({
        success: true,
        message: "API key revoked successfully",
        revoked: data[0],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[api-keys-admin-revoke] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
