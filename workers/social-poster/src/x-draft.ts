/**
 * X draft generation — `POST /x/draft`.
 *
 * Reads published ENGLISH `news_items`, has Gemini rewrite each into a post
 * that follows docs/x-content-playbook.md, and writes the result to `x_posts`
 * as `status='draft'`. It never publishes: the drain in x.ts only looks at
 * `approved`, so Cuong stays the only path from draft to X.
 *
 * Why English rows and not the Vietnamese ones the Facebook pipeline uses:
 * news_items already stores the EN original (the VI row is a child via
 * parent_news_id, written by news-translate). The X account is English, so the
 * source is already in the right language and there is no translation step to
 * get wrong.
 *
 * The three guards below exist because a language model will drift back toward
 * marketing copy no matter what the prompt says, and a bad draft that reaches
 * `approved` costs a real post on a real brand account:
 *
 *   1. checkXBody   — shared with the publisher. A URL or bare domain is a hard
 *                     fail, so the $0.200 link surcharge cannot enter via a
 *                     generated draft either.
 *   2. AD_PATTERNS  — call-to-action and engagement-bait shapes. These are what
 *                     earn NotInterested (-43.2, i.e. -86 likes).
 *   3. specificity  — a post with no digit and no capitalised name is the
 *                     "great match today!" failure the playbook bans.
 */

import { checkXBody, type XEnv } from './x';

const NEWS_SELECT = 'id,title,summary,content_html,category,importance,published_at';

/** How many drafts one run may create. The playbook caps posting at 2-4/day. */
const DEFAULT_DRAFT_LIMIT = 2;

/** Only consider news published within this window — X 403s stale duplicates. */
const DEFAULT_LOOKBACK_HOURS = 36;

export interface XDraftEnv extends XEnv {
  /** Same secret the cron uses to call this Worker; social-caption checks it. */
  SOCIAL_POSTER_SECRET?: string;
  X_DRAFT_LIMIT?: string;
  X_DRAFT_LOOKBACK_HOURS?: string;
}

export interface NewsRow {
  id: string;
  title: string;
  summary: string | null;
  content_html: string | null;
  category: string | null;
  importance: number;
  published_at: string;
}

export interface XDraftBody {
  dry_run?: boolean;
  limit?: number;
  news_item_id?: string;
}

/**
 * Ad shapes, matched case-insensitively against the generated body.
 *
 * Deliberately narrow. Every pattern here is a phrase that only appears when
 * the model is selling something; none of them can show up in a sentence that
 * is reporting a result. A broad "no marketing words" filter would eat real
 * copy ("Ben Johns swept the final" contains "sweep"), and a guard that eats
 * real copy gets switched off — which is worse than no guard.
 */
const AD_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bread (?:the )?(?:more|full|rest)\b/i, 'read_more'],
  [/\b(?:full|complete) (?:story|recap|breakdown|analysis|coverage)\b/i, 'full_story'],
  [/\bcheck (?:it |them )?out\b/i, 'check_out'],
  [/\blink in bio\b/i, 'link_in_bio'],
  [/\b(?:thread|more) below\b/i, 'thread_below'],
  [/\bfollow (?:us|@?thepicklehub)\b/i, 'follow_us'],
  [/\bswipe up\b/i, 'swipe_up'],
  [/\bdon'?t miss\b/i, 'dont_miss'],
  [/\b(?:like|rt|retweet|repost) (?:this )?if\b/i, 'engagement_bait'],
  [/\brt to\b/i, 'engagement_bait'],
  [/\bcomment (?:your|below|with)\b/i, 'engagement_bait'],
  [/\bdot (?:net|com|org)\b/i, 'spelled_domain'],
  // Alternation, not a character class: ⬇️ and ➡️ carry a variation selector,
  // and a class of combined characters matches the base char alone in ways
  // that surprise (eslint no-misleading-character-class flags exactly this).
  [/👇|⬇|➡|🔗/u, 'pointer_emoji'],
];

export type XDraftReject =
  | { ok: false; reason: 'invalid_body'; detail: string }
  | { ok: false; reason: 'ad_copy'; detail: string }
  | { ok: false; reason: 'not_specific'; detail: string };

