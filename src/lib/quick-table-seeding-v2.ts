/**
 * Generalized playoff seeding for Quick Table tournaments — v2 (iOS test build).
 *
 * Hỗ trợ MỌI số bảng + 2 chế độ lấy suất:
 *   advancePerGroup = 2 → top-2 mỗi bảng + best 3rd-place wildcards  (tổng quát hoá hành vi hiện tại)
 *   advancePerGroup = 1 → nhất bảng + best runner-up (nhì) wildcards
 *
 * Pure functions — không Supabase, không side effect. Tách riêng để test iOS,
 * KHÔNG đụng generateGlobalSeeding/getWildcardCount cũ (web + Android giữ nguyên).
 */
import type { QuickTablePlayer, QuickTableMatch, QuickTableGroup } from '@/hooks/useQuickTable';
import { nextPowerOf2, generateSeedPositions } from '@/lib/doubles-bracket-utils';
import {
  type SeededPlayer,
  type BracketPairing,
  BYE_PLAYER_ID,
  computeBest3rdAdjustedStats,
} from '@/lib/quick-table-playoff';

export interface SeedingConfig {
  /** Số suất lấy thẳng mỗi bảng: 1 = chỉ nhất bảng, 2 = nhất + nhì. */
  advancePerGroup: 1 | 2;
  /** Ghi đè cỡ bracket (phải là luỹ thừa của 2). Mặc định = nextPow2(G*A). */
  bracketSize?: number;
}

export interface SeedingPlan {
  groupCount: number;
  advancePerGroup: number;
  directSpots: number;
  bracketSize: number;
  wildcardCount: number;
  takeKthPlace: number;
  feasible: boolean;
  note: string;
}

