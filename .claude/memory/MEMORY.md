# MEMORY.md — index (đọc đầu mỗi session)

> File index cho daily growth run. Trỏ tới các rule + doc quan trọng.

## ⛔ Ràng buộc công cụ (đọc trước khi lập kế hoạch)
- **Ahrefs / GSC-via-Ahrefs MCP = KHÔNG DÙNG (quyết định 29/6/2026, Cường).** Không có gói trả phí → API trả `Insufficient plan`. KHÔNG gọi bất kỳ tool Ahrefs nào, KHÔNG "re-test blocker #1 / run #N". Metrics khi cần = GSC UI qua Chrome MCP hoặc GA4. Chi tiết: `lessons-learned.md` mục cuối.

## 📄 Memory docs
- `lessons-learned.md` — rule project-scoped + recurring bugs (append-only). Chứa rule Ahrefs ở cuối.

## 🚨 Supabase Edge Function blob-loss — ticket support đang mở (24/7/2026)
- Supabase Support đã escalate lỗi `NOT_FOUND_FUNCTION_BLOB`; **không đóng ticket chỉ vì redeploy chạy lại**. Update mới nhất đã gửi support: `pro-tour-trigger-scrape` ACTIVE nhưng mất blob lúc 15:11 UTC 24/7, request ID `019f94ae-7afc-730d-a6f5-92a3436add25`; redeploy cùng source lúc ~15:20 UTC thì hồi phục. User đã xác nhận nút Scrape prod hoạt động lại. Chờ support trả lời.
- Chi tiết timeline, tác động, verify và cách heal: `lessons-learned.md` mục **2026-07-24 — Supabase Edge Function blob-loss**.
- GitHub Actions self-heal hiện không chạy vì billing/spending-limit; run `30104415254` chết trước runner. CLI local đã login lại và deploy được.

## ⚠️ 3 rule hay dính nhất khi làm content/SEO (thêm 17/7/2026)
- **Blog EN chỉ còn 2 file + Supabase** (SEO-02, `ce6a0fa`): `posts/<slug>.ts` + `metadata.ts` (nguồn duy nhất) + INSERT `vi_blog_posts`. **KHÔNG hand-edit** `render/blog-meta.ts` và `static-blog-slugs.ts` — chúng GENERATED từ `metadata.ts`. Rule "4 files" cũ đã lỗi thời.
- **Đừng khẳng định "chưa công bố" chỉ vì báo chưa đăng** — phải đọc kênh chính thức của giải/sự kiện. Và phân biệt *đã công bố / đã đăng ký* với *đã xảy ra*: bài preview thì tương lai ≠ kết quả.
- **Verify production luôn `mktemp -d`**, không `-o /tmp/<tên cố định>` — `/tmp` persistent giữa các session, `curl -o` ghi đè fail im lặng → grep phải file cũ.

## 📄 Workflow chính (trong growth-tasks/)
- `AUTO-PUBLISH-WORKFLOW.md` — publish VI Supabase + IndexNow + GSC queue.
- `CONTENT-CLUSTERS.md` — map cluster + internal-linking status.
- `WEEKLY-PLAN-PROPOSAL-tuan-26-29.md` — kế hoạch hiện tại (Hướng B = content VN-local).
- `reports/YYYY-MM-DD.md` — báo cáo hằng ngày.

## 🧭 Behavioral (từ SKILL): Think → Simple → Surgical → Goal-driven trước mọi code.

## 🛍️ Shop web unified handoff (27/8/2026)
- **Nhánh web shop chuẩn:** `feat/shop-unified` (remote `origin/feat/shop-unified`). Tiếp tục mọi phát triển shop web trên nhánh này; không quay lại `feat/bulk-product-import`, `fix/shop-publish-media-button` hay `fix/shop-equal-card-heights`.
- **Không trộn app native/iOS:** `feat/shop-native-screens` và code dưới `apple/` là luồng riêng do Cường phát triển độc lập.
- **Worktree sạch đang dùng:** `.claude/worktrees/shop-publish-btn` (dù tên cũ, hiện checkout `feat/shop-unified`). Worktree gốc có rất nhiều thay đổi chưa commit của user; không reset/overwrite/merge trực tiếp tại đó.
- **Preview chuẩn:** `https://feat-shop-unified.pickle-hub-pro.pages.dev`.
- **Worker xóa nền:** `https://picklehub-image-background-remover.thecuong.workers.dev`; source tại `workers/image-background-remover/`. CORS đã cho phép preview unified và production. Cloudflare Images binding là `IMAGES`; secrets chỉ lưu trên Cloudflare: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (không ghi giá trị vào repo).
- Chức năng đã gom: import sản phẩm từ template, AI enrichment, category/spec/variant/color, Brave image search, chọn nhiều ảnh, upload ảnh thủ công, xóa nền, publish thẳng storefront, bulk delete seller products và cân chiều cao product card.
- Fix auth xóa nền gần nhất: membership table không có cột `id`; worker phải query `select=shop_id` (`e3065fbb`). Auth errors đã tách thành `session_invalid`, `seller_required`, `auth_unavailable`. **Cần user xác nhận lại thao tác xóa nền end-to-end sau fix này.**
- Commit hợp nhất gần nhất: `0cbee8d3` (CORS preview); merge latest `origin/main` tại `ebed4c06`; card fix `33604c80`.
- Validation khi hợp nhất: TypeScript, ESLint, production build pass; 2 test files / 11 tests pass.
- Untracked user file cần giữ nguyên: `docs/proposals/shop-closed-pilot/HANDOFF-2026-08-18.md`.
