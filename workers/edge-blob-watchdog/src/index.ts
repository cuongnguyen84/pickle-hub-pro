/**
 * edge-blob-watchdog — see wrangler.toml header for the incident context.
 *
 * Every 5 minutes: GET a canary set of Supabase edge functions. Any body
 * containing NOT_FOUND_FUNCTION_BLOB → dispatch uptime-ping.yml on main,
 * whose blob-sweep step redeploys the whole fleet and pings Telegram 🩹.
 *
 * The canary list favors functions the incident already hit + the ones
 * whose outage hurts users fastest (auth email, OTP, payments).
 */

interface Env {
  GH_DISPATCH_PAT: string;
}

const PROJECT_URL = "https://ajvlcamxemgbxduhiqrl.supabase.co";
const REPO = "cuongnguyen84/pickle-hub-pro";
const WORKFLOW = "uptime-ping.yml";

const CANARIES = [
  "geo-check",
  "send-auth-email",
  "phone-otp-send",
  "create-payment-order",
  "pro-tour-ingest",
  "feed-embeds-sync",
  "og-image-social-event",
  "mux-webhook",
];

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(run(env));
  },
  // Manual probe/trigger for verification: GET / runs the same check.
  async fetch(_req: Request, env: Env): Promise<Response> {
    const broken = await run(env);
    return new Response(JSON.stringify({ broken }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

async function run(env: Env): Promise<string[]> {
  const broken: string[] = [];
  await Promise.all(
    CANARIES.map(async (fn) => {
      try {
        const res = await fetch(`${PROJECT_URL}/functions/v1/${fn}`, {
          signal: AbortSignal.timeout(10_000),
        });
        const body = await res.text();
        if (body.includes("NOT_FOUND_FUNCTION_BLOB")) broken.push(fn);
      } catch {
        // Network blips are not blob loss — ignore; next tick retries.
      }
    }),
  );

  if (broken.length === 0) return broken;

  console.error(`[watchdog] blob-less canaries: ${broken.join(", ")} — dispatching heal`);
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GH_DISPATCH_PAT}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "edge-blob-watchdog",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );
  if (!res.ok) {
    console.error(`[watchdog] dispatch failed: ${res.status} ${await res.text()}`);
  }
  return broken;
}
