# SEO P1 Task 4 + 5 — sự kiện HCMC & glossary

> Slug: `seo-p1-tasks-3-5` · Ngày: `2026-07-27` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6 `gpt-5.6-sol`) · `pre-mortem`. Vòng 2 đối chất: đủ 3 agent có mặt trong bất đồng.
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 · `debate.json` + `ledger.md` — ledger

---

## 0. 🔶 Cần anh quyết

### 🚨 C1 — BUG ĐANG SỐNG TRÊN PROD, không liên quan Task 4/5, nhưng Task 4/5 sẽ làm nó nặng hơn

`src/pages/Index.tsx:138` dựng link bài viết trên trang chủ:
```ts
href: language === "vi" ? `/vi/blog/${p.slug}` : `/blog/${p.slug}`
```
`p.slug` là slug **EN**. Bài VI có slug khác hoàn toàn. Kết quả — curl prod hôm nay:

```
/vi/blog/hcmc-open-2026-preview                          404
/vi/blog/pickleball-cost-vietnam-2026                    404
/vi/blog/vietnam-hosts-ppa-tour-asia-2026                404
/vi/blog/pickleball-world-cup-2026-da-nang-how-to-watch  404
/vi/blog/hcmc-open-2026                  (slug VI thật)  200
```

**Cả 6 bài trong top-6 trang chủ tiếng Việt đều 404.** 95% người dùng là người Việt. Họ bấm thẻ bài nổi bật nhất → *"Bài viết này không tồn tại hoặc đã bị xóa."*

Vì sao chưa ai biết: **mọi tiêu chí nghiệm thu của work order là `curl -A "Googlebot"`**, mà bot đọc `home.ts:127` (lấy slug VI **đúng** từ Supabase) còn người đọc `Index.tsx:138` (slug EN, **sai**). Hai renderer song song, gate chỉ đo một nhánh. `client_errors` cũng không ghi vì đây là render bình thường, không throw — soak 30 phút sẽ luôn sạch.

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai |
|---|--------|--------|--------|--------------|
| **C1** | Sửa bug này **trước** Task 4/5 hay song song? | **Sửa trước** (khuyến nghị) — nó đang ăn traffic VI mỗi ngày, và Task 4/5 sẽ đẩy đúng 2 bài quan trọng nhất vào 2 slot hỏng đó trong 10 ngày trước HCMC | Ship Task 4 trước vì deadline 6/8 | Đẩy traffic vào trang 404 ngay tuần cao điểm. `pre-mortem` xếp P0 và nói thẳng: publish Task 4/5 chỉ **đổi nạn nhân**, không tạo bug mới |

`pre-mortem` đề xuất fix gốc thay vì vá từng link: `blog.ts:145` + `ViBlogPost.tsx:32` — nếu `vi_blog_posts` không có slug nhưng `BLOG_POST_META[slug]` có → 301 sang `/blog/<slug>`. **~4 dòng, 2 chỗ**, và xoá luôn lý do tồn tại của allowlist chép tay `VI_BLOG_REDIRECTS` (`_middleware.ts:274-296`, 15 dòng vá triệu chứng).

### C2 — RED cần anh duyệt tường minh

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai |
|---|--------|--------|--------|--------------|
| **C2** | Ghi vào `vi_blog_posts` (UPDATE bài đang published + đang rank) | **Duyệt, kèm 6 điều kiện** (mục 6) | Không làm phần VI đợt này | `growth-tasks/sql/` có 2 file, **0 file nào có câu khôi phục**. Không có bảng history cho `vi_blog_posts`. UPDATE đè lên `content_html` cũ = **mất vĩnh viễn**, `git revert` không chạm tới |

Điều kiện hạ RED → AMBER (`risk-auditor` chốt): **SELECT bản cũ + lưu `growth-tasks/sql/2026-07-27-vi-hcmc-open-2026.sql` chứa CẢ câu UPDATE lẫn câu khôi phục, TRƯỚC khi chạy câu nào.** Repo chưa từng làm việc này — đây là lần đầu.

