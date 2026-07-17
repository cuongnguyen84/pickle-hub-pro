# Pre-mortem — perf-js-gzip

> Ba postmortem ngược. Giả định feature "tối ưu JS gzip" đã lên prod và đã hỏng.
> Mỗi mắt xích trỏ tới file thật. Được hư cấu **hậu quả**, không hư cấu **cơ chế**.
>
> Lưu ý nền: outage 2026-07-11 (entry hashed filename tái dùng) ĐÃ có root-fix —
> `BUILD_ID` token nối vào tên entry (`vite.config.ts:8-19`, `entryFileNames` `:285`).
> Nên KHÔNG story nào dưới đây được phép là bản lặp của outage đó. Chúng là các
> khoảng hở **kế tiếp** mà build-token không che.

---

## Sự cố 1 — "App treo màn hình trắng cho user cài PWA/offline sau đợt tối ưu chunk"
**Xác suất:** TB · **Thời gian tới lúc phát hiện:** 1–3 tuần (chỉ nhóm installed/offline mới dính)

Cơ chế caching/deploy — nhưng KHÁC outage 2026-07-11. Build-token chỉ bảo vệ
**entry**; nó không bảo vệ việc precache whitelist bị trượt tên chunk.

**Timeline**
- T+0: Ship PERF fix "react-dom lọt vào entry" + "lazy sâu hơn vendor". Cách tự nhiên nhất để tách là chẻ `vendor-react` (`vite.config.ts:296`) thành hai: giữ `react`+`react-dom`, tách `react-router-dom` ra `vendor-router` (router boot-critical, nặng, hợp lý để cô lập). Total gz giảm → mọi gate xanh → merge → Cloudflare deploy.
- T+0 → +20 phút: user online, mạng tốt: hoàn toàn bình thường. `vendor-router-[hash].js` được serve network-first, chunk error recovery không kích hoạt.
- T+2 ngày: một user Android đã "Thêm vào màn hình chính" (installed PWA), ở vùng sóng yếu, mở app từ cold cache. SW precache đã cài đủ mọi thứ TRỪ `vendor-router`. Boot: `index.html` → entry (từ precache) → import `vendor-router` → không có trong precache → rơi xuống runtime `lazy-chunks` CacheFirst (`vite.config.ts:161-172`) → cache miss → phải ra network → offline/timeout → `Failed to fetch dynamically imported module`.
- T+2 ngày: `lazyRetry` (`src/App.tsx:36-44`) thử lại 1 lần sau 1.5s → vẫn fail → `installChunkErrorRecovery` (`src/pwa.ts:24-102`) reload 1 lần (sessionStorage flag) → lần 2 vẫn thiếu chunk → `alreadyReloaded` chặn loop → user thấy error UI/màn trắng, không self-heal.

**Cơ chế**
`vite.config.ts:296` (đổi `manualChunks`, thêm key `vendor-router`) → chunk mới tên `assets/vendor-router-[hash].js` → precache whitelist `vite.config.ts:104-124` KHÔNG có pattern `assets/vendor-router-*.js` (chỉ có `vendor-react-*`, `vendor-ui-*`, `vendor-supabase-*`, `vendor-query-*`, `vendor-date-*`, `vendor-capacitor-*`) → chunk boot-critical không vào precache → offline/cold-cache launch thiếu router → `src/App.tsx:36` retry fail → `src/pwa.ts:63` chặn reload lần 2 → treo.

Whitelist là danh sách **tên** hardcode. Nó ngầm giả định tên manualChunks không đổi. Không có gì trong repo ép ràng buộc đó — không test nào đối chiếu "chunk mà entry+journey screen import tĩnh" ⊆ "precache whitelist".

**Vì sao mọi gate vẫn xanh**
- Panel: thấy total gz giảm, split "sạch hơn" (tách router khỏi react — textbook). Không ai grep tên chunk mới đối chiếu glob precache; không có ô checklist cho việc đó.
- CI bundle gate: `scripts/check-bundle-size.mjs:24-33,50` cộng dồn TẤT CẢ `dist/**/*.js` → tổng giảm → `BUNDLE_STRICT=1 BUNDLE_BUDGET_KB=1970` (`quality.yml:96-98`) PASS. Script không biết precache là gì.
- Soak 30 phút: chạy online, mạng ấm, `controllerchange` reload (`src/pwa.ts:131-135`) mượt vì network luôn serve được `vendor-router`. Đường offline/cold-cache — đúng đường hỏng — không bao giờ được soak chạm tới.

