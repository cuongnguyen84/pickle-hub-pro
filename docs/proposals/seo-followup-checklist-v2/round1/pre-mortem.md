# pre-mortem — VÒNG 1 (nguyên văn, 02/08/2026)

Đã đọc: intake, recon, `functions/_lib/render/venues.ts`, `functions/sitemap-venues.xml.ts`, `functions/_middleware.ts`, `public/_redirects`, `src/__tests__/redirect-parity.test.ts`, `tests/seo.spec.ts`, `scripts/seo-verify.sh`, `scripts/seo/*.py`, `functions/_lib/html.ts`, `functions/_lib/utils.ts`, `functions/_lib/seo-helpers.ts`, `.claude/memory/lessons-learned.md`, `docs/ops-runbook.md` §5, `docs/prerender-cache-log.md`, và cả hai bộ export GSC trong `~/Downloads/`.

**Một dữ kiện phải sửa trước khi kể chuyện** — brief nói "site sống nhờ 1 bài blog top (52/263 clicks)". Sai. Đo từ `Trang.csv` (1000 dòng):

| Cụm | Clicks | Impressions |
|---|---|---|
| `/san/*` (venue) | **657 / 1170 = 56%** | **52 491 / 63 253 = 83%** |
| `/blog/*` (cả EN+VI) | 210 = 18% | — |
| `/vi/blog/singapore-open-2026` | 52 = 4,4% | 263 |

Và bài mà checklist định "mở rộng internal link" — `/blog/singapore-open-2026-recap`, file có thật trong repo — có **0 click / 15 impression**. Trang 52 click là `/vi/blog/singapore-open-2026`, một row trong Supabase `vi_blog_posts`, **không phải file này**, và nó là bài *preview* chứ không phải recap (`/vi/blog/singapore-open-2026-ket-qua` = recap, 1 click). Site sống nhờ **cụm sân**, không nhờ bài blog. Ba postmortem xoay quanh sự thật đó.

---

### Sự cố 1 — "Cụm /san mất 61% click hữu cơ trong 5 tuần; không exception, không alert"

**Xác suất:** cao · **Phát hiện:** 24–35 ngày

**Timeline:** executor thi hành mục *Index coverage*, đọc comment `venues.ts:52-58` ("tighten the bar when S2 enrichment lands") như lời mời → siết `isThinVenue()` từ OR sang AND. Test/lint/build xanh. Sau 6h TTL, Googlebot thấy `noindex` trên vài trăm trang `/san/*`; sitemap co lại; Google recrawl dần và rớt index từng trang trong 3-4 tuần. T+28 ngày: `Discovered – not indexed` giảm 138→40 → **metric checklist báo THÀNH CÔNG** trong khi tổng click giảm ~1170→~520.

**Cơ chế:**
- `isThinVenue()` là predicate dùng chung 2 tác dụng: noindex meta (`venues.ts:489`) + loại sitemap (`sitemap-venues.xml.ts:58`) → một dòng sửa, hai hậu quả, mất luôn đường cho Google quay lại.
- Khối "Sân pickleball khác tại <city>" (`venues.ts:435-447`) **không lọc** `isThinVenue` → sau siết, internal link trỏ hàng loạt vào trang noindex; sân sống sót mất inbound link. Cụm tự ăn chính nó.
- Vòng phản hồi ngược: 138 Discovered chính là 691×2 stub đã noindex từ trước → siết thêm không giảm được số, executor siết tiếp. Metric thưởng cho hành động phá hoại.

**Gate mù:** `tests/seo.spec.ts:286-378` chỉ assert urlset không rỗng + fetch URL **đầu tiên** (sort `updated_at DESC` → luôn lấy hàng khoẻ nhất). Không assert số lượng. Không test nào đọc meta robots của venue. `SSR_ROUTES` và `seo-verify.sh` không có `/san/*` — 83% impression không có một dòng test. Không SLO organic.

**Khó sửa:** `git revert` khôi phục predicate, không khôi phục index — 4-10 tuần recrawl với DR thấp, mất position history.

**Dấu hiệu sớm lẽ ra có:** `grep -c "<loc>"` sitemap-venues co ~1400→40 ngay T+2h — không gì nhìn nó.

---

### Sự cố 2 — "61 dòng 301 sống 9 tuần không redirect được URL nào; GSC 404 không nhúc nhích"

**Xác suất:** cao · **Phát hiện:** ~60 ngày hoặc không bao giờ

**Cơ chế — 5 mắt xích:**
1. `public/_redirects:76` — dòng cuối `/* /index.html 200`, first-match-wins → rule append sau nó là code chết, không warning.
2. `src/__tests__/redirect-parity.test.ts:26-33` — parse file như *tập hợp* (Record), Cloudflare đọc như *danh sách có thứ tự* → rule chết vẫn xanh.
3. Phạm vi test chỉ `/blog|/vi/blog` — 61 URL 404 (`/nguoi-choi/*`, `/clb/*`, `/social/*`, `/tran-dau/*`…) ngoài phạm vi.
4. **Bot không bao giờ đọc `public/_redirects`** — `_middleware.ts` chạy trước; codebase tự ghi bài học này 3 lần (`_middleware.ts:296-302`, `:343-348`, `:356-361`) nhưng chỉ khoá cho blog.
5. `GONE_EXACT` (`_middleware.ts:130-146`) đã trả 410 cho ~24/61 URL → thêm 301 tạo "hai chân lý": user thấy 301, bot thấy 410; GSC không giảm vì với Google chúng là 410 đúng ý đồ.

