import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Hash API key using SHA-256
const hashApiKey = async (key: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
};

interface ApiKeyRecord {
  id: string;
  is_active: boolean;
  expires_at: string | null;
  permissions: string[];
}

// Validate custom API key against database
const validateApiKey = async (
  token: string,
  supabaseServiceKey: string,
  requiredPermission: string
): Promise<{ valid: boolean; keyId?: string }> => {
  try {
    const keyHash = await hashApiKey(token);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: apiKey, error } = await supabase
      .from("api_keys")
      .select("id, is_active, expires_at, permissions")
      .eq("key_hash", keyHash)
      .single();

    if (error || !apiKey) {
      return { valid: false };
    }

    const key = apiKey as ApiKeyRecord;

    // Check if key is active
    if (!key.is_active) {
      console.log("[news-check] API key is revoked");
      return { valid: false };
    }

    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      console.log("[news-check] API key has expired");
      return { valid: false };
    }

    // Check permissions
    if (!key.permissions?.includes(requiredPermission)) {
      console.log("[news-check] API key lacks required permission:", requiredPermission);
      return { valid: false };
    }

    return { valid: true, keyId: key.id };
  } catch (err) {
    console.error("[news-check] Error validating API key:", err);
    return { valid: false };
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept GET
  if (req.method !== "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error("[news-check] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - API key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key with "news:read" permission
    const apiKeyResult = await validateApiKey(token, supabaseServiceKey, "news:read");
    const isServiceRole = token === supabaseServiceKey;

    if (!apiKeyResult.valid && !isServiceRole) {
      console.error("[news-check] Invalid API key or service key");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at for custom API keys
    if (apiKeyResult.valid && apiKeyResult.keyId) {
      await supabase
        .from("api_keys")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", apiKeyResult.keyId);
    }

    // Get source_url from query params
    const url = new URL(req.url);
    const sourceUrl = url.searchParams.get("source_url");

    if (!sourceUrl) {
      return new Response(
        JSON.stringify({ error: "source_url query parameter is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[news-check] Checking for existing news with source_url:", sourceUrl);

    // Check if news item exists
    const { data, error } = await supabase
      .from("news_items")
      .select("id, title, status, created_at")
      .eq("source_url", sourceUrl)
      .maybeSingle();

    if (error) {
      console.error("[news-check] Query error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to check news item", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const exists = !!data;
    console.log("[news-check] Result:", exists ? "exists" : "not found");

    return new Response(
      JSON.stringify({ exists, item: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[news-check] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
