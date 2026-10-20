/**
 * Series A/B/C (nhánh Vàng/Bạc/Đồng) sau vòng bảng — tổng quát cho MỌI số đội.
 *
 * Luật (Cuong chốt 2026-10-19):
 *   - Series A = nhất + nhì mọi bảng, cộng vé vớt hạng 3 cho tới luỹ thừa 2 kế
 *     tiếp (y như playoff 1 nhánh: 3 bảng → 8, 6 bảng → 16).
 *   - Còn lại ai cũng được đánh tiếp:
 *       2 nhánh → Series B = tất cả người còn lại.
 *       3 nhánh → Series B = hạng 3–4 còn lại, Series C = hạng 5 trở xuống.
 *   - Mỗi hạng một nhánh (Cuong duyệt 2026-10-20): nhất bảng → Series A,
 *     nhì → B, ba → C, hạng tiếp theo một nhánh. Hạng chỉ còn 1 đội thì
 *     không tách (đội đó không vào playoff). Tối đa 8 nhánh.
 *   - Nhánh không tròn luỹ thừa 2 → lên cỡ gần nhất, chỗ trống là BYE (miễn vòng 1),
 *     BYE dành cho hạt giống cao nhất.
 *   - So người khác bảng (bảng 3 vs 4 đội đá số trận khác nhau): tỉ lệ thắng,
 *     rồi hiệu số trung bình/trận, rồi điểm ghi trung bình/trận.
 *   - Cặp vòng 1 theo vị trí seed chuẩn + tránh cùng bảng (tái dùng seeding v2).
 */
import type { QuickTablePlayer } from '@/hooks/useQuickTable';
import { BYE_PLAYER_ID, type BracketPairing, type SeededPlayer } from '@/lib/quick-table-playoff';
import { generateSeedPositions, nextPowerOf2 } from '@/lib/doubles-bracket-utils';

export const MAX_SERIES = 3;
/** Mỗi hạng một nhánh: trần = cỡ bảng lớn nhất. */
export const RANK_SERIES_CAP = 8;
export type SeriesStyle = "series" | "medal";

export interface SeriesSlot {
  /** số đội/VĐV thật trong nhánh */
  size: number;
  /** cỡ cây (luỹ thừa 2) */
  bracket: number;
  /** số suất miễn vòng 1 */
  byes: number;
}

/** Số người ở hạng t (0 = nhất) trên toàn giải = số bảng có hơn t người. */
const tierCount = (sizes: number[], t: number) => sizes.filter((s) => s > t).length;

/** Số vé vớt hạng 3 vào Series A. */
function wildcards(sizes: number[]): number {
  const direct = tierCount(sizes, 0) + tierCount(sizes, 1);
  return Math.min(nextPowerOf2(direct) - direct, tierCount(sizes, 2));
}

export const slot = (size: number): SeriesSlot => {
  const bracket = nextPowerOf2(size);
  return { size, bracket, byes: bracket - size };
};

/**
 * Kế hoạch chia nhánh chỉ từ cỡ các bảng (chat dùng trước khi có kết quả).
 * null = không chia được k nhánh (nhánh nào cũng cần ≥ 2 người).
 */
export function seriesPlan(sizes: number[], k: number): SeriesSlot[] | null {
  if (sizes.length < 2 || k < 1 || k > MAX_SERIES) return null;
  const total = sizes.reduce((a, b) => a + b, 0);
  const wc = wildcards(sizes);
  const a = tierCount(sizes, 0) + tierCount(sizes, 1) + wc;
  if (k === 1) return [slot(a)];
  const rest = total - a;
  if (k === 2) return rest >= 2 ? [slot(a), slot(rest)] : null;
  const b = tierCount(sizes, 2) + tierCount(sizes, 3) - wc;
  const c = rest - b;
  return b >= 2 && c >= 2 ? [slot(a), slot(b), slot(c)] : null;
}

/**
 * Mỗi hạng trong bảng một nhánh: [số đội nhất, số đội nhì, …].
 * Hạng còn đúng 1 đội không thành nhánh. null khi không ra được 2 nhánh.
 */
