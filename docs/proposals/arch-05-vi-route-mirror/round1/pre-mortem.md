# Pre-mortem: arch-05-vi-route-mirror

Feature ĐÃ ship 3 tuần trước và ĐÃ hỏng. Đây không phải "có rủi ro không" — đây là
tường thuật lại chuyện đã xảy ra, mỗi mắt xích trỏ một dòng code thật. Đọc trước:
`docs/proposals/arch-05-vi-route-mirror/round1/idea-recon.md` (đã verify counts),
memory `prod-outage-hashed-filename-collision`.

Bối cảnh chung mà cả 3 sự cố dựa vào (fact, không phải giả thuyết):
- **Bot prerender tách rời khỏi React Router.** `functions/_middleware.ts:184` cắt tiền
  tố `/vi` bằng regex trên URL string rồi gọi `renderX(..., lang)` — nó KHÔNG đọc bảng
  route của `src/App.tsx`. Nên mọi thứ Googlebot thấy vẫn đúng dù client route hỏng.
- **`tests/seo.spec.ts` curl bằng Googlebot UA** → đi vào đúng cái prerender đó, không
  chạm SPA. `tests/smoke.spec.ts:160` (`SCROLL_ROUTES = ["/", "/tournaments", "/vi"]`) và
  `tests/visual.spec.ts:46` (`{ name: "home-vi", path: "/vi" }`) mỗi cái chỉ chạm **/vi
  home**. 62/63 route `/vi/*` còn lại: zero automated coverage ở góc nhìn user thật.
- Audience 95% là user VN — phần lớn traffic thật đi qua đúng cụm route này.

---

### Sự cố 1 — "Trang giải VI /vi/tournament/<slug> trả trang 'Không tìm thấy' cho user VN suốt 18 ngày, trong khi Google vẫn xếp hạng và đẩy traffic vào đó"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** ~2-3 tuần (chỉ một user chịu khó báo)

**Timeline**
- T+0 (deploy): 63 entry `/vi/*` được chép tay từ JSX sang route-config array. Một entry
  rơi rụng — `/vi/tournament/:slug` (hiện `src/App.tsx:750`) — hoặc param bị gõ lệch
  (`:slug` → `:id`). Build xanh, PR merge, Cloudflare deploy prod.
- T+0: mọi gate xanh (xem dưới). Không ai nghi ngờ gì.
- T+2 ngày: user VN mở link `/vi/tournament/<slug>` share trong nhóm Zalo giải đấu → rơi
  vào `<Route path="*" element={<NotFound />} />` (`src/App.tsx:789`) → thấy trang "Không
  tìm thấy". Đa số nghĩ "chắc BTC xoá giải rồi", đóng tab, không báo.
- T+18 ngày: một BTC nhắn Facebook page "sao link giải bên mình bằng tiếng Việt lại 404,
  bản tiếng Anh vẫn vào được?". Cuong mới biết.

**Cơ chế**
`src/App.tsx:750` (`/vi/tournament/:slug` → `ViLanguageWrapper > ConditionalAuth >
TournamentDetail`) bị bỏ sót khi flatten 63 entry → route không tồn tại trong config →
request khớp catch-all `src/App.tsx:789` → `NotFound`. Không exception, không log, HTTP
200 (SPA shell). EN `/tournament/:slug` (`src/App.tsx` cluster EN) vẫn còn nên "một nửa
site vẫn chạy" → càng khó ngờ.

**Vì sao mọi gate vẫn xanh**
- `quality.yml` (lint · typecheck · unit · build · bundle budget): thiếu một phần tử
  trong array là TypeScript hợp lệ hoàn toàn — không có gì để fail.
- `tests/smoke.spec.ts` + `tests/visual.spec.ts`: chỉ chạm `/vi` home, không chạm
  `/vi/tournament/:slug`.
- `tests/seo.spec.ts`: curl bằng Googlebot UA → trúng `functions/_middleware.ts:184`
  `renderTournament(..., "vi")` đọc URL string, **không** phụ thuộc React Router → trả
  200 + title + hreflang đúng. Test xanh.
- **Đây là chỗ chí mạng:** chính cái đặc tính "prerender decoupled → refactor an toàn cho
  SEO" (idea-recon §6) là thứ **làm mù toàn bộ kiểm thử**. Googlebot thấy trang hoàn hảo,
  index nó, tiếp tục xếp hạng, tiếp tục đẩy user VN vào — và user VN là người duy nhất
  chạm client router, nơi route đã biến mất. GSC "Coverage" xanh lè vì bot luôn 200.

**Ai báo, sau bao lâu**
Không phải CI, không phải GSC, không phải Cuong. Một BTC/user VN báo qua Facebook/Zalo sau
~2-3 tuần. Traffic thật bị Google đổ vào một trang 404-nội-dung mà mọi dashboard đều báo
"khoẻ".

