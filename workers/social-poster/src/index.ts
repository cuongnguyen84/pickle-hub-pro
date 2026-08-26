/**
 * social-poster — Cloudflare Worker
 *
 * Auto-posts new VI news items from Supabase `news_items` to the
 * ThePickleHub Facebook Page.
 *
 * Endpoints:
 *   POST /            Supabase DB Webhook payload (table=news_items, INSERT/UPDATE)
 *   POST /run         Manual trigger; body { news_item_id?: string, dry_run?: boolean }
 *   POST /x/run       X (Twitter) queue drain; body { post_id?: string, dry_run?: boolean }
 *                     See src/x.ts — separate queue (x_posts), separate cadence,
 *                     English copy approved by hand. Shares only auth + ops here.
 *
 * Auth: All POSTs require header X-Auth-Secret = $SOCIAL_POSTER_SECRET.
 * NOTE: this is a DEDICATED secret, separate from the news-translate
 * pipeline's SCRAPER_AUTH_SECRET. Do not merge them — sharing one secret
 * across both pipelines caused the 2026-05-28 drift outage.
 * For Supabase DB Webhooks, configure a custom header with that name+value
 * in the Webhook settings UI.
 *
 * Pipeline per news_item:
 *   1. Validate eligibility (language='vi', ai_translated=true, status='published').
 *   2. Check fb_post_log — if already posted, skip; if failed, retry (UPDATE row).
 *   3. Rate limit — if last 'posted' row < FB_POST_MIN_GAP_MINUTES ago, defer (202).
 *   4. Gemini generates VN caption per the pickleball-social-content skill spec.
 *   5. POST Graph API /{page-id}/feed (text + link). With image_url, use /photos.
 *   6. Upsert fb_post_log with status='posted' or 'failed'.
 *
 * Idempotency:
 *   fb_post_log.news_item_id is UNIQUE. UPSERT ON CONFLICT DO UPDATE on retries.
 *   If Supabase fires the webhook twice for the same row, second call will see
 *   status='posted' and short-circuit.
 *
 * Dry-run:
 *   POST /run with { dry_run: true } returns the generated caption + the
 *   exact Graph API payload that WOULD be sent, without calling FB. Used to
 *   review Gemini output before enabling the production webhook.
 */

import { handleXRun, xHealth, type XRunBody } from './x';
import { handleXDraft, type XDraftBody } from './x-draft';
import { isPromotionalSource } from './promo-filter';
import { notifyPosted } from './notify';

export interface Env {
  // vars
  SUPABASE_URL: string;
  SITE_URL: string;
  FB_GRAPH_VERSION: string;
  FB_POST_MIN_GAP_MINUTES: string;
  FB_MAX_ITEM_AGE_DAYS?: string;
  GEMINI_MODEL: string;
  FB_SECONDARY_PAGE_ID?: string;
  FB_SECONDARY_START_AT?: string;
  // secrets
  SUPABASE_SERVICE_ROLE_KEY: string;
  SOCIAL_POSTER_SECRET: string;
  SOCIAL_POSTER_ADMIN_SECRET?: string;
  FB_PAGE_ID: string;
  FB_PAGE_ACCESS_TOKEN: string;
  FB_SECONDARY_PAGE_ACCESS_TOKEN?: string;
  GEMINI_API_KEY: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  // X (Twitter) — vars
  X_POST_MIN_GAP_MINUTES?: string;
  X_LINK_COMMENT_DELAY_SECONDS?: string;
  X_MAX_ATTEMPTS?: string;
  // X (Twitter) — secrets. Absent ⇒ /x/run reports x_not_configured and the
  // Facebook pipeline is untouched.
  X_CLIENT_ID?: string;
  X_CLIENT_SECRET?: string;
}

interface NewsItem {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  content_html: string | null;
  image_url: string | null;
  language: string;
  category: string | null;
  importance: number;
  status: string;
  ai_translated: boolean;
  source_id: string | null;
  published_at: string | null;
  parent_news_id: string | null;
}

interface FbPostLogRow {
  id: string;
  news_item_id: string;
  page_id: string;
  page_key: string;
  status: 'pending' | 'posted' | 'failed' | 'skipped';
  attempt_count: number;
  posted_at: string | null;
  updated_at: string | null;
  fb_post_id: string | null;
  link_comment_status: 'pending' | 'posted' | 'failed' | 'skipped' | null;
  link_comment_attempt_count: number;
}

interface FacebookPage {
  key: string;
  id: string;
  accessToken: string;
  startAt: string | null;
}