export function rankSeriesSizes(groupSizes: number[]): number[] | null {
  if (groupSizes.length < 2) return null;
  const depth = Math.min(RANK_SERIES_CAP, Math.max(0, ...groupSizes));
  const sizes: number[] = [];
  for (let t = 0; t < depth; t++) {
    const n = groupSizes.filter((s) => s > t).length;
    if (n >= 2) sizes.push(n);
  }
  return sizes.length >= 2 ? sizes : null;
}

/**
 * Cỡ nhánh tuỳ chỉnh ("16 đội mạnh nhất vào nhánh Vàng, còn lại chia Bạc và Đồng"):
 * 0 = chia đều phần còn lại. Hợp lệ khi 1–8 nhánh, mỗi nhánh ≥ 2, tổng ≤ số đội
 * (thiếu thì đội cuối bị loại, như playoff 1 nhánh).
 */
export function resolveSeriesSizes(raw: unknown, total: number): number[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > RANK_SERIES_CAP) return null;
  const sizes = raw.map((x) => Math.floor(Number(x)));
  if (sizes.some((x) => !Number.isFinite(x) || x < 0)) return null;
  const free = sizes.filter((x) => x === 0).length;
  const rest = total - sizes.reduce((a, b) => a + b, 0);
  if (free) {
    if (rest < free * 2) return null;
    let left = rest;
    let slots = free;
    for (let i = 0; i < sizes.length; i++) {
      if (sizes[i] !== 0) continue;
      sizes[i] = Math.ceil(left / slots); // nhánh trước nhận phần lẻ
      left -= sizes[i];
      slots--;
    }
  }
  if (sizes.some((x) => x < 2) || sizes.reduce((a, b) => a + b, 0) > total) return null;
  return sizes;
}

/** Số nhánh tối đa chia được với các bảng này. */
export function maxSeries(sizes: number[]): number {
  for (let k = MAX_SERIES; k > 1; k--) if (seriesPlan(sizes, k)) return k;
  return 1;
}

const MEDAL_VI = ["Nhánh Vàng", "Nhánh Bạc", "Nhánh Đồng"];
const MEDAL_EN = ["Gold bracket", "Silver bracket", "Bronze bracket"];

const seriesLetter = (division: number) =>
  division >= 0 && division < 26 ? String.fromCharCode(65 + division) : String(division + 1);

export function seriesName(style: SeriesStyle | undefined, division: number, lang: "vi" | "en"): string {
  if (style === "medal") {
    const named = (lang === "en" ? MEDAL_EN : MEDAL_VI)[division];
    if (named) return named;
  }
  return `Series ${seriesLetter(division)}`;
}

type Ranked = Pick<QuickTablePlayer, 'id' | 'name' | 'group_id' | 'matches_played' | 'matches_won' | 'point_diff' | 'points_for'>;

const perMatch = (v: number, played: number) => (played > 0 ? v / played : 0);

/** So người khác bảng: tỉ lệ thắng → hiệu số TB/trận → điểm ghi TB/trận. */
export function crossGroupCompare(a: Ranked, b: Ranked): number {
  return (
    perMatch(b.matches_won, b.matches_played) - perMatch(a.matches_won, a.matches_played) ||
    perMatch(b.point_diff, b.matches_played) - perMatch(a.point_diff, a.matches_played) ||
    perMatch(b.points_for, b.matches_played) - perMatch(a.points_for, a.matches_played)
  );
}

/**
 * Chia người thật vào các nhánh theo cỡ cho trước (seriesPlan hoặc tuỳ chỉnh),
 * mỗi nhánh xếp từ mạnh → yếu (thứ tự = seed). Thứ tự toàn giải: mọi đội nhất
 * (so khác bảng), rồi mọi đội nhì, rồi hạng 3… — cắt lần lượt theo cỡ nhánh.
 * Luật mặc định (A = nhất + nhì + vé vớt hạng 3, …) chính là một cách cắt như vậy.
 */
export function assignSeries<P extends Ranked>(groupIds: string[], players: P[], sizes: number[]): P[][] {
  return cut(tieredOrder(groupIds, players), sizes).map((c) => c.map((x) => x.p));
}

