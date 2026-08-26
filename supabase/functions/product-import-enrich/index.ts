// ============================================================================
// product-import-enrich — AI enrichment for bulk product import (Shop Phase 2)
// ----------------------------------------------------------------------------
// POST { product_name: string }
// Returns structured JSON with Gemini-enriched product fields.
//
// Auth: verify_jwt=false (ES256 workaround). getAuthUser() verifies bearer token
// via supabase.auth.getUser(). Seller role checked against shop_members.
//
// Rate limit: 30 enrichments per user per 60 seconds.
// Gemini model: gemini-flash-lite-latest (cheap, fast).
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { getAuthUser, jsonResponse } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-flash-lite-latest";

const ENRICHMENT_PROMPT = `You are a pickleball equipment expert.
Given a product name, return structured JSON with:
- name: corrected/canonical product name (keep original language)
- category: one of ["paddle","ball","bag","shoe","apparel","net","accessory","other"]
- brand: manufacturer brand name
- description: 2-3 sentence Vietnamese product description
- specs: for paddles use ONLY these exact keys when known:
  brand, weight_g, core_mm, face, shape, handle_mm, grip_mm, usap.
  Values must not include units for numeric fields. face should describe face material.
- versions: product versions/models sold under this listing, array of short strings (for example ["14mm","16mm"])
- colors: real available colors, array of short Vietnamese strings
- price_estimate_vnd: estimated retail price in VND (integer, 0 if unknown)
- tags: searchable Vietnamese keywords array
- confidence: 0.00-1.00 how confident you are in this enrichment
- source_urls: up to 5 real product-page URLs from the manufacturer or reputable retailers.
  Only include URLs returned by Google Search. Prefer the exact model and official manufacturer.

If you cannot identify the product, set confidence to 0.00 and set other fields to null.
Return ONLY valid JSON, no markdown fences, no commentary.

Product name:`;

interface EnrichedProduct {
  name: string | null;
  category: string | null;
  brand: string | null;
  description: string | null;
  specs: Record<string, string> | null;
  price_estimate_vnd: number | null;
  tags: string[] | null;
  versions: string[] | null;
  colors: string[] | null;
  confidence: number;
  source_urls?: string[] | null;
}

interface ProductImageCandidate {
  url: string;
  source_url: string;
  alt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200);
}

function safePublicHttpsUrl(value: unknown): URL | null {
  if (typeof value !== "string" || value.length > 2_000) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === "localhost" || hostname.endsWith(".local") ||
        /^(?:127|10|0)\./.test(hostname) || /^192\.168\./.test(hostname) ||
        /^169\.254\./.test(hostname) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname) ||
        hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

function htmlAttribute(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

const GENERIC_PRODUCT_WORDS = new Set([
  "pickleball", "paddle", "paddles", "ball", "balls", "outdoor", "indoor",
  "pack", "set", "the", "with", "for", "and", "product", "official",
]);

function matchTokens(value: string): string[] {
  return value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z]+|\d+/g)?.filter((token) => token.length > 1 && !GENERIC_PRODUCT_WORDS.has(token)) ?? [];
}

function productNameMatches(expected: string, actual: string): boolean {
  const expectedTokens = [...new Set(matchTokens(expected))];
  const actualTokens = new Set(matchTokens(actual));
  if (expectedTokens.length === 0) return false;
  const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
  const required = expectedTokens.length <= 2 ? expectedTokens.length : Math.max(2, Math.ceil(expectedTokens.length * 0.6));
  return matched >= required;
}

