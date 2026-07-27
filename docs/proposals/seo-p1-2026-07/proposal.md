# SEO P1 — brand entity schema (Task 1) + đóng Task 2

> Slug: `seo-p1-2026-07` · Ngày: `2026-07-26` · Trạng thái: `draft`
> Sinh bởi `/idea`. **Panel KHÔNG chạy được** — xem cảnh báo ngay dưới.
>
> **Raw audit trail:** `00-intake.md` · `round1/idea-recon.md` · `round1/orchestrator-investigation.md`

---

## ⚠️ CẢNH BÁO VỀ ĐỘ TIN CẬY CỦA BÁO CÁO NÀY

Báo cáo này **không có panel độc lập**. Cụ thể:

| Agent | Trạng thái |
|---|---|
| `idea-recon` | ✅ chạy thật, output nguyên văn ở `round1/idea-recon.md` |
| `solution-architect` | ❌ chết 3 lần vì API 529 Overloaded |
| `risk-auditor` | ❌ chết 3 lần vì API 529 Overloaded — **không có verdict tier độc lập** |
| `ui-ux-critic` | ⏭️ Cuong duyệt bỏ (JSON-LD không có UI) |
| `pre-mortem` | ⏭️ Cuong duyệt bỏ (bề mặt quá nhỏ) |
| GPT-5.6 (vendor khác) | ❌ không chạy — **không có phản biện độc lập vendor** |
| Vòng 2 đối chất | ❌ không có bất đồng vì không có 2 phía |
| `debate-ledger.mjs` / `risk-tier.mjs` | ❌ `scripts/agents/` không tồn tại trong repo |

Cuong chọn **phương án A**: orchestrator tự điều tra thay panel. Nghĩa là mục 4 và 6 dưới đây
**do một mình Claude viết** — mất trục "độc lập" (không có vendor khác) và trục "đối chất"
(không có ai phản bác). Bù lại, **mọi khẳng định đều có output lệnh thật hoặc file:line**, chép
nguyên văn ở `round1/orchestrator-investigation.md` để anh kiểm lại.

Tier 🟢 GREEN dưới đây là **tự chấm**, không phải verdict của `risk-auditor`.

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| **D1** | **Play Store URL trong work order trỏ vào app KHÔNG TỒN TẠI** — `play.google.com/store/apps/details?id=net.thepicklehub.app` trả **404** ở mọi locale (`hl=vi&gl=VN`, `hl=en&gl=US`) và mọi biến thể app-id. App iOS thì sống thật (200, "ThePickleHub: Tournaments", dev NGUYEN THE CUONG). | **Bỏ Play Store, chỉ thêm App Store** (khuyến nghị) | Chờ publish app Android rồi thêm cả 2 sau | Làm theo work order nguyên văn = nhét URL 404 vào `sameAs` của brand entity đang xếp pos 8,2 trên chính tên nó. Đây đúng là loại tín hiệu bẩn mà Task 1 sinh ra để dọn. |
| **D2** | `index.html:49` có `<meta name="google-play-app" content="app-id=net.thepicklehub.app">` — Smart App Banner trỏ vào **cùng app không tồn tại đó**. | Xoá dòng đó trong cùng PR (khuyến nghị — 1 dòng, cùng lớp lỗi) | Để nguyên, xử lý khi publish Android | Không hại hiển thị (Chrome im lặng bỏ qua), nhưng là metadata chết và sẽ khiến người sau tưởng app Android đã live. |

**Câu hỏi thật đằng sau cả hai:** app Android đã publish chưa, hay còn internal testing? Nếu sắp
publish trong vài ngày thì để nguyên và thêm cả 2 URL sau khi live là hợp lý hơn.

---

## 1. Ý tưởng gốc

Work order `/Users/cm10/Downloads/claude-code-workorder-SEO-P1-2026-07-24.md` — 5 task SEO P1
dựa trên GSC 90 ngày. Cuong chốt phạm vi đợt này = **Task 1 + Task 2**.

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Bot Google (Googlebot) — đây là tín hiệu entity, không phải UI người dùng |
| Đau ở đâu | "the pickle hub" 1.270 impr @ pos 8,2 (CTR 3,1%); "picklehub" 215 impr @ pos 7,2 — chưa sở hữu SERP thương hiệu của chính mình |
| Thành công = | Pos brand query cải thiện + knowledge panel giàu hơn (app link) |
| Ràng buộc | www only, không đụng DNS, `tsc` + eslint pass, Googlebot 200 + hreflang sạch, 1 PR/task |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟢 GREEN *(tự chấm — `risk-auditor` không chạy được)* |
| **Khuyến nghị** | **Option A** — sửa `home.ts` EN+VI, logo vuông + **chỉ App Store** trong `sameAs`, invalidate bằng `?nocache=1` × 2, không bump cache key |
| **Công sức** | 1 nửa ngày |
| **Rủi ro lớn nhất** | Không phải rủi ro kỹ thuật mà là **rủi ro làm đúng theo brief**: brief bảo thêm URL Play Store đang 404 |
| **Auto-merge** | Được sau khi qua gate — **nhưng D1/D2 cần anh trả lời trước khi code** |

