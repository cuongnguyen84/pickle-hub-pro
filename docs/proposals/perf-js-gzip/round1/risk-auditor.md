# Rủi ro — perf-js-gzip (risk auditor, 2026-07-17)

## Verdict per LOẠI việc (không có tier chung)
| Loại việc | Tier | Lý do 1 câu |
|---|---|---|
| **Config chunking** (`manualChunks`, `vite.config.ts`) | 🔴 RED | Classifier floor RED cho `vite.config.ts`; đổi tên/tách một vendor chunk trong whitelist precache → PWA offline kẹt "Loading…". |
| **Lazy sâu hơn** (`React.lazy`, `src/App.tsx`) | 🟡 AMBER | Thêm boundary = thêm cơ hội chunk-404 sau deploy → reload chớp + mất state form; online tự lành, offline tệ hơn. |
| **Dep swap** (recharts → lib nhẹ) | 🟡 AMBER | Chart trắng/sai số trên mobile (ResponsiveContainer + numeric-string semantics); revert được bằng git. |
| **Xoá dead code** | 🟢 GREEN | Cách duy nhất thực sự giảm tổng aggregate; chỉ hỏng nếu module bị "chết oan" (registry string-key / side-effect). |

**Classifier said:** `vite.config.ts` = RED ("build/runtime config — PWA precache, chunking, native shell"), `src/App.tsx` = AMBER.
Em **giữ** config chunking ở RED (không hạ), REFINE phạm vi: cơ chế thực sự nguy hiểm chỉ là **precache-whitelist drift**, không phải class outage 2026-07-11 (đã đóng — xem dưới).

**Kết quả xấu nhất hiện thực:** một PR chunking đổi tên `vendor-react` (hoặc emit một boot-critical chunk không khớp glob nào ở `vite.config.ts:104-124`) → user đã cài PWA, mở **offline**, entry static-import chunk react không có trong cache → React không mount, kẹt "Loading…", không có ChunkErrorBoundary vì lỗi xảy ra TRƯỚC khi app mount.

---

## Rủi ro cụ thể
| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | Cao (offline) / Thấp (online) | Đổi tên/tách vendor chunk trong `manualChunks` (`vite.config.ts:293-322`) → tên emit không còn khớp whitelist `globPatterns` (`vite.config.ts:104-124`). Fix react-dom subpath BƠM thêm module VÀO `vendor-react` (giữ tên) thì AN TOÀN; chỉ đổi TÊN/tách mới hỏng. | PWA đã cài, launch offline: shell + "Loading…" vĩnh viễn, React không mount. Online user: bình thường (CDN trả chunk). | Sau `ANALYZE=1 npm run build`, đối chiếu `dist/assets/*.js` với `globPatterns`; nếu emit chunk boot-critical tên mới → thêm glob TRONG CÙNG commit. Test trên preview URL PWA offline. |
| 2 | Trung bình | Thêm `lazy()` boundary → thêm URL chunk nhúng trong entry/route đang mở. Deploy đổi hash → tab cũ navigate tới chunk đã xoá → 404 thật (`_middleware.ts:339`). `lazyRetry` (`App.tsx:36-44`) retry CÙNG URL sau 1.5s → vẫn 404 → ChunkErrorBoundary xoá cache + unregister SW + reload. | Online: spinner → khựng 1.5s → **cả app reload**, mất state form/scroll/modal đang mở. Offline: có thể tệ hơn — xoá cache xong không mở lại được tới khi có mạng. | KHÔNG lazy Index (`App.tsx:24` eager — giữ nguyên) hay global recovery UI. Test tab-prod-cũ vs deploy-mới, không chỉ preview sạch. Rủi ro biên, không phải class mới (95% route đã lazy sẵn). |
| 3 | Trung bình | Swap recharts. Lib mới không giữ ResponsiveContainer (mount trong tab ẩn / width 0 / mobile hẹp) → SVG/canvas 0px. Hoặc semantics khác: Supabase trả numeric STRING/`null` → `NaN`, sort rankings theo chữ, tooltip sai. | `/nguoi-choi/<slug>` (public, mobile): DUPR rating chart trắng / trục không có bar / số sai. Admin+creator analytics: quyết định trên số sai. | Visual test mobile-width cho 3 site (dưới) + case: tab ẩn, data rỗng, 1 điểm, null, numeric-string. Xác nhận recharts BIẾN MẤT khỏi `dist` (không ship cả 2 lib). |
| 4 | Thấp | Xoá module thực ra được nạp qua registry string-key hoặc side-effect-only import (đăng ký locale/handler). tsc/build KHÔNG bắt được import động bằng string. | Route deep-link → 404/trắng, hoặc trang load nhưng mất hành vi khởi tạo — chỉ lộ khi user kích hoạt feature hiếm. | Trước khi xoá: grep tên file/module trong toàn repo kể cả string literal; kiểm tra `import.meta.glob` và side-effect import. Không kết luận "dead" chỉ vì không có import trực tiếp. |