### C3 — quyết định cũ của anh bị bằng chứng bác

| # | Quyết định anh đã chốt | Bằng chứng bác | Đề nghị |
|---|---|---|---|
| **C3a** | *"Chèn prose có URL, không thêm field cta"* (Task 4) | `BlogPost.tsx:293` + `blog-body.ts:34` đều `escapeHtml` → URL ra **text trần không bấm được**, cả client lẫn bot. Anh chọn dựa trên tiền đề sai. | **VÔ HIỆU.** Thay bằng: bản VI viết thẳng `<a>` trong `content_html` (zero code, phủ 95% người dùng); bản EN dùng `externalLinks` nhưng **hoãn tới trước 30/8** cho World Cup |
| **C3b** | *"Glossary EN + VI song song"* | `solution-architect` đề xuất gate **stop-and-look**: ship VI trước, sau 3 tuần nếu VI vẫn 0 impression cho `"… trong pickleball là gì"` thì **đừng làm bản EN**. Cộng thêm: `content.vi` trong file `.ts` **không được render ở đâu cả** (`BlogPost.tsx:110` hardcode `content.en`) — viết "song ngữ" trong repo sinh ra một bản VI chết. | Anh quyết: giữ EN+VI song song, hay tách đôi có gate? |

---

## 1. Ý tưởng gốc

Work order `claude-code-workorder-SEO-P1-2026-07-24.md` §4 Task 3/4/5.

| Hỏi | Trả lời |
|---|---|
| Ai dùng | 95% người Việt, điện thoại, vào thẳng deep link từ Facebook — **không** qua trang chủ |
| Đau ở đâu | "ppa ho chi minh 2026" pos 7,4 · "kitchen trong pickleball là gì" 17 impr @ pos 23 · cụm info VI **424 impr / 0 click** |
| Thành công = | Click thật vào bài sự kiện + glossary bắt được truy vấn "… là gì" |
| Ràng buộc | HCMC Open **6-9/8** (còn 10 ngày) · World Cup Đà Nẵng 30/8-6/9 · www only, không đụng DNS |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟢 GREEN (bước 0-2) · 🔴 **RED** (bước 3, ghi `vi_blog_posts`) · 🟡 AMBER (bước 4) |
| **Khuyến nghị** | Cắt PR **theo tier, không theo task**. GREEN đi ngay; RED chặn chờ anh duyệt + file SQL khôi phục |
| **Công sức** | 4 nửa ngày tới mốc 6/8 · +2,5 nửa ngày cho glossary VI |
| **Rủi ro lớn nhất** | Không phải Task 4/5 — là **C1**, bug 404 đang sống mà Task 4/5 sẽ đổ traffic vào |
| **Auto-merge** | Bước 0-2 được · Bước 3 **chặn, cần anh duyệt** |

**Task 3 đã xong** (`seo-tools-cluster-intent-map.md:1-9` STATUS: CLOSED 2026-07-26). Không còn việc.

---

## 3. Đã có sẵn gì (recon)

**Work order sai 6 lần** khi đối chiếu repo → theo ground rule §3 "repo thắng":

| Brief nói | Thực tế |
|---|---|
| Task 3 cần làm | **ĐÃ XONG** 26/07, closed |
| companion World Cup cần tạo | **ĐÃ TỒN TẠI** — `pickleball-world-cup-2026-da-nang-how-to-watch` |
| `growth-tasks/CONTENT-PLAN-tuan28-30-2026-07-06.md` §6 | không tồn tại |
| `.gsc-index-queue.json` | không tồn tại — **DoD không thi hành được** |
| `docs/seo-topical-authority-plan.md` | không tồn tại |
| nhánh `strictnull-postmerge` | không tồn tại |

