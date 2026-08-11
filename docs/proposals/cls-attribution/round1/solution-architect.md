# solution-architect — cls-attribution (2026-08-09)

## Tóm tắt kiến trúc

Không có thay đổi kiến trúc: đây là bài toán *đo* rồi *chèn lại chỗ trống đã mất* trong ba
chỗ render bất đồng bộ ở tầng layout/`/live`, cộng với một thao tác cấu hình GA4 nằm ngoài
repo. Điểm mấu chốt em tìm được khi tự đọc file: `<ConnectDuprBanner />` được chèn **ngay
trên `{children}`** trong `src/components/layout/TheLineLayout.tsx:1052` và trả `null` cho
tới khi `useAuth` + `useDuprConnection` cùng settle — tức là mọi trang, mọi user đã đăng
nhập chưa link DUPR đều ăn một cú đẩy toàn khung xuống ~56-80px sau khi paint. Hai suspect
còn lại nằm gọn trong `src/pages/WatchLive.tsx` (đổi class chiều cao chat theo
`keyboardHeight`, và span viewer-count chèn vào hàng `flex-wrap`), cả ba đều sửa được bằng
diff âm JS nên không đụng budget.

**Ràng buộc đã kiểm chứng, không phải giả định:**

- Bundle: cả ba fix đều là đổi/xoá markup + CSS, **0 KB dependency mới**, không cần
  lazy-load. `docs/perf-budgets.md` INITIAL ~265/280, CODE ~1455/1800 — không đụng tới.
- SSR: **không có route công khai mới**. Không cần handler trong `functions/_lib/render/`,
  không đụng sitemap, không đổi cặp hreflang. Ba fix chỉ đổi DOM sau hydrate.
- Song ngữ: chuỗi VI/EN của banner DUPR và viewer-count đã tồn tại sẵn
  (`ConnectDuprBanner.tsx` inline VI/EN, `t.live.watching`) — không thêm chuỗi mới.
- Risk tier: **không** đụng auth, payments, `supabase/config.toml`. Đăng ký custom dimension
  GA4 là thao tác console, không phải code. → GREEN/YELLOW, không cần sign-off RED.

---

## Bằng chứng em tự mở file để kiểm (không lấy lại từ recon)

### 1. Banner DUPR chèn trên toàn bộ nội dung — nghi phạm cross-page mạnh nhất

`src/components/layout/TheLineLayout.tsx` (thứ tự render):

```
<ConnectDuprBanner />   // ~:1052
{children}              // ~:1054
```

`src/components/dupr/ConnectDuprBanner.tsx:41-43`:

```tsx
if (loading || connLoading || dismissed) return null;
if (!user) return null;
if (conn?.ssoConnected) return null;
```

→ First paint: `null`. Sau khi auth restore + query `useDuprConnection` xong: chèn một
`<div>` grid `padding: "12px 20px"` + 2 border vào **đầu document flow**, đẩy toàn bộ
viewport xuống. Impact fraction ≈ 1.0 (gần như mọi thứ đang thấy đều dịch), distance
fraction ≈ 60-80/viewport → shift score ~0.07-0.10 **cho mỗi lần load trang, mọi route**.

Điều này khớp rất sát với hình dạng data: `/login` **90 good / 15 poor** (khách chưa đăng
nhập → `!user` → banner không bao giờ render → sạch), còn `/` **37 poor / 15 good** và
`/live/<id>` bẩn (khán giả live phần lớn đã đăng nhập vì có livestream gate + chat).
Banner có từ 2026-05-25 (`18a3b559`), tức là mãn tính — khớp với việc PERF-05 đã thấy 0.67
từ 28/07, trước cửa sổ data hiện tại.

### 2. Chat đổi chiều cao theo bàn phím ảo — nghi phạm tích luỹ trong phiên

`src/pages/WatchLive.tsx:375`:

```tsx
className={keyboardHeight > 0 ? "h-[280px]" : "h-[400px]"}
```

