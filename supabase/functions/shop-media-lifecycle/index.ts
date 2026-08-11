// ============================================================================
// shop-media-lifecycle — the trusted half of the Shop media contract (P2a.2)
// ----------------------------------------------------------------------------
// SQL owns the rules; it cannot move bytes. This function is the only thing in
// the system holding the service role over the two product-media buckets, and
// it does exactly three jobs:
//
//   publish    verify the client-processed rendition, copy it into the public
//              bucket under an immutable versioned key, THEN ask Postgres to
//              move the pointer. Copy first, flip second — a pointer that
//              moves before the bytes exist gives the PDP a 404.
//   cleanup    drain shop_media_cleanup_jobs. Delete the object, then mark the
//              job done. Never the other way round, and never "done" on a
//              Storage error. An object that is already gone counts as done.
//   reconcile  unstick jobs a dead worker was holding, and queue objects that
//              nothing points at any more.
//
// verify_jwt=false (project-wide ES256/HS256 gateway mismatch). `publish` is
// authorized internally by handing the caller's own JWT to
// product_publish_prepare, which enforces pilot membership and manager role in
// Postgres. `cleanup` and `reconcile` are cron-only, behind x-cron-secret.
//
// Nothing here logs a URL: a signed URL in a log line is a credential in a log
// line. Object paths are logged, tokens and query strings are not.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { corsHeaders } from "../_shared/cors.ts";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { inspectWebp } from "./webp.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

const DRAFT_BUCKET = "shop-product-media-draft";
const PUBLIC_BUCKET = "shop-product-media";
const MAX_RENDITION_BYTES = 1_048_576;
const MAX_DIMENSION = 2048;
const CLEANUP_BATCH = 25;

const log = (payload: Record<string, unknown>) =>
  console.log(JSON.stringify({ function: "shop-media-lifecycle", ...payload }));

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Strip anything that could be a credential before an error reaches a row. */
const safeError = (e: unknown): string =>
  String(e instanceof Error ? e.message : e).replace(/\?[^\s]*/g, "").slice(0, 400);

const admin = () => createClient(SUPABASE_URL, SERVICE_KEY);

// ─── publish ────────────────────────────────────────────────────────────────

async function publish(req: Request, productId: string): Promise<Response> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "unauthorized" }, 401);

  // The caller's own JWT. Authorization is Postgres's decision, not ours:
  // product_publish_prepare refuses unless they are a pilot member and a
  // manager of the shop that owns the product, and unless it is approved.
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: plan, error: planError } = await asUser.rpc("product_publish_prepare", {
    _product_id: productId,
  });
  if (planError) {
    log({ event: "prepare_refused", product_id: productId, error: safeError(planError.message) });
    return json({ error: planError.message }, 403);
  }

  const svc = admin();
  const copied: Array<{ media_id: string; target: string }> = [];

  for (const item of plan.copies as Array<{ media_id: string; source: string; target: string }>) {
    const { data: blob, error: dlError } = await svc.storage.from(DRAFT_BUCKET).download(item.source);
    if (dlError || !blob) {
      log({ event: "copy_source_missing", media_id: item.media_id, path: item.source });
      return json({ error: "rendition_source_missing", media_id: item.media_id }, 409);
    }

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.byteLength > MAX_RENDITION_BYTES) {
      return json({ error: "rendition_too_large", media_id: item.media_id }, 422);
    }

    // Postgres checked the declared MIME type. This checks the actual bytes —
    // including that no EXIF chunk survived, so a seller's home coordinates
    // cannot ride a "re-encoded" file onto a public CDN.
    const verdict = inspectWebp(bytes);
    if (!verdict.ok) {
      log({ event: "rendition_rejected", media_id: item.media_id, reason: verdict.reason });
      return json({ error: `rendition_${verdict.reason}`, media_id: item.media_id }, 422);
    }
    if (verdict.width > MAX_DIMENSION || verdict.height > MAX_DIMENSION) {
      return json({ error: "rendition_dimensions", media_id: item.media_id }, 422);
    }

    // upsert so a retried publish overwrites its own half-finished copy rather
    // than failing forever on a key it wrote itself.
    const { error: upError } = await svc.storage.from(PUBLIC_BUCKET).upload(item.target, bytes, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "3600",
    });
    if (upError) {
      log({ event: "copy_failed", media_id: item.media_id, error: safeError(upError.message) });
      return json({ error: "copy_failed", media_id: item.media_id }, 502);
    }
    copied.push({ media_id: item.media_id, target: item.target });
  }

  // Only now does the pointer move. If this call fails the copies become
  // orphans, and reconcile sweeps them — a wasted object, never a broken PDP.
  const { data: n, error: commitError } = await svc.rpc("product_publish_commit", {
    _product_id: productId,
    _copied: copied,
  });
  if (commitError) {
    log({ event: "commit_failed", product_id: productId, error: safeError(commitError.message) });
    return json({ error: "commit_failed" }, 500);
  }

  log({ event: "published", product_id: productId, renditions: n });
  return json({ ok: true, product_id: productId, renditions: n });
}

// ─── cleanup ────────────────────────────────────────────────────────────────

async function cleanup(): Promise<Response> {
  const svc = admin();
  const { data: jobs, error } = await svc.rpc("shop_media_cleanup_claim", { _limit: CLEANUP_BATCH });
  if (error) {
    log({ event: "claim_failed", error: safeError(error.message) });
    return json({ error: "claim_failed" }, 500);
  }

  let deleted = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    try {
      const { error: rmError } = await svc.storage.from(job.bucket_id).remove([job.object_path]);
      // Storage returns success for an absent key; a genuine transport error
      // is the only thing that should keep the job open.
      if (rmError) throw new Error(rmError.message);

      await svc.rpc("shop_media_cleanup_complete", { _job_id: job.id, _ok: true });
      deleted += 1;
      log({ event: "object_deleted", bucket: job.bucket_id, path: job.object_path, reason: job.reason });
    } catch (e) {
      await svc.rpc("shop_media_cleanup_complete", {
        _job_id: job.id,
        _ok: false,
        _error: safeError(e),
      });
      failed += 1;
      log({ event: "delete_failed", bucket: job.bucket_id, path: job.object_path, error: safeError(e) });
    }
  }

  return json({ ok: true, claimed: (jobs ?? []).length, deleted, failed });
}

// ─── reconcile ──────────────────────────────────────────────────────────────

async function reconcile(): Promise<Response> {
  const svc = admin();
  const { data, error } = await svc.rpc("shop_media_reconcile");
  if (error) {
    log({ event: "reconcile_failed", error: safeError(error.message) });
    return json({ error: "reconcile_failed" }, 500);
  }
  log({ event: "reconciled", ...data });
  return json({ ok: true, ...data });
}

// ─── entry ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "not_configured" }, 503);

  let body: { action?: string; product_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  switch (body.action) {
    case "publish":
      if (!body.product_id) return json({ error: "product_id_required" }, 400);
      return await publish(req, body.product_id);

    case "cleanup": {
      const rejection = requireCronRequest(req, CRON_SECRET);
      if (rejection) return rejection;
      return await cleanup();
    }

    case "reconcile": {
      const rejection = requireCronRequest(req, CRON_SECRET);
      if (rejection) return rejection;
      return await reconcile();
    }

    default:
      return json({ error: "unknown_action" }, 400);
  }
});
