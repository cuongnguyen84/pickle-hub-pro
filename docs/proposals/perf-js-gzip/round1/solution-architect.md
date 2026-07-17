# solution-architect — perf-js-gzip (2026-07-17)

## Điều tra: nguyên nhân thật (đã verify bằng build + grep dist)

Build `ANALYZE=1 npm run build` chạy lại hôm nay. Số chính thức từ
`node scripts/check-bundle-size.mjs`: **Total gz JS 1929.9 KB** / advisory 1800 /
gate 1970. Cần cắt **~130 KB** để chạm 1800.

### Nghi vấn recon (react-dom lọt entry) — SAI. Đã bác bỏ.
Grep fingerprint react-dom (`onRecoverableError`) trên toàn `dist/assets/*.js`:
- `entry index-*.js`: **0** occurrence react-dom internals (chỉ có string `createRoot`/`hydrateRoot` — đó là `src/main.tsx`, ~1 dòng, không phải body react-dom).
- `vendor-react-*.js`: **0** — chunk này chỉ 8.1 KB gz (stub react + scheduler).
- `vendor-ui-*.js`: **6** occurrence → **react-dom nằm trong vendor-ui** (81.4 KB gz = radix + react-dom).

Cơ chế: `manualChunks` object-form ở `vite.config.ts:296` `["react-dom"]` chỉ khớp
`react-dom/index.js`, KHÔNG khớp module cjs nội bộ dùng chung bởi `react-dom/client`
(qua `src/main.tsx:1`) và bởi radix. Rollup gom phần nặng chung đó vào vendor-ui.
**Hệ quả thực tế: 0.** Cả vendor-react lẫn vendor-ui đều nằm trong precache whitelist
(`vite.config.ts:111-112`) → đều là initial-load. Dời react-dom sang vendor-react
không đổi total, không đổi initial-load. Chỉ là dọn dẹp cosmetic. **Bỏ qua** (hoặc
sửa 15 phút cho gọn + cập nhật doc).

### Initial-load thực sự (goal a) đã gần tối ưu
Cộng gz các chunk trong precache whitelist = **~336 KB gz**. Chi phối:
entry 102 · vendor-ui 81 (gồm react-dom ~40 bất khả giảm) · vendor-supabase 54 ·
+ vendor-query/date/capacitor/Index/locale(1 ngôn ngữ). vendor-video (296) và
vendor-charts (108) **KHÔNG** trong precache — đã lazy thật (xác nhận lại recon).
`HomeLivePlayer` lazy ở `src/components/home/LiveSection.tsx`. **Không còn đòn bẩy
lớn nào cho initial-load** sau PERF-02/03/06; muốn cắt tiếp phải bỏ tính năng ở
shell eager. Goal (a) coi như đã đạt — số liệu chứng minh, đừng tốn công thêm.

### Total gz bị đội bởi 3 khối LAZY (không ảnh hưởng initial-load)
| Khối | gz | Bản chất | Rủi ro khi đụng |
|---|---|---|---|
| `vendor-video` | **296 KB** | `@mux/mux-player-react` + `hls.js` — mux-player nhúng bản hls.js fork RIÊNG (grep: `loadSource`×12, `levelController`×22, `mux-player`×7) → hls bị đóng gói ~2 lần | CAO — đường LIVE, path hay page 2am |
| `blog-post-*.js` (47 file) | **353 KB** | Nội dung blog EN+VI (HTML song ngữ) nhét vào .ts, mỗi post ~7.5 KB gz, lazy theo slug (`src/content/blog/index.ts:13` `import.meta.glob`). **Tăng vô hạn mỗi bài mới** | TB — chạm SSR/hreflang blog |
| `vendor-charts` | **108 KB** | `recharts` 2.15 — chỉ **3** nơi dùng: `DuprRatingChart.tsx`, `pages/admin/AdminAnalytics.tsx`, `pages/creator/CreatorAnalytics.tsx`. Primitive dùng: Line/Bar/Pie + Tooltip/Axis/ResponsiveContainer/Cell | THẤP — 1 admin + 2 creator + chart DUPR |

