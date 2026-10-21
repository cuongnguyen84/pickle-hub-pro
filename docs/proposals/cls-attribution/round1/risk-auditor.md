# risk-auditor — cls-attribution (2026-08-09)

## Verdict: 🟡 AMBER
Nguy cơ thật nhất không phải là "code hỏng" mà là **kết luận sai rồi sửa nhầm chỗ**: pipeline đo hiện tại không thể chứng minh `/live` gây ra 78% CLS poor, và tiêu chí thành công đang viết (%good ≥75% toàn origin) về mặt số học **không thể** đạt được kể cả khi sửa hoàn hảo cái livestream chiếm 179/291 poor.

Classifier said: **GREEN** (5 file `src/**`, "app code — revert + redeploy restores it").
Em nâng lên **AMBER** vì: (a) surface là `/live/<id>` — trang duy nhất trong repo có
tiền lệ sự cố chunk-reload giữa buổi phát (`src/lib/chunkError.ts` header ghi rõ
"2026-07-19 live-stream incident"); (b) một nhánh của ý tưởng (`reportAllChanges`)
**không revert được** vì nó ghi bẩn vĩnh viễn chính KPI dùng để nghiệm thu;
(c) risk-tier chỉ đọc path, không đọc được "đây là trang có 226 poor events và
0 dòng test hồi quy".