**Ai báo, sau bao lâu**
Không phải Cuong (Cuong test trên browser online). Một user cài PWA nhắn Facebook "app trắng xoá không vào được" sau 1–3 tuần. Nhiều khả năng under-report vì đa số traffic là browser online, không phải installed offline — sự cố ăn mòn âm thầm nhóm trung thành nhất (người đã cài app).

**Vì sao khó sửa**
`git revert` sửa được source, nhưng SW cũ đã precache-thiếu nằm SẴN trên máy user. Bản fix chỉ chạy khi SW mới activate qua `controllerchange` — mà việc đó cần một lần load online thành công. User đang kẹt offline không lấy được fix. `cleanupOutdatedCaches:true` (`vite.config.ts:136`) chỉ dọn khi activate được.

**Dấu hiệu sớm lẽ ra phải có**
Một test sau build: liệt kê chunk mà entry + journey screens (`Index`, `Tournaments`, `Feed`, `SocialEventDetail`, `CreateSocialEvent`) import tĩnh, assert mỗi cái khớp một pattern trong `globPatterns`. Không tồn tại (recon: không có test bundle nào ngoài script size). `globIgnores` đã có comment "belt-and-braces… even if a whitelist pattern drifts" (`vite.config.ts:128-130`) — tức tác giả BIẾT whitelist có thể trượt, nhưng chỉ phòng cho `locale-*`, không phòng chiều ngược (chunk boot-critical rớt khỏi whitelist).

---

## Sự cố 2 — "Biểu đồ DUPR trống trơn cho phần lớn người chơi sau khi thay recharts"
**Xác suất:** TB (chỉ nếu thực sự swap recharts) · **Thời gian tới lúc phát hiện:** 2–4 tuần

UX gãy âm thầm cho một NHÓM user — đúng nhóm đông nhất.

**Timeline**
- T+0: Thực thi nhánh "swap dependency nặng (recharts…)" trong idea. `vendor-charts` = recharts 107.9 KB gz (`vite.config.ts:311`) là mục tiêu ngon. Thay bằng lib nhẹ (uPlot/visx/SVG tay). Dev test trên tài khoản của mình + `/admin/analytics` (`AdminAnalytics.tsx`) + `/creator/analytics` (`CreatorAnalytics.tsx`) — data DÀY, đồ thị đẹp. Ship.
- T+0: total gz tụt mạnh (mục tiêu <1800 đạt) → ăn mừng.
- T+3 ngày → +3 tuần: người chơi mới/thường (DUPR 0–2 điểm lịch sử) mở profile công khai `/nguoi-choi/:slug`. `DuprRatingChart` (`PlayerProfile.tsx:15,164`, import TĨNH) render với `history` thưa → lib mới không xử lý empty/sparse như recharts từng làm → hoặc throw → hoặc vẽ khung trống.

**Cơ chế**
Swap trong `DuprRatingChart.tsx:34` → lib thay thế không có empty-state grace của recharts (mà code cũ dựa vào — `DuprConnect.tsx:224` ghi rõ "DuprRatingChart handles its own empty/loading state") → với `history` 0–2 điểm hoặc trục date format qua `locale-vi` (`date-fns`), lib mới throw hoặc render blank → nếu throw, bong bóng lên `ErrorBoundary` top-level (`src/App.tsx`, Suspense/boundary quanh routes `:525`) → nuốt thành khoảng trống hoặc nguyên section lỗi. Không exception nào ra tới log server; không alert nào nổ.

Ba thứ vô hại gặp nhau: **swap chạy đúng** (với data dày) + **data thưa** (đa số player) + **ErrorBoundary nuốt lỗi** = biểu đồ biến mất lặng lẽ cho nhóm đông nhất.

**Vì sao mọi gate vẫn xanh**
- Panel: review dashboard admin/creator — data dày, đồ thị hoàn hảo. Không ai mở một profile player mới toanh có 1 điểm rating.
- CI: không có render test nào import `DuprRatingChart` với `history=[]` hay 1 điểm. Không có visual/snapshot test cho chart (recon: không tìm thấy test code-splitting/chart nào).
- Soak: staging seed toàn player lịch sử dày — không bao giờ chạm case sparse.

**Ai báo, sau bao lâu**
Tệ nhất: KHÔNG AI báo trong nhiều tuần. Player mới thấy chart trống thì tự nghĩ "chắc mình chưa có đủ trận" — không nghi bug. Sự cố ăn niềm tin mà không tạo ticket. Muộn hơn: một player rating dày để ý chart của mình cũng chập chờn theo locale/ngày → email.

