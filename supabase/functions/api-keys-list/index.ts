import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { simpleCorsHeaders as corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Accept GET or POST (supabase.functions.invoke uses POST by default)
  if (req.method !== "GET" && req.method !== "POST") {
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

    // User is admin, fetch API keys with service role
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: keys, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, permissions, is_active, last_used_at, expires_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[api-keys-list] Error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch API keys" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ data: keys }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[api-keys-list] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
