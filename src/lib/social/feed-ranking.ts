/**
 * Page-1 ranking for /feed.
 *
 * The timeline RPC scores blogs high enough, and the page drops anything
 * older than 14 days, so a week without a user-recorded match becomes a
 * page of posts. These helpers are the display rule shared by the React
 * page and the bot renderer:
 *
 *   - Keep the 14-day window for posts, news, and video.
 *   - When that window has no finished result, keep the newest results
 *     out to 90 days (capped) so the page is not empty of scores.
 *   - In the first page, every block of three items contains a result
 *     when any result is available later in the list. A result that
 *     already ranks in a block stays where the score put it.
 */

export const BLOG_TYPE_BONUS = 0.25;

export const FEED_PAGE_SIZE = 20;
export const FEED_RESULT_EVERY = 3;
/** One result per block of three, for a full first page. */
export const FEED_WIDE_RESULT_CAP = Math.ceil(FEED_PAGE_SIZE / FEED_RESULT_EVERY);

export const FEED_STANDARD_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
export const FEED_RESULT_WIDE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export interface FeedResultRef {
  type?: string;
  item_type?: string;
  winning_team?: string | null;
}

/** A finished match already on the timeline, or a tournament/quick-table final. */
export function isMatchResult(item: FeedResultRef): boolean {
  const kind = item.type ?? item.item_type;
  if (kind === "result") return true;
  if (kind !== "match") return false;
  return item.winning_team === "a" || item.winning_team === "b";
}

export function feedResultHref(
  source: string | null | undefined,
  slug: string | null | undefined,
  sourceUrl?: string | null,
): string {
  if (sourceUrl && sourceUrl.startsWith("/")) return sourceUrl;
  const id = encodeURIComponent(slug ?? "");
  switch (source) {
    case "quick_table":
      return `/tools/quick-tables/${id}`;
    case "doubles_elim":
      return `/tools/doubles-elimination/${id}`;
    case "team_match":
      return `/tools/team-match/${id}`;
    default:
      return `/tran-dau/${id}`;
  }
}

const RESULT_KIND: Record<string, { vi: string; en: string }> = {
  quick_table: { vi: "GIẢI CHIA BẢNG", en: "QUICK TABLE" },
  doubles_elim: { vi: "GIẢI ĐẤU", en: "TOURNAMENT" },
  team_match: { vi: "ĐẤU ĐỘI", en: "TEAM MATCH" },
  ppa_tour: { vi: "PPA", en: "PPA" },
  mlp: { vi: "MLP", en: "MLP" },
  app_tour: { vi: "APP", en: "APP" },
  community: { vi: "CỘNG ĐỒNG", en: "COMMUNITY" },
};

export interface FeedResultLabelInput {
  source: string | null | undefined;
  roundName?: string | null;
  division?: string | null;
  language: "vi" | "en";
}

export interface FeedResultLabels {
  kind: string;
  round: string;
  division: string | null;
}

export function feedResultLabels(input: FeedResultLabelInput): FeedResultLabels {
  const lang = input.language === "vi" ? "vi" : "en";
  const known = input.source ? RESULT_KIND[input.source] : undefined;
  const kind = known ? known[lang] : lang === "vi" ? "KẾT QUẢ" : "RESULT";
  const roundCode = (input.roundName ?? "").trim().toLowerCase();
  const round =
    roundCode === "final" || roundCode === "f"
      ? lang === "vi"
        ? "CHUNG KẾT"
        : "FINAL"
      : (input.roundName ?? "").trim().toUpperCase();
  return {
    kind,
    round,
    division: divisionLabel(input.division, lang),
  };
}

function divisionLabel(raw: string | null | undefined, lang: "vi" | "en"): string | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return lang === "vi" ? `NHÁNH ${n + 1}` : `BRACKET ${n + 1}`;
}

