/**
 * X post generation — `POST /x/draft`. Two producers, one daily run:
 *
 *   1. yesterday's pro-tour results as ONE templated post (see x-roundup.ts —
 *      no model involved, so it cannot invent a score)
 *   2. fresh English `news_items`, rewritten by Gemini per
 *      docs/x-content-playbook.md
 *
 * Rows land at NEW_ROW_STATUS, which is `approved` since 2026-08-17 — the
 * pipeline publishes unattended and the guards below are the whole review. See
 * the constant for what they do and do not cover.
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
import { isPromotionalSource } from './promo-filter';
import {
  buildRoundupBody,
  proTourProviderFilter,
  type RoundupMatch,
} from './x-roundup';

const NEWS_SELECT = 'id,title,summary,content_html,category,importance,published_at,source';

/**
 * How many news posts one run may create. Cuong dropped the 2-4/day editorial
 * cap on 2026-08-16, so this is a spend and spam ceiling, not an editorial one:
 * a day where the fetcher lands 40 items should not become 40 posts. The Worker
 * still paces publishing at one per X_POST_MIN_GAP_MINUTES regardless.
 *
 * ponytail: a plain number, not "unlimited". Raise X_DRAFT_LIMIT if 8 is short.
 */
const DEFAULT_DRAFT_LIMIT = 8;

/** Only consider news published within this window — X 403s stale duplicates. */
const DEFAULT_LOOKBACK_HOURS = 36;

/**
 * THE HUMAN GATE. Rows land at this status; the drain in x.ts publishes only
 * `approved`, so 'draft' means Cuong reads every post before X sees it and
 * 'approved' means the guards in this file are the only thing between a
 * language model and a public brand account.
 *
 * Set to 'approved' on 2026-08-17 at Cuong's explicit instruction, after being
 * shown what the guards do and do not replace. Recorded here so the next reader
 * knows it was a decision and not an oversight:
 *
 *   covered — links, ad copy, promotional sources, hashtag spam, length, and
 *             numbers that do not appear in the source article
 *   NOT covered — a claim containing no number that is simply wrong
 *
 * The roundup post has no such gap; it is templated from database rows with no
 * model in the loop. The news posts do. Revert by changing this one word.
 */
const NEW_ROW_STATUS: 'draft' | 'approved' = 'approved';

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
  source?: string | null;
}

export interface XDraftBody {
  dry_run?: boolean;
  limit?: number;
  news_item_id?: string;
  /**
   * Override the lookback for one call. The daily job wants a short window so
   * it does not re-post yesterday's news, but a catch-up after an outage needs
   * to reach back past it — items that failed to translate for a week are
   * eligible now and would otherwise never be seen again.
   */
  lookback_hours?: number;
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

/** Enough of English to recognise a number the model spelled out in its source. */
const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12',
  thirteen: '13', fourteen: '14', fifteen: '15', sixteen: '16',
  seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50',
};

const TENS_WORDS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50 };
const UNIT_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};

/**
 * Every number in the generated post must be traceable to the source text.
 *
 * This exists because of one observed failure: asked to rewrite an MLP report,
 * the model produced "No. 4 Columbus" — a seed that appeared nowhere in the
 * source or in its own previous attempt. Under manual approval that is a typo
 * someone catches; posting unattended it is the brand stating a false fact.
 *
 * Word forms count as present, because the prompt deliberately asks for digits
 * ("21-10", not "twenty-one to ten"), so a correct conversion must not be
 * treated as an invention.
 */
export function unsourcedNumbers(body: string, sourceText: string): string[] {
  const haystack = sourceText.toLowerCase();
  const digitsInSource = new Set(haystack.match(/\d+/g) ?? []);
  for (const [word, digits] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(haystack)) digitsInSource.add(digits);
  }
  // Compounds, because a game to 21 is written "twenty-one" and the guard was
  // rejecting the correct digits for it — exactly the kind of false positive
  // that gets a guard switched off.
  for (const [tens, tv] of Object.entries(TENS_WORDS)) {
    for (const [unit, uv] of Object.entries(UNIT_WORDS)) {
      if (new RegExp(`\\b${tens}[- ]${unit}\\b`).test(haystack)) {
        digitsInSource.add(String(tv + uv));
      }
    }
  }
  const used = body.match(/\d+/g) ?? [];
  return [...new Set(used.filter((n) => !digitsInSource.has(n)))];
}

export type XDraftReject =
  | { ok: false; reason: 'invalid_body'; detail: string }
  | { ok: false; reason: 'ad_copy'; detail: string }
  | { ok: false; reason: 'not_specific'; detail: string }
  | { ok: false; reason: 'unsourced_number'; detail: string };

export type XDraftCheck = { ok: true; weighted: number } | XDraftReject;

/**
 * Gate a generated body before it is allowed to become a draft row.
 * Rejecting here is free; rejecting after Cuong approves it is a live post.
 */
export function checkXDraft(body: string, sourceText = ''): XDraftCheck {
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

  if (sourceText) {
    const invented = unsourcedNumbers(body, sourceText);
    if (invented.length > 0) {
      return { ok: false, reason: 'unsourced_number', detail: invented.join(',') };
    }
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
    .filter((row) => !isPromotionalSource(row.title, row.summary, row.source, row.category))
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
    const hours = Number.isFinite(body.lookback_hours) && (body.lookback_hours as number) > 0
      ? Math.min(body.lookback_hours as number, 24 * 30)
      : xDraftLookbackHours(env);
    const since = new Date(Date.now() - hours * 3600_000).toISOString();
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
      status: NEW_ROW_STATUS,
      source_table: 'news_items',
      source_id: row.id,
    }),
  });
  if (!res.ok) throw new Error(`x_posts insert failed: ${res.status} ${await res.text()}`);
  const inserted = (await res.json()) as Array<{ id: string }>;
  return inserted[0]?.id ?? '(unknown)';
}

