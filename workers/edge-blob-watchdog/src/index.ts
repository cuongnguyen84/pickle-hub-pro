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

// Blob loss is per-edge-region (26/07 forensics: each incident burst confined to
// one x_sb_edge_region while others served 200). Probe the regions our traffic
// actually lands in: ap-northeast-1 = project home + pg_cron, ap-northeast-2 =
// VN users, us-east-1 = GitHub runners / US traffic, ap-southeast-1 = VN users
// via Singapore (lost all 75 fns for ~7h on 29/07 unseen by the 3-region list),
// us-east-2 = repeat offender in the 24-26/07 forensics.
const REGIONS = ["ap-northeast-1", "ap-northeast-2", "us-east-1", "ap-southeast-1", "us-east-2"];

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
    CANARIES.flatMap((fn) =>
      REGIONS.map(async (region) => {
        try {
          const res = await fetch(`${PROJECT_URL}/functions/v1/${fn}`, {
            headers: { "x-region": region },
            signal: AbortSignal.timeout(10_000),
          });
          const body = await res.text();
          if (body.includes("NOT_FOUND_FUNCTION_BLOB")) broken.push(`${fn}@${region}`);
        } catch {
          // Network blips are not blob loss — ignore; next tick retries.
        }
      }),
    ),
  );

  if (broken.length === 0) return broken;

  // Dispatch cooldown (29/07): the 1-minute cron used to dispatch on EVERY
  // tick while a region stayed broken — 100 runs in 6.3h ≈ 12k billed
  // Actions-min/month. A heal takes ~2 min and the eviction recurs ~30 min
  // after each heal, so anything dispatched within the cooldown is a
  // duplicate of a heal already in flight. GH runs API is the state store —
  // no KV binding needed. Canary dead-window cost: ≤ cooldown, in practice
  // ~1-2 min because eviction cadence (~30') matches the cooldown.
  // 30' (raised from 15', Cuong 29/07): halves worst-case storm cost again
  // (max 48 heal runs/day). Don't raise to 60' — eviction recurs ~30' after
  // each heal, so 60' would leave auth/OTP dead ~30 min every cycle.
  const COOLDOWN_MS = 30 * 60_000;
  try {
    const lastRes = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/runs?per_page=1`,
      {
        headers: {
          Authorization: `Bearer ${env.GH_DISPATCH_PAT}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "edge-blob-watchdog",
        },
      },
    );
    if (lastRes.ok) {
      const data = (await lastRes.json()) as {
        workflow_runs?: Array<{ created_at?: string }>;
      };
      const createdAt = data.workflow_runs?.[0]?.created_at;
      if (createdAt && Date.now() - Date.parse(createdAt) < COOLDOWN_MS) {
        console.error(
          `[watchdog] blob-less: ${broken.join(", ")} — heal dispatched <30min ago, cooldown`,
        );
        return broken;
      }
    }
  } catch {
    // Cooldown check failing must not block the heal itself.
  }

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