**Nhận định gốc:** 130 KB "vượt budget" phần lớn là **content song ngữ lazy** (blog
353 KB) + **video lazy** (296 KB) mà người dùng chỉ tải khi mở đúng trang đó — không
đồng tải với shell. Metric `check-bundle-size` cộng dồn TẤT CẢ `dist/**/*.js`
(`scripts/check-bundle-size.mjs:24-33`) → mỗi bài blog xuất bản ăn vào "budget code".
Đây là lỗi phép đo nhiều hơn là bloat code.

---

## Tóm tắt kiến trúc
Initial-load đã gọn (~336 KB gz), goal (a) coi như đạt — không có đòn bẩy lớn còn
lại mà không bỏ tính năng. Total 1930 KB bị đội bởi 3 khối LAZY: blog content song
ngữ 353 KB (tăng mỗi bài), vendor-video 296 KB (mux-player, đường live rủi ro cao),
recharts 108 KB (3 trang admin/creator, rủi ro thấp). Hướng đúng: sửa phép đo tách
CODE khỏi CONTENT + gỡ recharts — cắt byte thật ở path không-critical, tránh đụng
đường live.

## Option A — Đo đúng cái cần đo (the cheap one)
Effort: **1 half-day** · Files: `scripts/check-bundle-size.mjs`, `docs/perf-budgets.md`, `src/components/social/player/DuprRatingChart.tsx` · Data: none
How it works:
- `check-bundle-size.mjs` báo **2 số**: CODE gz (loại `blog-post-*.js`) và CONTENT gz
  (blog). Đặt target <1800 vào **CODE**. CODE hiện ≈ **1577 KB** (1930 − 353) → đã <1800.
  Giữ trần per-chunk ≤20 KB/bài để 1 bài phình vẫn đỏ (hiện max 15 KB — an toàn).
- Cập nhật `docs/perf-budgets.md`: sửa dòng entry stale (170→102 KB), ghi rõ luật
  CODE-vs-CONTENT + lý do (blog là content song ngữ lazy, không đồng tải shell).
- Bonus 0-dep: `DuprRatingChart` (chart public duy nhất) → SVG polyline sparkline,
  gỡ recharts khỏi path profile player.
Wins: chạm mục tiêu bằng 1 half-day, rủi ro ~0, sửa đúng gốc "budget creep mỗi bài".
· Loses: không giảm byte THẬT gửi tới người đọc blog (vẫn 15 KB/bài); nếu Cuong muốn
"tổng byte cả app tải xuống nhỏ đi" thì đây là reframe chứ không phải reduction.
· Forecloses: gần như không đóng cửa gì.

## Option B — Reframe + gỡ recharts hẳn (RECOMMENDED)
Effort: **3–4 half-days** · Files: Option A + `pages/admin/AdminAnalytics.tsx`, `pages/creator/CreatorAnalytics.tsx`, (tuỳ) gỡ `recharts` khỏi `package.json` + `vite.config.ts:311` · Data: none
How it works:
- Làm hết Option A.
- Chuyển 2 dashboard analytics (admin 1 user, creator 2 user) off recharts. Line/Bar/Pie
  cơ bản → hoặc SVG tay, hoặc 1 lib nhẹ (nếu thêm dep phải lazy + ghi KB vào PR; ưu tiên
  SVG 0-dep vì chart đơn giản). Gỡ `recharts` khỏi manualChunks + deps → **−108 KB thật**.
- (Tuỳ chọn) dời react-dom vào vendor-react cho gọn — 0 KB, chỉ để doc khớp thực tế.
Kết quả: CODE ≈ 1455 KB, tổng-ship (kèm blog) ≈ 1822 KB. Byte thật giảm ở path
admin/creator/DUPR — KHÔNG đụng live, KHÔNG đụng blog SSR.
Wins: cắt byte thật + sửa metric, dư headroom lớn, toàn path rủi ro thấp (≤3 user
analytics). · Loses: 2 dashboard phải test lại visual; recharts tiện hơn SVG tay.
· Forecloses: nếu sau này cần chart phức tạp (stacked/brush/zoom) phải thêm lib lại.

