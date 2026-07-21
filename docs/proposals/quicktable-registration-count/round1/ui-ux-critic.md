# UI/UX Critic — round 1 (Claude + GPT-5.6)

## Tổng thể
Ý tưởng đúng hướng — số đăng ký thật > quota tĩnh. Nhưng giá trị nằm ở **làm đúng dữ liệu**, không ở badge: card hiện show `player_count` = **quota lúc tạo** (`useTournamentData.ts:89`), thêm số thứ hai cạnh nó là bẫy nhầm lẫn. Lỗ hổng repo cả intake lẫn GPT bỏ sót: QuickTable mở đăng ký đang gắn pill **"CHUẨN BỊ" (gold)** không phải "Đang mở đăng ký" (enum `quick_table_status` KHÔNG có `registration`, `types.ts:8655`) — chỗ dựa "dưới ngưỡng để pill lo" của cả hai model đều SAI với code.

## Vấn đề (phân loại)
| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | **Blocker** | Hai số cạnh nhau: quota `16 người chơi` + `14 đã đăng ký` = không ai hiểu | Row đủ điều kiện: **THAY** token quota trong `renderMeta` bằng count thật. KHÔNG hiện cả hai. Row khác giữ quota |
| 2 | **Blocker** | Chỉ gắn nhãn `đã đăng ký` cho bracket `requires_registration=true`. Ad-hoc/đang chơi/đã xong = sai dữ liệu | Gate cứng: chỉ render khi `requires_registration===true && status==='setup'` (đúng def `useOpenRegistrationTables` `:105-106`) |
| 3 | **Blocker** | Doubles đếm **đội** (`quick_table_teams`), singles đếm **người** (`quick_table_registrations`) — KHÔNG trộn | Đếm theo `is_doubles`: doubles→`quick_table_teams`, singles→`quick_table_registrations`, loại `status='cancelled'`. Copy đổi theo unit |
| 4 | **Blocker** | N+1: 1 COUNT/card trên 4G (anti-pattern `useUpcomingSocialEvents.ts:53-62`). Async sau render → badge nhảy → phá CLS ≤0.1 | Batch: 1 query `table_id IN (...)` cho cả trang, hoặc RPC trả count kèm payload. Count có SẴN lúc render → không loading riêng, không CLS |
| 5 | **Blocker** (a11y, CI bắt) | Màu badge ≥4.5:1. Axe color-contrast vừa bật (#426) fail build nếu màu yếu | Dùng `--tl-fg-2 (#c7c3bb)` weight 600 (đã pass), hoặc `--tl-green #b5e853`. Tránh `--tl-blue` (trùng semantic pill) |
| 6 | **Nên sửa** (repo finding) | `quick_table_status` KHÔNG có `registration` (`types.ts:8655`). Mở đăng ký = `setup` → pill **"CHUẨN BỊ" gold** đọc như "chưa mở" | Khi `requires_registration && status==='setup'`, override pill → blue "Đang mở đăng ký". Không sửa thì badge cạnh pill "chưa sẵn sàng" = mâu thuẫn |
| 7 | **Nên sửa** | Ngưỡng chống phản-social-proof | Ẩn count khi `< 4` (4 = sàn cơ học "4–32 người chơi" + sàn "trông sống"). Dưới 4: dựa pill (sau sửa #6) |
| 8 | **Nên sửa** | Badge không nổi hơn status pill; sai chỗ gãy dòng meta 390px | Đặt sau `Đơn/Đôi`, `flex:0 0 auto`. Cắt "Round robin" rồi thời gian nếu hết chỗ |
| 9 | **Nit** | Không cần icon Users | Chữ đã nêu đơn vị; icon ăn ngang quý 390px. Bỏ |

## Trạng thái màn hình
- Empty: `tl-empty` sẵn (`:558`), không đổi.
- **Loading**: KHÔNG render `0 đã đăng ký`. Count batch vào payload → có mặt khi render → không skeleton badge. Async lười = CLS (lý do #4 Blocker).
- **Error**: count batch fail → degrade im lặng (không badge, chỉ pill). TUYỆT ĐỐI không show `0`.
- Offline (PWA): cache count cuối, chấp nhận cũ.

## A11y
- Contrast: `--tl-fg-2` #c7c3bb hoặc `--tl-green` #b5e853 trên nền tối the-line. Tránh badge nền sáng GPT đề (#eaf2ff/#174ea6 = light theme). CI axe #426 chặn nếu sai.
- Không lồng interactive: row đã là `<Link>` (`:572`), badge = plain text bên trong. Không `<a>`/button/tooltip/focus riêng.
- 44px không áp (badge non-tappable, target là cả row). Không `aria-live` (count đổi không ngắt lời).

## Copy (VI/EN) — theo đơn vị, KHÔNG `14 đã đăng ký` (mơ hồ), KHÔNG `14/16` (ngụ ý cap cứng)
```
Singles VI: "{N} người đã đăng ký"   EN: "{N} players registered"
Doubles VI: "{N} đội đã đăng ký"      EN: "{N} teams registered"
```
Meta line doubles đủ ngưỡng: `Đôi · 14 đội đã đăng ký · Round robin · 2 giờ trước  [ĐANG MỞ ĐĂNG KÝ]`
Dưới ngưỡng (<4): `Đôi · Round robin · 2 giờ trước  [ĐANG MỞ ĐĂNG KÝ]`

## Panel đa model
**Đồng thuận Claude + GPT-5.6 (2 vendor độc lập)**: (1) N+1 per-card = Blocker phải batch; (2) không show quota+count cùng lúc; (3) chỉ gắn nhãn `requires_registration=true` setup; (4) doubles đếm đội; (5) ngưỡng ẩn `<4`; (6) copy theo đơn vị bỏ X/Y bỏ icon; (7) badge non-tappable trong row link, contrast ≥4.5:1, không aria-live.

**Bất đồng 1 (nội bộ, đã chốt) — phạm vi xoá quota**: GPT muốn xoá token quota khỏi MỌI row (Blocker). Critic KHÔNG đồng ý: row ad-hoc/đang chơi/đã xong `16 người chơi` xấp xỉ đúng roster; đại tu meta mọi trạng thái = scope creep. Chốt: chỉ THAY quota→count ở row đủ điều kiện.

**Bất đồng 2 — chỗ dựa dưới ngưỡng**: GPT+intake giả định pill "Đang mở đăng ký" sẵn có. Cả hai SAI với repo (`types.ts:8655` không có `registration`). Chốt: feature PHẢI kèm sửa #6 (override pill), nếu không chỗ dựa dưới ngưỡng không tồn tại.

## Files
- `Tournaments.tsx` (renderMeta `:80-81,94,120`; row `:569-593`; STATUS_LABEL `:29-37`)
- `useTournamentData.ts` (`player_count`=quota `:89`; `useOpenRegistrationTables` `:97-107`; `useActivePublicQuickTables` `:232`)
- `useUpcomingSocialEvents.ts:53-62` = anti-pattern N+1 KHÔNG lặp
- `the-line.css:3755-3774` (meta+pill tokens); `types.ts:8655` (enum thiếu `registration`)
- Brief+GPT reply: `external/prompt.md`, `external/gpt-reply.md`
