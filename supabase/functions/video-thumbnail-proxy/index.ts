// ============================================================================
// video-thumbnail-proxy
//
// Serves video bytes from the Supabase Storage `videos` bucket with proper
// CORS headers (Access-Control-Allow-Origin: *) so the frontend canvas-based
// thumbnail generator (src/hooks/useThumbnailGenerator.ts) can fetch the
// video same-origin via blob URL — no canvas taint, no SecurityError on
// toBlob().
//
// Phase 1 (commit 2b6bb09) tried to dodge taint via fetch() + blob URL on
// the direct Storage URL, but Supabase Storage edge nodes occasionally don't
// emit Access-Control-Allow-Origin for the public bucket — so even fetch()
// itself was blocked. Going through this proxy moves the bytes through an
// edge function we control (service_role downloads from Storage, then
// streams back with the right CORS headers).
//
// Auth model — follows the existing ES256/HS256 workaround documented in
// CLAUDE.md (4 other functions use the same pattern):
//   - verify_jwt = false in config.toml (gateway accepts the request)
//   - Bearer JWT validated INTERNALLY via supabase.auth.getUser() which
//     hits Auth API (Auth handles ES256 correctly)
//   - Role check: must be 'creator' OR 'admin' in user_roles
//   - Path validation: must start with "org/" and contain no ".." traversal
//
// Out of scope: this proxy doesn't generate the thumbnail — it just serves
// bytes. Phase 3 (server-side ffmpeg) is a separate function if Phase 2
// proves insufficient.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Expose-Headers": "content-length, content-range, accept-ranges",
};

const jsonError = (status: number, code: string, message?: string) =>
  new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return jsonError(405, "method_not_allowed", "Use GET or HEAD");
  }

  const url = new URL(req.url);
  const path = url.searchParams.get("path");

  if (!path) {
    return jsonError(400, "missing_path", "Provide ?path=org/<uuid>/...");
  }

  // Path validation — block traversal, restrict to org-scoped uploads
  if (path.includes("..") || !path.startsWith("org/")) {
    return jsonError(400, "invalid_path", "Path must start with 'org/' and contain no '..'");
  }

  // Auth — verify Bearer JWT via Auth API (handles ES256 correctly)
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return jsonError(401, "unauthorized", "Missing Authorization header");
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonError(401, "invalid_token", userError?.message);
  }

  // Role gate — only creators / admins may proxy video bytes. Anonymous
  // viewers can already SELECT public videos via the public bucket URL,
  // so they don't need this proxy. Restricting to creators/admins keeps
  // the bandwidth bill predictable and matches the existing storage RLS.
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: roleData, error: roleError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", ["creator", "admin"])
    .maybeSingle();
  if (roleError) {
    return jsonError(500, "role_lookup_failed", roleError.message);
  }
  if (!roleData) {
    return jsonError(403, "forbidden", "Creator or admin role required");
  }

  // Download bytes via service_role (bypasses RLS + storage CORS quirks)
  const { data: fileData, error: downloadError } = await adminClient.storage
    .from("videos")
    .download(path);
  if (downloadError || !fileData) {
    return jsonError(404, "storage_download_failed", downloadError?.message);
  }

  // For HEAD: return headers without body
  if (req.method === "HEAD") {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        "content-type": fileData.type || "video/mp4",
        "content-length": String(fileData.size),
      },
    });
  }

  // Stream back. Brief cache so the canvas-extract retry loop on the
  // frontend (3 attempts, 1.5s/3s/6s backoff) doesn't re-download the
  // same video for every attempt.
  return new Response(fileData, {
    headers: {
      ...corsHeaders,
      "content-type": fileData.type || "video/mp4",
      "content-length": String(fileData.size),
      "cache-control": "private, max-age=300",
    },
  });
});