interface Tiered<P> { p: P; tier: number; group: number }

/** Thứ tự toàn giải kèm hạng trong bảng + chỉ số bảng (để nhận ra nhánh ghép chéo được). */
function tieredOrder<P extends Ranked>(groupIds: string[], players: P[]): Tiered<P>[] {
  const ranked = groupIds.map((gid) =>
    players
      .filter((p) => p.group_id === gid)
      // trong cùng bảng: y như bảng xếp hạng hiển thị / getQualifiedPlayers
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for),
  );
  const maxTier = Math.max(0, ...ranked.map((r) => r.length));
  const order: Tiered<P>[] = [];
  for (let t = 0; t < maxTier; t++) {
    order.push(...ranked.flatMap((r, group) => (r[t] ? [{ p: r[t], tier: t, group }] : [])).sort((a, b) => crossGroupCompare(a.p, b.p)));
  }
  return order;
}

const cut = <T,>(order: T[], sizes: number[]): T[][] => {
  let at = 0;
  return sizes.map((n) => order.slice(at, (at += n)));
};

/**
 * Nhánh gồm ĐỦ 2 hạng liền nhau (mỗi bảng góp 1 đội mỗi hạng) với 2/4/8/16 bảng →
 * ghép chéo cổ điển như playoff 1 nhánh: A1–B2, C1–D2… nửa trên; B1–A2, D1–C2… nửa dưới
 * (nhánh hạng 3–4: Ba A–Tư B…). Hai đội cùng bảng nằm ở hai nửa → chỉ gặp ở chung kết.
 * null = nhánh khác (có vé vớt / cỡ tuỳ chỉnh) → seriesBracket.
 */
function classicPairs<P extends Ranked & { id: string }>(chunk: Tiered<P>[], groupCount: number): BracketPairing[] | null {
  if (![2, 4, 8, 16].includes(groupCount) || chunk.length !== 2 * groupCount) return null;
  const t = Math.min(...chunk.map((c) => c.tier));
  const top: (Tiered<P> | undefined)[] = Array(groupCount);
  const bottom: (Tiered<P> | undefined)[] = Array(groupCount);
  for (const c of chunk) {
    if (c.tier === t) top[c.group] = c;
    else if (c.tier === t + 1) bottom[c.group] = c;
    else return null;
  }
  if (top.some((x) => !x) || bottom.some((x) => !x)) return null;
  const seeded = (c: Tiered<P>) => toSeeded(c.p, chunk.indexOf(c) + 1);
  const half = groupCount / 2;
  const pairs: BracketPairing[] = [];
  for (let i = 0; i < half; i++) pairs.push({ player1: seeded(top[2 * i]!), player2: seeded(bottom[2 * i + 1]!), matchNumber: i + 1 });
  for (let i = 0; i < half; i++) pairs.push({ player1: seeded(top[2 * i + 1]!), player2: seeded(bottom[2 * i]!), matchNumber: half + i + 1 });
  return pairs;
}

/** Vòng 1 của từng nhánh: ghép chéo cổ điển khi được, không thì xếp hạt giống + tách cùng bảng. */
export function seriesDraws<P extends Ranked & { id: string }>(groupIds: string[], players: P[], sizes: number[]): BracketPairing[][] {
  return cut(tieredOrder(groupIds, players), sizes).map((c) => classicPairs(c, groupIds.length) ?? seriesBracket(c.map((x) => x.p)));
}

const toSeeded = (p: Ranked, seed: number): SeededPlayer => ({
  playerId: p.id,
  name: p.name,
  seed,
  sourceGroupId: p.group_id ?? '',
  wins: p.matches_won,
  pointDiff: p.point_diff,
  pointsFor: p.points_for,
  tier: 'winner',
});

const bye = (seed: number): SeededPlayer => ({
  playerId: BYE_PLAYER_ID,
  name: 'BYE',
  seed,
  sourceGroupId: '__BYE_GROUP__',
  wins: 0,
  pointDiff: -Infinity,
  pointsFor: 0,
  tier: 'bye',
});

