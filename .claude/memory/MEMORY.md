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

## 🛒 Shop closed pilot — checkpoint 14/08/2026
- Branch `feat/shop-closed-pilot`, PR `#578`; checkpoint báo cáo gần nhất: HEAD `ea1ba75c`, CI 8/8 xanh. P2a + P2b + Product Owner acceptance đã hoàn thành local; coverage statements 84.31% (4726/5605).
- Cloudflare staging riêng: `thepicklehub-shop-staging`, URL `https://thepicklehub-shop-staging.pages.dev`; Supabase staging ref `utokwfcljxjkpkaqgheo`. Không thay Pages project `pickle-hub-pro`.
- Staging migration ledger 359; `shop-media-lifecycle` đã deploy; cleanup + reconcile cron đã chạy HTTP 200. B13 canary: logo/cover sống không bị xóa, orphan thật bị xóa, health stuck/failed = 0.
- 16 cron ngoài Shop đang tạm inactive trên staging để giữ tín hiệu acceptance sạch; chỉ `shop-media-cleanup-every-5m` và `shop-media-reconcile-hourly` active. Rollback inventory nằm trong operations docs; không bật-tất-cả.
- Seller Rules v1: effective `2026-08-14T00:00:00+07:00`, SHA-256 `fb62bd471d7b6b27c53d9eeded57dd636aa2f1f1f03db9a4a20abd49d7c70c98`, 33,568 bytes. Privacy Shop VI/EN đã duyệt.
- Staging automated acceptance 6/6 và rollback drill PASS; còn 18 authenticated/manual journeys cần fixture admin TOTP AAL2 + seller/pilot/product/media. Chỉ merge PR sau tổng 24/24, responsive/axe trên dữ liệu thật, leakage scan và teardown sạch.
- Quyết định PO: Claude được tạo fixture staging tổng hợp, TOTP thật, không PII/người bán thật; giữ 16 cron ngoài Shop inactive trong acceptance. `shops.owner_user_id` là privacy-hardening debt hậu pilot, không vá grant vội.
- B14 vẫn là defect nền tảng: cleanup delete-account có thể lỗi nhưng endpoint báo success. Closed pilot an toàn nhờ shop owner bị chặn 409 trước cleanup; không mở lại self-delete và không cấp grant lẻ.
- Chưa merge, chưa chạm production, indexing OFF, không sitemap/IndexNow, Wave 1 chưa được phép. Sau staging 24/24: merge → production preflight/deploy → Wave 0 nội bộ; B13 phải có trước cron và không rotate `CRON_SECRET` production.
