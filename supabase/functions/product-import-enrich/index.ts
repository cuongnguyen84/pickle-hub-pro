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
- specs: key-value pairs (weight, material, core, face, shape, grip_size, etc.)
- price_estimate_vnd: estimated retail price in VND (integer, 0 if unknown)
- tags: searchable Vietnamese keywords array
- confidence: 0.00-1.00 how confident you are in this enrichment

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
  confidence: number;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

    // Log enrichment for rate limit tracking
    await serviceRole.from("rate_limits").insert({ key: rateLimitKey });

    // Generate slug for the product
    const slug = slugify(parsed.name ?? productName);

    return jsonResponse({
      ...parsed,
      slug,
      original_name: productName,
    });
  } catch (error) {
    console.error("[product-import-enrich] Error:", error);
    return jsonResponse({ error: "ai_error" }, 500);
  }
});