// A 'pending' row older than this is considered orphaned (the Worker that
// claimed it crashed/timed out before finalizing) and may be re-claimed.
const STALE_PENDING_MS = 10 * 60 * 1000;
const FACEBOOK_TIME_ZONE = 'Asia/Ho_Chi_Minh';
/**
 * How old a news item may be and still be worth posting.
 *
 * Not a preference — a defect fix. The queue is fed by news-rewrite, and
 * recovering a failed origin creates a *new* news_items row carrying the
 * *original* published_at. So repairing a week-old article manufactures a
 * fresh-looking candidate for a stale story, and on 2026-08-17 that put
 * 7-to-10-day-old posts on both pages: rows created at 11:30 today for
 * articles published on the 7th.
 *
 * A one-off sweep cannot hold this, because the next repair run creates more.
 * The filter has to live at selection time, which is here.
 */
/** The later of a page's start date and the staleness cutoff; either may be null. */
export function laterOf(startAt: string | null, ageCutoff: string): string {
  return startAt && startAt > ageCutoff ? startAt : ageCutoff;
}

export function facebookMaxItemAgeDays(env: Env): number {
  const raw = Number(env.FB_MAX_ITEM_AGE_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 3;
}

const FACEBOOK_START_HOUR = 7;
const FACEBOOK_END_HOUR = 20;

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: Record<string, unknown>;
  old_record: Record<string, unknown> | null;
}