**Vì sao khó sửa**
Revert route thì dễ (thêm lại 1 dòng). Cái khó là **không biết còn sót entry nào nữa** —
không có danh sách đối chiếu tự động, phải dò tay 63 route. Và uy tín: link giải đã share
đi khắp nhóm chat, mỗi cú 404 là một BTC nghĩ site hỏng. `git revert` lấy lại route, không
lấy lại niềm tin của BTC đã bỏ đi.

**Dấu hiệu sớm lẽ ra phải có**
Một test parity: "config sinh ra đúng 63 route `/vi/*`, mỗi cái strip `/vi` khớp một EN
path đã biết" — idea-recon §1 đã tính sẵn tập này (strip `/vi` → khớp EN, 0 mismatch).
Không ai viết nó vì "routing thì có bao giờ hỏng". Dấu hiệu thứ hai lẽ ra có: GSC "Crawled
– currently not indexed" tăng — nhưng bot vẫn 200 nên GSC im.

---

### Sự cố 2 — "Bài blog và tin tức bản tiếng Việt hiện ra bằng tiếng Anh ở /vi/blog và /vi/news; 3 tuần sau GSC + Ahrefs bắt đầu cảnh báo 'hreflang and HTML lang mismatch' và thứ hạng VI trượt"
**Xác suất:** TB · **Thời gian tới lúc phát hiện:** 3-5 tuần (SEO tool trễ, không ai soi client)

**Timeline**
- T+0 (deploy): khi flatten config, tác giả "dọn cho gọn" mấy chỗ lệch: bỏ prop
  `language="vi"` khỏi News (coi như "cùng component, wrapper lo ngôn ngữ") và map
  `/vi/blog/:slug` về đúng `BlogPost` như EN thay vì `ViBlogPost`. Trông "sạch" hơn.
- T+0: mọi gate xanh.
- T+0..: user VN hard-load `/vi/blog/<slug>` vẫn có vẻ ổn ở lần tải cứng (do
  `getInitialLanguage` set "vi") nhưng **nội dung** thân bài là bản EN vì render sai
  component. User đọc lướt, tưởng "bài này chưa dịch".
- T+3 tuần: Ahrefs/GSC crawl JS-render, chụp DOM ở first paint thấy `document.
  documentElement.lang="en"` trên trang tự khai `hreflang="vi"` → gắn cờ "Hreflang and
  HTML lang mismatch" hàng loạt URL `/vi/*`. Thứ hạng VI của cụm blog/news trượt dần.
- T+4-5 tuần: Cuong xem Ahrefs, thấy impressions VI giảm, lần ra.

**Cơ chế**
- `src/App.tsx:664` `/blog/:slug` → `BlogPost` **vs** `src/App.tsx:755` `/vi/blog/:slug`
  → `ViBlogPost`. Đây là **cặp duy nhất dùng 2 component khác nhau** (idea-recon §2). Nếu
  config coi mọi cặp EN/VI là "cùng component", `/vi/blog/:slug` render `BlogPost` → nội
  dung EN tại URL VI.
- `src/App.tsx:655` `/news` (không prop, tự dò locale) vs `src/App.tsx:752` `/vi/news`
  → `News language="vi"` vs `src/App.tsx:753` `/vi/news/:slug` → `NewsArticle
  language="vi"`. Cái prop `language="vi"` làm component đúng ngôn ngữ ngay **first
  render**. Bỏ prop → first paint phụ thuộc context i18n, mà `ViLanguageWrapper`
  (`src/components/layout/ViLanguageWrapper.tsx:15-29`) chỉ set "vi" trong `useEffect`
  **sau paint đầu**. Với user không-VN điều hướng SPA từ `/news` (đã tự dò "en") sang
  `/vi/news`: render đầu ra EN → effect flip vi → nháy sang VI. Với crawler chụp nhanh:
  `document.documentElement.lang` còn "en" ở đúng khoảnh khắc đó — chính cái mismatch mà
  comment `ViLanguageWrapper.tsx:19-23` nói nó sinh ra để chống.

**Vì sao mọi gate vẫn xanh**
- `seo.spec.ts` curl Googlebot → prerender `renderViBlog` / `renderNews` với `lang="vi"`
  vẫn trả HTML VI hoàn hảo. Bot không chạm component `BlogPost`/`News` phía client. Xanh.
- typecheck: `BlogPost` và `ViBlogPost` cùng nhận `:slug` — đổi component không sai kiểu.
  Bỏ prop `language` nếu nó optional cũng không sai kiểu.
- smoke/visual: chỉ `/vi` home, không mở `/vi/blog/<slug>` hay `/vi/news`.
- Không có test nào so **nội dung client** với **nội dung prerender** cho cùng URL.

