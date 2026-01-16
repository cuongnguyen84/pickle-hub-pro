import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a random API key with prefix
const generateApiKey = (): string => {
  const prefix = "pk_live_";
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix + key;
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

interface GenerateRequest {
  name: string;
  permissions?: string[];
  expires_in_days?: number;
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

    const body: GenerateRequest = await req.json();

    // Validate required fields
    if (!body.name?.trim()) {
      return new Response(
        JSON.stringify({ error: "name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 16); // "pk_live_" + 8 chars

    // Calculate expiration if provided
    let expiresAt: string | null = null;
    if (body.expires_in_days && body.expires_in_days > 0) {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + body.expires_in_days);
      expiresAt = expDate.toISOString();
    }

    // Insert into database
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        name: body.name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        permissions: body.permissions || ["news:write"],
        expires_at: expiresAt,
      })
      .select("id, name, key_prefix, permissions, expires_at, created_at")
      .single();

    if (error) {
      console.error("[api-keys-generate] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to create API key", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[api-keys-generate] Created API key:", data.key_prefix);

    // Return the full key ONLY ONCE
    return new Response(
      JSON.stringify({
        success: true,
        key: apiKey, // FULL KEY - ONLY SHOWN ONCE
        ...data,
        warning: "Save this key securely. It will not be shown again.",
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[api-keys-generate] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