**3 hạng mục con là 🔴 RED, chặn cứng, không thương lượng** (chi tiết bảng dưới): R1, R2, R3.
Phần còn lại (đăng ký GA4 dims + repro tooling dev-only + 1 fix hình học WatchLive) là AMBER, được đi.

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| **R1** | 🔴 **Cao** | Đặt `reportAllChanges: true` trong `src/lib/webVitalsRum.ts:285` (`onCLS(report)`) → mỗi lần CLS tích thêm là **một event `web_vital` mới**, dùng lại đúng tên event và đúng param `metric_rating` mà PERF-05B/tiêu chí thành công đang đếm. Giá trị tích luỹ nhỏ ở đầu phiên rate "good" → **%good tăng giả**. Không có sampling thật (`sample_rate: 1` chỉ là literal, `src/lib/webVitalsRum.ts:171`). GA4 **không xoá được row đã ghi**. | Không thấy gì. Nhưng Cuong sẽ đọc "%good 78% — ĐẠT" trong khi CLS thật của người xem không đổi, rồi đóng finding P1. | CẤM bật trên event `web_vital`. Nếu cần chuỗi shift: event **tên khác** (`web_vital_debug`), sampling thật, và tự tắt sau N ngày. Cửa sổ đo KPI phải sạch. |
| **R2** | 🔴 **Cao** | Playwright repro trỏ vào livestream **đang live trên prod**: `useLivePresence(id, isLiveStatus, isGated)` gọi `channel.track()` ngay ở handler `SUBSCRIBED` (`src/hooks/useLivePresence.ts:100-112`), **không phụ thuộc bấm play**. Mỗi lần chạy script = +1 viewer ảo. Nếu script bấm play thì `useIntervalViewCounter` (`active: isVideoPlaying && !isGated`) còn ghi tới 20 view event/phiên vào `batch-view-events`. | Người xem thật thấy số "N đang xem" trên `/live/<id>` nhảy lên khi không ai vào; số tổng view bị thổi. Organizer đọc sai lượng khán giả. | Repro chỉ chạy trên **preview URL** hoặc stream `status='scheduled'/'ended'`; hoặc stub `useLivePresence`. Nếu buộc dùng stream live thật: chỉ 1 lần, có mặt Cuong, ghi lại số trước/sau. |
| **R3** | 🔴 **Cao** | Deploy `main` trong lúc đang có buổi phát: asset content-hash đổi; `index.html` cố ý **không precache** và navigation dùng NetworkFirst timeout 3s (`vite.config.ts:153` globIgnores + `:194`) → client mạng yếu nhận shell cũ từ runtime cache, rồi lazy-import chunk cũ đã biến mất. `src/lib/chunkError.ts` bắt đúng lớp lỗi này (`"Importing a module script failed"` — WKWebView) và ép reload. | Người đang xem trận bị **reload giữa chừng**: player khởi động lại từ đầu, chat mất scroll, Presence rejoin (số viewer tụt rồi nhảy). Đúng lớp sự cố 2026-07-19. | Deploy ban ngày VN, gate bằng query `livestreams` không có row `status='live'` và không có `scheduled_start_at` trong ±3h. Đây là ràng buộc **thời điểm**, không phải ràng buộc code. |
| **R4** | Cao | **Attribution sai tầng.** `onCLS` đo theo **document**, không reset khi react-router soft-nav; `pageContext.route` bị đóng băng lúc boot (`src/lib/webVitalsRum.ts:259-264`) — chính code đã tự thú bằng `navigation_scope: "document"` (`:170`). Người dùng tích shift ở `/` rồi vào `/live/<id>` rồi khoá màn hình → toàn bộ CLS của document đó bị ghi vào `/live/<id>`. Thêm: web-vitals `^5.3.0` **bắn lại** CLS ở mỗi lần `visibilitychange → hidden` nếu giá trị tăng → **457 row ≠ 457 lượt xem**; livestream (xem lâu, khoá máy nhiều lần) tự nhiên sinh nhiều row hơn `/login`. | Fix đúng element nhưng số không nhúc nhích; hoặc tệ hơn: sửa `/live` trong khi shift thật nằm ở `/` (37 poor) hay `/feed`. | Bắt buộc trước khi sửa: (1) chạy lại query cũ **cắt theo `app_surface`** — dim này ĐÃ đăng ký (thông báo lỗi Data API gợi ý `customEvent:app_surface`), miễn phí, **hồi cứu được ngay hôm nay**; (2) đăng ký `route` cùng lúc với 2 dim CLS rồi **đối chiếu `route` vs `pagePath`** — lệch nhiều = kết luận `/live` sập. |
| **R5** | Cao | **Tiêu chí thành công không thể thoả.** Số học trên chính `00-data-ga4-raw.txt`: 148 good / 291 poor / 18 ni = 457. Cần 343 good (75%) → cần **+195**. Sửa hoàn hảo *cả stream lớn nhất* (179 poor + 10 ni) chỉ ra `337/457 = 73,7%` → **VẪN TRƯỢT**. Phải chuyển 195/237 event non-good của toàn bộ `/live/*` (**82,3%**) mới đạt. Ngược lại nếu tuần tới không có buổi phát lớn nào, mẫu non-live cho `125/197 = 63,5%` → **trượt dù fix đúng**. | Cuong đọc "THUA" cho một fix thật sự có tác dụng, rồi revert nhầm. Hoặc "THẮNG" nhờ traffic mix. | Đổi predicate: **%good của riêng `route=/live/:id` (hoặc pagePath `/live/`), n ≥ 100**, so với baseline 23 good/260 (8,8%) trong cửa sổ 29/07–08/08. Số toàn origin chỉ để tham khảo. |
| **R6** | TB | **Selection bias trong chính RUM.** `index.html:35-39` chỉ nạp gtag.js khi có `pointerdown`/`keydown`/`scroll` hoặc sau 60s. Event `web_vital` chỉ là lệnh xếp trong `dataLayer` cho tới lúc đó; document đóng trước khi gtag.js nạp = **mất trắng event**. Người xem live (bấm play, cuộn chat, ở lại >60s) gần như luôn được đo; người bounce nhanh gần như không bao giờ. | Không thấy gì. Nhưng mẫu 457 nghiêng có hệ thống về phiên dài → `/live` bị over-represent bằng cơ chế, không phải bằng bug layout. | Ghi vào proposal như một **giới hạn đã biết** của mọi con số CLS field hiện có. Không sửa `index.html` trong PR này (đụng bot-guard 2026-07-08). |
| **R7** | TB | WIP chưa commit trên `wip/native-chat-and-news-rewrite` sửa `src/pages/WatchLive.tsx:414-420` từ `concurrentViewers >= MIN_PUBLIC_VIEWERS` → `concurrentViewers > 0`. Span `N đang xem` không có width/min-height dự trữ, nằm trong `flex flex-wrap items-center gap-4` — chuyển từ "hiếm khi hiện" sang "gần như luôn hiện" = **nhân rộng đúng nghi phạm đang điều tra**. | Hàng metadata dưới `<h1>` nhảy/xuống dòng vài giây sau khi Presence connect, trên MỌI stream thay vì chỉ stream đông. | Hai thay đổi này **không được vào cùng một cửa sổ đo**. Hoặc WIP chờ, hoặc WIP đi kèm placeholder giữ chỗ đúng kích thước (đo bằng chuỗi i18n dài nhất của cả `vi` và `en`). |
| **R8** | TB | WIP `src/components/video/MuxPlayer.tsx` thêm `capRenditionToPlayerSize={false}` + `renditionOrder="desc"` cho live → ABR khởi động ở rendition cao nhất trên 4G VN. | Player quay vòng lâu hơn, rebuffer, tốn data. Và **LCP** — đang 2423ms/2500ms target, %good 73,7%, biên chỉ ~77ms. | Tách PR, tách cửa sổ đo. Nếu vào cùng lúc với fix CLS thì không attribute được cái nào, và một LCP regression sẽ bị đổ oan cho fix CLS. |
| **R9** | TB | "Fix" `/login` bằng cách render form trước khi auth resolve (`src/pages/Login.tsx:283-306` vs `:330+`) tạo race: user đã đăng nhập thấy form, gõ dở, rồi bị redirect. | Nháy form đăng nhập cho người đang đăng nhập; mất chữ đang gõ. | Placeholder **inert** đúng hình dạng form (skeleton cùng chiều cao), không phải form thật. |
| **R10** | TB | "Fix" ChatPanel bằng cách khoá cứng `h-[400px]` bỏ nhánh `keyboardHeight > 0 → h-[280px]` (`src/pages/WatchLive.tsx:375`). Nhánh đó tồn tại để composer không chui xuống dưới bàn phím iOS. | Người dùng gõ chat không nhìn thấy ô nhập / không bấm được Send. Hồi quy nặng hơn CLS. | Không đụng. Nếu muốn giảm shift: dùng `interactive-widget=overlays-content` (đã có trong `index.html:11`) + reserve chiều cao ở container cha, không đổi chiều cao panel. |
| **R11** | Thấp | Zero test hồi quy trên bề mặt sắp sửa: `src/lib/__tests__/layout-stability-surfaces.test.ts` (37 dòng) chỉ pin chuỗi ở `Index.tsx`/`HomeNewsFeed.tsx`/`LiveSection.tsx`/`VenueDetail.tsx`/`ViBlogPost.tsx`/`BlogPost.tsx`. Không có 1 assertion nào cho `WatchLive.tsx`, `MuxPlayer.tsx`, `ChatPanel.tsx`, `Login.tsx`. Đã có 12 commit "fix CLS" quanh khu vực này — không cái nào để lại chốt. | Lần thứ 13 refactor sẽ gỡ chỗ giữ hình học mà không ai biết. | Mọi fix hình học phải thêm assertion vào đúng file test đó, cùng PR. |
| **R12** | Thấp | GA4 event-scoped custom dimension: standard property trần **50**; hiện ~12 (10 dims 21/07 + `metric_name`/`metric_rating` 28/07). Thêm `cls_shift_target`, `cls_load_state`, `route` → ~15. | Không ai thấy gì. | Không phải blocker. Nhưng dim **không hồi cứu** — đăng ký NGAY hôm nay, đừng chờ tới lúc quyết định. |
| **R13** | Thấp | `index.html:24` hardcode `debug_mode: true` trên mọi `gtag('config')` prod (đã ghi ở `docs/milestones.md:19` là nợ chưa xử). Nếu ai đó bật developer-traffic filter trong GA4 Admin, **toàn bộ** event prod bị loại khỏi report. | Số CLS/LCP/funnel đột ngột về 0, trông giống outage instrumentation. | Không sửa trong PR này (rủi ro chạm bot-guard). Ghi vào runbook: **không bật developer-traffic filter** cho đến khi gỡ `debug_mode`. |