export type XDraftCheck = { ok: true; weighted: number } | XDraftReject;

/**
 * Gate a generated body before it is allowed to become a draft row.
 * Rejecting here is free; rejecting after Cuong approves it is a live post.
 */
export function checkXDraft(body: string): XDraftCheck {
  const base = checkXBody(body);
  if (!base.ok) {
    return { ok: false, reason: 'invalid_body', detail: base.reason ?? 'unknown' };
  }

  for (const [pattern, label] of AD_PATTERNS) {
    if (pattern.test(body)) return { ok: false, reason: 'ad_copy', detail: label };
  }

  // A concrete detail is a digit (score, streak, ranking, prize) or a name
  // capitalised mid-sentence. The preceding character must be a lowercase
  // letter, digit or comma — NOT sentence-ending punctuation, or "today.
  // Really exciting stuff" counts "Really" as a proper noun and every vacuous
  // post passes. (It did; the test caught it.)
  const hasNumber = /\d/.test(body);
  const hasMidSentenceName = /[a-z0-9,] +[A-Z][a-z]{2,}/.test(body);
  if (!hasNumber && !hasMidSentenceName) {
    return { ok: false, reason: 'not_specific', detail: 'no number or proper noun' };
  }

  // More than one hashtag is the playbook cap; they carry no ranking weight.
  const hashtags = body.match(/#\w+/g) ?? [];
  if (hashtags.length > 1) {
    return { ok: false, reason: 'ad_copy', detail: `hashtags:${hashtags.length}` };
  }

  return { ok: true, weighted: base.weighted };
}

export function xDraftLimit(env: XDraftEnv, override?: number): number {
  if (Number.isFinite(override) && (override as number) >= 1) {
    return Math.min(Math.floor(override as number), 10);
  }
  const raw = Number(env.X_DRAFT_LIMIT);
  return Number.isFinite(raw) && raw >= 1 ? Math.min(Math.floor(raw), 10) : DEFAULT_DRAFT_LIMIT;
}

export function xDraftLookbackHours(env: XDraftEnv): number {
  const raw = Number(env.X_DRAFT_LOOKBACK_HOURS);
  return Number.isFinite(raw) && raw >= 1 ? raw : DEFAULT_LOOKBACK_HOURS;
}

/**
 * Rank the candidates the same way a human would skim them: importance first,
 * then newest. Exported so the ordering is testable without a database.
 */
export function rankNewsCandidates(rows: NewsRow[], alreadyDrafted: Set<string>): NewsRow[] {
  return rows
    .filter((row) => !alreadyDrafted.has(row.id))
    .sort((a, b) => {
      if (b.importance !== a.importance) return b.importance - a.importance;
      return Date.parse(b.published_at) - Date.parse(a.published_at);
    });
}

function restHeaders(env: XDraftEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function fetchEnglishNews(env: XDraftEnv, body: XDraftBody): Promise<NewsRow[]> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/news_items`);
  url.searchParams.set('select', NEWS_SELECT);
  url.searchParams.set('language', 'eq.en');
  url.searchParams.set('status', 'eq.published');
  if (body.news_item_id) {
    url.searchParams.set('id', `eq.${body.news_item_id}`);
  } else {
    const since = new Date(Date.now() - xDraftLookbackHours(env) * 3600_000).toISOString();
    url.searchParams.set('published_at', `gte.${since}`);
    url.searchParams.set('order', 'importance.desc,published_at.desc');
    url.searchParams.set('limit', '40');
  }
  const res = await fetch(url.toString(), { headers: restHeaders(env) });
  if (!res.ok) throw new Error(`news_items read failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as NewsRow[];
}

/** Every news item this pipeline has already turned into a row, at any status. */
async function fetchDraftedIds(env: XDraftEnv): Promise<Set<string>> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/x_posts`);
  url.searchParams.set('select', 'source_id');
  url.searchParams.set('source_table', 'eq.news_items');
  url.searchParams.set('source_id', 'not.is.null');
  url.searchParams.set('limit', '500');
  const res = await fetch(url.toString(), { headers: restHeaders(env) });
  if (!res.ok) throw new Error(`x_posts read failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{ source_id: string | null }>;
  return new Set(rows.map((r) => r.source_id).filter((id): id is string => !!id));
}

