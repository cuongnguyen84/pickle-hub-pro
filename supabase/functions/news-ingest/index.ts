import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    // Authenticate: Only allow service_role key
    const authHeader = req.headers.get("Authorization");
    const expectedKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader || !expectedKey) {
      console.error("[news-ingest] Missing authorization or service key not configured");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Service key required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract token from Bearer header
    const token = authHeader.replace("Bearer ", "");
    if (token !== expectedKey) {
      console.error("[news-ingest] Invalid service key provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized - Invalid service key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Insert with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    console.log("[news-ingest] Successfully inserted news item:", data.id);

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