---

## SLO bị đe doạ

- **SLO 6 (Latency — VN mobile p75, CLS ≤ 0.1)**: đây là SLO đang **trượt sẵn** (0.67, %good 32,4%). Ý tưởng nhằm sửa nó. Rủi ro thật là R1 (làm số đẹp giả) và R5 (predicate không thoả) khiến SLO này bị tuyên "đã đạt" mà không đạt. Kèm rủi ro phụ: R8 đẩy **LCP** (cùng SLO 6, biên 77ms) từ good về needs-improvement.
- **SLO 1 (Web availability — `/` và `/feed` trả 200 với app shell)**: chỉ bị đe doạ qua R3 (deploy giữa buổi phát → chunk-reload). Không phải 5xx, nhưng là mất phiên người dùng thật.
- Không đụng: SLO 2 (auth), 3 (registration), 4 (scoring), 5 (cron), 7 (push). Không có migration, không có RLS, không có RPC, không có edge function, không đổi `verify_jwt`, không đụng `supabase/config.toml`. `npm run auth:registry -- --strict` không liên quan.

---

## Ngân sách hiệu năng

Đo thật hôm nay trên working tree (`npm run build && node scripts/check-bundle-size.mjs`):

```
INITIAL (first-paint) gz: 225.3 KB / 280   (headroom 54.7)
CODE gz:                1520.1 KB / 1800   (headroom 279.9)
CONTENT (blog):          383.9 KB / 51 chunk (cap 20 KB mỗi chunk)
Total gz JS:            1904.0 KB / 1970   → ⚠ headroom 66.0 KB (<5%)
assets/WatchLive-*.js:      19.6 KB gz
```