---

## SLO bị đe doạ
- **SLO 1** (availability `/` + `/feed` trả 200 + shell): CHỈ config chunking đe doạ, và chỉ với PWA offline hoặc nếu boundary chunk hỏng runtime. Online được CDN + fix Tier1/Tier2 (2026-07-11) bảo vệ.
- **SLO 6** (Vietnam p75 LCP/INP/CLS): đây là MỤC TIÊU của task, nhưng lazy ẩu có thể thêm network waterfall vào path `/` eager → LCP/INP xấu đi. Đừng đẩy dependency mà Index cần render tức thì ra sau `import()`.
- **KHÔNG đụng:** SLO 2 (auth), 3 (registration), 4 (scoring), 5 (cron), 7 (push) — đây thuần frontend build, không chạm edge function / DB / migration / RLS / verify_jwt.

---

## Ngân sách hiệu năng
- **Giai đoạn report: +0 KB.** Rủi ro nằm ở từng việc /ship, không ở báo cáo.
- Splitting/chunking **không giảm** tổng aggregate (`check-bundle-size.mjs` cộng dồn TẤT CẢ `dist/**/*.js`) — còn thêm chút wrapper overhead, có thể đẩy tổng LÊN gần gate 1970. Hiện 1930.4 / 1970 = ~40 KB headroom.
- Dep swap partial (ship CẢ recharts + lib mới) = worst case breach 1970 → CI đỏ (bắt trước merge, không phải rủi ro prod).
- Giảm tổng THẬT chỉ từ: **xoá code** (dead-code, GREEN) hoặc **cắt dependency** (recharts).
- **Vietnam p75:** lazy sâu hơn có thể giúp initial load NẾU không thêm waterfall chặn; dep swap giảm ~108 KB gz nếu recharts biến hẳn khỏi dist. Đo `web_vital` RUM VN trước/sau, đừng tin GA4 global (bot).

---

## SEO
- **Routes SSR bị ảnh hưởng: NONE.** Đã verify: `functions/_middleware.ts` → `routeAndRender()` (dòng 469-664) dựng HTML string từ query Supabase, **không bao giờ nạp `/assets/*.js`**. Bundle/chunking đổi ⇒ output SSR bot KHÔNG đổi. SEO miễn nhiễm hoàn toàn với 4 loại việc này.
- **Cần bump `pr:v30`? KHÔNG.** Cache key đã là `pr:v30` (`_middleware.ts:399`); SSR output không đổi nên không cần bump.
- Verify (nếu muốn chắc, không bắt buộc): `curl -A "Googlebot" https://www.thepicklehub.net/nguoi-choi/<slug>` → vẫn 200 + title + og:image + hreflang, không phụ thuộc bundle.

---

## Class outage 2026-07-11 — ĐÃ ĐÓNG (điểm quan trọng nhất, sửa lại memory recon)
Recon lo "root fix build-token CHƯA làm" — **SAI/stale**. Cả 2 tầng fix ĐÃ có trong source hiện tại:
- **Tier 1** (`vite.config.ts:19,285`): `BUILD_ID = Date.now().toString(36)` + `entryFileNames: assets/[name]-[hash]-${BUILD_ID}.js` → tên entry độc nhất mỗi deploy, không cache immutable nào phục vụ được entry lệch.
- **Tier 2** (`_middleware.ts:335-346`): asset thiếu → 404 no-store thay vì SPA HTML bị pin "HTML-as-JS" 1 năm.

