# Tên vô địch trên card event đã kết thúc

> Slug: `champion-on-event-card` · Ngày: `2026-07-27` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: `gpt-5.6-sol` qua Codex CLI (xem external/).
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`
>
> ⚠️ `scripts/agents/debate-ledger.mjs` và `risk-tier.mjs` **không tồn tại** trong repo
> (memory `idea-pipeline-missing-scripts`) — luật vòng 2 được orchestrator cưỡng chế **thủ công**
> theo `docs/agent-round2-rules.md`; kết quả kiểm tra ghi trong `debate.json` → `ledger_note`.

---

## 0. 🔶 Cần anh quyết

> **ĐÃ QUYẾT 2026-07-27** (Cuong trả lời trực tiếp trong phiên, không sửa file trước khi code):
> **G1 = DUYỆT** (migration áp prod) · **D6 = làm card list ngay, ẩn im lặng khi không có champion**
> · **Q1 = lọc khi hiển thị** (tên ≥2 ký tự, không toàn số, không placeholder).
> **P0-riêng (leak `is_public`) = ĐÃ SHIP** trong PR #472. Bảng dưới giữ lại làm hồ sơ quyết định.

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| **G1** | **Duyệt migration RED**: 2 cột nullable `champion_player_id` + `champion_name` trên `quick_tables`, patch 2 RPC, backfill có guard | Cả 4 agent hội tụ: đây là phương án duy nhất vừa có champion trên card list vừa không tái tạo 2 sự cố P0 của pre-mortem | — (không có phía B sau vòng 2; ui-ux chứng minh "không migration" ⇒ phải cắt card list) | Migration không có down-path tự động; rollback = DROP COLUMN 1 dòng + cột inert nếu bỏ lại |
| **D6** | **Card list có vào v1 không?** Chỉ ~16-24/88 giải completed có champion (<27%) | `ui-ux-critic`: ẩn im lặng ở 74-80% row → dòng champion đọc như LỖI; làm cuối hoặc kèm phân biệt "giải vòng bảng nhiều bảng — không có vô địch" | `solution-architect`: card list là điểm dừng-và-nhìn tự nhiên sau migration | Chọn A: mất bề mặt Cuong chỉ trong ảnh gốc thêm một thời gian. Chọn B: người dùng tưởng app thiếu dữ liệu |
| **Q1** | **Lọc tên rác**: ~6/22 champion backfill là "5", "6", "7", "test4", "VDV 3" | Architect đề xuất filter rẻ: chỉ hiện khi tên ≥2 ký tự và không toàn chữ số | Hiện nguyên văn tất cả | In "Vô địch: test4" lên card công khai |
| **P0-riêng** | **Lỗ leak đang sống, KHÔNG thuộc feature này**: `renderFlexTournament` + `og-flex-tournament` dùng service-role, SELECT `is_public` nhưng không check → 18 giải flex riêng tư lộ tên qua bot UA (curl giả Googlebot là thấy) | Cả risk-auditor lẫn GPT-5.6 (độc lập) đòi vá TRƯỚC trong PR riêng: non-public → 404, rồi `?nocache=1` 18 path | — | Thêm champion vào các bề mặt này khi chưa vá = leak tên thật người chơi, không thu hồi được |

---

## 1. Ý tưởng gốc

> "khi 1 event kết thúc, thêm tên người vô địch vào card [ảnh card FEATURED MULTI-EVENT] - tất cả các loại event"

**Làm rõ ở bước 0 + sau recon:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Người chơi VI xem `/tournaments` + người nhận link share Zalo/FB (~90% entry là deep-link) |
| Phạm vi | Mọi nơi: card danh sách, trang chi tiết, share preview |
| Đôi/đội | Tên cả 2 người / tên đội — **thực tế dữ liệu chỉ có `name` free-text, in nguyên văn** (xem mục 5) |
| Loại event | Chốt lại sau recon: **mọi format cộng đồng** — nhưng số prod thu hẹp còn `quick_tables` có playoff (doubles-elim: 0 giải completed; flex: không có khái niệm chung kết) |
| Không có champion | Ẩn dòng, card giữ nguyên |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 **RED** — bám vào bước migration+backfill (định nghĩa repo: migration prod = không revert bằng git). Code hiển thị TS/Swift = 🟡 AMBER |
| **Khuyến nghị** | Option A đã siết: denormalize 2 cột ghi server-side trong **cả 2 RPC**, scope = `quick_tables` có playoff |
| **Công sức** | ~5 nửa ngày (kèm 1 fix defect 1-dòng ship trước) |
| **Rủi ro lớn nhất** | Backfill ghi sai tên vô địch cho bảng có "chung kết" mơ hồ → bắt buộc guard `count(*)=1`, mơ hồ ghi NULL |
| **Auto-merge** | **Chặn — cần Cuong duyệt** (migration). Increment 0 (fix tab trống) thì GREEN, ship được ngay |

---

## 3. Đã có sẵn gì (recon)

**Prior art:** banner "Vô địch" đã tồn tại nhưng chỉ trong bracket-view của large_playoff (`PlayoffBracket.tsx:115-168`) và doubles-elim; native có `champion` computed cho 2 format. Card list / trang chi tiết (round_robin) / share preview: **chưa có gì**.

**Sẽ đụng vào:** `useTournamentData.ts`, `Tournaments.tsx`, `ParentTournamentCard.tsx` + `useFeaturedParentTournaments.ts`, `QuickTableView.tsx`, `functions/_lib/render/tournaments.ts`, `functions/_middleware.ts` (TTL), 1 migration, `ToolsRepository.swift` + card native, i18n vi/en.

**Ràng buộc repo:** cache key thật là **`pr:v32`** (CLAUDE.md ghi v30 đã lỗi thời); `/tools/*` là `noindex` → phần này **không phải SEO**, chỉ là share preview; `.legacy.tsx` không đụng.

**Recon bị đính chính ở vòng sau:** auto-archive **không có trong cron prod** — 64 giải "completed không champion" là BTC chạy vòng bảng rồi dừng (74% dữ liệu thật, là đường chính không phải edge case).

---

## 4. Phương án (solution-architect)

### Option A (CHỌN, đã siết sau vòng 2) — denormalize `champion_player_id` + `champion_name` trên `quick_tables`

Effort: ~5 nửa ngày · Data: **migration** (2 cột nullable + patch 2 RPC + backfill có guard)

Cách hoạt động: cột được ghi **server-side** tại đúng chỗ hệ thống đã kết luận "trận chung kết xong":
- `score_quick_table_match_atomic` (`20260722030000:236-255`) — block `IF` đã set `status='completed'`, `v_winner_id` sẵn trong scope. Web + native gọi CÙNG RPC này (`useQuickTableMutations.ts:156`, `QuickTableRepository.swift:712`) → **binary native cũ vẫn ghi cột** (luận điểm ngược lại của risk-auditor vòng 1 đã bị chính nó rút ở vòng 2).
- **Điều kiện D4 (pre-mortem + risk-auditor cùng tìm ra):** phải ghi cả ở `create_quick_table_playoff_atomic` (`20260722070000:755-759`) — nếu không, rebuild bracket sau completed sẽ xoá champion im lặng. Auto-archive để NULL là ĐÚNG (ẩn dòng).
- **Điều kiện D5:** backfill tái dùng guard `v_current_round_count = 1`; 2 bảng có >1 trận ở vòng cuối = mơ hồ → NULL.
- Kèm 1 pgTAP/query giám sát: `count(completed AND champion_player_id IS NULL AND EXISTS final-match-có-winner) = 0`.

Được: 1 nguồn duy nhất, 0 query phụ trên card list, SSR 0 round-trip thêm, native chỉ thêm tên cột vào select. · Mất: đụng hot path chấm điểm (lưới: pgTAP 51 assertion sẵn có + case mới). · Đóng cửa: chốt champion = winner trận CK playoff; round-robin thuần không playoff = không có vô địch (đúng cấu trúc dữ liệu: 0/84 bảng single-group).

### Option B — derive runtime, không migration → **LOẠI**

Nhân luật thành 3 bản TS/Cloudflare/Swift (repo đã trả giá: `quickTableResult.ts` + Swift twin); và chính là cơ chế của 2 sự cố pre-mortem (batch fetch không `.order()` + comparator không total-order → card và detail trao cúp cho 2 người khác nhau; row-cap 1000 nuốt im lặng). ui-ux-critic xếp nó là phương án **tệ nhất**, không phải an toàn nhất — nếu cấm migration thì thà cắt card list.

### Option C — 30% (migration + card list) → gộp làm increment của A.

### Increments (thứ tự MỚI sau vòng 2 — architect CONCEDE D3)

0. **Fix defect đang sống** (độc lập feature, GREEN, 1 dòng): `QuickTableView.tsx:156` ép `activeTab='playoff'` → ~60/84 giải round_robin completed mở **tab trống** từ deep-link share. Đổi thành `hasPlayoff ? 'playoff' : 'groups'`. Ship trước, PR riêng.
1. **Migration + backfill** (🔴 gate Cuong) — verify: đúng ~22-24 row có champion, 0 row mơ hồ bị ghi, pgTAP xanh.
2. **Trang chi tiết + native parity** — hiển thị từ cột (banner PlayoffBracket đã có cho giải playoff; phần thêm là đường round_robin/groups nếu Cuong muốn + native card).
3. **Card list web + multi-event card + i18n** — CHỜ quyết D6.
4. **SSR share preview** (AMBER, làm cuối): champion vào ĐẦU `og:description` trong `renderQuickTable`; **không bump v33**; hạ TTL `/tools/*` 6h→5' qua nhánh `pathCacheTtl` sẵn có; `?nocache=1` từng path khi cần; ADR 1 dòng: "OG = bản chụp tại thời điểm share".

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

**Luồng thật:** ~90% entry = deep-link Zalo/FB vào trang chi tiết, không qua `/tournaments`. Task: đọc tên vô địch ≤3 giây, một tay, ngoài nắng.

**Blocker còn hiệu lực sau vòng 2** (những cái về file/scope đã được resolve ở mục 4):
- Champion phải về **cùng round-trip** với row (CLS trên 4G) → thoả bằng cột denormalized.
- **Contrast:** KHÔNG dùng gold trên tint vàng — light mode composite 4.16:1 fail AA (đúng lớp lỗi #426). Nhãn `var(--tl-fg-3)` (5.04/4.88:1), tên `var(--tl-fg)`.
- **Tên:** in `quick_table_players.name` **nguyên văn, không parse** (player2_name chỉ 3/22 populated — luật "player1 / & player2" không build được, ui-ux đã nhượng cơ chế). Card: wrap 2 dòng `-webkit-line-clamp: 2`. Chi tiết: wrap tự do, không truncate.
- **A11y:** element riêng (không nhét vào chuỗi `·` meta), nhãn có dấu hai chấm trong DOM `Vô địch:`, icon `aria-hidden`, sub-event button `minHeight: 44` (hiện ~30px), sửa luôn focus ring lime→gold ở `ParentTournamentCard.tsx:257`.

**Copy (VI/EN):** namespace mới `result.champion` = "Vô địch" / "Champion" (key riêng, không tái dùng namespace quickTable.playoff/teamMatch); thống nhất "Đã kết thúc" (bỏ "Hoàn thành"); map raw enum `round_robin`→"Vòng tròn". Không icon ở list row; Crown (không Trophy, không emoji) ở detail + featured card.

**Trạng thái:** không champion → không render gì (không "—", không placeholder). Query fail → coi như không có. Offline: champion bất biến, cache dài hạn OK.

**Nên sửa kèm (free win):** bỏ pill "ĐÃ KẾT THÚC" lặp 100 lần trong tab đã-kết-thúc.

**Panel đa model:** 11 điểm Claude + GPT-5.6 đồng thuận độc lập (per-sub-event, không vào `<title>` vì budget 60 byte, OG image động = vòng 2…). 5 bất đồng — Claude thắng cả 5 với bằng chứng repo (đáng chú ý: GPT tính contrast trên nền trần, thiếu composite tint light-mode). GPT-5.6 không thấy được 4 blocker repo-only. Chi tiết: `round1/ui-ux-critic.md`.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (bám bước migration+backfill; code hiển thị AMBER)

Classifier `risk-tier.mjs` **không chạy được** (file không tồn tại) — auditor tự đặt tier, không có sàn máy móc.

Rủi ro chính còn lại sau vòng 2 (bảng đầy đủ 11 mục: `round1/risk-auditor.md`):

| # | Mức | Cơ chế | Giảm thiểu |
|---|-----|--------|------------|
| 1 | Cao | Lỗ `is_public` flex (og + SSR, service-role, 18 giải private) — **đang sống, độc lập feature** | PR riêng vá trước; verify curl bot UA → 404 |
| 2 | Cao | Backfill ghi sai cho bảng "chung kết" mơ hồ | Guard `count(*)=1`, mơ hồ → NULL (điều kiện merge) |
| 3 | Cao | Đường ghi bị bỏ sót (3 đường set completed) → champion NULL/cũ sai im lặng | Ghi ở cả 2 RPC + query giám sát = 0 |
| 4 | TB | Hai định nghĩa winner (cron feed `score1>score2` vs `winner_id`) — hôm nay 210/210 khớp | Ghi nhận nợ; không chặn v1 |
| 5 | TB | Zalo cache preview vĩnh viễn, không re-scrape được | TTL 5' + ADR "bản chụp tại thời điểm share" (chấp nhận phần dư) |
| 6 | Thấp | Tên free-text vỡ layout / tên rác | line-clamp 2 + filter Q1 |

### SLO
- SLO 4 (scoring): đụng RPC chấm điểm — lưới pgTAP bắt buộc chạy trước áp prod. SLO 6 (LCP VN): **0 round-trip thêm** nhờ cột denormalized (đường derive bị loại chính vì +122ms DB + RTT trên first paint).

### Perf
- Bundle: +2-4 KB gz → ~1826 / 1970 KB (headroom ~148 KB). INITIAL không đổi (lazy route).

### SEO
- Route SSR đụng: chỉ `/tools/quick-tables/:id` — **noindex**, không có giá trị SEO, chỉ share preview. **Không bump pr:v32** (cả 3 agent hội tụ sau vòng 2; bump = flush toàn site + cold render budget 8s).

### Rollback
- Code TS/Swift: `git revert` 5-10'. Migration: DROP COLUMN 1 dòng (cột nullable, inert nếu bỏ lại) — nhưng **dữ liệu backfill sai thì không tự sửa**, nên guard là điều kiện. Preview đã bị Zalo scrape: không thu hồi được (chấp nhận bằng ADR).

### Phản biện độc lập (GPT-5.6)
- Xác minh đúng: lỗ `is_public` flex (finding đẩy verdict lên RED), limit(100) pool 88/100, 2 định nghĩa winner, Zalo cache, ghost-profile trùng tên.
- Bác bỏ: "HTML injection qua tên champion" — SAI, cả 4 og-* + Pages lib đều escape sẵn (hallucination bị chặn đúng chỗ).

---

## 7. Tranh luận trong panel

> `debate-ledger.mjs` không tồn tại — cưỡng chế thủ công theo `docs/agent-round2-rules.md`.
> Kiểm tra: 1 CONCEDE duy nhất có evidence tự kiểm chứng; risk-auditor không hạ RED (chỉ REFINE thu hẹp — được phép); 0 CONCEDE không bằng chứng.

| ID | Chủ đề | Kết cục |
|----|--------|---------|
| D1 | Denormalize vs derive | CONVERGED có điều kiện (ghi 2 RPC + guard backfill); migration = gate RED → **G1 mục 0** |
| D2 | Champion vào share preview v1 | CONVERGED: AMBER, increment cuối, không bump v33, TTL 5', ADR bản-chụp |
| D3 | Bề mặt ưu tiên | RESOLVED — architect **CONCEDE** với evidence `QuickTableView.tsx:156/905/1380` (tab trống ~60 giải) |
| D4 | 3 đường set completed | ADOPTED_AS_CONDITION (pre-mortem + risk-auditor độc lập cùng tìm, file:line kiểm chứng được) |
| D5 | Guard backfill | ADOPTED_AS_CONDITION |
| D6 | Mật độ card list <27% | **OPEN_FOR_CUONG** (mục 0) |
| D7 | Tie-break heap-order | MOOT — thiết kế chốt bỏ nhánh standings, champion = winner_id đơn trị |

**Bất đồng ảo bị giết ở vòng 2** (vòng 2 làm đúng việc): "native cũ không ghi cột" (risk-auditor rút — ghi server-side), "blob-loss đe doạ share preview" (rút — Pages Function ≠ Supabase edge, og-* là code chết 0 invocation/7 ngày), "banner bracket đã đủ cho detail" (architect rút — 60/84 giải thấy tab trống), kịch bản auto-archive của pre-mortem (rút — không có trong cron prod).

**Ghi chú trung thực về đồng thuận:** phần lớn hội tụ vòng 2 là Claude-với-Claude — bằng chứng file:line là thứ đáng tin, không phải sự gật gù. Đồng thuận cross-vendor thật (GPT-5.6 + Claude độc lập): lỗ `is_public` phải vá trước, per-sub-event champion, không vào `<title>`, OG image động để sau.

**Nhượng bộ bị LOẠI:** không có.

---

## 8. Kế hoạch verify

**Tự động:**
- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>` · `npx tsc -b --noEmit` · `npm run test`
- [ ] pgTAP: case mới "chấm CK → champion ghi" + "rebuild playoff sau completed → champion giữ/ghi lại" + query giám sát = 0
- [ ] `npm run build` + `check-bundle-size.mjs` ≤ 1970 KB
- [ ] Backfill dry-run: đếm row được ghi = số giải có final duy nhất; row mơ hồ = NULL
- [ ] `npm run e2e:smoke` · post-deploy `/`, `/tournaments`
- [ ] Increment 4: `curl -A Googlebot ".../tools/quick-tables/<shareId>?nocache=1"` → description có "Vô địch: …"
- [ ] Sau vá leak (PR riêng): `curl -A facebookexternalhit` og-flex private → 404

**Cuong phải tự làm:**
- [ ] Duyệt migration (G1) + quyết D6, Q1
- [ ] Mở 1 giải completed thật trên iPhone: card + chi tiết khớp nhau, tên không vỡ layout
- [ ] Share 1 link giải completed vào Zalo test, xem preview

---

## 9. Sau khi ship

**Increment 0 + vá leak (P0-riêng) — SHIPPED 2026-07-27.** Phần chính (G1 migration, card list, SSR champion, native) đã được duyệt cùng ngày và triển khai trên `feat/quick-table-champion` — xem mục "Phần chính" dưới.

- **#472** `fix(privacy): gate private tournaments from bot-facing surfaces` — merge `e747e58e`. 18/18 path private → 404 (Googlebot UA, `?nocache=1`), 6/6 public → 200. Edge functions og-flex/og-quick deploy `--use-api`, behavior-test pass ×3. Đuôi chấp nhận: bản KV cache cũ sống ≤6h (chỉ lộ khi fetch thẳng bot UA + biết share_id; HTML có noindex nên không vào SERP).
- **#474** `fix(quicktable): completed round-robin no longer opens an empty playoff tab` — merge `8e3820b7`. ui-ux-verifier PASS với A/B prod-vs-preview; regression giải có playoff giữ nguyên banner.
- Soak 30' chung: 🟢 0 signature mới (baseline vốn ~6 event/24h — sức phát hiện thấp, đã ghi rõ).
- **Khác kế hoạch:** (1) GitHub Actions HẾT BUDGET — cả 6 CI job không chạy; Cuong duyệt tường minh merge bằng bằng chứng tay (quality chạy tay xanh, preview matrix 24/24, smoke prod 28 pass, seo-verify 40/40). visual/codeql/lighthouse/npm-audit KHÔNG chạy ở đâu cả cho 2 PR này. (2) Vá leak mở rộng thêm `renderQuickTable`/`og-quick-table` (cùng lớp lỗi, quick_tables có is_public nhưng hôm nay 0 row private). (3) Blob-loss og-* tự lành sau redeploy — dữ kiện mới cho SU-429781.
- Học được: → `.claude/memory/lessons-learned.md` (4 mục mới 2026-07-27: blob-heal-by-redeploy, isolate cũ sau deploy, og-* dead code, KV chỉ cache 200).

### Phần chính — `feat/quick-table-champion` (2026-07-27)

Migration **đã áp prod + verify** trước khi merge code (kênh Management API, memory `supabase-prod-sql-workflow`):
- `20260727120000_quick_table_champion.sql` — 2 cột + champion clause trong CẢ `score_quick_table_match_atomic` và `create_quick_table_playoff_atomic` (thân hàm lấy nguyên văn từ `pg_get_functiondef` trên prod, chỉ thêm đúng một mệnh đề mỗi hàm) + backfill guard `count(*)=1` + invariant check trong chính migration. Kết quả: **22 row** backfill, invariant sạch.
- `20260727130000_quick_table_champion_guard.sql` — BEFORE UPDATE trigger revert im lặng mọi thay đổi cột champion đến từ role client. Vá finding 🔴 của qa-verifier: policy `Creators can update their tables` không giới hạn cột → BTC có thể tự phong vô địch giả qua PostgREST. Đã thực nghiệm trên prod (giả role `authenticated` = creator thật, UPDATE trong transaction rollback): champion **không** bị ghi.

Code: web card list + featured card per-sub-event + SSR description + native Swift twin + filter dùng chung `src/lib/championDisplay.ts`.

Khác kế hoạch / phát sinh:
- **Filter Q1 phải làm 2 vòng.** v1 (`<2 ký tự` / toàn số) lọt `test4`, `VDV 3`, `Player 4` lên card **và** `og:description` — ui-ux-verifier FAIL đúng chỗ. v2 thêm mẫu placeholder, đối chiếu **đủ 22 tên prod**: chặn đúng 8 rác, giữ trọn 14 tên thật, ghim bằng `src/lib/__tests__/championDisplay.test.ts` (24 assertion).
- **`types.ts` chưa regen sau khi áp migration** → `tsc -b` đỏ; qa-verifier tự sửa bằng lệnh canonical (commit `686ed50b`).
- **Bỏ pill "Đã kết thúc" trên MỌI row của tab ended** (không chỉ row có champion) — pattern xen kẽ đọc còn tệ hơn lặp lại. Và `round_robin` → "Vòng tròn"/"Round robin" (raw enum này lộ trên card từ trước, sửa luôn).
- **Không làm** (ghi nợ, không chặn): `functions/_lib/html.ts` vẫn `Cache-Control: max-age=3600` nên TTL KV 5' bị tầng CDN che 1 giờ; trang chi tiết còn pill "HOÀN THÀNH" + banner "NHÀ VÔ ĐỊCH" (card dùng "VÔ ĐỊCH:") — thống nhất namespace `result.*` là việc riêng.

Verify: qa-verifier PASS vòng 1/5 (1225 test + build + bundle 1854.8/1970 KB) · native `BUILD SUCCEEDED` (iPhone 17 Pro sim) · ui-ux-verifier PASS sau vòng vá (14 champion đúng, 0/88 row còn pill/raw enum, SSR đúng 2 chiều, console sạch, contrast thực đo 5.27/5.22) · pgTAP `quick_table_champion.test.sql` **chưa chạy** (Docker không có trong sandbox; CI chờ Actions budget).
