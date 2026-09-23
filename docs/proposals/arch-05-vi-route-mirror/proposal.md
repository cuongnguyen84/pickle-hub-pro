# ARCH-05 — Collapse route mirror /vi/*

> Slug: `arch-05-vi-route-mirror` · Ngày: `2026-07-17` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D2 | Vá bug ngôn ngữ Feed/Rankings + VI-NotFound **trong cùng PR** ARCH-05 hay tách follow-up? (Cả 2 agent đã hội tụ: bug THẬT, phải vá; SocialEventLive defer chờ audit socket. Chỉ còn sequencing.) | `solution-architect`: vá Feed+Rankings+VI-404 cùng PR (đã refine từ byte-identical) | `ui-ux-critic`: đồng ý nội dung; same-PR vs follow-up là quyết định của anh | Gộp: PR to hơn, khó bisect nếu regress. Tách: bug ngôn ngữ kẹt tiếng Anh sống thêm 1 chu kỳ trên 95% user VI |

Khuyến nghị của orchestrator: **vá cùng PR** (fix = bỏ flag `viSkipWrapper` trong config mới — 2 dòng, cùng cấu trúc đang refactor; tách ra là nợ vặt).

---

## 1. Ý tưởng gốc

Roadmap ARCH-05 (docs/roadmap-8.5-9.md:203): collapse ~45 (thực đếm: **63**) cặp route /vi/* mirror trong `src/App.tsx` thành wrapper route hoặc route-config array. Cụm 2/4 chuỗi "tiếp tục các tác vụ cải tiến" (2026-07-17).

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Nội bộ — mỗi route mới hiện phải thêm 2 chỗ, quên 1 = user VI 404 |
| Thành công = | Route mới khai báo 1 chỗ; 63 URL /vi giữ nguyên hành vi + SEO |
| Ràng buộc | URL byte-identical (đã index); prerender/hreflang không đụng; bundle 1970 KB |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟡 AMBER (classifier AMBER, auditor giữ AMBER) |
| **Khuyến nghị** | Option A — route-config array `MIRRORED` map 2 lần; + vá Feed/Rankings/VI-404 trong cùng cấu trúc |
| **Công sức** | 3–4 nửa ngày (gồm characterization test đi trước) |
| **Rủi ro lớn nhất** | Rơi 1 entry im lặng khi chép 63 route — bot prerender vẫn 200 nên mọi dashboard xanh, user thật ăn 404 |
| **Auto-merge** | Được sau gate, VỚI ĐIỀU KIỆN characterization test land trước refactor |

---

## 3. Đã có sẵn gì (recon)

- **192 route tổng, 63 cặp /vi thật** (roadmap ước 45 — sai 40%), **0 cặp** có slug Việt hoá khác path → collapse thuần prefix khả thi.
- Ngoại lệ phải giữ: 1 cặp component khác (`BlogPost` vs `ViBlogPost`, App.tsx:664,755); news dùng prop `language="vi"`; 6 route VI lồng `ConditionalAuth`/`RequireAuth`; 3 route **bỏ** `ViLanguageWrapper` (SocialEventLive :585, Rankings :658, Feed :661).
- Cơ chế ngôn ngữ: `getInitialLanguage()` đọc pathname chỉ lúc hard-load (`src/i18n/index.tsx:41-64`); `ViLanguageWrapper` là cơ chế DUY NHẤT flip khi SPA-nav.
- ARCH-01 (dependency) **done** PR #334. Không có route-config tiền lệ, **0 test routing**. Prerender (`functions/_middleware.ts:184`) strip /vi độc lập với React Router — đổi client routing không ảnh hưởng SSR miễn URL giữ nguyên. Không `.legacy.tsx` nào đang được route.

---

## 4. Phương án (solution-architect)

### Option A — Route-config array + double-map ⭐

Effort: 3–4 nửa ngày · Files: `src/App.tsx`, config mới (vd `src/routes/routeConfig.tsx`), test parity · Data: none

Mảng `MIRRORED` khai báo route 1 lần với metadata (`element`, `viElement?`, `viProps?`, `auth?`, `viSkipWrapper?`); render `.map()` 2 lần (EN + prefix /vi bọc `ViLanguageWrapper`). React Router v6 rank theo **specificity, không theo thứ tự nguồn** → gom vào map không đổi route nào thắng. Ca đặc biệt (ViBlogPost, `language="vi"`, auth lồng) là field trong config, không bị flatten. Giữ nguyên ranh giới `React.lazy` (không đụng chunk → PWA precache an toàn).

Được: khai báo 1 chỗ (mục tiêu ARCH-05), hành vi giữ nguyên có kiểm chứng, bundle +0 KB. Mất: App.tsx vẫn dài (config ở file riêng), 1 lần chép 63 entry (rủi ro chép sót → chặn bằng test parity). Đóng cửa: không.

### Option B — Chỉ thêm parity test chống-404 (cheap)

~1 nửa ngày. Rủi ro gần 0 nhưng không giảm double-edit — không đạt mục tiêu ARCH-05. Dùng làm **increment 1** của A chứ không dùng riêng.

### Option C — Nested /vi layout route

Bác: đổi mount semantics, dính bẫy trắng trang (`ViLanguageWrapper` chưa render `<Outlet/>`; nested Routes thiếu inner `*` → `/vi/<gõ-sai>` bỏ qua `path="*"` top-level), và không đạt khai-báo-1-chỗ. Critic đã concede ở vòng 2 sau khi xem `ViLanguageWrapper.tsx:15,29` (effect deps rỗng — mount/unmount-keyed).

### Khuyến nghị

**Option A**, tăng dần, kèm scope-fix từ D2: bỏ `viSkipWrapper` cho Feed + Rankings, thêm route `/vi/*` → wrapped NotFound. SocialEventLive giữ nguyên (defer — court-side live scoring, cần audit socket trước khi đổi mount).

### Increments

1. **Characterization test trước** (từ Option B): snapshot 192 route (path + component + props + wrapper + auth) từ App.tsx HIỆN TẠI — land như PR riêng, đứng làm lưới.
2. Config array + double-map, test parity so config vs snapshot — diff phải bằng 0 (hoặc đúng các thay đổi chủ đích: Feed/Rankings wrapper + /vi/* NotFound).
3. Smoke browser-thật (không bot UA) 3 route mẫu /vi + assert `workbox.globPatterns` mỗi pattern khớp ≥1 file (chặn sự cố 3 pre-mortem).

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

Refactor kỹ thuật nhưng chạm cơ chế chọn ngôn ngữ của 95% user VI. Sau vòng 2: config array + vá có chọn lọc = nâng cấp UX mà không đổi mount semantics.

### Vấn đề

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Flatten mất ca đặc biệt: `/vi/blog/:slug`→ViBlogPost, `/vi/news*`→`language="vi"` | Field riêng trong config (`viElement`, `viProps`) |
| 2 | Blocker | Đừng sinh `/vi/admin/*`, `/vi/creator/*` từ toàn mảng | Chỉ map subtree từ 63 entry có cờ `localized` |
| 3 | Blocker | URL phải byte-identical; `/vi` home dùng `index` route, không `<Navigate>` | Test parity so path string |
| 4 | Nên sửa | Bug thật (verify vòng 2): SPA-nav sang /vi/feed, /vi/bang-xep-hang kẹt tiếng Anh (`ViLanguageWrapper.tsx:15-29` cleanup set "en", `i18n/index.tsx:111-120` không restore) | Bỏ `viSkipWrapper` Feed + Rankings (D2 — chờ anh chốt sequencing) |
| 5 | Nên sửa | `/vi/<gõ-sai>` ra NotFound tiếng Anh | Thêm `/vi/*` → wrapped NotFound |
| 6 | Nit | `LanguageSwitcher` bỏ mất `location.hash` khi build URL đích; vẫn hiện toggle trên trang không mirror | Follow-up nhỏ |

### Panel đa model

- Claude + GPT-5.6 đồng thuận: switcher decoupled khỏi bảng route (an toàn nếu URL bất biến); giữ ranh giới React.lazy (user 4G); vá VI-404 rẻ.
- GPT-5.6 bị bác 1 điểm: cảnh báo regex `/^\/vi/` khớp nhầm `/videos` — code thật guard bằng `=== "/vi" || startsWith("/vi/")`, không phải finding. GPT đề xuất viết lại i18n core (`UrlLanguageSync`) — vượt scope, ghi backlog.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟡 AMBER

Classifier nói AMBER · Auditor giữ AMBER (không migration, revert được; không GREEN vì mirror không đồng nhất + 0 test routing + SSR decoupled che regression).

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao | Rơi entry khi chép 63 route → catch-all NotFound; bot prerender vẫn 200 → GSC/smoke/seo.spec đều xanh | User VI từ Google/FB đâm 404, dashboard xanh | Characterization test land TRƯỚC refactor (gate cứng) |
| 2 | Cao | Mất component/prop khác biệt khi flatten | URL VI đã index render bài EN; mất auth-redirect | Config field riêng + test parity so cả component/props |
| 3 | TB | Hình dạng route cha: bẫy trắng trang nested-Outlet | Trắng trang /vi/<typo> | Đã né — Option A không dùng route cha |
| 4 | TB | Refactor đổi tên chunk → `workbox.globPatterns` (vite.config.ts:104-124, keyed theo tên) khớp 0 file → PWA precache rụng im lặng | Offline/app mất trang chính | Assert mỗi globPattern khớp ≥1 file trong build |

### SLO / Perf / SEO

- SLO 1 (/feed): chỉ nếu dùng route cha (đã né). Bundle: **+0 KB** nếu giữ `lazyRetry` — không eager-import config. Route SSR: không đụng; **không cần bump `pr:v29`** (URL bất biến, middleware decoupled). Verify vẫn chạy `curl -A Googlebot` 3 URL /vi mẫu.

### Rollback

`git revert` + Pages redeploy ~5 phút. Không có phần không-revert-được → không RED.

### Phản biện độc lập (GPT-5.6)

Risk pass: mọi claim xác minh đúng trong repo, không bác cái nào; tự kiềm chế không bịa failure cho 3 route ngoại lệ — calibration tốt.

### Pre-mortem — 3 sự cố (chi tiết `round1/pre-mortem.md`)

1. **Tệ nhất:** rơi `/vi/tournament/:slug` im lặng — xác suất×độ-khó-phát-hiện cao nhất; chính "prerender decoupled" làm mù CI. 2. Mất prop `language="vi"` → hreflang mismatch, tụt hạng VI sau 3-5 tuần. 3. Đổi tên chunk → PWA precache rụng, bundle-budget mù (đo tổng, không đo tên).

Khoảng hở pipeline lộ ra: toàn bộ test routing/SEO đi cửa bot prerender; 62/63 route VI zero coverage browser thật. → Increment 1+3 chặn cả ba.

---

## 7. Tranh luận trong panel

> 2 bất đồng · 1 giải quyết bằng bằng chứng · 1 còn mở cho Cuong · ✅ Luật đối chất OK (ledger strict exit 0).

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Config array double-map hay route cha /vi? | **architect**: config array, byte-identical mount · **ui-ux-critic**: route cha = nâng cấp UX | **architect**: HOLD (`ViLanguageWrapper.tsx:31` chưa có Outlet; v6 specificity) · **critic**: CONCEDE (`ViLanguageWrapper.tsx:15,29` deps rỗng → mọi fix UX làm được trong config array) | ✅ RESOLVED_EVIDENCE | Config array thắng; fix UX ship trong cùng cấu trúc |
| D2 | Byte-identical hay vá 3 route ngoại lệ + VI-404 cùng đợt? | **architect**: byte-identical · **critic**: vá free | Cả hai REFINE hội tụ: bug THẬT (architect tự trace `i18n/index.tsx:111-120`), vá Feed+Rankings+VI-404, SocialEventLive defer chờ audit socket (critic git-blame xác nhận 3 ngoại lệ là bất nhất lịch sử, không có lý do kỹ thuật) | 🔶 OPEN_FOR_CUONG | Nội dung đã thống nhất — chỉ còn **sequencing** same-PR vs follow-up |

### Bất đồng bị giết ở vòng 2

D1 — critic concede sau khi mở `ViLanguageWrapper.tsx` thấy effect deps rỗng (route cha không mua thêm gì ngoài cosmetic, còn mang bẫy trắng trang).

### Bất đồng sống sót

D2 (một phần) — không phải về facts (cả hai đã hội tụ bằng bằng chứng độc lập: architect trace i18n, critic git-blame), chỉ còn quyết định sequencing thuộc về anh. Lưu ý trung thực: cả REFINE hai phía cùng chiều — hai Claude đồng ý nhau không phải bằng chứng mạnh; điểm neo là bug ngôn ngữ được trace bằng code cụ thể, anh có thể tự kiểm 2 phút: mở web, từ trang EN bấm link sang /vi/bang-xep-hang không reload → UI còn tiếng Anh.

### Nhượng bộ bị LOẠI

Không có.

---

## 8. Kế hoạch verify

**Tự động:**

- [ ] Increment 1: characterization test 192 route land trước, chạy trên App.tsx CŨ pass
- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>` · `npx tsc -b --noEmit`
- [ ] `npm run test` — parity test: config mới vs snapshot, diff = đúng 3 thay đổi chủ đích (nếu anh duyệt D2) hoặc 0
- [ ] `npm run build` + bundle budget (+0 KB kỳ vọng) + assert mỗi `workbox.globPatterns` khớp ≥1 file
- [ ] `npm run e2e:smoke` + smoke browser-thật (không bot UA): `/vi`, `/vi/giai-dau`, `/vi/bang-xep-hang`, `/vi/<typo>` → NotFound VI
- [ ] `curl -A "Googlebot"` 3 URL /vi mẫu → 200 + hreflang không đổi

**Cuong phải tự làm:**

- [ ] Chốt D2 (mục 0) — khuyến nghị: vá cùng PR
- [ ] Trên điện thoại thật: từ trang EN bấm sang trang VI (SPA-nav) → tiếng Việt hiện đúng; toggle EN↔VI giữ đúng trang

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được:
