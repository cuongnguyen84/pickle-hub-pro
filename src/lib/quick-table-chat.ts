/**
 * Logic thuần cho "tạo giải chia bảng bằng chat".
 *
 * AI (edge function quick-table-chat) chỉ trả về bản vá nháp. Mọi quyết định
 * — hỏi câu nào tiếp theo, chia mấy bảng hợp lệ, ghép đôi, chia bảng — nằm ở
 * đây để luồng hội thoại luôn ổn định và mọi con số do code tính.
 */
import { distributePlayersToGroups, suggestGroupConfigs } from "@/lib/quick-table-utils";
import { maxSeries, type SeriesStyle } from "@/lib/quick-table-series";

export const MAX_CHAT_ENTRIES = 48; // trên 48 → large_playoff, chat không hỗ trợ

export interface Entry {
  p1: string;
  p2?: string;
  team?: string;
  seed?: number;
}

export type RosterMode = "now" | "later" | "registration";

export interface Draft {
  is_doubles?: boolean;
  player_count?: number;
  group_count?: number;
  name?: string;
  entries?: Entry[];
  roster_mode?: RosterMode;
  courts?: number[];
  start_time?: string;
  default_sets?: 1 | 3 | 5;
  /** số nhánh playoff sau vòng bảng (Series A/B/C), 1 = chỉ top 2 */
  series?: number;
  series_style?: SeriesStyle;
  /** giải đôi + danh sách toàn tên lẻ: đã chọn cách ghép */
  pairing_done?: boolean;
  /** đã qua bước "thêm tuỳ chọn" */
  options_done?: boolean;
  /** đã trả lời (hoặc bỏ qua) câu số sân / giờ bắt đầu */
  courts_done?: boolean;
  time_done?: boolean;
}

export type Slot =
  | "format"
  | "count"
  | "too_many"
  | "pairing"
  | "mismatch"
  | "groups"
  | "series"
  | "roster"
  | "paste"
  | "name"
  | "courts"
  | "start_time"
  | "options"
  | "confirm";

export function entryCount(d: Draft): number {
  return d.entries?.length ? d.entries.length : d.player_count ?? 0;
}

export function needsPairing(d: Draft): boolean {
  return !!d.is_doubles && !d.pairing_done && !!d.entries?.length && d.entries.every((e) => !e.p2);
}

export interface GroupOption {
  groupCount: number;
  sizes: number[];
  recommended: boolean;
  playoffSize: number;
  wildcards: number;
}

/** Cách chia bảng hợp lệ. Dưới 6 đội (hoặc không có cách nào) → 1 bảng vòng tròn. */
export function groupOptions(n: number): GroupOption[] {
  if (n < 2) return [];
  const suggestions = n < 6 ? [] : suggestGroupConfigs(n);
  if (suggestions.length === 0) {
    return [{ groupCount: 1, sizes: [n], recommended: true, playoffSize: 0, wildcards: 0 }];
  }
  return suggestions.map((s) => ({
    groupCount: s.groupCount,
    sizes: [...s.playersPerGroup].sort((a, b) => b - a),
    recommended: s.isRecommended,
    playoffSize: s.totalPlayoffSpots,
    wildcards: s.wildcardNeeded,
  }));
}

/** Cỡ các bảng của cách chia đã chọn (để tính nhánh trước khi có danh sách). */
export function groupSizes(d: Draft): number[] {
  return groupOptions(entryCount(d)).find((x) => x.groupCount === d.group_count)?.sizes ?? [];
}

/** Số nhánh tối đa với cách chia bảng đã chọn (1 nếu chưa chọn / không chia được). */
export function seriesCap(d: Draft): number {
  const o = groupOptions(entryCount(d)).find((x) => x.groupCount === d.group_count);
  return o && o.groupCount >= 2 ? maxSeries(o.sizes) : 1;
}

export function nextSlot(d: Draft): Slot {
  if (d.is_doubles === undefined) return "format";
  if (!d.entries?.length && !d.player_count) return "count";
  if (entryCount(d) > MAX_CHAT_ENTRIES) return "too_many";
  if (entryCount(d) < 2) return "count";
  if (needsPairing(d)) return "pairing";
  if (d.entries?.length && d.player_count != null && d.player_count !== d.entries.length) return "mismatch";
  if (!groupOptions(entryCount(d)).some((o) => o.groupCount === d.group_count)) return "groups";
  const cap = seriesCap(d);
  if (cap > 1 && (d.series == null || d.series > cap)) return "series";
  if (!d.entries?.length) {
    if (!d.roster_mode) return "roster";
    if (d.roster_mode === "now") return "paste";
  }
  if (!d.name?.trim()) return "name";
  if (!d.courts_done && !d.courts?.length) return "courts";
  // giờ chỉ có nghĩa khi có sân (lịch tự xếp theo sân + giờ)
  if (d.courts?.length && !d.time_done && !d.start_time) return "start_time";
  if (d.entries?.length && !d.options_done) return "options";
  return "confirm";
}

const clean = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, 60) : "";