`src/hooks/useKeyboardHeight.ts` đăng ký `vv.addEventListener("scroll", update)` và
`vv.addEventListener("resize", update)`, tính
`diff = baselineHeightRef.current - (vv.height + vv.offsetTop)` với ngưỡng
`diff > 80`. Trên iOS Safari, thanh địa chỉ trên + toolbar dưới co/giãn khi cuộn tổng cộng
~85-100px → **`diff > 80` có thể bật do cuộn trang, không phải do bàn phím**. Khi đó chiều
cao chat nhảy 400→280 = 120px đẩy toàn bộ nội dung phía dưới, và **cuộn không phải là
"recent input"** theo spec CLS (chỉ có input rời rạc mới set `hadRecentInput`) → shift này
được tính đủ. Trên Chrome Android address bar ~56px < 80 nên không dính — giải thích được
tại sao nó không xuất hiện đồng đều.

Phụ trợ: `src/pages/WatchLive.tsx:78-93` set `document.body.style.touchAction = "none"` khi
`keyboardHeight > 0` — false positive này còn khoá cuộn trang, là bug UX riêng.

### 3. Span viewer-count chèn vào hàng flex-wrap

`src/pages/WatchLive.tsx:420-431` — `{isConnected && concurrentViewers > 0 && (<span …>)}`
nằm trong `div className="flex flex-wrap items-center gap-4 …"` cùng link organization +
avatar + tổng view + ngày giờ. Presence kết nối sau ~1-2s → chèn thêm một item vào hàng
đã gần đầy trên màn hình hẹp → hàng xuống 2 dòng → mọi thứ dưới đó dịch ~20-24px.
`src/hooks/useLivePresence.ts:220` `setConcurrentViewers` chạy trên **mỗi** presence sync
(join/leave), nên nếu số người xem dao động quanh ranh giới wrap, cú shift này lặp lại
nhiều lần trong một phiên dài — đúng dạng tích luỹ mà PERF-05 nghi.

### 4. Cái em kiểm và thấy **không** phải thủ phạm

- Khung player mobile lẫn desktop đều `aspect-video` cố định
  (`WatchLive.tsx:276`, `:316`); `PreviewCountdown` / `GeoBlockOverlay` /
  `LivestreamGateOverlay` đều `absolute inset-0` → không đổi hộp.
- Chat desktop `h-[500px]` cố định (`:562`); chat mobile mặc định collapsed
  (`useState(true)`, `:39`) → mở chat là user-initiated, CLS loại trừ trong 500ms.
- Font: `index.html:56-63` — subset **Vietnamese** dùng `font-display:swap` (đổi từ
  `optional` ở `1d215033`, 06/08) và cả hai file Geist đều được `<link rel=preload>`
  (`index.html:86-89`). Preload + swap → FOUT rất ngắn, khó là nguồn 0.67; nhưng đây là
  thay đổi *mới trong cửa sổ data*, nên phải giữ trong danh sách theo dõi chứ không loại hẳn.

### 5. Hạ tầng đo đã có sẵn hơn recon nói

`playwright.config.ts:16-17` chạy mặc định với `PLAYWRIGHT_BASE_URL ?? "https://www.thepicklehub.net"`
— tức là **Playwright ở repo này vốn đã trỏ vào prod**, có sẵn project `mobile-chromium` +
`mobile-webkit`. Một spec CLS không cần dựng môi trường local nào cả; chỉ cần
`page.addInitScript` cài `PerformanceObserver({type:"layout-shift", buffered:true})`.
Đây là lý do Option B rẻ hơn nhiều so với dự đoán ban đầu.

**Cảnh báo cho người viết fix:** `src/pages/WatchLive.tsx` và
`src/components/video/MuxPlayer.tsx` đang có diff WIP chưa commit trên nhánh
`wip/native-chat-and-news-rewrite`. Fix phải rebase off `main`, không đắp lên WIP này.

---

## Option A — Đo bằng field data trước, sửa sau (GA4-first)