interface RunBody {
  news_item_id?: string;
  dry_run?: boolean;
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      const pages = configuredPages(env);
      const deep = url.searchParams.get('deep') === '1';
      return json({
        ok: true,
        name: 'social-poster',
        pages: deep
          ? await verifyFacebookPages(env, pages)
          : pages.map((page) => ({ key: page.key, id: page.id, start_at: page.startAt })),
        x: deep ? await xHealth(env) : { configured: !!env.X_CLIENT_ID },
      });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Auth — all POST endpoints share the same secret.
    const provided = req.headers.get('X-Auth-Secret') ?? '';
    const cronAuth = !!env.SOCIAL_POSTER_SECRET && provided === env.SOCIAL_POSTER_SECRET;
    const adminAuth = !!env.SOCIAL_POSTER_ADMIN_SECRET &&
      provided === env.SOCIAL_POSTER_ADMIN_SECRET;
    const serviceAuth = !!env.SUPABASE_SERVICE_ROLE_KEY &&
      provided === env.SUPABASE_SERVICE_ROLE_KEY;
    if (!cronAuth && !adminAuth && !serviceAuth) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      if (url.pathname === '/run') {
        const body = (await safeJson(req)) as RunBody;
        return await handleRun(env, body);
      }
      if (url.pathname === '/x/run') {
        const body = (await safeJson(req)) as XRunBody;
        return json(await handleXRun(env, body));
      }
      if (url.pathname === '/x/draft') {
        const body = (await safeJson(req)) as XDraftBody;
        return json(await handleXDraft(env, body));
      }
      if (url.pathname === '/' || url.pathname === '') {
        const body = (await safeJson(req)) as SupabaseWebhookPayload;
        return await handleWebhook(env, body);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      // Log full detail server-side (wrangler tail), generic message to
      // client (CodeQL: avoid leaking error path info to callers).
      const message = err instanceof Error ? err.message : String(err);
      console.error('social-poster fatal:', message);
      return json({ error: 'Internal server error' }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Webhook handler — auto trigger from Supabase DB Webhook
// ---------------------------------------------------------------------------

async function handleWebhook(env: Env, payload: SupabaseWebhookPayload): Promise<Response> {
  if (!payload || payload.table !== 'news_items') {
    return json({ skipped: true, reason: 'wrong_table' });
  }
  if (payload.type !== 'INSERT' && payload.type !== 'UPDATE') {
    return json({ skipped: true, reason: 'wrong_type' });
  }

  const record = payload.record as unknown as NewsItem;
  return json(await processNewsItem(env, configuredPages(env)[0], record, false));
}

async function verifyFacebookPages(env: Env, pages: FacebookPage[]) {
  return await Promise.all(pages.map(async (page) => {
    const url = new URL(
      `https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${page.id}`,
    );
    url.searchParams.set('fields', 'id,name');
    url.searchParams.set('access_token', page.accessToken);
    try {
      const res = await fetch(url.toString());
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        name?: string;
        error?: { code?: number; type?: string };
      };
      return {
        key: page.key,
        id: page.id,
        start_at: page.startAt,
        token_valid: res.ok && data.id === page.id,
        resolved_name: data.name ?? null,
        error_code: data.error?.code ?? null,
        error_type: data.error?.type ?? null,
      };
    } catch {
      return {
        key: page.key,
        id: page.id,
        start_at: page.startAt,
        token_valid: false,
        resolved_name: null,
        error_code: null,
        error_type: 'network_error',
      };
    }
  }));
}

export function configuredPages(env: Env): FacebookPage[] {
  const pages: FacebookPage[] = [{
    key: 'thepicklehub',
    id: env.FB_PAGE_ID,
    accessToken: env.FB_PAGE_ACCESS_TOKEN,
    startAt: null,
  }];
  if (env.FB_SECONDARY_PAGE_ID && env.FB_SECONDARY_PAGE_ACCESS_TOKEN) {
    pages.push({
      key: 'ta-pickleball',
      id: env.FB_SECONDARY_PAGE_ID,
      accessToken: env.FB_SECONDARY_PAGE_ACCESS_TOKEN,
      startAt: env.FB_SECONDARY_START_AT ?? null,
    });
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Manual /run handler — admin trigger + dry-run preview
// ---------------------------------------------------------------------------

async function handleRun(env: Env, body: RunBody): Promise<Response> {
  const dryRun = body.dry_run === true;
  const pages = configuredPages(env);
  const results: unknown[] = [];

  for (const page of pages) {
    if (!dryRun && !body.news_item_id) {
      const retried = await retryLinkComment(env, page);
      if (retried) {
        results.push(retried);
        continue;
      }
    }

    const item = body.news_item_id
      ? await fetchNewsItemById(env, body.news_item_id)
      : await pickNextNewsItem(env, page);
    if (!item) {
      results.push({ page_key: page.key, skipped: true, reason: 'no_eligible_item' });
      continue;
    }
    results.push(await processNewsItem(env, page, item, dryRun));
  }

  return json({ ok: true, results });
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

async function processNewsItem(
  env: Env,
  page: FacebookPage,
  item: NewsItem,
  dryRun: boolean,
): Promise<Record<string, unknown>> {
  // 1. Eligibility
  const reason = checkEligible(item);
  if (reason) {
    return { page_key: page.key, skipped: true, news_item_id: item?.id ?? null, reason };
  }

  // 2. Dry-run path: preview caption without claiming the log row.
  // Multiple concurrent dry-runs do not produce side effects, so we skip
  // the atomic claim that the real pipeline needs below.
  if (dryRun) {
    const caption = await generateCaption(env, item);
    const link = buildNewsLink(env, item);
    const fbPayload = buildFbPayload(item, caption);
    return {
      dry_run: true,
      page_key: page.key,
      page_id: page.id,
      news_item_id: item.id,
      slug: item.slug,
      link,
      caption,
      fb_payload: fbPayload,
      first_comment: buildLinkComment(link),
    };
  }

  // Real Facebook publishing is restricted to daytime in Vietnam. Items
  // crawled/translated overnight remain eligible and unclaimed, so the
  // catch-up cron drains them gradually after 07:00 instead of dropping or
  // bursting them during the night.
  if (!isFacebookPostingWindow()) {
    return {
      deferred: true,
      page_key: page.key,
      news_item_id: item.id,
      reason: 'outside_posting_window',
      posting_window: '07:00-20:00 Asia/Ho_Chi_Minh',
    };
  }

  // 3. Rate limit — best-effort pre-check before the claim. Cheap, and avoids
  // burning the per-row claim slot when we already know we'll defer.
  const gapOk = await checkRateLimit(env, page.id);
  if (!gapOk) {
    return {
        deferred: true,
        page_key: page.key,
        news_item_id: item.id,
        reason: 'rate_limited',
        min_gap_minutes: Number(env.FB_POST_MIN_GAP_MINUTES),
    };
  }

  // 4. Atomic claim on fb_post_log — only one concurrent invocation may
  // proceed past this line for any given news_item_id. Prevents Supabase
  // duplicate webhooks from producing duplicate FB posts.
  const claim = await claimFbPostLog(env, page, item.id);
  if (!claim.claimed) {
    return {
      page_key: page.key,
      skipped: true,
      news_item_id: item.id,
      reason: claim.conflict === 'posted' ? 'already_posted' : 'in_progress',
    };
  }

  const attemptCount = claim.row?.attempt_count ?? 1;

  // 5-7. Caption + post. CRITICAL: everything from here on must be wrapped so
  // a thrown error (e.g. Gemini/social-caption failure) ALWAYS finalizes the
  // claimed row to 'failed'. Otherwise the row stays 'pending' forever and
  // blocks the catchup queue (pickNextNewsItem keeps re-picking it, claim
  // keeps reporting in_progress → deadlock). This was the root cause of the
  // 2026-05-28 outage where posting stopped for ~2 days.
  let caption = '';
  try {
    // 5. Generate caption via social-caption Edge Function (Gemini proxy)
    caption = await generateCaption(env, item);

    // 6. Build Graph API payload
    const link = buildNewsLink(env, item);
    const fbPayload = buildFbPayload(item, caption);

    // 7. Post to FB
    const fbResult = await postToFacebook(env, page, fbPayload);
    const postedId = fbResult?.post_id ?? fbResult?.id ?? null;
    if (!postedId) {
      throw new Error(`Graph API returned no post id: ${JSON.stringify(fbResult)}`);
    }

    const permalink = `https://www.facebook.com/${page.id}/posts/${
      postedId.split('_')[1] ?? postedId
    }`;
    await upsertFbPostLog(env, {
      news_item_id: item.id,
      page_id: page.id,
      page_key: page.key,
      caption,
      status: 'posted',
      attempt_count: attemptCount,
      fb_post_id: postedId,
      fb_permalink: permalink,
      raw_response: fbResult,
      posted_at: new Date().toISOString(),
      error_message: null,
      link_comment_status: 'pending',
    });

    const comment = await publishLinkComment(env, page, postedId, link);
    // App CTA as its own comment. Best effort and untracked: the article link
    // is the one the caption promised, and losing the pitch is not worth
    // failing or retrying a post that is already live.
    const appComment = await publishLinkComment(env, page, postedId, buildAppComment());
    if (appComment.status !== 'posted') {
      console.warn('[social-poster] app CTA comment failed:', appComment.error);
    }
    await notifyPosted(env, {
      platform: 'Facebook',
      account: page.key,
      body: item.title,
      url: `https://facebook.com/${postedId}`,
    });
    await updateLinkComment(env, page.id, item.id, comment, 1);
    return {
      posted: true,
      page_key: page.key,
      news_item_id: item.id,
      fb_post_id: postedId,
      permalink,
      link_comment: comment.status,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Finalize to 'failed' so the row is no longer pending. The catchup cron
    // will retry it later (claimFbPostLog re-claims failed rows), and stale
    // pending recovery covers the case where this update itself fails.
    await upsertFbPostLog(env, {
      news_item_id: item.id,
      page_id: page.id,
      page_key: page.key,
      caption,
      status: 'failed',
      attempt_count: attemptCount,
      error_message: errMsg.slice(0, 500),
    });
    // Generic error in the HTTP body (CodeQL stack-trace-exposure) — full
    // detail is in the fb_post_log row above + wrangler tail.
    console.error('social-poster post failed:', errMsg);
    return { posted: false, page_key: page.key, news_item_id: item.id, error: 'post_failed' };
  }
}

export function isFacebookPostingWindow(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FACEBOOK_TIME_ZONE,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? -1);
  return hour >= FACEBOOK_START_HOUR && hour < FACEBOOK_END_HOUR;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

function checkEligible(item: NewsItem | null | undefined): string | null {
  if (!item) return 'no_item';
  if (item.language !== 'vi') return 'not_vi';
  if (!item.ai_translated) return 'not_translated';
  if (item.status !== 'published') return 'not_published';
  // Defence for the webhook entry point, which does not go through pickNext.
  if (isPromotionalSource(item.title, item.summary, null, item.category)) {
    return 'promotional_source';
  }
  if (!item.title || item.title.trim().length === 0) return 'no_title';
  if (!item.slug || item.slug.trim().length === 0) return 'no_slug';
  return null;
}

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

async function checkRateLimit(env: Env, pageId: string): Promise<boolean> {
  const gapMinutes = Math.max(0, Number(env.FB_POST_MIN_GAP_MINUTES) || 0);
  if (gapMinutes === 0) return true;

  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('select', 'posted_at');
  url.searchParams.set('status', 'eq.posted');
  url.searchParams.set('page_id', `eq.${pageId}`);
  url.searchParams.set('order', 'posted_at.desc');
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    headers: supabaseRestHeaders(env),
  });
  if (!res.ok) {
    console.error('rate_limit_query_failed', res.status, await res.text());
    return true; // fail open — don't block on infra hiccup
  }
  const rows = (await res.json()) as Array<{ posted_at: string | null }>;
  const last = rows[0]?.posted_at;
  if (!last) return true;
  const elapsedMs = Date.now() - new Date(last).getTime();
  return elapsedMs >= gapMinutes * 60_000;
}

// ---------------------------------------------------------------------------
// Supabase REST helpers
// ---------------------------------------------------------------------------

function supabaseRestHeaders(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function fetchNewsItemById(env: Env, id: string): Promise<NewsItem> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/news_items`);
  url.searchParams.set('select', '*');
  url.searchParams.set('id', `eq.${id}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: supabaseRestHeaders(env) });
  if (!res.ok) {
    throw new Error(`fetchNewsItemById ${id} failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as NewsItem[];
  if (!rows[0]) throw new Error(`news_item ${id} not found`);
  return rows[0];
}

async function pickNextNewsItem(env: Env, page: FacebookPage): Promise<NewsItem | null> {
  // Eligible VI rows that DON'T already have a terminal fb_post_log row.
  // 'posted' = done, 'skipped' = intentionally not posting (e.g. backlog the
  // admin chose to drop). PostgREST has no anti-join, so we fetch the
  // excluded ids separately.
  const doneUrl = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  doneUrl.searchParams.set('select', 'news_item_id');
  doneUrl.searchParams.set('status', 'in.(posted,skipped)');
  doneUrl.searchParams.set('page_id', `eq.${page.id}`);
  const postedRes = await fetch(doneUrl.toString(), { headers: supabaseRestHeaders(env) });
  if (!postedRes.ok) {
    throw new Error(`pickNext done query failed: ${postedRes.status} ${await postedRes.text()}`);
  }
  const postedRows = (await postedRes.json()) as Array<{ news_item_id: string }>;
  const postedIds = postedRows.map((r) => r.news_item_id);

  // The candidate window has to be large enough to contain an unposted row,
  // and "50" was not. Ordering is importance-first, so once 50 high-importance
  // items are done the window is permanently full of finished work and this
  // returns null on every call — the pipeline stops without failing. That is
  // what happened: 683 eligible rows, all 50 in the window already posted, the
  // waiting item sitting at rank 87 because its importance was 3.
  //
  // Scanning ids instead of `*` is what makes a big window affordable: the full
  // row carries content_html. Sizing it off the number of finished rows keeps
  // at least 50 unposted candidates in view no matter how the archive grows.
  //
  // ponytail: a bounded scan, not an anti-join. PostgREST cannot express one,
  // and `id=not.in.(...700 uuids)` is a 25KB URL. If the archive ever passes
  // the cap below, move this to an RPC that does the anti-join in SQL.
  const scanLimit = pickNextScanLimit(postedIds.length);
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/news_items`);
  // title/summary/category ride along so promotional rows can be dropped during
  // selection. Still no content_html, so the scan stays cheap.
  url.searchParams.set('select', 'id,title,summary,category');
  url.searchParams.set('language', 'eq.vi');
  url.searchParams.set('ai_translated', 'eq.true');
  url.searchParams.set('status', 'eq.published');
  // published_at has two lower bounds: when this page started posting at all,
  // and how stale an article may be. Take the later of the two.
  const ageCutoff = new Date(
    Date.now() - facebookMaxItemAgeDays(env) * 24 * 3600_000,
  ).toISOString();
  const floor = laterOf(page.startAt, ageCutoff);
  url.searchParams.set('published_at', `gte.${floor}`);
  url.searchParams.set('order', 'importance.desc,published_at.desc');
  url.searchParams.set('limit', String(scanLimit));
  const res = await fetch(url.toString(), { headers: supabaseRestHeaders(env) });
  if (!res.ok) {
    throw new Error(`pickNext news query failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{
    id: string;
    title: string;
    summary: string | null;
    category: string | null;
  }>;
  const done = new Set(postedIds);
  // Adverts are excluded here rather than in checkEligible on purpose. A
  // checkEligible rejection writes no fb_post_log row, so the item stays
  // unposted and gets picked again on the next tick — one paddle release at the
  // head of the queue would stall the whole pipeline, which is the same shape
  // as the bug this function was just fixed for.
  const nextId = rows.find(
    (r) => !done.has(r.id) && !isPromotionalSource(r.title, r.summary, null, r.category),
  )?.id;
  return nextId ? await fetchNewsItemById(env, nextId) : null;
}

/**
 * Exported for the test: given the priority-ordered ids and the finished ones,
 * which id is next? This is the whole of the bug that stalled Facebook, and it
 * is pure, so it can be checked without a database.
 */
export function pickNextId(
  orderedIds: string[],
  doneIds: string[],
  scanLimit: number,
): string | null {
  const done = new Set(doneIds);
  return orderedIds.slice(0, scanLimit).find((id) => !done.has(id)) ?? null;
}

export function pickNextScanLimit(doneCount: number): number {
  return Math.min(doneCount + 50, 2000);
}

async function fetchFbPostLogByNewsItem(
  env: Env,
  pageId: string,
  newsItemId: string,
): Promise<FbPostLogRow | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('select', 'id,news_item_id,page_id,page_key,status,attempt_count,posted_at,updated_at,fb_post_id,link_comment_status,link_comment_attempt_count');
  url.searchParams.set('news_item_id', `eq.${newsItemId}`);
  url.searchParams.set('page_id', `eq.${pageId}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: supabaseRestHeaders(env) });
  if (!res.ok) return null;
  const rows = (await res.json()) as FbPostLogRow[];
  return rows[0] ?? null;
}

interface FbPostLogUpsert {
  news_item_id: string;
  page_id: string;
  page_key: string;
  caption?: string;
  status: 'pending' | 'posted' | 'failed' | 'skipped';
  attempt_count: number;
  fb_post_id?: string;
  fb_permalink?: string;
  error_message?: string | null;
  raw_response?: unknown;
  posted_at?: string;
  link_comment_id?: string | null;
  link_comment_status?: 'pending' | 'posted' | 'failed' | 'skipped';
  link_comment_error?: string | null;
  link_comment_attempt_count?: number;
}

interface ClaimResult {
  // True if this invocation now owns the log row and must proceed to post.
  claimed: boolean;
  // Final row state after the claim attempt (null only when claim throws).
  row: FbPostLogRow | null;
  // Reason the claim was denied — set only when claimed=false.
  conflict: 'posted' | 'pending' | null;
}

/**
 * Atomic claim on fb_post_log for a given news_item_id.
 *
 * Behavior:
 *   - If no row exists → INSERT pending and return claimed=true.
 *   - If row exists with status='posted' → return claimed=false, conflict='posted'.
 *   - If row exists with status='pending' → return claimed=false, conflict='pending'
 *     (another invocation is mid-pipeline; let it finish).
 *   - If row exists with status in ('failed','skipped') → atomically PATCH to
 *     pending and bump attempt_count. If the PATCH affects 0 rows, another
 *     retry already grabbed it → return claimed=false, conflict='pending'.
 *
 * Relies on the UNIQUE(news_item_id) constraint on fb_post_log and uses
 * PostgREST `Prefer: resolution=ignore-duplicates` so the INSERT is a true
 * atomic claim (no merge / upsert race).
 */
async function claimFbPostLog(
  env: Env,
  page: FacebookPage,
  newsItemId: string,
): Promise<ClaimResult> {
  // Step 1 — try to atomically insert a fresh pending row.
  const insertUrl = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  insertUrl.searchParams.set('on_conflict', 'news_item_id,page_id');
  const insertRes = await fetch(insertUrl.toString(), {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(env),
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify({
      news_item_id: newsItemId,
      page_id: page.id,
      page_key: page.key,
      status: 'pending',
      attempt_count: 1,
    }),
  });
  if (!insertRes.ok) {
    throw new Error(
      `claimFbPostLog insert failed: ${insertRes.status} ${await insertRes.text()}`,
    );
  }
  const inserted = (await insertRes.json()) as FbPostLogRow[];
  if (inserted.length > 0) {
    return { claimed: true, row: inserted[0], conflict: null };
  }

  // Step 2 — insert was a no-op due to conflict. Inspect the existing row.
  const existing = await fetchFbPostLogByNewsItem(env, page.id, newsItemId);
  if (!existing) {
    // Should be unreachable: conflict was reported but row vanished. Treat as
    // pending to avoid double-posting.
    return { claimed: false, row: null, conflict: 'pending' };
  }
  if (existing.status === 'posted') {
    return { claimed: false, row: existing, conflict: 'posted' };
  }
  // 'skipped' is a terminal state — admin chose not to post this item
  // (e.g. dropped backlog). Never re-claim it. Treat like 'posted' for the
  // caller (won't post, won't error).
  if (existing.status === 'skipped') {
    return { claimed: false, row: existing, conflict: 'posted' };
  }

  // A genuinely in-progress pending row (claimed < STALE_PENDING_MS ago) must
  // be left alone so we don't double-post. But a STALE pending row was
  // orphaned by a crashed/timed-out invocation and must be re-claimable —
  // otherwise one stuck row deadlocks the whole catchup queue forever.
  if (existing.status === 'pending') {
    const updatedMs = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
    const isStale = Date.now() - updatedMs > STALE_PENDING_MS;
    if (!isStale) {
      return { claimed: false, row: existing, conflict: 'pending' };
    }
    // fall through to the retry-claim below, which is gated on the current
    // status so concurrent invocations can't both win.
  }

  // Step 3 — existing row is 'failed' OR stale-pending: take ownership for
  // retry. ('skipped' is handled above as terminal.) PATCH is filtered on
  // (id, status) so two concurrent retries can't both win.
  const claimableStatuses = existing.status === 'pending' ? 'pending' : 'failed';
  const retryUrl = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  retryUrl.searchParams.set('id', `eq.${existing.id}`);
  retryUrl.searchParams.set('status', `in.(${claimableStatuses})`);
  // For stale-pending, also require updated_at to still be old — guards
  // against a fresh invocation that updated the row between our read and PATCH.
  if (existing.status === 'pending' && existing.updated_at) {
    retryUrl.searchParams.set('updated_at', `eq.${existing.updated_at}`);
  }
  const retryRes = await fetch(retryUrl.toString(), {
    method: 'PATCH',
    headers: {
      ...supabaseRestHeaders(env),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: 'pending',
      attempt_count: existing.attempt_count + 1,
    }),
  });
  if (!retryRes.ok) {
    throw new Error(
      `claimFbPostLog retry update failed: ${retryRes.status} ${await retryRes.text()}`,
    );
  }
  const retried = (await retryRes.json()) as FbPostLogRow[];
  if (retried.length === 0) {
    // Another invocation grabbed the retry/recovery first.
    return { claimed: false, row: existing, conflict: 'pending' };
  }
  return { claimed: true, row: retried[0], conflict: null };
}

async function upsertFbPostLog(env: Env, row: FbPostLogUpsert): Promise<void> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('on_conflict', 'news_item_id,page_id');
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(env),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    console.error('upsertFbPostLog failed', res.status, await res.text());
  }
}

