# Approval packets — Shop closed pilot

> **KHÔNG packet nào được duyệt.** Không lệnh nào trong bốn file này đã chạy.
>
> Nền tảng: `f172a441` · nhánh `feat/shop-closed-pilot`.

Mỗi packet là một đơn xin phép: mục tiêu, lệnh chính xác, thứ kỳ vọng thấy,
cách hoàn tác, và một ô ký. Một packet chưa có chữ ký ở ô đó thì **chưa được
thi hành**, kể cả khi packet khác đã được duyệt.

## Bốn packet

| Packet | Nội dung | Rủi ro |
|---|---|---|
| [A — Preview](./packet-a-preview.md) | Đẩy nhánh lên GitHub; Cloudflare tự dựng preview | 🟡 AMBER — revert được, nhưng phải xác nhận biến môi trường trước |
| [B — Migration](./packet-b-migrations.md) | Áp 17 migration lên `ajvlcamxemgbxduhiqrl` | 🔴 **RED** — `git revert` không hoàn tác SQL đã chạy |
| [C — Worker + cron](./packet-c-worker-cron.md) | Deploy `shop-media-lifecycle`, xác nhận cron | 🟡 AMBER — xoá function được, hàng đợi không mất dữ liệu |
| [D — Kích hoạt pilot](./packet-d-pilot-activation.md) | Chèn UUID người bán, mở pilot | 🔴 **RED** — người thật, dữ liệu thật |

## Thứ tự đọc và thứ tự thi hành khác nhau

**Đọc** theo A → B → C → D.

**Thi hành** theo:

```
B (migration)  →  C (worker + cron)  →  A (preview)  →  D (kích hoạt)
```

Vì sao đảo: preview web trỏ vào Supabase production (không có staging —
[`environment-audit.md` §5](../environment-audit.md)). Một preview có route Shop
mà cơ sở dữ liệu chưa có bảng Shop là một preview lỗi 404 ở mọi màn hình. Web
**sau** backend, luôn luôn.

Trong B, function phải deploy trước migration #4 — nên C bị chèn vào giữa B.
Thứ tự thi hành chi tiết nằm trong từng packet.

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

## Ba blocker chặn ngang, không thuộc packet nào

| # | Blocker | Ai gỡ | Chặn |
|---|---|---|---|
| B1 | URL preview có trong Supabase → Auth → Redirect URLs? | Cuong, dashboard | A |
| B2 | `SHOP_PUBLIC_INDEXING` **không tồn tại** ở cả Production lẫn Preview? | Cuong, dashboard | A, D |
| B5 | "Quy chế người bán v1" chưa tồn tại, và **submit không cưỡng chế chấp thuận** ([`pilot-contract.md` §5](../pilot-contract.md)) | Cuong / pháp lý | D (chỉ chặn người bán thật, không chặn hạ tầng) |
