# idea-recon — rankings-dupr-wpr-tabs (2026-08-06)

## Prior art

**Không phải tính năng mới hoàn toàn — 80% khung sườn đã có trên branch `feat/ppa-rankings-tab` (PR #552, chưa merge):**
- `src/pages/Rankings.tsx:181-192` — pill "PRO" nhỏ cuối cụm scope, link sang `/rankings/ppa-tour`. Đây chính là cái Cuong muốn "nâng lên thành thanh tab nổi bật" — không phải xây từ đầu, là redesign 1 khối UI có sẵn.
- `src/pages/PpaRankings.tsx` (269 dòng) — trang WPR đã sống: breadcrumb, board pills Nam/Nữ (`tl-filters` + `aria-pressed`, dòng 110-126), bảng top-25/board, khối "Việt Nam & gốc Việt", disclaimer + link về nguồn + link blog. Route đã đăng ký `src/App.tsx:174,553`, SSR đã có `functions/_middleware.ts:904` → `renderPpaRankings`.
- `src/content/ppa-rankings.ts` (110 dòng) — dữ liệu tĩnh: 25 nam + 25 nữ + 4 highlight VN/gốc Việt. Chỉ 50 dòng, KHÔNG phải 2.075.
- Search: không có ô search nào trên `/rankings` hay `/rankings/ppa-tour` hiện tại — phải xây mới, nhưng pattern tái dùng có sẵn: `src/components/search/SearchBar.tsx` (dùng ở `src/pages/Search.tsx:89-93`), debounce ở `src/hooks/useSearch.ts:1-17` (300ms) hoặc `src/hooks/social/useDebounce.ts` (bản trùng chức năng — nợ dọn có sẵn không liên quan idea này).

## Touch surface (likely)

- `src/pages/Rankings.tsx:181-192` — thay pill PRO nhỏ bằng thanh tab DUPR|WPR nổi bật
- `src/pages/PpaRankings.tsx:69-126` — thêm thanh tab đối xứng (cùng component) + ô search
- `src/content/ppa-rankings.ts` — nơi duy nhất giữ data; search cần toàn bộ ~2.075 dòng nếu client-side, hiện chỉ có 50
- `functions/_lib/render/ppa-rankings.ts` (115 dòng) — SSR twin đọc cùng file content; đổi shape data phải sửa cả 2 nơi
- `src/components/ui/tabs.tsx` — shadcn Tabs đã dùng ở `Search.tsx`, `CourtTabs.tsx`, `DoublesEliminationView.tsx` — pattern có sẵn cho "thanh tab nổi bật" (hiện Rankings dùng `tl-rank-scope`/`tl-filter` button tự chế)
- Nếu proxy server-side: 1 Pages Function mới hoặc route trong `functions/_middleware.ts`

## Data

- Không có bảng Supabase nào cho PPA/WPR — 100% file tĩnh, không RPC, không RLS.
- Nguồn: `https://www.ppatour.com/api/rankings/` — sống, HTTP 200, JSON, **502,737 bytes / gzip 68,506 bytes (~66.9 KB gz)** cho toàn bộ ~2.075 VĐV (curl vừa chạy).
- **CORS: KHÔNG có `access-control-allow-origin`** — trình duyệt chặn fetch trực tiếp từ client. Muốn gọi client-side bắt buộc qua proxy server-side (Pages Function) — không thể "gọi thẳng từ client".
- Trang HTML `ppatour.com/rankings/` (270 KB) chỉ chứa top board inline RSC — không phải nguồn full list.

## Binding constraints found

- `docs/proposals/ppa-rankings-tab/proposal.md:52-58` — verdict RED cho scrape/mirror tự động full board (ToS); email xin phép đã gửi, **chưa hồi âm**. Mọi phương án load full ~2.075 VĐV (kể cả proxy runtime, không lưu) vẫn có thể là "rebroadcast" theo ToS — panel vòng trước không phân biệt "lưu" vs "proxy realtime".
- Quyết định đã chốt: giữ `/rankings` mặc định DUPR Việt Nam; `/rankings/ppa-tour` là route riêng editorial top-25.
- Intake: Cuong đã CHỌN "PHẢI tìm được cả ~2.075 VĐV" dù đã được cảnh báo — điểm panel phải giải.
- `functions/_middleware.ts:582` — cache key thực tế **`pr:v34`** (proposal ghi v33, CLAUDE.md từng ghi v32 — đã sửa trong PR #552). Đổi SSR → bump **v35**.
- `docs/perf-budgets.md:34,45` — Total gz backstop 1970 KB, CI-enforced, ratchet-down only.
- `check-bundle-size` vừa chạy: **INITIAL 225.3/280 · CODE 1516.7/1800 · Total 1900.6/1970 — còn 69.4 KB headroom.** Full 2.075 dòng JSON tĩnh gz ~66.9 KB ăn gần hết headroom (chưa tính code search) — sát biên nguy hiểm.

## Test coverage today

- `tests/seo.spec.ts:135-142` — hreflang triplet cho cả 2 route; không kiểm tab/search.
- 0 test cho `Rankings.tsx` / `PpaRankings.tsx`.
- Gap: 0 coverage cho UI tab, search input, CORS/proxy nếu build.

## Bilingual surface

Toàn bộ text 2 trang đã bilingual inline (ternary `vi ?`); mọi label mới (nhãn tab, placeholder search, "không tìm thấy VĐV") theo cùng pattern. Number format đã dùng `Intl.NumberFormat("vi-VN")`.

## Native /apple

Không ảnh hưởng trực tiếp — native chỉ có scope Vietnam (deferred có chủ đích). Có sẵn `apple/.../TLSegmented.swift` nếu sau này port tab.

## Unknowns worth asking

1. Full ~2.075: proxy runtime qua Pages Function (không lưu DB) có được coi là "không mirror" hay vẫn RED theo ToS? Chưa ai trả lời.
2. Search full 502 KB JSON mỗi request hay chỉ trong 50 dòng có sẵn (UX nói dối: "không tìm thấy" dù VĐV tồn tại ở nguồn)?
3. Thanh tab: shadcn `Tabs` hay style `tl-*` tự chế — ảnh hưởng số dòng đổi cả 2 trang.
