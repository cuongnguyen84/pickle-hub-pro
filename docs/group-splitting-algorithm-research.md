# Thuật toán chia bảng & wildcard trong giải đấu thể thao
## Group-splitting & wildcard algorithms — Research + ThePickleHub application

> Nghiên cứu thuật toán chia bảng (group/pool stage → knockout bracket) trong thể thao, tập trung pickleball, và áp dụng/đánh giá cho ThePickleHub. Trọng tâm: trường hợp **số bảng KHÔNG phải luỹ thừa của 2** (3, 5, 6, 7…), khi phải lấy thêm **người nhì / người ba xuất sắc nhất** (best runner-up / best third-placed) để lấp đầy bracket.
>
> Tài liệu kỹ thuật nội bộ. VI = ngôn ngữ chính, thuật ngữ + code = English. Không sửa code — chỉ review + đề xuất.

---

## 0. Tóm tắt nhanh / Executive summary

**Vấn đề.** Một giải thường có 2 pha: **vòng bảng** (round-robin trong từng bảng) → **vòng knockout** (single/double elimination). Cây knockout chạy "đẹp" khi số suất đi tiếp là **luỹ thừa của 2** (4, 8, 16, 32). Khi số bảng (hoặc số suất) không phải luỹ thừa của 2, bạn phải lấp đầy bracket bằng một trong ba cách: **byes**, **wildcards (best K-th place)**, hoặc **play-in**.

**Kết quả chính (lý thuyết).** Có một quan hệ toán học gọn:
- Số suất trực tiếp `direct = G × A` (G bảng, mỗi bảng lấy A người).
- Cỡ bracket `B = nextPow2(direct)` (hoặc cỡ mục tiêu).
- Số wildcard cần `W = B − direct`, **lấy W người xuất sắc nhất ở vị trí thứ (A+1)** xuyên các bảng.
- **Điều kiện khả thi:** `W ≤ G` (vì mỗi bảng chỉ có 1 ứng viên ở vị trí thứ A+1). Nếu `W > G` → phải dùng **byes** hoặc lấy thêm "best (A+2)-th".
- **Phát hiện đẹp:** nếu chỉ lấy **nhà vô địch bảng** (A=1) rồi bù bằng **best runner-up**, thì `W < G` **luôn đúng** với mọi G → đây là cách tổng quát sạch nhất cho 3/5/6/7 bảng.

**Hiện trạng ThePickleHub.** Đã làm tốt phần lõi (snake seeding, best-3rd có chuẩn hoá, tránh tái đấu cùng bảng) **nhưng** thuật toán bị hardcode quanh "6 bảng / top-2 + best-3rd", thiếu 5 & 7 bảng, ba code path dùng tiêu chí tiebreak khác nhau và đều **thiếu head-to-head** (trái rule USA Pickleball). Chi tiết ở Phần 2, đề xuất tổng quát hoá ở Phần 3.

---

# PHẦN 1 — LÝ THUYẾT NỀN TẢNG / Theory

## 1.1 Hai pha của một giải & vì sao cần luỹ thừa của 2

| Khái niệm | Định nghĩa ngắn |
|---|---|
| **Group / Pool** | Một nhóm nhỏ (thường 3–6 người/đội) đánh **round-robin** (vòng tròn, ai cũng gặp ai). |
| **Round-robin** | Mọi cặp trong bảng gặp nhau 1 lần → xếp hạng theo thắng/thua + tiebreak. |
| **Knockout / Single elimination** | Cây loại trực tiếp: thua 1 trận là bị loại. Cần `2^k` người để chạy "khít" (8 → 4 → 2 → 1). |
| **Seed** | Hạt giống — thứ hạng dùng để xếp người mạnh tránh gặp nhau sớm. |
| **Bye** | "Suất trống": seed cao được **miễn đánh vòng 1**, vào thẳng vòng 2. |
| **Wildcard** | Suất vớt: người **không nhất/nhì bảng** nhưng thành tích tốt nhất trong nhóm bị loại, được lấy thêm để lấp bracket. |

