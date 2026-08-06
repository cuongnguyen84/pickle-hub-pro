# solution-architect — rankings-dupr-wpr-tabs (2026-08-06)

## Tóm tắt kiến trúc

Thanh tab DUPR|WPR là **2 thẻ `<Link>` trong một `<nav>`**, không phải shadcn `Tabs` — tab ở đây là điều hướng giữa 2 pathname nên phải có `href` (crawl được, cmd+click được, back native). Phần khó không nằm ở tab mà ở search: em đã tự đo lại hôm nay và **giới hạn bundle KHÔNG phải lý do chặn full 2.075** — lý do chặn duy nhất là ToS, y như vòng trước. Đổi lại, em tìm ra một đường thứ ba mà recon bỏ sót: nguồn có **39 VĐV cờ `vn`** trên bảng đầy đủ (29 nam + 10 nữ), trong khi trang mình chỉ có 4 — với khán giả 95% Việt, mở rộng khối "Việt Nam & gốc Việt" từ 4 → 42 dòng phủ gần trọn ý định tìm kiếm thật với chi phí pháp lý gần bằng 0.

### Số đo tự chạy (đính chính recon)

| Hình dạng dữ liệu | raw | gz | brotli |
|---|---:|---:|---:|
| Full JSON nguyên bản (2.075) | 502.7 KB | **66.7 KB** | — |
| Slim `[rank,name,points,countryCode]` (2.075) | 71.7 KB | **25.9 KB** | **21.9 KB** |
| Chỉ tên (2.075) | 29.2 KB | 14.5 KB | — |
| Khối VN mở rộng 42 dòng trong `.ts` | ~4 KB | ~1.5 KB | — |

Đính chính load-bearing:
1. **`scripts/check-bundle-size.mjs:53` chỉ thu file `.js` trong `dist/`.** File `public/data/*.json` → không vào INITIAL/CODE/CONTENT/backstop. Con số recon "66.9 vs 69.4 headroom" so hai thứ không cùng thước đo. Nói thẳng: đây là kẽ hở thước đo, không phải giấy phép tiêu xài — chỉ tôn trọng tinh thần budget khi asset fetch lúc user focus ô search, không phải first paint.
2. `vite.config.ts:122-130` globPatterns → `/data/*.json` không vào PWA precache.
3. Slim index 25.9 KB gz → **perf không còn là lý do nói không. Chỉ còn ToS.**

### Sự thật kỹ thuật về ToS (verdict thuộc risk-auditor)

- CORS: curl lại hôm nay — không có `access-control-allow-origin` → không tồn tại đường "trình duyệt user tự lấy, mình không đụng". Mọi kiến trúc full-2.075 đều bắt buộc hạ tầng mình sao chép rồi tái phát tán. Proxy runtime KHÔNG nhẹ tội hơn file tĩnh — ToS cấm "scrape, **mirror, or rebroadcast**"; proxy đúng nghĩa đen là rebroadcast.
- Thang mức sao chép: full JSON > slim tuple > chỉ tên — nhưng điều khoản cấm hành vi, không chỉ biểu đạt → tự nó không gỡ rào.
- **Dữ kiện mới panel vòng trước không có:** `workers/news-fetcher/src/index.ts:483-491` đã có `html_scrape` cho `ppa-tour`, cron 2h, ship 2 ngày trước (`b533f571`). Repo ĐÃ scrape ppatour.com. Nêu trung tính: headline + link khác chất với republish bảng 2.075 dòng — nhưng cuộc tranh luận là về MỨC ĐỘ, không phải "lần đầu vượt lằn ranh". Risk-auditor nên hoà giải hai thứ.

---

## Option A — Tab bar + khối VN đầy đủ (42 dòng) + search đúng phạm vi

**Effort: 2,5 nửa ngày** · Files: `src/components/rankings/RankingsTabs.tsx` (mới ~45 dòng) · `Rankings.tsx` (xoá pill PRO :181-192, chèn tab) · `PpaRankings.tsx` (tab + search) · `src/content/ppa-rankings.ts` (highlights 4→42) · 2 SSR renderer (chỉnh chữ link) · `the-line.css` (~15 dòng `.tl-tabs`) · 1 test hàm lọc · **Data: none**