Thay `.gsc-index-queue.json` bằng: POST `functions/api/indexnow.ts` (tồn tại) + ghi việc GSC vào `docs/huong-dan-viec-cua-cuong.md`.

**Sẽ đụng:** `ViBlogPost.tsx`, `the-line.css`, `blog-body.ts`, 2 file post EN, `vi_blog_posts` (Supabase).

---

## 4. Phương án (sau đối chất)

### Thứ tự thực thi — cắt PR theo tier

| # | Việc | Tier | Effort | Xong trước |
|---|---|---|---|---|
| **0** | **Hạ tầng anchor VI** — `ViBlogPost.tsx`: `useEffect` scroll + `focus({preventScroll:true})` theo `location.hash` sau khi `post` về; tách `error` khỏi `!post` dùng `<ErrorState onRetry={refetch}/>` (`PageStates.tsx:49`, i18n đã có). `the-line.css`: `scroll-margin-top: 72px` cho `h2[id],h3[id]`. **BẮT BUỘC dùng `el.scrollIntoView()`, KHÔNG `window.scrollTo()`** | 🟢 | 0,5 | trước bước 4 |
| **1+2** | **Vá bẫy link ngoài + internalLinks EN** — `blog-body.ts:48-54` guard `/^https?:\/\//`, **giữ `escapeHtml` cả hai nhánh**, thêm `rel="nofollow sponsored"` nhánh ngoài; internalLinks cho 2 bài EN | 🟢 | 0,5 | 29/07 |
| **3** | **Prose stale + ghi VI** — sửa "under way now"/"as of July 23" → bump `updatedDate`; vé VI trong `content_html`; 3 internal link VI | 🔴 | 1 | 29/07 |
| **4** | **Glossary VI 24 mục** + `id="kitchen"` cho `luat-pickleball-co-ban` | 🟡 | 2,5 | 05/08 |
| **5** | *(mốc dừng nhìn lại — HCMC 6-9/8)* | | | |
| **6** | EN anchor id + `pr:v32→v33` + glossary EN | 🟡 | — | 18/08 |
| **7** | `externalLinks` + áp lên World Cup EN | 🟢 | 1 | 25/08 |

**Bỏ khỏi kế hoạch (đồng thuận 3/3):**
- **Bài companion vé riêng** — nhồi vé vào chính bài preview. Hai URL cho cùng sự kiện, 10 ngày trước giờ G, lặp lại đúng cannibalization Task 3 vừa đóng.
- **`/live` internal link** — `Live.tsx` không có surface blog; thêm vào = 2 chuỗi song ngữ mới + một chỗ chắc chắn quên gỡ sau 9/8, đổi lấy link mà bot không thấy.

### Phân vai glossary vs rules guide (đồng thuận 3/3 + GPT-5.6)

| | Glossary | Rules guide |
|---|---|---|
| Intent | định nghĩa — "X là gì" | luật — "được/không được làm gì" |
| Kitchen | 1 đoạn: vùng 2,13 m, cấm volley — **rồi dừng** | giữ nguyên 3 quy tắc + lỗi phổ biến |
| Link | → `/vi/blog/luat-pickleball-co-ban#kitchen` | → glossary **một lần**, phần mở đầu |

**Cấm copy nguyên đoạn sang cả hai.** 9 thuật ngữ brief đưa là quá mỏng cho "A–Z" → 24 mục.

---

## 5. UI/UX

**4 blocker** (`round1/ui-ux-critic.md`), tất cả đã vào bước 0 hoặc 3:

1. Deep link `#hash` **không cuộn** — đo thật trên prod
2. Không có `scroll-margin` nào trong repo; `.tl-nav` sticky che heading
3. Lỗi mạng hiện thành "bài đã bị xoá", không nút thử lại
4. Bài HCMC **không hề nhắc tới vé khán giả** (`hcmc-open-2026-preview.ts:243-245` chỉ nói YouTube + "300 chỗ ngồi" — ngụ ý cứ tới là vào được)