**Ai báo, sau bao lâu**
GSC/Ahrefs (không phải CI) sau 3-5 tuần, dưới dạng cờ hreflang mismatch + tụt hạng — tín
hiệu chậm và dễ đổ cho "thuật toán Google". Vài user VN có thể tưởng "bài chưa dịch" và
không báo.

**Vì sao khó sửa**
Sửa code dễ (trả lại prop + `ViBlogPost`). Nhưng thiệt hại SEO đã tích luỹ: Google đã
crawl và hạ tín nhiệm một loạt URL VI trong nhiều tuần; phục hồi ranking mất thêm nhiều
tuần re-crawl, không `git revert` phát là về. Đây là kiểu "âm thầm sai dữ liệu 3 tuần" ăn
mòn niềm tin — tệ hơn một sập-ngay-thấy-liền.

**Dấu hiệu sớm lẽ ra phải có**
Một assertion parity nội-dung: hard-load (browser thật, KHÔNG bot UA) `/vi/blog/<slug>`
rồi assert `document.documentElement.lang==="vi"` + một chuỗi tiếng Việt đã biết xuất hiện.
Không ai viết vì mọi "SEO test" hiện có đều đi cửa bot — không cửa nào soi user thật.

---

### Sự cố 3 — "Home/Tournaments/Feed âm thầm rơi khỏi PWA precache; cold-start và mở app offline trên mạng yếu VN chậm hẳn, không alert nào nổ"
**Xác suất:** TB-thấp · **Thời gian tới lúc phát hiện:** có thể không bao giờ tự phát hiện (chỉ lộ khi soi Lighthouse hoặc user than "app mở chậm")

**Timeline**
- T+0 (deploy): để DRY 63+ dòng `lazyRetry(() => import("./pages/X"))`, refactor đổi cách
  nạp component (barrel re-export, helper bọc chung, hoặc map động) → Rollup đặt lại
  `[name]` của chunk. Chunk trang chủ không còn tên `Index-*.js` mà thành tên khác (vd
  `routes-*.js` gộp, hoặc hash-only).
- T+0: build xanh, **bundle budget xanh** (chunk vẫn tách lazy, tổng gz không đổi), deploy.
- T+0..: SW mới `sw-v3.js` activate ngay (`skipWaiting`/`clientsClaim`,
  `cleanupOutdatedCaches: true` — `vite.config.ts:136-139`) → xoá precache cũ, nạp
  precache mới **thiếu** home/tournaments/feed. Vì mấy trang này vẫn network-first nên
  **vẫn mở được khi online** → không ai thấy gì.
- T+ nhiều tuần: user VN mạng 3G yếu / mở lại app offline: trước đây có bản precache bung
  ra tức thì, giờ phải chờ fetch network-first (timeout 3s) + spinner. Chậm, nhưng rời
  rạc, không ai quy được về deploy nào.

**Cơ chế**
`vite.config.ts:104-124` — `workbox.globPatterns` là **whitelist theo TÊN chunk**:
`"assets/Index-*.js"`, `"assets/Tournaments-*.js"`, `"assets/Feed-*.js"`,
`"assets/SocialEventDetail-*.js"`, `"assets/CreateSocialEvent-*.js"`. Tên này đến từ
`chunkFileNames: "assets/[name]-[hash].js"` (`vite.config.ts:289-292`), với `[name]` =
basename module của lazy import. Refactor đổi đường import → `[name]` đổi → patt
`Index-*` khớp **0 file**. `globPatterns` không-khớp **không phải lỗi** — workbox chỉ
lặng lẽ precache ít file hơn. Kết quả: 5 màn "north-star" (PERF-03) rụng khỏi install
precache mà không một dòng cảnh báo nào.

**Vì sao mọi gate vẫn xanh**
- Bundle budget (`scripts/check-bundle-size.mjs`, `BUNDLE_BUDGET_KB=1970`): đo TỔNG gz JS
  trong `dist/`. Chunk vẫn tồn tại, vẫn lazy, tổng không đổi → xanh. (Nếu refactor lỡ
  biến 129 page thành static import gộp một mega-chunk thì budget sẽ ĐỎ và chặn được —
  nhưng bản ship khéo giữ `() => import()` nên budget mù với việc chunk bị đổi TÊN.)
- Không có assertion nào kiểm "mỗi globPattern trong whitelist khớp ≥1 file". Đây là điểm
  mù duy nhất và không gate nào cover.
- smoke/visual/seo: không cái nào kiểm nội dung service worker precache manifest.
- Lighthouse (`lighthouse.yml`) đang đỏ repo-wide sẵn (memory `lighthouse-ci-failing`) →
  một regression PWA/perf mới chìm nghỉm trong nền đỏ có sẵn.

