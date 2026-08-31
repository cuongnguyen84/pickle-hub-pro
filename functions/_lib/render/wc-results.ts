// ============================================================================
// World Cup 2026 results block — server-rendered from wc_pro_matches.
//
// The results article is prose + a table that must be current. Regenerating the
// prose on a cron would mean a commit and a Cloudflare deploy per update — 16
// across the eight tournament days, each one a chance to break the build for a
// table the database already holds. So the prose is static and only this block
// is live: the same wc_pro_matches rows the /live board reads, rendered to HTML
// at request time for the bot path and mounted as React for humans.
//
// ── What the table contains ────────────────────────────────────────────────
// Every completed Pro match, read off the bracket pages, plus whatever is on
// court right now. The scraper kept only Vietnamese finals until 2026-08-31;
// widening it moved the row-count problem here, which is where it belongs:
// reads are paginated past PostgREST's 1000-row ceiling, and the page spends a
// display budget rather than dropping data.
//
// The budget spends newest-first: recent playing days render complete, and once
// the budget runs out the remaining older days render their Vietnamese matches
// only. Vietnamese results are never dropped — they are the archive this
// audience comes back for, and they are the smallest slice, so protecting them
// costs almost nothing. The footnote says exactly this rather than letting a
// reader guess why an older day looks short.
//
// ── Where a score comes from ───────────────────────────────────────────────
// A completed row is the bracket page's own per-game final with the winner the
// bracket declares, so it is a real result, not a frozen snapshot. The one
// exception is the stopgap: a Vietnamese match that leaves the live feed before
// its bracket syncs keeps its last observed score for a cycle or two. That is
// rare and short-lived, so the page states the provenance once rather than
// hedging every row into uselessness.
//
// ── Dates ──────────────────────────────────────────────────────────────────
// Two different clocks, and mixing them puts an evening match on tomorrow:
//   * scheduled_at is the organizers' Vietnam wall-clock stored verbatim (see
//     the column comment on the migration) — take its date as-is, no shift.
//   * last_seen_at is a real server timestamp in UTC — shift +7 for Vietnam.
// scheduled_at wins when present because it is the day the match was PLAYED;
// last_seen_at is only when we noticed.
//
// Cached like any other prerender, but both results paths get the 5-minute TTL
// from pathCacheTtl rather than the 6-hour default — see _middleware.ts.
// ============================================================================

import type { SupabaseClient } from "../supabase";
import { escapeHtml } from "../utils";
import { scoreLine } from "../../../src/components/live/wc-score";

/** The wc_pro_matches columns this block needs. Structurally compatible with
 *  WcProMatchRow in src/hooks/useWcProLive.ts — declared locally so the SSR
 *  path carries no dependency on the React hook module. */
export interface WcResultRow {
  match_id: string;
  category_id: string;
  round_name: string | null;
  entry_a_name: string | null;
  entry_b_name: string | null;
  current_a: number | null;
  current_b: number | null;
  games_json: { a: number; b: number }[] | null;
  leader_side: "A" | "B" | null;
  status: "scheduled" | "in_progress" | "completed";
  is_vietnam: boolean;
  court_label: string | null;
  scheduled_at: string | null;
  last_seen_at: string | null;
}

const SELECT_COLS =
  "match_id,category_id,round_name,entry_a_name,entry_b_name,current_a,current_b," +
  "games_json,leader_side,status,is_vietnam,court_label,scheduled_at,last_seen_at";

// PostgREST returns at most 1000 rows and reports the truncation only in
// Content-Range, so an unpaginated read looks fine while silently returning a
// prefix — the oldest days, on a page whose value is the archive.
const PAGE = 1000;
/** Hard ceiling on rows read, so a runaway feed cannot hang the render. */
const MAX_ROWS = 6000;
/** Completed rows rendered in full before the budget starts protecting only
 *  Vietnamese matches. ~600 rows is ~90 KB of table HTML — enough for several
 *  playing days, small enough for a phone on a Vietnamese mobile network. */
const DISPLAY_CAP = 600;

