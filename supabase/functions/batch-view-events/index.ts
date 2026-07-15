import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAuthUser } from "../_shared/auth.ts";
import { supabaseClientPostCorsHeaders as corsHeaders } from "../_shared/cors.ts";
import {
  MAX_VIEW_EVENT_BODY_BYTES,
  buildInsertViewEvents,
  deduplicateClientViewEvents,
  extractClientViewEvents,
  getViewEventClientIp,
  hashViewEventIdentity,
  viewTargetKey,
  type InsertViewEvent,
  type ViewTarget,
} from "../_shared/view-events.ts";

const DEDUP_WINDOW_SECONDS = 30;
const RATE_WINDOW_SECONDS = 10 * 60;
const AUTHENTICATED_EVENT_LIMIT = 120;
const ANONYMOUS_EVENT_LIMIT = 600;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...headers },
  });
}

interface TargetRow {
  id: string;
  organization_id: string;
  status: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_VIEW_EVENT_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error("[batch-view-events] Supabase environment is incomplete");
    return json({ error: "service_unavailable" }, 503);
  }

  let body: unknown;
  try {
    const text = await req.text();
    if (!text || new TextEncoder().encode(text).byteLength > MAX_VIEW_EVENT_BODY_BYTES) {
      return json({ error: text ? "payload_too_large" : "empty_body" }, text ? 413 : 400);
    }
    body = JSON.parse(text);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const parsed = extractClientViewEvents(body);
  if (parsed.tooLarge) return json({ error: "batch_too_large", max_events: 20 }, 413);
  if (parsed.rawCount === 0) return json({ error: "missing_events" }, 400);
  if (parsed.events.length === 0) return json({ error: "no_valid_events" }, 400);

  const clientIp = getViewEventClientIp(req);
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const user = await getAuthUser(req, authClient);
  if (!user && !clientIp) {
    return json({ error: "client_identity_unavailable" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const identity = user ? `user:${user.id}` : `ip:${clientIp}`;
  const identityHash = await hashViewEventIdentity(identity);
  const eventLimit = user ? AUTHENTICATED_EVENT_LIMIT : ANONYMOUS_EVENT_LIMIT;
  const { data: rateData, error: rateError } = await serviceClient
    .rpc("consume_view_event_rate_limit", {
      p_identity_hash: identityHash,
      p_event_count: parsed.rawCount,
      p_limit: eventLimit,
      p_window_seconds: RATE_WINDOW_SECONDS,
    })
    .single<RateLimitResult>();

  if (rateError || !rateData) {
    console.error("[batch-view-events] Rate limit check failed:", rateError?.message);
    return json({ error: "rate_limit_unavailable" }, 503);
  }
  if (!rateData.allowed) {
    return json(
      { error: "rate_limited", retry_after_seconds: rateData.retry_after_seconds },
      429,
      { "Retry-After": String(rateData.retry_after_seconds) },
    );
  }

  const uniqueEvents = deduplicateClientViewEvents(parsed.events);
  const videoIds = uniqueEvents
    .filter((event) => event.target_type === "video")
    .map((event) => event.target_id);
  const livestreamIds = uniqueEvents
    .filter((event) => event.target_type === "livestream")
    .map((event) => event.target_id);

  const [videoResult, livestreamResult] = await Promise.all([
    videoIds.length > 0
      ? serviceClient.from("videos").select("id, organization_id, status").in("id", videoIds)
      : Promise.resolve({ data: [], error: null }),
    livestreamIds.length > 0
      ? serviceClient.from("livestreams").select("id, organization_id, status").in("id", livestreamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (videoResult.error || livestreamResult.error) {
    console.error(
      "[batch-view-events] Target lookup failed:",
      videoResult.error?.message ?? livestreamResult.error?.message,
    );
    return json({ error: "target_lookup_failed" }, 500);
  }

  const targets = new Map<string, ViewTarget>();
  for (const row of (videoResult.data ?? []) as TargetRow[]) {
    targets.set(viewTargetKey("video", row.id), {
      target_type: "video",
      target_id: row.id,
      organization_id: row.organization_id,
      is_replay: false,
    });
  }
  for (const row of (livestreamResult.data ?? []) as TargetRow[]) {
    targets.set(viewTargetKey("livestream", row.id), {
      target_type: "livestream",
      target_id: row.id,
      organization_id: row.organization_id,
      is_replay: row.status === "ended",
    });
  }

  const enriched = buildInsertViewEvents(
    uniqueEvents,
    targets,
    user?.id ?? null,
    clientIp ?? "authenticated-no-ip",
  );
  if (enriched.events.length === 0) {
    return json({ error: "no_valid_targets", rejected: parsed.rejected + enriched.missingTargets }, 400);
  }

  const cutoff = new Date(Date.now() - DEDUP_WINDOW_SECONDS * 1000).toISOString();
  const validTargetIds = [...new Set(enriched.events.map((event) => event.target_id))];
  let recentQuery = serviceClient
    .from("view_events")
    .select("target_type, target_id")
    .gte("created_at", cutoff)
    .in("target_id", validTargetIds);
  recentQuery = user
    ? recentQuery.eq("viewer_user_id", user.id)
    : recentQuery.is("viewer_user_id", null).eq("viewer_ip", clientIp!);

  const { data: recentRows, error: recentError } = await recentQuery;
  if (recentError) {
    console.error("[batch-view-events] Dedup lookup failed:", recentError.message);
    return json({ error: "dedup_lookup_failed" }, 500);
  }
  const recentKeys = new Set(
    (recentRows ?? []).map((row) => viewTargetKey(row.target_type, row.target_id)),
  );
  const eventsToInsert: InsertViewEvent[] = enriched.events.filter(
    (event) => !recentKeys.has(viewTargetKey(event.target_type, event.target_id)),
  );

  if (eventsToInsert.length > 0) {
    const { error: insertError } = await serviceClient.from("view_events").insert(eventsToInsert);
    if (insertError) {
      console.error("[batch-view-events] Insert failed:", insertError.message);
      return json({ error: "insert_failed" }, 500);
    }
  }

  const rejected = parsed.rejected + enriched.missingTargets;
  return json({
    success: true,
    received: parsed.rawCount,
    inserted: eventsToInsert.length,
    deduplicated: enriched.events.length - eventsToInsert.length,
    rejected,
    rate_limit_remaining: rateData.remaining,
  });
});