const band = (seed: number) => Math.ceil(Math.log2(seed)); // 1 | 2 | 3–4 | 5–8 | 9–16 …

/**
 * Cây vòng 1 cho một nhánh. Seed chuẩn (1 gặp cuối, 1 và 2 ở hai nửa), BYE cố định
 * cho hạt giống cao nhất. Rồi đặt các đội CÙNG BẢNG xa nhau nhất có thể trên cây —
 * lý tưởng là chỉ gặp lại ở chung kết: chỉ đổi chỗ hai đội cùng nhóm hạt giống
 * (1 | 2 | 3–4 | 5–8 | 9–16…) và cùng có/không có BYE, nên công bằng hạt giống giữ nguyên.
 * ponytail: leo đồi (đổi 1 rồi 2 cặp, ≤ 64 ô) — không bảo đảm tối ưu toàn cục, đủ cho giải ≤ 48 đội.
 */
export function seriesBracket(ordered: Ranked[]): BracketPairing[] {
  const size = nextPowerOf2(Math.max(2, ordered.length));
  const seeded = ordered.map((p, i) => toSeeded(p, i + 1));
  while (seeded.length < size) seeded.push(bye(seeded.length + 1));
  const slots = generateSeedPositions(size).map((i) => seeded[i]);
  const rounds = Math.log2(size);
  const real = (x: SeededPlayer) => x.playerId !== BYE_PLAYER_ID;
  const hasBye = (i: number) => !real(slots[i ^ 1]);
  // Gặp nhau ở vòng r (1 = vòng đầu, rounds = chung kết): phạt nặng dần về vòng sớm, chung kết = 0.
  const meetCost = (i: number, j: number) => {
    const r = Math.floor(Math.log2(i ^ j)) + 1;
    return r === rounds ? 0 : 4 ** (rounds - r);
  };
  const cost = () => {
    const at = new Map<string, number[]>();
    slots.forEach((x, i) => { if (real(x)) at.set(x.sourceGroupId, [...(at.get(x.sourceGroupId) ?? []), i]); });
    let c = 0;
    for (const pos of at.values()) for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) c += meetCost(pos[a], pos[b]);
    return c;
  };
  // Các phép đổi hợp lệ: 2 đội thật khác bảng, cùng nhóm hạt giống, cùng có/không có BYE.
  const swaps: [number, number][] = [];
  for (let i = 0; i < size; i++) for (let j = i + 1; j < size; j++) {
    const a = slots[i], b = slots[j];
    if (real(a) && real(b) && band(a.seed) === band(b.seed) && hasBye(i) === hasBye(j)) swaps.push([i, j]);
  }
  const swap = ([i, j]: [number, number]) => { [slots[i], slots[j]] = [slots[j], slots[i]]; };
  let best = cost();
  // Leo đồi: đổi 1 cặp; kẹt thì thử đổi 2 cặp liền (có khi phải đi qua một bước không lợi).
  while (best > 0) {
    let moved = false;
    for (const s1 of swaps) {
      swap(s1);
      const c = cost();
      if (c < best) { best = c; moved = true; break; }
      swap(s1);
    }
    if (moved) continue;
    outer: for (let x = 0; x < swaps.length; x++) {
      swap(swaps[x]);
      for (let y = x + 1; y < swaps.length; y++) {
        swap(swaps[y]);
        const c = cost();
        if (c < best) { best = c; moved = true; break outer; }
        swap(swaps[y]);
      }
      swap(swaps[x]);
    }
    if (!moved) break;
  }
  return Array.from({ length: size / 2 }, (_, m) => ({ player1: slots[2 * m], player2: slots[2 * m + 1], matchNumber: m + 1 }));
}

/** "Series B: 10 đội (6 miễn vòng 1)" — dùng chung chat + trang giải. */
export function seriesLine(name: string, s: SeriesSlot, lang: "vi" | "en", unit?: string): string {
  return lang === "vi"
    ? `${name}: ${s.size} ${unit ?? "đội"}${s.byes ? ` (${s.byes} miễn vòng 1)` : ""}`
    : `${name}: ${s.size} ${unit ?? "teams"}${s.byes ? ` (${s.byes} byes)` : ""}`;
}

