import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { processSePayCheckout, type PreparedPayment } from "./handler.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed", code: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authorization } } },
  );
  if (!(await getAuthUser(req, client))) {
    return jsonResponse({ error: "Cần đăng nhập.", code: "unauthorized" }, 401);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Dữ liệu không hợp lệ.", code: "invalid_json" }, 400);
  }

  const env = Deno.env.get("SEPAY_ENV") === "production" ? "production" : "sandbox";
  const result = await processSePayCheckout(body, {
    async prepare(code) {
      const { data, error } = await client.rpc("shop_sepay_checkout_prepare", { _code: code });
      return { row: data as PreparedPayment | null, error: error?.message ?? null };
    },
  }, {
    env,
    merchantId: Deno.env.get("SEPAY_MERCHANT_ID") ?? "",
    secretKey: Deno.env.get("SEPAY_SECRET_KEY") ?? "",
    siteUrl: Deno.env.get("SITE_URL") ?? "https://www.thepicklehub.net",
  });

  console.log(JSON.stringify({
    function: "shop-sepay-checkout",
    status: result.status,
    code: typeof body === "object" && body ? (body as Record<string, unknown>).code : null,
    env,
  }));
  return jsonResponse(result.body, result.status);
});
