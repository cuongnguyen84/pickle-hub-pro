# ui-ux-critic — ppa-rankings-tab (2026-08-06)

External model: GPT-5.6 (`gpt-5.6-terra`), prompt + reply nguyên văn tại `../external/ui-ux-gpt56-prompt.md` / `../external/ui-ux-gpt56-reply.md`.

## Đánh giá tổng thể

**Ý tưởng "thêm bảng PPA Tour" là tốt. Ý tưởng "cho nó làm tab mặc định của /rankings" là sai, và sai theo cách tự phá hoại.** Bảng Việt Nam hôm nay đúng là yếu — đo trên prod: **12 người ở Đôi, 4 người ở Đơn**, phần lớn không có thành phố. Nhưng thứ đang bơm người vào bảng đó chính là CTA nằm dưới đuôi bảng (`Rankings.tsx:495` — "→ Kết nối DUPR để có tên trong bảng này"). Đẩy bảng VN xuống sau một cú chạm tab = gỡ luôn cửa vào của cái phễu đang nuôi nó. Bảng 12 người sẽ mãi là 12 người.

Thứ hai, điều recon chưa bắt được: **ppatour.com/rankings không có 5-6 format**. Fetch trực tiếp hôm nay — nó là **một bảng tổng hợp World Pickleball Ranking (WPR), đúng 2 board: Nam và Nữ**, cột chỉ có `#` / tên / điểm, sâu 1.324 người phân trang 50/lần, có bộ lọc khu vực (**Asia** nằm trong đó). Toàn bộ phần "5-6 format × top 50-100" trong intake đang thiết kế cho dữ liệu không tồn tại.

## Luồng người dùng

**Thực tế deep-link.** `/rankings` hầu như không phải điểm đến tự nhiên — nó là link nav (`TheLineLayout.tsx:83`, trỏ `/rankings` không query param) và URL sitemap (`sitemap-static.xml.ts:81-82`, priority 0.9). Nghĩa là:

- **Vào từ nav trong app** → paramless → nhận default mới → thấy Ben Johns.
- **Vào từ Google** → kết quả đã index có title `Bảng xếp hạng DUPR Pickleball Việt Nam` (`functions/_lib/render/rankings.ts:28`), canonical không mang query (`rankings.ts:110`) → click vào thấy bảng pro Mỹ. Title hứa một đằng, trang trả một nẻo.
- **Vào từ link người dùng tự share** → thực ra **an toàn**: `useUrlBackedState` mirror giá trị đã resolve vào URL bằng `history.replace` khi mount (`useUrlBackedState.ts:33-46`), link copy luôn mang `?scope=vietnam`. (Điểm không đồng ý với GPT-5.6 — xem mục Panel.)

**Task courtside 60 giây.** Người đứng ở sân mở /rankings để xem mình/bạn mình đứng đâu. PPA Tour phục vụ task khác hẳn: giải trí/tra cứu pro. Hai ý định khác nhau, không phải hai tab của cùng một câu hỏi.