function sanitizeEntries(raw: unknown): Entry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Entry[] = [];
  for (const r of raw.slice(0, 200)) {
    const e = (r ?? {}) as Record<string, unknown>;
    const p1 = clean(e.p1);
    if (!p1) continue;
    const p2 = clean(e.p2);
    const team = clean(e.team);
    const seed = Number(e.seed);
    out.push({
      p1,
      ...(p2 ? { p2 } : {}),
      ...(team ? { team } : {}),
      ...(Number.isInteger(seed) && seed > 0 ? { seed } : {}),
    });
  }
  return out;
}

/**
 * Áp bản vá từ AI vào nháp. Không tin AI: mọi trường đều được kiểm kiểu/khoảng.
 * Khi AI gửi danh sách mà không kèm số lượng → số lượng theo danh sách
 * (người dùng vừa sửa danh sách thì không hỏi lại "lệch số").
 */
export function applyPatch(d: Draft, patch: unknown): Draft {
  const p = (patch ?? {}) as Record<string, unknown>;
  const next: Draft = { ...d };
  if (typeof p.is_doubles === "boolean") {
    if (p.is_doubles !== d.is_doubles) next.pairing_done = false;
    next.is_doubles = p.is_doubles;
  }
  const entries = sanitizeEntries(p.entries);
  if (entries && entries.length) {
    next.entries = entries;
    next.roster_mode = "now";
    next.pairing_done = entries.some((e) => e.p2) || !!d.pairing_done;
  }
  const count = Number(p.player_count);
  if (Number.isInteger(count) && count >= 1 && count <= 500) next.player_count = count;
  else if (entries && entries.length) next.player_count = entries.length;
  const groups = Number(p.group_count);
  if (Number.isInteger(groups) && groups >= 1 && groups <= 26) next.group_count = groups;
  const name = clean(p.name);
  if (name) next.name = name.slice(0, 100);
  if (p.roster_mode === "later" || p.roster_mode === "registration") {
    if (!next.entries?.length) next.roster_mode = p.roster_mode;
  }
  if (Array.isArray(p.courts)) {
    const courts = [...new Set(p.courts.map(Number).filter((c) => Number.isInteger(c) && c > 0 && c < 100))];
    if (courts.length) { next.courts = courts; next.courts_done = true; }
  }
  if (typeof p.start_time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.start_time)) {
    next.start_time = p.start_time;
    next.time_done = true;
  }
  if (p.default_sets === 1 || p.default_sets === 3 || p.default_sets === 5) next.default_sets = p.default_sets;
  if (p.series === 1 || p.series === 2 || p.series === 3) next.series = p.series;
  if (p.series_style === "series" || p.series_style === "medal") next.series_style = p.series_style;
  return next;
}

export type PairingMode = "sequential" | "random" | "each_line";

/** Giải đôi mà danh sách toàn tên lẻ: ghép 1+2, 3+4… / ngẫu nhiên / mỗi dòng là 1 đội. */
export function pairEntries(entries: Entry[], mode: PairingMode, rand: () => number = Math.random): Entry[] {
  if (mode === "each_line") return entries;
  const list = [...entries];
  if (mode === "random") {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  const out: Entry[] = [];
  for (let i = 0; i + 1 < list.length; i += 2) {
    const a = list[i];
    const b = list[i + 1];
    out.push({ p1: a.p1, p2: b.p1, ...(a.team && a.team === b.team ? { team: a.team } : {}) });
  }
  return out;
}

const entryKey = (e: Entry) =>
  [e.p1, e.p2 ?? ""].map((s) => s.toLocaleLowerCase("vi").trim()).sort().join("|");

/** Chỉ số các dòng trùng (lần xuất hiện thứ 2 trở đi). */
export function duplicateIndexes(entries: Entry[]): Set<number> {
  const seen = new Set<string>();
  const dup = new Set<number>();
  entries.forEach((e, i) => {
    const k = entryKey(e);
    if (seen.has(k)) dup.add(i);
    else seen.add(k);
  });
  return dup;
}

export function entryLabel(e: Entry): string {
  return e.p2 ? `${e.p1} & ${e.p2}` : e.p1;
}

/** Payload cho setupRosterAtomic — cùng hình dạng QuickTableSetup.tsx gửi. */
export function buildRoster(d: Draft) {
  return (d.entries ?? []).map((e) => ({
    name: entryLabel(e),
    player1_name: e.p1,
    player2_name: e.p2,
    team: e.team,
    seed: e.seed,
  }));
}

/** Chia bảng xem trước; mảng trả về đưa thẳng vào setupRosterAtomic để bảng thấy = bảng tạo. */
export function previewAssignments(d: Draft): number[] {
  const k = d.group_count ?? 1;
  const roster = buildRoster(d);
  const buckets = distributePlayersToGroups(
    roster.map((p, i) => ({ id: String(i), name: p.name, team: p.team, seed: p.seed })),
    k,
  );
  const out = Array(roster.length).fill(0);
  buckets.forEach((bucket, g) => bucket.forEach((p) => { out[Number(p.id)] = g; }));
  return out;
}

export function defaultName(d: Draft, lang: "vi" | "en", now = new Date()): string {
  const date = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (lang === "en") return `${d.is_doubles === false ? "Singles" : "Doubles"} ${date}`;
  return `Giải ${d.is_doubles === false ? "đơn" : "đôi"} ${date}`;
}
