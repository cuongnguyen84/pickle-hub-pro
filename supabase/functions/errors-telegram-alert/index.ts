// ============================================================================
// errors-telegram-alert — push spike alerts to Telegram
// ----------------------------------------------------------------------------
// Runs on a 10-minute cron schedule. For each error fingerprint (message
// + first stack line) seen at least N times in the last 10 minutes, send
// a Telegram message to the admin chat — unless we already alerted on
// this fingerprint within the last hour (tracked in error_alert_dedup).
//
// Secrets required (set via `supabase secrets set --project-ref ...`):
//   TELEGRAM_BOT_TOKEN — from @BotFather
//   TELEGRAM_CHAT_ID   — Cuong's Telegram chat id (numeric, can be negative)
//
// The function is also exposed as a regular HTTP endpoint so it can be:
//   - Triggered manually via curl for testing
//   - Hit by an external cron (Cloudflare Worker, GitHub Action)
//   - Invoked from Supabase Scheduled Functions when available
//
// verify_jwt = false (cron invocations carry no JWT)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const SPIKE_THRESHOLD = 3;        // ≥ N occurrences of same fingerprint
const SPIKE_WINDOW_MIN = 10;      // ...within last 10 minutes
const DEDUPE_WINDOW_MIN = 60;     // ...silenced for 60 min after first alert

const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT  = Deno.env.get("TELEGRAM_CHAT_ID")  ?? "";

interface ClientError {
  id: string;
  type: string;
  message: string | null;
  stack: string | null;
  url: string | null;
  recorded_at: string;
}

function fingerprint(message: string | null, stack: string | null): string {
  const msg = (message ?? "").slice(0, 200);
  const stackLine = (stack ?? "").split("\n")[0]?.slice(0, 200) ?? "";
  return `${msg}|${stackLine}`;
}

function escapeMarkdown(s: string): string {
  // Telegram MarkdownV2 reserved chars.
  return s.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TG_TOKEN || !TG_CHAT) {
    console.warn("Telegram secrets missing — skipping send");
    return false;
  }
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        parse_mode: "MarkdownV2",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Telegram send failed", res.status, body.slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram fetch error", e instanceof Error ? e.message : String(e));
    return false;
  }
}

interface RunReport {
  scanned: number;
  unique_fingerprints: number;
  alerts_sent: number;
  alerts_suppressed: number;
}

async function runAlert(): Promise<RunReport> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const since = new Date(
    Date.now() - SPIKE_WINDOW_MIN * 60_000,
  ).toISOString();

  const { data: errors, error } = await supabase
    .from("client_errors")
    .select("id, type, message, stack, url, recorded_at")
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: false })
    .limit(1000);

  if (error) {
    console.error("client_errors query failed", error.message);
    return { scanned: 0, unique_fingerprints: 0, alerts_sent: 0, alerts_suppressed: 0 };
  }

  // Group by fingerprint.
  const groups = new Map<string, { sample: ClientError; count: number }>();
  for (const e of (errors ?? []) as ClientError[]) {
    const fp = fingerprint(e.message, e.stack);
    const g = groups.get(fp);
    if (g) {
      g.count++;
      // Keep the newest sample so the alert reflects current state.
      if (e.recorded_at > g.sample.recorded_at) g.sample = e;
    } else {
      groups.set(fp, { sample: e, count: 1 });
    }
  }

  let sent = 0;
  let suppressed = 0;

  for (const [fp, { sample, count }] of groups) {
    if (count < SPIKE_THRESHOLD) continue;

    // Dedupe — alerted recently?
    const { data: dedup } = await supabase
      .from("error_alert_dedup")
      .select("last_alerted_at")
      .eq("fingerprint", fp)
      .maybeSingle<{ last_alerted_at: string }>();

    if (dedup) {
      const since = Date.now() - new Date(dedup.last_alerted_at).getTime();
      if (since < DEDUPE_WINDOW_MIN * 60_000) {
        suppressed++;
        continue;
      }
    }

    // Compose Telegram message (MarkdownV2).
    const msgLine = escapeMarkdown(
      (sample.message ?? "unknown").slice(0, 200),
    );
    const urlLine = escapeMarkdown((sample.url ?? "—").slice(0, 200));
    const typeLine = escapeMarkdown(sample.type);
    const adminLink = escapeMarkdown(
      "https://www.thepicklehub.net/admin/errors",
    );

    const text = [
      `🚨 *ThePickleHub error spike*`,
      ``,
      `*Type:* \`${typeLine}\``,
      `*Count:* ${count} in last ${SPIKE_WINDOW_MIN}m`,
      `*Message:* ${msgLine}`,
      `*URL:* ${urlLine}`,
      ``,
      `[Open admin dashboard](${adminLink})`,
    ].join("\n");

    const ok = await sendTelegram(text);
    if (ok) {
      sent++;
      // Upsert dedup row.
      await supabase
        .from("error_alert_dedup")
        .upsert(
          {
            fingerprint: fp,
            last_alerted_at: new Date().toISOString(),
            alert_count: (dedup ? 1 : 1),  // start at 1; could be incremented from existing
          },
          { onConflict: "fingerprint" },
        );
    }
  }

  return {
    scanned: errors?.length ?? 0,
    unique_fingerprints: groups.size,
    alerts_sent: sent,
    alerts_suppressed: suppressed,
  };
}

// Constant-time string compare to avoid timing oracles on the shared secret.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Shared-secret gate. This endpoint has verify_jwt=false (cron carries no JWT),
  // so without this anyone could trigger the scan + Telegram send. Enforced only
  // when CRON_SECRET is configured — set the secret AND add the
  // `x-cron-secret` header to the cron caller to activate. Backward compatible
  // until then.
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  if (cronSecret) {
    const provided = req.headers.get("x-cron-secret") ?? "";
    if (!timingSafeEqual(provided, cronSecret)) {
      return new Response("Unauthorized", { status: 401 });
    }
  } else {
    console.warn("[errors-telegram-alert] CRON_SECRET not set — endpoint is unauthenticated");
  }

  const report = await runAlert();
  return new Response(JSON.stringify(report), {
    headers: { "Content-Type": "application/json" },
  });
});
