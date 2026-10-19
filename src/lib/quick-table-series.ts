/**
 * Series A/B/C (nhánh Vàng/Bạc/Đồng) sau vòng bảng — tổng quát cho MỌI số đội.
 *
 * Luật (Cuong chốt 2026-10-19):
 *   - Series A = nhất + nhì mọi bảng, cộng vé vớt hạng 3 cho tới luỹ thừa 2 kế
 *     tiếp (y như playoff 1 nhánh: 3 bảng → 8, 6 bảng → 16).
 *   - Còn lại ai cũng được đánh tiếp:
 *       2 nhánh → Series B = tất cả người còn lại.
 *       3 nhánh → Series B = hạng 3–4 còn lại, Series C = hạng 5 trở xuống.
 *   - Nhánh không tròn luỹ thừa 2 → lên cỡ gần nhất, chỗ trống là BYE (miễn vòng 1),
 *     BYE dành cho hạt giống cao nhất.
 *   - So người khác bảng (bảng 3 vs 4 đội đá số trận khác nhau): tỉ lệ thắng,
 *     rồi hiệu số trung bình/trận, rồi điểm ghi trung bình/trận.
 *   - Cặp vòng 1 theo vị trí seed chuẩn + tránh cùng bảng (tái dùng seeding v2).
 */
import type { QuickTablePlayer } from '@/hooks/useQuickTable';
import { BYE_PLAYER_ID, type BracketPairing, type SeededPlayer } from '@/lib/quick-table-playoff';
import { generateBracketPairings, resolveBracketConflicts } from '@/lib/quick-table-seeding-v2';
import { nextPowerOf2 } from '@/lib/doubles-bracket-utils';

export const MAX_SERIES = 3;
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

const slot = (size: number): SeriesSlot => {
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

/** Số nhánh tối đa chia được với các bảng này. */
export function maxSeries(sizes: number[]): number {
  for (let k = MAX_SERIES; k > 1; k--) if (seriesPlan(sizes, k)) return k;
  return 1;
}

const MEDAL_VI = ["Nhánh Vàng", "Nhánh Bạc", "Nhánh Đồng"];
const MEDAL_EN = ["Gold bracket", "Silver bracket", "Bronze bracket"];

export function seriesName(style: SeriesStyle | undefined, division: number, lang: "vi" | "en"): string {
  if (style === "medal") return (lang === "en" ? MEDAL_EN : MEDAL_VI)[division] ?? `Series ${"ABC"[division]}`;
  return `Series ${"ABC"[division] ?? division + 1}`;
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
 * Chia người thật vào k nhánh, mỗi nhánh xếp từ mạnh → yếu (thứ tự = seed).
 * Số người mỗi nhánh khớp đúng seriesPlan(cỡ bảng, k).
 */
export function assignSeries<P extends Ranked>(groupIds: string[], players: P[], k: number): P[][] {
  const ranked = groupIds.map((gid) =>
    players
      .filter((p) => p.group_id === gid)
      // trong cùng bảng: y như bảng xếp hạng hiển thị / getQualifiedPlayers
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for),
  );
  const tier = (t: number) => ranked.flatMap((r) => (r[t] ? [r[t]] : [])).sort(crossGroupCompare);
  const maxTier = Math.max(0, ...ranked.map((r) => r.length));
  const wc = wildcards(ranked.map((r) => r.length));

  const thirds = tier(2);
  const seriesA = [...tier(0), ...tier(1), ...thirds.slice(0, wc)];
  const rest = [...thirds.slice(wc)];
  for (let t = 3; t < maxTier; t++) rest.push(...tier(t));
  if (k <= 1) return [seriesA];
  if (k === 2) return [seriesA, rest];
  // 3 nhánh: B = hạng 3–4 còn lại, C = hạng 5 trở xuống (rest đã theo thứ tự hạng).
  const bCount = thirds.length - wc + tier(3).length;
  return [seriesA, rest.slice(0, bCount), rest.slice(bCount)];
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

/**
 * Cây vòng 1 cho một nhánh: seed chuẩn, BYE cố định cho hạt giống cao nhất,
 * rồi mới tránh cùng bảng giữa các trận có đủ 2 người (BYE là phần thưởng hạt
 * giống, không bị đánh đổi để tách bảng).
 */
export function seriesBracket(ordered: Ranked[]): BracketPairing[] {
  const size = nextPowerOf2(Math.max(2, ordered.length));
  const seeded = ordered.map((p, i) => toSeeded(p, i + 1));
  while (seeded.length < size) seeded.push(bye(seeded.length + 1));
  const pairs = generateBracketPairings(seeded);
  const isBye = (p: BracketPairing) => p.player1.playerId === BYE_PLAYER_ID || p.player2.playerId === BYE_PLAYER_ID;
  const resolved = resolveBracketConflicts(pairs.filter((p) => !isBye(p))).pairings;
  return [...pairs.filter(isBye), ...resolved].sort((a, b) => a.matchNumber - b.matchNumber);
}

/** "Series B: 10 đội (6 miễn vòng 1)" — dùng chung chat + trang giải. */
export function seriesLine(name: string, s: SeriesSlot, lang: "vi" | "en", unit?: string): string {
  return lang === "vi"
    ? `${name}: ${s.size} ${unit ?? "đội"}${s.byes ? ` (${s.byes} miễn vòng 1)` : ""}`
    : `${name}: ${s.size} ${unit ?? "teams"}${s.byes ? ` (${s.byes} byes)` : ""}`;
}