- **Bundle: +0 KB** cho cả 3 phương án. `web-vitals/attribution` đã nằm sẵn trong bundle (dynamic `import()` tại `src/lib/webVitalsRum.ts:268`) — bật `reportAllChanges` là 1 option object, không thêm byte. Playwright repro là devDependency, không vào `dist`. Fix hình học là Tailwind class + JSX, ước tính <0.3 KB gz. **Không đụng trần nào.**
- Lưu ý con số: `docs/perf-budgets.md:34` ghi total ~1822 KB (baseline 17/07) — thực tế đã trôi lên **1904.0**. Doc stale 82 KB. Không phải lỗi của ý tưởng này, nhưng ai đọc doc để ước lượng headroom sẽ tính sai gấp đôi.
- **Runtime cost**: `reportAllChanges` là chi phí *mạng*, không phải bundle — mỗi shift = 1 beacon `gtag`. Trên `/live` xem 40 phút với chat/presence re-render liên tục, đây là hàng chục–hàng trăm beacon/phiên. Trên 4G VN đó là băng thông cạnh tranh trực tiếp với HLS segment. Đây là lý do thứ hai để không bật nó (lý do thứ nhất là R1).
- **Vietnam p75 impact**: fix hình học thuần CSS/JSX → không ảnh hưởng LCP/INP. Nguy cơ p75 duy nhất trong phạm vi này đến từ R8 (Mux ABR WIP), không từ CLS fix.

---

## SEO

- **Routes SSR bị ảnh hưởng: none.** Không đụng `functions/_middleware.ts`, `functions/_lib/render/**`, `functions/sitemap*.ts`, `BLOG_POST_META`, canonical/hreflang. `renderLive` sinh HTML riêng cho bot; `WatchLive.tsx` chỉ là nhánh người dùng thật.
- **Cần bump `pr:v34`? KHÔNG.** Cache key `pr:v34:${pathname}` trong KV `PRERENDER_CACHE` chỉ chứa output của `functions/_lib/render/**`. PR này không đổi output đó → HTML cache vẫn đúng. (Ghi chú: template mặc định nói `pr:v26` — giá trị hiện hành trong `CLAUDE.md` là **v34**.)
- **CLS ↔ ranking**: CLS là tín hiệu page-experience, hiện làm cả origin đánh "Failed" trên PSI. Sửa được là lợi SEO thật. Nhưng CrUX là cửa sổ **28 ngày rolling** — sửa hôm nay thì PSI sớm nhất ~4 tuần mới đổi màu. Đừng đặt mốc đọc PSI dưới 28 ngày.
- **Rủi ro regress LCP**: chỉ đến từ R8. Fix CLS đúng cách (skeleton giữ đúng hình học của cây đã load) thường **cải thiện** LCP vì element LCP không bị dịch. Nguy hiểm ngược lại: nếu ai đó "sửa CLS" bằng cách bỏ skeleton và render trắng tới khi data về → LCP tụt thẳng. Cấm cách đó.
- Verify (sau deploy, không bắt buộc vì không đụng SSR — chạy để chắc không vỡ gì):
  `curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "https://www.thepicklehub.net/live/d7750a98-2d19-440e-8197-51662492891f?nocache=1"` → expect 200 + `<title>` + `og:image` + hreflang en/vi/x-default.

---

## Kế hoạch rollback