interface LinkCommentResult {
  status: 'posted' | 'failed';
  id?: string;
  error?: string;
}

const APP_STORE_URL =
  'https://apps.apple.com/vn/app/thepicklehub-tournaments/id6759968026?l=vi';

/**
 * Two separate comments, not one.
 *
 * They were combined at first, which meant Facebook rendered a single comment
 * carrying two links and gave neither its own preview. Split, each gets its own
 * card and the app pitch can be pinned or deleted without touching the article
 * link.
 *
 * Order is fixed and matters: the caption tells readers the link is in the
 * first comment — "đường dẫn ở bình luận đầu tiên" — so the article has to be
 * comment one, and the app CTA follows it.
 */
export function buildLinkComment(link: string): string {
  return link;
}

export function buildAppComment(): string {
  return (
    '📲 Tải app ThePickleHub: Tournaments để xem livestream và cập nhật tin tức ' +
    `pickleball mới nhất:\n${APP_STORE_URL}`
  );
}

async function publishLinkComment(
  env: Env,
  page: FacebookPage,
  postId: string,
  link: string,
): Promise<LinkCommentResult> {
  const url = `https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${postId}/comments`;
  const form = new URLSearchParams({
    message: buildLinkComment(link),
    access_token: page.accessToken,
  });
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; error?: unknown };
    if (!res.ok || data.error || !data.id) {
      return {
        status: 'failed',
        error: `Graph comment ${res.status}: ${JSON.stringify(data.error ?? data)}`.slice(0, 500),
      };
    }
    return { status: 'posted', id: data.id };
  } catch (error) {
    return {
      status: 'failed',
      error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
    };
  }
}

