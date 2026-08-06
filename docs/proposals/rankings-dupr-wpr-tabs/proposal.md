# Tab DUPR | WPR trên /rankings + search theo tên VĐV

> Slug: `rankings-dupr-wpr-tabs` · Ngày: `2026-08-06` · Trạng thái: `approved`
> **✅ Cuong quyết 2026-08-06:** "cứ làm theo hướng panel khuyến nghị" — O1 = Option A (không override RED, không full-search cho tới khi có thư PPA). PR #552 vẫn chờ anh review UI → build STACK trên branch `feat/ppa-rankings-tab` (đường dự phòng increment 0 của architect), base PR = branch đó; #552 merge xong thì retarget về main.
> Sinh bởi `/idea`. Panel: `solution-architect` · `ui-ux-critic` (+GPT-5.6-terra) · `risk-auditor` (+GPT-5.6) · `pre-mortem`.
> Model thiếu key: `none`. `debate-ledger.mjs` vẫn không tồn tại — cưỡng chế thủ công (ghi trong `debate.json`).
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*` (gồm nguyên văn ToS pickleball.com đã fetch) · `debate.json`
>
> Phụ thuộc: **PR #552 phải merge trước** (đang chờ anh review UI). Feature này build trên trang WPR của #552.

---

## 0. 🔶 Cần anh quyết

Vòng 2 hội tụ gần hết — chỉ còn MỘT quyết định thật:

| # | Vấn đề | Panel nói | Nếu anh override |
|---|--------|-----------|------------------|
| **O1** | **Yêu cầu "tìm được cả ~2.075 VĐV" của anh KHÔNG có kiến trúc hợp lệ nào trước khi có thư cho phép.** Vòng 2 đã thử cả đường "chỉ index tên + link về nguồn" (không đăng điểm) — risk-auditor tự fetch ToS pickleball.com và phát hiện nó **cấm nguyên văn** cung cấp "any portion of data… to any competitor or other provider of pickleball-related services" → tự nâng đường đó lên RED (nhượng bộ đi lên, không phải xuống). | Ship **Option A**: search trung thực trong 92 dòng (top-25×2 + khối VN 42 dòng), no-match dẫn thẳng sang ppatour.com/rankings — nơi architect đã verify **có sẵn ô search full 2.075 kèm rank+points**. Đếm GA4 no-match + click-out; 2 tuần sau có số thật → nếu nhu cầu lớn, đó là nội dung email nhắc lần 2 gửi PPA. Có thư → nâng full trong 1,5 nửa ngày (khung đã chừa sẵn). | Anh chấp nhận RED có ý thức (anh chịu trách nhiệm pháp lý): chọn **(a′)** projection tĩnh có rank+points (26,5 KB, lazy chunk) — KHÔNG chọn (e) index-tên (đắt hơn, cho ít hơn, mở thêm bề mặt pickleball.com). Giá: đúng hành vi ToS cấm, takedown/IP-block không revert được, đốt khung "trích dẫn biên tập". |

---

## 1. Ý tưởng gốc + làm rõ

> anh muốn khi người dùng vào /rankings, chia thành 2 tab chính là DUPR và WPR. Bấm vào DUPR thì ra UI như cũ, WPR thì ra bảng mới xử lý. Cũng cần làm WPR giống như trên trang gốc, đó là tìm theo tên VDV được

Làm rõ: (1) tab = điều hướng giữa 2 pathname `/rankings` ↔ `/rankings/ppa-tour` (đã chốt); (2) anh chọn "phải tìm được cả 2.075" — xem O1; (3) không đổi default, yêu cầu là 2 tab **nổi bật rõ ràng** (không phải pill nhỏ như PR #552).

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟡 **AMBER** cho gói khuyến nghị (tab 🟢 + khối VN 42 dòng 🟡 với 5 điều kiện + search 92 dòng 🟢) · 🔴 RED nếu override O1 |
| **Khuyến nghị** | Option A + spec UI của ui-ux + 3 guard của pre-mortem + 5 điều kiện của risk |
| **Công sức** | ~2,5-3 nửa ngày (sau khi #552 merge) + PR font riêng ~0,5 |
| **Rủi ro lớn nhất** | Search nói dối về VĐV Việt (pre-mortem P0) — bị giết bằng 1 test bắt buộc: `search("Trương")` phải trả Hien Truong |
| **Auto-merge** | Được sau gate nếu đi đúng gói khuyến nghị; override O1 → chặn |

---

## 3. Recon + dữ kiện quyết định (vòng 2 tự đo, không tin recon)

- 80% khung có sẵn trên PR #552. Search chưa tồn tại; pattern debounce/searchbar có nhưng **không tái dùng được** (useSearch không fold dấu; SearchBar hard-code dark mode).
- Nguồn `/api/rankings/`: 2.075 VĐV, 66,6 KB gz; **không CORS**; **không nhận query param** (mọi `?q=` trả nguyên 502 KB); có **39 VĐV cờ vn** (hiện trang mình chỉ có 4).
- ppatour.com/rankings **có ô search full tại chỗ** — đích handoff tốt; `/search/?q=` là bẫy (trả "No results" cho tên Việt).
- Bundle: Total 1900,6/1970 — còn 69,4 KB. Slim data 26,5-29,2 KB gz — **perf không phải rào; ToS là rào duy nhất.**
- **ToS pickleball.com** (fetch 2026-08-06, lưu `external/`): cấm cung cấp "any portion of data" cho "any competitor or other provider of pickleball-related services"; cấm automated extraction; ppatour.com là affiliated site cùng nhóm pháp nhân.
- KV cache thực tế `pr:v34`; TTL 6h (không "vĩnh viễn"); tab+search client-only → **không cần bump** trừ khi sửa 2 file render.

---

## 4. Gói khuyến nghị (đã hội tụ sau vòng 2)

### 4a. Thanh tab [DUPR | WPR] — 🟢 GREEN, không ai chặn

- `<nav aria-label="Loại bảng xếp hạng">` chứa 2 `<Link>`, tab hiện hành `aria-current="page"` — **không** role=tablist/aria-selected (điều hướng, không phải toggle). Component mới `src/components/rankings/RankingsTabs.tsx` (~45 dòng), gắn đối xứng cả 2 trang, **dưới header, trên mọi bộ lọc**.
- Nhãn 2 dòng (blocker #2 ui-ux): `DUPR / RATING CÁ NHÂN` · `WPR / NHÀ NGHỀ PPA TOUR` (EN: PLAYER RATING / PPA TOUR PROS). Cao 52px, focus-visible, active = khối đen (control DUY NHẤT được dùng nền đen).
- **Đi kèm 3 phép trừ bắt buộc** (blocker #1 — màn hình /rankings hiện 0 dòng dữ liệu trước khi cuộn ở 390px): xoá cụm PRO pill của #552 (−60px); intro 4 dòng → 1 dòng (−95px); gộp 3 hàng scope thành 1 rail cuộn ngang (−150px). Kết quả đo: dòng 01 từ y≈775 lên y≈530 — thấy 4-5 dòng.
- Kèm sửa nhỏ cùng vùng: chip scope 44px ở CSS (xoá vá inline #552), aria-pressed cho scope pills, ChatFAB ẩn trên `/rankings*` (1 dòng HIDDEN_PREFIXES — FAB đang che cột điểm), breadcrumb trang B bỏ segment cuối.

### 4b. Khối "Việt Nam & gốc Việt" 4 → 42 dòng — 🟡 AMBER với 5 điều kiện của risk

39 VĐV cờ vn + 3 gốc Việt cờ khác. Đây là phần trả lời thật cho ý định tìm kiếm của khán giả Việt (35 VĐV Việt đang vô hình, kể cả hạng 564; SEO đuôi dài "… pickleball ranking" là cụm có cửa thắng).

**5 điều kiện ship (thiếu 1 hoặc 4 → RED):** (1) TUYỆT ĐỐI không copy headshot/ảnh (photography là tài sản ToS liệt đích danh); (2) credit + link nguồn, không xoá proprietary notice; (3) `PPA_WPR_FETCHED_AT` + quy tắc chọn in NGAY CẠNH khối, VI/EN ("mọi VĐV mang cờ VN trên bảng WPR, tính đến <ngày>"); (4) hằng số **VIẾT TAY** — cấm commit script `filter(country==='vn')` (provenance quyết định tính chất editorial); (5) không cron/auto-refresh + mốc refresh trong `docs/milestones.md`.

**UI (ui-ux, không ai phản đối):** mặc định 8 dòng hạng cao nhất + `<details>` native "Xem tất cả 42 VĐV Việt / gốc Việt" — 0 JS, SSR vẫn phát đủ 42 tên cho bot; không đổ 1.700px vào trang.

### 4c. Search — 🟢 cơ chế, spec chốt

- Hàm thuần `filterWpr(query, rows)`: **lọc tức thì** (architect đã concede — useSearch không dùng được vì không fold dấu), soi **UNION** `[...MEN, ...WOMEN, ...VIET_HIGHLIGHTS]` (không phải board đang chọn), fold NFD (pattern slug.ts:19) để "nguyen"/"Trương" đều khớp, thẻ NAM/NỮ trên từng dòng kết quả, giữ **rank gốc**.
- **1 test bắt buộc, fail hôm nay nên nó sống:** `search("Trương")` → Hien Truong. + case: khớp giữa chuỗi, rỗng trả nguyên bảng.
- Trung thực TRƯỚC khi gõ: label `TÌM VĐV`, placeholder "Tìm trong top 25 + VĐV Việt", **helper thường trực** (kể cả khi có kết quả): "Chỉ tìm trong {n} VĐV ThePickleHub trích dẫn. Bảng đầy đủ hơn 2.000 VĐV — tra trên trang gốc ↗" ({n} từ dữ liệu, không hard-code). No-match: "Không có {q} trong phần trích dẫn — tay vợt này có thể có mặt trên bảng đầy đủ → Xem trên PPA Tour ↗" (link **/rankings/** của nguồn — có ô search full tại chỗ; cấm /search?q=).
- IME Telex: chặn render empty state + aria-live khi composing (3 dòng). `role="status"` đếm kết quả trễ ~400ms. Input dùng `.tl-search-input` có sẵn (CSS chết, đúng token, 16px) — sửa `outline:0` thành `:focus-within` ring (lỗi 2.4.7 đang tồn tại). Sticky top 59px + scroll-margin; Enter blur đóng bàn phím; không đụng BottomNav.
- GA4: event `wpr_search_no_result` (idle 800ms/blur, chỉ độ dài chuỗi) + click-out — 2 tuần sau đọc segment VN (có thể phải kéo 4 tuần vì mẫu nhỏ — đặt mốc milestones).
- 3 guard pre-mortem: union+fold+test (trên) · **hai empty state khác chữ** nếu sau này có tầng full · cảnh báo headroom <5% trong `check-bundle-size.mjs` (3 dòng).

### 4d. PR font riêng (không đi chung — tránh scope laundering)

Bug thật toàn site: `index.html` để `font-display:optional` cho **4 dòng** subset vietnamese (geist, geist-mono, inter — ui-ux tìm ra 2, architect tìm nốt 2) → trên 4G glyph Việt rơi fallback giữa từ ("nhà nghê" — anh đã thấy trên preview #552). Fix: optional→swap + preload geist-vietnamese (~8 KB). PR riêng 1 file, đo LCP/CLS trước-sau.

### Increments

0. Merge #552 → branch `feat/rankings-wpr-tabs` từ main. (Nếu #552 kẹt: stack branch, base PR = branch cũ. Cấm push thẳng vào #552.)
1. Tab bar + 3 phép trừ + sửa nhỏ cùng vùng (4a) — verify: bundle delta ≤2 KB, curl Googlebot 2 route (không bump KV nếu không sửa render; nếu sửa chữ link trong render → bump v35 + sửa CLAUDE.md), e2e smoke.
2. Khối VN 42 dòng viết tay + `<details>` + 5 điều kiện (4b) — verify: curl đếm ≥40 tên trong body EN+VI, `?nocache=1` ×4 URL.
3. Search + test "Trương" + GA4 (4c) — verify: vitest xanh, a11y tay (44px, focus, aria-live), thử Telex trên máy thật.
4. PR font riêng (4d).
5. 🛑 **Đọc số sau 2-4 tuần** → quyết có gửi email nhắc PPA lần 2 không. Chỉ khi có thư: nâng full search — dữ liệu vào **lazy route chunk** (architect đã concede: không public asset — gate mù + offline chết), 1,5 nửa ngày.

---

## 5-6. UI/UX + Rủi ro (chi tiết trong round1/, đây là phần đã chốt)

- Toàn bộ copy VI/EN + spec trạng thái màn hình + a11y: `round1/ui-ux-critic.md` (đồng thuận cross-vendor với GPT-5.6 ở 10 điểm — nav/aria-current, xoá pill PRO, rail ngang, tab 2 dòng, instant filter, union search, rank gốc, status trễ, FAB, không full-2075-in-bundle).
- Rủi ro đầy đủ + tier từng đường kiến trúc + 5 phép thử T1-T5 "bao nhiêu là hết editorial" (chốt cho mọi lần sau): `round1/risk-auditor.md` + `round2/risk-auditor.json`.
- 3 postmortem: `round1/pre-mortem.md` — P0 là search nói dối về Hien Truong; ảnh chụp màn hình Facebook không revert được.
- **Anh cần biết (N3):** `news-fetcher` cron 2h đang là automated extraction theo L41 ToS (dù excludePrefixes cố ý né /rankings + /athletes). Email gửi legal@ppatour.com nên soạn với chú thích này — đừng viết "chúng tôi chưa bao giờ tự động lấy dữ liệu".

## 7. Ledger

| ID | Kết quả | Trạng thái |
|----|---------|-----------|
| D1 (phủ 2.075 bằng gì) | risk **CONCEDE đi lên** (ToS pickleball.com — bằng chứng nguồn sơ cấp, hợp lệ, NÂNG (e)→RED) · architect HOLD chứng thực · ui-ux hybrid moot theo điều kiện của chính nó | RESOLVED → **O1** (vì nghịch yêu cầu gốc của anh) |
| D1.a (debounce) | architect CONCEDE (useSearch không fold NFD) | RESOLVED: tức thì |
| D1.b (bundle vs public asset) | architect CONCEDE (gate mù + offline) | RESOLVED: lazy chunk |
| D2 (42 dòng) | risk tier **AMBER + 5 điều kiện** · architect REFINE tương thích · ui-ux thêm spec collapsed | RESOLVED |
| N1 (font PR riêng) | không mâu thuẫn thực chất | SYNTHESIS: PR riêng, 4 dòng |
| N2 ((a′) vs (e) nếu override) | chỉ sống nếu anh override RED | OPEN_FOR_CUONG (điều kiện) |

Nhượng bộ bị loại: **không có** — cả 2 CONCEDE của architect và 1 của risk đều kèm bằng chứng file:line / nguồn sơ cấp. Ghi nhận: risk CONCEDE **ngược chiều có lợi cho mình** (nâng tier thay vì giữ) — đúng tinh thần "muốn bị bác bằng số".

## 8. Verify (gói khuyến nghị)

- [ ] eslint · tsc -b · vitest (gồm test "Trương") · build + check-bundle-size (delta ≤2 KB, thêm cảnh báo headroom) · e2e smoke · curl Googlebot 2 route ×2 ngôn ngữ đếm ≥40 tên
- [ ] `git diff --stat functions/_lib/render/` — rỗng thì không bump; có thì v35 + CLAUDE.md
- [ ] Cấm `git add -A` (3 migration untracked đang nằm trong working tree)
- [ ] Cuong: test Telex trên điện thoại thật ("Trương", "nguyeenx"); nhìn tab bar 390px; quyết O1

## 9. Sau khi ship

- SHA: · PR: · Khác kế hoạch:
- Học được: mọi "unknown worth asking" trong recon không đóng bằng test/guard = sự cố đã lên lịch; human-path.spec chỉ crawl từ home — route mới cần entry riêng; không có chỗ đăng ký giám sát cho Pages Function /api/*.
