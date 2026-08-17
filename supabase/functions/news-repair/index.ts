// ============================================================================
// news-repair — recover news_origins that news-rewrite gave up on
// ----------------------------------------------------------------------------
// news-rewrite already retries three times inside a single run, feeding the
// validation error back to Gemini each time. Anything that reaches
// pipeline_status='failed' has therefore already survived three corrective
// attempts, so requeueing it unchanged just fails again — which is exactly what
// happened when thirty origins were requeued by hand on 2026-08-17.
//
// This function only does what that retry loop cannot: change the row so the
// next attempt is judged against different rules, and then requeue it. It never
// touches a row that is pending, rewriting or published, so it cannot disturb
// the working path.
//
// Endpoints:
//   POST /   { dry_run?: boolean }   requires x-cron-secret = $CRON_SECRET
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
//      TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
// ============================================================================

import { requireCronRequest } from '../_shared/cron-auth.ts';
import { planRepair, type Origin } from './plan.ts';

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const TG_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const TG_CHAT = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

async function sendTelegram(text: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT) return;
  try {
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TG_CHAT,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (error) {
    // A failed alert must not fail the repair that already happened.
    console.error("[news-repair] telegram failed:", error);
  }
}

function rest(path: string): string {
  return `${SUPABASE_URL}/rest/v1/${path}`;
}
function headers(): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req) => {
  // Shared helper rather than a hand-rolled check: it is fail-closed, it is
  // what every other cron function uses, and the auth registry enforces it.
  const rejected = requireCronRequest(req, CRON_SECRET);
  if (rejected) return rejected;

  const body = await req.json().catch(() => ({})) as { dry_run?: boolean };
  const dryRun = body.dry_run === true;

  const res = await fetch(
    rest("news_origins?pipeline_status=eq.failed&select=id,raw_title,source_name,content_kind,attempts,last_error&limit=100"),
    { headers: headers() },
  );
  if (!res.ok) {
    const detail = await res.text();
    await sendTelegram(`⚠️ <b>news-repair</b> could not read the queue\n<code>${detail.slice(0, 200)}</code>`);
    return new Response(JSON.stringify({ error: "read_failed" }), { status: 500 });
  }
  const origins = await res.json() as Origin[];

  if (origins.length === 0) {
    return new Response(JSON.stringify({ ok: true, failed: 0, repaired: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const repaired: string[] = [];
  const left: string[] = [];

  for (const origin of origins) {
    const plan = planRepair(origin);
    const title = (origin.raw_title ?? origin.id).slice(0, 60);

    if (plan.kind === "leave") {
      left.push(`• ${title} — ${plan.reason}`);
      continue;
    }
    if (dryRun) {
      repaired.push(`• ${title} — ${plan.reason} (dry run)`);
      continue;
    }

    const patch = {
      pipeline_status: "pending",
      last_error: null,
      attempts: (origin.attempts ?? 0) + 1,
      ...(plan.kind === "reclassify" ? plan.patch : {}),
    };
    const upd = await fetch(rest(`news_origins?id=eq.${origin.id}`), {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify(patch),
    });
    if (upd.ok) repaired.push(`• ${title} — ${plan.reason}`);
    else left.push(`• ${title} — patch failed ${upd.status}`);
  }

  // Only speak when something is worth knowing. A silent run is the normal
  // case and a daily "0 failures" message trains people to ignore the channel.
  if (repaired.length || left.length) {
    const lines = [
      `🛠 <b>news-repair</b> — ${origins.length} failed origin(s)`,
      repaired.length ? `\n<b>Requeued ${repaired.length}</b>\n${repaired.join("\n")}` : "",
      left.length ? `\n<b>Needs a look — ${left.length}</b>\n${left.join("\n")}` : "",
      dryRun ? "\n<i>dry run — nothing was written</i>" : "",
    ].filter(Boolean);
    await sendTelegram(lines.join("\n"));
  }

  return new Response(
    JSON.stringify({
      ok: true,
      failed: origins.length,
      repaired: repaired.length,
      left: left.length,
      dry_run: dryRun,
    }),
    { headers: { "Content-Type": "application/json" } },
  );
});
