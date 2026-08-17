// Pure decision layer for news-repair, split out so it can be tested without a
// Deno runtime — importing index.ts would execute Deno.serve at module load.
//
// This is the whole of the job's judgement: a wrong branch either loops forever
// against a row that can never pass, or silently drops an article.

/** How many times this function may recover the same origin before giving up. */
const MAX_REPAIRS = 3;

/**
 * Past this age, an article is not worth recovering at all.
 *
 * Repair is what resurrects old work: a rescued origin becomes a NEW news_items
 * row carrying the ORIGINAL published_at, which then meets a Facebook picker
 * that filters on age and an X drafter with a 36-hour window. Recovering a
 * ten-day-old story therefore spends Gemini calls to produce something neither
 * channel will ever publish.
 *
 * Cuong's rule, 2026-08-17: nothing older than a week gets pushed again. Seven
 * days is comfortably wider than the 3-day Facebook window, so this only stops
 * work that was already certain to be wasted — it never blocks something that
 * could still have been posted.
 */
const MAX_REPAIR_AGE_DAYS = 7;

export interface Origin {
  id: string;
  raw_title: string | null;
  source_name: string | null;
  content_kind: "full" | "brief";
  attempts: number | null;
  last_error: string | null;
  published_at?: string | null;
}

type Action =
  | { kind: "reclassify"; reason: string; patch: Record<string, unknown> }
  | { kind: "requeue"; reason: string }
  | { kind: "leave"; reason: string };

/**
 * Decide what to do with one failed origin.
 *
 * Exported and pure so the classification can be tested without a database —
 * it is the whole of the job's judgement, and a wrong branch here either loops
 * forever or silently drops articles.
 */
export function originAgeDays(origin: Origin, now = Date.now()): number | null {
  if (!origin.published_at) return null;
  const t = Date.parse(origin.published_at);
  return Number.isFinite(t) ? (now - t) / 86_400_000 : null;
}

export function planRepair(origin: Origin): Action {
  const err = origin.last_error ?? "";
  const attempts = origin.attempts ?? 0;

  if (attempts >= MAX_REPAIRS) {
    return { kind: "leave", reason: "repair budget exhausted — needs a human" };
  }

  // Age first: a story too old to publish is not worth a Gemini call, whatever
  // the failure was.
  const ageDays = originAgeDays(origin);
  if (ageDays !== null && ageDays > MAX_REPAIR_AGE_DAYS) {
    return {
      kind: "leave",
      reason: `${ageDays.toFixed(1)} days old — past the ${MAX_REPAIR_AGE_DAYS}-day limit, not republished`,
    };
  }

  // Classified as a full article its source could never sustain. Re-judging it
  // as a brief is a different question, not the same one asked louder.
  if (/expected 350-800/.test(err)) {
    return {
      kind: "reclassify",
      reason: "too short for a full rewrite → brief",
      patch: { content_kind: "brief" },
    };
  }

  // Band misses and model-output faults. Worth one more pass because the bands
  // are now per-language and the same draft may land inside them; also because
  // Gemini is not deterministic.
  if (
    /expected \d+-\d+/.test(err) ||
    /diacritics/.test(err) ||
    /category is invalid/.test(err) ||
    /summary length is invalid/.test(err) ||
    /title length is invalid/.test(err)
  ) {
    return { kind: "requeue", reason: "validation miss — retry under current rules" };
  }

  // Transient. Nothing to change; the next run may simply succeed.
  if (/timed out|HTTP 5\d\d|fetch failed|network/i.test(err)) {
    return { kind: "requeue", reason: "transient" };
  }

  return { kind: "leave", reason: `unrecognised: ${err.slice(0, 80)}` };
}