**Ai báo, sau bao lâu**
Gần như không ai. Không outage (online vẫn chạy), không exception. Chỉ lộ nếu Cuong tình
cờ soi `dist/sw-v3.js` manifest, hoặc một user để ý "app mở chậm hơn trước". Có thể ẩn vô
thời hạn.

**Vì sao khó sửa**
Sửa dễ (đổi lại pattern hoặc giữ tên chunk). Cái khó là **nhận ra nó tồn tại** — không
tín hiệu, không log, không alert. Đây KHÔNG phải outage hashed-filename cũ (memory
`prod-outage-hashed-filename-collision`): outage đó nay đã được BUILD_ID (`vite.config.
ts:19,285`) + guard asset-404 trong `_middleware.ts` chặn. Class đó đã bịt; cái mới là
regression **im lặng của whitelist**, đúng loại checklist không có ô để tick.

**Dấu hiệu sớm lẽ ra phải có**
3 dòng trong `check-bundle-size.mjs` (hoặc một step CI): với mỗi pattern boot-critical
trong `globPatterns`, assert nó khớp ≥1 file trong `dist/assets/`. Whitelist keyed bằng
tên mà không ai kiểm tên còn tồn tại = quả bom nổ chậm không kim.

---

## Xếp hạng (xác suất × độ khó phát hiện)

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | `/vi/tournament/:slug` rơi entry → NotFound, bot che mắt mọi gate, SEO đổ traffic vào 404 | cao | rất cao (bot 200, weeks tới report) | **#1** |
| 2 | Bỏ prop `language="vi"` / swap `ViBlogPost`→`BlogPost` → /vi render EN → hreflang mismatch, tụt hạng | TB | cao (GSC/Ahrefs trễ 3-5 tuần) | **#2** |
| 3 | Đổi tên chunk → whitelist precache khớp 0 file → north-star rụng precache, perf regression | TB-thấp | rất cao (không alert, có thể ẩn vĩnh viễn) | **#3** |

**Tệ nhất = Sự cố 1.** Không vì thảm hoạ nhất mà vì: xác suất gần như chắc chắn (chép tay
63 entry, sót một là chuyện thường), độ khó phát hiện tối đa (mọi dashboard xanh vì bot
luôn 200), và blast radius là **traffic SEO thật đổ vào trang 404** — Google càng xếp hạng
tốt thì càng nhiều user VN đâm vào tường. Sự cố 3 tuy khó phát hiện ngang nhưng hậu quả chỉ
là perf; Sự cố 1 là mất người dùng + mất uy tín BTC, thứ `git revert` không hoàn lại.

## Rẻ nhất để chặn từ bây giờ

1. **Một vitest parity (~15 dòng)** đọc route-config, assert: đúng 63 route `/vi/*`, và
   mỗi cái strip `/vi` khớp một EN path đã biết (tập này idea-recon §1 tính sẵn, 0
   mismatch). Chặn thẳng Sự cố 1, và bắt luôn cặp lệch component/prop của Sự cố 2 nếu
   assert cả element identity.
2. **Một smoke browser-thật (KHÔNG bot UA)** hard-load 3 route đại diện —
   `/vi/tournament/<slug>`, `/vi/blog/<slug>`, `/vi/news` — assert status không-404 +
   `document.documentElement.lang==="vi"`. Chặn Sự cố 1 và 2 ở góc nhìn user thật, cửa mà
   mọi test SEO hiện tại (đi bot) bỏ trống.
3. **3 dòng trong `scripts/check-bundle-size.mjs`:** mỗi pattern boot-critical trong
   `workbox.globPatterns` phải khớp ≥1 file trong `dist/`. Chặn Sự cố 3.

## Khoảng hở của pipeline mà bài này lộ ra

**Toàn bộ kiểm thử "routing/SEO" đi qua cửa BOT prerender (`functions/_middleware.ts`),
đọc URL string — KHÔNG cửa nào chạm React Router ở góc nhìn user thật.** `seo.spec.ts`
dùng Googlebot UA → test prerender. smoke/visual chỉ chạm `/vi` home → 62/63 route VI
không có coverage. Hệ quả: bất kỳ hỏng hóc nào ở tầng client route (rơi entry, sai
component, sai ngôn ngữ first-paint) đều **vô hình** vì bot luôn được phục vụ HTML đúng.
Đây là feedback trực tiếp cho `/idea`: refactor này cần **một** gate mới — route-parity ở
góc nhìn user thật (dù chỉ 3 route mẫu + một assert đếm entry) — nếu không, panel duyệt +
CI + soak 30 phút đều sẽ báo xanh trên một site đã hỏng cho đúng nhóm 95% user VN.
Ngoài ra: whitelist PWA precache keyed theo tên chunk mà không ai verify tên còn khớp —
gate budget đo tổng size nên mù với đổi-tên; cần một assert "pattern khớp ≥1 file".