**Copy VI — `ui-ux-critic` bác 4 định nghĩa trong brief:**
- **"Erne = cú né luật kitchen" SAI bản chất** — Erne hợp lệ, không né luật. Dạy sai người mới.
- "vô-lê" có gạch nối — không ai ở sân Việt Nam viết vậy. Giữ nguyên tiếng Anh: kitchen, dink, volley, erne, ATP, stacking, poach.
- "bóng bạt rộng" (ATP) — tiếng Việt dịch, không ai nói
- "nay đa số giải bỏ luật let" — treo lơ lửng: bỏ rồi thì giao lại hay chơi tiếp?

Bản viết lại 9 định nghĩa: `round1/ui-ux-critic.md` §Copy.

**Panel đa model:** Claude + GPT-5.6 độc lập đồng ý URL text trần là Blocker, CTA phải giữa bài, không được bịa thông tin vé, và bản VI dùng `prose` thay `.tl-longform` là mất mát cho 95% người dùng. GPT-5.6 bất đồng 4 chỗ, thua 4/4 — chi tiết trong `round1/ui-ux-critic.md` §Panel.

---

## 6. Rủi ro

### Verdict: 🔴 RED — cư trú ở **đúng một bước**

`risk-tier.mjs` **không tồn tại** → không có classifier đối chiếu, tier là thủ công.

RED = *"không revert được bằng `git revert`"* (`_TEMPLATE.md:51`). Bước 3 rơi vào định nghĩa đó vì UPDATE đè `content_html` của bài **đang published và đang rank**, mà repo không có snapshot, không có bảng history, `growth-tasks/sql/` có 2 file và **0 file nào có câu khôi phục**.

`risk-auditor` đã **rút 2 lý do RED của chính mình** ở vòng 2: IndexNow (chỉ POST URL sang api.indexnow.org, không để lại state) và "người đọc sai giá vé" (chết theo ràng buộc cấm viết giá).

**6 điều kiện hạ RED → AMBER:**
1. SELECT + lưu `growth-tasks/sql/2026-07-27-vi-hcmc-open-2026.sql` có **cả** UPDATE lẫn câu khôi phục, **trước** khi chạy câu nào
2. `grep -n "under way now\|as of July 23\|just over two weeks" src/content/blog/posts/hcmc-open-2026-preview.ts` → **0 kết quả** trước khi bump `updatedDate`
3. **Không con số giá vé nào** trong bài — Ticketbox render giá client-side, curl không đọc được
4. Chốt **một** tên địa điểm: bài khai "Global City Sports Park" (`:50,60,140`), Ticketbox khai "New Sports Club, City Park, The Global City"
5. Thứ tự: ghi VI trước → deploy EN sau → `?nocache=1` (đúng `=1`) cả hai URL
6. IndexNow POST **tường minh** `{urls:[...]}`, không GET-all

### Rủi ro khác

| # | Mức | Cơ chế | Giảm thiểu |
|---|---|---|---|
| 1 | Cao | **Task 4 tự phá mục tiêu**: `Index.tsx:124-127` top-6 theo `publishedDate`, kết thúc **đúng** ở `hcmc-open-2026-preview` (hạng 6). Publish 1 bài mới → preview rớt khỏi homepage. Brief §4.1 yêu cầu link *từ* homepage → publish sẽ **xoá** chính link đó | Đã bỏ companion → không publish bài mới trước 6/8 |
| 2 | Cao | **IndexNow trôi 4 slug**: `indexnow.ts:70-113` mảng chép tay 42 slug vs `metadata.ts` 46. **4 bài mới nhất chưa bao giờ được ping**. GET-all trả `submitted: 42, status 200` → **báo thành công mà bài mới không có trong danh sách** | POST tường minh + thêm 6 slug + test khoá `BLOG_SLUGS ⊇ blogMetadata` |
| 3 | TB | **Race hreflang**: `blog.ts:45` query `vi_blog_posts` lúc render, cache KV 6h (`DEFAULT_TTL_SECONDS=21600`). Deploy EN trước INSERT VI + bot ghé đúng khe → thiếu `hreflang=vi` đóng băng 6 giờ | Điều kiện 5 |
| 4 | TB | **Cannibalization "kitchen"**: `luat-pickleball-co-ban` đã có H2 "Vùng 'Kitchen'" và đang rank | Phân vai mục 4. `risk-auditor` ghi rõ **không đo được vị trí hiện tại** (repo không có GSC access) — không đoán số |
| 5 | Thấp | Bump `pr:v32→v33` (bước 6) nuke KV mọi route; render budget 8s, quá hạn → bot nhận SPA shell trần ~6h. **1 va chạm id** khi slugify: `vietnam-dupr-leaderboard-launch.ts` có 2 heading cùng ra `"what"` | Để bước 6 đi riêng, **không** cùng tuần HCMC. De-dup suffix. Append `docs/prerender-cache-log.md` |

