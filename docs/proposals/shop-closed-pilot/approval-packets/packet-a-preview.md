# Packet A — Hạ tầng preview

> **TRẠNG THÁI: CHƯA DUYỆT. Không lệnh nào đã chạy.**
> Tier: 🟡 AMBER — revert được, nhưng bốn điều kiện phải gỡ trước.
>
> **Cập nhật 2026-08-12:** preview trỏ **Supabase staging**, không phải
> production (quyết định Product Owner #1).
> Nền: [`../preview-deployment.md`](../preview-deployment.md)

---

## 1. Mục tiêu

| Thứ | Giá trị |
|---|---|
| Cloudflare project | **`pickle-hub-pro`** (account `7888e97076d4eadd9a8fa409d11dc281`) |
| Nhánh production | `main` — **không đụng** |
| Nhánh preview | **`feat-shop-closed-pilot`** |
| Supabase | **`utokwfcljxjkpkaqgheo`** — Packet S. **KHÔNG phải production** |
| Nền tảng | nhánh `feat/shop-closed-pilot` |

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
| P0 | **Packet S đã duyệt** — project staging tồn tại, `pg_cron`/`pg_net`/vault khả dụng | ⬜ |
| P1 | **B-1 đã chạy** — 18 migration trên **staging** | ⬜ |
| P2 | **C-1 đã chạy** — function sống trên **staging**, cron nổ, `net._http_response` = 200 | ⬜ |
| P3 | 🔴 **B1′** — URL preview nằm trong **Redirect URLs của STAGING** | ⬜ |
| P4 | 🔴 **B2** — `SHOP_PUBLIC_INDEXING` **không tồn tại** ở **cả** Production lẫn Preview | ⬜ |
| P5 | `VITE_SUPABASE_*` của môi trường **Preview** trỏ `utokwfcljxjkpkaqgheo` | ⬜ |
| P6 | `soak-watch.mjs --baseline` đã chụp **TRƯỚC** khi push | ⬜ |

**P1 là ràng buộc cứng.** Preview có route Shop mà cơ sở dữ liệu không có bảng
Shop là một preview lỗi ở mọi màn hình — và tệ hơn, nó trông giống một lỗi mã
nguồn.

**P3:** không có nó, đăng nhập trên preview bật đi nơi khác và người kiểm thử
sẽ đăng nhập thành công vào một site **không có Shop** rồi tưởng là hỏng. Không
kiểm được ở chế độ chỉ đọc (endpoint `config/auth` trả secret trong cùng
payload) — Cuong xác nhận bằng mắt.

**P5 là thay đổi có sức công phá nhất trong gói.** Biến môi trường Preview của
Cloudflare áp cho **mọi nhánh**, nên preview của các nhánh SEO/homepage đang
chạy song song cũng sẽ trỏ staging và không còn thấy dữ liệu thật. Hai lựa chọn
và một khuyến nghị: [`packet-s-staging.md` §6](./packet-s-staging.md). Ai đang
chạy nhánh khác cần được báo.

**P4:** không có lệnh CLI nào đọc biến môi trường Pages. Kiểm tra 30 giây trong
dashboard, và nó là thứ đứng giữa "pilot kín" và "Google thấy sáu sản phẩm".

**P6:** không có baseline thì không phát hiện được chữ ký lỗi nào là *mới*.

```sh
node scripts/agents/soak-watch.mjs --baseline --out /tmp/soak-shop-pilot.json
```

---

## 4. Biến môi trường — ba biến Preview ĐỔI mục tiêu

| Nơi | Tên | Preview |
|---|---|---|
| Pages | `SHOP_PUBLIC_INDEXING` | **không đặt** (P4) |
| Pages | `CANONICAL_HOST` | giữ nguyên |
| Build (Preview) | `VITE_SUPABASE_URL` | `https://utokwfcljxjkpkaqgheo.supabase.co` |
| Build (Preview) | `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key **staging** |
| Build (Preview) | `VITE_SUPABASE_PROJECT_ID` | `utokwfcljxjkpkaqgheo` |
| Build | `VITE_PROTO_SHOP` | **không đặt** — prototype bị loại ở compile time (D4) |
| Supabase Edge | `CRON_SECRET`, `SUPABASE_*` | không đụng |

---

## 5. Thay đổi kỳ vọng

| Thứ | Trước | Sau |
|---|---|---|
| Nhánh remote | không có | `feat/shop-closed-pilot` |
| Preview deployment | 6 nhánh khác | +1 |
| **Production web** | không đổi | **không đổi** |
| **Cơ sở dữ liệu production** | không đổi | **không đổi** |
| Preview của các nhánh khác | trỏ production | **trỏ staging** — xem P5 |
| Route Shop tới được | không ở đâu | preview URL |
| Route Shop được lập chỉ mục | không | **vẫn không** |

---

## 6. Kiểm ngay sau khi preview build xong

```sh
BASE=https://feat-shop-closed-pilot.pickle-hub-pro.pages.dev

# 1. Ma trận noindex, TRƯỚC khi ai khác nhận URL
node scripts/shop-closed-pilot-smoke.mjs --target "$BASE" \
  --supabase-url https://utokwfcljxjkpkaqgheo.supabase.co \
  --anon-key "<anon key STAGING>"

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
  [ ] P0  Packet S đã duyệt, staging tồn tại, pg_cron/pg_net/vault khả dụng
  [ ] P1  B-1 đã áp 18 migration lên STAGING
  [ ] P2  C-1 đã chạy trên STAGING, cron nổ, net._http_response = 200
  [ ] P3  B1′ — URL preview có trong Redirect URLs của STAGING
  [ ] P4  B2 — SHOP_PUBLIC_INDEXING KHÔNG tồn tại ở cả Production lẫn Preview
  [ ] P5  VITE_SUPABASE_* (Preview) trỏ utokwfcljxjkpkaqgheo  — và đã báo các phiên khác
  [ ] P6  soak-watch baseline đã chụp

[ ] DUYỆT — ký: ____________  ngày: __________
[ ] TỪ CHỐI — lý do: _______________________________________________

Người thi hành: _____________   (gh identity: ______________)
Deployment id production trước khi push: ______________
URL preview: ______________
```