## Option C — Aggressive: gỡ luôn @mux/mux-player-react
Effort: **+4–5 half-days** trên B · Files: `src/components/video/MuxPlayer.tsx`, `vite.config.ts:321`, `package.json` · Data: none
How it works: phát Mux qua hls.js thuần (`https://stream.mux.com/{playbackId}.m3u8`),
tái dùng engine `HlsPlayer.tsx` (đã có retry/quality/fallback), xoá `@mux/mux-player-react`.
Tiết kiệm **~200–250 KB** (bỏ mux-player + hls fork trùng). Tổng ~1550–1620.
Wins: cắt byte lớn nhất. · Loses: **mất Mux Data analytics beacons** + UI controls
mux + phải tự xử streamType live/DVR + test kép web/native.
· Forecloses: **RỦI RO CAO đường LIVE** — đúng path SLO cấm đánh cược (`docs/slo.md`
reliability > scope, đây là loại thay đổi dễ page 2am). Video vốn lazy nên chưa bao
giờ hại initial-load; cắt nó chỉ làm đẹp con số aggregate bằng cái giá reliability thật.

## Khuyến nghị
**Option B.**
- **A một mình** đúng nhưng để recharts vẫn ship cho người xem chart DUPR public và
  không giảm byte thật — Cuong hỏi cả (a)+(b) reduction, A chỉ là reframe.
- **C thua** vì đổi rủi ro live (thứ SLO nói không bao giờ đánh cược) lấy một con số
  aggregate mà B đã xử xong bằng metric-fix + cắt charts. vendor-video lazy → không
  hại initial-load; giảm nó không mua thêm tốc độ người dùng thật hôm nay.
- **B** cắt byte thật (−108 KB) ở path ≤3 user + sửa đúng lỗi phép đo, dư headroom,
  không chạm live, không chạm blog SSR fragile.

Ranking KB/effort (chắc-ăn-đo-được ✔ vs ước-lượng-cần-verify ~):
1. ✔ Metric split (Option A) — 353 KB rời khỏi "code budget", 1 half-day, rủi ro 0.
2. ✔ Gỡ recharts — −108 KB đo được sau build, 3–4 half-days, rủi ro thấp.
3. ~ DuprRatingChart→SVG — vài KB, gộp trong A.
4. ~ Drop mux-player (C) — −200~250 KB ước lượng, cần verify split mux/hls khi làm,
   effort cao + rủi ro live cao → chỉ làm nếu Cuong chấp nhận đánh đổi.

## Increments
1. **Metric split + doc** (`check-bundle-size.mjs` báo CODE/CONTENT, target vào CODE,
   trần 20 KB/bài; sửa `perf-budgets.md`) — verify: `node scripts/check-bundle-size.mjs`
   in ra CODE ≈ 1577 <1800, gate vẫn xanh.
2. **DuprRatingChart → SVG sparkline** — verify: build, chart profile player render đúng;
   recharts biến mất khỏi chunk của route đó trong stats.html.
3. **AdminAnalytics + CreatorAnalytics off recharts** → gỡ `recharts` dep + manualChunks —
   verify: `grep -rl recharts src/` = rỗng; build total giảm ~108 KB; vendor-charts biến mất.
   **Stop-and-look:** Cuong xem lại 2 dashboard visual trước khi merge.
4. (deferred, tách proposal) react-dom→vendor-react tidy (0 KB) nếu muốn doc khớp.
5. (deferred, cần Cuong duyệt đánh đổi) Option C mux-player drop — proposal riêng, RED-ish
   vì đụng đường live.

## Điều em không chắc
- **Option A có "gaming metric" không:** em cho là KHÔNG (blog là content lazy, per-slug,
  <15 KB, không đồng tải shell) nhưng risk-auditor có thể phản đối. Luận cứ phòng thủ:
  giữ trần per-chunk 20 KB để bài phình vẫn đỏ.
- **recharts → SVG effort thật cho 2 dashboard:** chưa đọc kỹ AdminAnalytics/CreatorAnalytics
  xem có stacked/tooltip phức tạp không. Nếu có, nên dùng 1 lib nhẹ lazy (uPlot ~8 KB gz)
  thay vì SVG tay — cần verify khi làm; KB net khi đó là ~−100 chứ không phải −108.
- **Option C tiết kiệm chính xác bao nhiêu:** grep xác nhận vendor-video chứa cả mux-player
  lẫn hls fork trùng, nhưng chưa tách được chính xác mux-player chiếm bao nhiêu trong 296 KB
  — con số 200–250 là ước lượng, phải đo bằng build thử khi (nếu) làm.
- **Mux Data analytics:** chưa xác minh Cuong có đang DÙNG dashboard Mux Data hay không;
  nếu không dùng thì rào cản lớn nhất của Option C nhẹ đi đáng kể.
