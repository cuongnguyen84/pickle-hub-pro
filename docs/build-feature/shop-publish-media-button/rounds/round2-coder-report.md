# Vòng 2 — Báo cáo của coder

## §1 — Sửa phân loại lỗi (`src/lib/shop/errors.ts:113`)
Bỏ đúng ràng buộc `status === 422`, giữ vị trí nhánh và prefix guard:
```ts
if (detail.startsWith("rendition_")) {
  return { message: "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.", code };
}
```
Root cause tự kiểm lại trong `shop-media-lifecycle/index.ts` (không copy niềm tin từ prompt):
- `copyRenditionToPublic` sinh mã ở `:89-131`: `rendition_source_missing` (409) · `rendition_too_large`/`rendition_not_image`/`rendition_<verdict.reason>`/`rendition_dimensions` (422) · `copy_failed` (502).
- **Nhánh sản phẩm** `:165` trả thẳng `outcome.status` ⇒ **có** 422 thật, nhánh 422 cũ không phải code chết.
- **Nhánh profile** `:234-236` luôn 200 **hoặc** 502, mã lỗi nằm trong `failed[0].error` ⇒ điều kiện `status === 422` giết trọn đường profile: `rendition_metadata_present` (đúng lỗi iOS Safari thật trên prod) rơi xuống "lỗi hệ thống… thử lại sau vài phút" — lời khuyên sai, seller bấm lại vĩnh viễn vẫn cùng byte cũ.
- `copy_failed`/`commit_failed` không có prefix `rendition_` ⇒ vẫn về "lỗi hệ thống", đúng.

**Thay đổi phụ ngoài 502, coder tự quyết, cần soi:** `rendition_source_missing` (409, nhánh sản phẩm) nay cũng thành "Thử chọn ảnh khác" thay vì "lỗi hệ thống".

## §2 — Test khoá hành vi sai
- `errors.test.ts` case 502 + `rendition_metadata_present` → `toContain("Thử chọn ảnh khác")`, giữ `code === "502 · rendition_metadata_present"`.
- `MediaEditor.test.tsx` "says what the worker actually refused…" → `role="alert"` chứa "Thử chọn ảnh khác"; giữ `getByText("502 · rendition_metadata_present")` + `reportCaughtError`.
- Thêm: 502 + `copy_failed` → vẫn "Lỗi từ phía hệ thống", code `502 · copy_failed`.
- Case 422 `rendition_too_large` **không đụng**, vẫn xanh.

## §3 — Nối dây thật (`AdminShopApplicationReview.tsx`, `ActivationSection`)
- Dùng hook có sẵn `useShopProfileMedia(shopId)` + `usePublishProfileMedia(shopId)`. Không hook mới, không file mới, không CSS mới.
- **Gate "có gì để publish"** = row check theo server: `pendingMedia = media.some(m => m.verified_at && !m.public_path)`, **không** bắt chuỗi tiếng Việt của RPC. Gate dùng chung cho auto-publish lẫn nút thử lại ⇒ nút hiện theo sự thật server, **sống sót qua F5**.
- Tuần tự: `await activate.mutateAsync()` → lỗi thì `setError` + return (không publish) → ok và `pendingMedia` thì `await publishNow()`.
- **Tách state lỗi:** `publishError` riêng, `publishNow` tự nuốt lỗi trong try/catch ⇒ không chảy ngược vào catch của activate, không làm nút "Kích hoạt shop" hiện lại (có assertion).
- Câu lỗi: `Shop đã kích hoạt nhưng chưa đưa ảnh lên trang shop được: {shopErrorMessage(e)} — bấm "Đưa ảnh lên trang shop" để thử lại.`
- Nút `disabled={publish.isPending}`, nhãn "Đang đưa ảnh lên trang shop…".

**2 bẫy xanh-giả đã xử lý:** (1) thêm `vi.mock("@/integrations/supabase/client")` (client.ts throw khi thiếu env); (2) mock `shopFrom` builder thêm `then` — không có thì `useShopProfileMedia` nhận về chính builder và trả `[]` im lặng. Bằng chứng có tác dụng: case 6 (mount lại trang) chỉ xanh khi rows đến nơi, và ĐỎ trước khi nối dây.

## §4 — 4 case bù cho đường trình duyệt (`MediaEditor.test.tsx`)
1. Timeout 20s: mock `{data:null, error: name "FunctionsFetchError", response: undefined}` (không fake timer) → "Không kết nối được máy chủ…", có `Mã lỗi:`, nút retry `disabled === false`.
2. 403 `JWT expired` → "Phiên đăng nhập đã hết hạn".
3. 403 `permission denied for function …` → alert **không** chứa "permission denied", dòng `Mã lỗi:` **có**.
4. 200 sau một lần 502 → hết `role="alert"`, hết `"Mã lỗi:"`.

Cả 4 xanh **mà không cần sửa production code** ⇒ vòng 1 đã đúng, chỉ thiếu bằng chứng.

## §5 — 3 edge case `stripJpegMetadata` (fixture inline)
1. APP1 + APP13 + APP2 liên tiếp → loại cả 3; so sánh **toàn bộ mảng byte**; `inspectJpeg` → `{ok:true,64,64}`.
2. Fill byte `FF FF` trước marker → không crash, khớp byte-for-byte.
3. `len < 2` → identity (`toBe(broken)`) + so sánh toàn byte.

