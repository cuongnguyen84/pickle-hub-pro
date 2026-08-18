/**
 * x.ts — X (Twitter) adapter for the social-poster Worker
 *
 * Why this lives inside social-poster and not in its own Worker / Edge Function:
 *   - The FB pipeline already owns "read a queue, claim a row atomically, post,
 *     reply with the link, log the outcome". Duplicating that state machine in a
 *     Supabase Edge Function would give us two implementations of the same
 *     concurrency rules — the exact drift that caused the 2026-05-28 outage.
 *   - Deploy + secret ops stay in one place (`cd workers/social-poster && wrangler deploy`).
 *
 * Difference from the Facebook path — this one is NOT news-driven:
 *   Facebook auto-posts every eligible VI `news_items` row. X posts only what
 *   Cuong has explicitly approved in the `x_posts` queue (content_type =
 *   result | prediction | stat | blog_teaser, English, written for the "For you"
 *   ranking which weights reply/quote/repost above like). The Worker is a
 *   dumb, serialized drain of that queue — it never invents content.
 *
 * Per queued row:
 *   1. Claim `approved` → `posting` (compare-and-swap on status, so two
 *      concurrent cron ticks can never both publish the same row).
 *   2. Resolve a valid OAuth2 access token (refresh + persist when near expiry).
 *   3. POST /2/tweets { text }.
 *   4. `posted` + x_post_id. The canonical link is NOT in the body.
 *   5. A later pass (>= X_LINK_COMMENT_DELAY_SECONDS after posting) replies to
 *      that tweet with the link and flips the row to `link_commented`.
 *
 * Rows with no link_url are terminal at `posted`.
 */

import { notifyPosted, type NotifyEnv } from './notify';

export interface XEnv extends NotifyEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
  X_POST_MIN_GAP_MINUTES?: string;
  X_LINK_COMMENT_DELAY_SECONDS?: string;
  X_MAX_ATTEMPTS?: string;
}

export type XPostStatus =
  | 'draft'
  | 'approved'
  | 'posting'
  | 'posted'
  | 'link_commented'
  | 'failed';

export interface XPostRow {
  id: string;
  content_type: string;
  body: string;
  link_url: string | null;
  status: XPostStatus;
  x_post_id: string | null;
  x_comment_id: string | null;
  attempt_count: number;
  link_comment_attempt_count: number;
  scheduled_for: string | null;
  posted_at: string | null;
  updated_at: string | null;
}

interface XTokenRow {
  id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string | null;
}

const X_API = 'https://api.x.com/2';
const X_TOKEN_ID = 'thepicklehub';
const X_POST_SELECT =
  'id,content_type,body,link_url,status,x_post_id,x_comment_id,attempt_count,' +
  'link_comment_attempt_count,scheduled_for,posted_at,updated_at';
// A row stuck in 'posting' longer than this was orphaned by a crashed or
// timed-out invocation. Same guard as fb_post_log's stale-pending recovery:
// without it one bad tick deadlocks the queue forever.
const STALE_POSTING_MS = 10 * 60 * 1000;
// Refresh this far ahead of the stated expiry so a slow request can't land
// with a token that expired in flight.
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const DEFAULT_MIN_GAP_MINUTES = 90;
const DEFAULT_LINK_DELAY_SECONDS = 90;
const DEFAULT_MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * X counts a post in weighted characters, not code units: every URL costs a
 * flat 23 regardless of real length (t.co wrapping), and non-BMP characters
 * (emoji) cost 2. Counting `body.length` in JS would let a 280-char-looking
 * post get rejected by the API — or, worse, silently truncate our reasoning
 * about how much room a hashtag has.
 */
export function countXWeighted(text: string): number {
  let rest = text;
  let total = 0;
  const urlPattern = /https?:\/\/\S+/gi;
  const urls = rest.match(urlPattern) ?? [];
  total += urls.length * 23;
  rest = rest.replace(urlPattern, '');
  for (const char of rest) {
    // Astral-plane code points (emoji, most CJK extensions) weigh 2.
    total += char.codePointAt(0)! > 0xffff ? 2 : 1;
  }
  return total;
}

export interface XBodyCheck {
  ok: boolean;
  weighted: number;
  reason?: 'empty' | 'too_long' | 'contains_url';
}