async function updateLinkComment(
  env: Env,
  pageId: string,
  newsItemId: string,
  result: LinkCommentResult,
  attemptCount: number,
): Promise<void> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('page_id', `eq.${pageId}`);
  url.searchParams.set('news_item_id', `eq.${newsItemId}`);
  const res = await fetch(url.toString(), {
    method: 'PATCH',
    headers: { ...supabaseRestHeaders(env), Prefer: 'return=minimal' },
    body: JSON.stringify({
      link_comment_status: result.status,
      link_comment_id: result.id ?? null,
      link_comment_error: result.error ?? null,
      link_comment_attempt_count: attemptCount,
    }),
  });
  if (!res.ok) console.error('updateLinkComment failed', res.status, await res.text());
}

async function retryLinkComment(
  env: Env,
  page: FacebookPage,
): Promise<Record<string, unknown> | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('select', 'id,news_item_id,page_id,page_key,status,attempt_count,posted_at,updated_at,fb_post_id,link_comment_status,link_comment_attempt_count');
  url.searchParams.set('page_id', `eq.${page.id}`);
  url.searchParams.set('status', 'eq.posted');
  url.searchParams.set('link_comment_status', 'in.(pending,failed)');
  url.searchParams.set('link_comment_attempt_count', 'lt.3');
  url.searchParams.set('fb_post_id', 'not.is.null');
  url.searchParams.set('order', 'updated_at.asc');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: supabaseRestHeaders(env) });
  if (!res.ok) throw new Error(`comment retry query failed: ${res.status} ${await res.text()}`);
  const log = ((await res.json()) as FbPostLogRow[])[0];
  if (!log?.fb_post_id) return null;

  const item = await fetchNewsItemById(env, log.news_item_id);
  const result = await publishLinkComment(env, page, log.fb_post_id, buildNewsLink(env, item));
  await updateLinkComment(
    env,
    page.id,
    item.id,
    result,
    (log.link_comment_attempt_count ?? 0) + 1,
  );
  return {
    page_key: page.key,
    news_item_id: item.id,
    post_already_existed: true,
    link_comment: result.status,
  };
}