Cây single-elimination là **nhị phân hoàn hảo**: mỗi vòng số người giảm một nửa. Nếu số người ban đầu không phải `2^k`, có vòng "lẻ" → bắt buộc xử lý bằng bye/wildcard/play-in. Đây chính là gốc của câu hỏi.

## 1.2 Chia người vào bảng — Snake / Serpentine seeding

Mục tiêu: **các bảng cân bằng sức mạnh** (không dồn người mạnh vào 1 bảng). Phương pháp chuẩn quốc tế (ITTF table tennis, fencing, nhiều giải) là **serpentine / snake seeding**: xếp hạt giống theo hình rắn bò zig-zag qua các bảng.

Ví dụ 16 người, 4 bảng (A–D):

```
Lượt xuôi:   A1  B2  C3  D4        ← seeds 1,2,3,4
Lượt ngược:  D5  C6  B7  A8        ← seeds 5,6,7,8
Lượt xuôi:   A9  B10 C11 D12       ← seeds 9..12
Lượt ngược:  D13 C14 B15 A16       ← seeds 13..16
```

Kết quả: Bảng A = {1, 8, 9, 16}, B = {2, 7, 10, 15}, C = {3, 6, 11, 14}, D = {4, 5, 12, 13}. Mỗi bảng có 1 seed top, 1 trên-trung, 1 dưới-trung, 1 đáy → tổng "sức mạnh" gần bằng nhau.

> Biến thể: **Pot-based draw** (FIFA World Cup) — chia thành các "pot" theo ranking (Pot 1 = 12 đội mạnh nhất…), bốc ngẫu nhiên 1 đội mỗi pot vào mỗi bảng, kèm ràng buộc (không 2 đội cùng châu lục chung bảng, trừ UEFA). Snake = phiên bản tất định (deterministic) của ý tưởng này; phù hợp giải amateur vì không cần bốc thăm trực tiếp.

## 1.3 Từ bảng → bracket: 3 chiến lược khi số suất ≠ luỹ thừa của 2

Gọi `Q` = tổng số suất đi tiếp, `B = nextPow2(Q)` = cỡ bracket nhỏ nhất chứa đủ Q.

### Chiến lược A — Byes (suất trống)
Số bye `= B − Q`. Cấp bye cho **các seed cao nhất**, **phân bố đều** khắp cây (không dồn cục). Ví dụ 10 người → bracket 16 → 6 bye cho 6 seed đầu; 6 seed đó vào thẳng vòng 2, 4 seed cuối (7–10) đánh play-in… thực ra: 10 người, vòng 1 chỉ có `Q − B/2 = 10 − 8 = 2` cặp đánh (4 người), 6 người còn lại bye.

- ✅ Đơn giản, công bằng theo seed, mọi bảng lấy đúng A người.
- ❌ Seed thấp thấy "bất công" vì người khác được nghỉ; vài trận vòng 1 lẻ loi.

### Chiến lược B — Wildcards / best K-th place (trọng tâm câu hỏi)
Thay vì để trống, **lấy thêm người xuất sắc nhất ở vị trí kế tiếp** từ các bảng cho tới khi đủ `B`. Nếu mỗi bảng đã lấy A người (top-A), thì wildcard = **best (A+1)-th place** xuyên bảng:
- A = 1 (chỉ lấy nhất bảng) → wildcard = **best runner-up** = *người nhì xuất sắc nhất*.
- A = 2 (lấy nhất + nhì) → wildcard = **best third-placed** = *người ba xuất sắc nhất*.

- ✅ Không có bye, mọi suất bracket đều là người chơi thật, "đậm đặc" hơn.
- ❌ Cần **xếp hạng xuyên bảng** công bằng (mục 1.4) — phần khó nhất.

### Chiến lược C — Play-in / preliminary round
Cho các suất "dư" đánh 1 vòng loại phụ để rút về `2^k`. Ví dụ 6 suất → 2 suất hạng thấp đánh play-in tranh 1 vé → còn… (thực tế ít dùng cho amateur, tốn thời gian sân).