- **Tab:** `<nav className="tl-tabs">` 2 `<Link>`, tab đang mở mang `aria-current="page"` (điều hướng, không phải toggle → không dùng aria-pressed). Đặt **ngay dưới `tl-page-head`, trên mọi bộ lọc** cả 2 trang. Logic: tab = đổi thước đo, scope/board = lọc trong thước đo. `min-height:44px`, `:focus-visible` (vá luôn 2.4.7 đang tồn tại). Nhãn VI: `DUPR · Việt Nam` / `PPA Tour · WPR`.
- **Deep-link/back:** không state — 2 URL thật, back/forward/refresh/bookmark chạy bằng trình duyệt. `?board=`/`?q=` do useUrlBackedState giữ trong từng trang.
- **Khối VN 42 dòng:** 39 cờ vn + 3 gốc Việt cờ khác (dedupe Hien Truong). 42/2075 = 2% bảng — vẫn trích dẫn biên tập, khung credit hiện có phủ nguyên.
- **Search:** tái dùng `SearchBar.tsx` + debounce `useSearch.ts` (300ms) — 0 dependency, ~1 KB gz. Lọc client trên tập đang có (25+25+42). Chuẩn hoá NFD bỏ dấu (pattern `src/lib/social/slug.ts:19`) để "nguyen" khớp "Nguyễn". Placeholder nói đúng phạm vi: "Tìm trong bảng trích dẫn (top 25 + VĐV Việt)". No-match KHÔNG nói dối: "Không có "X" trong phần trích dẫn. Bảng đầy đủ 2.075 VĐV ở trang gốc → ppatour.com/rankings ↗".
- **SSR:** search client-only có chủ đích (`?q=` không bao giờ tới routeAndRender). Bot thấy 25+25+42 dòng. Link 2 chiều ĐÃ tồn tại → **không cần bump v34→v35**: chỉ `?nocache=1` cho 4 URL. Bump version nuốt sạch KV toàn site, không đáng cho 2 trang.
- **GA4 no-match counter:** log mỗi lần không khớp (chỉ độ dài chuỗi + board, không gửi nội dung) → 2 tuần sau có số thật trả lời "có đáng xin phép PPA không".

**Được:** tên Việt gõ vào THỰC SỰ tìm thấy — 35 VĐV Việt đang vô hình sẽ hiện ra; bot thấy 42 tên Việt → đuôi dài "Hien Truong pickleball ranking" là cụm có cửa thắng. Đo được nhu cầu. 0 bề mặt ops mới.
**Mất:** vẫn không phải "toàn bộ 2.075". User tìm VĐV Mỹ hạng 300 bị đẩy ra ngoài.
**Đóng cửa:** không. `getSearchIndex()` là nguồn duy nhất — lên B sau này là thay 1 hàm.

## Option B — Full 2.075 qua slim index tĩnh /public *(BỊ ToS CHẶN, không bị perf chặn)*

**Effort: 4 nửa ngày tổng (= A + 1,5)** · A + `scripts/gen-wpr-index.mjs` + `public/data/wpr-index.json` (25,9 KB gz) + `src/lib/wpr-index.ts` · Data: none

Script chạy TAY (không cron — cron = "tự động scrape" = RED vòng trước) → slim tuple → public asset. Client fetch lúc user focus search → 0 KB first paint, không vào budget CI, không precache. `public/_headers` thêm rule `/data/*` max-age ≤1h (cảnh báo: rule rộng từng nuốt /sw.js 29 ngày). UI hiện "số liệu lấy ngày X".

**Biến thể B′ — proxy Pages Function: BÁC.** Cùng phơi nhiễm ToS (proxy = rebroadcast nguyên văn), thêm phụ thuộc bên thứ ba trên critical path route công khai; fallback duy nhất là lưu last-good = mirror. Thêm bề mặt ngoài ops_job_registry. Nhiều code hơn, kém tin cậy hơn, pháp lý y hệt.

**Được:** đúng nguyên văn yêu cầu. **Mất:** 502 KB dữ liệu PPA trong git công khai — không revert sạch khỏi lịch sử, bằng chứng đóng khung nếu takedown; cập nhật tay, quên là mục. **Đóng cửa:** lập luận "chỉ trích dẫn biên tập" — dùng rồi không rút lại được.

## Option C — Chỉ tab, không search *(bản rẻ)*