async function generateCaption(
  env: XDraftEnv,
  row: NewsRow,
  retryHint?: string,
): Promise<string> {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/social-caption`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // The Edge Function checks this header, not a JWT.
      'X-Auth-Secret': env.SOCIAL_POSTER_SECRET ?? '',
    },
    body: JSON.stringify({
      mode: 'x_en',
      title: row.title,
      summary: row.summary,
      content_html: row.content_html,
      category: row.category,
      link: '',
      ...(retryHint ? { retry_hint: retryHint } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`social-caption failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  const data = (await res.json()) as { caption?: string };
  const caption = (data.caption ?? '').trim();
  if (!caption) throw new Error('social-caption returned an empty caption');
  return caption;
}

async function insertDraft(env: XDraftEnv, row: NewsRow, body: string): Promise<string> {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/x_posts`, {
    method: 'POST',
    headers: { ...restHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify({
      // ponytail: every news draft is filed as 'result'. News items are
      // overwhelmingly reports of something that happened, and asking the model
      // to also classify itself adds a field that can be wrong in a way nobody
      // checks. Cuong can change content_type when he approves; if the mix
      // turns out to matter, classify then.
      content_type: 'result',
      body,
      status: 'draft',
      source_table: 'news_items',
      source_id: row.id,
    }),
  });
  if (!res.ok) throw new Error(`x_posts insert failed: ${res.status} ${await res.text()}`);
  const inserted = (await res.json()) as Array<{ id: string }>;
  return inserted[0]?.id ?? '(unknown)';
}

export async function handleXDraft(
  env: XDraftEnv,
  body: XDraftBody,
): Promise<Record<string, unknown>> {
  if (!env.SOCIAL_POSTER_SECRET) {
    return { skipped: true, reason: 'social_poster_secret_missing' };
  }

  const [candidates, drafted] = await Promise.all([
    fetchEnglishNews(env, body),
    fetchDraftedIds(env),
  ]);
  const ranked = rankNewsCandidates(candidates, drafted);
  if (ranked.length === 0) return { drafted: 0, reason: 'no_new_news' };

  const limit = xDraftLimit(env, body.limit);
  const results: Array<Record<string, unknown>> = [];
  let created = 0;

  for (const row of ranked) {
    if (created >= limit) break;

    let caption: string;
    try {
      caption = await generateCaption(env, row);
    } catch (err) {
      results.push({ news_item_id: row.id, error: String(err).slice(0, 200) });
      continue;
    }

    let check = checkXDraft(caption);

    // One retry, for length only. The first real run threw away a good post
    // because it was 281 characters — one over. Length is the failure a model
    // fixes reliably when told the number, unlike ad copy, where a retry tends
    // to produce differently-worded ad copy and burns a call to learn that.
    if (!check.ok && check.reason === 'invalid_body' && check.detail === 'too_long') {
      try {
        caption = await generateCaption(
          env,
          row,
          `Your previous attempt was ${caption.length} characters, over the 280 limit. ` +
            'Rewrite it under 240 characters. Cut the second sentence entirely if you must; ' +
            'do not drop the score or the names.',
        );
        check = checkXDraft(caption);
      } catch (err) {
        results.push({ news_item_id: row.id, error: String(err).slice(0, 200) });
        continue;
      }
    }

    if (!check.ok) {
      // Not an error: the guard did its job. Surface it so a prompt that keeps
      // producing ad copy is visible rather than silently dropping everything.
      results.push({
        news_item_id: row.id,
        rejected: check.reason,
        detail: check.detail,
        body: caption,
      });
      continue;
    }

    if (body.dry_run) {
      results.push({
        dry_run: true,
        news_item_id: row.id,
        title: row.title,
        body: caption,
        weighted_length: check.weighted,
      });
      created += 1;
      continue;
    }

    const id = await insertDraft(env, row, caption);
    results.push({ x_post_id: id, news_item_id: row.id, weighted_length: check.weighted });
    created += 1;
  }

  return { drafted: created, considered: ranked.length, results };
}