| Chiến lược | Khi nào hợp | Ưu | Nhược |
|---|---|---|---|
| **Byes** | Giải nhỏ, ít sân, muốn đơn giản | Dễ, công bằng theo seed | Trận vòng 1 lẻ, seed thấp thiệt |
| **Wildcards (best K-th)** | Muốn bracket "đầy", giống giải lớn | Không bye, hấp dẫn | Cần ranking xuyên bảng chuẩn |
| **Play-in** | Có thời gian, muốn kịch tính | Công bằng nhất cho suất biên | Tốn lượt/sân |

## 1.4 Bài toán cốt lõi: xếp hạng "best runner-up / best third" XUYÊN bảng

Đây là phần khó và là lý do câu hỏi tồn tại. Khi so người **thứ 2 (hoặc thứ 3) giữa các bảng khác nhau**:

**(a) Không dùng được head-to-head.** Hai người ở 2 bảng khác nhau chưa từng gặp nhau → tiêu chí đối đầu trực tiếp vô nghĩa khi so xuyên bảng (chỉ dùng được *trong* bảng).

**(b) Thứ tự tiêu chí (UEFA Euro / FIFA World Cup).** Tất cả người cùng vị trí (vd tất cả người thứ 3) xếp vào **một bảng so sánh chung**, áp dụng lần lượt:
1. Điểm (points) qua các trận vòng bảng.
2. Hiệu số (goal difference → trong pickleball là **point differential**).
3. Số bàn thắng ghi được (→ **points scored / points-for**).
4. Fair play / kỷ luật (thẻ phạt — ít liên quan pickleball).
5. Ranking nền (FIFA ranking → trong pickleball: **DUPR / seed**).

> Ví dụ kinh điển: **Bồ Đào Nha Euro 2016** xếp **nhì bảng… thực ra hạng 3 bảng** với 3 trận hòa (3 điểm), lọt vào nhờ suất *best third-placed*, rồi **vô địch cả giải**. Minh hoạ vì sao suất vớt rất "đáng giá".

**(c) Bảng KHÔNG đều số người → phải chuẩn hoá.** Nếu bảng 5 người và bảng 4 người cùng tồn tại, người ở bảng 5 đá nhiều trận hơn → so điểm thô là bất công. Cách UEFA xử lý: **loại bỏ kết quả gặp đội xếp cuối bảng** (results against the last-placed team are discarded) để mọi người được so trên cùng số trận. Đây là ý tưởng "normalize về cùng mẫu số".

**(d) Tránh tái đấu cùng bảng ở vòng knockout.** Hai người cùng bảng vừa gặp nhau ở vòng tròn → không nên gặp lại ngay ở vòng 1 knockout. FIFA giải quyết bằng **combination table** (bảng tổ hợp tiền định: với 8 trên 12 đội thứ 3 đi tiếp, có **495 tổ hợp**, mỗi tổ hợp map sẵn đội thứ 3 vào nhánh nào — đảm bảo không ai gặp lại đồng bảng). Giải nhỏ thì dùng **thuật toán hoán đổi (swap) khi phát hiện trùng bảng** (ThePickleHub đã làm — xem 2.2).

## 1.5 Ví dụ thực tế / Real-world references

| Giải | Đội | Cấu trúc bảng | Đi tiếp | Wildcard |
|---|---|---|---|---|
| **Euro 2016 / 2020 / 2024** | 24 | 6 bảng × 4 | 16 | top-2 (12) + **4 best third** |
| **World Cup 1986–1994** | 24 | 6 bảng × 4 | 16 | top-2 (12) + **4 best third** |
| **World Cup 2026** | 48 | 12 bảng × 4 | 32 | top-2 (24) + **8 best third** |
| **USA Pickleball pool play** | tuỳ | nhiều pool, round-robin | top-1/2 mỗi pool | tuỳ ban tổ chức |

