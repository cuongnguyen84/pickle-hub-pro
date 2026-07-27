# Debate ledger — seo-p1-tasks-3-5

> `scripts/agents/debate-ledger.mjs` **KHÔNG TỒN TẠI** trong repo (`scripts/agents/` không có).
> Luật vòng 2 được **orchestrator cưỡng chế thủ công**. Luật áp dụng:
> *chỉ đổi lập trường khi trích được file/dòng CHƯA thấy ở vòng 1.*
> Bảng dưới đây là kết quả kiểm tra thủ công đó — kiểm lại được bằng `round1/*.md` vs `round2/*.json`.

## Kết quả

| # | Chủ đề | Agent | Vòng 1 | Vòng 2 | Bằng chứng mới | Hợp lệ? |
|---|---|---|---|---|---|---|
| **D1** | Tier Task 4 | `risk-auditor` | 🔴 RED (cả Task 4) | **REFINE** → RED thu về **đúng 1 bước** | `growth-tasks/sql/` = 2 file INSERT-only, 0 file có câu khôi phục; `grep vi_blog_posts supabase/migrations/ \| grep trigger\|audit\|history` = 0; `blog.ts:46` lọc `status='published'` → Task 4 là **UPDATE lên hàng đang rank**, không phải INSERT; tiền lệ `ds-03/proposal.md:45` | ✅ |
| **D1** | | `solution-architect` | "không bước nào RED" | **CONCEDE** | `_TEMPLATE.md:51` — định nghĩa RED của repo là *"không revert được bằng `git revert`"*, **không đọc ở vòng 1**; anh ấy đã dùng bảng tier trong prompt của chính mình | ✅ |
| **D2** | Sửa link ngoài EN | `ui-ux-critic` | 1 dòng `blog-body.ts:51` | **REFINE** → vẫn sửa 1 dòng (vá bẫy) **nhưng chấp nhận C4 cho CTA vé** | `grep 'rel=' BlogPost.tsx blog-body.ts ViBlogPost.tsx` → **0 kết quả** (chưa soi vòng 1); `BlogPost.tsx:307-318` gói mọi `internalLinks` vào chuỗi hardcode `"See also:"` **cuối section** | ✅ |
| **D2** | | `solution-architect` | Option C4 (thêm field) | **CONCEDE** → bỏ C4 | `node_modules/react-router-dom/dist/index.js:744-795` (v6.30.4) — `<Link>` **đã** render `<a href>` thật cho URL tuyệt đối, không intercept. Lý do tồn tại của C4 sụp. | ✅ |
| **D3** | Task 5 VI có zero-code không | `ui-ux-critic` | 3 blocker | **HOLD** | Playwright 1.61.1 headless Chromium, Pixel 5 390×844, **chạy vào PROD**: deep link lạnh `#quang-duong` → `scrollTop=0`, `headingTop=3379px`; F5 y hệt (hỏng 100%, không phải race); trang ấm → cuộn được nhưng `headingTop=0` vs `navBottom=61` | ✅ |
| **D3** | | `solution-architect` | "zero code, Files: KHÔNG có" | **CONCEDE** | `ViBlogPost.tsx` 155 dòng không có `location.hash`/`scrollIntoView`; `grep 'scroll-margin' src/ functions/ index.html` = **0 toàn repo**; `the-line.css:135-137` nav sticky top:0 | ✅ |

## Nhượng bộ bị LOẠI

**Trống.** 6/6 lần đổi lập trường đều kèm bằng chứng chưa xuất hiện ở vòng 1.

## Bất đồng sống sót (cùng dữ kiện, khác đánh giá)

**Trống.** Cả 3 bất đồng bị giải quyết bằng bằng chứng, không phải bằng thoả hiệp.

Đáng ghi: **D2 hai agent đi ngược chiều nhau và giao nhau ở giữa** — `ui-ux-critic` đi từ "1 dòng là đủ" sang "cần C4", `solution-architect` đi từ "cần C4" sang "1 dòng là đủ". Cả hai đều có bằng chứng mới hợp lệ. Kết quả hội tụ: **cả hai việc đều làm, nhưng khác lý do và khác thời điểm** — vá bẫy `blog-body.ts:51` ngay (nó là bug độc lập), `externalLinks` để trước 30/8 cho World Cup EN.

## Dữ kiện mạnh nhất mà vòng 2 tạo ra (vòng 1 không có)

1. **Anchor VI hỏng 100%, đo bằng số trên prod** — và `window.scrollTo()` là **no-op câm** vì trang cuộn ở `DIV.tl-scroll`, không ở document (`document.scrollingElement.scrollHeight = 844` = đúng chiều cao viewport). Ai vá bằng `window.scrollTo` sẽ thấy code chạy, không lỗi, và không có gì xảy ra.
2. **`react-router-dom@6.30.4` đã xử URL tuyệt đối** — nửa client của "blocker link ngoài" chưa bao giờ hỏng.
3. **`rel=` không tồn tại ở bất kỳ renderer blog nào** — link vé thương mại sẽ thiếu `nofollow sponsored` ở mọi phương án dùng `internalLinks`.

## Đồng thuận cross-vendor (Claude ↔ GPT-5.6 — loại đồng thuận DUY NHẤT có trọng số)

- URL Ticketbox text trần là **Blocker**, không phải "chấp nhận được cho 1 bài 10 ngày"
- CTA vé phải nằm **giữa bài**, ngay sau mục "at a glance", không phải ở đáy
- **Không được bịa** thông tin vé — dẫn thẳng sang Ticketbox
- Bản VI dùng `prose` thay `.tl-longform` là mất mát cho 95% người dùng *(hai model độc lập chỉ ra cùng chỗ)*
- Bump `updatedDate` trên prose stale = site tự bảo chứng thông tin cũ
- Race hreflang EN↔VI + KV đóng băng 6h
- Rollback bất đối xứng repo ↔ Supabase

## Cảnh báo: đồng thuận KHÔNG có trọng số

`risk-auditor` và `pre-mortem` cùng phe "đi tìm cái hỏng" nên gật đầu với nhau nhiều (rollback bất đối xứng, KV 6h, `vi_blog_posts` ngoài pipeline, mọi gate đều là `curl -A Googlebot`). **Hai Claude cùng nhiệm vụ đồng ý với nhau chỉ chứng minh chúng cùng là Claude.** Không gán trọng số cross-vendor cho các mục này.

Riêng `risk-auditor` tự ghi một câu đáng giữ: *"GPT-5.6 và em độc lập ra 6 finding trùng nhau. Điều đó **không** làm chúng đúng hơn — chúng đúng vì em đã mở đúng file và chạy đúng lệnh. Ba finding mạnh nhất đều **không** đến từ GPT-5.6; chúng đến từ `curl` và `node -e`."*