Cộng: validation GSC nhóm 404 đang `Đã bắt đầu` → đổi response giữa chừng dễ FAILED, Google hạ tần suất recrawl lô đó.

**Gate mù:** build không parse `_redirects`; parity test ngoài phạm vi + sai mô hình; seo-verify.sh route cứng; soak không có traffic tới URL chết; review diff 61 dòng đúng cú pháp — cái sai là VỊ TRÍ khối, không phải nội dung dòng.

**Dấu hiệu sớm lẽ ra có:** curl Googlebot cả 61 URL (~20 giây) thay vì 3 URL mẫu; seo-verify.sh không nhận URL list từ tham số nên "verify" không đụng thứ vừa đổi.

---

### Sự cố 3 — "Sprint CTR 28 ngày kết luận NGƯỢC: title venue bị cắt byte ngay từ đầu" ⚠️ CƠ CHẾ ĐANG SỐNG TRÊN PROD

**Xác suất:** cao (đo được hôm nay) · **Phát hiện:** không bao giờ, bằng chính pipeline này

**Cơ chế:** `venues.ts:306-309` tiền-kiểm `.length <= 60` (KÝ TỰ) rồi mới quyết định có gọi `buildTitle` không; `html.ts:98,157` cắt theo BYTE (60). Title 53 ký tự = 61 byte → qua cửa ký tự, bị xén byte → `"BaCa Pickleballs Nguyễn Chánh – Hà Nội |…"`. Đo 10 tên sân thật từ Trang.csv: **5/10 đang ship title cụt**, cả 5 trong top-25 click. Y hệt ở description: `seo-helpers.ts:169` đếm ký tự, `html.ts:99,158` cắt 160 byte → đuôi local-intent (từ khoá thành phố) bị cắt trên mọi trang venue tiếng Việt. `venues.ts` là handler DUY NHẤT có cửa phụ này — 15 handler khác gọi `buildTitle()` vô điều kiện. Cửa phụ được thêm **vì lý do CTR** (comment `venues.ts:290-295`) — sprint CTR mới sẽ chạy trên đống đổ nát của sprint CTR cũ.

Kịch bản: executor sửa title thêm local intent (dài hơn về byte) → verify bằng `dk pickleball club` (ASCII, 44 byte — sân duy nhất không lỗi) → 28 ngày sau CTR GIẢM 1,8%→1,4% → verdict sai "venue title không cải thiện CTR" ghi vào milestone → deprioritize đúng cụm 56% click suốt một quý. Thêm: `docs/prerender-cache-log.md` dừng ở v30, comment `_middleware.ts:576-578` nói "Current: v29", code là v32 — ba nguồn ba số.

**Gate mù:** `utils.test.ts:83` khoá HÀM `buildTitle` byte-safe (bài học #468) nhưng bug ở CALLER đi vòng; sitemap sweep chỉ assert title truthy/không-undefined — title cụt vẫn pass; không route `/san` trong gate nào.

**Khó sửa:** code 5 dòng, rẻ. Không revert được: verdict sai đã ghi + 28 ngày data GSC nhiễm + baseline 01/08 hết so được.

---

## Xếp hạng

| # | Sự cố | Xác suất | Đau | Khó phát hiện | Chặn bằng gì | Ưu tiên |
|---|---|---|---|---|---|---|
| 3 | Title/desc venue cắt byte sau đếm ký tự → sprint CTR kết luận ngược | cao (đang sống) | 7 | Không bao giờ | Xoá nhánh `.length` venues.ts:306-309, luôn buildTitle; seo-helpers.ts:169 sang byte; assert không có đuôi cụt | **1** |
| 1 | Siết isThinVenue() deindex 56% click; coverage metric báo thành công | cao | 9 | 24-35 ngày | Floor `<loc>` count cho sitemap-venues (≥900) trong seo.spec.ts | **2** |
| 2 | 61 dòng 301 chết sau SPA fallback + bot không đọc _redirects | cao | 5 | ~60 ngày/không bao giờ | Test "SPA fallback phải là rule cuối"; 301 SEO vào _middleware.ts | **3** |

## Rẻ nhất để chặn (~15 dòng, toàn test/assert)
1. Floor số lượng sitemap: `SEGMENT_MIN_URLS = { "sitemap-venues.xml": 900 }` + 3 dòng assert trong sweep.
2. Byte không phải ký tự: xoá tiền-kiểm venues.ts:306-309; seo-helpers.ts:169 dùng TextEncoder; assert `not.toMatch(/[|·–]\s*…$/)`.
3. Thứ tự _redirects load-bearing: assert dòng non-comment cuối là `/* /index.html 200`.

## Khoảng hở pipeline
1. Mọi gate SEO là route-list cứng viết hồi blog là câu chuyện — traffic đã sang /san (83% impr), không gate nào theo. Route list nên sinh từ top-20 GSC.
2. Gate kiểm tồn tại, không kiểm độ lớn (truthy/không-rỗng vs magnitude).
3. Gate lấy mẫu hàng khoẻ nhất (sort updated_at DESC + first URL).
4. Bài học khoá HÀM không khoá CALLER — #468 tái phát qua đường vòng.
5. Không SLO organic — sự cố SEO theo định nghĩa không ai bị đánh thức.
6. "Done khi" phải là script chạy được, không phải câu tiếng Việt.
