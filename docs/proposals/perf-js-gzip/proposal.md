# Tối ưu JS gzip — điều tra nguyên nhân + kế hoạch cải tiến

> Slug: `perf-js-gzip` · Ngày: `2026-07-17` · Trạng thái: `shipped` (2026-07-18)
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: xem `external/`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D1 | **Gate `BUNDLE_STRICT` trong CI nên đo gì** — đây là thay đổi chính sách CI, không chỉ code | `solution-architect`: tách CODE vs CONTENT trong `check-bundle-size.mjs`, target <1800 vào CODE aggregate (loại 353 KB blog song ngữ ra khỏi "budget code", giữ trần 20 KB/bài) | `pre-mortem`: mọi aggregate đều mù initial-load — phải thêm gate parse `dist/index.html` đo initial-load gz + số request critical-path | Chỉ làm CODE-split: một thay đổi tương lai kéo 100 KB từ lazy vào shell eager sẽ qua gate xanh mà first-paint mobile VN regress không ai thấy. Chỉ làm initial-load: mỗi bài blog mới lại ăn budget code như cũ. |

**Lưu ý quan trọng:** sau vòng 2 hai phía đã **hội tụ về nội dung** — làm CẢ HAI gate trong cùng một file, +0,5 nửa ngày (architect REFINE, gộp parser ~30 dòng của pre-mortem vào Option A). Không còn mâu thuẫn kỹ thuật; thứ cần anh duyệt là **đổi định nghĩa gate CI** từ "tổng aggregate 1970" sang "initial-load + CODE aggregate". Panel khuyến nghị: duyệt cả hai.

---

## 1. Ý tưởng gốc

"tối ưu ngay JS gzip. Điều tra nguyên nhân, đưa ra báo cáo cải tiến"

**Làm rõ ở bước 0** (`00-intake.md`):

| Hỏi | Trả lời |
|---|---|
| Mục tiêu | CẢ HAI: (a) tải trang đầu `/`, `/vi` nhanh hơn, (b) tổng gzip <1.800 KB |
| Đánh đổi UX | Chấp nhận lazy sâu hơn nếu <500ms + có skeleton |
| Phạm vi | Điều tra + báo cáo trước; duyệt rồi mới /ship từng việc |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED cho gói đầy đủ (increment 3 đụng `vite.config.ts` + `package.json` — classifier floor); từng increment: 1 🟢 · 2 🟡 · 3 🔴 |
| **Khuyến nghị** | Option B — sửa phép đo (2 gate) + gỡ recharts; phát hiện mới từ đối chất biến nó từ "dọn aggregate" thành **first-paint win thật 107,8 KB** |
| **Công sức** | ~5 nửa ngày (increment 1: 1,5 · increment 2-3: 3-4) |
| **Rủi ro lớn nhất** | Đổi tên/tách vendor chunk làm precache whitelist trượt → user đã cài PWA mở offline kẹt "Loading…" vĩnh viễn |
| **Auto-merge** | Increment 1 được; increment 3 **chặn — cần anh duyệt + test PWA offline trên preview** |

### 🔑 Phát hiện quan trọng nhất (mới, từ vòng đối chất — cả 2 agent verify độc lập trên dist)

**`vendor-charts` (recharts, 107,8 KB gz) đang tải EAGER trên MỌI trang.** `dist/index.html` modulepreload nó và entry static-import nó (`import{c as yi}from"./vendor-charts…"`), dù mọi consumer (DuprRatingChart, Admin/CreatorAnalytics) đều là lazy route. Cả recon lẫn round 1 của architect đều tưởng nó "đã lazy" — sai, và architect đã tự đính chính. Hệ quả:

- Initial-load thật ≈ **444 KB gz** chứ không phải ~336 KB như ước lượng ban đầu.
- **Gỡ recharts = −107,8 KB first-paint cho 95% user mobile VN** — đòn bẩy initial-load lớn nhất còn lại, hơn mọi phương án lazy thêm.
- Không công cụ đo nào hiện tại (aggregate, precache-membership) nhìn thấy lỗi này — đúng luận điểm gate initial-load của pre-mortem (D1).

### Hai kết luận điều tra chính (goal a + b)

