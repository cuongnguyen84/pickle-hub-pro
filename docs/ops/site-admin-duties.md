# Quản trị tổng ThePickleHub — bản đồ công việc & độ phủ agent

> Soạn 2026-09-07 theo yêu cầu Cuong: "1 team agent care toàn bộ công việc".
> Đây là danh mục việc của MỘT quản trị site hoàn chỉnh, đối chiếu với những
> gì đội agent + tự động hoá hiện có đã cover, và lỗ hổng còn lại.
> Thiết kế đội chi tiết: [ai-agent-team.md](../ai-agent-team.md).

## Ký hiệu: ✅ có chủ + tự động · ⚠️ có nhưng thiếu/hỏng · ❌ chưa ai làm

## 1. Sức khoẻ hạ tầng (uptime, lỗi, hồi phục)

| Việc | Ai đang làm | Trạng thái |
|---|---|---|
| Uptime site + trang chính | `uptime-ping.yml` (GitHub Actions) | ✅ |
| Edge functions sống/chết (blob-loss) | `ops-edge-health` (cron probe + Telegram) + worker `edge-blob-watchdog` | ✅ |
| Tự hồi phục blob-loss hằng giờ | `edge-redeploy-hourly` (launchd) | ✅ sửa 07/09: CLI brew + deploy từ worktree riêng bám origin/main (hết phụ thuộc nhánh đang làm việc) |
| Quét chủ động hằng giờ: site probe, shop, hàng đợi dịch, daemon chết câm | `ops_sweep.py` (`com.picklehub.opssweep`, mới 07/09) + digest 21:00 | ✅ alert chỉ khi vấn đề MỚI; shop chỉ báo, không tự huỷ |
| Cron/job fail → alert + nút Xử lý | `errors-telegram-alert`, `ops-job-control` (/jobs /diagnose /retry /fix), `fix-agent` daemon | ✅ |
| Digest job health sáng | `ops-job-digest` 09:15 | ✅ |
| Lỗi JS runtime phía người dùng (error rate thật) | — | ❌ không có error tracking (Sentry-kiểu); chỉ biết khi user báo |
| DB: dung lượng, slow query, connection | — | ❌ không ai đọc pg_stat định kỳ |
| Backup/restore drill định kỳ | drill PASS 22/07 (ops-runbook §6), thủ công | ⚠️ không có lịch lặp lại |

## 2. Bảo mật & truy cập

| Việc | Ai đang làm | Trạng thái |
|---|---|---|
| Scan code (CodeQL, npm audit) | `security.yml`, `npm-audit` CI | ✅ |
| RLS/grant đúng sau mỗi migration | `pgtap.yml` + sweep thủ công khi nghi | ⚠️ sweep không định kỳ (2 lần đều lòi lỗ 4 tháng) |
| Auth registry (80 edge fn đúng chế độ verify) | `edge-auth-parity.yml` + `npm run auth:registry` | ✅ |
| Admin 2FA, secret rotation | 2FA ✅ · rotation thủ công, không lịch | ⚠️ |
| Lỗ hổng mở đã biết | DUPR webhook forge-RATING (CRITICAL, memory) | ❌ treo từ 15/07 |

## 3. Nội dung & SEO/GEO/AEO

| Việc | Ai đang làm | Trạng thái |
|---|---|---|
| Kế hoạch + viết bài tuần | **agent content** (mới, 07/09) | ✅ bắt đầu 08/09 |
| Tin tức tự động → site | news-fetcher → news-translate | ✅ |
| Đăng MXH (FB/X) | social-poster (prompt 5 công thức từ 07/09) | ✅ theo dõi engagement 1-2 tuần |
| Probe SEO prod + GSC 7 ngày | **chief** brief sáng | ✅ quan sát |
| Tracker /san tuần, WPR refresh, đọc lại cluster | mốc trong `docs/milestones.md` (tự re-arm) | ✅ |
| Tự sửa khi SEO lệch (meta/schema/canonical) | xuly khi Cuong ra lệnh | ⚠️ chưa chủ động (thiết kế `seo-geo` chưa dựng) |
| Theo dõi index coverage GSC / hreflang regress | thủ công qua Chrome | ⚠️ |

## 4. Sản phẩm & vận hành nghiệp vụ

| Việc | Ai đang làm | Trạng thái |
|---|---|---|
| Shop: đơn hàng mới, đơn quá hạn chưa xử lý | — (memory 29/08: không có cron huỷ đơn quá hạn) | ❌ **đáng làm sớm — có tiền thật** |
| Giải đang chạy có live score không | fix-agent một phần (scraper alert) | ⚠️ |
| User rác / moderation feed + chat | admin UI thủ công | ⚠️ không có digest báo cáo |
| Push notification hoạt động | đã vá 401 (memory) | ✅ |
| App iOS: crash, review App Store | — | ❌ không ai đọc |

## 5. Chất lượng code & release

| Việc | Ai đang làm | Trạng thái |
|---|---|---|
| CI gates (16 workflows: quality, e2e, pgtap, visual, bundle, apple...) | GitHub Actions | ✅ |
| Migration drift prod↔repo | `migration-drift.yml` | ✅ |
| Deploy guard (tree == origin/main) | `deploy-guard.yml` + guard trong redeploy script | ✅ |
| Perf budget (LCP/INP/CLS thật từ GA4 VN) | mốc PERF-05B chưa đọc được (chờ dims) | ⚠️ |

## 6. Số liệu & tăng trưởng

| Việc | Ai đang làm | Trạng thái |
|---|---|---|
| Digest git/branch/CI 7 ngày | chief sáng | ✅ |
| GA4/Ahrefs đọc định kỳ, đối chiếu kỳ vọng | thủ công qua Chrome | ⚠️ (thiết kế `growth-analyst` chưa dựng) |
| Digest tối tổng kết cả đội agent | — | ❌ |

## Đề xuất thứ tự dựng tiếp (theo giá trị/công sức)

1. **Sửa `edge-redeploy-hourly`** — 1 dòng, đang chạy không lưới blob-loss. (5')
2. **ops-medic v1** = nâng fix-agent: thêm quét chủ động 1h/lần các bề mặt ⚠️ mục 1
   (uptime chi tiết, hàng đợi dịch tồn, prerender stale) — khuôn daemon đã có. (nửa ngày)
3. **Shop watch** = cron huỷ/nhắc đơn quá hạn + dòng "đơn mới/24h" vào brief chief —
   chỗ duy nhất có TIỀN THẬT mà không ai canh. (nửa ngày)
4. **growth-analyst** = digest 21:00 gom kết quả cả đội + số GA4-VN/Ahrefs —
   đóng vòng lặp "sáng brief, tối tổng kết". (1 ngày)
5. **seo-geo chủ động** = daily seo-verify + tự sửa meta/schema qua PR. (1-2 ngày)
6. **shift-supervisor** dựng CUỐI CÙNG, đúng lộ trình ai-agent-team.md — chỉ khi
   sổ cái `agent_tasks` + kill switch đã chứng minh chạy đúng vài tuần.

Việc Cuong vẫn phải tự tay (vùng ĐỎ, vài lần/tháng): duyệt draft/PR, migration,
payment/auth, secret rotation, quyết định sản phẩm.