const RANK_VI = ["Nhất", "Nhì", "Ba", "Tư", "Năm", "Sáu", "Bảy", "Tám"];
const RANK_EN = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

export interface PreviewPlayer { id: string; name: string; seed: number | null; group_id: string | null }
export interface PreviewMatch {
  id: string; player1_id: string | null; player2_id: string | null;
  score1: null; score2: null; winner_id: null; status: "pending";
  playoff_round: number; playoff_match_number: number;
  bracket_position: null; next_match_id: null; next_match_slot: null;
}

/**
 * Sơ đồ tạm tính của từng nhánh trước khi tạo playoff: mỗi ô là một suất
 * ("Nhất #1", "Nhì #5"…). Lúc tạo thật, các đội cùng bảng còn được đổi chỗ
 * trong cùng nhóm hạt giống để không gặp nhau sớm.
 */
export function seriesPreview(
  groupNames: string[], groupSizes: number[], sizes: number[], lang: "vi" | "en",
): { players: PreviewPlayer[]; series: PreviewMatch[][] } {
  // Trước khi đá chưa biết bảng nào nhất/nhì tốt hơn. Nhánh ghép chéo cổ điển thì cặp cố định
  // theo bảng ("Nhất A" – "Nhì B"); nhánh khác nhãn theo hạng + thứ tự so giữa các bảng
  // ("Nhì #5" = đội nhì xếp thứ 5 trong các đội nhì) và không đổi chỗ tránh cùng bảng (chưa biết bảng).
  const rank = (t: number) => (lang === "vi" ? RANK_VI[t] ?? `Hạng ${t + 1}` : RANK_EN[t] ?? `${t + 1}th`);
  const fake = (id: string, name: string, group: string) =>
    ({ id, name, group_id: group, matches_played: 0, matches_won: 0, point_diff: 0, points_for: 0 });
  const maxTier = Math.max(0, ...groupSizes);
  const order: Tiered<ReturnType<typeof fake>>[] = [];
  for (let t = 0; t < maxTier; t++) {
    groupSizes.forEach((n, g) => {
      if (n > t) order.push({ p: fake(`pv-${t}-${g}`, `${rank(t)} ${groupNames[g] ?? g + 1}`, `pv-g${g}`), tier: t, group: g });
    });
  }
  const draws = cut(order, sizes).map((chunk) => {
    const classic = classicPairs(chunk, groupSizes.length);
    if (classic) return classic;
    return seriesBracket(chunk.map((c) => {
      const k = order.filter((x) => x.tier === c.tier).indexOf(c) + 1;
      return fake(c.p.id, `${rank(c.tier)} #${k}`, c.p.id);
    }));
  });
  return seriesDrawPreview(draws);
}

/** Sơ đồ (vòng 1 + các vòng sau trống) từ vòng 1 của từng nhánh — người thật hoặc ô giả. */
export function seriesDrawPreview(draws: BracketPairing[][]): { players: PreviewPlayer[]; series: PreviewMatch[][] } {
  const out: PreviewPlayer[] = [{ id: BYE_PLAYER_ID, name: "BYE", seed: null, group_id: null }];
  const series = draws.map((first, d) => {
    for (const p of first) for (const sp of [p.player1, p.player2]) {
      if (sp.playerId !== BYE_PLAYER_ID) out.push({ id: sp.playerId, name: sp.name, seed: sp.seed, group_id: sp.sourceGroupId || null });
    }
    const matches: PreviewMatch[] = [];
    for (let round = 1, n = first.length; n >= 1; round++, n /= 2) {
      for (let m = 1; m <= n; m++) {
        const p = round === 1 ? first[m - 1] : null;
        matches.push({
          id: `pv-${d}-${round}-${m}`,
          player1_id: p?.player1.playerId ?? null, player2_id: p?.player2.playerId ?? null,
          score1: null, score2: null, winner_id: null, status: "pending",
          playoff_round: round, playoff_match_number: m,
          bracket_position: null, next_match_id: null, next_match_slot: null,
        });
      }
    }
    return matches;
  });
  return { players: out, series };
}
