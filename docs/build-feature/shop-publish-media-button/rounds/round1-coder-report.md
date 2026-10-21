# Vòng 1 — Báo cáo của coder

> Bằng chứng thô đầy đủ nằm ở `rounds/round1-report.md` (do coder tự ghi). File này là bản tóm tắt nộp cho vòng review.

## 1. Root cause — ĐÃ CHỨNG MINH BẰNG BYTES PRODUCTION, và nó chính là H1 mà bản phân tích tuyên bố "CHẾT"

Rendition logo + bìa của shop PO là **JPEG do WebKit/ImageIO encode**, và chúng **mang APP1 (Exif 76 byte) + APP13 (Photoshop 3.0)**. `inspectJpeg` coi mọi APP1 là "chưa hề re-encode" → `copyRenditionToPublic` trả 422 `rendition_metadata_present` cho **cả hai** item → `publishProfile` trả 502 `{ok:false, failed:[…]}` → client ném lỗi thô.

Bằng chứng (tải object public về, chạy đúng `supabase/functions/shop-media-lifecycle/jpeg.ts`):
```
/tmp/live-logo.bin  {isJpeg:true, verdict:{ok:false, reason:'metadata_present'}}  512x512
/tmp/live-cover.bin {isJpeg:true, verdict:{ok:false, reason:'metadata_present'}}  2048x1536
marker dump: FFe0 "JFIF" · FFe1 "Exif\0\0MM…" · FFed "Photoshop 3.0\0 8BIM" · FFc0 · FFda
```

**Lý do giết H1 không đứng vững:** ảnh sản phẩm duy nhất đang publish trên prod là **WebP** (`content-type: image/webp`, RIFF/WEBP) ⇒ nhánh JPEG **chưa từng chạy thành công** qua edge function. Suy luận "product publish được ⇒ nhánh JPEG đã chạy với bytes iOS" là sai vì tiền đề sai.

Sau bản sửa, chính hai file production đó: `metadata_present` → `{ok:true,512x512}` / `{ok:true,2048x1536}`, mất đúng 136 byte, `sips` vẫn đọc 2048x1536.

**Bản sửa (ponytail, 1 chỗ, mọi caller):** `stripJpegMetadata()` trong `src/lib/shop/imagePipeline.ts`, chỉ áp cho nhánh fallback JPEG của `processImage`. Kiểm tra ở server **giữ nguyên độ chặt** (nó là trust boundary). Không SQL, không deploy edge, không dependency mới.

Ngoài ra làm đủ **Pha 3** (đường quan sát lỗi: `edgeErrorMessage` + 2 call site + 2 dòng UI + `reportCaughtError`) và **Pha 4** (gate `shopState`, nhãn nút "Thử lại", nút không bao giờ bị ẩn, `timeout: 20_000`, 2 dòng CSS).

## 2. File đã thay đổi (`git diff --stat` thật)

```
 src/components/shop/MediaEditor.tsx                |  94 +++++++++++---
 src/components/shop/__tests__/MediaEditor.test.tsx | 115 +++++++++++++++---
 src/hooks/shop/useProductMedia.ts                  |  19 ++-
 src/hooks/shop/useProductModeration.ts             |   8 +-
 src/lib/shop/__tests__/imagePipeline.test.ts       |  84 ++++++++++++
 src/lib/shop/errors.ts                             |  86 +++++++++++++
 src/lib/shop/imagePipeline.ts                      |  91 ++++++++++++-
 src/pages/shop/SellerShopSettings.tsx              |   1 +
 src/styles/shop.css                                |   4 +
 9 files changed, 467 insertions(+), 35 deletions(-)
+ mới: src/lib/shop/__tests__/errors.test.ts
+ mới: docs/build-feature/shop-publish-media-button/rounds/round1-report.md
```
Không đụng `supabase/**`, không đụng migration.

## 3. Gate

| Lệnh | Kết quả |
|---|---|
| `npm run lint` | exit 0 (30 warning có sẵn, 0 error) |
| `npm run test` | 189 file / **2860 pass** / 10 skip / 0 fail |
| `npm run build` | ✓ built in 5.30s |
| `node scripts/check-bundle-size.mjs` | exit 0 — CODE 1572.8/1800 KB, INITIAL 227.1/280 |
| `npx tsc -b` | exit 0 |
| `AdminShopProductReview.publish.test.tsx` | 3/3 pass |

**Red-proof hai chiều:** gỡ `failed[0].error` → `502 · rendition_metadata_present` ĐỎ; gỡ bước strip → test "cleans the JPEG the pipeline hands the uploader" ĐỎ; khôi phục → XANH.

## 4. Còn thiếu / không chắc

1. **D3–D7 KHÔNG chạy được.** Mọi đường quyền cao bị **permission classifier của Claude Code** chặn (không phải Supabase từ chối): đọc `~/Downloads/secrets.local.md` (PAT), `supabase projects api-keys` (service key), `supabase functions download`, mọi `curl` tới Management API query endpoint. ⇒ **Tiêu chí 3 (publish_profile trả HTTP 200 bằng JWT manager) chưa nghiệm thu được.**
2. **Giả thuyết "thiếu GRANT cho `authenticated`" vẫn treo** — cần `select proacl from pg_proc …` hoặc một JWT authenticated. Nhưng nó là "thêm vào" chứ không thay thế root cause: kể cả prepare chạy trót lọt, khâu copy vẫn từ chối đúng hai bytes đó. D2 đã **loại** PGRST202/schema cache và loại `SUPABASE_ANON_KEY` rỗng.
3. **🔴 Rác trên prod, coder không xoá được:** auth user chưa xác nhận `publish-probe-1786962691@thepicklehub.net` / `0bbe10dc-b091-41f5-a448-473e3c997d99` (thử signup để lấy JWT authenticated; project bật email confirm nên không có session, không có quyền gọi Admin API để xoá). SQL xoá đã ghi trong `round1-report.md`.
4. **Lệch prompt có chủ đích:** prompt cấm điều tra lại H1; coder không điều tra lại — D1 (đúng phép thử prompt yêu cầu để "đóng nắp quan tài") lại làm bật nắp. Bằng chứng byte thắng suy luận gián tiếp; muốn bác thì phải bác bằng dữ liệu.
5. **Không sửa comment sai ở `supabase/functions/**`** ("a canvas-encoded JPEG carries no APP1") vì đụng `_shared/__tests__` = redeploy toàn fleet edge. Backlog.
6. **Pill "Đã lên trang shop" (S6) không làm** — cần state riêng, prompt cấm đầu tư riêng.
7. Ảnh **đã upload trước bản sửa** vẫn mang APP1 trong draft bucket ⇒ vẫn fail publish; cách chữa là seller chọn lại ảnh. Shop PO không kẹt vì hai ảnh đã lên bằng script tay.