1. **Initial load (goal a):** shell đã tối ưu tốt sau PERF-02/03/06 — trừ đúng một lỗi: recharts eager (trên). Nghi vấn "react-dom lọt entry" của recon là **SAI** (đã bác bằng 2 fingerprint độc lập: react-dom nằm trong vendor-ui, cả vendor-ui lẫn vendor-react đều preload — dời qua lại 0 KB).
2. **Tổng 1.930 KB (goal b):** bị đội bởi 3 khối LAZY: blog content song ngữ **353 KB** (47 file, tăng vô hạn mỗi bài — lỗi phép đo hơn là bloat), vendor-video **296 KB** (mux-player nhúng hls fork trùng — đường LIVE, rủi ro cao), recharts **108 KB** (3 trang, rủi ro thấp). CODE thật ≈ 1.577 KB — **đã dưới 1.800**; sau khi gỡ recharts ≈ 1.455 KB.

---

## 3. Đã có sẵn gì (recon)

**Prior art:** PERF-06 (locale split), PERF-03 (precache whitelist 1,44 MB), PERF-02 (#345, TeamMatchView dialogs lazy) — đều đã merge. 95% route đã lazy, chỉ `Index` eager có chủ đích. Mux player lazy ở `LiveSection.tsx:8`.

**Sẽ đụng vào:** `scripts/check-bundle-size.mjs`, `docs/perf-budgets.md`, `src/components/social/player/DuprRatingChart.tsx`, `src/pages/admin/AdminAnalytics.tsx`, `src/pages/creator/CreatorAnalytics.tsx`, `vite.config.ts` (manualChunks:311), `package.json`.

**Ràng buộc đã ghi:** `docs/perf-budgets.md` — không bump budget 1970 nữa; route chunk ≤150 KB; dep mới >20 KB vào entry cần lý do. Đừng đụng lại logic locale split (PERF-06).

---

## 4. Phương án (solution-architect)

### Option A — Đo đúng cái cần đo (sau REFINE vòng 2)

Effort: **1,5 nửa ngày** · Files: `check-bundle-size.mjs`, `perf-budgets.md`, `DuprRatingChart.tsx` · Data: none

`check-bundle-size.mjs` in 3 số thay vì 1: **CODE gz** (loại `blog-post-*.js`), **CONTENT gz** (blog), **initial-load gz + số request critical-path** (parse `dist/index.html`: script + modulepreload + static-import đệ quy của entry — parser ~30 dòng của pre-mortem). Gate `BUNDLE_STRICT` chuyển sang initial-load + CODE. Trần 20 KB/bài blog giữ để bài phình vẫn đỏ. Cập nhật `perf-budgets.md` (entry stale 170→102 KB, luật CODE/CONTENT). Bonus: `DuprRatingChart` → SVG sparkline 0-dep.

Được: chạm mục tiêu (b) ngay bằng phép đo đúng, chặn cả blog-creep lẫn eager-regression. Mất: chưa giảm byte thật. Đóng cửa: không.

### Option B — A + gỡ recharts hẳn (RECOMMENDED)

Effort: **~5 nửa ngày** · Files: A + `AdminAnalytics.tsx`, `CreatorAnalytics.tsx`, `vite.config.ts:311`, `package.json` · Data: none

Làm hết A, rồi chuyển 2 dashboard analytics (1 admin + 2 creator user) off recharts — ưu tiên SVG 0-dep; nếu chart phức tạp thì 1 lib nhẹ lazy (uPlot ~8 KB) và net còn ~−100 KB. Gỡ `recharts` khỏi deps + manualChunks. Khi /ship phải tìm và cắt **cạnh import eager** đang kéo vendor-charts vào entry (nguồn gốc phát hiện 🔑 trên).

Kết quả: **initial-load −107,8 KB** (444→336) và **CODE ≈ 1.455 KB**, tổng-ship ≈ 1.822 KB. Không đụng live, không đụng blog SSR.

### Option C — Gỡ luôn @mux/mux-player-react (KHÔNG khuyến nghị lúc này)

Effort: +4-5 nửa ngày · Tiết kiệm ~200-250 KB aggregate (mux-player + hls fork trùng) — nhưng vendor-video **đã lazy, không ảnh hưởng initial-load**; đổi lấy rủi ro đường LIVE (mất Mux Data beacons, tự xử streamType, test kép web/native) — đúng loại path `docs/slo.md` cấm đánh cược. Chỉ làm nếu anh chấp nhận đánh đổi, tách proposal riêng.

### Khuyến nghị

**Option B.** A một mình không giảm byte thật; C đổi rủi ro live lấy con số aggregate mà B đã xử. B cắt byte thật ở path ≤3 user (dashboard) + 1 component public (DUPR chart), và nhờ phát hiện recharts-eager, nó đồng thời phục vụ cả goal (a) lẫn (b).

### Increments

1. 🟢 **Metric split + initial-load gate + doc** — verify: `node scripts/check-bundle-size.mjs` in CODE ≈ 1577 <1800, initial-load ≈ 444, gate xanh. Auto-merge được.
2. 🟡 **DuprRatingChart → SVG sparkline** — verify: build + profile player render đúng với `history=[]`, 1 điểm, data thưa (vitest jsdom — chặn sự cố 2 pre-mortem); recharts biến khỏi chunk route đó.
3. 🔴 **Admin/CreatorAnalytics off recharts + gỡ dep + manualChunks + cắt cạnh eager-import** — verify: `grep -rl recharts src/` rỗng; initial-load giảm ~108 KB; **test PWA offline trên preview** (cài PWA online → tắt mạng → mở lại phải mount); Cuong xem 2 dashboard trước merge. **Chặn auto-merge.**

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Kết luận chính

Lazy sâu hơn **không phải** nút bấm an toàn kéo hết cỡ — vấn đề nằm ở fallback, không phải ở việc tách chunk. Và (đồng thuận 2 model): lazy thêm **không giảm tổng gzip** — chỉ dời byte.

### Vấn đề

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | **Blocker** | `PageLoader` (App.tsx:239) spinner trắng trần là fallback MỌI route lazy, gồm 3 trang scoring + WatchLive — lazy thêm khuếch đại đúng màn vi phạm điều kiện "phải có skeleton" | Route-specific skeleton cho trang critical (scoring: tên đội + ô điểm + nút disabled; live: khung poster 16:9) |
| 2 | **Blocker** | Cấm tách scoring controls (+1/−1, undo, sửa/xác nhận điểm) ra chunk interaction-time — tap cold chunk = referee sai điểm, vỡ INP 200ms | Bundle thẳng vào route chunk scoring; chỉ tách phần phụ (audit history, share, stats) |
| 3 | **Blocker** | Không per-icon dynamic import trên chrome critical (bottom-nav, +1/−1, Play) | Static named import, không barrel |
| 4 | Nên sửa | 11 dialog TeamMatchView `fallback={null}` = dead-tap (flow setup organizer) | Modal shell eager + skeleton thân; GPT-5.6 muốn nâng Blocker, critic chốt Nên-sửa vì severity theo hậu-quả-tại-thời-điểm-dùng |
| 5-7 | Nên sửa | Live play câm không chữ; rankings double-wait; **chưa có prefetch strategy** (<500ms bất khả thi trên cold 3G nếu chờ tap) | Copy "Đang tải video trực tiếp…"; list-trước-chart-sau; prefetch viewport/route-idle/pointerdown, gate bằng Save-Data |
| 8-9 | Nit | Swap chart lib: VI labels/touch tooltip/ARIA checklist; PageLoader trang content | Checklist UX ký duyệt khi chọn lib |

Chi tiết trạng thái màn hình, a11y, copy VI/EN: `round1/ui-ux-critic.md`.

**Áp vào Option B:** increment 2-3 phải qua checklist #8 (VI labels, tooltip chạm, data thưa). Các Blocker #1-3 là ranh giới cho MỌI việc lazy tương lai — không chặn Option B (B không lazy thêm gì).

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict theo loại việc (auditor — không hạ được)

| Loại việc | Tier | Trong Option B? |
|---|---|---|
| Config chunking (`vite.config.ts`) | 🔴 RED | Increment 3 (gỡ recharts khỏi manualChunks) |
| Lazy sâu hơn | 🟡 AMBER | Không |
| Dep swap (recharts) | 🟡 AMBER | Increment 2-3 |
| Xoá dead code | 🟢 GREEN | Increment 1 |

Classifier đường dẫn: RED (`vite.config.ts`, `package.json` floor) — khớp auditor. RED đứng vì: (a) classifier floor, (b) PWA offline-launch không tự lành, (c) vừa dính outage chunking 6 ngày trước.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao (offline) | Đổi tên/tách vendor chunk → tên emit trượt precache whitelist (`vite.config.ts:104-124`) → boot-critical chunk không precache | PWA đã cài mở offline: "Loading…" vĩnh viễn, không ChunkErrorBoundary (lỗi trước mount); revert không cứu user đang kẹt offline | Sau build đối chiếu `dist/assets` với globPatterns TRONG CÙNG commit; test PWA offline trên preview; vitest "boot-critical ⊆ whitelist" (~40 dòng, pre-mortem đề xuất) |
| 2 | TB | Swap chart lib mất empty-state grace của recharts → player data thưa (đa số) thấy chart trống, ErrorBoundary nuốt lỗi, không ai báo | `/nguoi-choi/<slug>` chart trắng; user tự trách "chưa đủ trận" | Vitest jsdom `DuprRatingChart` với `history=[]`/1 điểm/null/numeric-string + `locale-vi` (1 file, chặn trước) |
| 3 | TB | Ship cả recharts + lib mới (swap dở dang) | CI đỏ 1970 (bắt trước merge) | Xác nhận recharts biến khỏi dist |

### SLO / SEO / Perf

- **SLO:** chỉ SLO 1 (availability) bị đe doạ qua đường PWA offline; SLO 4 scoring KHÔNG đụng (Option B không chạm scoring). SLO 6 (VN p75) là mục tiêu — đo `web_vital` RUM VN trước/sau, đừng tin GA4 global (bot).
- **SEO: miễn nhiễm hoàn toàn** — verify `functions/_middleware.ts` `routeAndRender()` dựng HTML từ Supabase, không nạp `/assets/*.js`. Không bump `pr:v30`.
- **Bundle:** increment 1 +0 KB; increment 2-3 −108 KB → ~1.822 KB tổng, initial-load ~336 KB.

### Đính chính memory quan trọng

**Class outage 2026-07-11 ĐÃ ĐÓNG** — memory "build-token chưa làm" là stale. Tier 1: `BUILD_ID` nối tên entry (`vite.config.ts:19,285`); Tier 2: asset thiếu → 404 no-store (`_middleware.ts:335-346`). GPT-5.6 độc lập trùng kết luận. Rủi ro còn lại là precache-whitelist drift (#1) — cơ chế KHÁC.

### Rollback

Cả 4 loại việc: `git revert` + redeploy ~2-3 phút. Không migration, không native build. **Ngoại lệ:** user PWA đang kẹt offline không nhận được fix tới khi online lại — lý do RED đứng dù revert được.

### Phản biện độc lập (GPT-5.6)

- Xác minh đúng: whitelist khớp TÊN file (rename hỏng, bơm-vào-chunk-cùng-tên an toàn); outage class đã đóng; `lazyRetry` không cứu chunk đã xoá; numeric-string/NaN khi swap chart.
- Bác bỏ: GPT tưởng recharts ở `/rankings` — sai, chỉ ở 3 file (DuprRatingChart, Admin/CreatorAnalytics).

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). Đồng thuận không phải mục tiêu.
> Cưỡng chế bởi `debate-ledger.mjs` — kết quả: ✅ luật OK, 2 bất đồng · 1 giải quyết bằng bằng chứng · 1 mở.

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Gate bundle nên đo gì: aggregate CODE (loại blog content) hay initial-load thật | **solution-architect**: tách CODE vs CONTENT, target <1800 vào CODE aggregate, trần 20 KB/bài blog<br>**pre-mortem**: gate aggregate (kể cả CODE) mù initial-load — phải parse dist/index.html | **solution-architect**: REFINE<br>**pre-mortem**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** (nội dung đã hội tụ: làm cả hai — xem mục 0) |
| D2 | react-dom có trong entry không; fix manualChunks có rủi ro waterfall không | **solution-architect**: đã bác bằng grep fingerprint — react-dom ở vendor-ui, dời = 0 KB<br>**pre-mortem**: kéo react-dom khỏi entry thêm hop tuần tự → mobile VN chậm hơn | **solution-architect**: HOLD<br>**pre-mortem**: CONCEDE (tự verify dist) | ✅ RESOLVED_EVIDENCE | react-dom trong vendor-ui; cả 2 chunk đều preload; sự cố 3 bị loại về cơ chế. Phát hiện phụ: vendor-charts eager → first-paint win thật khi gỡ recharts |

### Bất đồng bị giết ở vòng 2 (ảo)

D2 — pre-mortem CONCEDE sau khi TỰ chạy grep trên dist (`onRecoverableError`: entry 0 / vendor-react 0 / vendor-ui 6) và đọc modulepreload trong `dist/index.html`. Vòng 2 làm đúng việc: giết bất đồng do thiếu dữ kiện, và trong quá trình đó lộ ra phát hiện recharts-eager (buộc architect tự đính chính round 1 "recharts đã lazy" → sai).

### Bất đồng sống sót

D1 — nhưng ở dạng đặc biệt: hai phía đồng ý về giải pháp kỹ thuật (làm cả hai gate), chỉ còn quyết định chính sách CI thuộc thẩm quyền Cuong. Điều chứng minh pre-mortem đúng: chính vendor-charts eager là bug loại "aggregate mù" đang tồn tại hôm nay.

### Nhượng bộ bị LOẠI

Không có. Ledger xanh lần chạy đầu.

### Đồng thuận cross-vendor (tín hiệu mạnh — GPT-5.6 độc lập trùng Claude)

1. Lazy/split **không** giảm tổng gzip — chỉ xoá/thay dependency mới giảm (cả 2 luồng GPT-5.6 + cả 4 agent Claude).
2. Class outage 2026-07-11 đã đóng bởi BUILD_ID (risk-auditor + GPT-5.6, độc lập).
3. Scoring controls không được phụ thuộc cold chunk (ui-ux-critic + GPT-5.6).

---

## 8. Kế hoạch verify

**Tự động (mỗi increment):**

- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>` · `npx tsc -b --noEmit` · `npm run test`
- [ ] `npm run build` + `node scripts/check-bundle-size.mjs` (sau inc 1: in đủ 3 số CODE/CONTENT/initial-load)
- [ ] Inc 1: vitest cho parser initial-load; inc 2: vitest DuprRatingChart data thưa; inc 3: vitest boot-critical ⊆ precache-whitelist
- [ ] Inc 3: `ANALYZE=1 npm run build` → đối chiếu `dist/assets/*.js` với globPatterns; `grep -rl recharts src/` rỗng
- [ ] `npm run e2e:smoke` · post-deploy `/`, `/feed`

**Cuong phải tự làm:**

- [ ] Inc 3: xem 2 dashboard Admin/CreatorAnalytics + chart DUPR trên profile player thật (mobile)
- [ ] Inc 3: test PWA offline trên preview URL (cài PWA online → airplane mode → mở lại phải mount)
- [ ] Quyết D1 (mục 0) trước khi inc 1 đổi định nghĩa gate

---

## 9. Sau khi ship

- SHA: `a195b0a3` (squash) · PR: #389 · Ngày: 2026-07-18 (merge 2026-07-17T17:14Z)
- **Kết quả đo được (prod):** INITIAL 372,5 → **264,7 KB** gz (−29%, 6 critical-path requests, gate 280); CODE 1.576,8 → **1.469,7 KB** (gate 1800); tổng 1.929,9 → **1.822,9 KB** (backstop 1970); modulepreload 6 → 5, vendor-charts biến khỏi prod HTML (verify 2026-07-18).
- **Khác kế hoạch:**
  - Option B mở rộng: gộp luôn gate initial-load + precache-coverage của pre-mortem vào inc 1 (D1 hội tụ vòng 2).
  - Thêm 2 commit ngoài kế hoạch: package-lock clean-regen (npm ci drift sau uninstall — gotcha đã có trong memory) và coverage fix (tiny-chart cần prop `fixedWidth` để test render path, 82,04% → 83,21%).
  - Smoke CI đỏ 3 lần liên tiếp, mỗi lần MỘT test khác (skip-link focus, chunk 404 /match/confirm, SW-reload mobile) — tất cả là deploy-race/SW-update quanh deploy preview mới, pass khi rerun trên preview ổn định. Root fix Playwright deploy-race vẫn treo (backlog cũ).
  - Checkpoint PWA offline: Cuong thấy màn trắng trên điện thoại; repro Chromium có kiểm soát cho thấy cả preview LẪN prod đều mount OK offline (precache 24 entries như nhau) → chẩn đoán precache-timing (iOS standalone container cài lại SW từ đầu) / pre-existing, không phải regression. Cuong duyệt merge. **Theo dõi:** nếu user thật báo PWA offline trắng màn → điều tra riêng, không liên quan PR này.
  - release-pilot từ chối merge RED qua relay (đúng luật của nó) → merge chạy từ main session qua permission prompt của Cuong.
- Học được: đã append `.claude/memory/lessons-learned.md` (đo initial-load bằng parse dist/index.html chứ không suy từ precache; manualChunks object-form có thể kéo chunk "lazy" vào eager graph).
- Còn treo: PERF-05 — so p75 LCP/INP/CLS segment VN trước/sau bằng RUM `web_vital` sau ~1 tuần dữ liệu; Codex review post-merge (đang chạy lúc đóng sổ — finding thật sẽ thành hotfix riêng); soak 30' (đang chạy, release-pilot tự revert nếu đỏ).