/**
 * Anything X will turn into a t.co link, which is what the $0.200 surcharge is
 * keyed on — NOT just strings starting with a scheme. X linkifies a bare
 * `label.tld` too, so "thepicklehub.net" in prose bills exactly the same as
 * "https://thepicklehub.net". That is the whole trap in the spell-the-domain
 * policy: the cheap form ("thepicklehub dot net") and the 13x form differ by
 * one character, and the expensive one looks completely normal in review.
 *
 * The TLD half requires two or more letters, so scores and ratings ("11-9",
 * "3.5", "def. Staksrud" — space after the dot) do not match. A missing space
 * after a sentence ("year.The next") does match; that is a typo we are happy to
 * bounce, and every false positive fails in the direction that costs nothing.
 */
const URLISH = /https?:\/\/|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.[a-z]{2,24}\b/i;

/**
 * Validate a queued body BEFORE burning an API call — a rejection here is free,
 * whereas learning about it from X costs the request. Since 2026-08-16 a URL in
 * the body is a hard failure rather than the advisory warning it used to be:
 * links are no longer posted through the API at all (see the
 * `x_posts_no_link_url` CHECK), so a body that contains one is either a mistake
 * or a 13x bill nobody approved.
 */
export function checkXBody(body: string): XBodyCheck {
  const trimmed = body.trim();
  const weighted = countXWeighted(trimmed);
  if (!trimmed) return { ok: false, weighted, reason: 'empty' };
  if (weighted > 280) return { ok: false, weighted, reason: 'too_long' };
  if (URLISH.test(trimmed)) return { ok: false, weighted, reason: 'contains_url' };
  return { ok: true, weighted };
}

/**
 * 429 (rate limit) and 5xx are transient — the row goes back to `approved` and
 * the next cron tick retries it. Everything else (401 bad token, 403 duplicate
 * content / suspended app, 400 malformed) will fail identically on retry, so
 * the row is finalized to `failed` for a human to look at.
 */
export function isRetryableXStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function shouldRefreshToken(expiresAt: string, now = Date.now()): boolean {
  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) return true;
  return now >= expiry - TOKEN_REFRESH_SKEW_MS;
}

/** Reply body. Bare-URL-only replies read as spam; one emoji + link is enough. */
export function buildLinkReply(linkUrl: string): string {
  return `🔗 ${linkUrl}`;
}

export function xMinGapMinutes(env: XEnv): number {
  const raw = Number(env.X_POST_MIN_GAP_MINUTES);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_MIN_GAP_MINUTES;
}

