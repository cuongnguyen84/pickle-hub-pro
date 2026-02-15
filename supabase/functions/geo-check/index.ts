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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if geo blocking is enabled
    const { data: enabledRow } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "geo_block_enabled")
      .single();

    const geoBlockEnabled = enabledRow?.value === true;

    if (!geoBlockEnabled) {
      return new Response(
        JSON.stringify({ country: null, blocked: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get blocked countries list
    const { data: countriesRow } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "blocked_countries")
      .single();

    const blockedCountries: string[] = Array.isArray(countriesRow?.value)
      ? countriesRow.value
      : ["US"];

    // Get user's IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    let country = "unknown";

    // Try ip-api.com (free, no key needed, 45 req/min)
    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        country = geoData.countryCode || "unknown";
      } else {
        await geoRes.text(); // consume body
      }
    } catch (e) {
      console.error("[geo-check] IP lookup failed:", e);
    }

    const blocked = blockedCountries.includes(country);

    return new Response(
      JSON.stringify({ country, blocked }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[geo-check] Error:", error);
    return new Response(
      JSON.stringify({ country: null, blocked: false, error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