export const EVENT_LABEL: Record<string, { en: string; vi: string }> = {
  pro_singles_mens: { en: "Men's Pro Singles", vi: "Đơn Pro nam" },
  pro_singles_womens: { en: "Women's Pro Singles", vi: "Đơn Pro nữ" },
  pro_doubles_mens: { en: "Men's Pro Doubles", vi: "Đôi Pro nam" },
  pro_doubles_womens: { en: "Women's Pro Doubles", vi: "Đôi Pro nữ" },
  pro_mixed: { en: "Mixed Pro Doubles", vi: "Đôi Pro nam nữ" },
};

export type Lang = "en" | "vi";

export interface WcResultsBlock {
  /** Bot-visible HTML for the block, or "" when the feed is empty. */
  html: string;
  /** Newest last_seen_at across the rows — the page's real dateModified. */
  dataUpdatedAt: string | null;
  completedCount: number;
  liveCount: number;
}

/** Vietnam-time calendar day for a real UTC timestamp (GMT+7, no DST). */
export function vnDayFromUtc(iso: string | null | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * The Vietnam day a match belongs to. scheduled_at is already Vietnam
 * wall-clock, so its date is taken verbatim; shifting it by +7 would push every
 * evening match onto the following day. last_seen_at is a genuine UTC instant
 * and is only a fallback.
 */
export function matchDayKey(row: Pick<WcResultRow, "scheduled_at" | "last_seen_at">): string {
  const sched = row.scheduled_at;
  if (sched && !Number.isNaN(Date.parse(sched))) return sched.slice(0, 10);
  return vnDayFromUtc(row.last_seen_at);
}

/** "17:42 · 31/8/2026" in Vietnam time, from a UTC instant. */
export function vnStamp(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} · ${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

function dayHeading(dayKey: string, lang: Lang): string {
  const [y, m, d] = dayKey.split("-");
  if (!y) return lang === "vi" ? "Chưa xác định ngày" : "Date unknown";
  return lang === "vi" ? `Ngày ${Number(d)}/${Number(m)}/${y}` : `${y}-${m}-${d}`;
}

/** The winner the bracket declares. Never inferred from the score: a stopgap
 *  row's last observed game can read behind for the side that went on to win. */
function winnerName(m: WcResultRow): string {
  if (m.leader_side === "A") return m.entry_a_name ?? "";
  if (m.leader_side === "B") return m.entry_b_name ?? "";
  return "";
}

function matchRowCells(m: WcResultRow, lang: Lang): string {
  const event = EVENT_LABEL[m.category_id]?.[lang] ?? m.category_id;
  const dash = lang === "vi" ? "chưa có" : "not recorded";
  const flag = m.is_vietnam ? ' <span aria-hidden="true">🇻🇳</span>' : "";
  return (
    `<td>${escapeHtml(event)}</td>` +
    `<td>${escapeHtml(m.round_name ?? "")}</td>` +
    `<td>${escapeHtml(m.entry_a_name ?? "")} — ${escapeHtml(m.entry_b_name ?? "")}${flag}</td>` +
    `<td>${escapeHtml(scoreLine(m as never) || dash)}</td>` +
    `<td>${escapeHtml(winnerName(m) || dash)}</td>`
  );
}

function table(headers: string[], bodyRows: string[]): string {
  return (
    `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${bodyRows.join("")}</tbody></table>`
  );
}

export interface WcDisplayDay {
  day: string;
  matches: WcResultRow[];
}

/**
 * Group completed matches by playing day, newest first, spending a row budget.
 *
 * Whole days render until the budget is gone; after that a day contributes only
 * its Vietnamese matches. Never drops a Vietnamese result — that is the archive
 * this page exists for, and it is the smallest slice, so protecting it is
 * nearly free. `trimmed` tells the caller whether to explain the shortfall.
 */
export function selectDaysForDisplay<T extends WcResultRow>(
  done: T[],
  cap: number,
): { days: { day: string; matches: T[] }[]; trimmed: boolean } {
  const byDay = new Map<string, T[]>();
  for (const m of done) {
    const key = matchDayKey(m);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(m);
    else byDay.set(key, [m]);
  }
  const ordered = [...byDay.keys()].sort().reverse();

  const days: { day: string; matches: T[] }[] = [];
  let spent = 0;
  let trimmed = false;
  for (const day of ordered) {
    const all = byDay.get(day) ?? [];
    if (spent + all.length <= cap) {
      days.push({ day, matches: all });
      spent += all.length;
      continue;
    }
    const vn = all.filter((m) => m.is_vietnam);
    if (vn.length !== all.length) trimmed = true;
    if (vn.length > 0) days.push({ day, matches: vn });
    spent += vn.length;
  }
  return { days, trimmed };
}

/**
 * Fetch wc_pro_matches and render the results block.
 *
 * Never throws: a Supabase outage during the tournament must degrade to the
 * static prose, not to a 500 on a page Google is crawling every few minutes.
 */
export async function fetchWcResultsBlock(
  supabase: SupabaseClient,
  lang: Lang,
): Promise<WcResultsBlock> {
  const empty: WcResultsBlock = { html: "", dataUpdatedAt: null, completedCount: 0, liveCount: 0 };
  const rows: WcResultRow[] = [];
  try {
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const res = await supabase
        .from("wc_pro_matches")
        .select(SELECT_COLS)
        .order("last_seen_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (res.error) return empty;
      const page = (res.data ?? []) as WcResultRow[];
      rows.push(...page);
      if (page.length < PAGE) break;
    }
  } catch {
    return empty;
  }
  if (rows.length === 0) return empty;

  const live = rows.filter((r) => r.status === "in_progress");
  const done = rows.filter((r) => r.status === "completed");
  const dataUpdatedAt =
    rows.map((r) => r.last_seen_at).filter((v): v is string => !!v).sort().pop() ?? null;

  const vi = lang === "vi";
  const headers = vi
    ? ["Nội dung", "Vòng", "Cặp đấu", "Tỉ số", "Thắng"]
    : ["Event", "Round", "Match", "Score", "Winner"];

  const parts: string[] = [];

  // Dateline. Generated, never typed: a "cập nhật liên tục" claim with a
  // hand-written date is a promise nobody can check, and it is the first thing
  // an AI answer quotes back when it cites the page.
  const stamp = vnStamp(dataUpdatedAt);
  if (stamp) {
    parts.push(
      `<p>${
        vi
          ? `Cập nhật lần cuối: ${escapeHtml(stamp)} (giờ Việt Nam). ${done.length} trận đã có kết quả, ${live.length} trận đang thi đấu.`
          : `Last updated ${escapeHtml(stamp)} Vietnam time. ${done.length} matches have a result, ${live.length} on court now.`
      }</p>`,
    );
  }

  if (live.length > 0) {
    parts.push(`<h3>${vi ? "Đang thi đấu" : "On court now"}</h3>`);
    parts.push(table(headers, live.map((m) => `<tr>${matchRowCells(m, lang)}</tr>`)));
  }

  // Completed matches, newest playing day first, spending the display budget.
  const { days, trimmed } = selectDaysForDisplay(done, DISPLAY_CAP);
  for (const d of days) {
    parts.push(`<h3>${escapeHtml(dayHeading(d.day, lang))}</h3>`);
    parts.push(table(headers, d.matches.map((m) => `<tr>${matchRowCells(m, lang)}</tr>`)));
  }

  const trimNote = vi
    ? " Những ngày cũ hơn chỉ hiển thị các trận có vận động viên Việt Nam, để trang không quá nặng trên điện thoại."
    : " Older days list only the matches involving a Vietnamese player, to keep the page light on a phone.";
  parts.push(
    `<p>${
      vi
        ? "Bảng này gồm mọi trận Pro đang thi đấu và mọi trận Pro đã kết thúc ở năm nội dung cá nhân Pro. Tỉ số lấy từ trang nhánh đấu chính thức của giải, kèm người thắng do nhánh đấu công bố. Một trận vừa rời bảng trực tiếp mà nhánh đấu chưa cập nhật sẽ tạm hiển thị tỉ số ThePickleHub ghi nhận cuối cùng, và được thay bằng kết quả chính thức ở lượt quét sau."
        : "This table covers every Pro match on court now and every completed match across the five Pro individual draws. Scores come from the tournament's own bracket pages, with the winner the bracket declares. A match that has just left the live feed before its bracket syncs shows the last score ThePickleHub observed, replaced by the official result on the next pass."
    }${trimmed ? escapeHtml(trimNote) : ""}</p>`,
  );

  return {
    html: `<div class="wc-results-block">${parts.join("")}</div>`,
    dataUpdatedAt,
    completedCount: done.length,
    liveCount: live.length,
  };
}