| Hạng mục | Cơ chế | Thời gian khôi phục |
|---|---|---|
| Fix hình học `WatchLive.tsx` / `Login.tsx` | `git revert` + push `main` → Cloudflare Pages redeploy | ~4-6 phút (build+deploy), native WebView tự nhận vì load remote URL — **không cần app-store** |
| Playwright repro tooling | Không vào `dist`, không cần revert | 0 |
| Đăng ký GA4 custom dimension | Archive dim trong GA4 Admin | ~1 phút thao tác |

**Không revert được — đây chính là phần RED:**

1. **Row GA4 đã ghi.** Nếu R1 xảy ra (bật `reportAllChanges` trên event `web_vital`), mọi row `metric_rating` trong cửa sổ đó bị nhiễm **vĩnh viễn**; GA4 không cho xoá event. Baseline 29/07–08/08 mất khả năng so sánh. `git revert` không lấy lại được dữ liệu.
2. **Thời gian chờ.** Dim không hồi cứu (đã dính 1 lần ở PERF-05, `docs/perf-05-report-2026-07-28.md:39-43`). Quên đăng ký hôm nay = mất trắng 7 ngày, không mua lại được.
3. **Presence/view count đã thổi** (R2). Số đã ghi vào `view_events`/hiển thị cho người xem thật không rút lại được.
4. **Phiên người dùng đã mất** (R3). Người bị chunk-reload giữa trận không "un-reload" được bằng revert; revert chỉ tạo thêm một deploy nữa.

---

## Phải verify trước khi merge

- [ ] `node scripts/agents/risk-tier.mjs --files "$(git diff --name-only origin/main...HEAD | tr '\n' ',')" --json` — trên **diff commit**, không phải working tree (bài học 2026-07-20: untracked rác làm classifier báo sai).
- [ ] **Trước khi viết bất kỳ dòng fix nào**: chạy lại query GA4 CLS × `pagePath` **thêm breakdown `customEvent:app_surface`** (dim này đã đăng ký, hồi cứu được ngay). Nếu phần lớn 226 poor của `/live` đến từ `capacitor_ios`/`capacitor_android` thì bề mặt sửa khác hẳn.
- [ ] Đăng ký **3** custom dimension event-scoped hôm nay (`cls_shift_target`, `cls_load_state`, **`route`**), chụp màn hình GA4 Admin làm bằng chứng, ghi ngày giờ vào proposal. `route` là cái cho phép phát hiện lệch entry-route vs `pagePath` — không có nó thì R4 không kiểm chứng được.
- [ ] `grep -n "reportAllChanges" src/lib/webVitalsRum.ts` → **phải rỗng**. Nếu có, PR bị chặn.
- [ ] `git diff --name-only origin/main...HEAD` **không được chứa** `src/components/video/MuxPlayer.tsx` (tách R8 ra PR riêng, cửa sổ đo riêng).
- [ ] Nếu PR đụng `src/pages/WatchLive.tsx`: thêm assertion hình học vào `src/lib/__tests__/layout-stability-surfaces.test.ts` **cùng PR** (R11).
- [ ] `npm run test` + `npm run lint` xanh; coverage ≥83% (ngưỡng `vite.config.ts`, đã làm đỏ CI 2 lần vì file mới thiếu test).
- [ ] `npm run build && node scripts/check-bundle-size.mjs` → total ≤ 1970 (hiện 1904.0, headroom 66.0).
- [ ] **Cổng deploy (R3)**: query `livestreams` xác nhận `status='live'` = 0 row VÀ không `scheduled_start_at` trong ±3h. Deploy ban ngày VN. Không merge sau 19:00 ICT.
- [ ] Nếu chạy repro tooling: xác nhận target là preview URL hoặc stream `status IN ('scheduled','ended')`, KHÔNG phải stream đang live (R2).
- [ ] Predicate mốc mới phải viết **cụ thể**: ngày đọc = ngày đăng ký dim + 8, dimension name chính xác, và **%good tính riêng cho `/live/:id` với n ≥ 100**, kèm nhánh "CHƯA ĐỦ MẪU → +7 ngày, không sửa gì". PERF-05B đang trễ 4 ngày và vẫn chưa tick (`docs/milestones.md:16`) — đừng đẻ thêm một mốc chết cùng hình dạng.

---

## Phản biện độc lập (GPT-5.6)

