# MEMORY.md — index (đọc đầu mỗi session)

> File index cho daily growth run. Trỏ tới các rule + doc quan trọng.

## ⛔ Ràng buộc công cụ (đọc trước khi lập kế hoạch)
- **Ahrefs / GSC-via-Ahrefs MCP = KHÔNG DÙNG (quyết định 29/6/2026, Cường).** Không có gói trả phí → API trả `Insufficient plan`. KHÔNG gọi bất kỳ tool Ahrefs nào, KHÔNG "re-test blocker #1 / run #N". Metrics khi cần = GSC UI qua Chrome MCP hoặc GA4. Chi tiết: `lessons-learned.md` mục cuối.

## 📄 Memory docs
- `lessons-learned.md` — rule project-scoped + recurring bugs (append-only). Chứa rule Ahrefs ở cuối.

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