**Effort:** 0.25 nửa ngày (đăng ký dims) + 0.5 (đọc & viết kết luận sau 7 ngày) + 2 (sửa)
= **~2.75 nửa ngày công**, nhưng **7-10 ngày wall-clock** trước khi dòng fix đầu tiên chạm prod.

**Files:** không đổi code ở bước 1. Bước 3 mới đụng
`src/components/dupr/ConnectDuprBanner.tsx`, `src/components/layout/TheLineLayout.tsx`,
`src/pages/WatchLive.tsx`, `src/hooks/useKeyboardHeight.ts`.

**Data:** không migration, không RLS, không RPC. Chỉ đăng ký 2 custom dimension
event-scoped trong GA4 property `p522556358`: `cls_shift_target`, `cls_load_state`
(và cân nhắc `route` — hiện cũng chưa đăng ký, xem `00-data-ga4-raw.txt:11-12`).

**How it works:** Client đã gửi sẵn hai param từ #502
(`src/lib/webVitalsRum.ts:175-185`, cắt 100 ký tự). Đăng ký dimension → GA4 bắt đầu thu từ
thời điểm đăng ký, không hồi tố. Sau ~7 ngày, query Data API
`customEvent:cls_shift_target × metric_rating` lọc VN+mobile → ra bảng selector thật →
sửa đúng phần tử.

**Wins:** Không sửa mù. Có bằng chứng field từ chính thiết bị người Việt, gồm cả WebView
native. Nếu thủ phạm là thứ không ai đoán ra (một component thứ ba, một ad-hoc script),
chỉ cách này thấy được.

**Loses:** 7-10 ngày nữa origin vẫn Failed CWV. Và — điểm yếu kỹ thuật thật sự —
`largestShiftTarget` chỉ nêu **một** shift lớn nhất của phiên. Nếu giả thuyết PERF-05
đúng (CLS 0.67 = tổng của hàng chục shift nhỏ tích trong phiên dài), GA4 sẽ trả về
selector của cú lớn nhất, có thể chỉ chiếm 10% tổng điểm, và dẫn Cuong sửa nhầm chỗ với
sự tự tin sai. `web-vitals` mặc định không dùng `reportAllChanges`
(`src/lib/webVitalsRum.ts:285` gọi `onCLS(report)` trần) nên ta cũng không thấy phân bố.

**Forecloses:** Đóng cửa việc ship fix trong sprint này. Cũng tạo tiền lệ "mọi CLS phải
chờ field data" — với nhịp một người thì đó là cái phanh vĩnh viễn.

---

## Option B — Harness Playwright đo layout-shift trên prod, rồi sửa theo tên nó chỉ

**Effort:** 2 (harness) + 1 (chạy & phân loại) + 2 (sửa) = **~5 nửa ngày**.

**Files:**
- thêm `tests/cls.spec.ts` (~90 dòng)
- thêm `tests/helpers/cls-probe.ts` — init script cài `PerformanceObserver`, gom
  `entry.value` + `entry.sources[].node` → selector, xếp hạng
- sửa `playwright.config.ts` — thêm project `cls` (`testMatch: /cls\.spec\.ts/`,
  device Pixel 7 + iPhone 14)
- sau đó là 3 file fix như Option A

**Data:** không có gì. Thuần client.

**How it works:** `page.addInitScript` cài observer trước khi app boot. Spec kịch bản hoá
một phiên mobile thật trên prod: load `/` → cuộn → điều hướng sang `/live/<id>` → cuộn →
mở chat → focus ô nhập (kích bàn phím ảo qua `page.setViewportSize` thu nhỏ để giả lập) →
chờ 30s. Cuối cùng dump bảng `{value, node.outerHTML.slice(0,120)}` xếp giảm dần. Chạy
`PLAYWRIGHT_BASE_URL=<preview> npm run e2e -- --project=cls` để so trước/sau fix.

**Wins:** Trả lời **hôm nay**, không phải tuần sau. Đo được cả `sources` (nhiều node),
không chỉ node lớn nhất — vá đúng điểm yếu của Option A. Tái dùng được cho mọi lần CLS
tái phát về sau, và là công cụ verify before/after cho chính các fix ở Option C.
Hạ tầng đã sẵn: Playwright trỏ prod mặc định, có project mobile-chromium/mobile-webkit.

