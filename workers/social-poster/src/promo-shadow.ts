/**
 * Shadow mode for the promotional-news filter.
 *
 * `promo-filter.ts` keeps deciding. This module only watches it and records
 * what TypeSafe's Jev model would have said about the same item, so that in two
 * weeks there is data instead of an argument about whether to replace 26 hand
 * written regexes with a model call.
 *
 * Why the regex needs watching: it is binary. A title matching no pattern is
 * "certainly clean", which is how the Six Zero paddle release reached both
 * Facebook pages on 2026-08-17 — it matched nothing, so there was no "not sure"
 * for anyone to catch. Jev returns a probability, and a probability has a
 * middle. The shape we are looking for in the log is rows with
 * `regex_blocked = false` and a noul around 0.6: the ones a human should have
 * seen.
 *
 * Rules this module lives by, all three learned the expensive way elsewhere in
 * this Worker:
 *
 *   1. It never changes a decision. Nothing reads `promo_filter_shadow`.
 *   2. It never throws. A failure here must not cost a post that was fine.
 *   3. It is silent without `TYPESAFE_API_KEY`, exactly like `notify.ts` is
 *      without a Telegram token, so the pipeline runs unchanged when the trial
 *      ends and the secret is deleted.
 */

import { isPromotionalSource } from './promo-filter';

export interface PromoShadowEnv {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  /** Absent => shadow mode is off and this module does nothing. */
  TYPESAFE_API_KEY?: string;
  /** Pin a version here if `jev-latest` starts moving under us. */
  TYPESAFE_MODEL?: string;
}

export interface ShadowCandidate {
  id: string;
  title: string;
  summary: string | null;
  category: string | null;
  source?: string | null;
  language?: string | null;
}

export type ShadowPipeline = 'facebook' | 'x';

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const DEFAULT_MODEL = 'jev-latest';

/**
 * How many candidates one run may ask about.
 *
 * The Facebook picker scans `doneCount + 50` rows and the cron ticks every few
 * minutes, so "all candidates" would be hundreds of near-identical questions an
 * hour. Twenty covers the head of the queue, which is the only part that gets
 * posted anyway.
 *
 * ponytail: a flat cap, not a "have I seen this id" pre-query. At $0.042 per
 * million input tokens the duplicates cost a few cents a month, and the unique
 * constraint keeps the table clean. Add the pre-query if the bill ever shows up.
 */
const MAX_ITEMS = 20;

/** One model call, one Supabase insert, both bounded. */
const TIMEOUT_MS = 15_000;

interface NoulAnswer {
  type?: string;
  noul?: number;
}

export interface SystemOneBody {
  state: Array<{ id: string; title: string; summary: string }>;
  model: string;
  questions: Record<string, unknown>;
}

/**
 * One request, one question per candidate. Jev reads the state once and answers
 * every question against it in parallel, so twenty articles cost roughly one
 * article's worth of latency and a single subrequest against the Worker's
 * 50-per-run ceiling.
 *
 * The criteria are written in English even for the Vietnamese pipeline: English
 * is the model's strongest language, and describing the boundary is the part
 * that has to be unambiguous. The articles themselves arrive in whichever
 * language the pipeline handles — measuring how well that works on Vietnamese
 * is half the point of the trial.
 */
export function buildShadowRequest(
  candidates: ShadowCandidate[],
  model = DEFAULT_MODEL,
): SystemOneBody {
  const rows = candidates.slice(0, MAX_ITEMS);
  return {
    state: rows.map((row) => ({
      id: row.id,
      title: row.title,
      summary: (row.summary ?? '').slice(0, 600),
    })),
    model,
    questions: Object.fromEntries(
      rows.map((row) => [
        row.id,
        {
          type: 'noul',
          instructions:
            `Consider only the article in the state whose \`id\` is "${row.id}". ` +
            'Is it commercial promotion rather than a news report?',
          criteria: {
            true:
              'Promotional: a product launch or release (paddle, shoe, apparel, bag, ' +
              'collection), a gear review or buying guide, a sponsorship or brand ' +
              'partnership announcement, a discount, promo code, giveaway, pre-order, ' +
              'or a ticket sale push. Its purpose is to sell something.',
            false:
              'Editorial: tournament schedules, results, standings, player news, ' +
              'rule or format changes, club and community stories, coaching and ' +
              'technique. A brand may be named in passing without making it an advert.',
          },
        },
      ]),
    ),
  };
}

export interface ShadowRow {
  news_item_id: string;
  pipeline: ShadowPipeline;
  language: string | null;
  title: string;
  regex_blocked: boolean;
  jev_noul: number;
  model: string;
}

/**
 * Pair each answer back with the verdict that was actually acted on. Pure, so
 * the comparison is checkable without a network or a database — which matters,
 * because getting this pairing wrong would silently produce two weeks of data
 * that says nothing.
 */
export function shadowRowsFrom(
  candidates: ShadowCandidate[],
  answers: Record<string, NoulAnswer | undefined>,
  pipeline: ShadowPipeline,
  model: string,
): ShadowRow[] {
  const rows: ShadowRow[] = [];
  for (const candidate of candidates.slice(0, MAX_ITEMS)) {
    const noul = answers[candidate.id]?.noul;
    // An answer that came back without a number tells us nothing, and a row of
    // nothing in the log reads later as agreement. Drop it instead.
    if (typeof noul !== 'number' || !Number.isFinite(noul)) continue;
    rows.push({
      news_item_id: candidate.id,
      pipeline,
      language: candidate.language ?? null,
      title: candidate.title.slice(0, 300),
      regex_blocked: isPromotionalSource(
        candidate.title,
        candidate.summary,
        candidate.source ?? null,
        candidate.category,
      ),
      jev_noul: Math.min(1, Math.max(0, noul)),
      model,
    });
  }
  return rows;
}

/**
 * Best-effort. Returns the number of rows logged, for the /run response and the
 * tests; callers are free to ignore it, and every failure path returns 0 rather
 * than throwing.
 */
export async function recordPromoShadow(
  env: PromoShadowEnv,
  pipeline: ShadowPipeline,
  candidates: ShadowCandidate[],
): Promise<number> {
  const key = env.TYPESAFE_API_KEY ?? '';
  if (!key || candidates.length === 0) return 0;

  try {
    const model = env.TYPESAFE_MODEL || DEFAULT_MODEL;
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildShadowRequest(candidates, model)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error('[promo-shadow] typesafe rejected:', res.status, (await res.text()).slice(0, 200));
      return 0;
    }
    const payload = (await res.json()) as {
      model?: string;
      answers?: Record<string, NoulAnswer>;
    };
    // Log the version that answered, not the alias we asked for: an alias moves
    // when TypeSafe ships, and two weeks of rows from two models read as one.
    const rows = shadowRowsFrom(
      candidates,
      payload.answers ?? {},
      pipeline,
      payload.model ?? model,
    );
    if (rows.length === 0) return 0;

    const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/promo_filter_shadow`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        // First observation of an item wins; a re-run of the same queue is a
        // no-op instead of a duplicate-key error.
        Prefer: 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!ins.ok) {
      console.error('[promo-shadow] insert failed:', ins.status, (await ins.text()).slice(0, 200));
      return 0;
    }
    return rows.length;
  } catch (error) {
    console.error('[promo-shadow] failed:', error);
    return 0;
  }
}
