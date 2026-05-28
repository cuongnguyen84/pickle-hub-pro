/**
 * social-poster — Cloudflare Worker
 *
 * Auto-posts new VI news items from Supabase `news_items` to the
 * ThePickleHub Facebook Page.
 *
 * Endpoints:
 *   POST /            Supabase DB Webhook payload (table=news_items, INSERT/UPDATE)
 *   POST /run         Manual trigger; body { news_item_id?: string, dry_run?: boolean }
 *
 * Auth: All POSTs require header X-Auth-Secret = $SCRAPER_AUTH_SECRET.
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

export interface Env {
  // vars
  SUPABASE_URL: string;
  SITE_URL: string;
  FB_GRAPH_VERSION: string;
  FB_POST_MIN_GAP_MINUTES: string;
  GEMINI_MODEL: string;
  // secrets
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCRAPER_AUTH_SECRET: string;
  FB_PAGE_ID: string;
  FB_PAGE_ACCESS_TOKEN: string;
  GEMINI_API_KEY: string;
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
  status: 'pending' | 'posted' | 'failed' | 'skipped';
  attempt_count: number;
  posted_at: string | null;
  updated_at: string | null;
}

// A 'pending' row older than this is considered orphaned (the Worker that
// claimed it crashed/timed out before finalizing) and may be re-claimed.
const STALE_PENDING_MS = 10 * 60 * 1000;

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
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true, name: 'social-poster' });
    }

    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    // Auth — all POST endpoints share the same secret.
    const provided = req.headers.get('X-Auth-Secret') ?? '';
    if (provided !== env.SCRAPER_AUTH_SECRET || !env.SCRAPER_AUTH_SECRET) {
      return json({ error: 'Unauthorized' }, 401);
    }

    try {
      if (url.pathname === '/run') {
        const body = (await safeJson(req)) as RunBody;
        return await handleRun(env, body);
      }
      if (url.pathname === '/' || url.pathname === '') {
        const body = (await safeJson(req)) as SupabaseWebhookPayload;
        return await handleWebhook(env, body);
      }
      return json({ error: 'Not found' }, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('social-poster fatal:', message);
      return json({ error: message }, 500);
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
  return await processNewsItem(env, record, false);
}

// ---------------------------------------------------------------------------
// Manual /run handler — admin trigger + dry-run preview
// ---------------------------------------------------------------------------

async function handleRun(env: Env, body: RunBody): Promise<Response> {
  const dryRun = body.dry_run === true;

  let item: NewsItem;
  if (body.news_item_id) {
    item = await fetchNewsItemById(env, body.news_item_id);
  } else {
    // Pick the most recent eligible item that has not yet been posted.
    item = await pickNextNewsItem(env);
  }

  return await processNewsItem(env, item, dryRun);
}

// ---------------------------------------------------------------------------
// Core pipeline
// ---------------------------------------------------------------------------

async function processNewsItem(env: Env, item: NewsItem, dryRun: boolean): Promise<Response> {
  // 1. Eligibility
  const reason = checkEligible(item);
  if (reason) {
    return json({ skipped: true, news_item_id: item?.id ?? null, reason });
  }

  // 2. Dry-run path: preview caption without claiming the log row.
  // Multiple concurrent dry-runs do not produce side effects, so we skip
  // the atomic claim that the real pipeline needs below.
  if (dryRun) {
    const caption = await generateCaption(env, item);
    const link = buildNewsLink(env, item);
    const fbPayload = buildFbPayload(item, caption, link);
    return json({
      dry_run: true,
      news_item_id: item.id,
      slug: item.slug,
      link,
      caption,
      fb_payload: fbPayload,
    });
  }

  // 3. Rate limit — best-effort pre-check before the claim. Cheap, and avoids
  // burning the per-row claim slot when we already know we'll defer.
  const gapOk = await checkRateLimit(env);
  if (!gapOk) {
    return json(
      {
        deferred: true,
        news_item_id: item.id,
        reason: 'rate_limited',
        min_gap_minutes: Number(env.FB_POST_MIN_GAP_MINUTES),
      },
      202,
    );
  }

  // 4. Atomic claim on fb_post_log — only one concurrent invocation may
  // proceed past this line for any given news_item_id. Prevents Supabase
  // duplicate webhooks from producing duplicate FB posts.
  const claim = await claimFbPostLog(env, item.id);
  if (!claim.claimed) {
    return json({
      skipped: true,
      news_item_id: item.id,
      reason: claim.conflict === 'posted' ? 'already_posted' : 'in_progress',
    });
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
    const fbPayload = buildFbPayload(item, caption, link);

    // 7. Post to FB
    const fbResult = await postToFacebook(env, fbPayload);
    const postedId = fbResult?.post_id ?? fbResult?.id ?? null;
    if (!postedId) {
      throw new Error(`Graph API returned no post id: ${JSON.stringify(fbResult)}`);
    }

    const permalink = `https://www.facebook.com/${env.FB_PAGE_ID}/posts/${
      postedId.split('_')[1] ?? postedId
    }`;
    await upsertFbPostLog(env, {
      news_item_id: item.id,
      caption,
      status: 'posted',
      attempt_count: attemptCount,
      fb_post_id: postedId,
      fb_permalink: permalink,
      raw_response: fbResult,
      posted_at: new Date().toISOString(),
    });
    return json({ posted: true, news_item_id: item.id, fb_post_id: postedId, permalink });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    // Finalize to 'failed' so the row is no longer pending. The catchup cron
    // will retry it later (claimFbPostLog re-claims failed rows), and stale
    // pending recovery covers the case where this update itself fails.
    await upsertFbPostLog(env, {
      news_item_id: item.id,
      caption,
      status: 'failed',
      attempt_count: attemptCount,
      error_message: errMsg.slice(0, 500),
    });
    return json({ posted: false, news_item_id: item.id, error: errMsg }, 500);
  }
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

function checkEligible(item: NewsItem | null | undefined): string | null {
  if (!item) return 'no_item';
  if (item.language !== 'vi') return 'not_vi';
  if (!item.ai_translated) return 'not_translated';
  if (item.status !== 'published') return 'not_published';
  if (!item.title || item.title.trim().length === 0) return 'no_title';
  if (!item.slug || item.slug.trim().length === 0) return 'no_slug';
  return null;
}

// ---------------------------------------------------------------------------
// Rate limit
// ---------------------------------------------------------------------------

async function checkRateLimit(env: Env): Promise<boolean> {
  const gapMinutes = Math.max(0, Number(env.FB_POST_MIN_GAP_MINUTES) || 0);
  if (gapMinutes === 0) return true;

  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('select', 'posted_at');
  url.searchParams.set('status', 'eq.posted');
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

async function pickNextNewsItem(env: Env): Promise<NewsItem> {
  // Eligible VI rows that DON'T have a 'posted' row in fb_post_log yet.
  // PostgREST doesn't do anti-joins, so we use NOT IN via a separate query.
  const postedUrl = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  postedUrl.searchParams.set('select', 'news_item_id');
  postedUrl.searchParams.set('status', 'eq.posted');
  const postedRes = await fetch(postedUrl.toString(), { headers: supabaseRestHeaders(env) });
  if (!postedRes.ok) {
    throw new Error(`pickNext posted query failed: ${postedRes.status} ${await postedRes.text()}`);
  }
  const postedRows = (await postedRes.json()) as Array<{ news_item_id: string }>;
  const postedIds = postedRows.map((r) => r.news_item_id);

  const url = new URL(`${env.SUPABASE_URL}/rest/v1/news_items`);
  url.searchParams.set('select', '*');
  url.searchParams.set('language', 'eq.vi');
  url.searchParams.set('ai_translated', 'eq.true');
  url.searchParams.set('status', 'eq.published');
  url.searchParams.set('order', 'importance.desc,published_at.desc');
  url.searchParams.set('limit', '50');
  const res = await fetch(url.toString(), { headers: supabaseRestHeaders(env) });
  if (!res.ok) {
    throw new Error(`pickNext news query failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as NewsItem[];
  const next = rows.find((r) => !postedIds.includes(r.id));
  if (!next) throw new Error('No eligible news_item to post');
  return next;
}

async function fetchFbPostLogByNewsItem(
  env: Env,
  newsItemId: string,
): Promise<FbPostLogRow | null> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  url.searchParams.set('select', 'id,news_item_id,status,attempt_count,posted_at,updated_at');
  url.searchParams.set('news_item_id', `eq.${newsItemId}`);
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: supabaseRestHeaders(env) });
  if (!res.ok) return null;
  const rows = (await res.json()) as FbPostLogRow[];
  return rows[0] ?? null;
}

interface FbPostLogUpsert {
  news_item_id: string;
  caption?: string;
  status: 'pending' | 'posted' | 'failed' | 'skipped';
  attempt_count: number;
  fb_post_id?: string;
  fb_permalink?: string;
  error_message?: string;
  raw_response?: unknown;
  posted_at?: string;
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
async function claimFbPostLog(env: Env, newsItemId: string): Promise<ClaimResult> {
  // Step 1 — try to atomically insert a fresh pending row.
  const insertUrl = new URL(`${env.SUPABASE_URL}/rest/v1/fb_post_log`);
  insertUrl.searchParams.set('on_conflict', 'news_item_id');
  const insertRes = await fetch(insertUrl.toString(), {
    method: 'POST',
    headers: {
      ...supabaseRestHeaders(env),
      Prefer: 'resolution=ignore-duplicates,return=representation',
    },
    body: JSON.stringify({
      news_item_id: newsItemId,
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
  const existing = await fetchFbPostLogByNewsItem(env, newsItemId);
  if (!existing) {
    // Should be unreachable: conflict was reported but row vanished. Treat as
    // pending to avoid double-posting.
    return { claimed: false, row: null, conflict: 'pending' };
  }
  if (existing.status === 'posted') {
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

  // Step 3 — existing row is failed/skipped OR stale-pending: take ownership.
  // PATCH is filtered on (id, status) so two concurrent retries can't both win.
  const claimableStatuses = existing.status === 'pending' ? 'pending' : 'failed,skipped';
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
  url.searchParams.set('on_conflict', 'news_item_id');
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
  const url = `${env.SUPABASE_URL.replace(/\/$/, '')}/functions/v1/social-caption`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Secret': env.SCRAPER_AUTH_SECRET,
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

function buildGeminiPrompt(env: Env, item: NewsItem): string {
  // Plain-text summary from content_html (strip tags) to give Gemini context.
  const bodyText = htmlToPlainText(item.content_html ?? item.summary ?? '').slice(0, 1500);
  const link = buildNewsLink(env, item);

  return `Bạn là chuyên gia content pickleball cho Facebook Page ThePickleHub (cộng đồng pickleball Việt Nam).

NHIỆM VỤ: Viết bài đăng Facebook bằng tiếng Việt từ tin tức bên dưới. Mục tiêu: tăng engagement, kéo traffic về website.

NGUYÊN TẮC:
- 100% tiếng Việt. Giữ nguyên thuật ngữ tiếng Anh phổ thông (dink, drive, drop, erne, ATP, stacking, rally, match point, PPA, MLP, APP). Giữ nguyên tên người + tên giải.
- Tone chuyên nghiệp, chuẩn báo chí thể thao. Câu ngắn, có nhịp. Không clickbait rẻ tiền.
- Cấu trúc: Hook 1-2 câu → Thân bài 1-2 đoạn → CTA → 3-5 hashtag cuối.
- Tổng độ dài 150-300 từ. Tối đa 2-3 emoji. Không lạm dụng hashtag.
- KHÔNG bịa số liệu. Chỉ dùng thông tin trong tin gốc.
- Kết bài luôn mời người đọc bấm link để đọc đầy đủ.

ĐỊNH DẠNG OUTPUT: Chỉ trả về nội dung bài đăng (không tiêu đề meta, không markdown, không tag "BÀI ĐĂNG FACEBOOK"). Kết thúc bằng 3-5 hashtag.

LINK PHẢI CHÈN NGUYÊN VĂN VÀO CUỐI THÂN BÀI (trước hashtag):
${link}

--- TIN GỐC ---
Tiêu đề: ${item.title}
Hạng mục: ${item.category ?? 'general'}
Tóm tắt: ${item.summary ?? '(không có)'}

Nội dung:
${bodyText || '(không có nội dung — dựa vào tiêu đề và tóm tắt)'}
--- HẾT TIN GỐC ---

Viết bài đăng:`;
}

function sanitizeCaption(text: string): string {
  // Strip code fences if Gemini wrapped in ```
  let out = text.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
  // Strip leading "BÀI ĐĂNG FACEBOOK:" style headers if present.
  out = out.replace(/^📝?\s*BÀI ĐĂNG FACEBOOK.*$/im, '').trim();
  // Collapse 3+ newlines.
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function buildFbPayload(item: NewsItem, caption: string, link: string): FbPayload {
  if (item.image_url && isContentImage(item.image_url)) {
    // Photo post — cover image embedded, caption goes in `caption`.
    // Note: link is included in caption text (already appended by Gemini prompt).
    return {
      endpoint: 'photos',
      body: {
        url: item.image_url,
        caption,
        published: 'true',
      },
    };
  }
  // Link/text post. FB will auto-fetch og:image from the linked URL,
  // which is what we want when the news_items.image_url is suspect or missing.
  return {
    endpoint: 'feed',
    body: {
      message: caption,
      link,
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
    'ads/',
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
  payload: FbPayload,
): Promise<{ id?: string; post_id?: string; error?: unknown }> {
  const url = `https://graph.facebook.com/${env.FB_GRAPH_VERSION}/${env.FB_PAGE_ID}/${payload.endpoint}`;
  const form = new URLSearchParams(payload.body);
  form.set('access_token', env.FB_PAGE_ACCESS_TOKEN);

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
