// ============================================================================
// World Cup 2026 results block — server-rendered from wc_pro_matches.
//
// The results page (/blog/pickleball-world-cup-2026-da-nang-results and its
// Vietnamese twin) is prose + a table that must be current. Regenerating the
// prose on a cron would mean a commit and a Cloudflare deploy per update — 16
// of them across the eight tournament days, each one a chance to break the
// build for a table that the database already holds. So the prose is static
// and only this block is live: the same wc_pro_matches rows the /live board
// reads, rendered to HTML at request time for the bot path and mounted as a
// React component for humans.
//
// ── Why the scores are labelled "ghi nhận" and not "chung cuộc" ─────────────
// wc_pro_matches keeps a completed match's LAST OBSERVED score, not an
// official final: the organizers' feed server-renders only scheduled and
// in_progress matches, so a match that finishes drops out and the scraper
// freezes what it last saw (see the migration header on 20260831140000).
// `leader_side` is the closest thing to a winner the source gives us. Calling
// that "chung cuộc" on a public results page would be a claim the data cannot
// support, so every table here says ghi nhận / as recorded and carries the
// footnote. This matters more than it looks: a wrong champion name is the one
// error that gets screenshotted and shared.
//
// Cached like any other prerender, but the two results paths get the 5-minute
// TTL from pathCacheTtl rather than the 6-hour default — see _middleware.ts.
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

/** Vietnam-time calendar day (GMT+7, no DST) for an ISO timestamp. */
export function vnDayKey(iso: string | null): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

function dayHeading(dayKey: string, lang: Lang): string {
  const [y, m, d] = dayKey.split("-");
  if (!y) return lang === "vi" ? "Chưa xác định ngày" : "Date unknown";
  return lang === "vi" ? `Ngày ${Number(d)}/${Number(m)}/${y}` : `${y}-${m}-${d}`;
}

/** The side the source last had in front, as a name. Never inferred from the
 *  score: a frozen last-observed game can read 14-16 for the eventual winner. */
function recordedWinner(m: WcResultRow): string {
  if (m.leader_side === "A") return m.entry_a_name ?? "";
  if (m.leader_side === "B") return m.entry_b_name ?? "";
  return "";
}

function matchRowCells(m: WcResultRow, lang: Lang): string {
  const event = EVENT_LABEL[m.category_id]?.[lang] ?? m.category_id;
  const dash = lang === "vi" ? "chưa có" : "not recorded";
  return (
    `<td>${escapeHtml(event)}</td>` +
    `<td>${escapeHtml(m.round_name ?? "")}</td>` +
    `<td>${escapeHtml(m.entry_a_name ?? "")} — ${escapeHtml(m.entry_b_name ?? "")}</td>` +
    `<td>${escapeHtml(scoreLine(m as never) || dash)}</td>` +
    `<td>${escapeHtml(recordedWinner(m) || dash)}</td>`
  );
}

function table(headers: string[], bodyRows: string[]): string {
  return (
    `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>` +
    `<tbody>${bodyRows.join("")}</tbody></table>`
  );
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
  let rows: WcResultRow[];
  try {
    const res = await supabase
      .from("wc_pro_matches")
      .select(SELECT_COLS)
      .order("last_seen_at", { ascending: false })
      .limit(500);
    if (res.error) return empty;
    rows = (res.data ?? []) as WcResultRow[];
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
    ? ["Nội dung", "Vòng", "Cặp đấu", "Tỉ số ghi nhận", "Dẫn/thắng"]
    : ["Event", "Round", "Match", "Score as recorded", "Ahead / won"];

  const parts: string[] = [];

  if (live.length > 0) {
    parts.push(`<h3>${vi ? "Đang thi đấu" : "On court now"}</h3>`);
    parts.push(table(headers, live.map((m) => `<tr>${matchRowCells(m, lang)}</tr>`)));
  }

  // Completed matches, newest calendar day first. Grouping by Vietnam-time day
  // is what makes this a "results by day" page rather than one long list.
  const byDay = new Map<string, WcResultRow[]>();
  for (const m of done) {
    const key = vnDayKey(m.last_seen_at ?? m.scheduled_at);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(m);
    else byDay.set(key, [m]);
  }
  const days = [...byDay.keys()].sort().reverse();
  for (const day of days) {
    const dayRows = byDay.get(day) ?? [];
    parts.push(`<h3>${escapeHtml(dayHeading(day, lang))}</h3>`);
    parts.push(table(headers, dayRows.map((m) => `<tr>${matchRowCells(m, lang)}</tr>`)));
  }

  const vnCount = done.filter((m) => m.is_vietnam).length;
  parts.push(
    `<p>${
      vi
        ? `Tổng cộng ${done.length} trận Pro đã ghi nhận kết quả, trong đó ${vnCount} trận có vận động viên Việt Nam. Tỉ số là giá trị cuối cùng ThePickleHub ghi nhận được từ hệ thống của ban tổ chức trước khi trận rời khỏi bảng trực tiếp — không phải kết quả chính thức, và cột cuối là bên đang dẫn ở thời điểm đó.`
        : `${done.length} Pro matches have a recorded result, ${vnCount} of them involving a Vietnamese player. Scores are the last value ThePickleHub observed in the organisers' live feed before the match left it — not an official final — and the last column is the side ahead at that moment.`
    }</p>`,
  );

  return {
    html: `<div class="wc-results-block">${parts.join("")}</div>`,
    dataUpdatedAt,
    completedCount: done.length,
    liveCount: live.length,
  };
}