⇒ Chunking change **không thể tái tạo** class outage cũ (same-entry-URL/different-content) trừ khi ai đó GỠ hoặc phá `BUILD_ID`. GPT-5.6 xác nhận độc lập cùng kết luận. Rủi ro chunking còn lại KHÁC class: precache-whitelist drift (offline) — rủi ro #1 ở trên, không phải cùng cơ chế.

---

## Kế hoạch rollback
- **Cơ chế:** cả 4 loại đều `git revert` + redeploy Cloudflare Pages. KHÔNG migration, KHÔNG native build (native load remote URL, web deploy tới ngay — nhưng cũng revert ngay), KHÔNG sent push, KHÔNG deployed Worker riêng.
- **Thời gian khôi phục:** ~2-3 phút (Cloudflare Pages auto-deploy từ main) hoặc tức thì qua Pages rollback API (deploy trước có entry tên khác — an toàn hơn cache nhiễm).
- **Không revert được:** KHÔNG có. Đây là điểm cho phép autonomy cao hơn — nhưng RED của config chunking đứng vì (a) classifier floor, (b) offline-launch không có ChunkErrorBoundary để tự lành, (c) sản phẩm vừa dính outage chunking 6 ngày trước → cần Cuong duyệt + test preview.

---

## Phải verify trước khi merge (mỗi việc /ship)
- [ ] Config chunking: `ANALYZE=1 npm run build` rồi `ls dist/assets` — MỌI chunk boot-critical phải khớp một glob ở `vite.config.ts:104-124`. Nếu không → thêm glob CÙNG commit.
- [ ] Config chunking: test PWA **offline launch** trên preview URL (cài PWA online → tắt mạng → mở lại → phải mount, không kẹt "Loading…").
- [ ] Lazy sâu: test **tab prod cũ vs deploy mới** (navigate tới route mới-lazy sau khi deploy) — xác nhận ChunkErrorBoundary reload sạch, không loop.
- [ ] Dep swap: visual test mobile-width cho `DuprRatingChart.tsx` (public), `AdminAnalytics.tsx`, `CreatorAnalytics.tsx` — kèm data rỗng / 1 điểm / null / numeric-string; xác nhận `recharts` KHÔNG còn trong `dist`.
- [ ] Xoá dead code: `grep -rn "<module-name>" src/` kể cả string literal + kiểm side-effect import trước khi xoá.
- [ ] Mọi việc: `BUNDLE_STRICT=1 node scripts/check-bundle-size.mjs` phải xanh (< 1970), Playwright smoke preview xanh.

---

## Phản biện độc lập (GPT-5.6, gpt-5.6-sol, 106s)
Panel chạy đủ 2 model (OPENAI_API_KEY có). Prompt: `external/risk-auditor-prompt.md`; reply: `external/risk-auditor-gpt56-reply.md`.

**Đã xác minh trong repo (survived checking):**
- SW precache whitelist khớp TÊN file, không phải module → đổi tên vendor chunk là hỏng, bơm module vào chunk cùng tên là an toàn. **Đúng** (`vite.config.ts:104-124`).
- Class outage 2026-07-11 đã đóng bởi BUILD_ID + Tier2. **Đúng, độc lập trùng kết luận của em.**
- `lazyRetry` retry CÙNG URL nên không cứu được chunk đã xoá thật; chỉ ChunkErrorBoundary reload mới lành, kèm mất state. **Đúng** (`App.tsx:36-44`).
- Numeric-string/null semantics khi swap chart → NaN/sort sai. Hợp lý, cần test.

**Bác bỏ / chỉnh:**
- GPT nói regression chart ở **"/rankings table"**. **SAI** — `/rankings` (leaderboard) KHÔNG dùng recharts. recharts chỉ ở 3 file: `DuprRatingChart.tsx` (public, trên `/nguoi-choi/<slug>`), `AdminAnalytics.tsx`, `CreatorAnalytics.tsx`. Surface public hẹp hơn GPT tưởng (rating-history chart, không phải bảng xếp hạng).
- GPT không biết fix react-dom-subpath cụ thể là BƠM vào `vendor-react` sẵn có (giữ tên) → mặc định an toàn với SW; em đã tách rõ "fix cụ thể an toàn" vs "rename/tách mới nguy hiểm".