// ---------------------------------------------------------------------------
// Gemini caption generation
// ---------------------------------------------------------------------------

/**
 * Caption generation. We proxy the Gemini call through the
 * `social-caption` Supabase Edge Function instead of calling Gemini directly
 * from this Worker because Gemini rejects requests from some Cloudflare-edge
 * IPs with FAILED_PRECONDITION "User location is not supported". Supabase
 * Edge Functions (Tokyo) are in the supported region — proven by
 * `news-translate` which uses the same Gemini API key.
 *
 * The Worker still owns the prompt format here (kept for parity), but only
 * uses it as a fallback if direct Gemini ever becomes possible. The Edge
 * Function holds the canonical prompt — keep both in sync.
 */
async function generateCaption(env: Env, item: NewsItem): Promise<string> {
  const link = buildNewsLink(env, item);
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/news-social-caption`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Secret': env.SOCIAL_POSTER_SECRET,
    },
    body: JSON.stringify({
      title: item.title,
      summary: item.summary,
      content_html: item.content_html,
      category: item.category,
      link,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`social-caption ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { caption?: string; model?: string; error?: string };
  if (data.error) throw new Error(`social-caption: ${data.error}`);
  if (!data.caption) throw new Error('social-caption returned empty caption');
  return sanitizeCaption(data.caption);
}