**Tiebreaker chính thức USA Pickleball (Section 12)** — khi bằng số trận thắng, áp dụng theo thứ tự:
1. **Head-to-head** (đối đầu trực tiếp giữa các bên hòa).
2. **Point differential** toàn bộ ván đã đánh (vd thắng 11-8, 11-4 → +10).
3. **Head-to-head point differential**.
4. **Point differential với đối thủ hạng cao kế tiếp**.

> ⚠️ Khác biệt quan trọng cho ThePickleHub: USA Pickleball đặt **head-to-head ĐỨNG TRƯỚC point differential**. Code hiện tại bỏ qua head-to-head (xem 2.3).

### Bảng con số cho 3/5/6/7 bảng (câu hỏi trực tiếp của bạn)

`nextPow2(n)` = luỹ thừa 2 nhỏ nhất ≥ n. `direct = G×A`. `W = nextPow2(direct) − direct`. Ứng viên wildcard mỗi loại = đúng **G** (mỗi bảng 1 người ở vị trí A+1).

**A = 2 (lấy top-2 mỗi bảng) — đây là chế độ hiện tại của ThePickleHub:**

| G bảng | direct = 2G | bracket B | W = B − direct | Lấy gì | Khả thi? (W ≤ G) |
|---|---|---|---|---|---|
| 2 | 4 | 4 | 0 | — | ✅ sạch |
| **3** | 6 | 8 | **2** | 2 best **third** | ✅ (2 ≤ 3) |
| 4 | 8 | 8 | 0 | — | ✅ sạch |
| **5** | 10 | 16 | **6** | cần 6 nhưng chỉ có 5 third | ❌ **6 > 5** → xem dưới |
| **6** | 12 | 16 | **4** | 4 best **third** | ✅ (4 ≤ 6) |
| **7** | 14 | 16 | **2** | 2 best **third** | ✅ (2 ≤ 7) |
| 8 | 16 | 16 | 0 | — | ✅ sạch |

→ Cross-check: kết quả này **khớp** `getWildcardCount` hiện có (3→2, 6→4). Nhưng lộ ra **G=5 không khả thi** với "top-2 + best-third" (cần 6 wildcard, chỉ có 5 người thứ 3).

**A = 1 (chỉ lấy nhất bảng) — bù bằng best runner-up:**

| G bảng | direct = G | bracket B | W = B − direct | Lấy gì | Khả thi? |
|---|---|---|---|---|---|
| **3** | 3 | 4 | **1** | 1 best **runner-up** (nhì) | ✅ |
| 4 | 4 | 4 | 0 | — | ✅ sạch |
| **5** | 5 | 8 | **3** | 3 best **runner-up** | ✅ |
| **6** | 6 | 8 | **2** | 2 best **runner-up** | ✅ |
| **7** | 7 | 8 | **1** | 1 best **runner-up** | ✅ |
| 8 | 8 | 8 | 0 | — | ✅ sạch |

> **Kết luận quan trọng:** với A=1, ta luôn có `W = nextPow2(G) − G < G` → **luôn khả thi**. Vậy cho các "số bảng xấu" (3, 5, 6, 7), cách tổng quát sạch nhất là **lấy nhà vô địch các bảng + bù bằng best runner-up**. Riêng G=5 với A=2 thì nên dùng **byes** (10 suất → bracket 16, 6 bye cho top-6 seed) thay vì cố vớt.

---

# PHẦN 2 — HIỆN TRẠNG THEPICKLEHUB / Code review

## 2.1 Kiến trúc: có **ba** code path xếp hạng/lấp bracket

| # | Vị trí | Vai trò | Chế độ |
|---|---|---|---|
| 1 | `src/hooks/useQuickTable.ts` (~L335–400) | Template bracket **hardcode** theo số bảng (2, 3, 4, 6…): các dòng `getPlayer('A',1) vs getPlayer('B',2)`, `getNextWildcard()` | Quick Table thường |
| 2 | `src/lib/quick-table-playoff.ts` → `generateGlobalSeeding` | "Large playoff" 16-bracket: seed 1–6 winners, 7–12 runners-up, 13–16 best-third (adjusted), pad BYE | Quick Table "large_playoff" |
| 3 | `src/components/teamMatch/GroupStandingsTable.tsx` (~L210–245) | Wildcard cho team-match = "best non-qualified **overall**" | Team Match |

