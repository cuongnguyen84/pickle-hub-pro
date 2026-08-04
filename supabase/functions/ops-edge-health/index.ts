import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";

type ProbeState = "available" | "missing_blob" | "http_error" | "timeout";
type RegistryRow = { function_slug: string; display_name: string; probe_url: string | null };
type StateRow = { state: string; consecutive_failures: number; changed_at: string };

const baseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const tgToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const tgChat = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

async function sendTelegram(text: string): Promise<boolean> {
  if (!tgToken || !tgChat) return false;
  const response = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: tgChat, text, disable_web_page_preview: true }),
  });
  return response.ok;
}

// Googlebot UA để URL probe đi đúng nhánh prerender middleware trên Cloudflare Pages.
const BOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

async function probe(slug: string, probeUrl: string | null): Promise<{ state: ProbeState; status: number | null; ms: number; reason: string }> {
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = probeUrl
      ? await fetch(probeUrl, { method: "GET", headers: { "User-Agent": BOT_UA }, signal: controller.signal })
      : await fetch(`${baseUrl}/functions/v1/${slug}`, { method: "OPTIONS", signal: controller.signal });
    const body = await response.text();
    const ms = Math.round(performance.now() - started);
    if (response.ok) return { state: "available", status: response.status, ms, reason: `Runtime available (HTTP ${response.status})` };
    if (!probeUrl && response.status === 404 && /NOT_FOUND_FUNCTION_BLOB|Requested function was not found/i.test(body)) {
      return { state: "missing_blob", status: 404, ms, reason: "Supabase deployment metadata exists but runtime blob is missing" };
    }
    return { state: "http_error", status: response.status, ms, reason: `Probe returned HTTP ${response.status}: ${body.slice(0, 300)}` };
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    return { state: "timeout", status: null, ms, reason: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
  if (authError) return authError;
  const supabase = createClient(baseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data: registry, error } = await supabase.from("ops_edge_function_registry")
    .select("function_slug,display_name,probe_url").eq("enabled", true).order("function_slug");
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const fn of (registry ?? []) as RegistryRow[]) {
    const result = await probe(fn.function_slug, fn.probe_url);
    const { data: previous } = await supabase.from("ops_edge_function_state")
      .select("state,consecutive_failures,changed_at").eq("function_slug", fn.function_slug).maybeSingle<StateRow>();
    const failures = result.state === "available" ? 0 : (previous?.consecutive_failures ?? 0) + 1;
    const changed = previous?.state !== result.state;
    const now = new Date().toISOString();
    const crossedFailureThreshold = failures === 2;
    let alerted = false;
    if (changed && result.state === "available" && previous && previous.state !== "available") {
      alerted = await sendTelegram(`✅ Edge Function recovered\n${fn.display_name} (${fn.function_slug})\nHTTP ${result.status} · ${result.ms}ms\nhttps://www.thepicklehub.net/admin/jobs`);
    } else if (result.state !== "available" && ((result.state === "missing_blob" && changed) || crossedFailureThreshold)) {
      alerted = await sendTelegram(`🚨 Edge Function unavailable\n${fn.display_name} (${fn.function_slug})\nState: ${result.state}\nReason: ${result.reason}\nhttps://www.thepicklehub.net/admin/jobs`);
    }
    const { error: upsertError } = await supabase.from("ops_edge_function_state").upsert({
      function_slug: fn.function_slug, state: result.state, http_status: result.status,
      response_ms: result.ms, reason: result.reason, consecutive_failures: failures,
      checked_at: now, changed_at: changed ? now : previous?.changed_at ?? now,
      last_alerted_at: alerted ? now : undefined,
      recovered_at: result.state === "available" && previous?.state !== "available" ? now : undefined,
    }, { onConflict: "function_slug" });
    if (upsertError) throw upsertError;
    results.push({ function_slug: fn.function_slug, ...result, consecutive_failures: failures });
  }
  return Response.json({ ok: true, checked: results.length, results });
});
