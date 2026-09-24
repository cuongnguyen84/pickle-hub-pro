/**
 * Wriai "Custom Webhook / REST API" receiver.
 *
 * POST /api/wriai-webhook
 *   header X-Wriai-Signature: sha256=<hex HMAC-SHA256(rawBody, WRIAI_WEBHOOK_SECRET)>
 *
 * Wriai articles land in `wriai_inbox` and are NEVER published from here: they
 * are reviewed and rewritten into a normal EN+VI post first (see the migration
 * 20260924090000_wriai_inbox.sql for why). The `url` we hand back is the
 * planned /vi/blog URL — it 404s until the draft is converted, so keep Wriai's
 * "Google Indexing API" toggle OFF.
 *
 * Environment variables:
 *   WRIAI_WEBHOOK_SECRET       — the secret generated in Wriai Site Management
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { blogMetadata } from "../../src/content/blog/metadata";

interface Env {
  WRIAI_WEBHOOK_SECRET?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const SITE = "https://www.thepicklehub.net";
// A long article with inline HTML + markdown is well under this; anything
// bigger is not a Wriai article.
const MAX_BODY_BYTES = 2_000_000;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function signBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return "sha256=" + [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Wriai reuses the slug as a URL segment; keep only what a slug may contain.
const cleanSlug = (s: unknown) =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 120) || null;

function inboxRow(article: Record<string, unknown>, raw: unknown) {
  return {
    slug: cleanSlug(article.slug),
    title: String(article.title ?? "(untitled)").slice(0, 500),
    meta_title: article.meta_title ?? null,
    meta_description: article.meta_description ?? null,
    category: article.category == null ? null : String(article.category),
    content_html: article.content_html ?? null,
    content_markdown: article.content_markdown ?? null,
    featured_image: article.featured_image ?? null,
    images: article.images ?? null,
    faq_schema: article.faq_schema ?? null,
    author: article.author ?? null,
    raw,
    updated_at: new Date().toISOString(),
  };
}

async function rest(env: Env, path: string, init: RequestInit): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Trimmed: a secret piped in via `pbpaste | wrangler secret put` may carry a newline.
  const secret = env.WRIAI_WEBHOOK_SECRET?.trim();
  // Fail closed: no secret configured means nobody may write the inbox.
  if (!secret) return json({ error: "Webhook not configured" }, 503);

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413);

  // Wriai documents both: an HMAC in X-Wriai-Signature (with or without the
  // "sha256=" prefix) and the secret itself as a Bearer token.
  const expected = await signBody(secret, rawBody);
  const signature = (request.headers.get("x-wriai-signature") ?? "").trim();
  const bearer = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const ok =
    timingSafeEqual(signature, expected) ||
    timingSafeEqual("sha256=" + signature, expected) ||
    timingSafeEqual(bearer, secret);
  if (!ok) {
    console.warn("[wriai-webhook] auth failed", { hasSignature: !!signature, hasBearer: !!bearer, sigLen: signature.length });
    return json({ error: "Invalid signature" }, 401);
  }

  let payload: { event?: string; article?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const { event, article = {} } = payload;

  switch (event) {
    case "ping":
      return json({ status: "ok", message: "Wriai Webhook Connected" });

    case "categories.get":
      return json({
        success: true,
        categories: [
          { id: "tournaments", name: "Giải đấu", slug: "tournaments" },
          { id: "skills", name: "Kỹ thuật & chiến thuật", slug: "skills" },
          { id: "gear", name: "Dụng cụ", slug: "gear" },
          { id: "community", name: "Cộng đồng", slug: "community" },
        ],
      });

    case "authors.get":
      return json({
        success: true,
        authors: [{ id: "thepicklehub", name: "ThePickleHub", title: "Ban biên tập ThePickleHub" }],
      });

    // For Wriai's internal linking: every published EN post (VI twins resolve via hreflang).
    case "posts.get":
      return json({
        success: true,
        posts: blogMetadata.map((p) => ({
          id: p.slug,
          slug: p.slug,
          title: p.titleEn,
          url: `${SITE}/blog/${p.slug}`,
        })),
      });

    case "article.publish": {
      const res = await rest(env, "wriai_inbox", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(inboxRow(article, payload)),
      });
      if (!res.ok) {
        console.error("[wriai-webhook] insert failed:", res.status, (await res.text()).slice(0, 200));
        return json({ success: false, error: "Storage failed" }, 502);
      }
      const [row] = (await res.json()) as { id: string; slug: string | null }[];
      return json({ success: true, post_id: row.id, url: `${SITE}/vi/blog/${row.slug ?? ""}` });
    }

    case "article.update":
    case "article.delete": {
      const postId = String(article.post_id ?? article.id ?? "");
      if (!UUID.test(postId)) return json({ success: false, error: "Unknown post_id" }, 404);
      const patch =
        event === "article.delete"
          ? { status: "deleted", updated_at: new Date().toISOString() }
          : inboxRow(article, payload);
      // Only untouched drafts follow Wriai; once reviewed, the site owns the text.
      const res = await rest(env, `wriai_inbox?id=eq.${postId}&status=eq.new`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        console.error("[wriai-webhook] patch failed:", res.status, (await res.text()).slice(0, 200));
        return json({ success: false, error: "Storage failed" }, 502);
      }
      return json({ success: true, post_id: postId, url: `${SITE}/vi/blog/${cleanSlug(article.slug) ?? ""}` });
    }

    default:
      return json({ success: true });
  }
};
