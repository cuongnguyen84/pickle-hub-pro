# idea-recon — perf-js-gzip (2026-07-17)

## Prior art
- Cả 3 task lazy-loading trước đó đã ship và merge: **PERF-06** (locale split, commit `ecce35f2`) — `vite.config.ts:294-295` tách `locale-en`/`locale-vi` thành manualChunks riêng, `I18nProvider` chỉ import ngôn ngữ active. **PERF-03** (precache whitelist, `vite.config.ts:97-134`) — SW chỉ precache core + journey screens, không còn precache toàn bộ ~300 route chunk. **PERF-02** (`31b07843`, PR #345, đã merge) — `TeamMatchView` 11 dialog on-demand lazy, route chunk 240KB→136KB raw (~30.6 KB gz đo lại hôm nay, khớp).
- `docs/proposals/perf-js-gzip/00-intake.md` đã tồn tại (tạo 2026-07-17) — đây chính là intake cho task này, `round1/`, `round2/`, `external/` đều **rỗng** — chưa có phân tích nào trước đó.
- 95% route pages đã `lazyRetry()`/`lazy()` — `src/App.tsx:46-197`. Chỉ `Index` (trang chủ) eager (`src/App.tsx:24`, comment lý do: "fast initial render").
- `vendor-video` (Mux/hls.js) và `vendor-charts` (recharts) đã lazy thật: `HomeLivePlayer` — thành phần duy nhất dùng Mux trên trang chủ eager — được lazy hoá riêng ở `src/components/home/LiveSection.tsx:8` (`const HomeLivePlayer = lazy(...)`), không nằm trong entry dù `Index.tsx` eager.

## Số đo thực tế (build vừa chạy, `ANALYZE=1 npm run build` mất 14.2s)
- `node scripts/check-bundle-size.mjs`: **Total gz JS 1930.4 KB** / budget advisory 1800 / CI gate 1970 (còn ~40KB headroom trước khi CI đỏ).
- Top: vendor-video 297.1KB, vendor-charts 107.9KB, **entry `index-*.js` 102.2KB**, vendor-ui 81.6KB, vendor-supabase 53.9KB, QuickTableView 37.3KB, locale-vi 33.7KB, locale-en 31.5KB, TeamMatchView 29.9KB, SocialEventDetail 23.8KB. 365 file .js tổng cộng trong dist (script cộng dồn TẤT CẢ, không chỉ initial load).
- `dist/stats.html` (treemap, gzip+brotli) được tạo tại `dist/stats.html` (1.8MB), sinh bởi `rollup-plugin-visualizer` (`vite.config.ts:36-42`, opt-in `ANALYZE=1`).
- **Bất thường chưa xác nhận đầy đủ**: `vendor-react` chunk chỉ 21.6KB raw / 7.9KB gz — quá nhỏ so với react+react-dom+react-router-dom (~130KB+ raw riêng react-dom). Entry chunk chứa string `createRoot` (grep xác nhận). Nghi ngờ `src/main.tsx:1` (`import { createRoot } from "react-dom/client"`) — subpath `react-dom/client` — không khớp key `"react-dom"` trong `manualChunks` (`vite.config.ts:296`), khiến phần lớn react-dom bị gộp vào entry thay vì vendor-react. **Chưa verify bằng stats.html trực quan** — cần xem treemap để confirm chắc chắn module nào nằm trong entry.

## Cấu hình đo
- `scripts/check-bundle-size.mjs:24-33` — walk toàn bộ `dist/**/*.js`, gzip từng file, cộng dồn = **tổng aggregate**, không phân biệt initial-load vs lazy-chunk. Không đo được "cái gì user thực sự tải khi vào `/`".
- CI: `.github/workflows/quality.yml:94-98` — `BUNDLE_STRICT=1`, `BUNDLE_BUDGET_KB=1970`.

## Constraint đã viết sẵn (binding)
- `docs/perf-budgets.md:20-25` — Total gz JS: giữ nguyên 1970 (splitting không giảm tổng, chỉ dedication/xoá code mới giảm); entry ≤170KB (đã lỗi thời, thực đo 102KB — **cần cập nhật doc**); bất kỳ route chunk nào ≤150KB no-grandfather; PWA precache ≤3MB (thực 1.44MB theo doc cũ, 1468.95 KiB theo build vừa chạy — khớp).
- `docs/perf-budgets.md:33-34` (Rules #2, #3) — dependency mới >20KB gz vào entry path cần lý do trong PR body; feature nặng mới phải `import()` ở route/interaction boundary theo mặc định.

## Test coverage hôm nay
- Không có test tự động cho bundle size ngoài `check-bundle-size.mjs` (advisory/gate script, không phải vitest suite). Không tìm thấy test nào trong `src/**/*.test.ts` hay `tests/` cho code-splitting/lazy behavior.

## Bilingual surface
- Không liên quan text UI trực tiếp — nhưng `locale-en`/`locale-vi` (31.5/33.7KB gz) là 2 chunk riêng đã PERF-06 xử lý; đừng đụng lại logic tách ngôn ngữ khi tối ưu bundle khác.

## Unknowns
1. Nghi vấn `vendor-react`/entry (react-dom lọt vào entry qua `react-dom/client` subpath) — cần verify bằng `dist/stats.html`.
2. `docs/perf-budgets.md` stale (entry ~170KB ghi tay, thực 102KB).
