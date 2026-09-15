# Pro-tour live results — đặc tả để port sang app native (/apple)

> Tóm tắt toàn bộ feature xây ngày 09/09/2026 (PR #753→#768) cho web,
> làm căn cứ port SwiftUI. Web reference: `src/pages/LiveProEvent.tsx`,
> `src/lib/pro-tour/results.ts`, `src/content/pro-tour-events.ts`,
> `src/hooks/useProTourEvent*.ts`, `src/components/live/ProTourEventsStrip.tsx`.

## 1. Feature là gì

- **Trang kết quả từng giải pro-tour**: `/live/pro/<slug>` (+ `/vi` twin) —
  nhánh đấu đầy đủ theo nội dung → vòng → trận, cập nhật gần-live trong ngày giải.
- **Thẻ giải (strip)** trên trang chủ + `/live`: các giải trong mùa
  (7 ngày trước → 14 ngày sau giải), thẻ có màu thương hiệu + logo badge.
- **Registry động**: bảng `pro_tour_events` — thêm giải trong
  `/admin/pro-tour → tab Sự kiện` là thẻ + trang tự xuất hiện, không deploy.
- **Live**: khung "Đang diễn ra" ghim đầu trang + chip LIVE đỏ nhấp nháy,
  điểm từng game giữa trận, tự tắt khi trận xong.
- **Tìm kiếm theo tên VĐV** (bỏ dấu: "truong" khớp "Trương").
- 🇻🇳 đánh dấu trận có VĐV Việt Nam (heuristic dấu tiếng Việt trong tên).

## 2. Nguồn dữ liệu (Supabase — native dùng chung)

### 2.1 Registry giải: bảng `pro_tour_events` (public read)

```
slug (PK) · name_pattern · name_en · name_vi · tier · tour · sponsor
city · country · country_code · venue · start_date · end_date (DATE)
official_url · brackets_url · prize_money · logo_url · brand_bg
```

Query: `from("pro_tour_events").select("*").order("start_date", desc)`.
Cache thoải mái (5 phút). `brand_bg` là chuỗi CSS gradient — native tự map
sang màu tương đương (KL Cup: navy #10283d→#1c405f).

### 2.2 Trận: bảng `matches` (đã có sẵn trong app)

Filter: `source_provider = 'ppa_tour'` AND `is_public = true`
AND `tournament_name ILIKE <name_pattern của giải>`.

Select web đang dùng (embed 2 tầng):

```
id, slug, tournament_name, tournament_event, round_name,
team_a_score, team_b_score, winning_team, played_at, court_number, notes,
match_participants(team, position,
  profile:profiles!match_participants_player_id_fkey(display_name, username))
```

`limit(1000)`, order `played_at desc`. Trường quan trọng:

- `team_a_score/team_b_score: number[]` — điểm TỪNG GAME. Trận đang đấu có
  mảng dở dang (vd `[11,10]` vs `[7,12]`).
- `winning_team: "a"|"b"|null` — null = chưa xong (hoặc đang live).
- `notes`: trận đang live = chuỗi JSON `{"live":true}` (scraper ghi, tự xoá
  khi trận xong). **ĐỪNG parse notes như MLP lineup** — với ppa_tour chỉ cần
  check `notes` chứa `"live":true`.
- ⚠️ `updated_at` KHÔNG đáng tin cho live-refresh (không được bump) — đừng
  dùng làm tín hiệu tươi.

## 3. Pipeline phía sau (không cần port, chỉ cần biết)

`pro_tour_watchlist` (URL bracket từng nội dung, thêm ở admin) → worker
`pro-tour-scraper` cron **mỗi phút**, tối đa 4 nguồn/lượt, mỗi nguồn giữ nhịp
+2' khi có giải live (theo `pro_tour_events` ngày UTC+8), +24h khi không →
edge fn `pro-tour-ingest`:

- trận mới → insert (kèm participants; bye 2 bên trống tên vẫn có thể vào DB);
- trận đã có, CHƯA winner → **live-refresh**: update điểm + notes live
  (nhánh này là fix quan trọng — trước đây "để nguyên" nên live chết);
- trận đã có, CÓ winner mới → update kết quả + verified;
- nguồn trả trang challenge (~1KB, không có `__next_f`) → scrape FAIL để
  lượt sau thử lại (trước đây "success 0" câm).

Độ trễ dữ liệu: **~1-3 phút** so với bracket gốc trong ngày giải.

## 4. Logic nhóm/hiển thị (PORT PHẦN NÀY — nguồn: `src/lib/pro-tour/results.ts`, pure)

Thứ tự xử lý sau khi fetch rows:

1. **proOnly**: nếu tồn tại row có `tournament_event` chứa từ "Pro" → bỏ mọi
   row không có "Pro" (chặn bracket amateur lọt watchlist).
2. **Bỏ bye rỗng**: trận mà CẢ HAI bên không có tên VĐV → bỏ (hiện "— vs —"
   rất xấu; bye một bên có tên thì giữ).
3. **Nhóm theo `tournament_event`** (nguyên văn từ nguồn). Phân loại key để
   đặt nhãn + thứ tự: mens_singles → womens_singles → mens_doubles →
   womens_doubles → mixed_doubles → other (regex trong `classifyEvent`).
   Nhãn VI: Đơn nam/Đơn nữ/Đôi nam/Đôi nữ/Đôi nam nữ. Nếu tên event chứa
   "Qualif" → nối hậu tố **" — Vòng loại"** (tránh 2 section trùng đề mục).
4. **Trong event, nhóm theo `round_name`** (mã đóng): thứ tự
   `F, 3P, SF, QF, R16, R32, R64, W, L, GS`, mã lạ xuống cuối. Nhãn VI:
   Chung kết/Tranh hạng 3/Bán kết/Tứ kết/Vòng 16/Vòng 32/Vòng 64/Vòng đầu/
   Nhánh thua/Vòng bảng.
5. **Trong round, sort**: live trước → `played_at` tăng → slug (ổn định).
6. **isLive** = `winning_team == null && notes chứa "live":true`.
7. **Champion** của event: round F có đúng 1 trận và có winner → đội thắng
   (hiện 🏆 cạnh tên event).
8. **Điểm game cuối 0-0** là slot template chưa đánh → cắt (xem `toGames`).
9. **🇻🇳**: tên VĐV có dấu tiếng Việt → `isVietnameseName`
   (`src/lib/wc-open/parse-pro.ts`) — port nguyên heuristic này.
10. **collectLiveMatches**: gom mọi trận isLive toàn giải (kèm nhãn event) →
    khung "Đang diễn ra (n)" ghim TRÊN CÙNG, sort theo played_at.
11. **Search VĐV**: fold bỏ dấu (NFD, strip combining, đ→d, lowercase) cả
    query lẫn tên; lọc trận có tên khớp; đếm lại tổng trung thực.

Test tham chiếu (14 case): `src/lib/pro-tour/__tests__/results.test.ts`.

## 5. UI spec (theo web, The Line style)

- **Header giải**: kicker `TIER · TOUR` → tên giải (serif lớn) → dòng meta
  `ngày · thành phố, nước · venue · tiền thưởng` → pill trạng thái
  (Sắp diễn ra / Đang diễn ra + chấm đỏ / Đã kết thúc) + chữ nhỏ
  "Tự cập nhật mỗi phút" khi live → 2 link: Nhánh đấu gốc ↗ · Trang giải ↗.
- **Phase tính theo ngày, múi giờ UTC+8** (start 00:00 → end 23:59:59 +08).
- **Khung "Đang diễn ra (n)"**: viền đỏ, chỉ render khi n>0; mỗi item = nhãn
  event nhỏ + match row.
- **Match row**: `Tên/Tên 🇻🇳 vs Tên/Tên` (bên thắng in đậm) + điểm
  `"11-7, 10-10"` monospace bên phải (— nếu chưa có); chip `● LIVE` đỏ nhấp
  nháy khi live; viền vàng nhạt khi có VĐV VN.
- **Empty states**: chưa bắt đầu ("trận đầu dự kiến <ngày>"), nguồn chậm,
  không khớp tìm kiếm.
- **Thẻ giải (strip/danh sách)**: tier + pill phase, tên, ngày + nơi, CTA
  "Xem kết quả →"; nếu có brand: nền gradient navy, chữ trắng, logo badge
  phải (64px, đổ bóng).

## 6. Polling — BÀI HỌC XƯƠNG MÁU cho native

- Cadence: **60 giây khi giải đang live** (phase theo ngày), 1 giờ khi không.
- Web dính bug: interval bị pause khi tab mất focus + app tắt
  refetch-on-focus → người xem tưởng đứng hình, F5 mới thấy (#768 fix:
  poll cả nền + refetch khi focus). Native tương đương:
  - Timer chạy khi view hiển thị; **`onAppear`/`scenePhase .active` →
    refetch NGAY** rồi mới đặt timer.
  - App vào background → dừng timer; trở lại foreground → refetch ngay.
- Registry (pro_tour_events) cache 5'; kết quả staleTime 30s.

## 7. Điều hướng & phát hiện giải

- Danh sách giải cho strip: lọc `now ∈ [start−7d, end+14d]` (UTC+8), sort
  theo start_date tăng.
- Deep link web↔native: `/live/pro/<slug>`.

## 8. Những cái KHÔNG port

- SSR/prerender, sitemap, route snapshot — web-only.
- Admin tab Sự kiện — dùng web admin là đủ.
- Scraper/ingest — backend chung, native chỉ đọc `matches` + `pro_tour_events`.
