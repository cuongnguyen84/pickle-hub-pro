interface ImagesBinding {
  input(stream: ReadableStream): {
    transform(options: { segment: "foreground" }): {
      output(options: { format: "image/png" }): Promise<{ response(): Response }>;
    };
  };
}

interface Env {
  IMAGES: ImagesBinding;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  ALLOWED_ORIGINS: string;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const corsHeaders = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  Vary: "Origin",
});

function safeImageUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "::1" ||
        /^(?:127|10|0)\./.test(host) || /^192\.168\./.test(host) ||
        /^169\.254\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
        host.startsWith("fc") || host.startsWith("fd")) return null;
    return url;
  } catch {
    return null;
  }
}

type SellerAuthResult = "ok" | "session_invalid" | "seller_required" | "auth_unavailable";

async function authorizeSeller(request: Request, env: Env): Promise<SellerAuthResult> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return "session_invalid";
  const authHeaders = { authorization, apikey: env.SUPABASE_PUBLISHABLE_KEY };
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: authHeaders });
  if (!userResponse.ok) {
    console.warn("supabase user verification failed", userResponse.status);
    return userResponse.status === 401 || userResponse.status === 403 ? "session_invalid" : "auth_unavailable";
  }
  const user = await userResponse.json() as { id?: string };
  if (!user.id) return "session_invalid";
  const membership = new URL(`${env.SUPABASE_URL}/rest/v1/shop_members`);
  membership.searchParams.set("user_id", `eq.${user.id}`);
  membership.searchParams.set("role", "in.(owner,manager)");
  membership.searchParams.set("select", "id");
  membership.searchParams.set("limit", "1");
  const memberResponse = await fetch(membership, { headers: authHeaders });
  if (!memberResponse.ok) {
    console.warn("seller membership lookup failed", memberResponse.status);
    return "auth_unavailable";
  }
  const rows = await memberResponse.json() as unknown[];
  return rows.length > 0 ? "ok" : "seller_required";
}

async function fetchPublicImage(initial: URL, referer: URL | null): Promise<Response | null> {
  let current = initial;
  for (let redirect = 0; redirect <= 4; redirect++) {
    const response = await fetch(current, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (compatible; ThePickleHubImageBot/1.0)",
        ...(referer ? { Referer: referer.toString() } : {}),
      },
      redirect: "manual",
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    const next = location ? safeImageUrl(new URL(location, current).toString()) : null;
    if (!next) return null;
    current = next;
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("origin") ?? "";
    const allowed = new Set(env.ALLOWED_ORIGINS.split(",").map((item) => item.trim()));
    if (!allowed.has(origin)) return new Response("Forbidden", { status: 403 });
    const cors = corsHeaders(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
    const sellerAuth = await authorizeSeller(request, env);
    if (sellerAuth !== "ok") {
      const status = sellerAuth === "session_invalid" ? 401 : sellerAuth === "seller_required" ? 403 : 503;
      return new Response(sellerAuth, { status, headers: cors });
    }

    const payload = await request.json().catch(() => null) as {
      image_url?: unknown;
      source_url?: unknown;
    } | null;
    const source = safeImageUrl(payload?.image_url);
    const referer = safeImageUrl(payload?.source_url);
    if (!source) return new Response("Invalid image URL", { status: 400, headers: cors });
    const imageResponse = await fetchPublicImage(source, referer);
    if (!imageResponse) {
      console.warn("image source redirect rejected", source.hostname);
      return new Response("image_source_unavailable", { status: 422, headers: cors });
    }
    const contentType = imageResponse.headers.get("content-type") ?? "";
    const declaredSize = Number(imageResponse.headers.get("content-length") ?? 0);
    if (!imageResponse.ok || !contentType.match(/^image\/(jpeg|png|webp)/) || declaredSize > MAX_IMAGE_BYTES) {
      console.warn("image source rejected", source.hostname, imageResponse.status, contentType);
      return new Response("image_source_unavailable", { status: 422, headers: cors });
    }
    const bytes = await imageResponse.arrayBuffer();
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return new Response("Image is too large", { status: 413, headers: cors });
    }

    try {
      const transformed = await env.IMAGES
        .input(new Blob([bytes], { type: contentType }).stream())
        .transform({ segment: "foreground" })
        .output({ format: "image/png" });
      const response = transformed.response();
      return new Response(response.body, {
        status: response.status,
        headers: { ...cors, "Content-Type": "image/png", "Cache-Control": "no-store" },
      });
    } catch (error) {
      console.error("background removal failed", error);
      return new Response("background_model_failed", { status: 502, headers: cors });
    }
  },
};
