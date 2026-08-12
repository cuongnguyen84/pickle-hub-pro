# Packet A — Hạ tầng preview

> **TRẠNG THÁI: CHƯA DUYỆT. Không lệnh nào đã chạy.**
> Tier: 🟡 AMBER — revert được, nhưng hai blocker phải gỡ trước.
> Nền: [`../preview-deployment.md`](../preview-deployment.md)

---

## 1. Mục tiêu

| Thứ | Giá trị |
|---|---|
| Cloudflare project | **`pickle-hub-pro`** (account `7888e97076d4eadd9a8fa409d11dc281`) |
| Nhánh production | `main` — **không đụng** |
| Nhánh preview | **`feat-shop-closed-pilot`** |
| Supabase | `ajvlcamxemgbxduhiqrl` — **không có project staging** |
| Nền tảng | `f172a441` + 4 commit tài liệu closed-pilot |

---

## 2. Packet này thật ra xin phép cái gì

**Một thao tác: `git push`.**

Cloudflare Pages nối trực tiếp với GitHub và build **mọi** nhánh không phải
`main` thành một preview. Không có lệnh `wrangler pages deploy` nào. Không có gì
khác để duyệt.

```sh
git push -u origin feat/shop-closed-pilot
```

Preview xuất hiện ở:
- `https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev` (theo nhánh)
- `https://<hash>.pickle-hub-pro.pages.dev` (theo deployment — ghi lại làm điểm rollback)

⚠️ **Push với danh tính nào:** mọi thao tác `gh`/push của agent phải chạy với
`GH_TOKEN` lấy từ `GITHUB_BOT_PAT` và **phải xác minh `gh api user -q .login`
in ra `thepicklehubnet`** trước khi chạm GitHub. Phiên keyring cục bộ xác thực
là `cuongnguyen84` và chỉ dành cho tay Cuong (`ops-runbook.md` §1b).

---

## 3. Điều kiện tiên quyết — packet này KHÔNG chạy được nếu thiếu

| # | Điều kiện | Trạng thái |
|---|---|---|
| P1 | **Packet B đã duyệt và đã áp** (ít nhất file 1-3, lý tưởng cả 17) | ⬜ |
| P2 | **Packet C đã duyệt và đã chạy** — function sống | ⬜ |
| P3 | 🔴 **B1** — URL preview nằm trong Supabase → Auth → **Redirect URLs** | ⬜ |
| P4 | 🔴 **B2** — `SHOP_PUBLIC_INDEXING` **không tồn tại** ở **cả** Production lẫn Preview | ⬜ |
| P5 | `soak-watch.mjs --baseline` đã chụp **TRƯỚC** khi push | ⬜ |

**P1 là ràng buộc cứng.** Preview có route Shop mà cơ sở dữ liệu không có bảng
Shop là một preview lỗi ở mọi màn hình — và tệ hơn, nó trông giống một lỗi mã
nguồn.

**P3:** không có nó, đăng nhập trên preview bật ngược về production và người
kiểm thử sẽ đăng nhập thành công vào một site **không có Shop** rồi tưởng là
hỏng. Không kiểm được ở chế độ chỉ đọc (endpoint `config/auth` trả secret trong
cùng payload) — Cuong xác nhận bằng mắt.

**P4:** không có lệnh CLI nào đọc biến môi trường Pages. Kiểm tra 30 giây trong
dashboard, và nó là thứ đứng giữa "pilot kín" và "Google thấy sáu sản phẩm".

**P5:** không có baseline thì không phát hiện được chữ ký lỗi nào là *mới*.

```sh
node scripts/agents/soak-watch.mjs --baseline --out /tmp/soak-shop-pilot.json
```

---

## 4. Biến môi trường — **không tạo cái nào**

| Nơi | Tên | Preview |
|---|---|---|
| Pages | `SHOP_PUBLIC_INDEXING` | **không đặt** (P4) |
| Pages | `CANONICAL_HOST` | giữ nguyên |
| Build | `VITE_SUPABASE_*` | như production |
| Build | `VITE_PROTO_SHOP` | **không đặt** — prototype bị loại ở compile time (D4) |
| Supabase Edge | `CRON_SECRET`, `SUPABASE_*` | không đụng |

---

## 5. Thay đổi kỳ vọng

| Thứ | Trước | Sau |
|---|---|---|
| Nhánh remote | không có | `feat/shop-closed-pilot` |
| Preview deployment | 6 nhánh khác | +1 |
| **Production web** | không đổi | **không đổi** |
| **Cơ sở dữ liệu** | không đổi | **không đổi** |
| Route Shop tới được | không ở đâu | preview URL |
| Route Shop được lập chỉ mục | không | **vẫn không** |

---

## 6. Kiểm ngay sau khi preview build xong

```sh
BASE=https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev

# 1. Ma trận noindex, TRƯỚC khi ai khác nhận URL
node scripts/shop-closed-pilot-smoke.mjs --target "$BASE" \
  --supabase-url https://ajvlcamxemgbxduhiqrl.supabase.co \
  --anon-key "$VITE_SUPABASE_PUBLISHABLE_KEY"

# 2. Nhánh production không đổi
curl -sI https://www.thepicklehub.net/shop | head -1     # kỳ vọng: KHÔNG có route Shop
```

Bộ smoke exit **1** nếu bất kỳ kiểm tự động nào đỏ, **và cũng exit 1 nếu bất kỳ
kiểm nào SKIP** — thiếu kết nối cơ sở dữ liệu không phải là "qua".

Sau đó là 18 kiểm thủ công ở [`../acceptance.md` §4](../acceptance.md).

---

## 7. Rollback

| Tình huống | Làm | Thời gian |
|---|---|---|
| Preview sai | `git push origin --delete feat/shop-closed-pilot` — preview biến mất | phút |
| Web production bị chạm (không nên xảy ra) | Dashboard → Pages → Deployments → deployment id đã ghi → Rollback | phút |
| Cần dừng gấp bất cứ thứ gì liên quan Shop | `DELETE FROM shop_pilot_members` | giây |

**Web production không bao giờ bị chạm bởi packet này** — Cloudflare chỉ deploy
`main` vào production, và packet này không đụng `main`.

**Không bump `pr:v34`.** Pilot không thêm SSR handler nào cho Shop (cố ý — P2b.6).
Nếu ai đó thấy mình định bump, hãy dừng lại và hỏi vì sao đầu ra SSR đổi.

**Ghi lại deployment id production hiện tại trước khi push.** Không dùng đến
trong luồng này, nhưng nó là thứ ta sẽ muốn có nếu ai đó nhầm nhánh.

---

## 8. Ô ký

```
Packet A — đẩy feat/shop-closed-pilot lên GitHub; Cloudflare tự dựng preview.

Điều kiện tiên quyết đã xác nhận:
  [ ] P1  Packet B đã áp (file 1-3 tối thiểu)
  [ ] P2  Packet C đã chạy, function sống
  [ ] P3  B1 — URL preview có trong Supabase Redirect URLs
  [ ] P4  B2 — SHOP_PUBLIC_INDEXING KHÔNG tồn tại ở cả Production lẫn Preview
  [ ] P5  soak-watch baseline đã chụp

[ ] DUYỆT — ký: ____________  ngày: __________
[ ] TỪ CHỐI — lý do: _______________________________________________

Người thi hành: _____________   (gh identity: ______________)
Deployment id production trước khi push: ______________
URL preview: ______________
```
