import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushPayload {
  user_ids: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated (internal call or admin)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const payload: PushPayload = await req.json();
    const { user_ids, title, body, data } = payload;

    if (!user_ids?.length || !title) {
      return new Response(
        JSON.stringify({ error: "user_ids and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get push tokens for the target users
    const { data: tokens, error: tokenError } = await supabase
      .from("push_tokens")
      .select("token, platform")
      .in("user_id", user_ids);

    if (tokenError) {
      console.error("Error fetching tokens:", tokenError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch tokens" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens?.length) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No push tokens found for users" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group tokens by platform
    const iosTokens = tokens.filter((t) => t.platform === "ios").map((t) => t.token);
    const androidTokens = tokens.filter((t) => t.platform === "android").map((t) => t.token);

    let totalSent = 0;
    const errors: string[] = [];

    // Send to FCM (Android) if FCM_SERVER_KEY is configured
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    if (androidTokens.length > 0 && fcmServerKey) {
      try {
        const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            registration_ids: androidTokens,
            notification: { title, body },
            data: data || {},
          }),
        });
        const fcmResult = await fcmResponse.json();
        totalSent += fcmResult.success || 0;
        console.log("FCM result:", fcmResult);
      } catch (e) {
        console.error("FCM error:", e);
        errors.push(`FCM: ${e.message}`);
      }
    }

    // For iOS (APNs), we'll need APNs credentials
    // For now, log tokens that would be sent
    if (iosTokens.length > 0) {
      console.log(`[APNs] Would send to ${iosTokens.length} iOS devices:`, { title, body, data });
      // APNs integration requires:
      // 1. APNs Auth Key (.p8) or certificates
      // 2. Team ID, Key ID, Bundle ID
      // TODO: Implement APNs sending when credentials are configured
      
      // For now, also try FCM for iOS (if using Firebase for iOS too)
      if (fcmServerKey) {
        try {
          const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              registration_ids: iosTokens,
              notification: { title, body },
              data: data || {},
            }),
          });
          const fcmResult = await fcmResponse.json();
          totalSent += fcmResult.success || 0;
        } catch (e) {
          console.error("FCM iOS error:", e);
          errors.push(`FCM iOS: ${e.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        sent: totalSent,
        total_tokens: tokens.length,
        ios_tokens: iosTokens.length,
        android_tokens: androidTokens.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Send push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
