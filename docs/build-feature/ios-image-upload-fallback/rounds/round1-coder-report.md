# Fix WebP/iOS — Vòng 1 — Báo cáo coder

## 1. Đã làm gì

JPEG fallback end-to-end cho pipeline ảnh Shop (iOS Safari không encode được WebP qua `canvas.toBlob`):

- **Client** (`src/lib/shop/imagePipeline.ts`): thêm `renditionFallbackType: "image/jpeg"`; refactor quality ladder thành hàm `ladder(type)` — WebP chạy trước, nếu blob null hoặc sai type thì chạy lại TOÀN BỘ ladder từ 0.82 với `image/jpeg`, không trộn type giữa chừng; cả hai fail → `ImageRejected` với copy mới `"Trình duyệt này không nén được ảnh. Hãy thử cập nhật trình duyệt hoặc chọn ảnh khác."`
- **Upload hook** (`src/hooks/shop/useMediaUpload.ts` ~207): `contentType: IMAGE_LIMITS.renditionType` → `contentType: processed.blob.type`.
- **Migration mới** `supabase/migrations/20260816120000_shop_media_jpeg_rendition_fallback.sql`: replace 3 hàm — `shop_media_limits()` thêm `rendition_content_types = ['image/webp','image/jpeg']`, `product_media_finalize` + `shop_profile_media_finalize` đổi check bằng-nhau thành membership `?`, message lỗi "ảnh đã xử lý phải là WebP hoặc JPEG (nhận được %)". Signature + DEFAULT giữ nguyên, không đụng grant.
- **Edge function**: `shop-media-lifecycle/jpeg.ts` mới (JPEG inspector thuần: SOI, segment walk có fill bytes, APP1 → metadata_present, SOF dims, truncated); `index.ts` publish() dispatch theo bytes thật (RIFF/WEBP → inspectWebp, FF D8 → inspectJpeg, còn lại → 422 `rendition_not_image`), contentType upload public theo verdict. CHƯA deploy (code ≠ deployed).
- **Object key giữ đuôi `.webp`** ở mọi chỗ — không đổi path nào (reconcile suy key deterministic `.webp`; browser render theo Content-Type).

## 2. File thay đổi (đúng 10 file trong bảng điều tra)

| File | Loại |
|---|---|
| `src/lib/shop/imagePipeline.ts` | sửa |
| `src/hooks/shop/useMediaUpload.ts` | sửa (+5) |
| `supabase/migrations/20260816120000_shop_media_jpeg_rendition_fallback.sql` | MỚI |
| `supabase/functions/shop-media-lifecycle/jpeg.ts` | MỚI |
| `supabase/functions/shop-media-lifecycle/index.ts` | sửa (+19) |
| `src/lib/shop/__tests__/imagePipeline.test.ts` | sửa (+73) |
| `src/hooks/shop/__tests__/useMediaUpload.test.tsx` | sửa (+22) |
| `supabase/functions/_shared/__tests__/shop-media-jpeg.test.ts` | MỚI |
| `supabase/tests/shop_phase2a_media_lifecycle.test.sql` | sửa (fixture negative jpeg→png, 5 dòng) |
| `supabase/tests/shop_media_jpeg_rendition.test.sql` | MỚI (plan 9) |

Diff feature nút kích hoạt nguyên vẹn (không mở/sửa file nào của nó).

## 3. Acceptance criteria

| AC | Lệnh | Kết quả |
|---|---|---|
| 1 | `npm run lint` | exit 0 (29 warnings pre-existing, 0 errors) |
| 2 | `npx tsc -b` | exit 0 |
| 3 | `npm run test` | exit 0 — **181 files, 2674 passed, 10 skipped**. Safari-sim (webp→PNG-type → jpeg, requestedTypes `[webp, jpeg]`, ladder restart `[0.82, 0.82]`); Chrome path không bao giờ jpeg; step-down jpeg `[0.82, 0.82, 0.7, 0.6]`; cả hai fail → message mới; jpeg inspector 6 case; useMediaUpload contentType = blob.type, key `/\.webp$/` |
| 4 | `supabase db reset --local` + `supabase test db --local` | exit 0 — **43 files, 1434 tests, All successful**. Negative flip (png vẫn 22023), jpeg product + profile finalize PASS, gif → 22023, key `.webp` |
| 5 | `npm run build` + `check-bundle-size.mjs` | exit 0 (headroom-low warning có sẵn, gate PASS) |
| 6 | grep enforcement | không còn điểm pin đơn-MIME; các hit `image/webp` còn lại đều là allowlist input / preferred const / sniffer bytes / test expectation / điểm dispatch theo verdict |
| 7 | reseed fixture | `up` exit 0 (phải xoá state file rác trước — xem mục 4) |
| 8 | `git status` | chỉ 10 file fix + diff feature kia nguyên vẹn; không commit |

## 4. Bất ngờ / quyết định ngoài chữ prompt

- **Reseed sau db reset:** `fixture down` báo 10 lỗi "User not found" (DB đã bị reset sạch) và GIỮ state file → `up` từ chối. Xoá state file `/var/folders/.../tph-p2b7-fixture.json` rồi `up` lại → OK. Hạn chế script khi chạy sau `db reset`, chưa sửa (ngoài phạm vi).
- **Blob null từ webp attempt cũng kích hoạt fallback JPEG** (prompt chỉ nói type-mismatch): một số browser trả null thay vì sai type — coi tương đương "encoder không hỗ trợ", an toàn hơn cho seller; message cũ "Không nén được ảnh này." nay unreachable, đã gỡ.
- Edge function chưa deploy — khi ship cần `supabase functions deploy shop-media-lifecycle`.
- Đã restart edge runtime local (`docker restart supabase_edge_runtime_...`) để code mới có hiệu lực trên local (gotcha cache isolate) — orchestrator thực hiện sau báo cáo.

---

# Delta sau review (vá 3 finding + 1 phát sinh)

- **F3:** `jpeg.ts` — EOI trước SOS giờ trả `not_jpeg` (trước đó SOF set dims vẫn lọt ok:true); comment sửa khớp; test mới `SOI+SOF0+EOI → not_jpeg`.
- **F2:** comment trần blind-spot APP1-giữa-scan là chấp nhận có chủ đích, cùng mức lỏng với webp.ts.
- **F7:** vitest case mới: webp toBlob trả null → jpeg thành công (`requestedTypes = [webp, jpeg]`).
- **F6:** pgTAP siết `jsonb_array_length(rendition_content_types) = 2` (plan vẫn 9).
- **File thứ 11 (điều tra sót, coder tự bắt):** `scripts/shop-media-ordering-integration.test.mjs` — case negative dùng `image/jpeg` flip đỏ thật sau migration (lần xanh trước là stale DB, chạy trước db reset). Đã đổi fixture sang `image/png`, semantics giữ nguyên. Bắt được nhờ đọc output "1 failed" dù pipe nuốt exit code.

Kết quả: tsc exit 0; vitest full **181 files, 2676 passed**; pgTAP CHƯA chạy lại (bảo vệ fixture Cuong đang test) — verify read-only expression qua psql trả `t`; sẽ chạy trọn ở vòng chốt cùng `db reset`.