**Effort: 1 nửa ngày.** Tab thay pill PRO + 1 dòng CTA "Tìm VĐV trong bảng đầy đủ → ppatour.com ↗".
**Được:** rẻ nhất, rủi ro 0. **Mất:** bỏ yêu cầu intake điểm 2, không thu được dữ liệu gì để quyết bước sau.

## Khuyến nghị

**Option A.** B thua không vì perf (đã phá lập luận đó — 25,9 KB, asset không bị CI đo) mà vì là cùng hành động panel trước gọi RED, chỉ khác hình dạng file; mở khoá duy nhất là thư từ legal@ppatour.com. C thua vì bỏ lỡ thứ duy nhất tuần này học được: A đắt hơn C 1,5 nửa ngày, trả về 35 VĐV Việt hiện ra + bộ đếm no-match — nếu 2 tuần sau "200 lượt tìm hụt/tuần" thì đó là nội dung email lần 2 gửi PPA, và B lúc đó chỉ còn 1,5 nửa ngày.

Nói thẳng phần không làm theo anh: anh chốt "PHẢI tìm được cả 2.075" — A không làm được, không phải vì kỹ thuật khó (đã đo xong, dễ) mà vì chưa có gì cho phép làm hợp lệ, và 42/2075 dòng đúng chỗ đáng giá hơn 2075 dòng sai chỗ.

## Increments

0. **Merge PR #552 trước, nhánh mới `feat/rankings-wpr-tabs` từ main.** Tab bar XOÁ khối #552 vừa thêm + sửa file chỉ tồn tại trên nhánh đó — nhánh riêng từ main sẽ conflict và không compile. Nếu #552 không merge trong tuần: stack `git checkout -b feat/rankings-wpr-tabs feat/ppa-rankings-tab`, base PR = nhánh cũ. Đừng push thẳng vào #552.
1. RankingsTabs + gắn 2 trang + xoá pill + CSS. Verify: bundle delta ≤2 KB; curl Googlebot 2 route ?nocache=1 — body có link 2 chiều, hreflang đủ; e2e:smoke.
2. Khối VN 4→42 (SSR tự có vì đọc cùng file). Verify: curl đếm ≥40 tên trong body EN+VI + ?nocache=1 ×2.
3. Search + copy + no-match handoff + 1 unit test (khớp không dấu, giữa chuỗi, rỗng trả nguyên bảng). Verify: test xanh; 44px + focus-visible + aria-live.
4. **🛑 DỪNG-VÀ-NHÌN 2 tuần.** GA4: lượt search, tỉ lệ no-match, click ra ppatour. (a) không ai gõ → dừng; (b) khớp hết trong 42 dòng → xong; (c) no-match cao → dữ liệu gửi email PPA lần 2, có thư mới làm bước 5.
5. *(chỉ khi có văn bản cho phép)* gen-wpr-index + public asset + đổi getSearchIndex(). 1,5 nửa ngày.

## Điều không chắc

- Anh có coi "search chỉ tìm 92 dòng" là lời hứa gãy không — khớp yếu nhất của A, câu của ui-ux-critic. Nếu mọi ô search ngầm hứa "toàn bộ" thì lập luận A đổ, C mới đúng.
- Handoff không deep-link tới đúng VĐV được (đoán /athletes/<slug> sẽ 404 lai rai) → về ppatour.com/rankings; CHƯA kiểm trang đó có ô search riêng không — không có thì handoff kém hơn vẽ.
- GA4 no-match: nhiễu bot + mẫu nhỏ trên route ngách — có thể phải kéo 4 tuần, nên đặt mốc docs/milestones.md thay vì trông chờ nhớ.
- /api/rankings/ không phải hợp đồng ổn định (Next.js internal, x-vercel-cache: STALE) — với A không sao (chép tay 1 lần), với B là rủi ro gãy câm chưa có guard.
- Đuôi bảng gần như rác (nam #1324 = 0,45 điểm; 118 người <1 điểm) — nếu làm B nên cắt ~10 điểm (1.069 dòng), nhưng không chắc anh coi đó là "toàn bộ" theo ý anh.

**File đã đọc:** check-bundle-size.mjs · vite.config.ts · PpaRankings.tsx · Rankings.tsx · ppa-rankings.ts · render/ppa-rankings.ts · render/rankings.ts · _middleware.ts · public/_headers · public/_routes.json · workers/news-fetcher/src/index.ts · docs/perf-budgets.md · proposal ppa-rankings-tab