Chạy qua `codex exec --sandbox read-only -c model_reasoning_effort=high`. Brief:
`../external/risk-gpt-prompt.md` (self-contained, model không đọc repo). Reply nguyên
văn: `../external/risk-gpt-reply.md`.

⚠️ **Panel chạy thiếu đúng model đã chỉ định**: `-m gpt-5.6` trả `400 invalid_request_error:
"The 'gpt-5.6' model is not supported when using Codex with a ChatGPT account"`. Đã re-run
trên model mặc định của tài khoản. Vẫn là vendor khác (OpenAI), vẫn phục vụ mục đích phá
blind spot chung của Claude, nhưng không phải đúng model được yêu cầu — ghi lại để không
ngầm hiểu sai.

### Đã xác minh trong repo (giữ lại)

- **`onCLS` document-scoped, `route` đóng băng lúc boot** → `pagePath` không phải nơi shift xảy ra. Xác minh: `src/lib/webVitalsRum.ts:259-264` (pageContext dựng 1 lần trong `initWebVitalsRum`), `:170` (`navigation_scope: "document"` — code tự khai). `initWebVitalsRum()` gọi 1 lần ở `src/main.tsx:16`. **ĐÚNG, và là finding mạnh nhất của cả pass này.**
- **web-vitals bắn lại CLS ở mỗi lần hidden → 457 row ≠ 457 lượt xem.** Xác minh: `package.json:78` → `"web-vitals": "^5.3.0"` (v3+ semantics: report on visibility hidden, report again nếu giá trị tăng). Không có dedup theo `metric_id` ở phía đọc. **ĐÚNG.**
- **Số học predicate.** Em tự tính lại độc lập từ `00-data-ga4-raw.txt`: good 148 / poor 291 / ni 18 = 457 ✓ (khớp %good 32,4% của PERF-05B). Cần 343 good → +195. Sửa trọn stream lớn nhất (179+10) → 337/457 = **73,74% → TRƯỢT** ✓. Toàn bộ live → 385/457 = **84,2%** ✓. Non-live 125/197 = **63,5%** ✓. **Bốn con số khớp tuyệt đối. ĐÚNG.**
- **`reportAllChanges` làm hỏng KPI.** Xác minh cơ chế: `buildWebVitalEvent` gán `metric_rating: metric.rating` (`:163`) và `sample_rate: 1` là literal không phải sampler (`:171`); `trackEvent` bắn thẳng gtag không throttle (`src/utils/ga.ts:33-42`). **ĐÚNG** — và nặng hơn GPT nói, vì nó **không revert được**.
- **Playwright inflate Presence.** Xác minh: `src/hooks/useLivePresence.ts:100-112` gọi `channel.track()` trong callback `SUBSCRIBED`, effect chạy khi `livestreamId && enabled` (`:225-244`) — **không phụ thuộc play**. GPT nói "starting playback activates the counter"; thực tế **chỉ cần mở trang là đã tự cộng viewer**, còn view counter mới cần play (`active: isVideoPlaying && !isGated`, `WatchLive.tsx:219-223`). Nghiêm trọng hơn GPT nghĩ.
- **Playwright `navigator.webdriver` tắt RUM** → `src/lib/webVitalsRum.ts:252`. **ĐÚNG.**
- **Bot UA của Playwright bị bot-guard chặn gtag** → `index.html:20` regex `/bot|crawl|spider|headless|lighthouse|slurp|bingpreview/i`; và `functions/_middleware.ts` import `BOT_UA` → trả prerender HTML thay vì SPA. **ĐÚNG cả hai vế.**
- **`debug_mode: true` hardcode prod + rủi ro developer-traffic filter** → `index.html:24`. Đã được ghi nhận độc lập là nợ tại `docs/milestones.md:19`. **ĐÚNG.**
- **gtag.js lazy → mất event của phiên bounce nhanh** → `index.html:34-39` (load trên `pointerdown`/`keydown`/`scroll` hoặc `setTimeout(…, 60000)`). Stub `window.gtag` được định nghĩa ngay (`:22`) nên `initWebVitalsRum` **không** bail; lệnh xếp hàng trong `dataLayer` và mất nếu document đóng trước khi script tới. **ĐÚNG** — và nó là cơ chế bias có hệ thống về phía phiên dài, tức về phía `/live`.
- **Khoá ChatPanel ở 400px = composer chui dưới bàn phím iOS** → `src/pages/WatchLive.tsx:375` (`keyboardHeight > 0 ? "h-[280px]" : "h-[400px]"`), hook `useKeyboardHeight`. **ĐÚNG**, nhánh đó tồn tại có lý do.
- **Reserve width tuỳ tiện làm wrap hàng metadata** → hàng đó là `flex flex-wrap items-center gap-4` (`WatchLive.tsx:390`). **ĐÚNG.**
- **Stale shell → chunk error sau deploy** → `vite.config.ts:153` (`globIgnores: ["**/index.html"]`) + NetworkFirst navigation, và `src/lib/chunkError.ts` tồn tại **chính vì** sự cố livestream 2026-07-19. **ĐÚNG.**

