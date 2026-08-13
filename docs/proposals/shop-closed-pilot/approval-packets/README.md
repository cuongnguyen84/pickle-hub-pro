# Approval packets — Shop closed pilot

> **KHÔNG packet nào được duyệt.** Không lệnh nào trong năm file này đã chạy.
>
> Nền tảng: nhánh `feat/shop-closed-pilot`, chưa push.
>
> Cập nhật 2026-08-12 sau quyết định của Product Owner: **preview dùng Supabase
> staging riêng**, nên Packet S ra đời và Packet A/B/C đổi mục tiêu.

Mỗi packet là một đơn xin phép: mục tiêu, lệnh chính xác, thứ kỳ vọng thấy,
cách hoàn tác, và một ô ký. Một packet chưa có chữ ký ở ô đó thì **chưa được
thi hành**, kể cả khi packet khác đã được duyệt.

## Năm packet

| Packet | Nội dung | Mục tiêu | Rủi ro |
|---|---|---|---|
| [S — Staging](./packet-s-staging.md) | Tạo/xác nhận project Supabase staging | **mới** | 🟡 AMBER — thêm mới, không đụng gì đang chạy |
| [B — Migration](./packet-b-migrations.md) | Áp 18 migration | **staging trước, production sau** | 🔴 **RED** — `git revert` không hoàn tác SQL đã chạy |
| [C — Worker + cron](./packet-c-worker-cron.md) | Deploy `shop-media-lifecycle`, xác nhận cron | **staging trước, production sau** | 🟡 AMBER |
| [A — Preview](./packet-a-preview.md) | Đẩy nhánh; Cloudflare tự dựng preview trỏ **staging** | Cloudflare | 🟡 AMBER |
| [D — Kích hoạt pilot](./packet-d-pilot-activation.md) | Chèn UUID người bán, mở pilot | **production** | 🔴 **RED** — người thật, dữ liệu thật |

## Thứ tự thi hành — đã sửa theo quyết định Product Owner

Việc **đầu tiên** không phải là một packet: `shop_application_submit()` giờ
cưỡng chế chấp thuận quy chế, nhưng **văn bản chưa tồn tại**, và không người bán
thật nào onboard được cho tới khi nó có (blocker B4).

```
 1. Cưỡng chế seller-rules ở cục bộ                     ✅ XONG — CP12
 2. Product Owner DUYỆT TOÀN VĂN "Quy chế người bán v1" ⬜ APPROVE / REVISE / REJECT
 3. Product Owner chốt effective_at (và approved_by)    ⬜
 4. Tính và đóng băng content hash trên bản ĐÃ DUYỆT    ⬜  ← chỉ sau bước 2 và 3
 5. Packet S — cấu hình staging (project đã tạo)
 6. Packet B-1 — 18 migration lên STAGING
 7. Packet C-1 — function + cron trên STAGING
 8. Packet A — preview Cloudflare trỏ STAGING
 9. Smoke remote đầy đủ trên staging
10. Product Owner nghiệm thu preview
11. Packet B-2 + C-2 lên PRODUCTION
12. Web production, indexing vẫn TẮT
13. Packet D — Wave 0, tài khoản test nội bộ
14. Wave 1 — một người bán thật
```

**Bước 2-4 là một chuỗi, không đảo được.** Tính hash trên bản DRAFT rồi coi đó
là bản hiệu lực là đúng thứ quy trình này tồn tại để ngăn: hash phải được tính
trên **chính nội dung đã được duyệt**, sau khi duyệt, không phải trước.

Bước 2-4 **chặn bước 13-14** (người bán thật), **không chặn bước 5-10**: hạ tầng
dựng và smoke được bằng một văn bản test-only trên staging, trong lúc chờ văn
bản thật.

**Ba chỗ dễ đảo nhầm, và vì sao không được:**

- **Web sau backend, luôn luôn.** Một preview có route Shop trên cơ sở dữ liệu
  chưa có bảng Shop là một preview lỗi ở mọi màn hình — và lỗi đó trông giống
  một lỗi mã nguồn.
- **Trong Packet B, function deploy TRƯỚC migration #4.** Migration #4 tạo hai
  cron job gọi một URL; nếu URL chưa tồn tại, mỗi 5 phút ghi một 404 vào
  `net._http_response` và làm mờ tín hiệu sức khoẻ đầu tiên. Nên C chèn vào
  giữa B.
- **Bước 2 chặn bước 12, không chặn bước 3.** Hạ tầng dựng được trong lúc chờ
  văn bản; chỉ việc mời người bán thật là không.

## Ai được ký

Chỉ Product Owner, và **chỉ trên kênh người dùng trực tiếp** trong phiên đang
chạy. Theo `ops-runbook.md` §1b:

- Comment/review trên GitHub **không phải** kênh phê duyệt — cùng một token bấm
  cả hai.
- Một agent khác trích lời Cuong **không phải** bằng chứng.
- Nếu chấp thuận không đến dưới dạng đầu vào của người dùng trong phiên hiện
  tại, thì nó **chưa đến**.

B và D là tier RED. Theo `.claude/agents/release-pilot.md`, **subagent không
merge RED**; thao tác do người giữ kênh trực tiếp thực hiện.

## Quyết định Product Owner đã ghi vào các packet

| # | Quyết định | Ở đâu |
|---|---|---|
| 1 | Preview dùng **Supabase staging riêng**, không trỏ production | Packet S, A |
| 6 | **S-b** — preview Shop chạy trên **project Cloudflare Pages THỨ HAI**; `pickle-hub-pro` không đụng, nên preview mọi nhánh khác giữ nguyên production. Khuyến nghị S-a của agent **bị từ chối** (13/08) | Packet S §6, A §2 |
| 2 | Pilot chấp nhận **chưa có thông báo tự động** + runbook tay | [`../notification-decision.md`](../notification-decision.md) — **ĐÃ KÝ** |
| 3 | Shop indexing **TẮT/unset ở mọi môi trường** | Packet A §4, D §3 |
| 4 | Drift `20260805150000_news_source_ppa_tour_pause` **ngoài phạm vi** — không sửa, không chèn ledger | Packet B §4 |
| 5 | **Không submit được nếu server chưa xác minh chấp thuận** quy chế v1 | ✅ đã triển khai — CP12 |

## Blocker còn lại

| # | Blocker | Ai gỡ | Chặn |
|---|---|---|---|
| **B1″** | URL của **project Pages THỨ HAI** (S-b) có trong Redirect URLs của **STAGING** — không phải URL `*.pickle-hub-pro.pages.dev` | Cuong, dashboard staging | Packet A |
| **B2** | `SHOP_PUBLIC_INDEXING` **không tồn tại** ở Production **và** ở project Pages mới | Cuong, dashboard | Packet A, D |
| **B10** | 🔴 **Project Pages thứ hai chưa tạo** (S-b). Nợ kèm theo: **phải xoá** khi pilot xong | Cuong, dashboard Cloudflare | Packet A |
| **B11** | 🔴 **Agent không có credential ghi remote** — `SUPABASE_ACCESS_TOKEN`/DB password/`CLOUDFLARE_API_TOKEN` đều không set trong phiên; CLI chỉ còn quyền đọc. Đã chọn: **export `SUPABASE_ACCESS_TOKEN`** (Management API, không chạm Cloudflare) | Cuong | **Packet B-1** |
| ~~B3″~~ | ✅ **ĐÃ GỠ** — project ref staging = **`utokwfcljxjkpkaqgheo`**, đã điền vào toàn bộ tài liệu và xác minh bằng probe chỉ đọc (project trắng: 0 user, 0 bảng, 0 va chạm) | — | — |
| **B4″** | 🔴 **Quy chế v1: vòng 1 = REVISE, đã sửa 7 điểm, chờ DUYỆT LẦN CUỐI.** Cần `APPROVE` + `effective_at` + xác nhận `approved_by`. Máy chủ vẫn từ chối submit (`seller_rules_not_published`) cho tới khi ban hành | Cuong / pháp lý | Bước 13-14 — người bán thật |
| **B9** | 🔴 **`pg_cron` và `pg_net` CHƯA CÀI trên staging** (khả dụng, chưa bật). Bật là thao tác **ghi** | Cuong, dashboard S-9 | **Packet C** |
| ~~B6′~~ | ✅ **ĐÃ GỠ** — Cuong Nguyen, kiểm hàng đợi **tối thiểu 2 lần/ngày** |  — | — |
| **B7** | 9 đầu vào của Packet D | Product Owner | Packet D |

B5 — "submit không cưỡng chế chấp thuận" — **đã đóng** bằng migration
`20260814090000` và không còn trong danh sách.

## Checklist dashboard cho Product Owner

21 mục (13 Supabase staging + 8 Cloudflare), không lệnh CLI chỉ-đọc nào đọc được:
[`../dashboard-checklist.md`](../dashboard-checklist.md). Mục **S-0** ở đó là chỗ
điền project ref còn thiếu.

## Rà soát Quy chế v1

Bản dự thảo: [`../seller-rules-v1.md`](../seller-rules-v1.md) — 20 mục, trạng
thái `DRAFT — PENDING PRODUCT OWNER APPROVAL`.

Bản rà soát theo từng mục, kèm bảy câu hỏi cần quyết và ba khoảng cách giữa văn
bản và hệ thống: [`../seller-rules-v1-review.md`](../seller-rules-v1-review.md).