**Vì sao khó sửa**
Revert swap = gắn lại recharts = total gz vọt lại đúng mức PERF đang cố hạ → re-trip budget 1970 (`quality.yml:97`). Kẹt giữa "chart hỏng cho đa số player" và "gate đỏ". Fix đúng (patch empty-state cho lib mới) tốn thời gian mà không ai biết đang cháy.

**Dấu hiệu sớm lẽ ra phải có**
Một vitest jsdom render `DuprRatingChart` với `history=[]`, 1 điểm, và data + `locale-vi` → assert không throw & có element chart. Rẻ, một file. Rule #3 `docs/perf-budgets.md` nói feature nặng lazy sau `import()` — nhưng không có rule nào bắt "thay lib phải giữ nguyên hợp đồng empty-state".

---

## Sự cố 3 — "Bundle gate xanh, tổng gz giảm — nhưng trang đầu tải CHẬM hơn cho mobile Việt Nam"
**Xác suất:** CAO · **Thời gian tới lúc phát hiện:** có thể KHÔNG BAO GIỜ (không gate nào đo)

Khoảng hở của chính metric. Đây là nơi pre-mortem kiếm cơm: gate đo sai số.

**Timeline**
- T+0: Thực thi headline của idea — "nghi react-dom lọt vào entry, sửa manualChunks". Sửa để `react-dom` (kể cả subpath `react-dom/client` ở `src/main.tsx:1`) gom trọn vào `vendor-react` thay vì nằm trong entry. Entry gz 102→~60 KB. Đẹp như mơ trên bảng chunk.
- T+0: `check-bundle-size.mjs` in bảng, entry nhỏ hẳn, total giảm → gate xanh → panel duyệt ("react-dom ra khỏi entry, textbook perf").
- T+0 trở đi: nhưng đường boot giờ là waterfall SÂU HƠN: `index.html` → `entry` → (request riêng) `vendor-react` → `I18nProvider` → (request riêng) `locale-vi` (`vite.config.ts:294-295`, đã lazy từ PERF-06). Trên mobile Việt Nam RTT cao, THÊM một round-trip tuần tự trên critical path. Tổng byte giảm nhưng **thời gian tới first paint TĂNG** vì latency-bound, không phải bandwidth-bound.
- T+∞: mục tiêu (a) "tải trang đầu nhanh hơn" bị REGRESS; mục tiêu đo được (b) "tổng gz" thì cải thiện. Không ai biết (a) hỏng.

**Cơ chế**
`vite.config.ts:296` (kéo react-dom khỏi entry vào `vendor-react`) → entry giờ `import` `vendor-react` như dependency tách rời → thêm 1 hop tuần tự trước khi React mount → `scripts/check-bundle-size.mjs:24-33,50` chỉ cộng **aggregate gz của mọi file**, không đo initial-load bytes, không đo số request trên critical path, không đo LCP → số duy nhất CI nhìn đi ĐÚNG chiều mong muốn trong khi trải nghiệm thật đi NGƯỢC.

**Vì sao mọi gate vẫn xanh**
- CI: `quality.yml:96-98` chỉ gate `BUNDLE_BUDGET_KB=1970` trên TỔNG. Doc `docs/perf-budgets.md:20` có dòng "Entry chunk gz ≤170" và "Mobile p75 Vietnam LCP ≤2.5s" — nhưng cả hai KHÔNG được script enforce (script chỉ biết total). Budget entry và LCP là chữ trong doc, không phải cổng.
- Panel: bảng chunk cho thấy entry co lại — đọc như thắng lợi. Chia nhỏ = số đẹp.
- Soak 30 phút: functional, không đo perf trên 3G throttle. Waterfall sâu vẫn "load xong", chỉ chậm hơn — soak không có ngưỡng thời gian để fail.
- Lighthouse: theo memory (`lighthouse-ci-failing-repo-wide`) Lighthouse CI đỏ repo-wide sẵn (contrast) → advisory, không ai đọc số LCP trong đó.

**Ai báo, sau bao lâu**
Không ai, qua đường automation. Chỉ hiện trong field data GA4 `web_vital` (`perf-budgets.md:26`, "collecting since BASE-03") sau nhiều tuần — mà GA4 bị bot US datacenter làm nhiễu nặng (CLAUDE.md), tín hiệu thật nằm ở Vietnam segment, rất dễ bỏ sót. "Cải tiến" này lặng lẽ làm CHẬM first load của đúng 95% khán giả mobile Việt, và không có alert nào.

