# Lovable Prompt — Generalized playoff seeding, gated iOS-only (test build)

> **Cách dùng:** copy nguyên khối trong khung `=== PROMPT ===` bên dưới và dán vào Lovable.
> Phần đầu là ghi chú kiến trúc cho bạn (Cuong) đọc — KHÔNG cần dán.

---

## ⚠️ Đọc trước: vì sao "chỉ trên app native" phải làm bằng platform gate

`capacitor.config.ts` đặt `server.url: 'https://www.thepicklehub.net'` → **app iOS load thẳng bundle React từ site live**. App và web **chạy CHUNG một bundle JS đã deploy**. Hệ quả:

- Không có cách deploy code "chỉ cho app" tách khỏi web — cùng một bản build.
- Muốn "chỉ iOS chạy thuật toán mới" → phải **gate runtime** bằng `getPlatform() === 'ios'` (đã có sẵn `src/lib/capacitor-utils.ts`). Code vẫn ship lên web, nhưng **chỉ WebView iOS thực thi nhánh mới**; web + Android chạy y nguyên logic cũ.
- Vì app load remote URL: sau khi deploy, **app tự nhận code mới ở lần mở kế tiếp, KHÔNG cần build lại / nộp lại App Store**.

**Để test riêng tư trước khi ra production** (khuyến nghị): trỏ tạm `server.url` sang preview URL của feature branch (xem mục "Cách test" cuối file). Nếu merge thẳng `main`: web/Android không đổi, nhưng **mọi user iOS** sẽ thấy thuật toán mới ngay.

Thuật toán mới đã được mình **typecheck (tsc) + chạy 16 assertion logic bằng Node — tất cả PASS** trước khi đưa vào prompt này.

---