function productJsonLd(html: string): { name: string; images: string[] } | null {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const visit = (value: unknown): { name: string; images: string[] } | null => {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found) return found;
      }
      return null;
    }
    if (!value || typeof value !== "object") return null;
    const object = value as Record<string, unknown>;
    const type = Array.isArray(object["@type"]) ? object["@type"] : [object["@type"]];
    if (type.some((item) => String(item).toLowerCase() === "product")) {
      const rawImages = Array.isArray(object.image) ? object.image : [object.image];
      return {
        name: typeof object.name === "string" ? object.name : "",
        images: rawImages.flatMap((item) => {
          if (typeof item === "string") return [item];
          if (item && typeof item === "object" && typeof (item as { url?: unknown }).url === "string") {
            return [(item as { url: string }).url];
          }
          return [];
        }),
      };
    }
    for (const child of Object.values(object)) {
      const found = visit(child);
      if (found) return found;
    }
    return null;
  };
  for (const script of scripts) {
    try {
      const found = visit(JSON.parse(script[1]));
      if (found) return found;
    } catch {
      // Ignore malformed analytics JSON-LD and continue with other blocks.
    }
  }
  return null;
}

async function fetchProductPage(initialUrl: URL): Promise<{ response: Response; url: URL } | null> {
  let current = initialUrl;
  for (let redirect = 0; redirect <= 4; redirect++) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { "user-agent": "Mozilla/5.0 (compatible; ThePickleHubBot/1.0; +https://thepicklehub.net)" },
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status < 300 || response.status >= 400) return { response, url: current };
    const location = response.headers.get("location");
    const next = location ? safePublicHttpsUrl(new URL(location, current).toString()) : null;
    if (!next) return null;
    current = next;
  }
  return null;
}

