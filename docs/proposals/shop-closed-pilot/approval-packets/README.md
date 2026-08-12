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
 1. Cưỡng chế seller-rules ở cục bộ                    ✅ XONG — CP12
 2. Product Owner cung cấp/duyệt "Quy chế người bán v1" ⬜ B4 — chặn từ bước 10
 3. Packet S — tạo staging
 4. Packet B — migration lên STAGING
 5. Packet C — function + cron trên STAGING
 6. Packet A — preview Cloudflare trỏ STAGING
 7. Smoke đầy đủ trên staging
 8. Product Owner nghiệm thu preview
 9. Packet B + C lên PRODUCTION
10. Web production, indexing vẫn TẮT
11. Packet D — Wave 0, tài khoản test nội bộ
12. Wave 1 — một người bán thật
```

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
| 2 | Pilot chấp nhận **chưa có thông báo tự động** + runbook tay | [`../notification-decision.md`](../notification-decision.md) — **ĐÃ KÝ** |
| 3 | Shop indexing **TẮT/unset ở mọi môi trường** | Packet A §4, D §3 |
| 4 | Drift `20260805150000_news_source_ppa_tour_pause` **ngoài phạm vi** — không sửa, không chèn ledger | Packet B §4 |
| 5 | **Không submit được nếu server chưa xác minh chấp thuận** quy chế v1 | ✅ đã triển khai — CP12 |

## Blocker còn lại

| # | Blocker | Ai gỡ | Chặn |
|---|---|---|---|
| **B1′** | URL preview có trong **Redirect URLs của STAGING** | Cuong, dashboard staging | Packet A |
| **B2** | `SHOP_PUBLIC_INDEXING` **không tồn tại** ở cả Production lẫn Preview | Cuong, dashboard | Packet A, D |
| **B3′** | Project ref staging, region, gói — và **`pg_cron`/`pg_net` có bật được không** | Product Owner | Packet S |
| **B4** | **"Quy chế người bán v1" chưa tồn tại.** Máy chủ nay từ chối submit khi chưa có bản nào hiệu lực (`seller_rules_not_published`) | Cuong / pháp lý | Bước 12 — người bán thật |
| **B6′** | Điều kiện #4 của quyết định thông báo: **tên người kiểm hàng đợi hằng ngày** | Product Owner | Packet D |
| **B7** | 9 đầu vào của Packet D | Product Owner | Packet D |

B5 — "submit không cưỡng chế chấp thuận" — **đã đóng** bằng migration
`20260814090000` và không còn trong danh sách.

## Checklist dashboard cho Product Owner

Bảy mục, không lệnh CLI nào đọc được:
[`../dashboard-checklist.md`](../dashboard-checklist.md).