**Loses:** Không tái tạo được phần "phiên dài, presence dao động, chat chạy" trừ khi có
livestream đang phát thật. Với stream đã kết thúc, `useLivePresence` bị tắt
(`isLiveStatus` false) → mất đúng nhánh nghi ngờ nhất. Muốn đủ, Cuong phải tạo một
livestream test và mở 2 browser context để kích presence join/leave — thêm ~1 nửa ngày và
phải làm đúng lúc rảnh. Headless Chromium cũng không mô phỏng đúng hành vi thanh địa chỉ
iOS Safari — nghi phạm #2 gần như chắc chắn **không** bắt được bằng harness này.

**Forecloses:** Không đóng gì đáng kể. Rủi ro thật là harness thành một CI gate nữa
phải nuôi — repo đã có 8 cron workflow đang tắt vì Actions budget. Nếu làm, làm **dev
tool chạy tay**, đừng cắm vào CI.

---

## Option C — (rẻ) Sửa ba chỗ đã nhìn thấy trong code, đăng ký dims ngày 0, đọc verdict cùng một mốc

**Effort:** 0.25 (dims) + 0.5 (banner) + 0.5 (chat height) + 0.25 (viewer span) +
0.5 (test ghim + verify tay iPhone) = **~2 nửa ngày**. Verdict đọc **cùng ngày** với
Option A vì dims cũng được đăng ký ở ngày 0.

**Files:**
- `src/components/dupr/ConnectDuprBanner.tsx` — chuyển sang `position: fixed` đáy màn hình
  (trên `BottomNav`), bỏ khỏi document flow. VI/EN đã có sẵn trong file.
- `src/components/layout/TheLineLayout.tsx:1052` — giữ nguyên vị trí gọi (component tự
  fixed nên không còn chèn flow); thêm biến `--tl-dupr-banner-h` nếu cần padding đáy tĩnh.
- `src/pages/WatchLive.tsx:375` — bỏ ternary `keyboardHeight > 0 ? "h-[280px]" : "h-[400px]"`
  → chiều cao cố định; để trình duyệt tự `scrollIntoView` ô nhập khi focus.
- `src/hooks/useKeyboardHeight.ts:41` — nâng ngưỡng `diff > 80` → `diff > 150` để address
  bar iOS không giả làm bàn phím (đồng thời hết bug khoá `touchAction` sai ở
  `WatchLive.tsx:78-93`).
- `src/pages/WatchLive.tsx:420-431` — bọc viewer-count trong span luôn render khi `isLive`,
  `min-w-[10ch] inline-flex`, nội dung rỗng cho tới khi `isConnected` → chèn số không đổi
  hình học hàng.
- `src/lib/__tests__/layout-stability-surfaces.test.ts` — mở rộng theo đúng pattern có sẵn,
  ghim: banner DUPR không nằm trong flow, `h-[400px]` không có nhánh điều kiện,
  `min-w-[10ch]` trên viewer span. Hiện file này **không** phủ WatchLive/ChatPanel/Login.

**Data:** không migration, không RLS, không RPC. Chỉ 2 custom dimension GA4 (console).

**Bundle:** ròng **âm** (xoá một ternary, xoá nhánh state). Không dependency mới.

**How it works:** Cả ba fix đều **đúng một cách độc lập với data** — "đừng chèn nội dung
vào flow sau khi đã paint" là quy tắc, không phải phỏng đoán. Dims đăng ký ngày 0 nên nếu
%good vẫn <75 ở lần đọc PERF-05B kế tiếp, ta đã có sẵn field data cho vòng 2 — **không mất
một ngày nào** so với Option A.

**Wins:** Rẻ nhất. Cùng ngày verdict với A nhưng đã có fix trên prod trong lúc chờ.
Ba fix đều reversible bằng revert một file. Không tạo tooling phải nuôi.

