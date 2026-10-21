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

> 🔄 **VIẾT LẠI 2026-08-13 sau quyết định S-b.** Bản trước nói packet này chỉ
> xin `git push`. **Không còn đúng.** S-b đòi một **project Cloudflare Pages thứ
> hai**, và việc tạo nó là thao tác chính của packet này.

**Nhánh đã push rồi** (`ef32845e`, PR #578) — nên `git push` không còn là thứ
phải xin. Thứ phải xin bây giờ là **tạo một project Pages riêng cho nhánh Shop**.

| | Trước (S-a, đã bị từ chối) | Sau (S-b, đã chọn) |
|---|---|---|
| Thao tác | `git push`, Cloudflare tự dựng preview | **Tạo project Pages thứ hai** + trỏ env vào staging |
| Project | `pickle-hub-pro` | `pickle-hub-pro-shop` (tên đề xuất) |
| URL | `feat-shop-closed-pilot.pickle-hub-pro.pages.dev` | `https://<project-mới>.pages.dev` |
| Preview nhánh khác | **trỏ staging** ← chi phí bị từ chối | **giữ nguyên production** |
| Dọn dẹp sau pilot | không có | 🔴 **phải xoá project thứ hai** |

Cấu hình project mới:

| Thứ | Giá trị |
|---|---|
| Repo | `cuongnguyen84/pickle-hub-pro` |
| Production branch của project này | **`feat/shop-closed-pilot`** |
| Build command | `npm run build` |
| Output | `dist` |
| `VITE_SUPABASE_URL` | `https://utokwfcljxjkpkaqgheo.supabase.co` |
| `VITE_SUPABASE_PROJECT_ID` | `utokwfcljxjkpkaqgheo` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key **staging** |
| `SHOP_PUBLIC_INDEXING` | **không đặt** |

🔴 **Project `pickle-hub-pro` không được đụng tới.** Toàn bộ giá trị của S-b nằm
ở chỗ đó: nếu một biến Preview nào bị thêm vào project cũ thì S-b thành S-a mà
không ai nhận ra, vì nhánh Shop vẫn chạy đúng — chỉ nhánh của người khác hỏng.

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
| P3 | 🔴 **B1′** — URL của **project Pages MỚI** nằm trong Redirect URLs của **STAGING** | ⬜ |
| P4 | 🔴 **B2** — `SHOP_PUBLIC_INDEXING` **không tồn tại** ở Production, **và** ở project mới | ⬜ |
| P5 | **Project Pages thứ hai đã tạo**, env trỏ `utokwfcljxjkpkaqgheo` (S-b) | ⬜ |
| P5b | 🔴 Project `pickle-hub-pro` **không có** biến `VITE_SUPABASE_*` ở môi trường Preview | ⬜ |
| P6 | `soak-watch.mjs --baseline` đã chụp **TRƯỚC** khi push | ⬜ |

**P1 là ràng buộc cứng.** Preview có route Shop mà cơ sở dữ liệu không có bảng
Shop là một preview lỗi ở mọi màn hình — và tệ hơn, nó trông giống một lỗi mã
nguồn.

**P3:** không có nó, đăng nhập trên preview bật đi nơi khác và người kiểm thử
sẽ đăng nhập thành công vào một site **không có Shop** rồi tưởng là hỏng. Không
kiểm được ở chế độ chỉ đọc (endpoint `config/auth` trả secret trong cùng
payload) — Cuong xác nhận bằng mắt.

**P5/P5b — S-b đã gỡ ngòi nổ, và P5b là thứ giữ nó gỡ.** Bản trước cảnh báo
rằng biến Preview của Cloudflare áp cho **mọi nhánh**, nên preview SEO/homepage
cũng sẽ trỏ staging. Quyết định S-b ([`packet-s-staging.md` §6](./packet-s-staging.md))
tránh hẳn điều đó bằng một project riêng.

Nhưng nó chỉ đúng **chừng nào không ai đặt biến vào project cũ**. Đó là P5b, và
nó phải kiểm bằng mắt: một biến `VITE_SUPABASE_*` lọt vào môi trường Preview của
`pickle-hub-pro` sẽ khôi phục **toàn bộ** thiệt hại của S-a **trong im lặng** —
nhánh Shop vẫn chạy đúng trên project riêng của nó, nên không có tín hiệu nào từ
phía này. Người phát hiện sẽ là một phiên khác, và họ sẽ tưởng nhánh họ hỏng.

**P4:** không có lệnh CLI nào đọc biến môi trường Pages. Kiểm tra 30 giây trong
dashboard, và nó là thứ đứng giữa "pilot kín" và "Google thấy sáu sản phẩm".

**P6:** không có baseline thì không phát hiện được chữ ký lỗi nào là *mới*.

```sh
node scripts/agents/soak-watch.mjs --baseline --out /tmp/soak-shop-pilot.json
```

---

## 4. Biến môi trường — đặt ở PROJECT MỚI, không phải ở `pickle-hub-pro`

| Nơi | Tên | Giá trị |
|---|---|---|
| **Project mới** | `VITE_SUPABASE_URL` | `https://utokwfcljxjkpkaqgheo.supabase.co` |
| **Project mới** | `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key **staging** |
| **Project mới** | `VITE_SUPABASE_PROJECT_ID` | `utokwfcljxjkpkaqgheo` |
| **Project mới** | `SHOP_PUBLIC_INDEXING` | **không đặt** (P4) |
| **Project mới** | `VITE_PROTO_SHOP` | **không đặt** — prototype bị loại ở compile time (D4) |
| **Project mới** | `CANONICAL_HOST` | giữ mặc định |
| 🔴 `pickle-hub-pro` | **mọi biến** | **KHÔNG ĐỔI GÌ** (P5b) |
| Supabase Edge | `CRON_SECRET`, `SUPABASE_*` | không đụng |

---

## 5. Thay đổi kỳ vọng

| Thứ | Trước | Sau |
|---|---|---|
| Nhánh remote | không có | ✅ đã push — `feat/shop-closed-pilot` @ `ef32845e` |
| Project Cloudflare Pages | 1 | **2** — thêm project riêng cho nhánh Shop |
| **Production web** | không đổi | **không đổi** |
| **Cơ sở dữ liệu production** | không đổi | **không đổi** |
| Preview của các nhánh khác | trỏ production | ✅ **vẫn trỏ production** — S-b giữ nguyên |
| Route Shop tới được | không ở đâu | URL của project mới |
| Route Shop được lập chỉ mục | không | **vẫn không** |

---

## 6. Kiểm ngay sau khi preview build xong

```sh
# S-b: URL của PROJECT PAGES THỨ HAI, không phải *.pickle-hub-pro.pages.dev
BASE=https://<project-mới>.pages.dev

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
| Preview sai | Dashboard → **project thứ hai** → Delete project. Nhánh và PR #578 giữ nguyên | phút |
| Muốn gỡ hẳn S-b | Xoá project thứ hai; `pickle-hub-pro` chưa từng bị đụng nên không có gì phải hoàn nguyên | phút |
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
