/**
 * Logic thuần cho "tạo giải chia bảng bằng chat".
 *
 * AI (edge function quick-table-chat) chỉ trả về bản vá nháp. Mọi quyết định
 * — hỏi câu nào tiếp theo, chia mấy bảng hợp lệ, ghép đôi, chia bảng — nằm ở
 * đây để luồng hội thoại luôn ổn định và mọi con số do code tính.
 */
import { distributePlayersToGroups, suggestGroupConfigs } from "@/lib/quick-table-utils";
import { MAX_SERIES, maxSeries, rankSeriesSizes, resolveSeriesSizes, seriesLine, seriesName, seriesPlan, slot, type SeriesSlot, type SeriesStyle } from "@/lib/quick-table-series";

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
  /** cỡ từng nhánh do người dùng đặt (vd [16, 14, 14]); có thì thay cho luật mặc định */
  series_sizes?: number[];
  /** đúng N đội/VĐV mỗi bảng vào vòng knockout — không lấy thêm hạng 3 */
  advance_per_group?: number;
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

export const MIN_GROUP = 3;
export const MAX_GROUP = 8;
export const MAX_GROUPS = 16;

/**
 * Số bảng tuỳ ý (vd 44 đội → 11 bảng × 4): chia đều, bảng 3–8 đội.
 * Playoff 1 nhánh tính theo cùng luật Series A (nhất + nhì + vé vớt hạng 3).
 */
export function customGroupOption(n: number, g: number): GroupOption | null {
  if (!Number.isInteger(g) || g < 2 || g > MAX_GROUPS) return null;
  const sizes = Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0));
  if (sizes[g - 1] < MIN_GROUP || sizes[0] > MAX_GROUP) return null;
  const a = seriesPlan(sizes, 1)![0];
  return { groupCount: g, sizes, recommended: false, playoffSize: a.bracket, wildcards: a.size - 2 * g };
}

/** Cách chia đã chọn: theo gợi ý chuẩn, không có thì theo số bảng tuỳ ý. */
export function findGroupOption(n: number, g: number | undefined): GroupOption | null {
  if (g == null) return null;
  return groupOptions(n).find((o) => o.groupCount === g) ?? customGroupOption(n, g);
}

/** Gợi ý chuẩn + một cách "bảng 4 đội" (giải đông hay muốn bảng nhỏ cho nhanh). */
export function groupChoices(n: number): GroupOption[] {
  const base = groupOptions(n);
  const four = customGroupOption(n, Math.round(n / 4));
  return four && n >= 12 && !base.some((o) => o.groupCount === four.groupCount) ? [...base, four] : base;
}

/** Cỡ các bảng của cách chia đã chọn (để tính nhánh trước khi có danh sách). */
export function groupSizes(d: Draft): number[] {
  return findGroupOption(entryCount(d), d.group_count)?.sizes ?? [];
}

/** Số nhánh tối đa với cách chia bảng đã chọn (1 nếu chưa chọn / không chia được). */
export function seriesCap(d: Draft): number {
  const o = findGroupOption(entryCount(d), d.group_count);
  return o && o.groupCount >= 2 ? maxSeries(o.sizes) : 1;
}

/** Cỡ nhánh tuỳ chỉnh còn hợp lệ với số đội hiện tại (đổi danh sách có thể làm nó sai). */
export function customSeries(d: Draft): number[] | null {
  return d.series_sizes ? resolveSeriesSizes(d.series_sizes, entryCount(d)) : null;
}

/** Các nhánh sẽ tạo: tuỳ chỉnh nếu có, không thì theo luật mặc định; null = 1 nhánh mặc định. */
export function draftSeriesPlan(d: Draft): SeriesSlot[] | null {
  const custom = customSeries(d);
  if (custom) return custom.map(slot);
  const k = Math.min(d.series ?? 1, seriesCap(d));
  return k > 1 ? seriesPlan(groupSizes(d), k) : null;
}