export function xLinkDelaySeconds(env: XEnv): number {
  const raw = Number(env.X_LINK_COMMENT_DELAY_SECONDS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_LINK_DELAY_SECONDS;
}

export function xMaxAttempts(env: XEnv): number {
  const raw = Number(env.X_MAX_ATTEMPTS);
  return Number.isFinite(raw) && raw >= 1 ? raw : DEFAULT_MAX_ATTEMPTS;
}

export function xConfigured(env: XEnv): boolean {
  return !!env.X_CLIENT_ID && !!env.X_CLIENT_SECRET;
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

function restHeaders(env: XEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function readTokenRow(env: XEnv): Promise<XTokenRow> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/x_oauth_tokens`);
  url.searchParams.set('select', 'id,access_token,refresh_token,expires_at,updated_at');
  url.searchParams.set('id', `eq.${X_TOKEN_ID}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: restHeaders(env) });
  if (!res.ok) {
    throw new Error(`x_oauth_tokens read failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as XTokenRow[];
  if (!rows[0]) throw new Error('x_oauth_tokens has no row for thepicklehub');
  return rows[0];
}

/**
 * Resolve a usable access token, refreshing when it is within the skew window.
 *
 * X rotates the refresh token on every use: the old one dies the moment a
 * refresh succeeds. So the write-back is a compare-and-swap on `updated_at`,
 * and a lost CAS is not an error — it means a concurrent invocation already
 * refreshed, and its token is the live one. Losing that race and then blindly
 * writing our own values would resurrect a dead refresh token and lock the
 * pipeline out until Cuong re-authorizes by hand.
 */
export async function getValidAccessToken(env: XEnv): Promise<string> {
  const row = await readTokenRow(env);
  if (!shouldRefreshToken(row.expires_at)) return row.access_token;

  if (!xConfigured(env)) {
    throw new Error('X_CLIENT_ID / X_CLIENT_SECRET not configured — cannot refresh');
  }

  const basic = btoa(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`);
  const res = await fetch(`${X_API}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: row.refresh_token,
      client_id: env.X_CLIENT_ID!,
    }).toString(),
  });

  if (!res.ok) {
    // invalid_grant usually means someone else already rotated it. Re-read:
    // if the stored token moved on, use it instead of failing the tick.
    const detail = (await res.text()).slice(0, 300);
    const fresh = await readTokenRow(env);
    if (fresh.updated_at !== row.updated_at && !shouldRefreshToken(fresh.expires_at)) {
      return fresh.access_token;
    }
    throw new Error(`x token refresh failed: ${res.status} ${detail}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };
  const patch = new URL(`${env.SUPABASE_URL}/rest/v1/x_oauth_tokens`);
  patch.searchParams.set('id', `eq.${X_TOKEN_ID}`);
  if (row.updated_at) patch.searchParams.set('updated_at', `eq.${row.updated_at}`);
  const patchRes = await fetch(patch.toString(), {
    method: 'PATCH',
    headers: { ...restHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!patchRes.ok) {
    throw new Error(`x_oauth_tokens write failed: ${patchRes.status} ${await patchRes.text()}`);
  }
  const written = (await patchRes.json()) as XTokenRow[];
  if (written.length === 0) {
    // Lost the CAS — a concurrent refresh won. Its token is authoritative.
    console.warn('x token CAS lost — using concurrently refreshed token');
    return (await readTokenRow(env)).access_token;
  }
  return data.access_token;
}

async function patchXPost(
  env: XEnv,
  id: string,
  patch: Record<string, unknown>,
  guard?: { status: XPostStatus; updatedAt?: string | null },
): Promise<XPostRow[]> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/x_posts`);
  url.searchParams.set('id', `eq.${id}`);
  if (guard) {
    url.searchParams.set('status', `eq.${guard.status}`);
    // A guard whose updated_at is missing would silently degrade to a
    // status-only filter — fine when the status itself changes, fatal for a
    // posting→failed transition where both sides read the same status.
    if (guard.updatedAt) url.searchParams.set('updated_at', `eq.${guard.updatedAt}`);
    else if (guard.status === 'posting') throw new Error('posting guard requires updated_at');
  }
  url.searchParams.set('select', X_POST_SELECT);
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { ...restHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`x_posts patch failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as XPostRow[];
}

async function selectXPosts(env: XEnv, apply: (url: URL) => void): Promise<XPostRow[]> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/x_posts`);
  url.searchParams.set('select', X_POST_SELECT);
  apply(url);
  const res = await fetch(url.toString(), { headers: restHeaders(env) });
  if (!res.ok) {
    throw new Error(`x_posts query failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as XPostRow[];
}

/** True when enough time has passed since the last published X post. */
async function xGapOk(env: XEnv): Promise<boolean> {
  const gap = xMinGapMinutes(env);
  if (gap === 0) return true;
  const rows = await selectXPosts(env, (url) => {
    url.searchParams.set('status', 'in.(posted,link_commented)');
    url.searchParams.set('posted_at', 'not.is.null');
    url.searchParams.set('order', 'posted_at.desc');
    url.searchParams.set('limit', '1');
  });
  const last = rows[0]?.posted_at;
  if (!last) return true;
  return Date.now() - new Date(last).getTime() >= gap * 60_000;
}

/**
 * Next row to publish: the earliest scheduled approved row that is due.
 * Unscheduled rows sort first so a "post this whenever" draft never starves
 * behind future-dated ones.
 *
 * Deliberately never returns a `posting` row. The Facebook path re-claims
 * stale rows because a duplicate Page post is cheap to delete; a duplicate
 * tweet is not, and a row wedged in `posting` is exactly the case where we
 * cannot tell whether the tweet went out. Those rows are quarantined instead
 * (see quarantineStalePosting) for a human to check against the timeline.
 */
async function pickNextXPost(env: XEnv): Promise<XPostRow | null> {
  const nowIso = new Date().toISOString();
  const approved = await selectXPosts(env, (url) => {
    url.searchParams.set('status', 'eq.approved');
    url.searchParams.set('or', `(scheduled_for.is.null,scheduled_for.lte.${nowIso})`);
    url.searchParams.set('order', 'scheduled_for.asc.nullsfirst,created_at.asc');
    url.searchParams.set('limit', '1');
  });
  return approved[0] ?? null;
}

/**
 * Move rows abandoned mid-publish out of `posting` so they stop occupying the
 * queue, WITHOUT republishing them. `failed` here means "unknown outcome —
 * check x.com/thepicklehub before requeueing", which the error message says.
 */
async function quarantineStalePosting(env: XEnv): Promise<Record<string, unknown> | null> {
  const staleCutoff = new Date(Date.now() - STALE_POSTING_MS).toISOString();
  const stale = await selectXPosts(env, (url) => {
    url.searchParams.set('status', 'eq.posting');
    url.searchParams.set('updated_at', `lt.${staleCutoff}`);
    url.searchParams.set('order', 'updated_at.asc');
    url.searchParams.set('limit', '1');
  });
  const row = stale[0];
  if (!row) return null;
  const patched = await patchXPost(
    env,
    row.id,
    {
      status: 'failed',
      error_message:
        'stuck_in_posting: invocation died mid-publish. Check the X timeline — ' +
        'the tweet may be live. Do NOT set status back to approved before checking.',
    },
    { status: 'posting', updatedAt: row.updated_at },
  );
  if (patched.length === 0) return null;
  return { post_id: row.id, quarantined: true, reason: 'stuck_in_posting' };
}

// ---------------------------------------------------------------------------
// X API
// ---------------------------------------------------------------------------

interface XApiResult {
  ok: boolean;
  id?: string;
  status: number;
  error?: string;
}

async function postTweet(
  accessToken: string,
  text: string,
  replyTo?: string,
): Promise<XApiResult> {
  const payload: Record<string, unknown> = { text };
  if (replyTo) payload.reply = { in_reply_to_tweet_id: replyTo };

  let res: Response;
  try {
    res = await fetch(`${X_API}/tweets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Network failure — treat as retryable by reporting a 5xx-shaped result.
    return {
      ok: false,
      status: 599,
      error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    detail?: string;
    title?: string;
  };
  if (!res.ok || !data.data?.id) {
    return {
      ok: false,
      status: res.status,
      error: `X ${res.status}: ${(data.detail ?? data.title ?? JSON.stringify(data)).slice(0, 300)}`,
    };
  }
  return { ok: true, status: res.status, id: data.data.id };
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export interface XRunBody {
  post_id?: string;
  dry_run?: boolean;
}

/**
 * One tick of the X pipeline.
 *
 * Order matters: the link reply is attempted BEFORE publishing anything new.
 * A post whose link never landed is worth more than the next post in the
 * queue — the link comment is the whole conversion path.
 */
export async function handleXRun(
  env: XEnv,
  body: XRunBody,
): Promise<Record<string, unknown>> {
  if (!xConfigured(env)) {
    return { ok: false, skipped: true, reason: 'x_not_configured' };
  }

  const dryRun = body.dry_run === true;
  const results: Record<string, unknown>[] = [];

  if (!body.post_id) {
    if (!dryRun) {
      const quarantined = await quarantineStalePosting(env);
      if (quarantined) results.push(quarantined);
    }
    const comment = await drainLinkComment(env, dryRun);
    if (comment) results.push(comment);
  }

  const published = await publishNext(env, body, dryRun);
  results.push(published);

  return { ok: true, results };
}

async function publishNext(
  env: XEnv,
  body: XRunBody,
  dryRun: boolean,
): Promise<Record<string, unknown>> {
  let row: XPostRow | null;
  if (body.post_id) {
    const rows = await selectXPosts(env, (url) => {
      url.searchParams.set('id', `eq.${body.post_id}`);
      url.searchParams.set('limit', '1');
    });
    row = rows[0] ?? null;
    if (!row) return { skipped: true, reason: 'post_not_found', post_id: body.post_id };
    if (row.status !== 'approved' && row.status !== 'posting') {
      return { skipped: true, reason: `status_${row.status}`, post_id: row.id };
    }
  } else {
    row = await pickNextXPost(env);
    if (!row) return { skipped: true, reason: 'no_approved_post' };
  }

  const check = checkXBody(row.body);

  if (dryRun) {
    return {
      dry_run: true,
      post_id: row.id,
      content_type: row.content_type,
      body: row.body,
      weighted_length: check.weighted,
      valid: check.ok,
      reason: check.reason ?? null,
      link_reply: row.link_url ? buildLinkReply(row.link_url) : null,
    };
  }

  if (!check.ok) {
    await patchXPost(env, row.id, {
      status: 'failed',
      error_message: `invalid_body:${check.reason} (weighted ${check.weighted}/280)`,
    });
    return { posted: false, post_id: row.id, error: `invalid_body:${check.reason}` };
  }

  // A manual /x/run with an explicit post_id is a deliberate admin action and
  // bypasses the pacing gap; the cron path must respect it.
  if (!body.post_id && !(await xGapOk(env))) {
    return {
      deferred: true,
      post_id: row.id,
      reason: 'rate_limited',
      min_gap_minutes: xMinGapMinutes(env),
    };
  }

  const attempt = (row.attempt_count ?? 0) + 1;
  const claimed = await patchXPost(
    env,
    row.id,
    { status: 'posting', attempt_count: attempt },
    { status: row.status, updatedAt: row.updated_at },
  );
  if (claimed.length === 0) {
    return { skipped: true, post_id: row.id, reason: 'claim_lost' };
  }

  // Set the moment X accepts the tweet. Everything after that point is
  // bookkeeping about something that already happened in public, so the catch
  // below must never send the row back to `approved`.
  let publishedId: string | null = null;
  try {
    const accessToken = await getValidAccessToken(env);
    const result = await postTweet(accessToken, row.body.trim());

    if (!result.ok) {
      const retryable = isRetryableXStatus(result.status) && attempt < xMaxAttempts(env);
      await patchXPost(env, row.id, {
        status: retryable ? 'approved' : 'failed',
        error_message: result.error ?? `X ${result.status}`,
      });
      console.error('x post failed:', result.error);
      return {
        posted: false,
        post_id: row.id,
        status: result.status,
        will_retry: retryable,
        error: 'post_failed',
      };
    }

    publishedId = result.id!;
    await patchXPost(env, row.id, {
      status: 'posted',
      x_post_id: publishedId,
      posted_at: new Date().toISOString(),
      error_message: null,
    });
    const url = `https://x.com/thepicklehub/status/${publishedId}`;
    // Announced after the row is finalized, never before: a notification for a
    // post whose bookkeeping then failed is worse than no notification at all.
    await notifyPosted(env, {
      platform: 'X',
      account: '@thepicklehub',
      // The whole post, not its first line: an X post is at most 280
      // characters, so the notification can show exactly what went out.
      body: row.body,
      url,
    });
    return {
      posted: true,
      post_id: row.id,
      x_post_id: publishedId,
      url,
      link_reply_pending: !!row.link_url,
    };
  } catch (error) {
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);

    // The tweet is live and only the bookkeeping PATCH failed (Supabase 5xx,
    // Worker limit). Requeuing here would republish it, so retry the exact
    // same finalize instead. If that fails too the row stays `posting` and
    // quarantineStalePosting picks it up in 10 minutes — never a republish.
    if (publishedId) {
      try {
        await patchXPost(env, row.id, {
          status: 'posted',
          x_post_id: publishedId,
          posted_at: new Date().toISOString(),
          error_message: `finalize_retry_after: ${message}`,
        });
      } catch (retryError) {
        console.error('x finalize retry failed:', retryError, 'tweet id', publishedId);
      }
      return { posted: true, post_id: row.id, x_post_id: publishedId, finalize_error: true };
    }

    // Nothing was published — the failure happened while resolving the token
    // or in flight. Safe to requeue.
    await patchXPost(env, row.id, {
      status: attempt < xMaxAttempts(env) ? 'approved' : 'failed',
      error_message: message,
    });
    console.error('x post threw:', message);
    return { posted: false, post_id: row.id, error: 'post_failed' };
  }
}

/**
 * Reply the canonical link to the oldest posted row that is past the delay.
 * Returns null when nothing is due — the caller then just publishes.
 */
async function drainLinkComment(
  env: XEnv,
  dryRun: boolean,
): Promise<Record<string, unknown> | null> {
  const cutoff = new Date(Date.now() - xLinkDelaySeconds(env) * 1000).toISOString();
  const rows = await selectXPosts(env, (url) => {
    url.searchParams.set('status', 'eq.posted');
    url.searchParams.set('link_url', 'not.is.null');
    url.searchParams.set('x_post_id', 'not.is.null');
    url.searchParams.set('posted_at', `lte.${cutoff}`);
    url.searchParams.set('link_comment_attempt_count', `lt.${xMaxAttempts(env)}`);
    url.searchParams.set('order', 'posted_at.asc');
    url.searchParams.set('limit', '1');
  });
  const row = rows[0];
  if (!row?.x_post_id || !row.link_url) return null;

  const text = buildLinkReply(row.link_url);
  if (dryRun) {
    return { dry_run: true, post_id: row.id, x_post_id: row.x_post_id, link_reply: text };
  }

  const attempts = row.link_comment_attempt_count ?? 0;
  try {
    const accessToken = await getValidAccessToken(env);
    const result = await postTweet(accessToken, text, row.x_post_id);
    if (!result.ok) {
      // Only a permanent error burns an attempt. X's write limit is a
      // 15-minute window and the cron ticks every 5, so three consecutive
      // 429s is a routine afternoon — spending the retry budget on them would
      // silently drop the link reply, and with no URL in the post body that
      // leaves the post with no conversion path at all.
      const permanent = !isRetryableXStatus(result.status);
      await patchXPost(env, row.id, {
        ...(permanent ? { link_comment_attempt_count: attempts + 1 } : {}),
        link_comment_error: result.error ?? `X ${result.status}`,
      });
      console.error('x link reply failed:', result.error);
      return {
        post_id: row.id,
        link_comment: 'failed',
        attempts: permanent ? attempts + 1 : attempts,
        will_retry: !permanent || attempts + 1 < xMaxAttempts(env),
      };
    }
    await patchXPost(env, row.id, {
      status: 'link_commented',
      x_comment_id: result.id,
      link_commented_at: new Date().toISOString(),
      link_comment_attempt_count: attempts + 1,
      link_comment_error: null,
    });
    return { post_id: row.id, link_comment: 'posted', x_comment_id: result.id };
  } catch (error) {
    // Token/Supabase failure — infrastructure, not this row. Record it, keep
    // the attempt budget for genuine X rejections.
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await patchXPost(env, row.id, { link_comment_error: message });
    console.error('x link reply threw:', message);
    return { post_id: row.id, link_comment: 'failed', attempts, will_retry: true };
  }
}

/**
 * /health?deep=1 — token usable, queue depth, and how many published posts are
 * still missing their link reply. That last number is the one that matters:
 * a post with no URL in the body and no reply has no conversion path, and
 * nothing else in the system would surface it.
 *
 * /health is unauthenticated (it is what the uptime monitor hits), so this
 * returns states and counts only — never a Supabase or X error body.
 */
/**
 * Most recent token-related failure recorded against a post, or null.
 *
 * Read-only and cheap. Deliberately NOT a live credential check: the only way
 * to prove the client secret works is to spend the refresh token, and X rotates
 * it on use — a health endpoint that consumes the credential it is testing
 * would take the pipeline down every time someone polled it.
 */
async function lastTokenError(env: XEnv): Promise<string | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/x_posts`);
  url.searchParams.set('select', 'error_message,updated_at');
  url.searchParams.set('error_message', 'ilike.*token*');
  url.searchParams.set('order', 'updated_at.desc');
  url.searchParams.set('limit', '1');
  try {
    const res = await fetch(url.toString(), { headers: restHeaders(env) });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ error_message: string | null }>;
    return rows[0]?.error_message?.slice(0, 200) ?? null;
  } catch {
    return null;
  }
}

export async function xHealth(env: XEnv): Promise<Record<string, unknown>> {
  if (!xConfigured(env)) return { configured: false };
  try {
    const row = await readTokenRow(env);
    const queued = await selectXPosts(env, (url) => {
      url.searchParams.set('status', 'eq.approved');
      url.searchParams.set('select', 'id');
      url.searchParams.set('limit', '100');
    });
    const overdueCutoff = new Date(Date.now() - 60 * 60_000).toISOString();
    const overdue = await selectXPosts(env, (url) => {
      url.searchParams.set('select', 'id');
      url.searchParams.set('status', 'eq.posted');
      url.searchParams.set('link_url', 'not.is.null');
      url.searchParams.set('posted_at', `lt.${overdueCutoff}`);
      url.searchParams.set('limit', '100');
    });
    // The most recent token failure, surfaced rather than left in a row nobody
    // reads. `configured: true` only ever meant "both variables are non-empty",
    // and it reported healthy through two separate outages in two days — once
    // when `wrangler secret put` stored an empty string, once when the stored
    // client secret no longer matched the one X expected. Neither was visible
    // here; both were sitting in x_posts.error_message the whole time.
    const tokenError = await lastTokenError(env);

    return {
      configured: true,
      token_expires_at: row.expires_at,
      token_needs_refresh: shouldRefreshToken(row.expires_at),
      ...(tokenError ? { last_token_error: tokenError } : {}),
      approved_queue: queued.length,
      link_reply_overdue: overdue.length,
    };
  } catch (error) {
    console.error('x health check failed:', error);
    return { configured: true, error: 'x_health_unavailable' };
  }
}