/**
 * Yesterday's pro-tour results, as one templated post. Runs in the same daily
 * job as the news drafts because it is the same question ("what happened?")
 * asked of a different table, and a second cron would be a second thing to
 * forget.
 */
async function draftProTourRoundup(
  env: XDraftEnv,
  body: XDraftBody,
): Promise<Record<string, unknown>> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/matches`);
  url.searchParams.set(
    'select',
    'id,tournament_name,tournament_round,round_name,team_a_score,team_b_score,' +
      'winning_team,source_provider,' +
      'participants:match_participants(team,position,' +
      'profile:profiles!match_participants_player_id_fkey(display_name,username))',
  );
  // Keyed on verified_at, NOT played_at. The scraper runs daily and, for MLP
  // Newport Beach, ran at 18:00 UTC while the matches were played 19:00-23:00 —
  // so results land up to a day after the game. A played_at window keeps missing
  // them: the roundup fires, the matches are inside the window but unresolved,
  // and by the time the scores arrive the window has moved on. verified_at is
  // when a result actually became final, which is the thing worth posting about.
  url.searchParams.set('source_provider', proTourProviderFilter());
  url.searchParams.set('verified_at', `gte.${since}`);
  url.searchParams.set('winning_team', 'not.is.null');
  url.searchParams.set('order', 'verified_at.desc');
  url.searchParams.set('limit', '60');

  const res = await fetch(url.toString(), { headers: restHeaders(env) });
  if (!res.ok) throw new Error(`matches read failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<RoundupMatch & { source_provider: string }>;
  // Nothing became final in the window. Usually a quiet day; if it persists
  // across days while fixtures exist, the scraper is behind rather than the
  // sport being idle, and `unresolved_and_overdue` in the database says which.
  if (rows.length === 0) {
    return { roundup: 'skipped', roundup_reason: 'no_results_verified_in_24h' };
  }

  const text = buildRoundupBody(rows, rows.map((r) => r.source_provider));
  if (!text) {
    // Rows came back verified but still would not render — a missing player
    // name or an empty score array. Report the counts rather than a bare null:
    // for a day that told the difference between "quiet" and "scraper behind"
    // only by hand-querying the database.
    return {
      roundup: 'skipped',
      roundup_reason: 'verified_but_unrenderable',
      matches_seen: rows.length,
      with_winner: rows.filter((r) => r.winning_team === 'a' || r.winning_team === 'b').length,
    };
  }

  // Same day, same results — do not post it twice if the job is re-run.
  const dupUrl = new URL(`${env.SUPABASE_URL}/rest/v1/x_posts`);
  dupUrl.searchParams.set('select', 'id');
  dupUrl.searchParams.set('source_table', 'eq.matches');
  dupUrl.searchParams.set('created_at', `gte.${since}`);
  dupUrl.searchParams.set('limit', '1');
  const dupRes = await fetch(dupUrl.toString(), { headers: restHeaders(env) });
  if (dupRes.ok && ((await dupRes.json()) as unknown[]).length > 0) {
    return { roundup: 'skipped', roundup_reason: 'already_posted_today' };
  }

  if (body.dry_run) {
    return { roundup: 'dry_run', matches: rows.length, body: text, length: text.length };
  }

  const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/x_posts`, {
    method: 'POST',
    headers: { ...restHeaders(env), Prefer: 'return=representation' },
    body: JSON.stringify({
      content_type: 'result',
      body: text,
      status: NEW_ROW_STATUS,
      source_table: 'matches',
    }),
  });
  if (!ins.ok) throw new Error(`roundup insert failed: ${ins.status} ${await ins.text()}`);
  const inserted = (await ins.json()) as Array<{ id: string }>;
  return { roundup: inserted[0]?.id ?? '(unknown)', matches: rows.length, length: text.length };
}

export async function handleXDraft(
  env: XDraftEnv,
  body: XDraftBody,
): Promise<Record<string, unknown>> {
  if (!env.SOCIAL_POSTER_SECRET) {
    return { skipped: true, reason: 'social_poster_secret_missing' };
  }

  // Results first: they are the post with no model in the loop, so a failure
  // in the news half must not cost us the half that cannot be wrong.
  let roundup: Record<string, unknown>;
  try {
    roundup = await draftProTourRoundup(env, body);
  } catch (err) {
    roundup = { roundup: 'error', roundup_reason: String(err).slice(0, 200) };
  }

  const [candidates, drafted] = await Promise.all([
    fetchEnglishNews(env, body),
    fetchDraftedIds(env),
  ]);
  const ranked = rankNewsCandidates(candidates, drafted);
  if (ranked.length === 0) return { drafted: 0, reason: 'no_new_news', ...roundup };

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

    // The source text the numbers are checked against. content_html is what the
    // model was given, so anything numeric it wrote should be traceable to it.
    const sourceText = `${row.title} ${row.summary ?? ''} ${row.content_html ?? ''}`;
    let check = checkXDraft(caption, sourceText);

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
        check = checkXDraft(caption, sourceText);
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

  return { drafted: created, considered: ranked.length, results, ...roundup };
}