### Bác bỏ / chỉnh lại

- ❌ **"cls_shift_target sẽ high-cardinality và bị GA4 gộp vào (other)."** Sai ở quy mô này. Toàn bộ VN+mobile CLS trong 10 ngày là **457 event**; số selector khác nhau tối đa cũng chỉ vài chục, còn xa ngưỡng cardinality của GA4. Đây là lo lắng copy từ property lớn, không áp dụng cho ThePickleHub. Không đưa vào proposal như một rủi ro.
- ❌ **"A revert creates another version; it is not an instantaneous rollback for already loaded or cached clients."** Đúng về nguyên tắc nhưng GPT bỏ sót cơ chế phục hồi đã có: `src/lib/chunkError.ts` là single source of truth được dùng bởi **cả** window-level recovery trong `src/pwa.ts` **và** `ChunkErrorBoundary` trong `App.tsx`, ép reload thay vì để rơi vào error UI chung. Triệu chứng thật là **reload một lần** (đủ tệ khi đang xem trận — nên R3 vẫn RED), không phải "blank route or dead player" như GPT mô tả.
- ⚠️ **"Built-in pagePath can reflect the current SPA URL when the event is sent."** Không kiểm chứng được từ repo (phụ thuộc nội bộ gtag.js: `gtag('config', …)` chạy 1 lần với `send_page_view:false`, sau đó mỗi soft-nav bắn `page_view` kèm `page_location` — gtag có ghi đè page-context cho các event *sau đó* hay không là hành vi không tài liệu hoá rõ). Đã viết lại thành dạng **không phụ thuộc vào câu trả lời đó**: dù `pagePath` là trang vào hay trang thoát, nó **không** phải trang xảy ra shift, vì CLS là document-scoped và app này soft-nav. Kết luận giữ nguyên, luận cứ được siết lại.
- ⚠️ **"~12 dimensions" trong brief là con số em tự suy** (10 dims 21/07 + 2 dims 28/07 từ `docs/perf-05-report-2026-07-28.md:45-47`), **chưa xác nhận bằng GA4 Admin API** (SA của project đang disabled theo `docs/milestones.md:19`). Kết luận "còn xa trần 50" vẫn vững kể cả nếu con số thật gấp đôi, nhưng ghi rõ là ước lượng.
- ✅ Không có claim nào của GPT bịa ra file/API không tồn tại. Chất lượng pass này cao bất thường; phần lớn giá trị nằm ở việc nó **độc lập** dựng lại đúng bài toán attribution và **tự làm số học** ra cùng kết quả với em.

### GPT nói mà em muốn nhấn mạnh hơn nó

> "Poor CLS callbacks are heavily concentrated on documents reported while a `/live/*` URL is active."

Đó là câu duy nhất dữ liệu hiện có cho phép nói. `00-intake.md:20` viết "câu hỏi trung
tâm KHÔNG phải trang nào (đã biết: /live)" — **chưa biết**. Có một điểm em bênh
dữ liệu hơn GPT: nghi ngờ "bias theo 1 sự kiện đông" chỉ đúng một nửa. Poor
áp đảo ở **5 stream id khác nhau** (179 / 22 / 17 / 3 / 2 poor, đối lại tổng cộng
đúng 20 good — và cả 20 đều từ stream lớn). Tức tín hiệu **cấp trang** nhất quán,
không phải artifact của một buổi phát. Cái *không* có bằng chứng là **cấp phần tử**:
209/260 event live đến từ một stream, nên một fix chỉnh đúng cho profile của buổi đó
chưa chắc tổng quát hoá.