**Exit.** Bảng VN có exit đi tiếp: mỗi hàng link `/nguoi-choi/:username` (internal link thật, nguồn duy nhất trong ItemList JSON-LD `rankings.ts:88-94`). Bảng PPA **không có exit** — 50 tên không click đi đâu được, trừ khi trỏ ra ppatour.com.

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | Đặt PPA làm default gỡ mất cửa vào phễu kết nối DUPR. CTA (`Rankings.tsx:495`) chỉ render trong nhánh `isVietnamScope`; 100% khách lần đầu không còn thấy nó. Bảng 12 người đứng yên vĩnh viễn. | Giữ `fallback: "vietnam"` ở `Rankings.tsx:44`. Sửa "bảng trông trống" bằng copy trung thực + phễu, không bằng cách giấu bảng. |
| 2 | **Blocker** | Tab **không bao giờ** làm được SEO landing. Cache key `pr:vN:${pathname}` không chứa query string; `renderRankings` không đọc `?scope=` — hardcode RPC Vietnam (`rankings.ts:38-41`). `?scope=ppa` trả đúng HTML bot của bảng VN. Scrape 1.324 người rồi giấu sau query param bot không thấy = 0 giá trị SEO. | PPA phải là **route riêng**: `/rankings/ppa-tour` + `/vi/rankings/ppa-tour`, `renderPpaRankings` riêng, title/canonical/JSON-LD riêng, thêm vào `sitemap-static.xml.ts`. Claude và GPT-5.6 độc lập cùng kết luận. |
| 3 | **Blocker** | Nếu vẫn đổi default: bot đã index `/rankings` với title "Bảng xếp hạng DUPR Pickleball Việt Nam" + ItemList 25 VĐV Việt. Người click từ SERP thấy bảng pro Mỹ. Title/content mismatch trên trang canonical. | Không đổi. `/rankings` giữ nghĩa "DUPR Việt Nam". PPA đi route riêng. |
| 4 | **Blocker (nếu vẫn nhét vào tab)** | Category error tầng H1. Toàn bộ chrome nói DUPR: `TheLineLayout title="Bảng xếp hạng DUPR"` (`Rankings.tsx:97`), kicker `◆ DUPR` (:112), H1 "…tính theo DUPR." (:118), intro giải thích DUPR (:129). Scope PPA trong đó có H1 nói DUPR còn bảng hiển thị điểm WPR. | Route riêng có H1 riêng. |
| 5 | **Blocker (thiết kế trên dữ liệu không tồn tại)** | Intake giả định 6 format. Nguồn chỉ có **2 board Nam/Nữ**, chỉ số WPR tổng hợp (Đôi 50% + Mixed 35% + Đơn 15%). | Format row PPA = 2 pill `[Nam] [Nữ]`. Thay 4 format ma bằng **bộ lọc khu vực** — nguồn có sẵn `Asia`. |
| 6 | Nên sửa | Hierarchy 390px: ~470-530px tiêu trước hàng xếp hạng đầu tiên (breadcrumb + kicker + H1 + intro + khối scope 6-7 dòng + format row). Thêm pill thứ 9 đẩy bảng khỏi màn hình đầu. | `≤640px`: gộp TOÀN CẦU + CHÂU LỤC thành một rail cuộn ngang (`overflow-x:auto; nowrap; scroll-snap`), rút intro còn 1 dòng. |
| 7 | Nên sửa | Touch target pill ~26-28px (`the-line.css:3160`). Đạt WCAG 2.2 AA (24px) nhưng dưới chuẩn nhà 44px; 9 mục cạnh nhau, một tay, ngoài sân. | `min-height:44px; inline-flex; align-items:center` cho `.tl-rank-scope`/`.tl-filter` ở ≤640px. |
| 8 | Nên sửa | 4.1.2 — pill là `<button>` với trạng thái chọn **chỉ trong CSS class** `active` (`Rankings.tsx:144,159,173,196`). Screen reader không biết cái nào đang chọn. Lỗi AA **đang tồn tại**. | `aria-pressed={scope === s.key}` + bọc row bằng `role="group" aria-label`. KHÔNG chuyển sang fieldset/radio như GPT-5.6 đề xuất (xem Panel). |
| 9 | Nên sửa | Định dạng số: nguồn trả `12,212.5` — người Việt đọc thành "mười hai phẩy...". | `Intl.NumberFormat("vi-VN"/"en-GB", {maximumFractionDigits:1})` → `12.212,5`. `.tl-rank-table` đã có `tnum`. |
| 10 | Nên sửa (CLS) | Loading là empty-card 1 dòng rồi swap sang bảng 50-100 hàng × 48px = shift vài nghìn px. CLS p75 mobile đang ~0.67. | Skeleton N hàng đúng chiều cao, panel head render sẵn từ hằng số. |
| 11 | Nên sửa | Bảng 100 hàng không điểm dừng. | SSR + render 50 hàng, nút `Tải thêm 50 VĐV` full-width, `aria-live="polite"`, skip-link. Đồng thuận GPT-5.6. |
| 12 | Nên sửa | Error state "Vui lòng tải lại trang." — trong Capacitor shell **không có nút reload**. | Nút `Thử lại` gọi `refetch()`. Áp cho cả bảng VN. |
| 13 | Nên sửa | Supabase REST là `NetworkOnly` (`vite.config.ts:213-214`) — mất sóng = tab mặc định error. WPR đổi theo tuần, không cần NetworkOnly. | `StaleWhileRevalidate` riêng endpoint rankings (7 ngày) + dòng "Ngoại tuyến · dữ liệu ngày X". |
| 14 | Nên sửa | Lệch web ↔ native: `RankingsRepository.swift` chỉ có scope vietnam. Web đổi default, native mở bảng VN = hai sản phẩm nói hai chuyện. | Thêm lý do KHÔNG đổi default. Route PPA riêng thì native "chưa có" là thiếu feature, không phải mâu thuẫn. |
| 15 | Nit | `labelVi: "Mở rộng"` cho DUPR "Open" (`dupr-rankings.ts:4330`) là dịch máy sai. | Đổi `"Hạng mở"`. |
| 16 | Nit | Header cột `"Vận động viên"` cho bảng 12 người phong trào nghe hành chính. | Bảng VN: `Người chơi`. Bảng PPA: `VĐV`. |
| 17 | Nit | Badge `◐` là span có `aria-label` không role (`Rankings.tsx:458-477`) — nhiều screen reader bỏ qua. | `role="img"` hoặc sr-only text. |
| 18 | Nit | `.tl-filters` khai cả `flex-wrap:wrap` lẫn `overflow-x:auto` (`the-line.css:2234-2240`) — wrap thắng, overflow là code chết. | Chọn một. |