Hỗ trợ chung (tốt): `distributePlayersToGroups` (snake seeding) và `generateSeedPositions` (vị trí seed chuẩn) trong `src/lib/`.

## 2.2 Cái gì ĐÚNG / nên giữ ✅

1. **Snake seeding chuẩn** — `distributePlayersToGroups` (quick-table-utils.ts) cài đúng serpentine + còn tránh xếp 2 người **cùng team** chung bảng. Tốt hơn cả nhiều giải amateur.
2. **Chuẩn hoá best-3rd thông minh** — `computeBest3rdAdjustedStats` (quick-table-playoff.ts) chỉ tính các trận của người thứ 3 **gặp top-2 trong bảng của họ**. Đây chính là tinh thần "discard kết quả gặp đội cuối bảng" của UEFA, áp cho bảng lệch size: ai cũng được so trên đúng "2 trận gặp top-2" → công bằng giữa bảng 4 và bảng 5 người. **Khen** — đây là chi tiết nhiều sản phẩm bỏ qua.
3. **Tránh tái đấu cùng bảng** — `resolveGroupConflicts` (đệ quy, max depth 3, hoán đổi seed thấp) = phiên bản nhẹ của FIFA combination table, hợp lý cho quy mô nhỏ.
4. **Vị trí seed chuẩn** — `generateSeedPositions` cho 2/4/8/16/32 + đệ quy, đảm bảo seed 1 và seed 2 chỉ gặp nhau ở chung kết. Dùng đúng trong `useDoublesElimination`.
5. **`suggestGroupConfigs` có ý thức wildcard** — đã tính `wildcardNeeded = idealPlayoffSize − directSpots` và ưu tiên cấu hình không cần wildcard.

## 2.3 Gaps / vấn đề cần xử lý ⚠️

1. **`generateGlobalSeeding` hardcode đúng 6 bảng** — dòng đầu `throw new Error('expects 6 groups')`. ⇒ Large playoff **không chạy** cho 3, 5, 7 bảng. Đây là rào cản số 1 cho câu hỏi của bạn.
2. **`suggestGroupConfigs` chỉ cho `[2,3,4,6,8]`** (quick-table-utils.ts L16) — **thiếu 5 và 7**. Người tổ chức 5 bảng không có gợi ý hợp lệ.
3. **`getWildcardCount` chỉ xử lý 3→2, 6→4** (L216–222), còn lại trả 0. Không tổng quát; không có 5, 7.
4. **Chỉ hỗ trợ "top-2 + best-third"** — không có chế độ **"winners + best runner-up"** (best-2nd). Mà theo Phần 1.5, đây mới là cách *khả thi tổng quát* cho 3/5/6/7 bảng. Chính là case "lấy người **thứ 2** xuất sắc nhất" bạn nêu.
5. **Tiêu chí tiebreak KHÔNG nhất quán và thiếu head-to-head:**
   - `quick-table-playoff.ts`: `matches_won` → `point_diff` → `points_for`.
   - `teamMatch/GroupStandingsTable.tsx`: `won` → `gameDiff (gamesWon−gamesLost)` → `pointsDiff`.
   - **Cả hai bỏ head-to-head**, trong khi USA Pickleball yêu cầu **head-to-head trước point differential**. Hai người/đội cùng số trận thắng trong 1 bảng đang bị xử sai thứ tự rule.
6. **Hai triết lý wildcard khác nhau trong cùng sản phẩm:**
   - Quick Table: wildcard = **best third-placed** (chỉ xét người hạng 3, dùng adjusted stats).
   - Team Match: wildcard = **best non-qualified overall** (gộp tất cả người ngoài top-2, kể cả hạng 4 bảng to, **không** adjusted).
   ⇒ Cùng một input có thể ra kết quả khác nhau tuỳ màn hình. Nên thống nhất.
