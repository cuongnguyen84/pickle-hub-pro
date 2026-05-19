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
      console.log("[news-ingest] API key is revoked");
      return { valid: false };
    }

    // Check expiration
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      console.log("[news-ingest] API key has expired");
      return { valid: false };
    }

    // Check permissions
    if (!key.permissions?.includes(requiredPermission)) {
      console.log("[news-ingest] API key lacks required permission:", requiredPermission);
      return { valid: false };
    }

    return { valid: true, keyId: key.id };
  } catch (err) {
    console.error("[news-ingest] Error validating API key:", err);
    return { valid: false };
  }
};

interface NewsPayload {
  title: string;
  summary: string;
  source: string;
  source_url: string;
  published_at: string;
  status?: "draft" | "scheduled" | "published";
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
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error("[news-ingest] Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized - API key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Try custom API key first
    const apiKeyResult = await validateApiKey(token, supabaseServiceKey, "news:write");
    const isServiceRole = token === supabaseServiceKey;

    if (!apiKeyResult.valid && !isServiceRole) {
      console.error("[news-ingest] Invalid API key or service key");
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

    const body: NewsPayload = await req.json();

    // Validate required fields
    const errors: string[] = [];
    if (!body.title?.trim()) errors.push("title is required");
    if (!body.summary?.trim()) errors.push("summary is required");
    if (!body.source?.trim()) errors.push("source is required");
    if (!body.source_url?.trim()) errors.push("source_url is required");
    if (!body.published_at) errors.push("published_at is required");

    // Validate length limits
    if (body.title && body.title.length > 120) {
      errors.push("title must be <= 120 characters");
    }
    if (body.summary && body.summary.length > 300) {
      errors.push("summary must be <= 300 characters");
    }

    // Validate URL format
    if (body.source_url) {
      try {
        new URL(body.source_url);
      } catch {
        errors.push("source_url must be a valid URL");
      }
    }

    // Validate published_at format
    if (body.published_at) {
      const date = new Date(body.published_at);
      if (isNaN(date.getTime())) {
        errors.push("published_at must be a valid ISO date");
      }
    }

    // Validate status if provided
    if (body.status && !["draft", "scheduled", "published"].includes(body.status)) {
      errors.push("status must be one of: draft, scheduled, published");
    }

    if (errors.length > 0) {
      console.error("[news-ingest] Validation errors:", errors);
      return new Response(
        JSON.stringify({ error: "Validation failed", details: errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize data
    const sanitizedData = {
      title: body.title.trim().slice(0, 120),
      summary: body.summary.trim().slice(0, 300),
      source: body.source.trim(),
      source_url: body.source_url.trim(),
      published_at: new Date(body.published_at).toISOString(),
      status: body.status || "draft",
    };

    console.log("[news-ingest] Inserting news item:", sanitizedData.title);

    const { data, error } = await supabase
      .from("news_items")
      .insert(sanitizedData)
      .select()
      .single();

    if (error) {
      console.error("[news-ingest] Insert error:", error);
      return new Response(
        JSON.stringify({ error: "Failed to insert news item", details: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[news-ingest] Successfully inserted news item:", (data as { id: string }).id);

    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[news-ingest] Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
