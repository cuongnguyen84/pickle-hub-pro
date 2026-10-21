# ui-ux-critic — rankings-dupr-wpr-tabs (2026-08-06)

External: `gpt-5.6-terra` reasoning high, prompt + reply tại `../external/ui-ux-gpt56-prompt.md` / `ui-ux-gpt56-reply.md`.

## Đánh giá tổng thể

**CONDITIONAL GO.** Hai ý tưởng đúng hướng — pill `PPA Tour ↗` hiện tại nằm chỗ chết, search là kỳ vọng hợp lý. Nhưng cả hai **cộng chiều cao vào màn hình đã hỏng**: đo trên ảnh thật (390×853), dòng xếp hạng đầu tiên của /rankings VI ở **y≈775px** trong khi vùng nhìn kết thúc ở y≈765px (header sticky 59 + BottomNav 88). User ở sân **không thấy một cái tên nào** trước khi cuộn. Duyệt tab mà không trừ đi thứ khác = ship trang tệ hơn.

Điều kiện GO: tab đi kèm 3 phép trừ (#1), search nói thật về phạm vi TRƯỚC khi gõ, sửa lỗi font tiếng Việt vỡ trên H1.

## Vấn đề (tóm bảng — chi tiết đầy đủ trong transcript panel)

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Tab 52px cộng vào trang 0 dòng dữ liệu trong màn đầu | 3 phép trừ cùng commit: (a) xoá cụm PRO pill (−60px); (b) intro 4 dòng → 1 dòng (−95px); (c) gộp 3 hàng scope thành 1 rail cuộn ngang (−150px). Kết quả: dòng 01 lên y≈530, thấy 4-5 dòng |
| 2 | Blocker | Nhãn DUPR/WPR trần trụi — WPR không ai biết, DUPR = "điểm của tôi" → lẫn | Tab 2 dòng: viết tắt Geist 15px/600 + caption Mono 10px. VI: `DUPR / RATING CÁ NHÂN` · `WPR / NHÀ NGHỀ PPA TOUR`. Cao 52px |
| 3 | Blocker | Search hứa nhiều hơn dữ liệu (50 dòng vs 2.075) — "Không tìm thấy" là nói dối | Nói thật TRƯỚC khi gõ: placeholder ghi phạm vi + helper cố định dưới input (LUÔN hiện kể cả có kết quả) kèm link nguồn — người ra 1 kết quả không liên quan không bao giờ thấy empty state |
| 4 | Blocker | Search chỉ trong board đang chọn = nói dối lần 2 (đang tab Nam gõ Anna Leigh Waters → 0) | Query khác rỗng → tìm CẢ 2 bảng + khối VN, gắn thẻ NAM/NỮ từng dòng; panel head đổi thành KẾT QUẢ TÌM KIẾM |
| 5 | Blocker | Input không có focus indicator: the-line.css:2175 chỉ phủ a/button; :3888 còn `outline:0` trên .tl-search-input input:focus — 2.4.7 fail | Sửa CSS: bỏ outline:0, ring lên container `:focus-within` |
| 6 | Blocker (PR #552) | **Font VN vỡ giữa từ trên H1**: index.html:56 `font-display:optional` cho geist-vietnamese.woff2 nhưng :57 `swap` cho latin — trên 4G subset Việt bỏ qua vĩnh viễn → U+1EA0-1EF9 rơi fallback giữa từ ("nhà nghê") | Đổi optional→swap cho 2 file vietnamese woff2 (index.html:56,58) + preload geist-vietnamese.woff2 (:84). 8 KB cho 95% user đọc đúng tiếng mẹ đẻ |
| 7 | Nên sửa | 3 tầng điều khiển cùng là pill đen active → không phân biệt đổi-trang vs lọc | Tầng 1 tab: khối liền 2 cột full-width, DUY NHẤT được dùng nền đen. Tầng 2 chip: active = weight 600 + gạch chân 2px (không chỉ màu — 1.4.1). Tầng 3 segmented dính viền panel |
| 8 | Nên sửa | FAB Messenger/Zalo đè cột điểm dòng 02-03 | 1 dòng: thêm "/rankings" + "/vi/rankings" vào HIDDEN_PREFIXES (ChatFAB.tsx:33, cơ chế có sẵn; startsWith phủ luôn ppa-tour) |
| 9 | Nên sửa | Chip scope ~28px mobile; PpaRankings đã vá inline minHeight:44, Rankings chưa | Vá ở CSS `@media ≤640px`: `.tl-rank-scope,.tl-filter{min-height:44px}` rồi XOÁ vá inline PpaRankings.tsx:119 |
| 10 | Nên sửa | Rankings.tsx:141-178 — 8 nút scope không aria-pressed/role=group | Bọc role="group" + aria-pressed |
| 11 | Nên sửa | Gõ Telex: chuỗi trung gian không khớp → empty state nhấp nháy | Lọc tức thì nhưng chặn render empty + aria-live khi `isComposing` (onCompositionStart/End, 3 dòng) |
| 12 | Nit | Chip "Úc / Châu Đại Dương" ~150px chiếm 40% rail | Rút labelVi = "Châu Đại Dương" |
| 13 | Nit | SearchBar.tsx KHÔNG tái dùng được (hard-code dark mode, vô hình trên nền giấy sáng; clear button ~20px không aria-label) | Dùng `.tl-search-input` (the-line.css:3878) — CSS chết có sẵn, đúng token, 16px chặn iOS zoom |
| 14 | Nit | Breadcrumb trang B trùng tab active | Bỏ segment cuối trang B; GIỮ breadcrumb trang A |

## Trạng thái màn hình

- Search excerpt (static import): **không loading, không error** — thêm spinner là kịch. Empty dùng `.tl-empty-card` với copy nói thật (dưới). Offline: search VẪN chạy (excerpt trong bundle) — lý do kỹ thuật giữ excerpt trong bundle.
- Nếu sau này full qua proxy: skeleton 5 dòng chỉ ở khối "kết quả bổ sung", excerpt hiện ngay; lỗi không đánh sập search ("Chưa tải được bảng đầy đủ — đang tìm trong {n} VĐV trích dẫn"); **giữ rank gốc, không đánh số lại**.

## A11y chốt

- Tab = `<nav aria-label="Loại bảng xếp hạng">` + `aria-current="page"` — KHÔNG role=tablist (đổi pathname, không đổi panel), KHÔNG aria-selected.
- Input: label hiện hữu `TÌM VĐV` + aria-describedby helper; `type="search" enterKeyHint="search" autoCapitalize=off autoCorrect=off spellCheck=false`.
- `role="status" aria-live="polite" aria-atomic` cho dòng đếm — lọc tức thì, THÔNG BÁO trễ ~400ms; không lặp khi số không đổi.
- Clear button aria-label + hit ≥44px (pseudo inset).
- Contrast caption tab active: tái dùng `color-mix(in oklab, var(--tl-bg) 60%, var(--tl-fg))` (the-line.css:2266, 6.12:1).
- Mobile keyboard: form onSubmit → blur (Enter đóng bàn phím); search block `position:sticky; top:59px`; `scroll-margin-top:72px`; KHÔNG đụng BottomNav; input đã 16px. Chưa xác minh WebView Android (capacitor không config Keyboard plugin) — test tay 1 máy.

## Copy chốt (VI/EN)

```
Tab: DUPR / RATING CÁ NHÂN · WPR / NHÀ NGHỀ PPA TOUR (EN: PLAYER RATING · PPA TOUR PROS)
nav aria-label: "Loại bảng xếp hạng" / "Ranking type"
Intro DUPR 1 dòng: "DUPR là chuẩn rating pickleball toàn cầu, cập nhật theo kết quả giải đấu."
Intro WPR 1 dòng: "WPR xếp hạng VĐV nhà nghề PPA Tour theo điểm 52 tuần gần nhất."
Label search: TÌM VĐV / FIND A PLAYER
Placeholder: "Tìm trong top 25 Nam + Nữ" / "Search the top 25 men + women"
Helper (LUÔN hiện): "Chỉ tìm trong {n} VĐV ThePickleHub trích dẫn. Bảng WPR đầy đủ có hơn
  2.000 VĐV — tra trên trang gốc ↗"  ({n} từ độ dài dữ liệu, KHÔNG hard-code)
Đếm: "{n} kết quả cho "{q}"" / empty: "◌ Không có "{q}" trong phần trích dẫn — Tay vợt này
  có thể đang có mặt trên bảng WPR đầy đủ (hơn 2.000 người) — ThePickleHub chỉ đăng top 25
  mỗi bảng. → Xem bảng WPR đầy đủ trên PPA Tour ↗"
Panel head khi có query: KẾT QUẢ TÌM KIẾM / SEARCH RESULTS · thẻ dòng: NAM/NỮ
Thuật ngữ: VĐV ở nhãn/cột, "tay vợt" trong văn xuôi; không dùng BXH ở nhãn tab.
```

## Panel đa model

**Đồng thuận Claude + GPT-5.6 (độc lập, tín hiệu thật):** nav+aria-current không tablist; xoá cụm PRO pill; gộp rail + rút intro; tab 2 dòng viết-tắt+diễn-giải; lọc tức thì không debounce cho 50 dòng; search quét CẢ 2 bảng; giữ rank gốc; label+describedby; status trễ; FAB đè bảng phải xử; không nhét full 2.075 vào bundle.

**Bất đồng (6, đã chốt):** (1) vị trí tab dưới H1 — THEO GPT (H1 là LCP); (2) kiểu chữ tab — KHÔNG theo (mono 10px cho nội dung chính trái design-tokens); (3) breadcrumb — theo nửa (bỏ segment cuối trang B, giữ trang A); (4) segmented 32px — HOLD (hit area ≥44 qua pseudo; panel-head 390px đã wrap 3 dòng); (5) ẩn BottomNav theo keyboard — HOLD (z-9999 toàn site, visualViewport phập phù; đạt bằng CSS thuần); (6) loại khối VN khỏi search — NGƯỢC LẠI: đưa vào, đó là 4 tên xác suất bị tìm cao nhất; {n} đếm từ dữ liệu.

**GPT sót, Claude bổ sung:** link nguồn thường trực (không chỉ empty state); lỗi font VN (không đọc được index.html); `.tl-search-input` CSS chết tái dùng; IME composing chặn empty state.

## File liên quan

Rankings.tsx (:181-192, :135-193, :141-178) · PpaRankings.tsx (:110-126, :119) · the-line.css (:2175, :3115-3161, :3878-3889) · index.html (:56-58, :84) · ChatFAB.tsx (:33) · SearchBar.tsx (không tái dùng)