function ordinal(n: number): string {
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

/** Pure math — tính kế hoạch seeding mà không cần dữ liệu người chơi. */
export function computeSeedingPlan(groupCount: number, cfg: SeedingConfig): SeedingPlan {
  const A = cfg.advancePerGroup;
  const directSpots = groupCount * A;
  const bracketSize = cfg.bracketSize ?? nextPowerOf2(directSpots);
  const wildcardCount = Math.max(0, bracketSize - directSpots);
  const feasible = wildcardCount <= groupCount;
  const note =
    wildcardCount === 0
      ? 'Clean bracket — no wildcards needed'
      : feasible
        ? `Take ${wildcardCount} best ${ordinal(A + 1)}-place`
        : `Infeasible: need ${wildcardCount} wildcards but only ${groupCount} candidates — padded with BYEs (or use advancePerGroup=1)`;
  return {
    groupCount,
    advancePerGroup: A,
    directSpots,
    bracketSize,
    wildcardCount,
    takeKthPlace: A + 1,
    feasible,
    note,
  };
}

function byePlayer(seed: number): SeededPlayer {
  return {
    playerId: BYE_PLAYER_ID,
    name: 'BYE',
    seed,
    sourceGroupId: '__BYE_GROUP__',
    wins: 0,
    pointDiff: -Infinity,
    pointsFor: 0,
    tier: 'bye',
  };
}

function rankWithinGroup(players: QuickTablePlayer[], groupId: string): QuickTablePlayer[] {
  return players
    .filter(p => p.group_id === groupId)
    .sort((a, b) => {
      if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
      if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
      return b.points_for - a.points_for;
    });
}

const byRecord = (a: QuickTablePlayer, b: QuickTablePlayer): number => {
  if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
  if (b.point_diff !== a.point_diff) return b.point_diff - a.point_diff;
  return b.points_for - a.points_for;
};

/**
 * Sinh seeding tổng quát cho N bảng, A người/bảng.
 * Trả về mảng SeededPlayer dài đúng bracketSize (đã pad BYE nếu thiếu ứng viên).
 */
export function generateSeedingGeneral(
  groups: QuickTableGroup[],
  players: QuickTablePlayer[],
  matches: QuickTableMatch[],
  cfg: SeedingConfig
): { seeded: SeededPlayer[]; plan: SeedingPlan } {
  const A = cfg.advancePerGroup;
  const G = groups.length;
  if (G < 2) throw new Error(`generateSeedingGeneral needs >= 2 groups, got ${G}`);

  const plan = computeSeedingPlan(G, cfg);
  const ranked = groups.map(g => rankWithinGroup(players, g.id));

  ranked.forEach((r, i) => {
    if (r.length < A) throw new Error(`Group ${groups[i].name} has fewer than ${A} players`);
  });

  const groupMatches = matches.filter(m => !m.is_playoff);
  const seeded: SeededPlayer[] = [];
  let seed = 1;

  const push = (p: QuickTablePlayer, groupId: string, tier: SeededPlayer['tier']) => {
    seeded.push({
      playerId: p.id,
      name: p.name,
      seed: seed++,
      sourceGroupId: groupId,
      wins: p.matches_won,
      pointDiff: p.point_diff,
      pointsFor: p.points_for,
      tier,
    });
  };

  // 1) Suất trực tiếp: tầng theo vị trí 0..A-1 (nhất bảng → nhì bảng), mỗi tầng sort riêng.
  for (let pos = 0; pos < A; pos++) {
    const tier: SeededPlayer['tier'] = pos === 0 ? 'winner' : 'runner_up';
    const tierPlayers = ranked
      .map((r, gi) => {
        const p = r[pos];
        return p ? { p, groupId: groups[gi].id } : null;
      })
      .filter((x): x is { p: QuickTablePlayer; groupId: string } => x !== null)
      .sort((x, y) => byRecord(x.p, y.p));
    for (const tp of tierPlayers) push(tp.p, tp.groupId, tier);
  }

  // 2) Wildcard pool = người ở vị trí A ((A+1)-th place) của mỗi bảng.
  if (plan.wildcardCount > 0) {
    const pool = ranked
      .map((r, gi) => {
        const p = r[A];
        if (!p) return null;
        const groupId = groups[gi].id;
        // A=2: chuẩn hoá "chỉ tính trận gặp top-2" (giống generateGlobalSeeding).
        // A=1: dùng full-record (runner-up đã đá đủ vòng bảng).
        if (A === 2) {
          const topAIds = new Set(r.slice(0, A).map(x => x.id));
          const adj = computeBest3rdAdjustedStats(p, groupMatches, topAIds);
          return { p, groupId, w: adj.adjustedWins, d: adj.adjustedPointDiff, f: adj.adjustedPointsFor };
        }
        return { p, groupId, w: p.matches_won, d: p.point_diff, f: p.points_for };
      })
      .filter((x): x is { p: QuickTablePlayer; groupId: string; w: number; d: number; f: number } => x !== null)
      .sort((a, b) => (b.w !== a.w ? b.w - a.w : b.d !== a.d ? b.d - a.d : b.f - a.f));

    for (const wc of pool.slice(0, plan.wildcardCount)) push(wc.p, wc.groupId, 'wildcard');
  }

  // 3) Pad BYE tới bracketSize (xảy ra khi wildcardCount > số ứng viên, vd 5 bảng + A=2).
  while (seeded.length < plan.bracketSize) seeded.push(byePlayer(seed++));

  return { seeded, plan };
}

/**
 * Dựng cặp đấu vòng 1 theo VỊ TRÍ SEED CHUẨN (seed 1 và seed 2 chỉ gặp ở chung kết).
 * Khác generateSeededPairings cũ (vốn xếp tuyến tính 1v16..8v9).
 */
export function generateBracketPairings(seeded: SeededPlayer[]): BracketPairing[] {
  const size = seeded.length;
  const order = generateSeedPositions(size); // order[slot] = seedIndex (0-based)
  const slots = order.map(idx => seeded[idx]);
  const pairings: BracketPairing[] = [];
  for (let i = 0; i < size / 2; i++) {
    pairings.push({ player1: slots[2 * i], player2: slots[2 * i + 1], matchNumber: i + 1 });
  }
  return pairings;
}

/**
 * Giải xung đột cùng bảng cho bracket seed chuẩn (thay resolveGroupConflicts cũ kiểu "đổi match gần nhất").
 *
 * Mỗi cặp vòng 1 = 1 "anchor" (seed mạnh hơn = seed nhỏ hơn, luôn là seed nửa trên) + 1 "floater"
 * (seed yếu hơn, nửa dưới). GIỮ NGUYÊN anchor trong match của nó → cấu trúc nhánh bất biến
 * (seed#1 & seed#2 vẫn ở 2 nửa, chỉ gặp ở CK). Chỉ gán lại floater sao cho:
 *   - không floater nào CÙNG BẢNG với anchor của match đó, và
 *   - anchor MẠNH hơn được gặp floater YẾU hơn (ưu tiên seed nhóm cao gặp seed nhóm thấp).
 *
 * Backtracking thử floater yếu nhất trước, duyệt anchor theo thứ tự seed → nghiệm đầu tiên là
 * phương án tối ưu theo đúng thứ tự ưu tiên đó. Không xung đột → tái tạo y hệt cặp mặc định.
 * N/2 ≤ 8 nên backtracking rất nhẹ và luôn tìm ra nếu khả thi (BYE hợp lệ với mọi anchor).
 */
export function resolveBracketConflicts(pairings: BracketPairing[]): {
  pairings: BracketPairing[];
  hasConflicts: boolean;
} {
  const sameGroup = (a: SeededPlayer, b: SeededPlayer) =>
    a.tier !== 'bye' && b.tier !== 'bye' && a.sourceGroupId === b.sourceGroupId;

  const matches = pairings.map(p => {
    const [anchor, floater] =
      p.player1.seed <= p.player2.seed ? [p.player1, p.player2] : [p.player2, p.player1];
    return { anchor, floater, matchNumber: p.matchNumber };
  });

  const anchors = [...matches].sort((a, b) => a.anchor.seed - b.anchor.seed); // seed#1 trước
  const floaters = matches.map(m => m.floater);
  const floaterOrder = floaters
    .map((f, i) => ({ f, i }))
    .sort((x, y) => y.f.seed - x.f.seed); // yếu nhất (seed lớn nhất) trước

  const assignment = new Array<SeededPlayer | null>(anchors.length).fill(null);
  const used = new Array(floaters.length).fill(false);

  const solve = (k: number): boolean => {
    if (k === anchors.length) return true;
    for (const { f, i } of floaterOrder) {
      if (used[i] || sameGroup(anchors[k].anchor, f)) continue;
      used[i] = true;
      assignment[k] = f;
      if (solve(k + 1)) return true;
      used[i] = false;
      assignment[k] = null;
    }
    return false;
  };

  if (!solve(0)) {
    // Cực hiếm: không tồn tại cách tách hết cùng bảng → trả nguyên trạng + cờ báo.
    return { pairings, hasConflicts: pairings.some(p => sameGroup(p.player1, p.player2)) };
  }

  const resolved = anchors
    .map((m, k) => ({ player1: m.anchor, player2: assignment[k]!, matchNumber: m.matchNumber }))
    .sort((a, b) => a.matchNumber - b.matchNumber);

  return { pairings: resolved, hasConflicts: false };
}