export function sanitizeCaption(text: string): string {
  // Strip code fences if Gemini wrapped in ```
  let out = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  // Strip leading "BÀI ĐĂNG FACEBOOK:" style headers if present.
  out = out.replace(/^📝?\s*BÀI ĐĂNG FACEBOOK.*$/im, '').trim();
  // The canonical URL is published as the first Page comment, never in the
  // main caption—even if a stale prompt or model response includes it.
  // Line scan instead of /^.*https?:\/\/\S+.*$/gim and /[ \t]+\n/g — both
  // anchored/repetition regexes are polynomial on adversarial input (CodeQL
  // js/polynomial-redos); per-line test + trimEnd() are linear.
  out = out
    .split('\n')
    .map((line) => (/https?:\/\//i.test(line) ? '🔗 Link bài viết ở bình luận đầu tiên.' : line.trimEnd()))
    .join('\n')
    .trim();
  // Collapse 3+ newlines.
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

// ---------------------------------------------------------------------------
// Facebook Graph API
// ---------------------------------------------------------------------------

function buildNewsLink(env: Env, item: NewsItem): string {
  return `${env.SITE_URL.replace(/\/$/, '')}/vi/news/${item.slug}`;
}

interface FbPayload {
  endpoint: 'feed' | 'photos';
  body: Record<string, string>;
}

export function buildFbPayload(item: NewsItem, caption: string): FbPayload {
  if (item.image_url && isContentImage(item.image_url)) {
    // Photo post — cover image embedded, caption goes in `caption`.
    return {
      endpoint: 'photos',
      body: {
        url: item.image_url,
        caption,
        published: 'true',
      },
    };
  }
  // Text-only post. The canonical article link is added as the first comment.
  return {
    endpoint: 'feed',
    body: {
      message: caption,
    },
  };
}

/**
 * Heuristic to reject image URLs that look like ads, promo banners, or
 * unrelated CDN assets pulled in by the news scraper. Returning false here
 * makes buildFbPayload fall back to a link post — FB then fetches og:image
 * from the canonical news page, which is usually the correct cover image.
 *
 * Tuning rule of thumb: if you see ads/discount banners on the Page, add
 * the offending pattern below. If FB shows the wrong og:image instead of a
 * real news photo, fix it upstream in news-fetcher (og:image extraction).
 */
function isContentImage(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  // Hostnames that almost never serve news cover images for pickleball.
  const blockedHosts = [
    'cdn.shopify.com',
    'shopify.com',
    'cdn.etsy.com',
    'i.etsystatic.com',
    'amazon.com',
    'images-na.ssl-images-amazon.com',
    'm.media-amazon.com',
    'doubleclick.net',
    'googletagmanager.com',
    'googlesyndication.com',
    'adservice.google.com',
  ];
  if (blockedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
    return false;
  }

  // Path-level keyword blacklist — promo/ads/storefront content.
  const blockedKeywords = [
    'discount',
    'promo',
    'coupon',
    'banner',
    '/ad-',
    'sponsor',
    'storefront',
    'product/',
    'logo',
    'favicon',
  ];
  if (blockedKeywords.some((k) => path.includes(k))) {
    return false;
  }
  // Match an actual `ads` path segment. A loose `ads/` substring also
  // matches WordPress' ubiquitous `/uploads/` directory and incorrectly
  // turns valid news photos into text-only Facebook posts.
  if (/(?:^|\/)ads(?:\/|$)/.test(path)) return false;

  // Reject obviously tiny assets (often icons, tracking pixels).
  if (/[?&](?:w|width)=([0-9]+)/.test(parsed.search)) {
    const m = parsed.search.match(/[?&](?:w|width)=([0-9]+)/);
    if (m && Number(m[1]) < 400) return false;
  }

  // Accept by default — only filter out the worst offenders.
  return true;
}

async function postToFacebook(
  env: Env,
  page: FacebookPage,
  payload: FbPayload,
): Promise<{ id?: string; post_id?: string; error?: unknown }> {
  const url = `https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${page.id}/${payload.endpoint}`;
  const form = new URLSearchParams(payload.body);
  form.set('access_token', page.accessToken);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  });
  const data = (await res.json().catch(() => ({}))) as {
    id?: string;
    post_id?: string;
    error?: unknown;
  };
  if (!res.ok || data.error) {
    throw new Error(`Graph API ${res.status}: ${JSON.stringify(data.error ?? data)}`);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
