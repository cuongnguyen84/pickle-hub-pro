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
 * Cỡ nhánh tuỳ chỉnh ("16 đội mạnh nhất vào nhánh Vàng, còn lại chia Bạc và Đồng"):
 * 0 = chia đều phần còn lại. Hợp lệ khi 1–3 nhánh, mỗi nhánh ≥ 2, tổng ≤ số đội
 * (thiếu thì đội cuối bị loại, như playoff 1 nhánh).
 */
export function resolveSeriesSizes(raw: unknown, total: number): number[] | null {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SERIES) return null;
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
 * Chia người thật vào các nhánh theo cỡ cho trước (seriesPlan hoặc tuỳ chỉnh),
 * mỗi nhánh xếp từ mạnh → yếu (thứ tự = seed). Thứ tự toàn giải: mọi đội nhất
 * (so khác bảng), rồi mọi đội nhì, rồi hạng 3… — cắt lần lượt theo cỡ nhánh.
 * Luật mặc định (A = nhất + nhì + vé vớt hạng 3, …) chính là một cách cắt như vậy.
 */
export function assignSeries<P extends Ranked>(groupIds: string[], players: P[], sizes: number[]): P[][] {
  const ranked = groupIds.map((gid) =>
    players
      .filter((p) => p.group_id === gid)
      // trong cùng bảng: y như bảng xếp hạng hiển thị / getQualifiedPlayers
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for),
  );
  const maxTier = Math.max(0, ...ranked.map((r) => r.length));
  const order: P[] = [];
  for (let t = 0; t < maxTier; t++) order.push(...ranked.flatMap((r) => (r[t] ? [r[t]] : [])).sort(crossGroupCompare));
  let at = 0;
  return sizes.map((n) => order.slice(at, (at += n)));
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

const RANK_VI = ["Nhất", "Nhì", "Ba", "Tư", "Năm", "Sáu", "Bảy", "Tám"];

export interface PreviewPlayer { id: string; name: string; seed: number | null; group_id: string | null }
export interface PreviewMatch {
  id: string; player1_id: string | null; player2_id: string | null;
  score1: null; score2: null; winner_id: null; status: "pending";
  playoff_round: number; playoff_match_number: number;
  bracket_position: null; next_match_id: null; next_match_slot: null;
}

/**
 * Sơ đồ tạm tính của từng nhánh trước khi tạo playoff: mỗi ô là một hạng
 * ("Nhất A", "Nhì C"…) mang thành tích hiện tại của người đang giữ hạng đó,
 * nên xếp hạt giống / cặp đấu đúng như lúc tạo thật nếu bảng giữ nguyên.
 */
export function seriesPreview<P extends Ranked>(
  groups: { id: string; name: string }[], players: P[], sizes: number[], lang: "vi" | "en",
): { players: PreviewPlayer[]; series: PreviewMatch[][] } {
  const label = (rank: number, g: string) => (lang === "vi" ? `${RANK_VI[rank] ?? `Hạng ${rank + 1}`} ${g}` : `${g}${rank + 1}`);
  const slots = groups.flatMap((g) =>
    players
      .filter((p) => p.group_id === g.id)
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for)
      .map((p, i) => ({ ...p, id: `pv-${g.id}-${i}`, name: label(i, g.name) })),
  );
  const out: PreviewPlayer[] = [{ id: BYE_PLAYER_ID, name: "BYE", seed: null, group_id: null }];
  const series = assignSeries(groups.map((g) => g.id), slots, sizes).map((ordered, d) => {
    const first = seriesBracket(ordered);
    for (const p of first) for (const sp of [p.player1, p.player2]) {
      const s = slots.find((x) => x.id === sp.playerId);
      if (s) out.push({ id: s.id, name: s.name, seed: sp.seed, group_id: s.group_id ?? null });
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