7. **Cần xác minh thứ tự cây bracket** — `generateSeededPairings` tạo cặp `1v16, 2v15, …, 8v9` theo *thứ tự tuyến tính*. Để cây đúng (seed 1 & 2 ở hai nửa đối diện) thì 8 cặp này phải được **đặt vào vị trí theo `generateSeedPositions`**, không phải xếp tuần tự. Path doubles-elimination dùng `generateSeedPositions` đúng; **cần kiểm tra** path quick-table large_playoff có áp cùng thứ tự khi render `playoff_round`/`matchNumber` không, kẻo seed 1 gặp seed 2 quá sớm.

---

# PHẦN 3 — ĐỀ XUẤT TỔNG QUÁT HOÁ / Generalized design

## 3.1 Một mô hình thống nhất: `bestKthPlace(G, A)`

Tham số hoá toàn bộ về 2 biến: **G** = số bảng, **A** = số người lấy thẳng mỗi bảng (1 hoặc 2). Mọi thứ còn lại suy ra:

```
direct      = G * A
bracketSize = chosenSize ?? nextPow2(direct)        // cho phép tổ chức chọn cỡ
wildcards   = bracketSize - direct
K           = A + 1                                  // lấy "best K-th place"
candidates  = G                                      // mỗi bảng 1 người hạng K

feasible(wildcards):
  if wildcards == 0            -> sạch, không cần gì
  else if wildcards <= G       -> lấy `wildcards` người hạng-K xuất sắc nhất (best K-th)
  else if wildcards <= 2G - direct ... -> cảnh báo: chuyển sang BYES hoặc A=1
  else                         -> dùng BYES cho (bracketSize - direct) seed cao nhất
```

## 3.2 Pseudocode tổng quát (thay cho `generateGlobalSeeding` hardcode 6)

```ts
// Tổng quát hoá generateGlobalSeeding cho N bảng, A người/bảng.
function generateSeeding(groups, players, matches, opts: { advancePerGroup: 1 | 2 }) {
  const A = opts.advancePerGroup;
  const G = groups.length;

  // 1) Xếp hạng trong từng bảng (DÙNG CHUNG 1 comparator — xem 3.3)
  const ranked = groups.map(g => rankWithinGroup(players, matches, g.id));

  // 2) Gom theo tầng vị trí
  const tiers: Player[][] = [];            // tiers[0]=nhất bảng, tiers[1]=nhì, ...
  for (let pos = 0; pos < A; pos++)
    tiers[pos] = ranked.map(r => r[pos]).filter(Boolean);

  // 3) Ứng viên wildcard = người ở vị trí thứ A (0-indexed) của mỗi bảng = "best (A+1)-th"
  const topAIdsByGroup = ranked.map(r => new Set(r.slice(0, A).map(p => p.id)));
  const wildcardPool = ranked
    .map((r, gi) => r[A] ? withAdjustedStats(r[A], matches, topAIdsByGroup[gi]) : null)
    .filter(Boolean);

  // 4) Tính cỡ bracket & số wildcard
  const direct = G * A;
  const bracketSize = opts.bracketSize ?? nextPow2(direct);
  let need = bracketSize - direct;

  // 5) Ráp seed: nhất bảng trước, rồi nhì bảng, rồi wildcard, pad BYE
  const seeded = [
    ...flattenSortedTiers(tiers),                 // seeds 1..A*G
    ...sortByAdjusted(wildcardPool).slice(0, Math.min(need, G)), // wildcards
  ];
  while (seeded.length < bracketSize) seeded.push(BYE());  // nếu need > G

  return seeded; // độ dài = bracketSize (luỹ thừa của 2)
}
```