async function shopifyProduct(source: URL): Promise<{ name: string; images: string[] } | null> {
  const productPath = source.pathname.match(/^(.*\/products\/[^/]+)/)?.[1];
  if (!productPath) return null;
  try {
    const endpoint = new URL(`${productPath}.js`, source.origin);
    const response = await fetch(endpoint, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; ThePickleHubBot/1.0; +https://thepicklehub.net)" },
      signal: AbortSignal.timeout(5_000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok || !(contentType.includes("json") || contentType.includes("javascript"))) return null;
    const data = await response.json() as {
      title?: unknown;
      images?: unknown;
      featured_image?: unknown;
    };
    const images = [
      ...(Array.isArray(data.images) ? data.images : []),
      data.featured_image,
    ].flatMap((image) => {
      if (typeof image === "string") return [image];
      if (image && typeof image === "object" && typeof (image as { src?: unknown }).src === "string") {
        return [(image as { src: string }).src];
      }
      return [];
    });
    return { name: typeof data.title === "string" ? data.title : "", images };
  } catch {
    return null;
  }
}

async function findProductImages(sourceUrls: unknown, productName: string): Promise<ProductImageCandidate[]> {
  if (!Array.isArray(sourceUrls)) return [];
  const candidates: ProductImageCandidate[] = [];
  const seen = new Set<string>();

  for (const sourceValue of sourceUrls.slice(0, 5)) {
    const initialSource = safePublicHttpsUrl(sourceValue);
    if (!initialSource) continue;
    try {
      const fetched = await fetchProductPage(initialSource);
      if (!fetched) continue;
      const { response, url: source } = fetched;
      // Most pickleball manufacturers run Shopify. Their storefront HTML is
      // frequently bot-protected, while the public product JSON endpoint is
      // the same source the storefront itself uses and exposes canonical
      // title + product gallery without executing JavaScript.
      const shopify = await shopifyProduct(source);
      if (shopify && productNameMatches(productName, `${shopify.name} ${source.hostname}`)) {
        for (const rawImage of shopify.images.slice(0, 3)) {
          const image = safePublicHttpsUrl(new URL(rawImage, source).toString());
          if (!image || seen.has(image.toString())) continue;
          seen.add(image.toString());
          candidates.push({
            url: image.toString(),
            source_url: source.toString(),
            alt: shopify.name || productName,
          });
        }
      }
      if (!response.ok || !(response.headers.get("content-type") ?? "").includes("text/html")) continue;
      const html = (await response.text()).slice(0, 500_000);
      const structured = productJsonLd(html);
      const pageName = structured?.name || htmlAttribute(html, "og:title") ||
        html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
      if (!productNameMatches(productName, `${pageName} ${source.hostname}`)) continue;

      const rawImages = [
        ...(structured?.images ?? []),
        htmlAttribute(html, "og:image"),
        htmlAttribute(html, "twitter:image"),
      ].filter((value): value is string => Boolean(value));
      for (const rawImage of rawImages.slice(0, 3)) {
        const image = safePublicHttpsUrl(new URL(rawImage, source).toString());
        if (!image || seen.has(image.toString())) continue;
        seen.add(image.toString());
        candidates.push({
          url: image.toString(),
          source_url: source.toString(),
          alt: htmlAttribute(html, "og:image:alt") ?? pageName ?? productName,
        });
      }
    } catch {
      // Retailers commonly block bots. Skip that source and keep the others.
    }
  }
  return candidates.slice(0, 4);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function searchProductPageUrls(productName: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Find the exact product page for: ${productName}. Prefer the official manufacturer, then reputable retailers. Return only JSON: {"source_urls":["https://..."]}. Maximum 5 URLs.` }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) {
      console.warn("[product-import-enrich] image search HTTP", response.status);
      return [];
    }
    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
    const parsed = parseJsonObject(text);
    const modelUrls = Array.isArray(parsed?.source_urls)
      ? parsed.source_urls.filter((url): url is string => typeof url === "string")
      : [];
    const groundedUrls = (result?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [])
      .flatMap((chunk: { web?: { uri?: unknown } }) => typeof chunk.web?.uri === "string" ? [chunk.web.uri] : []);
    return [...new Set([...modelUrls, ...groundedUrls])].slice(0, 8);
  } catch (error) {
    console.warn("[product-import-enrich] image search skipped", error);
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );

  const user = await getAuthUser(req, supabase);
  if (!user) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const serviceRole = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const body = await req.json().catch(() => null);
  const productName = body?.product_name?.trim();
  if (!productName || typeof productName !== "string" ||
      productName.length < 2 || productName.length > 300) {
    return jsonResponse({ error: "invalid_product_name" }, 400);
  }

  // Rate limit: 30 per user per 60 seconds
  const rateLimitKey = `enrich:${user.id}:${Math.floor(Date.now() / 60000)}`;
  const { count } = await serviceRole
    .from("rate_limits")
    .select("*", { count: "exact" })
    .eq("key", rateLimitKey)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());

  if ((count ?? 0) >= 30) {
    return jsonResponse({ error: "rate_limited" }, 429);
  }

  if (!GEMINI_API_KEY) {
    console.error("[product-import-enrich] GEMINI_API_KEY not set");
    return jsonResponse({ error: "ai_unavailable" }, 503);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: ENRICHMENT_PROMPT + "\n\n" + productName }],
          }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("[product-import-enrich] Gemini HTTP", response.status);
      return jsonResponse({ error: "ai_unavailable" }, 503);
    }

    const result = await response.json();
    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      return jsonResponse({ error: "ai_no_response" }, 502);
    }

    let parsed: EnrichedProduct;
    try {
      parsed = JSON.parse(rawText) as EnrichedProduct;
    } catch {
      console.error("[product-import-enrich] Failed to parse Gemini JSON:", rawText.slice(0, 200));
      return jsonResponse({ error: "ai_invalid_json" }, 502);
    }

    if (parsed.specs && typeof parsed.specs === "object" && !Array.isArray(parsed.specs)) {
      parsed.specs = Object.fromEntries(
        Object.entries(parsed.specs)
          .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
          .map(([key, value]) => [key, String(value).trim().slice(0, 120)])
          .filter(([, value]) => value.length > 0),
      );
    } else {
      parsed.specs = null;
    }

    // Log enrichment for rate limit tracking
    await serviceRole.from("rate_limits").insert({ key: rateLimitKey });

    // Generate slug for the product
    const slug = slugify(parsed.name ?? productName);
    const sourceUrls = await searchProductPageUrls(parsed.name ?? productName);
    const imageCandidates = await findProductImages(sourceUrls, parsed.name ?? productName);

    return jsonResponse({
      ...parsed,
      slug,
      image_candidates: imageCandidates,
      original_name: productName,
    });
  } catch (error) {
    console.error("[product-import-enrich] Error:", error);
    return jsonResponse({ error: "ai_error" }, 500);
  }
});
