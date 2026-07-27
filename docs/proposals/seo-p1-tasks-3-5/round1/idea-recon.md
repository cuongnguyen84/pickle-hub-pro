# round1 / idea-recon — SEO P1 Task 3 + 4 + 5

**Agent:** `idea-recon` (Claude, read-only) · **Chạy:** 2026-07-27, HEAD `4708b2ea`
**Output dưới đây NGUYÊN VĂN từ agent.**

---

## Dòng đầu — Task 3 ĐÃ LÀM XONG HOÀN TOÀN

`docs/seo-tools-cluster-intent-map.md:1-9` tự khai **STATUS: CLOSED 2026-07-26**, tất cả 5 bước Sprint 1 đã ship (PR #449 + các PR sau) đúng nội dung Task 3 brief yêu cầu (301 free-pickleball-bracket-generator→/tools, gộp 2 bài thành 1 guide, re-angle round-robin, upgrade `/tools`). Không còn việc code nào của Task 3, chỉ còn mốc đọc kết quả `2026-08-23 SEO-CLUSTER-READ`. "Free alternative to pickleballbrackets.net" section **cố ý KHÔNG làm** (`intent-map.md:9-15`, lý do ghi rõ: cạnh tranh brand đối thủ mới 133 impr/0 click, chưa đủ dữ liệu quyết định).

## Task 3 — chi tiết verify

- `pickleball-bracket-templates` KHÔNG còn entry trong `src/content/blog/metadata.ts` (chỉ còn comment dòng 628-629 giải thích đã merge) và KHÔNG có file trong `src/content/blog/posts/`.
- `how-to-create-pickleball-bracket` tồn tại (`metadata.ts:568`), `pickleball-round-robin-generator-guide` tồn tại (`metadata.ts:661`), cả 2 có `path: "/tools"` / `/tools/quick-tables` trong `internalLinks` — đã link về money page (`how-to-create-pickleball-bracket.ts:82`, `pickleball-round-robin-generator-guide.ts:54-55`).
- VI Supabase (query Management API thật): `cach-tao-bracket-pickleball` (alternate_en_slug=how-to-create-pickleball-bracket) và `cong-cu-tao-vong-tron-pickleball` (alternate_en_slug=pickleball-round-robin-generator-guide) — cả 2 published, có alternate_en_slug đúng.
- `/tools` = `src/pages/Tools.tsx`, section content ở `src/components/seo/ToolsSeoContent.tsx`, SSR = `functions/_lib/render/tools.ts`. `/tools/quick-tables` là route thật (`src/App.tsx:539`).
- Cơ chế 301: `BLOG_MERGED` (`functions/_middleware.ts:315-318`) + `BLOG_TO_TOOLS` Set + `VI_BLOG_DIRECT` (`:322-325`, có VI twin `cong-cu-tao-bracket-pickleball-mien-phi-2026 → /vi/tools`). `src/__tests__/redirect-parity.test.ts` khóa `VI_BLOG_REDIRECTS` + `BLOG_TO_TOOLS` giữa `public/_redirects` và `_middleware.ts` — thêm rule mới phải sync cả 2 file hoặc test đỏ.

## Task 4 — map

- `hcmc-open-2026-preview` tồn tại (`metadata.ts:99`, file `posts/hcmc-open-2026-preview.ts`); VI = `hcmc-open-2026` (alternate_en_slug đúng, published).
- `ppa-tour-asia-2026-lich-thi-dau-tien-thuong` tồn tại, published, alternate_en_slug=`ppa-tour-asia-2026-complete-guide`. Bài "calendar" = `vietnam-pickleball-tournament-calendar-2026` (`metadata.ts:115`). World Cup pos-2 = `pickleball-world-cup-2026-da-nang-how-to-watch` (`metadata.ts:32`, đã có "how to watch" trong title — companion này **đã tồn tại**, không phải việc mới).
- `BlogSection` (`src/content/blog/types.ts:1-8`): chỉ có `content: string` + `internalLinks?: {text,path}[]`, không có field link ngoài — verify đúng brief.
- Render prose: client `src/pages/BlogPost.tsx:293` = `<p>{section.content}</p>` (React escape, KHÔNG auto-link URL). SSR `functions/_lib/render/blog-body.ts:34` = `<p>${escapeHtml(s.content)}</p>` — cũng plain text. **Kết luận: chèn URL vào `content` string sẽ hiện ra như text trần, không bấm được, ở cả 2 tầng.** `internalLinks` không dùng được cho URL ngoài: client dùng `<Link to={link.path}>` (react-router, path nội bộ), SSR nối `href="${siteUrl}${l.path}"` — một URL tuyệt đối ngoài (ticketbox.vn) sẽ bị nối chuỗi sai (`.../hthttps://ticketbox.vn/...`).
- Homepage story: `src/pages/Index.tsx:110-135` — tự động lấy top-6 `blogMetadata` sort theo `publishedDate`, không cần sửa code, chỉ cần ngày publish đủ mới để lọt top 2 hiển thị.
- `/live` = `src/pages/Live.tsx` — grep "blog|news|link" ra 0 kết quả, hiện KHÔNG có cơ chế internal-link nào tới bài blog.

## Task 5 — map

- Glossary/thuật ngữ: grep toàn repo chỉ khớp 1 file không liên quan (`pickleball-vs-padel-vs-paddle-tennis.ts`). **Chưa có bài glossary EN hay VI nào.**
- `pickleball-rules-complete-guide` tồn tại, đã có heading "**The Kitchen (Non-Volley Zone)**" / VI "Kitchen (Non-Volley Zone)" (`posts/pickleball-rules-complete-guide.ts` dòng ~73, 215) → **cannibalization trực tiếp với thuật ngữ "kitchen"** nếu glossary định nghĩa lại. Không có heading nào cho dink/counter/erne/ATP/stacking/poach/let/third-shot-drop.
- Anchor `#kitchen`: KHÔNG có cơ chế sinh `id=` cho heading ở cả client (`BlogPost.tsx:262` `<h2>{section.heading}</h2>`, không id) và SSR (`blog-body.ts:33` `<h2>${escapeHtml(s.heading)}</h2>`, không id). **Đây là blocker thật** — `#kitchen` sẽ không nhảy tới đâu cả trừ khi code thêm slugify+id.
- `BLOG_POST_META` xác nhận generated (`functions/_lib/render/blog-meta.ts:2-3` comment "GENERATED at module load"), `static-blog-slugs.ts` cũng generated từ `blogMetadata` (comment dòng 1-5, `export const EN_BLOG_SLUGS = blogMetadata.map(p => p.slug)`).
- VI insert: schema `vi_blog_posts` cột bắt buộc = `content_html`, `meta_description`, `meta_title`, `slug`, `title` (NOT NULL trong Insert type, `types.ts:6993-7014`); `growth-tasks/sql/` chỉ có 2 file cũ (2026-05-05), không liên quan cluster này — SQL cho các bài VI mới trong sprint vừa rồi không nằm ở đây (có thể ghi trực tiếp qua Management API không lưu file).

## Chung

- `growth-tasks/CONTENT-PLAN-tuan28-30-2026-07-06.md` **KHÔNG TỒN TẠI** (find rỗng) — brief trích dẫn sai lần thứ 5.
- `.gsc-index-queue.json` **KHÔNG TỒN TẠI** trong repo (find rỗng). Không có cơ chế queue tương đương nào khác.
- `functions/api/indexnow.ts` **tồn tại**.

---

## Ghi chú orchestrator (KHÔNG phải output agent)

**Bảng tổng kết work order sau recon — 5/5 task:**

| Task | Trạng thái |
|---|---|
| 1 — brand schema | Còn việc (đã có proposal `seo-p1-2026-07`), brief sai 3 chỗ + URL Play Store 404 |
| 2 — redirect non-www 2025 | **ĐÃ XONG** trước khi work order được viết |
| 3 — gộp cụm /tools | **ĐÃ XONG** 2026-07-26, closed |
| 4 — sự kiện HCMC/World Cup | Một phần đã xong (companion World Cup đã tồn tại); còn internal link + companion vé HCMC |
| 5 — glossary | Chưa làm; có 1 blocker kỹ thuật (anchor id) + 1 rủi ro cannibalization (kitchen) |

**Tiền đề của Cuong bị recon bác:** Cuong đã chọn "chèn prose có URL" cho nút vé Ticketbox
(Task 4) dựa trên giả định URL trong prose sẽ dùng được. Recon chứng minh **cả client
(`BlogPost.tsx:293`) lẫn SSR (`blog-body.ts:34`) đều escape và render text trần** — URL sẽ
không bấm được. `internalLinks` cũng không thay thế được (nối chuỗi sai với URL tuyệt đối).
→ Quyết định của Cuong dựa trên tiền đề sai, phải hỏi lại. Đây là input chính cho panel.

**Brief sai lần thứ 5 và 6:** `CONTENT-PLAN-tuan28-30` và `.gsc-index-queue.json` không tồn tại.