Sau đó **giữ nguyên** `resolveGroupConflicts` (đã tốt) và **bắt buộc** dựng cây qua `generateSeedPositions(bracketSize)` để thứ tự nhánh đúng.

## 3.3 Một comparator tiebreak DÙNG CHUNG (sửa gap #5, #6)

Tách 1 module `standings.ts` dùng chung cho cả 3 path, theo đúng USA Pickleball:

```ts
// Trong cùng 1 bảng:
function rankWithinGroup(a, b) {
  if (a.wins         !== b.wins)         return b.wins - a.wins;
  if (headToHead(a,b) !== 0)             return headToHead(a, b);   // ⬅ THÊM (USAP #1)
  if (a.pointDiff    !== b.pointDiff)    return b.pointDiff - a.pointDiff;
  if (a.pointsFor    !== b.pointsFor)    return b.pointsFor - a.pointsFor;
  return seedOrDupr(a, b);                                          // chốt hạ
}

// Xuyên bảng (best K-th): KHÔNG dùng head-to-head, dùng ADJUSTED stats
// (chỉ tính trận gặp top-A bảng của họ — tái dùng computeBest3rdAdjustedStats,
//  tổng quát thành computeAdjustedStats(player, matches, topAIds)).
function rankAcrossGroups(a, b) {
  if (a.adjWins     !== b.adjWins)     return b.adjWins - a.adjWins;
  if (a.adjPointDiff!== b.adjPointDiff)return b.adjPointDiff - a.adjPointDiff;
  if (a.adjPointsFor!== b.adjPointsFor)return b.adjPointsFor - a.adjPointsFor;
  return seedOrDupr(a, b);
}
```

Lưu ý: head-to-head chỉ áp **trong bảng**; xuyên bảng vẫn dùng adjusted stats (đã đúng tinh thần UEFA).

## 3.4 Bảng cấu hình đề xuất (table-driven, hợp solo builder)

Thay 3 chỗ hardcode bằng 1 bảng tra cứu sinh tự động:

| G | Chế độ khuyến nghị | direct | bracket | wildcard | Nguồn wildcard |
|---|---|---|---|---|---|
| 2 | top-2 | 4 | 4 | 0 | — |
| 3 | top-2 + 2 best-3rd | 6 | 8 | 2 | best third |
| 4 | top-2 | 8 | 8 | 0 | — |
| **5** | **winners + 3 best runner-up** (A=1) | 5 | 8 | 3 | **best runner-up** |
| 6 | top-2 + 4 best-3rd | 12 | 16 | 4 | best third |
| 7 | top-2 + 2 best-3rd | 14 | 16 | 2 | best third |
| 8 | top-2 | 16 | 16 | 0 | — |

> G=5 cố tình dùng A=1 vì A=2 sẽ cần 6 wildcard > 5 ứng viên (bất khả). Có thể cho tổ chức **chọn tay**: "5 bảng → 8 bracket (winners + 3 vớt)" hoặc "5 bảng → 16 bracket (top-2 + 6 bye)".

## 3.5 Đặt wildcard & bye vào cây

- **Wildcard** nhận seed thấp nhất (sau winners & runners-up) → tự rơi vào nhánh gặp seed cao → `generateSeedPositions` lo đúng vị trí.
- **Bye** = đối thủ rỗng của seed cao nhất; `generateSeedPositions` phân bố đều nên bye tự trải đều, không dồn cục (đúng best practice mục 1.3-A).
- **Chống tái đấu cùng bảng:** giữ `resolveGroupConflicts`; với bracket ≥ 16 cân nhắc nâng `maxDepth` hoặc ưu tiên hoán seed trong cùng "phần tư" để không phá thứ tự seed.

---

# PHẦN 4 — KHUYẾN NGHỊ TRIỂN KHAI / Recommendations (ưu tiên)

