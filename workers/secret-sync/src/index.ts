/**
 * secret-sync Cloudflare Worker
 *
 * Auto-heals drift between vault values and Supabase project env values for
 * the pipeline auth secrets. See wrangler.toml for context.
 *
 * Endpoints:
 *   GET  /health  → liveness (no auth)
 *   POST /heal    → run a check + sync pass (requires X-Heal-Secret header)
 *
 * Concurrency: not designed for parallel /heal calls. Cron fires it sequentially.
 */

export interface Env {
  // vars
  SUPABASE_URL: string;
  SUPABASE_PROJECT_REF: string;
  // secrets
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_MANAGEMENT_PAT: string;
  HEAL_AUTH_SECRET: string;
}

// Pipelines to check. Edge env var name on Supabase project ↔ vault secret
// name ↔ edge function path that authenticates with it.
interface PipelineCheck {
  projectSecretName: string;
  vaultSecretName: string;
  functionPath: string;
  headerName: string;
}

const PIPELINES: PipelineCheck[] = [
  {
    projectSecretName: 'SCRAPER_AUTH_SECRET',
    vaultSecretName: 'scraper_auth_secret',
    functionPath: 'news-translate',
    headerName: 'x-auth-secret',
  },
  {
    projectSecretName: 'SOCIAL_POSTER_SECRET',
    vaultSecretName: 'social_poster_auth_secret',
    functionPath: 'social-caption',
    headerName: 'X-Auth-Secret',
  },
];

interface CheckResult {
  pipeline: string;
  initial_status: number;
  action: 'no_op' | 'synced' | 'verify_failed' | 'vault_missing' | 'mgmt_failed';
  final_status: number | null;
  note: string;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, name: 'secret-sync' });
    }

    if (req.method !== 'POST' || url.pathname !== '/heal') {
      return json({ error: 'Not found' }, 404);
    }

    if (!env.HEAL_AUTH_SECRET || req.headers.get('X-Heal-Secret') !== env.HEAL_AUTH_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      const results: CheckResult[] = [];
      for (const p of PIPELINES) {
        results.push(await checkAndSync(env, p));
      }
      try {
        await logToDb(env, results);
      } catch (e) {
        console.error('log insert failed:', e);
      }
      const anySynced = results.some((r) => r.action === 'synced');
      return json({ checked: results.length, synced: anySynced, results });
    } catch (err) {
      // Don't expose stack traces in the response — info leak per CodeQL.
      const msg = err instanceof Error ? err.message : String(err);
      console.error('FATAL', msg);
      return json({ error: 'fatal', detail: msg.slice(0, 800) }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Core check + sync
// ---------------------------------------------------------------------------

async function checkAndSync(env: Env, p: PipelineCheck): Promise<CheckResult> {
  // 1. Read vault value
  const vaultValue = await readVault(env, p.vaultSecretName);
  if (!vaultValue) {
    return {
      pipeline: p.projectSecretName,
      initial_status: 0,
      action: 'vault_missing',
      final_status: null,
      note: `vault.${p.vaultSecretName} not found`,
    };
  }

  // 2. Test edge function with vault value
  const initialStatus = await pingEdge(env, p, vaultValue);

  if (initialStatus !== 401) {
    return {
      pipeline: p.projectSecretName,
      initial_status: initialStatus,
      action: 'no_op',
      final_status: initialStatus,
      note: 'edge env matches vault',
    };
  }

  // 3. Drift detected — set project secret = vault value
  const setOk = await setProjectSecret(env, p.projectSecretName, vaultValue);
  if (!setOk) {
    return {
      pipeline: p.projectSecretName,
      initial_status: initialStatus,
      action: 'mgmt_failed',
      final_status: null,
      note: 'Supabase Management API set secret failed',
    };
  }

  // 4. Don't re-verify here — edge env reload takes ~20s and waiting in the
  // Worker would push past the CPU budget when both pipelines need syncing.
  // The next cron pass (30 min later) verifies; if still 401, action will be
  // recorded as another 'synced' attempt and an admin alert can be added if
  // we see consecutive sync attempts without resolution.
  return {
    pipeline: p.projectSecretName,
    initial_status: initialStatus,
    action: 'synced',
    final_status: null,
    note: 'project secret set from vault; verify on next pass',
  };
}

// ---------------------------------------------------------------------------
// Supabase REST: vault read
// ---------------------------------------------------------------------------

async function readVault(env: Env, name: string): Promise<string | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/rpc/get_vault_secret`);
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_name: name }),
  });
  if (!res.ok) {
    console.error('vault read failed', res.status, await res.text());
    return null;
  }
  const data = (await res.text()).trim();
  // RPC returns a bare string (PostgREST wraps in quotes)
  const value = data.startsWith('"') ? JSON.parse(data) : data;
  return value || null;
}

// ---------------------------------------------------------------------------
// Edge function ping (HEAD-equivalent: POST with auth, expect 401 or 2xx/4xx
// based on auth result, not on body)
// ---------------------------------------------------------------------------

async function pingEdge(env: Env, p: PipelineCheck, secret: string): Promise<number> {
  const url = `${env.SUPABASE_URL}/functions/v1/${p.functionPath}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [p.headerName]: secret,
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ __probe: true }),
      // 8s ceiling — we only need the status code, not the payload
      signal: AbortSignal.timeout(8_000),
    });
    return res.status;
  } catch (e) {
    console.error('ping failed', p.functionPath, e);
    // 0 = network/timeout; treat as not-401 so we don't trigger sync on a
    // transient blip
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Supabase Management API: set project secret
// ---------------------------------------------------------------------------

async function setProjectSecret(env: Env, name: string, value: string): Promise<boolean> {
  const url = `https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/secrets`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_MANAGEMENT_PAT}`,
      'Content-Type': 'application/json',
      'User-Agent': 'secret-sync-worker/1.0',
    },
    body: JSON.stringify([{ name, value }]),
  });
  if (!res.ok) {
    console.error('mgmt set secret failed', res.status, await res.text());
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

async function logToDb(env: Env, results: CheckResult[]): Promise<void> {
  const rows = results.map((r) => ({
    pipeline: r.pipeline,
    initial_status: r.initial_status,
    action: r.action,
    final_status: r.final_status,
    note: r.note,
  }));
  const url = `${env.SUPABASE_URL}/rest/v1/secret_sync_log`;
  await fetch(url, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
}

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