---

## 3. Đã có sẵn gì (recon)

### ✅ Task 2 — ĐÃ LÀM XONG TỪ TRƯỚC, không còn việc gì

Redirect `/blog/best-pickleball-tournament-software-2025 → -2026` tồn tại ở **3 tầng**:

- `public/_redirects:20` — rule 301
- `functions/_middleware.ts:315-317` — `BLOG_MERGED` mirror cho bot (comment `:312-314` ghi rõ slug NÀY từng 404 với bot cho tới khi có mirror), áp ở `:346-350`
- `src/__tests__/redirect-parity.test.ts:139-164` — test khoá `_redirects` ↔ `BLOG_MERGED` đúng slug này

Commit gốc `707f3ed5`, mirror + parity gate thêm ở `af753abc`.

**Curl prod 2026-07-26 — verify thật:**
```
thepicklehub.net/blog/...-2025   → 301 → www.thepicklehub.net/blog/...-2025
www.thepicklehub.net/...-2025    → 301 → www.thepicklehub.net/...-2026 → 200
Googlebot UA: y hệt (không chỉ người)
```

**Deliverable "xác định tầng nào honor redirect" — ĐÁP ÁN:** `functions/_middleware.ts`.
Nó chạy **trước** `public/_redirects` (comment `_middleware.ts:1b` nói thẳng: *"CF Pages
middleware runs BEFORE `_redirects` is consulted"*). Kể cả apex→www cũng nằm trong middleware
(`_middleware.ts:213-215`), **không phải Cloudflare Redirect Rules**. → Task 3 sau này đặt 301
ở `_middleware.ts` + mirror `_redirects` + parity test, đúng pattern đang có.

GSC vẫn thấy 262 impr @ pos 42 là **index cũ chưa rụng**, không phải redirect hỏng.
→ Việc duy nhất còn lại: **Cuong Request Indexing bản `-2026` trong GSC.** Không có code.

### Task 1 — chưa làm, nhưng brief sai 3 chỗ

| Brief nói | Thực tế (verify) |
|---|---|
| schema ở `render/index.ts` L78/L176 | ở **`render/home.ts:47-68`** (EN) + **`:145-164`** (VI). `index.ts` là barrel re-export. |
| `og-image.png` = 1200×630 "không vuông" | `file` → **JPEG 1024×1024 — ĐÃ VUÔNG**. Luận cứ chính của Task 1 sụp. |
| cache key `pr:v30` (CLAUDE.md) | thực tế **`pr:v32`** (`_middleware.ts:462`). CLAUDE.md stale. |

**Sẽ đụng vào:** `functions/_lib/render/home.ts` (2 object), `tests/seo.spec.ts` (1 assertion),
tuỳ D2 thêm `index.html:49`.

**Ràng buộc đã ghi trong repo:** `docs/prerender-cache-log.md` — append 1 dòng mỗi lần bump.

---

## 4. Phương án

### Option A — chỉ `home.ts`, invalidate bằng `?nocache=1` ⭐ khuyến nghị

Effort: 1 nửa ngày · Files: `functions/_lib/render/home.ts`, `tests/seo.spec.ts` · Data: none

- `logo: DEFAULT_OG_IMAGE` → `` `${siteUrl}/android-chrome-512x512.png` `` ở `:56` và `:152`
- `sameAs` `:63-67` và `:159-163` — thêm **chỉ** `https://apps.apple.com/app/id6759968026`
- Chỉ `/` và `/vi` đổi output → `curl ".../?nocache=1"` + `curl ".../vi?nocache=1"`, **không bump `pr:v32`**

Được: diff ~6 dòng; không đụng cache của mọi route khác.
Mất: `publisher.logo` ở blog/news vẫn là `og-image.png`.

### Option B — lan sang `blog.ts` + `news.ts`, bump `pr:v32→v33`

Effort: 1 nửa ngày code + rủi ro vận hành · Files: thêm `blog.ts:92,188`, `news.ts:149`

Được: logo đồng nhất mọi surface.
Mất: **bump = xoá cache prerender MỌI route**. Cold render gọi Supabase (`home.ts:119-123`
query 3 bảng; blog/news/tournament tương tự) với `RENDER_BUDGET_MS` timeout. TTL hiện tại 6h
(`_middleware.ts:499-510`), nên toàn bộ bot traffic đập vào cold cache cùng lúc.

**Vì sao B thua:** giá trị thấp. `publisher` ở `blog.ts:88-92,187-188` và `news.ts:145-149` là
**Organization ẩn danh, KHÔNG có `@id`** trỏ về `${siteUrl}#org` — Google không nối chúng vào
brand entity, nên đổi logo ở đó không cộng vào tín hiệu brand đang cần. Đổi lấy một lần nuke
cache toàn site là lỗ.

→ **Gộp blog/news vào PR SSR kế tiếp nào đã phải bump cache sẵn.** Lúc đó chi phí bằng 0.

### Option C — làm đúng nguyên văn work order (thêm cả Play Store URL)

**Loại.** `sameAs` sẽ trỏ vào URL 404. Xem D1.

### Increments

1. `home.ts` logo + sameAs (EN+VI) — verify `npx tsc --noEmit` + curl Googlebot `/` và `/vi`
2. Assertion trong `tests/seo.spec.ts` — verify `npm run test` / e2e
3. Sau merge: `?nocache=1` × 2, rồi curl lại xác nhận HTML mới; Cuong Request Indexing `/` + `/vi` + `/blog/...-2026`

---

## 5. UI/UX

Không áp dụng — JSON-LD không có bề mặt người dùng. Cuong duyệt bỏ `ui-ux-critic`.

---

## 6. Rủi ro

### Verdict: 🟢 GREEN *(tự chấm, không có `risk-auditor`)*

`risk-tier.mjs` không chạy được (`scripts/agents/` không tồn tại). Không có classifier đối chiếu.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | **Cao (đã chặn)** | `sameAs` trỏ URL 404 (Play Store) | Bot: tín hiệu entity bẩn | **Đã verify 404, loại khỏi phạm vi** → D1 |
| 2 | Thấp | JSON-LD hỏng làm Google bỏ TOÀN BỘ schema trang chủ | Mất WebSite + SearchAction | **Không xảy ra được.** `jsonLd` là object TS, serialize qua `JSON.stringify` + `escapeJsonLd` (`html.ts:161`, `utils.ts:12-18`). Không phải chuỗi viết tay. `tsc` bắt lỗi cú pháp. |
| 3 | Thấp | Logo mới không hợp lệ với Google | Mất logo trong knowledge panel | **Đã verify hợp lệ** — xem dưới |
| 4 | Thấp | Quên `?nocache=1` → bot vẫn thấy HTML cũ tới 6h | Chậm hiệu lực, không sai | Checklist bước 3; curl xác nhận sau |
| 5 | Rất thấp | `CANONICAL_HOST` trên preview khác default → logo URL trỏ host preview | Không ảnh hưởng prod | Dùng `${siteUrl}` giống hệt 12 file khác đang làm (`sitemap-*.ts`, `robots.txt.ts`, `rss.xml.ts`). Nhất quán > hardcode. |

**Logo hợp lệ — verify từng điều kiện của Google** ([Logo structured data](https://developers.google.com/search/docs/appearance/structured-data/logo)):

| Yêu cầu Google | `android-chrome-512x512.png` |
|---|---|
| ≥ 112×112 px | ✅ `file` → PNG 512×512 RGBA |
| Format Google Images hỗ trợ | ✅ PNG |
| URL crawlable + indexable | ✅ prod `HTTP/2 200`, `content-type: image/png`, 13.917 B; `robots.txt` = `Allow: /`, không có rule chặn ảnh |
| Nhìn đúng trên nền trắng | ⚠️ **Cuong phải tự kiểm** — PNG có alpha (RGBA), logo sáng màu trên nền trắng có thể chìm |
| Bắt buộc landscape? | ❌ **Không.** Doc Google không quy định tỉ lệ. (Yêu cầu 600×60 ngày xưa là của **AMP** — site này không dùng AMP.) |

**SLO:** không đụng. Không có DB write, không đụng scoring/bracket.

**Perf:** bundle +0 KB (`functions/` không vào bundle client). Không đụng Vietnam p75.

**SEO:**
- Route SSR bị đụng: `/` và `/vi` — chỉ 2
- Bump `pr:v32`? **Không** — dùng `?nocache=1` (`_middleware.ts:463`, so sánh `=== "1"`)
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/` → 200 + `"logo"` mới + vẫn còn `"@type":"WebSite"` + `alternateName` + hreflang en/vi/x-default

**Rủi ro chưa định lượng được (nói thẳng vì không verify được):** đổi `logo` của một entity
đang có thứ hạng brand ổn định **có làm Google reset/đánh giá lại knowledge-panel signal
không** — không tìm được tài liệu chính thức khẳng định hoặc phủ nhận. Không coi đây là rủi ro
bằng 0; coi là **chưa biết**. Nếu anh muốn tránh hoàn toàn, phương án bảo thủ là **chỉ thêm
`sameAs` App Store, giữ nguyên `logo`** — vì `og-image.png` vốn đã vuông 1024×1024 và đã hợp lệ,
lý do đổi logo yếu hơn brief tưởng nhiều.

**Rollback:**
- Cơ chế: `git revert` 1 commit → deploy → `?nocache=1` × 2
- Thời gian khôi phục: ~5 phút (thời gian deploy Cloudflare Pages)
- **Không có cache mồ côi** vì không bump key — đây chính là lý do Option A hơn B ở khoản rollback
- Không revert được: **không có gì**. Không migration, không native build, không push đã gửi.

**Detection:** assertion ở bước 2 chạy trong e2e; ngoài ra
`curl -A "Googlebot" https://www.thepicklehub.net/ | grep -o '"logo":"[^"]*"'`.

### Phản biện độc lập (GPT-5.6)

**Không có.** Agent không chạy được. Đây là lỗ hổng lớn nhất của báo cáo này —
mọi kết luận ở mục 4 và 6 đều là Claude tự chấm bài của Claude.

---

## 7. Tranh luận trong panel

**Không có panel → không có tranh luận.** `debate.json` không được tạo vì không có 2 phía.

Thứ gần nhất với tranh luận trong lần chạy này: `idea-recon` **bác bỏ 3 khẳng định trong work
order** (file sai, ảnh đã vuông sẵn, cache version stale), và verify của orchestrator **bác bỏ
1 khẳng định nữa** (Play Store URL 404). 4/4 lần repo thắng brief — đúng ground rule §3 của
work order.

---

## 8. Kế hoạch verify

**Tự động:**

- [ ] `npx eslint functions/_lib/render/home.ts`
- [ ] `npx tsc -b --noEmit`
- [ ] `npm run test` (gồm `redirect-parity.test.ts`)
- [ ] `npm run build`
- [ ] `BASE_URL=<preview> ./scripts/seo-verify.sh`
- [ ] Post-deploy: `curl -A "Googlebot" /` và `/vi` → 200 + logo mới + WebSite + alternateName còn nguyên

**Cuong phải tự làm:**

- [ ] **Trả lời D1 + D2** — app Android đã publish chưa?
- [ ] Nhìn `android-chrome-512x512.png` trên nền trắng — logo sáng màu có chìm không?
- [ ] GSC Request Indexing: `/`, `/vi`
- [ ] GSC Request Indexing: `/blog/best-pickleball-tournament-software-2026` (đóng đuôi Task 2)

---

## 9. Sau khi ship

**SHIPPED** — PR [#480](https://github.com/cuongnguyen84/pickle-hub-pro/pull/480), merge `90685e0e`, 2026-07-27.
Merge với check đỏ (ngân sách Actions cạn repo-wide từ 26/07). Local: tsc 0 · eslint 0 · 1235 test pass.

**D1 — Cuong chốt: app Android chưa publish → bỏ Play Store.**
Chỉ thêm `https://apps.apple.com/app/id6759968026` vào `sameAs` (EN + VI).
URL Play Store mà brief yêu cầu trả **404 mọi locale và mọi biến thể app-id** — nhét vào `sameAs`
là bôi bẩn đúng cái entity mà khối này sinh ra để làm sạch.

**D2 — xoá luôn.** `index.html` mang smart banner `google-play-app` trỏ cùng app không tồn tại đó.
Gỡ; banner Apple giữ nguyên.

**CỐ Ý KHÔNG LÀM: `Organization.logo`.** Tiền đề của brief ("og-image 1200×630 không vuông") **SAI** —
nó là JPEG **vuông 1024×1024**, đã thoả mọi yêu cầu của Google (≥112px, format hỗ trợ, crawlable,
không bị robots chặn). Đổi nó là thay đổi tín hiệu entity trên một brand đang có thứ hạng, **không có
lợi ích nào verify được**, và không tìm được nguồn nào khẳng định hay phủ nhận việc nó có làm Google
đánh giá lại knowledge panel không. Rủi ro chưa định lượng đổi lấy lợi ích bằng 0 → không làm.

**Guard mới:** `functions/_lib/__tests__/brand-sameas.test.ts` — 5 assertion, gồm việc chặn URL
`play.google.com` quay lại trước khi app Android ship. Trước đó **không có test nào** phủ các trường này.

**Khác kế hoạch:** Option A của proposal gồm cả logo; thực tế chỉ làm phần `sameAs`. Không bump
`pr:v32` vì chỉ `/` và `/vi` đổi output → `?nocache=1` hai path.

**Học được:** brief này sai 7/7 lần khi đối chiếu repo. Hai lần nguy hiểm nhất đều là *tiền đề đã cũ
chứ không phải chỉ dẫn sai* — "og-image không vuông" và "chưa có pillar luật VI". Chỉ dẫn nghe hợp lý,
lý do đằng sau thì đã hết hạn. Verify tiền đề trước khi làm theo chỉ dẫn.