## §6 — BỎ QUA theo chỉ đạo
Không đọc `~/Downloads/secrets.local.md`, không gọi Management API, không đụng production. SQL còn nguyên trong `round1-report.md:363`:
```sql
delete from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';
```

## File đã sửa (vòng 2 — đúng 6 file)
`src/lib/shop/errors.ts` · `src/lib/shop/__tests__/errors.test.ts` · `src/components/shop/__tests__/MediaEditor.test.tsx` · `src/lib/shop/__tests__/imagePipeline.test.ts` · `src/pages/admin/shop/AdminShopApplicationReview.tsx` · `src/pages/admin/shop/__tests__/AdminShopApplicationReview.activate.test.tsx`

`git diff --stat` gộp cả 2 vòng: **11 files changed, 859 insertions(+), 45 deletions(-)** (+ `errors.test.ts` untracked).
Không commit/push/PR · `.env` còn nguyên · không migration, không dependency, không file source mới, không Playwright spec.

## Red-proof hai chiều

**§2 chiều 1 (đỏ trước fix):**
```
FAIL MediaEditor.test.tsx > says what the worker actually refused…
  expected 'Lỗi từ phía hệ thống…' to contain 'Thử chọn ảnh khác'
FAIL errors.test.ts > pulls the reason out of failed[]…
Tests  2 failed | 42 passed (44)
```
**Chiều 2 (xanh sau fix):** `Test Files 2 passed · Tests 44 passed`.

Test `copy_failed` không thể đỏ trước fix (xanh sẵn theo cấu tạo) ⇒ red-proof chiều ngược: tạm gỡ prefix guard (`startsWith("rendition_")` → `if (detail)`) →
```
FAIL … still blames the system, not the photo, for a 502 the photo did not cause
FAIL … does not pass a raw Postgres string through as advice
FAIL … survives a body that is not JSON, and still shows something
Tests  3 failed | 7 passed (10)
```
Đã khôi phục nguyên trạng (verify bằng grep + chạy lại xanh).

**§3 chiều 1 (đỏ trước khi nối dây):**
```
× calls publish_profile AFTER shop_activate, never beside it (0 lần gọi)
× keeps the activation when the publish leg fails, and offers the retry
× retries just the publish leg, and clears the line when it works
× still offers the button on a fresh page load, with no failure in memory  ← case 6
Tests  4 failed | 13 passed (17)
```
**Chiều 2:** `Tests 17 passed (17)`.
Case 2 và 3 là assertion phủ định, xanh cả trước lẫn sau — ghi rõ để không nhận công gian.

## 4 gate

| Lệnh | Exit | Kết quả |
|---|---|---|
| `npm run lint` | 0 | 0 error, 30 warning có sẵn |
| `npm run test` | 0 | 189 file · **2874 pass** · 10 skip |
| `npm run build` | 0 | build + PWA generateSW xong |
| `check-bundle-size.mjs` | 0 | INITIAL 227.3/280 · **CODE 1574.0/1800** · CONTENT 405.6/600 |

CODE gz 1572.7 → 1574.0 KB (+1.3 KB do nhánh publish trong trang admin). Không nâng threshold.

## Còn thiếu / không chắc
1. **§6 chưa làm** (cố ý) — auth user rác `0bbe10dc-…` **vẫn còn trên production**.
2. **Không có bằng chứng trình duyệt.** Tầng thay thế là vitest+jsdom chạy đúng component/hook production, chỉ giả `shopRpc`/`functions.invoke`/`shopFrom` — bắt được sai chỗ-nối (case 1 và 6 đỏ thật trước khi nối). **Không** bắt được: layout/tap target iPhone, hành vi thật của Safari WebKit khi encode JPEG, độ trễ mạng thật.
3. **Backlog Playwright** (PO cấm vòng này): cần seller test user + shop `pending_activation` có media verified · thêm role seller vào `tests/helpers/auth.ts` · `PLAYWRIGHT_BASE_URL` trỏ localhost (mặc định hiện **trỏ production**) · `page.route` chặn `functions/v1/shop-media-lifecycle`.
4. **🔴 Rủi ro dữ liệu tồn đọng, cần xử lý TRƯỚC Wave 1:** mọi rendition JPEG nằm trong draft bucket **trước** bản sửa vẫn còn EXIF ⇒ bấm "Đưa lên trang shop" gửi lại đúng byte cũ ⇒ `rendition_metadata_present` vĩnh viễn. Không có backfill. Phải đếm `shop_profile_media` có `verified_at IS NOT NULL AND public_path IS NULL` và xử lý từng row (seller tải lại ảnh, hoặc xoá row).
5. **Quyết định coder tự đưa ra, cần soi:** (a) `rendition_source_missing` 409 nay thành "Thử chọn ảnh khác"; (b) nếu query `shop_profile_media` chưa resolve lúc admin bấm Kích hoạt, `pendingMedia=false` ⇒ auto-publish không chạy (chấp nhận vì nút hiện ngay sau khi query về, không có trạng thái kẹt); (c) lỗi publish ở trang admin **không** gọi `reportCaughtError` (khác `MediaEditor` phía seller).