export function nextSlot(d: Draft): Slot {
  if (d.is_doubles === undefined) return "format";
  if (!d.entries?.length && !d.player_count) return "count";
  if (entryCount(d) > MAX_CHAT_ENTRIES) return "too_many";
  if (entryCount(d) < 2) return "count";
  if (needsPairing(d)) return "pairing";
  if (d.entries?.length && d.player_count != null && d.player_count !== d.entries.length) return "mismatch";
  if (!findGroupOption(entryCount(d), d.group_count)) return "groups";
  const cap = seriesCap(d);
  if (cap > 1 && !customSeries(d) && (d.series == null || d.series > cap)) return "series";
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
  if (p.series === 1 || p.series === 2 || p.series === 3) {
    next.series = p.series;
    next.series_sizes = undefined;
    if (p.advance_per_group == null) next.advance_per_group = undefined;
  }
  if (Array.isArray(p.series_sizes) && p.series_sizes.length) {
    const sizes = resolveSeriesSizes(p.series_sizes, entryCount(next));
    if (sizes) { next.series_sizes = sizes; next.series = sizes.length; }
  }
  if (p.series_style === "series" || p.series_style === "medal") next.series_style = p.series_style;
  if (p.series_mode === "by_rank") {
    const sizes = rankSeriesSizes(groupSizes(next));
    if (sizes) {
      next.series_sizes = sizes;
      next.series = sizes.length;
      next.advance_per_group = undefined;
      if (sizes.length > MAX_SERIES) next.series_style = "series";
    }
  }
  const adv = Number(p.advance_per_group);
  if (p.advance_per_group === null) next.advance_per_group = undefined;
  else if (Number.isInteger(adv) && adv >= 1 && adv <= 8) next.advance_per_group = adv;
  return lockAdvance(next);
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

// ---------- đọc bảng tính tại chỗ (không qua AI) ----------

const HEADER_TEAM = /^(tên\s*)?(đội|team|cặp|cap|doi)(\s*name)?$/i;
const HEADER_PLAYER = /(vđv|vdv|vận động viên|van dong vien|player|họ\s*(và\s*)?tên|ho\s*ten|^tên|^ten|^name|người chơi|nguoi choi|thành viên|member|athlete)/i;
const HEADER_CLUB = /^(clb|club|câu lạc bộ|cau lac bo|đơn vị|don vi)$/i;
const HEADER_ANY = /^(stt|tt|#|no\.?|số|sdt|sđt|phone|điện thoại|dien thoai|email|ghi chú|note|trạng thái|status|tiền|lệ phí|phí|ck|dupr|trình|level|giới tính|gender)/i;
const PAIR_SPLIT = /\s+(?:-|–|&|\/|\+|và|and)\s+|\s*[&/+]\s*/i;

/** Ô có phải tên người/đội không: có chữ, không phải số / SĐT / tiền / ngày / trạng thái. */
function isNameCell(s: string): boolean {
  if (!/\p{L}/u.test(s)) return false;
  if (s.split(/\s+/).length > 5 || /https?:|@/.test(s)) return false;
  if (/^(đã|chưa|da|chua)\s*(ck|chuyển|chuyen|đóng|dong|tt)/i.test(s)) return false;
  // nhãn đánh số ("Team 01", "Đội 5") không phải tên người
  if (/^(team|đội|doi|cặp|cap|nhóm|nhom|pair)\s*#?\d+$/i.test(s)) return false;
  // "Nam" là tên phổ biến nên không coi là giới tính
  if (/^(nữ|male|female|x|ok|có|không|yes|no)$/i.test(s)) return false;
  return !/^[\d\s.,:/+()kđ₫vndVND-]+$/.test(s);
}

const splitPair = (s: string): Entry => {
  const parts = s.split(PAIR_SPLIT).map(clean).filter(Boolean);
  return parts.length === 2 ? { p1: parts[0], p2: parts[1] } : { p1: clean(s) };
};

/**
 * Bảng tính (mỗi hàng = mảng ô) → danh sách đội/VĐV.
 * Có dòng tiêu đề thì theo tên cột (Đội / VĐV 1 / VĐV 2 / CLB); không có thì lấy
 * 1–2 ô tên đầu tiên mỗi hàng. Ô "Nam - Hùng" được tách thành cặp.
 * Trả [] nếu không nhận ra danh sách → để AI đọc.
 * doubles: không có tiêu đề thì chỉ nhận hai tên đứng cạnh nhau (hai ô liền, hoặc "Nam - Hùng").
 * Không đòi cột tên đội.
 */
export function parseSheet(rows: string[][], opts?: { doubles?: boolean }): Entry[] {
  const grid = rows.map((r) => r.map((c) => String(c ?? "").replace(/\s+/g, " ").trim())).filter((r) => r.some(Boolean));
  if (!grid.length) return [];
  const headerLabel = (c: string) => c.length <= 40 && c.split(/\s+/).length <= 4
    && (HEADER_TEAM.test(c) || HEADER_PLAYER.test(c) || HEADER_CLUB.test(c) || HEADER_ANY.test(c));
  const headerAt = grid.slice(0, 5).findIndex((r) => {
    const cells = r.filter(Boolean);
    return cells.length > 0 && cells.every(headerLabel)
      && cells.some((c) => headerLabel(c) && (HEADER_TEAM.test(c) || HEADER_PLAYER.test(c)));
  });
  const out: Entry[] = [];
  if (headerAt >= 0) {
    const h = grid[headerAt];
    const team = h.findIndex((c) => HEADER_TEAM.test(c));
    const players = h.map((c, i) => (HEADER_PLAYER.test(c) && !HEADER_TEAM.test(c) ? i : -1)).filter((i) => i >= 0);
    const club = h.findIndex((c) => HEADER_CLUB.test(c));
    for (const r of grid.slice(headerAt + 1)) {
      const ps = players.map((i) => r[i] ?? "").filter(isNameCell);
      const clubName = club >= 0 && r[club] ? clean(r[club]) : "";
      let e: Entry | null = null;
      if (ps.length >= 2) e = { p1: clean(ps[0]), p2: clean(ps[1]) };
      else if (ps.length === 1) e = splitPair(ps[0]);
      else if (team >= 0 && isNameCell(r[team] ?? "")) e = splitPair(r[team]);
      if (e?.p1) out.push(clubName ? { ...e, team: clubName } : e);
    }
    return out;
  }
  const doubles = opts?.doubles === true;
  for (const r of grid) {
    const inline = r.map((cell) => splitPair(cell)).find((e) => e.p2 && isNameCell(e.p1) && isNameCell(e.p2));
    if (inline?.p2) { out.push(inline); continue; }
    let paired = false;
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i] ?? "";
      const b = r[i + 1] ?? "";
      if (isNameCell(a) && isNameCell(b)) {
        out.push({ p1: clean(a), p2: clean(b) });
        paired = true;
        break;
      }
    }
    if (paired || doubles) continue;
    const names = r.filter(isNameCell);
    if (names.length) out.push({ p1: clean(names[0]) });
  }
  return out;
}

export interface GoogleSheetRef {
  id: string;
  gid?: string;
  published: boolean;
}

/** Link Google Sheet trong tin nhắn. Chỉ nhận id, không nhận URL tuỳ ý. */
export function googleSheetRef(text: string): GoogleSheetRef | null {
  const m = text.match(/https?:\/\/docs\.google\.com\/spreadsheets\/d\/(e\/)?([a-zA-Z0-9_-]{10,})/i);
  if (!m) return null;
  const gid = text.match(/[#?&]gid=(\d+)/)?.[1];
  return { id: m[2], published: !!m[1], ...(gid ? { gid } : {}) };
}

/** Ít nhất hai dòng có tên. Bảng toàn số, trạng thái CK, hay một dòng tiêu đề thì không phải danh sách. */
export function looksLikeNameList(text: string): boolean {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const named = lines.filter((line) => isNameCell(line) || line.split(/[\t,;|]/).some((cell) => isNameCell(cell.trim())));
  return named.length >= 2;
}

/** Gộp danh sách mới vào danh sách đang có. Trùng tên thì bỏ. Dừng ở trần chat. */
export function mergeRoster(existing: Entry[] | undefined, incoming: Entry[]): Entry[] {
  const key = (e: Entry) => [e.p1, e.p2 ?? ""].map((s) => s.trim().toLocaleLowerCase("vi")).join("\0");
  const seen = new Set((existing ?? []).map(key));
  const out = [...(existing ?? [])];
  for (const e of incoming) {
    if (!e.p1?.trim()) continue;
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= MAX_CHAT_ENTRIES) break;
  }
  return out;
}

/**
 * AI hay tự điền mặc định cho trường người dùng chưa hề nhắc (vd "8 sân" →
 * start_time 08:00, đọc file → series 1). Chỉ giữ các trường tuỳ chọn khi
 * đúng bước đang hỏi hoặc tin nhắn có nhắc tới.
 */
/** "nhất vào A, nhì vào B" — không phải "nhất nhì cùng vào A". */
export function wantsRankSeries(text: string): boolean {
  const t = text.toLocaleLowerCase("vi");
  if (/mỗi hạng|moi hang|từng hạng|tung hang|mỗi thứ hạng|each place|each rank|one series per|per place/.test(t)) return true;
  const toA = /nhất\s*(?:bảng\s*)?(?:vào|sang|→|->)\s*(?:series\s*)?a\b/.test(t) && /nhì\s*(?:bảng\s*)?(?:vào|sang|→|->)/.test(t);
  const toEn = /1st\s*(?:place\s*)?(?:to|into)\s*(?:series\s*)?a\b/.test(t) && /2nd\s*(?:place\s*)?(?:to|into)/.test(t);
  return toA || toEn;
}

export function trustPatch(patch: unknown, text: string, slot: Slot): Record<string, unknown> {
  const p = { ...((patch ?? {}) as Record<string, unknown>) };
  const t = text.toLocaleLowerCase("vi");
  const said = (re: RegExp) => re.test(t);
  const byRank = wantsRankSeries(text);
  if (slot !== "start_time" && !said(/\d\s*(h|g|giờ|gio|:\d)|\b(am|pm)\b|sáng|chiều|tối|trưa|morning|evening|o'?clock/)) delete p.start_time;
  if (slot !== "courts" && !said(/sân|san\b|court/)) delete p.courts;
  if (slot !== "series" && !said(/nhánh|nhanh|series|vàng|bạc|đồng|gold|silver|bronze|top\s*\d|bracket|vòng trong|vòng loại|knockout|playoff/) && !byRank) {
    delete p.series; delete p.series_style; delete p.series_sizes; delete p.series_mode;
  }
  if (byRank) {
    p.series_mode = "by_rank";
    delete p.series;
    delete p.series_sizes;
  }
  if (!said(/set|bo\d|best of|ván|van\b/)) delete p.default_sets;
  return p;
}

/** Trả lời bước số sân/giờ không cần AI: "8", "8 sân", "4 courts" / "7h", "19:30", "7h30". */
export function localSlotPatch(text: string, slot: Slot): Partial<Draft> | null {
  const t = text.toLocaleLowerCase("vi").trim();
  if (slot === "courts") {
    const m = t.match(/^(\d{1,2})\s*(sân|san|courts?)?$/);
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= 50 ? { courts: Array.from({ length: n }, (_, i) => i + 1), courts_done: true } : null;
  }
  if (slot === "start_time") {
    const m = t.match(/^(\d{1,2})\s*(?:h|g|giờ|:)?\s*(\d{2})?$/);
    if (!m) return null;
    const h = Number(m[1]);
    const mm = Number(m[2] ?? 0);
    if (h > 23 || mm > 59) return null;
    return { start_time: `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, time_done: true };
  }
  return null;
}

/**
 * Số liệu do code tính, gửi kèm cho AI để nó TRẢ LỜI câu hỏi ("11 bảng thì lấy
 * thế nào vào vòng trong?") bằng con số thật thay vì tự bịa.
 */
export function chatFacts(d: Draft, lang: "vi" | "en"): string {
  const n = entryCount(d);
  if (n < 2) return "";
  const u = d.is_doubles === false ? (lang === "en" ? "players" : "VĐV") : (lang === "en" ? "teams" : "đội");
  const style = d.series_style ?? "series";
  const range = (o: GroupOption) => (o.sizes[0] === o.sizes[o.sizes.length - 1] ? `${o.sizes[0]}` : `${o.sizes[o.sizes.length - 1]}–${o.sizes[0]}`);
  const describe = (o: GroupOption) => {
    if (o.groupCount < 2) return `1 bảng vòng tròn ${n} ${u}, không có playoff.`;
    const a = seriesPlan(o.sizes, 1)![0];
    const wc = a.size - 2 * o.groupCount;
    const lines = [
      `${o.groupCount} bảng × ${range(o)} ${u}: playoff 1 nhánh lấy nhất + nhì ${o.groupCount} bảng = ${2 * o.groupCount}` +
        (wc > 0 ? ` + ${wc} đội hạng 3 tốt nhất = ${a.size}` : "") +
        ` → cây ${a.bracket}${a.byes ? ` (${a.byes} đội xếp cao miễn vòng 1)` : ""}; ${n - a.size} ${u} bị loại.`,
    ];
    for (let k = 2; k <= MAX_SERIES; k++) {
      const plan = seriesPlan(o.sizes, k);
      if (plan) {
        lines.push(`  ${k} nhánh mặc định: ${plan.map((sl, i) => seriesLine(seriesName(style, i, "vi"), sl, "vi", u)).join("; ")}.`);
        continue;
      }
      // Luật mặc định không ra k nhánh (vd bảng 4 đội không có hạng 5) → gợi ý cỡ tuỳ chỉnh.
      let top = 1;
      while (top * 2 <= n / 2) top *= 2;
      const alt = resolveSeriesSizes([top, ...Array(k - 1).fill(0)], n);
      lines.push(`  ${k} nhánh theo luật mặc định: KHÔNG chia được.` +
        (alt ? ` Muốn ${k} nhánh thì đặt cỡ tuỳ chỉnh, ví dụ ${alt.map(slot).map((sl, i) => seriesLine(seriesName(style, i, "vi"), sl, "vi", u)).join("; ")}.` : ""));
    }
    return lines.join("\n");
  };
  const options = groupChoices(n);
  const chosen = findGroupOption(n, d.group_count);
  if (chosen && !options.some((o) => o.groupCount === chosen.groupCount)) options.push(chosen);
  const plan = draftSeriesPlan(d);
  return [
    `Số ${u}: ${n}.`,
    `Chia bảng: bảng ${MIN_GROUP}–${MAX_GROUP} ${u}, 2–${MAX_GROUPS} bảng, số bảng nào cũng được nếu chia đều nằm trong khoảng đó. Một số cách:`,
    ...options.map(describe),
    chosen ? `Đang chọn: ${chosen.groupCount} bảng × ${range(chosen)}.` : "Chưa chọn cách chia bảng.",
    d.advance_per_group && d.group_count
      ? `ĐÃ CHỐT: đúng ${d.advance_per_group} mỗi bảng = ${d.advance_per_group * d.group_count} vào vòng knockout. KHÔNG lấy thêm hạng 3, KHÔNG vé vớt.`
      : "",
    plan ? `Nhánh đang chọn: ${plan.map((sl, i) => seriesLine(seriesName(style, i, "vi"), sl, "vi", u)).join("; ")}.` : "",
    chosen ? `Mỗi hạng một nhánh: ${(() => {
      const ranks = rankSeriesSizes(chosen.sizes);
      return ranks ? ranks.map((n, i) => seriesLine(seriesName("series", i, "vi"), slot(n), "vi", u)).join("; ") + "." : "không tách được (một hạng cần ít nhất 2 đội).";
    })()}` : "",
    `Xếp hạng toàn giải để chia nhánh: mọi đội nhất bảng (so khác bảng bằng tỉ lệ thắng, rồi hiệu số trung bình/trận, rồi điểm ghi trung bình/trận), rồi mọi đội nhì, rồi hạng 3… Luật mặc định gộp nhất+nhì vào nhánh đầu. "Mỗi hạng một nhánh" thì nhất → Series A, nhì → B, ba → C, hạng sau một nhánh; hạng chỉ còn 1 đội thì đội đó không vào playoff. Cỡ nhánh đặt tuỳ ý được (1–8 nhánh, mỗi nhánh ≥ 2) qua series_sizes. Nhánh không tròn 2/4/8/16/32 thì đội xếp cao được miễn vòng 1 (BYE).`,
  ].filter(Boolean).join("\n");
}

const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("vi").replace(/đ/g, "d").replace(/\s+/g, " ").trim();

/** "top N mỗi bảng" = đúng N × số bảng, không kéo thêm hạng 3 cho đủ cây. */
export function lockAdvance(d: Draft): Draft {
  const n = d.advance_per_group;
  const g = d.group_count;
  if (!n || !g) return d;
  const qual = n * g;
  const total = entryCount(d);
  if (qual < 2 || (total > 0 && qual > total)) {
    return { ...d, advance_per_group: undefined };
  }
  if (d.series === 1 && d.series_sizes?.length === 1 && d.series_sizes[0] === qual) return d;
  return { ...d, series: 1, series_sizes: [qual] };
}

/** Số liệu người dùng đã nói trong câu, không cần mô hình. */
export function readUserFacts(text: string): Partial<Draft> {
  const folded = fold(text);
  const out: Partial<Draft> = {};
  // "đổi chỗ / đổi tên" cũng gấp thành "doi" — không được hiểu thành đánh đôi.
  const spoken = folded.replace(/\bdoi (cho|ten)\b/g, " ");
  const singles = /\b(don|singles)\b/.test(spoken);
  const doubles = /\b(doi|doubles|cap)\b/.test(spoken);
  if (singles && !doubles) out.is_doubles = false;
  else if (doubles) out.is_doubles = true;

  const advancePhrase = /(?:top|lay|chon)\s*(\d{1,2})\s*(?:nguoi|doi|vdv)?\s*(?:moi|per)\s*(?:bang|group)\b/;
  const count = folded.match(/\b(\d{1,3})\s*(doi|vdv|nguoi|cap|pairs|players|teams)\b/);
  if (count) {
    const n = Number(count[1]);
    const advHit = folded.match(advancePhrase);
    const insideAdvance = !!advHit && advHit[0].includes(count[0]);
    if (!insideAdvance && n >= 2 && n <= 500) out.player_count = n;
  }

  const grid = folded.match(/\b(\d{1,2})\s*[x×]\s*(\d{1,2})\b/);
  // "2 bảng" / "chia 4 bảng". "top 2 mỗi bảng" không khớp vì có chữ giữa số và "bảng".
  const groups = folded.match(/(?:chia\s+)?(\d{1,2})\s+(?:bang|groups?)\b/);
  if (grid && Number(grid[2]) >= MIN_GROUP && Number(grid[2]) <= MAX_GROUP) out.group_count = Number(grid[1]);
  else if (groups) {
    const g = Number(groups[1]);
    if (g >= 1 && g <= MAX_GROUPS) out.group_count = g;
  }

  const named = text.match(/(?:tên giải|ten giai|tên là|ten la|gọi là|goi la|name is|named)\s*[:：]?\s*([^,\n]+)/i);
  if (named) {
    const raw = named[1].replace(/\s+(đôi|doi|đơn|don|doubles|singles|playoff)\s*$/i, "").replace(/^["“]|["”]$/g, "").trim();
    if (raw.length >= 2 && raw.length <= 80) out.name = raw;
  }

  const courts = folded.match(/\b(\d{1,2})\s*(?:san|courts?)\b/);
  if (courts) {
    const n = Number(courts[1]);
    if (n >= 1 && n <= 50) {
      out.courts = Array.from({ length: n }, (_, i) => i + 1);
      out.courts_done = true;
    }
  }

  const hm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const spokenTime = folded.match(/\b(\d{1,2})\s*h\s*(\d{1,2})?\s*(toi|sang|chieu|trua|pm|am)?\b/);
  if (hm) out.start_time = `${hm[1].padStart(2, "0")}:${hm[2]}`;
  else if (spokenTime) {
    let h = Number(spokenTime[1]);
    const mi = Number(spokenTime[2] ?? 0);
    const part = spokenTime[3];
    if ((part === "toi" || part === "pm" || part === "chieu") && h < 12) h += 12;
    if (h <= 23 && mi <= 59) {
      out.start_time = `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
      out.time_done = true;
    }
  }

  const adv = folded.match(/(?:top|lay|chon)\s*(\d{1,2})\s*(?:nguoi|doi|vdv)?\s*(?:moi|per)\s*(?:bang|group)\b/);
  if (adv) out.advance_per_group = Number(adv[1]);
  else if (/top\s*2\b|nhat nhi moi bang|1st and 2nd/.test(folded)) out.advance_per_group = 2;
  return out;
}

function findEntry(entries: Entry[], query: string): number {
  const q = fold(query).replace(/^(doi|vdv|cap)\s+/, "");
  if (q.length < 1) return -1;
  const exact = entries.findIndex((e) => fold(e.p1) === q || (e.p2 && fold(e.p2) === q) || fold(entryLabel(e)) === q);
  if (exact >= 0) return exact;
  return entries.findIndex((e) => fold(e.p1).includes(q) || (e.p2 && fold(e.p2).includes(q)) || fold(entryLabel(e)).includes(q));
}

const structuralEdit = (text: string) =>
  /doi cho|swap |doi ten|rename |chia\s+\d+\s*bang|\d+\s*[x×]\s*\d+/.test(fold(text));

/** Câu hỏi hoặc danh sách dán thì vẫn cần mô hình. Số liệu và lệnh sửa thì không. */
export function messageNeedsModel(text: string): boolean {
  if (looksLikeNameList(text)) return true;
  const folded = fold(text);
  return /[?]/.test(text) || /the nao|bao nhieu|tai sao|\bhow\b|\bwhat\b|\bwhy\b/.test(folded);
}

/**
 * Đổi chỗ / đổi tên / chia bảng trên đúng danh sách đang có.
 * Trả null khi câu không chứa lệnh hay số liệu.
 */
export function applySpokenEdit(draft: Draft, text: string): Draft | null {
  const facts = readUserFacts(text);
  let next: Draft = { ...draft, ...(draft.entries ? { entries: draft.entries.map((e) => ({ ...e })) } : {}) };
  let touched = false;
  if (Object.keys(facts).length) {
    next = applyPatch(next, facts);
    touched = true;
  }
  const entries = next.entries ? next.entries.map((e) => ({ ...e })) : undefined;
  let rosterTouched = false;
  if (entries) {
    for (const m of text.matchAll(/(?:đổi chỗ|doi cho|swap)\s+(.+?)\s+(?:với|voi|và|va|and|with)\s+([^,\n]+)/gi)) {
      const i = findEntry(entries, m[1]);
      const j = findEntry(entries, m[2]);
      if (i >= 0 && j >= 0 && i !== j) {
        [entries[i], entries[j]] = [entries[j], entries[i]];
        rosterTouched = true;
      }
    }
    for (const m of text.matchAll(/(?:đổi tên|doi ten|rename)\s+(.+?)\s+(?:thành|thanh|to)\s+([^,\n]+)/gi)) {
      const i = findEntry(entries, m[1]);
      const name = m[2].trim().replace(/\s+/g, " ").slice(0, 60);
      if (i >= 0 && name) {
        const target = fold(m[1]);
        const e = entries[i];
        if (e.p2 && fold(e.p2).includes(target) && !fold(e.p1).includes(target)) entries[i] = { ...e, p2: name };
        else entries[i] = { ...e, p1: name };
        rosterTouched = true;
      }
    }
    if (rosterTouched) next = { ...next, entries, player_count: entries.length };
  }
  touched = touched || rosterTouched;
  if (!touched) return null;
  return lockAdvance(next);
}

/** Danh sách mô hình bịa (không có trong câu, không phải lệnh sửa) thì bỏ. */
export function dropInventedRoster(patch: Record<string, unknown>, text: string, before: Entry[] | undefined): Record<string, unknown> {
  const p = { ...patch };
  const facts = readUserFacts(text);
  if (facts.advance_per_group && facts.group_count == null) delete p.group_count;
  if (typeof p.player_count === "number" && facts.player_count == null && !looksLikeNameList(text)) delete p.player_count;
  if (!Array.isArray(p.entries)) return p;
  const entries = p.entries as Entry[];
  if (looksLikeNameList(text)) return p;
  if (structuralEdit(text)) {
    delete p.entries;
    return p;
  }
  const known = new Set((before ?? []).map((e) => fold(entryLabel(e))));
  const folded = fold(text);
  const invented = entries.filter((e) => !known.has(fold(entryLabel(e))) && !folded.includes(fold(e.p1)));
  if (!(before?.length) && invented.length === entries.length) delete p.entries;
  return p;
}

/** Giữ chỗ đã xếp khi chỉ đổi chỗ/đổi tên. Đổi số bảng thì chia lại theo thứ tự hiện tại, không xáo. */
export function keepOrAssign(prev: number[], count: number, prevGroups: number, nextGroups: number): number[] | null {
  if (!count || !nextGroups) return [];
  if (prev.length === count && prevGroups === nextGroups && prev.every((g) => g >= 0 && g < nextGroups)) return prev;
  if (prev.length === count && prevGroups > 0 && prevGroups !== nextGroups) {
    return Array.from({ length: count }, (_, i) => i % nextGroups);
  }
  return null;
}

export function playoffSummary(d: Draft, lang: "vi" | "en"): string | null {
  const g = d.group_count ?? 0;
  const vi = lang === "vi";
  if (g < 2) return g === 1 ? (vi ? "Một bảng vòng tròn, không có vòng knockout" : "One round-robin group, no knockout") : null;
  const adv = d.advance_per_group;
  if (adv) {
    const n = adv * g;
    return vi
      ? `Vòng knockout: đúng ${adv} mỗi bảng (${n}), không lấy thêm hạng 3`
      : `Knockout: exactly ${adv} from each group (${n}), no extra 3rd places`;
  }
  const plan = draftSeriesPlan(d);
  if (!plan) return vi ? "Vòng knockout: nhất và nhì mỗi bảng" : "Knockout: 1st and 2nd from each group";
  const u = d.is_doubles === false ? (vi ? "VĐV" : "players") : (vi ? "đội" : "teams");
  return plan.map((sl, i) => seriesLine(seriesName(d.series_style ?? "series", i, lang), sl, lang, u)).join(" · ");
}

const UNCHANGED_VI = "Bản nháp chưa đổi.";
const UNCHANGED_EN = "The draft did not change.";

/** Câu trả lời chỉ nói điều bản nháp thực sự đổi. */
export function factualAck(before: Draft, after: Draft, lang: "vi" | "en", request = ""): string {
  const vi = lang === "vi";
  const u = after.is_doubles === false ? (vi ? "VĐV" : "players") : (vi ? "đội" : "teams");
  const bits: string[] = [];
  const asked = request ? readUserFacts(request) : {};
  if (asked.group_count && after.group_count !== asked.group_count) {
    bits.push(vi ? `Không chia được ${asked.group_count} bảng với số đội này.` : `Can't make ${asked.group_count} groups with this field.`);
  } else if (after.group_count && after.group_count !== before.group_count) {
    bits.push(vi ? `Đã chia ${after.group_count} bảng.` : `Split into ${after.group_count} groups.`);
  }
  if (after.name && after.name !== before.name) bits.push(vi ? `Tên giải: ${after.name}.` : `Name: ${after.name}.`);
  if (after.advance_per_group && after.advance_per_group !== before.advance_per_group) {
    bits.push(playoffSummary(after, lang) ?? "");
  }
  const prev = before.entries ?? [];
  const next = after.entries ?? [];
  if (next.length > prev.length && (looksLikeNameList(request) || next.some((e) => fold(request).includes(fold(e.p1))))) {
    bits.push(vi ? `Đã nhận ${next.length} ${u} trong danh sách.` : `Got ${next.length} ${u} from the list.`);
  } else if (!next.length && after.player_count && after.player_count !== before.player_count) {
    bits.push(vi ? `${after.player_count} ${u}.` : `${after.player_count} ${u}.`);
  }
  if (prev.length && next.length === prev.length) {
    const moved: string[] = [];
    for (let i = 0; i < next.length; i++) {
      if (entryLabel(prev[i]) !== entryLabel(next[i]) && prev.some((e) => entryLabel(e) === entryLabel(next[i]))) {
        moved.push(entryLabel(next[i]));
      }
    }
    const renamed = next.filter((e, i) => prev[i] && fold(entryLabel(prev[i])) !== fold(entryLabel(e)) && !prev.some((p) => fold(entryLabel(p)) === fold(entryLabel(e))));
    if (moved.length >= 2 && renamed.length === 0) {
      bits.push(vi ? `Đã đổi chỗ ${moved.slice(0, 2).join(" và ")}.` : `Swapped ${moved.slice(0, 2).join(" and ")}.`);
    }
    for (const e of renamed) {
      const was = prev.find((p) => fold(p.p1) === fold(e.p1) || (e.p2 && fold(p.p2 ?? "") === fold(e.p2)));
      bits.push(vi ? `Đã đổi tên thành ${entryLabel(e)}.` : `Renamed to ${entryLabel(e)}.`);
      void was;
    }
  }
  if (after.courts?.join() !== before.courts?.join() && after.courts?.length) {
    bits.push(vi ? `${after.courts.length} sân, đánh song song.` : `${after.courts.length} courts, playing at the same time.`);
  }
  if (after.start_time && after.start_time !== before.start_time) bits.push(after.start_time);
  const text = bits.filter(Boolean).join(" ");
  return text || (vi ? UNCHANGED_VI : UNCHANGED_EN);
}

const stripClaims = (reply: string) =>
  reply
    .replace(/(?:đã|da)\s+(?:nhận|nhan|chia|đổi|doi|xếp|xep|ghép|ghep|cập nhật|cap nhat)\s+[^.!\n]*/gi, "")
    .replace(/\s+/g, " ")
    .trim();

export function replyFromDraft(before: Draft, after: Draft, llmReply: string, lang: "vi" | "en", request = ""): string {
  const fact = factualAck(before, after, lang, request);
  const unchanged = fact === (lang === "vi" ? UNCHANGED_VI : UNCHANGED_EN);
  const cleaned = stripClaims(llmReply);
  if (unchanged) return cleaned || fact;
  if (request && messageNeedsModel(request) && cleaned) return `${fact} ${cleaned}`;
  return fact;
}