### Perf (số đo thật, `check-bundle-size.mjs` build 2026-07-25)

- **Total 1848,6 / 1970 KB gz** → headroom **121,4 KB** *(không phải ~20 KB; `docs/perf-budgets.md` là số 17/07, đã trôi +26 KB)*
- **INITIAL 267,4 / 280 KB** → headroom **12,6 KB** — chật, và `blogMetadata` nằm trong entry chunk first-paint (mỗi entry mới ≈1,5 KB raw)
- **CONTENT cap 20 KB gz/chunk** ≈ **~62 KB source TS**. Glossary EN 25-30 thuật ngữ **rất dễ vượt** → CI đỏ (gate cứng, chặn trước prod)

### SLO

SLO 6 (VN mobile p75 LCP) rủi ro nhỏ qua INITIAL headroom. **SLO 1-5, 7 không bị đe doạ** — không đụng edge function, `verify_jwt`, migration, RLS/RPC, cron, push. `risk-auditor` nói thẳng: *"không có rủi ro auth ở đây, đừng để ai hedge cho có."*

### Gate thật sự có (và không có)

| Gate | Bắt được | KHÔNG bắt được |
|---|---|---|
| `blog-sync.test.ts`, `blog-seo-surfaces.test.ts` | parity 3 surface EN | **chân thứ 5 = `vi_blog_posts`** — file tự khai: *"lives in the DB and can't be checked statically"* |
| `seo-byte-budget.test.ts` | title >60 **byte** | tiếng Việt có dấu 2-3 byte/ký tự → gate **sẽ đỏ** nếu viết meta VI tự nhiên |
| **KHÔNG CÓ** | `indexnow.ts` `BLOG_SLUGS` | đã trôi 4 bài |
| **KHÔNG CÓ** | `vi_blog_posts`, `alternate_en_slug` | — |

Phía **EN gần bằng 0 xác suất sót** (4 gate CI). Phía **VI gần như hoàn toàn phụ thuộc con người**.

### Rollback

| Phần | Cơ chế | Thời gian |
|---|---|---|
| Bước 0,1,2 | `git revert` + `?nocache=1` | ~5 phút |
| Bước 3 VI | **`git revert` KHÔNG chạm.** UPDATE ngược từ file SQL | ~2 phút **nếu có file**; **không xác định** nếu không |
| Bước 6 renderer | `git revert` + bump `v33→v34` | ~5 phút + 6h đuôi nếu quên bump |
| **Thẻ Facebook/Zalo đã share** | **KHÔNG revert được** | ∞ |

`pre-mortem` sự cố 2: `facebookexternalhit` và `zalo` đều trong `BOT_UA` (`utils.ts:332`) → nhận bản prerender và **cache độc lập**. Sửa web 4 phút, thẻ vẫn sai 3 tuần.

### Phản biện độc lập (GPT-5.6 — vendor khác, không thấy repo)