export function dedupeFeedItems<T>(groups: readonly (readonly T[])[], idOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const group of groups) {
    for (const item of group) {
      const id = idOf(item);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}

export interface SelectFeedResultsOptions<T> {
  isResult: (item: T) => boolean;
  rankedAtMs: (item: T) => number;
  nowMs: number;
  standardWindowMs?: number;
  wideWindowMs?: number;
  maxWideResults?: number;
}

/**
 * Drop non-results outside the 14-day window. Results inside that window
 * all stay. If none are that fresh, keep the newest results inside 90 days,
 * capped so an old month cannot replace the whole page.
 */
export function selectFeedResults<T>(
  items: readonly T[],
  options: SelectFeedResultsOptions<T>,
): T[] {
  const standard = options.standardWindowMs ?? FEED_STANDARD_WINDOW_MS;
  const wide = options.wideWindowMs ?? FEED_RESULT_WIDE_WINDOW_MS;
  const cap = options.maxWideResults ?? FEED_WIDE_RESULT_CAP;
  const others: T[] = [];
  const results: { item: T; at: number }[] = [];

  for (const item of items) {
    const at = options.rankedAtMs(item);
    if (!options.isResult(item)) {
      if (!Number.isFinite(at) || options.nowMs - at <= standard) others.push(item);
      continue;
    }
    if (!Number.isFinite(at)) continue;
    const age = options.nowMs - at;
    if (age >= 0 && age <= wide) results.push({ item, at });
  }

  const fresh = results.filter((row) => options.nowMs - row.at <= standard);
  const chosen =
    fresh.length > 0
      ? fresh.map((row) => row.item)
      : results
          .slice()
          .sort((a, b) => b.at - a.at)
          .slice(0, cap)
          .map((row) => row.item);

  return [...others, ...chosen];
}

export interface InterleaveOptions {
  windowSize?: number;
  every?: number;
}

/**
 * First page keeps at least one result in every block of `every` items
 * when a result exists later in the list. Blocks that already contain a
 * result are left in score order.
 */
export function interleaveFeedResults<T>(
  items: readonly T[],
  isResult: (item: T) => boolean,
  options: InterleaveOptions = {},
): T[] {
  const every = options.every ?? FEED_RESULT_EVERY;
  const windowSize = options.windowSize ?? FEED_PAGE_SIZE;
  if (every < 1 || items.length === 0 || !items.some(isResult)) return [...items];

  const headCount = Math.min(windowSize, items.length);
  const out = items.slice(0, headCount);
  const rest = items.slice(headCount);
  const blocks = Math.ceil(out.length / every);

  for (let block = 0; block < blocks; block += 1) {
    const start = block * every;
    const end = Math.min(start + every, out.length);
    if (out.slice(start, end).some(isResult)) continue;

    let later = -1;
    for (let i = end; i < out.length; i += 1) {
      if (isResult(out[i])) {
        later = i;
        break;
      }
    }
    const slot = end - 1;
    if (later >= 0) {
      const pulled = out[later];
      out[later] = out[slot];
      out[slot] = pulled;
      continue;
    }

    const fromRest = rest.findIndex(isResult);
    if (fromRest < 0) continue;
    const pulled = rest[fromRest];
    rest.splice(fromRest, 1);
    rest.unshift(out[slot]);
    out[slot] = pulled;
  }

  return [...out, ...rest];
}

export interface QuickTableCopyRef {
  type?: string;
  item_type?: string;
  slug?: string | null;
  source_provider?: string | null;
  tournament_name?: string | null;
}

function feedItemKind(item: QuickTableCopyRef): string | undefined {
  return item.type ?? item.item_type;
}

/** Table name is the only shared key the feed rows expose. SQL is not required. */
function quickTableNameKey(name: string | null | undefined): string | null {
  const key = name?.trim().toLocaleLowerCase();
  return key ? key : null;
}

function isQuickTableFinalCard(item: QuickTableCopyRef): boolean {
  return feedItemKind(item) === "result" && item.source_provider === "quick_table";
}

function isQuickTableMatchCopy(item: QuickTableCopyRef): boolean {
  return feedItemKind(item) === "match" && /^qt-/i.test(item.slug ?? "");
}

/**
 * surface_quick_table_results copies semifinals into public.matches as
 * qt-{table}-{match}. The feed also shows the Quick Table final card.
 * Drop those copies only while the final card for the same table is in
 * the list. A table with no final card keeps its qt-* rows.
 */
export function hideQuickTableMatchCopies<T extends QuickTableCopyRef>(items: readonly T[]): T[] {
  const shownTables = new Set<string>();
  for (const item of items) {
    if (!isQuickTableFinalCard(item)) continue;
    const key = quickTableNameKey(item.tournament_name);
    if (key) shownTables.add(key);
  }
  if (shownTables.size === 0) return [...items];
  return items.filter((item) => {
    if (!isQuickTableMatchCopy(item)) return true;
    const key = quickTableNameKey(item.tournament_name);
    return key == null || !shownTables.has(key);
  });
}

/**
 * Recency-first ordering for the /feed Trending stream (directive from
 * Cuong, 2026-11-24: "the newest content must be at the top of the feed").
 *
 * Research basis: every major feed pairs engagement prediction with a
 * steep recency decay - X's open-source ranker multiplies its score by a
 * decay with a roughly 6-hour half-life, and its Following timeline is
 * pure reverse chronological; Instagram's Feed ranking lists "when a post
 * was shared" among its top signals and also offers a chronological
 * Latest view. ThePickleHub's Trending stream is a catch-up surface, not
 * an engagement-optimised one, so the ordering here drops the type
 * bonuses, the engagement multiplier, the viewed demotion and the random
 * jitter entirely: one shared timestamp per item, newest first.
 *
 * The shared timestamp is `ranked_at` when the item carries one (for RPC
 * rows that is when the result/post surfaced - verified_at/updated_at for
 * pro matches, played_at for community matches), otherwise
 * `published_at`. A livestream that is live right now sorts as "now"
 * while it is live. Future timestamps are clamped to now so an upcoming
 * event can never sit above fresher content until it starts, and items
 * with no parseable timestamp sink to the bottom. Ties break toward live
 * happenings, then by cursor_id DESC, so the order is deterministic
 * across renders.
 */
export interface FeedRecencyRef {
  type?: string;
  kind?: string;
  ranked_at?: string | null;
  published_at?: string | null;
  cursor_id?: string;
}

export function feedRecencyMs(item: FeedRecencyRef, nowMs: number): number {
  if (item.type === "happening" && item.kind === "live") return nowMs;
  const iso = item.ranked_at ?? item.published_at;
  const ms = iso ? Date.parse(iso) : Number.NaN;
  if (!Number.isFinite(ms)) return 0;
  return Math.min(ms, nowMs);
}

export function sortFeedByRecency<T extends FeedRecencyRef>(
  items: readonly T[],
  nowMs: number,
): T[] {
  return items.slice().sort((a, b) => {
    const diff = feedRecencyMs(b, nowMs) - feedRecencyMs(a, nowMs);
    if (diff !== 0) return diff;
    const aLive = a.type === "happening" && a.kind === "live" ? 1 : 0;
    const bLive = b.type === "happening" && b.kind === "live" ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    const ac = a.cursor_id ?? "";
    const bc = b.cursor_id ?? "";
    if (ac === bc) return 0;
    return ac < bc ? 1 : -1;
  });
}

/**
 * Seen-sink partition (Cuong directive, 2026-11-24): items the viewer has
 * already seen on a PREVIOUS visit move below every unseen item, keeping
 * their relative order inside each group. Nothing is removed - a seen item
 * is still reachable by scrolling. `seenIds` must be the snapshot taken
 * when the page loaded (see useFeedViewedTracking's viewedAtLoad), never
 * the live set: items marked during this visit must not jump around
 * mid-scroll. Applies to every content type, embeds included.
 */
export function partitionFeedBySeen<T>(
  items: readonly T[],
  seenIds: ReadonlySet<string>,
  cursorIdOf: (item: T) => string,
): T[] {
  if (seenIds.size === 0) return items.slice();
  const unseen: T[] = [];
  const seen: T[] = [];
  for (const item of items) {
    (seenIds.has(cursorIdOf(item)) ? seen : unseen).push(item);
  }
  return [...unseen, ...seen];
}

/**
 * Revival check (Facebook pattern): a seen item whose engagement has
 * grown since it was last marked has something new and leaves the seen
 * group. `entriesAtLoad` carries the engagement baseline stored at mark
 * time; `currentEngagement` carries the payload's current kudos +
 * comments for the items that have any. An item revives only when BOTH
 * numbers exist and the current one is strictly greater - with no
 * baseline or no payload signal, seen stays seen.
 */
export function computeEffectiveSeenIds(
  entriesAtLoad: ReadonlyMap<string, { e?: number }>,
  currentEngagement: ReadonlyMap<string, number>,
): Set<string> {
  const seen = new Set<string>();
  for (const [id, entry] of entriesAtLoad) {
    const current = currentEngagement.get(id);
    const revived =
      current !== undefined && entry.e !== undefined && current > entry.e;
    if (!revived) seen.add(id);
  }
  return seen;
}