```
=== PROMPT (dán phần này vào Lovable) ===

MỤC TIÊU
Thay thuật toán chia nhánh playoff cho Quick Table bằng một thuật toán TỔNG QUÁT, nhưng
CHỈ kích hoạt trên app iOS (gate bằng getPlatform() === 'ios') để test trước. Web và Android
phải giữ NGUYÊN hành vi hiện tại.

Thuật toán tổng quát hoá theo công thức:
  direct   = G * A           (G = số bảng, A = số suất lấy thẳng mỗi bảng: 1 hoặc 2)
  bracket  = nextPow2(direct)
  wildcard = bracket - direct   (= số người ở hạng (A+1) lấy thêm)
  feasible = wildcard <= G
- A = 2: top-2 mỗi bảng + "best 3rd-place" (tổng quát hoá generateGlobalSeeding, bỏ hardcode 6 bảng).
- A = 1: nhất bảng + "best runner-up" (nhì xuất sắc nhất) — chế độ MỚI, luôn khả thi.
Trường hợp thiếu ứng viên (vd 5 bảng + A=2 cần 6 vớt nhưng chỉ 5 hạng-3): pad BYE cho seed cao.

===========================================================================
FILE 1 — TẠO MỚI: src/lib/quick-table-seeding-v2.ts
===========================================================================
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

===========================================================================
FILE 2 — TẠO MỚI: src/lib/__tests__/quick-table-seeding-v2.test.ts
===========================================================================
import { describe, it, expect } from 'vitest';
import {
  computeSeedingPlan,
  generateSeedingGeneral,
  generateBracketPairings,
} from '@/lib/quick-table-seeding-v2';
import type { QuickTablePlayer, QuickTableGroup } from '@/hooks/useQuickTable';

const P = (o: Partial<QuickTablePlayer>): QuickTablePlayer => o as QuickTablePlayer;
const Grp = (id: string, name: string): QuickTableGroup => ({ id, name } as QuickTableGroup);

describe('computeSeedingPlan — formula nextPow2(G*A) - G*A', () => {
  it('A=2 (top-2 + best 3rd)', () => {
    expect(computeSeedingPlan(3, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 8, wildcardCount: 2, feasible: true });
    expect(computeSeedingPlan(6, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 16, wildcardCount: 4, feasible: true });
    expect(computeSeedingPlan(7, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 16, wildcardCount: 2, feasible: true });
    expect(computeSeedingPlan(5, { advancePerGroup: 2 })).toMatchObject({ bracketSize: 16, wildcardCount: 6, feasible: false });
  });

  it('A=1 (winners + best runner-up) — luôn khả thi', () => {
    expect(computeSeedingPlan(3, { advancePerGroup: 1 })).toMatchObject({ bracketSize: 4, wildcardCount: 1, feasible: true });
    expect(computeSeedingPlan(6, { advancePerGroup: 1 })).toMatchObject({ bracketSize: 8, wildcardCount: 2, feasible: true });
    expect(computeSeedingPlan(5, { advancePerGroup: 1 })).toMatchObject({ bracketSize: 8, wildcardCount: 3, feasible: true });
  });
});

describe('generateSeedingGeneral — A=1, 3 bảng (nhất bảng + 1 nhì xuất sắc nhất)', () => {
  const groups = [Grp('A', 'A'), Grp('B', 'B'), Grp('C', 'C')];
  const players: QuickTablePlayer[] = [
    P({ id: 'A1', name: 'A1', group_id: 'A', matches_won: 2, point_diff: 10, points_for: 33 }),
    P({ id: 'A2', name: 'A2', group_id: 'A', matches_won: 1, point_diff: 2, points_for: 25 }),
    P({ id: 'A3', name: 'A3', group_id: 'A', matches_won: 0, point_diff: -12, points_for: 15 }),
    P({ id: 'B1', name: 'B1', group_id: 'B', matches_won: 2, point_diff: 8, points_for: 31 }),
    P({ id: 'B2', name: 'B2', group_id: 'B', matches_won: 1, point_diff: 5, points_for: 27 }),
    P({ id: 'B3', name: 'B3', group_id: 'B', matches_won: 0, point_diff: -13, points_for: 14 }),
    P({ id: 'C1', name: 'C1', group_id: 'C', matches_won: 2, point_diff: 6, points_for: 30 }),
    P({ id: 'C2', name: 'C2', group_id: 'C', matches_won: 1, point_diff: 1, points_for: 24 }),
    P({ id: 'C3', name: 'C3', group_id: 'C', matches_won: 0, point_diff: -9, points_for: 16 }),
  ];

  it('bracket = 4, gồm 3 winner + 1 runner-up tốt nhất (B2), không BYE', () => {
    const { seeded, plan } = generateSeedingGeneral(groups, players, [], { advancePerGroup: 1 });
    expect(plan.bracketSize).toBe(4);
    expect(seeded).toHaveLength(4);
    expect(seeded.filter(s => s.tier === 'winner').map(s => s.playerId).sort()).toEqual(['A1', 'B1', 'C1']);
    const wildcards = seeded.filter(s => s.tier === 'wildcard');
    expect(wildcards).toHaveLength(1);
    expect(wildcards[0].playerId).toBe('B2');
    expect(seeded.some(s => s.tier === 'bye')).toBe(false);
  });
});

describe('generateSeedingGeneral — A=2, 5 bảng (ngoại lệ: pad BYE)', () => {
  const groups = ['A', 'B', 'C', 'D', 'E'].map(n => Grp(n, n));
  const players: QuickTablePlayer[] = [];
  groups.forEach((g, gi) => {
    for (let pos = 0; pos < 3; pos++) {
      players.push(P({
        id: `${g.id}${pos + 1}`, name: `${g.id}${pos + 1}`, group_id: g.id,
        matches_won: 2 - pos, point_diff: 10 - pos * 3 - gi, points_for: 30 - pos * 4,
      }));
    }
  });

  it('10 trực tiếp + 5 hạng-3 = 15, pad 1 BYE -> bracket 16', () => {
    const { seeded, plan } = generateSeedingGeneral(groups, players, [], { advancePerGroup: 2 });
    expect(plan.bracketSize).toBe(16);
    expect(plan.feasible).toBe(false);
    expect(seeded).toHaveLength(16);
    expect(seeded.filter(s => s.tier === 'winner')).toHaveLength(5);
    expect(seeded.filter(s => s.tier === 'runner_up')).toHaveLength(5);
    expect(seeded.filter(s => s.tier === 'wildcard')).toHaveLength(5);
    expect(seeded.filter(s => s.tier === 'bye')).toHaveLength(1);
  });
});

describe('generateBracketPairings — seed 1 và seed 2 ở hai nửa đối diện', () => {
  it('bracket 8: seed#1 gặp seed#8, seed#2 gặp seed#7', () => {
    const seeded = Array.from({ length: 8 }, (_, i) => ({
      playerId: `s${i + 1}`, name: `s${i + 1}`, seed: i + 1, sourceGroupId: `g${i}`,
      wins: 0, pointDiff: 0, pointsFor: 0, tier: 'winner' as const,
    }));
    const pairings = generateBracketPairings(seeded);
    expect(pairings).toHaveLength(4);
    const m1 = pairings.find(p => p.player1.playerId === 's1' || p.player2.playerId === 's1')!;
    expect([m1.player1.playerId, m1.player2.playerId].sort()).toEqual(['s1', 's8']);
    const m2 = pairings.find(p => p.player1.playerId === 's2' || p.player2.playerId === 's2')!;
    expect([m2.player1.playerId, m2.player2.playerId].sort()).toEqual(['s2', 's7']);
  });
});

===========================================================================
FILE 3 — SỬA: src/pages/QuickTableView.tsx
===========================================================================
1) Thêm 2 import ở đầu file (cùng nhóm import hiện có):

   import { getPlatform } from '@/lib/capacitor-utils';
   import { generateSeedingGeneral, generateBracketPairings } from '@/lib/quick-table-seeding-v2';

   (resolveGroupConflicts đã được import sẵn — KHÔNG import lại.)

2) Thêm hằng số cờ test ở phạm vi module (ngay dưới các import):

   // === iOS TEST FLAG ===
   // 2 = top-2 mỗi bảng + best 3rd (giống web hiện tại, nhưng tổng quát mọi số bảng)
   // 1 = nhất bảng + best runner-up (nhì xuất sắc nhất)
   // Lật giá trị này rồi rebuild/redeploy để test cả 2 chế độ trên app iOS.
   const IOS_TEST_ADVANCE_PER_GROUP: 1 | 2 = 2;

3) Trong hàm handleStartPlayoff, chèn nhánh iOS NGAY SAU dòng guard đầu tiên
   `if (!table || !table.group_count) return;` và TRƯỚC `if (table.group_count === 6) {`:

   // === iOS-ONLY: thuật toán seeding tổng quát v2 (bản test). ===
   // Web + Android KHÔNG vào nhánh này (getPlatform() trả 'web'/'android') → giữ logic cũ bên dưới.
   if (getPlatform() === 'ios') {
     try {
       const { seeded } = generateSeedingGeneral(groups, players, matches, {
         advancePerGroup: IOS_TEST_ADVANCE_PER_GROUP,
       });
       const pairings = generateBracketPairings(seeded);
       const resolved = resolveGroupConflicts(pairings);
       setPreviewPairings(resolved.pairings);
       setShowPlayoffPreview(true);
     } catch {
       toast.error(t.quickTable.view.errorOccurred);
     }
     return;
   }

   GIỮ NGUYÊN toàn bộ phần còn lại của handleStartPlayoff (nhánh group_count === 6,
   getQualifiedPlayers, getWildcardCount, wildcard dialog...). Nhánh iOS dùng lại
   PlayoffPreviewDialog + handleConfirmPlayoffPreview sẵn có để lưu playoff.

===========================================================================
RÀNG BUỘC TUYỆT ĐỐI
===========================================================================
- KHÔNG sửa: generateGlobalSeeding, generateSeededPairings, getWildcardCount,
  suggestGroupConfigs, distributePlayersToGroups, hay bất kỳ file nào khác
  ngoài 3 file nêu trên. Giữ nguyên để web/Android chạy y cũ + có đường rollback.
- KHÔNG đổi hành vi web/Android: nhánh group_count === 6 và else giữ nguyên 100%.
- KHÔNG đụng Cloudflare Worker, DNS, redirect rules, KV cache, prerender.
- KHÔNG đụng Supabase: schema, migrations, edge functions, RLS.
- KHÔNG thêm dependency mới (chỉ dùng @capacitor/core đã có qua capacitor-utils).
- Mọi hàm trong quick-table-seeding-v2.ts là pure function, không side effect.

ROLLBACK (nếu cần): xoá nhánh iOS + hằng IOS_TEST_ADVANCE_PER_GROUP + 2 import +
2 file mới. Hành vi cũ trở lại nguyên vẹn.

=== HẾT PROMPT ===
```

---

## Cách test (sau khi Lovable apply xong)

**Kiểm tra tự động (CI/local):**
1. `npm run lint && npm run build` → phải pass.
2. `npm run test` → 2 file test mới phải xanh (đã verify logic bằng Node, 16/16 assertion pass).
3. Mở web browser bình thường: tạo Quick Table → Start Playoff → **phải y hệt hiện tại** (`getPlatform()==='web'` nên bỏ qua nhánh mới).

**Test riêng tư trên iPhone của bạn TRƯỚC khi ra production (khuyến nghị):**
1. Lovable apply trên **feature branch** (không phải `main`) → Cloudflare cho preview URL `https://<branch>.pickle-hub-pro.pages.dev`.
2. Trong `capacitor.config.ts`, **tạm** đổi `server.url` sang preview URL đó.
3. `npx cap sync ios` → `npx cap open ios` → chạy lên máy thật/simulator qua Xcode.
4. Tạo Quick Table **3 bảng** và **6 bảng**, bấm Start Playoff, xem preview bracket:
   - `IOS_TEST_ADVANCE_PER_GROUP = 2`: 6 bảng → 16 nhánh (12 nhất/nhì + 4 hạng-3); 3 bảng → 8 nhánh (6 + 2 hạng-3).
   - Lật `= 1`, build lại: 6 bảng → 8 nhánh (6 nhất + 2 nhì xuất sắc nhất); 3 bảng → 4 nhánh (3 nhất + 1 nhì).
5. Xác nhận seed 1 và seed 2 nằm **2 nửa đối diện** (không gặp ở vòng 1).
6. Verify lưu: confirm preview → playoff matches tạo đúng cho bracket **4 và 8** (không chỉ 16).
7. Xong test: **trả `server.url` về `https://www.thepicklehub.net`**, `npx cap sync ios`.

**Hoặc test nhanh trên production:** merge `main` → web/Android không đổi; app iOS tự nhận code mới ở lần mở kế tiếp (không cần build lại App Store). Nhưng **mọi user iOS** sẽ thấy ngay, nên chỉ làm khi đã yên tâm.

> Lưu ý nhỏ cần để mắt khi test: `handleConfirmPlayoffPreview` lâu nay chỉ chạy với bracket 16 (6 bảng). Nhánh iOS sinh thêm bracket 4/8 — verify bước 6 ở trên để chắc phần lưu match xử lý đúng các cỡ nhỏ.