## Phương án thay thế (khuyến nghị ship)

1. **`/rankings` giữ default `vietnam`.** Panel head trung thực: `Việt Nam · Đôi · 12 VĐV đã kết nối DUPR`; nâng CTA kết nối DUPR lên **trên** bảng khi số hàng < 20.
2. **Route mới `/rankings/ppa-tour` + `/vi/rankings/ppa-tour`**, SSR riêng, sitemap riêng, hreflang cặp. Đây mới là SEO landing thật.
3. **Hook cho người Việt = bộ lọc khu vực `Châu Á`** (nguồn có sẵn). Top 50 nam có Jonathan Truong #21, HT Hien Truong #38, Luc Pham #42, Hong Kit Wong #20; nữ có Alix Truong #14, Chao Yi Wang #12. Một dòng `Người gốc Việt trên bảng WPR` đáng giá hơn 1.324 hàng.
4. **Từ `/rankings` trỏ sang PPA bằng một link, không phải tab**: `→ Xem bảng xếp hạng pro thế giới (PPA Tour WPR)`.

## Trạng thái màn hình

**Bảng PPA (route mới)**
- Loading: skeleton 10 hàng 48px, panel head render sẵn `PPA Tour · Nam · Top 50`. VI `Đang tải bảng xếp hạng PPA Tour…`
- Empty: VI `Chưa có dữ liệu cho bộ lọc này.` + hint `Thử bỏ bộ lọc khu vực.`
- Error: VI `Không tải được bảng xếp hạng PPA Tour.` + nút `Thử lại`
- Stale (>10 ngày): VI `Dữ liệu chưa được cập nhật từ {ngày}.`
- Offline: SWR cache + banner `Ngoại tuyến · dữ liệu ngày {ngày}`.

**Bảng VN (giữ default):** loading đổi sang skeleton 12 hàng; error → nút `Thử lại`.

## Accessibility (WCAG 2.1 AA)

- **4.1.2 FAIL (đang tồn tại):** trạng thái chọn pill chỉ trong CSS. Sửa: `aria-pressed` + `role="group"`.
- **Target size FAIL chuẩn nhà:** ~26-28px → 44px.
- **1.3.1:** thiếu `<caption>` — bắt buộc khi 2 bảng cùng route: `<caption class="sr-only">`.
- **2.4.1:** thêm skip link `Bỏ qua bảng xếp hạng`.
- **4.1.3:** `aria-live="polite"` + `aria-busy` khi Tải thêm.
- **2.4.7 FAIL:** `.tl-rank-scope` không có `:focus-visible` (`the-line.css:3149-3158`). Thêm `outline: 2px solid var(--tl-green)`.
- **Contrast:** pill `.active` đảo nền (`background: var(--tl-fg)`) — pattern từng fail AA ở `.tl-filter .count` (`the-line.css:2255-2266`, 3.69:1). Nếu thêm badge/count vào pill phải dùng lại `color-mix` trick.
- **Bàn phím PASS:** giữ button + `aria-pressed`, KHÔNG cần roving tabindex.

## Copy đề xuất (VI/EN)

