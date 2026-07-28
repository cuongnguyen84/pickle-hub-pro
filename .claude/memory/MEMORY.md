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