**Xác minh và giữ:** 6/6 finding chính đúng (bump `updatedDate` trên prose stale, 3 nhánh hỏng của link ngoài, race hreflang + KV 6h, rollback bất đối xứng, IndexNow bỏ sót âm thầm, 1 va chạm id khi slugify).

**Bác bỏ:**
- GPT-5.6 **bịa host** `thepicklehub.example` trong URL ví dụ. Chuỗi thật là `siteUrl + path` (`_middleware.ts:440`). Cơ chế đúng, minh hoạ sai.
- Nói "bundle-size violations would fail CI" — đúng nhưng **thiếu**: không biết `blogMetadata` nằm trong entry chunk, nên bỏ sót INITIAL chỉ còn 12,6 KB.
- **Không thấy** rủi ro #1 (bài mới đẩy preview khỏi homepage). Finding chỉ đọc code mới ra.
- **Không xác minh được:** GPT nói "VI page trỏ bài EN chưa deploy thì người dùng đi tới route thiếu" — nó tự thừa nhận "exact missing-route UI is not specified". Ghi là **chưa biết**.

---

## 7. Tranh luận trong panel

Bảng ledger đầy đủ: **`ledger.md`** *(`debate-ledger.mjs` không tồn tại → cưỡng chế thủ công)*.

**Nhượng bộ bị LOẠI: trống.** 6/6 lần đổi lập trường đều kèm bằng chứng chưa xuất hiện ở vòng 1.

**Bất đồng sống sót: trống.** Cả 3 giải quyết bằng bằng chứng, không phải thoả hiệp.

**Bất đồng bị giết ở vòng 2:**
- **D1** — `solution-architect` CONCEDE: anh ấy dùng bảng RED-tier trong prompt của **chính mình** thay vì `_TEMPLATE.md:51`. `risk-auditor` REFINE, thu RED từ "cả Task 4" xuống đúng 1 bước và **tự rút 2 lý do RED của mình**.
- **D2** — hai agent **đi ngược chiều và giao nhau ở giữa**: `ui-ux-critic` từ "1 dòng đủ" → "cần C4"; `solution-architect` từ "cần C4" → "1 dòng đủ". Cả hai có bằng chứng mới hợp lệ. Hội tụ: làm cả hai, khác lý do khác thời điểm.
- **D3** — `ui-ux-critic` HOLD với Playwright chạy vào prod. `solution-architect` CONCEDE — chính anh ấy vòng 1 đã ghi *"chưa mở browser xác nhận"* rồi vẫn xây kế hoạch lên giả định đó.

**Dữ kiện mạnh nhất vòng 2 tạo ra:** trang **không cuộn ở document** mà ở `DIV.tl-scroll` (`document.scrollingElement.scrollHeight = 844` = đúng chiều cao viewport). **Mọi bản vá dùng `window.scrollTo()` sẽ là no-op câm** — code chạy, không lỗi, không có gì xảy ra.

**Cảnh báo trọng số:** `risk-auditor` + `pre-mortem` cùng phe "đi tìm cái hỏng" nên gật đầu nhau nhiều. Hai Claude cùng nhiệm vụ đồng ý chỉ chứng minh chúng cùng là Claude. Đồng thuận **có trọng số** duy nhất là Claude ↔ GPT-5.6 — liệt kê trong `ledger.md`.

---

## 8. Kế hoạch verify

**Tự động:**
- [ ] `npx eslint <changed>` · `npx tsc -b --noEmit` · `npm run test`
- [ ] `npm run build` + `node scripts/check-bundle-size.mjs` (chunk glossary < 20 KB gz)
- [ ] `node scripts/gen-blog-barrel.mjs` nếu thêm file post EN
- [ ] Playwright: deep link `/vi/blog/<slug>#<anchor>` → heading **nằm dưới nav**, focus đúng heading
- [ ] `curl -A "Googlebot" <url>?nocache=1` → 200 + hreflang **đủ 3** en/vi/x-default
- [ ] **Mới:** Playwright fetch `/vi`, thu mọi href thẻ bài, assert **không có 404** *(bịt lỗ C1 — gate hiện tại chỉ đo nhánh bot)*

