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

// --- FCM V1 Auth: Generate OAuth2 access token from service account ---

function base64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\n/g, "");
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf.buffer;
}

async function createSignedJwt(
  serviceAccount: { client_email: string; private_key: string; token_uri: string }
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: serviceAccount.token_uri,
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const keyData = pemToArrayBuffer(serviceAccount.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  return `${unsignedToken}.${base64url(signature)}`;
}

async function getAccessToken(serviceAccount: {
  client_email: string;
  private_key: string;
  token_uri: string;
}): Promise<string> {
  const jwt = await createSignedJwt(serviceAccount);

  const resp = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("OAuth token error:", data);
    throw new Error(`Failed to get access token: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

// --- Main handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse FCM service account
    const fcmJsonStr = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
    if (!fcmJsonStr) {
      return new Response(
        JSON.stringify({ error: "FCM_SERVICE_ACCOUNT_JSON not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceAccount = JSON.parse(fcmJsonStr);
    const projectId = serviceAccount.project_id;

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

    // Get OAuth2 access token for FCM V1 API
    const accessToken = await getAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let totalSent = 0;
    const errors: string[] = [];

    // Send to each token using FCM V1 API
    for (const { token } of tokens) {
      try {
        const message: Record<string, unknown> = {
          message: {
            token,
            notification: { title, body },
            data: data || {},
          },
        };

        const fcmResponse = await fetch(fcmUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(message),
        });

        const result = await fcmResponse.json();

        if (fcmResponse.ok) {
          totalSent++;
          console.log(`[FCM V1] Sent to token ${token.substring(0, 10)}...`);
        } else {
          console.error(`[FCM V1] Error for token ${token.substring(0, 10)}...:`, result);
          errors.push(`Token ${token.substring(0, 10)}...: ${result.error?.message || "Unknown error"}`);
        }
      } catch (e) {
        console.error(`[FCM V1] Exception:`, e);
        errors.push(`Token ${token.substring(0, 10)}...: ${e.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        sent: totalSent,
        total_tokens: tokens.length,
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