**Loses:** Không biết mỗi fix đóng góp bao nhiêu. Nếu %good chỉ nhích lên 55%, ta biết
"chưa đủ" nhưng không biết "còn thiếu cái gì" — phải chờ dims (đúng cùng thời điểm A).
Banner fixed đáy che ~56px viewport dưới, và `h-[400px]` cố định có thể để ô nhập chat
nằm dưới bàn phím trên máy màn hình nhỏ (iPhone SE) — hai trade-off UX thật, phải test tay.

**Forecloses:** Gần như không. Nếu banner fixed bị chê, đổi lại là một file. Rủi ro thật
là làm "loãng" tín hiệu: sau khi sửa 3 chỗ, field data 7 ngày tới sẽ phản ánh trạng thái
**đã sửa**, nên nếu muốn biết cụ thể chỗ nào từng gây bao nhiêu thì mất cơ hội đó vĩnh
viễn. Em cho là cái giá đó chấp nhận được — mục tiêu là %good ≥75, không phải một bài
nghiên cứu.

---

## Khuyến nghị

**Option C**, kèm nguyên bước đăng ký dims của Option A ở ngày 0.

**A thua** không phải vì thiếu chặt chẽ mà vì nó **không mua được gì bằng 7 ngày chờ**:
dims được đăng ký ở cả hai phương án cùng lúc, nên A và C có chung ngày đọc verdict — A
chỉ khác ở chỗ nó *không ship gì* trong 7 ngày đó. Thêm nữa `largestShiftTarget` chỉ nêu
một node; với giả thuyết tích luỹ phiên dài (chính giả thuyết đang đứng), field data có
thể chỉ sai chỗ một cách rất thuyết phục.

**B thua** vì nghi phạm mạnh nhất của em — false positive `keyboardHeight` từ thanh địa chỉ
iOS Safari — **về nguyên tắc không tái tạo được** trong Chromium/WebKit headless, và nghi
phạm số hai (presence dao động) cần một livestream đang phát thật. Bỏ 5 nửa ngày cho một
harness bắt được có lẽ mỗi banner DUPR — thứ em đã đọc ra được từ code trong 20 phút — là
đầu tư sai thời điểm. B không sai, nó chỉ **chưa tới lượt**: để dành làm bước leo thang
nếu C không đạt.

Nếu buộc phải chọn *một* thứ để làm và bỏ hết phần còn lại: sửa
`ConnectDuprBanner` + `TheLineLayout:1052`. Đó là fix duy nhất giải thích được đồng thời
cả `/`, `/live/<id>` bẩn **và** `/login` sạch.

---

## Increments

1. **Ngày 0, ~15 phút — đăng ký 2 (nên là 3) custom dimension GA4** event-scoped:
   `cls_shift_target`, `cls_load_state`, `route`. Làm ngay bất kể chọn phương án nào; nó
   miễn phí và không hồi tố nên mỗi ngày trì hoãn là một ngày data mất vĩnh viễn.
   *Verify:* chạy lại đúng query đã sinh ra `00-data-ga4-raw.txt` — lỗi
   `not a valid dimension` phải biến mất (giá trị ban đầu có thể toàn `(not set)`, bình thường).

2. **INC1 — `ConnectDuprBanner` ra khỏi document flow.** File đơn, revert dễ.
   *Verify:* mở `/` đã đăng nhập (tài khoản chưa link DUPR) trên DevTools mobile, bật
   Performance → Layout Shift Regions; không được có vùng shift nào ở lần banner xuất hiện.
   Cộng thêm một assertion trong `src/lib/__tests__/layout-stability-surfaces.test.ts`.

3. **INC2 — `WatchLive.tsx:375` bỏ ternary chiều cao + `useKeyboardHeight.ts` ngưỡng
   80→150.** *Verify:* **bắt buộc test tay trên iPhone Safari thật** (không phải simulator):
   mở `/live/<id>`, bung chat, cuộn lên xuống cho thanh địa chỉ co/giãn — chat không được
   đổi chiều cao, trang không được khoá cuộn. Rồi focus ô nhập, kiểm ô nhập vẫn thấy được.