**Vì sao khó sửa**
Không hỏng ồn ào nên không ai mở lại. "Fix" được ghi công là perf win trong roadmap; đảo ngược nó nghĩa là thừa nhận số đẹp là ảo — mà số đẹp thì gate vẫn đang tưởng thưởng. Regression sống vô thời hạn.

**Dấu hiệu sớm lẽ ra phải có**
Một check đo initial-load: parse `dist/index.html`, lấy tập `<script type=module>` + `modulepreload` + đệ quy static-import của entry, cộng CHỈ tập đó, và đếm độ sâu waterfall — gate riêng. Hoặc một số LCP throttled-3G cho `/` trong CI. Cả hai đều không tồn tại; `check-bundle-size.mjs` đo aggregate là số duy nhất, và nó mù với điều idea thật sự muốn tối ưu.

---

## Xếp hạng (xác suất × độ khó phát hiện)

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 3 | Gate xanh nhưng initial load chậm hơn (metric mù) | Cao | Rất cao (có thể không bao giờ) | **P1** |
| 1 | Precache whitelist trượt tên chunk → PWA/offline treo | TB | TB–cao (chỉ nhóm installed/offline) | **P2** |
| 2 | Swap recharts → chart DUPR trống cho player thưa data | TB (chỉ nếu swap) | TB (user tự trách mình) | **P3** |

Lý do #3 đứng đầu: nó tấn công đúng KPI của idea, hỏng theo hướng không alert nào bắt, và được ghi công là thành công. Một sự cố thảm khốc mà 10 giây là biết còn đỡ hơn cái này — nó ăn mòn (a) "trang đầu nhanh hơn" trong khi báo cáo là đã đạt.

---

## Rẻ nhất để chặn từ bây giờ

1. **Đo đúng số (chặn #3):** thêm vào `scripts/check-bundle-size.mjs` một hàm parse `dist/index.html` → tập script/modulepreload + static-import đệ quy của entry → in "**initial-load gz**" và "**số request critical-path**" tách khỏi total. Gate `BUNDLE_STRICT` trên số initial-load, không phải trên aggregate. ~30 dòng, một file.
2. **Khoá whitelist (chặn #1):** một vitest sau build: với mỗi journey screen + entry, đọc chunk static-import từ `dist`, assert tên khớp một pattern `globPatterns` (`vite.config.ts:104-124`). Fail nếu có chunk boot-critical rớt khỏi precache. ~40 dòng.
3. **Khoá empty-state chart (chặn #2):** một vitest jsdom render `DuprRatingChart` với `history=[]`, 1 điểm, và data + `locale-vi` → assert không throw & có element chart. Bắt buộc chạy nếu PR đụng `vendor-charts`. Một file.

---

## Khoảng hở của pipeline mà bài này lộ ra

- **Gate đo sai chiều.** `check-bundle-size.mjs` cộng aggregate gz — số này có thể đi NGƯỢC mục tiêu thật (initial-load latency). `/idea` duyệt bundle work trên một con số duy nhất mà con số đó không phải thứ user cảm nhận. Doc `perf-budgets.md` đã viết sẵn budget "entry ≤170" và "LCP ≤2.5s" nhưng KHÔNG được CI enforce — budget-trên-giấy tạo ảo giác có cổng.
- **Precache whitelist không có invariant.** Nó là danh sách tên hardcode, ngầm phụ thuộc key `manualChunks` không đổi; không test nào ràng buộc "boot-critical ⊆ whitelist". Chính comment `globIgnores` (`vite.config.ts:128`) thừa nhận whitelist "có thể drift" — nhưng chỉ phòng một chiều.
- **Soak 30 phút chạy online, mạng ấm.** Nó không bao giờ chạm đường offline/cold-cache/3G-throttle — đúng những đường mà tối ưu chunk làm hỏng. Soak cho cảm giác an toàn sai với đúng loại thay đổi này.
- **Đề xuất cho /idea:** khi task là "tối ưu bundle", panel nên yêu cầu (i) một số initial-load/LCP làm gate, không chỉ aggregate; (ii) đối chiếu tên chunk mới với precache glob; (iii) chạy đường offline trong soak. Ba việc này là feedback trực tiếp cho pipeline.