```
title    VI: Bảng xếp hạng PPA Tour (WPR)     EN: PPA Tour Rankings (WPR)
kicker   VI: ◆ PPA TOUR · WPR · Cập nhật {ngày}
H1       VI: Ai đang đứng đầu / thế giới nhà nghề.   EN: Who leads / the pro tour.
intro    VI: World Pickleball Ranking (WPR) là bảng tổng hợp của PPA Tour:
             đôi 50%, đôi nam nữ 35%, đơn 15%, tính trên điểm 52 tuần gần nhất.
board pills  VI: Nam · Nữ    region pills VI: Tất cả · Châu Á · Mỹ · Châu Âu · Úc · Canada · Khác
cột      VI: # · VĐV · Điểm WPR
load more VI: Tải thêm 50 VĐV      live region VI: Đang hiển thị {n} VĐV.
Attribution VI: Điểm WPR do PPA Tour công bố tại ppatour.com/rankings, ThePickleHub thu thập lại
             và hiển thị theo định dạng số tiếng Việt. ThePickleHub không phải kênh chính thức
             hay đối tác của PPA Tour. Xem bảng đầy đủ (1.324 VĐV) tại trang gốc.
/rankings: panel head khi rows<20: VI: Việt Nam · Đôi · 12 VĐV đã kết nối DUPR
link sang PPA: VI: → Xem bảng xếp hạng pro thế giới (PPA Tour WPR)
DUPR "Open": VI "Hạng mở" (thay "Mở rộng"); cột bảng VN: "Người chơi"
```

Độ dài pill: chuỗi PPA dài nhất VI `Khác` (4 ký tự) — an toàn ở 390px.

## Panel đa model

Gọi trực tiếp OpenAI Responses API (`gpt-5.6-terra`, reasoning high → hết token, chạy lại medium, hoàn tất). **Lưu ý quy trình: `scripts/agents/ask-model.mjs` mà workflow tham chiếu KHÔNG tồn tại trong repo** (khớp memory "/idea thiếu debate-ledger.mjs + risk-tier.mjs" — thực tế risk-tier.mjs có, ask-model.mjs không).

**Đồng thuận Claude + GPT-5.6 (hai vendor độc lập — tín hiệu thật):**
1. **DO NOT SHIP AS PROPOSED.** PPA không được làm default. Cách sửa bảng VN yếu là làm nó đầy hơn + trung thực hơn, không phải thay nó.
2. **PPA phải là route riêng**, không phải scope thứ 9. GPT: "nguồn khác, đơn vị đo khác"; Claude: cache key pathname-only. Hai lý do khác nhau, cùng kết luận — đủ mạnh để chốt.
3. 2 board Nam/Nữ, 3 cột, top 50 + tải thêm 50.
4. Số định dạng VI `12.212,5`.
5. 44px, caption, skip link, aria-live, trạng thái chọn đọc được bằng screen reader.

**Bất đồng 1 — ngữ nghĩa bộ chọn.** GPT-5.6: fieldset/legend + radio chips. Claude: giữ button + `aria-pressed`. **Chọn Claude**: (a) aria-pressed đủ đạt 4.1.2 AA; (b) radio kéo theo roving tabindex — thêm việc a11y; (c) repo dùng button-pill khắp nơi, đổi riêng Rankings tạo 2 pattern.

**Bất đồng 2 — bookmark vỡ.** GPT-5.6: bookmark/share vỡ khi đổi default. Claude: không — `useUrlBackedState` mirror `?scope=vietnam` vào URL khi mount, link share luôn mang param. Cái vỡ thật là 3 đường paramless: nav (`TheLineLayout.tsx:83`), sitemap, canonical/SERP. Vẫn Blocker nhưng vì lý do khác — quan trọng khi ai đó định "vá" bằng cách xử lý bookmark.

**GPT-5.6 bắt được mà Claude sót:** kiểm ToS/rate limit/quyền tái xuất bản dữ liệu PPA trước khi ship scraper — có hệ quả UX: nếu chỉ được mirror giới hạn thì "top 50 + link về nguồn" là thiết kế đúng, không phải 1.324 hàng.

**Claude bắt được (cần repo):** phễu CTA DUPR trong nhánh `isVietnamScope`, cache key loại query string, H1 hardcode DUPR, NetworkOnly, native chỉ có vietnam, thiếu `:focus-visible`, tiền lệ contrast pill đảo nền.

## Verdict tổng

**DO NOT SHIP AS PROPOSED — 5 blocker.**

Ship được ngay, không blocker: PPA Tour là **route riêng** `/rankings/ppa-tour` (+`/vi/`), 2 board Nam/Nữ, 3 cột, top 50 + tải thêm, bộ lọc khu vực với **Châu Á** làm điểm nhấn, số định dạng VI, một link từ `/rankings` trỏ sang. `/rankings` giữ default `vietnam`, panel head trung thực, nâng CTA kết nối DUPR khi bảng còn ít người.

Nếu Cuong vẫn muốn PPA làm mặc định, blocker #1 (phễu DUPR) phải được trả lời trước: *bảng Việt Nam đi từ 12 người lên 200 người bằng đường nào, nếu không phải bằng cái CTA đó?*