**Cuong phải tự làm:**
- [ ] **Quyết C1, C2, C3**
- [ ] Fact-check line-up + địa điểm HCMC với BTC (tránh nhầm dữ liệu MB Vietnam Open 2025)
- [ ] Mở link Ticketbox trên **iPhone thật** — kiểm `target="_blank"` trong WKWebView Capacitor
- [ ] GSC Request Indexing (không có API cho blog post)

---

## 9. Sau khi ship

### PR 1 — bước 0 + 1 + 2 + fix C1 · **MERGED**

- PR: [#473](https://github.com/cuongnguyen84/pickle-hub-pro/pull/473) · merge commit `a27765f5` · 2026-07-27T07:33Z
- **Merge với check đỏ, Cuong duyệt tường minh sau khi nghe rủi ro.** Toàn bộ GitHub Actions đỏ vì `"The job was not started because an Actions budget is preventing further use."` — **không liên quan code**. Run xanh cuối cùng của cả repo: `Uptime ping` `2026-07-26T14:02:17Z`; từ `14:30:16Z` mọi run chết trong 2 giây, 0 step. 100/100 run gần nhất đỏ, cả trên `main` lẫn nhánh khác. Vẫn cần anh nâng ngân sách Actions — `uptime-ping` và `deploy-guard` đang chết theo.
- Trước khi merge đã gộp `origin/main` (2 commit song song #472/#474, **0 file giao nhau**) và chạy lại local trên trạng thái đã gộp: **111 file / 1225 test pass**, INITIAL 266,3/280, total 1854,1/1970. Đây là lớp kiểm duy nhất thay cho CI.
- **Đã tự verify trên preview** (`feat-seo-p1-tasks-3-5.pickle-hub-pro.pages.dev`, Googlebot UA) — 6/6 đúng thiết kế: 3 URL hỏng → 301 về đúng bài VI; slug VI thật → 200; slug rác → 404; bài EN → 200. Prod cùng lúc vẫn 404.
- Gate local trước khi push: `tsc -b` 0 · eslint 0 · 110 file / 1220 test pass · bundle INITIAL 266,3/280, total 1854,3/1970.

**Khác kế hoạch:**
- Fix C1 gộp vào PR này (Cuong duyệt) thay vì để riêng.
- Redirect đích là **bài VI**, không phải bài EN như `pre-mortem` đề xuất — verify được 0/53 slug VI trùng slug EN và cả 7 bài đều có bản VI, nên giữ người Việt ở nội dung tiếng Việt.
- `C4/externalLinks` **không** làm (D2 vòng 2). Chỉ vá bẫy URL tuyệt đối ở `blog-body.ts`.
- `rel` dùng `nofollow noopener`, **không** `sponsored` như panel đề xuất — `sponsored` khẳng định có trả tiền, helper không biết điều đó.

**Học được:**
- `qa-verifier` bắt được một lỗ hổng PostgREST `or=` filter-injection do chính bản nháp đầu của thay đổi này tạo ra: `encodeURIComponent` **không** escape `(` `)`. Repo đã có `escapePostgrestSearch.ts` cho lớp lỗi này. Sửa bằng shape-guard `^[a-z0-9-]+$` (đúng hơn cho khoá exact-match) + test riêng.
- Actions hết ngân sách biểu hiện **giống hệt CI hỏng**: mọi job đỏ, 2 giây, không log. Lý do chỉ nằm ở `check-runs/<id>/annotations`, không nằm trong `gh run view --log-failed` (log không tồn tại).

### PR 2 — bước 3 (🔴 RED) · chưa bắt đầu
### PR 3 — bước 4 (glossary VI) · chưa bắt đầu