4. **STOP-AND-LOOK ở đây.** INC1+INC2 là ~1.5 nửa ngày và phủ hai nghi phạm lớn nhất.
   Đo lại trước khi làm tiếp.

5. **INC3 — viewer-count span giữ chỗ.** Nhỏ, gộp chung PR với INC2 cũng được.

6. **T+7 ngày — đọc predicate PERF-05B** (VN+mobile, CLS, %good). ≥75% → đóng.
   <75% → lúc này `cls_shift_target` đã có data thật; **khi đó** mới quyết định có bỏ
   5 nửa ngày cho harness Option B hay chỉ cần sửa thêm theo tên GA4 chỉ ra.

7. **Chưa làm:** `/login` (15 poor / 90 good — 86% đã good, không đáng động vào một trang
   auth). `src/pages/Login.tsx:283-306` spinner→form swap có thật, nhưng volume quá thấp để
   trả cho rủi ro đụng luồng đăng nhập.

---

## Điều em không chắc

1. **Tỉ lệ user đã-đăng-nhập-chưa-link-DUPR trong 457 event kia** — nếu đa số người xem
   `/live` là khách ẩn danh, INC1 gần như không đóng góp gì, và toàn bộ lập luận
   "banner giải thích `/login` sạch" sụp. Đây là số **kiểm được ngay** bằng một query GA4
   `pagePath × auth_state` (dimension `auth_state` đã đăng ký — xem gợi ý của Data API ở
   `00-data-ga4-raw.txt:9`). Em không chạy vì phạm vi được giao là thiết kế, nhưng nếu
   orchestrator muốn tăng độ chắc trước khi code thì đây là 10 phút đáng bỏ nhất.
2. **Ngưỡng thanh địa chỉ iOS Safari** — em suy ra `>80px` bị vượt từ con số 44+44 phổ
   biến, không đo trên máy thật. Nếu Safari VN chỉ co ~60px thì INC2 sửa một bug không tồn tại
   (vô hại, nhưng không phải thủ phạm). Số 150 em chọn cũng là ước lượng, chưa hiệu chỉnh.
3. **Tỉ lệ user bung chat trên mobile** — chat mặc định collapsed (`WatchLive.tsx:39`).
   Nếu ít người bung thì INC2 không thể là nguồn của 179 poor trên một stream, dù nó
   vẫn là bug đáng sửa.
4. **Phân bố shift của phiên 0.67** — em không biết đó là 1 cú lớn hay 40 cú nhỏ. Toàn bộ
   ưu tiên của em (banner one-shot vs keyboard lặp lại) sẽ đảo nếu biết con số này.
   `onCLS(report, {reportAllChanges: true})` ở `src/lib/webVitalsRum.ts:285` sẽ trả lời,
   nhưng nó nhân số event GA4 lên nhiều lần — em cố tình **không** đề xuất, đây là mục
   để orchestrator cân.
5. **Em chỉ đọc 2 nhánh điều kiện trong `TheLineLayout.tsx`** (`:532` `!user` auth pills,
   `:1024` `user` sign-out) và `ConnectDuprBanner`. File dài 1000+ dòng; có thể còn chỗ
   chèn-sau-paint khác em chưa thấy. `BottomNav.tsx` và `ChatFAB.tsx` em chưa mở.
6. **Font `swap` trên subset Vietnamese** (`index.html:56,58,62`, đổi 06/08 ở `1d215033`)
   — em xếp là khó gây 0.67 vì có preload, nhưng em **không loại trừ** được và nó là thay
   đổi mới nằm trong cửa sổ data. Nếu %good sau INC1-3 không nhích, đây là chỗ nhìn kế tiếp.
7. **WebView native**: ba fix đều là DOM/CSS nên tự động áp cho native (dùng remote URL),
   nhưng `useKeyboardHeight` chạy khác trong WKWebView — đổi ngưỡng 80→150 **có thể làm
   native không còn nhận ra bàn phím**. Cần Cuong test một lượt trên app iOS thật, không
   chỉ Safari.