**P0 — Bỏ hardcode, mở 5 & 7 bảng** (đáp ứng trực tiếp câu hỏi)
- Tổng quát `generateGlobalSeeding(groups, players, matches)` → nhận N bảng + `advancePerGroup`, bỏ `throw` 6-bảng.
- `getWildcardCount(G)` → tính `nextPow2(G*A) − G*A` (kèm guard `W ≤ G`, nếu không thì gợi ý byes/A=1).
- Thêm 5, 7 vào `suggestGroupConfigs.validGroupCounts`.

**P1 — Một nguồn sự thật cho standings** (sửa nhất quán + đúng rule)
- Tạo `src/lib/standings.ts`: `rankWithinGroup` (CÓ head-to-head) + `rankAcrossGroups` (adjusted). Cho cả 3 path import chung.
- Thống nhất triết lý wildcard: team-match nên đổi sang **best (A+1)-th adjusted** giống quick-table (hoặc ngược lại — chọn 1).

**P2 — Chế độ "winners + best runner-up"**
- Thêm tuỳ chọn `advancePerGroup: 1` ở UI setup → mở khoá lời giải sạch cho 3/5/6/7 bảng (Phần 1.5).

**P3 — Minh bạch cho người dùng**
- Tận dụng `SeedExplainerCard` (đã có) để hiển thị "Vì sao X là wildcard": show điểm/point-diff adjusted, nhấn mạnh "chỉ tính trận gặp top-2" để người chơi hiểu.
- Verify thứ tự cây qua `generateSeedPositions` (gap #7) — test seed 1 vs seed 2 chỉ gặp ở final.

**Ràng buộc solo builder:** mọi thứ trên là **table-driven + pure functions**, dễ unit-test (đã có `__tests__/quick-table-playoff.test.ts` làm nền), không thêm dependency, không đụng Supabase/Cloudflare. Có thể làm tăng dần: P0 trước (mở rộng case), P1 sau (gom standings).

---

## Nguồn / Sources

- USA Pickleball — Section 12 Sanctioned Tournament Policies (pool play, tiebreakers): https://www.playpickleball.com/2025-usa-pickleball-rules-section-12-sanctioned-tournament-policies/ · https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf · https://www.pickleball518.com/how-do-you-break-a-tie-in-a-round-robin-pickleball-tournament/
- Serpentine / snake seeding: https://en.wikipedia.org/wiki/Serpentine_system · https://www.bracketsninja.com/types/group-stage-bracket
- Best third-placed teams (UEFA Euro / FIFA WC 2026), tiêu chí & combination table: https://www.myfootballfacts.com/articles/best-third-placed-teams-world-cup-2026/ · https://en.wikipedia.org/wiki/Template:2026_FIFA_World_Cup_third-place_table · https://www.judgemate.com/en/guides/world-cup-2026-knockout-bracket-explained
- UEFA quy tắc loại kết quả gặp đội cuối bảng (bảng lệch size): https://en.wikipedia.org/wiki/UEFA_Euro_2024_qualifying · https://www.uefa.com/euro2024/news/028e-1b3221d55b32-0a95528a80d5-1000--uefa-euro-2024-best-third-placed-teams/
- Byes khi số đội ≠ luỹ thừa của 2: https://www.bracketsninja.com/types/single-elimination-bracket · https://bracketmaker.app/single-elimination/

### Tham chiếu code ThePickleHub
- `src/lib/quick-table-playoff.ts` — `generateGlobalSeeding` (hardcode 6), `computeBest3rdAdjustedStats`, `generateSeededPairings`, `resolveGroupConflicts`
- `src/lib/quick-table-utils.ts` — `suggestGroupConfigs` (`[2,3,4,6,8]`), `distributePlayersToGroups` (snake), `getWildcardCount` (3→2, 6→4)
- `src/lib/doubles-bracket-utils.ts` — `nextPowerOf2`, `generateSeedPositions`
- `src/hooks/useQuickTable.ts` (~L335–400) — template bracket hardcode theo số bảng
- `src/components/teamMatch/GroupStandingsTable.tsx` (~L210–245) — wildcard = best non-qualified overall
- `src/lib/__tests__/quick-table-playoff.test.ts` — test nền cho seeding
