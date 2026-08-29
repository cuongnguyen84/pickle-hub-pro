# Technical prompt — iOS Safari JPEG fallback cho pipeline ảnh Shop (Wave-1 blocker)

## Bối cảnh

Seller dùng iPhone không đăng được ảnh sản phẩm: iOS Safari không encode WebP qua `canvas.toBlob(cb, "image/webp")` (trả blob type khác, thường PNG), pipeline từ chối có chủ đích tại `src/lib/shop/imagePipeline.ts:160-165` với message "Trình duyệt này chưa tạo được ảnh WebP. Thử trình duyệt khác." Đã xác nhận trên iPhone thật 2026-08-16.

**Hướng fix đã chốt (không được đổi):** JPEG fallback end-to-end. Client thử WebP trước (hành vi Chrome/Android GIỮ NGUYÊN); nếu `blob.type` trả về không phải `image/webp` thì chạy lại quality ladder với `image/jpeg`. Server chấp nhận rendition `image/jpeg` bên cạnh `image/webp`. KHÔNG dependency mới (không WASM encoder). KHÔNG nới lỏng mô hình verify: finalize vẫn đọc MIME thật từ `storage.objects` — chỉ mở rộng danh sách MIME rendition hợp lệ. EXIF vẫn tự rơi qua canvas re-encode.

**Quyết định kiến trúc đã ký (bắt buộc tuân thủ):** mọi object key GIỮ đuôi `.webp` kể cả khi bytes là JPEG (`rendition.webp`, `<media_id>-v<n>.webp`, `profile/.../live.webp`). Lý do: path lưu trong DB row, client build URL chỉ từ giá trị DB (`publicMediaUrl`); browser render theo Content-Type header chứ không theo đuôi; và `shop_media_reconcile` (migration `20260814110000`, dòng ~109) suy ra public key KỲ VỌNG một cách deterministic với `.webp` hardcode — đổi đuôi theo type sẽ phá reconcile và phải sửa 5+ hàm mà người dùng không được gì. Thêm comment ngắn tại chỗ liên quan: "extension is a claim; the MIME in storage.objects is the truth."

## Kết quả điều tra — bảng file → thay đổi (đầy đủ, KHÔNG cần tự khám phá lại)

| # | File | Thay đổi |
|---|------|----------|
| 1 | `src/lib/shop/imagePipeline.ts` | Sửa (client encode + fallback + message) |
| 2 | `src/hooks/shop/useMediaUpload.ts` | Sửa 1 dòng (contentType rendition, dòng 207) |
| 3 | `supabase/migrations/20260816<hhmmss>_shop_media_jpeg_rendition_fallback.sql` | MỚI — 1 migration duy nhất, replace 3 hàm |
| 4 | `supabase/functions/shop-media-lifecycle/jpeg.ts` | MỚI — JPEG inspector |
| 5 | `supabase/functions/shop-media-lifecycle/index.ts` | Sửa publish(): dispatch inspector theo bytes + contentType theo verdict |
| 6 | `src/lib/shop/__tests__/imagePipeline.test.ts` | Sửa stub + rewrite 1 test + thêm test fallback |
| 7 | `src/hooks/shop/__tests__/useMediaUpload.test.tsx` | Sửa mock blob có type + assert contentType |
| 8 | `supabase/functions/_shared/__tests__/shop-media-jpeg.test.ts` | MỚI — vitest cho jpeg inspector |
| 9 | `supabase/tests/shop_phase2a_media_lifecycle.test.sql` | Sửa fixture negative bị flip (dòng 185-196) |
| 10 | `supabase/tests/shop_media_jpeg_rendition.test.sql` | MỚI — pgTAP positive cho JPEG rendition |

Đã xác minh KHÔNG cần đổi: storage buckets đã cho phép `image/jpeg` (`20260811120000` dòng 499-510); `product_media_upload_init` validate type của ẢNH GỐC (đã nhận jpeg); `product_publish_prepare/commit`, `shop_media_reconcile`, cleanup, `shop_media_health`, public read model — không hàm nào pin MIME rendition; `src/lib/__tests__/shop-schema-parity.test.ts` không đọc `rendition_content_type` và không list migration mới (đừng thêm); `MediaEditor.tsx` chỉ dùng inputTypes (giữ nguyên); không client nào parse chuỗi lỗi `rendition_not_webp` nên đổi tên reason ở edge fn an toàn.

## Chi tiết từng thay đổi

### 1. `src/lib/shop/imagePipeline.ts`

- `IMAGE_LIMITS.renditionType: "image/webp"` giữ nguyên (preferred). Thêm `renditionFallbackType: "image/jpeg"` (hoặc tuple `renditionTypes` — tuỳ chọn, nhưng comment mirror `shop_media_limits()` phải vẫn đúng sự thật sau khi sửa).
- `processImage()` (ladder hiện tại dòng 154-169, qualities `[0.82, 0.7, 0.6, 0.5]`): thử WebP ở quality đầu; nếu blob trả về type sai → chuyển encoder sang `image/jpeg` cho TOÀN BỘ ladder và chạy lại từ 0.82 (không trộn type giữa ladder). Nếu JPEG cũng trả type sai hoặc null → throw `ImageRejected` với copy MỚI, ví dụ: `"Trình duyệt này không nén được ảnh. Hãy thử cập nhật trình duyệt hoặc chọn ảnh khác."` (message cũ bảo "thử trình duyệt khác" vì WebP — không còn đúng khi JPEG-capable browser nào cũng qua được).
- `ProcessedImage.blob.type` giờ là `image/webp` hoặc `image/jpeg`. Giữ nguyên: sniff input, HEIC message, abort, bitmap.close, targetSize, giới hạn size.

### 2. `src/hooks/shop/useMediaUpload.ts`

Dòng 207: `contentType: IMAGE_LIMITS.renditionType` → `contentType: processed.blob.type` (mimetype mà Storage ghi vào `storage.objects` chính là thứ finalize verify). Không đổi gì khác (upload original dòng ~198 đã dùng `item.file.type`; `_content_type` của init là type ảnh GỐC).

### 3. Migration MỚI (một file duy nhất — CẤM sửa migration cũ)

`supabase/migrations/20260816<hhmmss>_shop_media_jpeg_rendition_fallback.sql`:

- `CREATE OR REPLACE FUNCTION public.shop_media_limits()` (bản gốc `20260811140000` dòng 105): thêm key `'rendition_content_types', jsonb_build_array('image/webp', 'image/jpeg')`. GIỮ key số ít `rendition_content_type = 'image/webp'` (chú thích là preferred type) để không phá reader nào chưa biết.
- `CREATE OR REPLACE FUNCTION public.product_media_finalize(_media_id UUID, _width INTEGER DEFAULT NULL, _height INTEGER DEFAULT NULL)` (bản gốc `20260811140000` dòng 382): thay check bằng-nhau đơn MIME (dòng 425) bằng membership, ví dụ `IF NOT (_lim -> 'rendition_content_types') ? coalesce(_rend_meta ->> 'mimetype', '') THEN RAISE ...`. Mọi phần khác giữ byte-identical (size, dimension, idempotency `reused`, `shop.privileged_write` on/off). Giữ NGUYÊN signature kể cả DEFAULT (CREATE OR REPLACE không bỏ được DEFAULT — 42P13).
- Tương tự cho `public.shop_profile_media_finalize(_media_id UUID, _width INTEGER DEFAULT NULL, _height INTEGER DEFAULT NULL)` (bản gốc `20260811220000` dòng 357, check MIME dòng 401).
- Cập nhật message lỗi trong 2 hàm cho khớp danh sách (vd `'ảnh đã xử lý phải là WebP hoặc JPEG (nhận được %)'`).
- KHÔNG đụng grant/revoke (đã có ở migration gốc, replace không mất grant).

### 4. `supabase/functions/shop-media-lifecycle/jpeg.ts` (MỚI)

Inspector JPEG thuần (Deno-free, không dependency), mirror phong cách `webp.ts`:

- Verdict type: `{ ok: true; width; height } | { ok: false; reason: "not_jpeg" | "metadata_present" | "truncated" }`.
- Verify SOI (`FF D8`); walk segment (mỗi segment `FF <marker> <len_be16>`); bỏ qua fill bytes `FF FF`.
- APP1 (`FF E1`) — dù là Exif hay XMP — → `metadata_present` (canvas re-encode không bao giờ sinh APP1; APP1 là chỗ GPS đi nhờ).
- Đọc width/height từ SOF (markers `0xC0–0xCF` trừ `0xC4`, `0xC8`, `0xCC`): height = bytes 3-4, width = bytes 5-6 sau marker length.
- Segment vượt quá độ dài buffer → `truncated`; không tìm thấy SOF/dims = 0 → `not_jpeg`.

### 5. `supabase/functions/shop-media-lifecycle/index.ts`

Trong `publish()`:

- Thay `const verdict = inspectWebp(bytes)` (dòng 97) bằng dispatch theo bytes thật: `RIFF....WEBP` → `inspectWebp`; `FF D8` → `inspectJpeg`; còn lại → reject 422 với reason kiểu `rendition_not_image`.
- Upload public (dòng 108-112): `contentType` = type suy từ verdict (`image/webp` / `image/jpeg`) thay vì hardcode `"image/webp"`.
- Giữ nguyên: check size, check dimension, upsert, thứ tự copy-first-flip-second, logging (không log URL).
- Deploy edge function KHÔNG phải việc của bạn (không commit/push/deploy) — vitest cover inspector, pgTAP cover SQL.

### 6. `src/lib/shop/__tests__/imagePipeline.test.ts`

- Mở rộng `stubCanvas` (dòng ~60): cho phép type theo từng call VÀ ghi lại encoder type mà `toBlob` được yêu cầu ở mỗi call (tham số thứ 2 của toBlob).
- REWRITE test dòng ~190 "refuses a browser that hands back something other than WebP" thành test mô phỏng Safari: call webp đầu trả blob type `image/png` → pipeline re-encode JPEG; assert `out.blob.type === "image/jpeg"`; assert chuỗi type yêu cầu là webp rồi jpeg; assert fallback chạy lại từ quality 0.82.
- Assert đường Chrome (webp thành công ngay) vẫn ra webp và KHÔNG bao giờ yêu cầu jpeg.
- Thêm: ladder vẫn step-down bên trong nhánh JPEG; cả hai format đều fail → throw đúng message MỚI.

### 7. `src/hooks/shop/__tests__/useMediaUpload.test.tsx`

Mock `processImage` hiện trả `new Blob(["r"])` (type "") — đổi thành blob có type (`new Blob(["r"], { type: "image/webp" })`), assert upload rendition nhận `contentType` đúng bằng `processed.blob.type`, thêm một case blob type `image/jpeg` (assert contentType jpeg VÀ object key vẫn kết thúc `.webp`). Không nới lỏng assertion của upload ảnh gốc.

### 8. `supabase/functions/_shared/__tests__/shop-media-jpeg.test.ts` (MỚI)

Mirror `shop-media-webp.test.ts` (chạy dưới vitest, import `../../shop-media-lifecycle/jpeg.ts`). Builder bytes JPEG tối thiểu; case: (a) JPEG kiểu canvas (SOI+DQT+SOF0+scan) → ok đúng dims; (b) có APP1 Exif → `metadata_present`; (c) truncated; (d) không phải JPEG → `not_jpeg`.

### 9. `supabase/tests/shop_phase2a_media_lifecycle.test.sql`

Dòng 185-196: negative "client lies about re-encoding" hiện upload rendition mimetype `image/jpeg` và expect `22023` — **sau fix case này sẽ flip xanh giả** (jpeg thành hợp lệ, finalize thành công và làm hỏng các case sau vì `verified_at` bị set). Đổi fixture mimetype thành `image/png` (vẫn invalid), giữ nguyên semantics và tên test (chỉnh comment cho đúng).

### 10. `supabase/tests/shop_media_jpeg_rendition.test.sql` (MỚI)

Positive coverage cô lập, media row/token MỚI (không đụng `tok-A`):

- Rendition sản phẩm với `storage.objects` mimetype `image/jpeg` → `product_media_finalize` thành công, `byte_size` đọc từ storage.
- Rendition profile (logo/cover) mimetype `image/jpeg` → `shop_profile_media_finalize` thành công.
- Negative bổ sung: mimetype `image/gif` vẫn bị `22023`.
- Object key vẫn đuôi `.webp`. Theo convention setup/role/fixture của các test shop hiện có (`SET LOCAL role`, `request.jwt.claims`...).

## Ràng buộc

- Worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`. Đang có diff UNCOMMITTED của feature khác (nút kích hoạt shop): `src/main.tsx`, `src/pages/shop/*`, `src/pages/admin/shop/*`, `src/lib/shop/applicationState.ts`, `src/hooks/shop/useShopApplicationQueue.ts`, `ProductCard.tsx`, `ProductPreview.tsx`, `supabase/migrations/20260816090000_shop_activate_rpc.sql`, `supabase/tests/shop_activate.test.sql` + test mới của nó. CẤM đụng các file này (đã xác minh không giao với fix này). Trước khi kết thúc: soát `git status`/`git diff` xác nhận diff của bạn chỉ nằm trong 10 file ở bảng trên.
- KHÔNG commit, KHÔNG push, KHÔNG deploy, KHÔNG dependency mới, KHÔNG sửa migration cũ, KHÔNG đổi đuôi `.webp` của object key, KHÔNG refactor/format ngoài phạm vi.
- Dev server port 8080 đang phục vụ Cuong từ worktree này — cứ sửa (HMR tự áp), đừng kill/restart nó.
- `supabase db reset --local` XOÁ data test tay của Cuong → chạy pgTAP ở BƯỚC CUỐI CÙNG, xong reseed ngay.

## Thứ tự thực thi

1. Sửa client + edge function + migration + toàn bộ test.
2. `npm run lint` → `npx tsc -b` → `npm run test` → `npm run build` + `node scripts/check-bundle-size.mjs`.
3. Soát grep các điểm còn ghim `image/webp` (AC6).
4. Bước phá huỷ cuối: `supabase db reset --local && supabase test db --local` (bắt buộc `db reset` trước — `supabase start` không áp đủ migration).
5. Reseed: `node scripts/shop-p2b-fixture.mjs down || true` rồi `node scripts/shop-p2b-fixture.mjs up` (phải exit 0).
6. Báo cáo: danh sách file đổi, output tóm tắt từng lệnh verify, mọi bất ngờ gặp phải.

## Acceptance Criteria (đo được, tất cả phải đạt)

1. `npm run lint` exit 0.
2. `npx tsc -b` (hoặc typecheck chuẩn của repo) exit 0.
3. `npm run test` exit 0, trong đó có: (a) test Safari-simulation — toBlob webp trả PNG-type, lần jpeg trả đúng → output `image/jpeg`, chuỗi encoder webp→jpeg, restart từ 0.82; (b) đường Chrome vẫn webp, không bao giờ gọi jpeg; (c) ladder step-down trong nhánh jpeg; (d) cả hai fail → message mới; (e) jpeg inspector 4 case; (f) useMediaUpload assert contentType = blob.type cho cả webp lẫn jpeg, key vẫn `.webp`.
4. `supabase db reset --local && supabase test db --local` toàn xanh, gồm: negative đã đổi sang `image/png` vẫn throw `22023`; jpeg finalize sản phẩm PASS; jpeg finalize profile PASS; `image/gif` vẫn bị từ chối; toàn bộ test shop cũ khác không đỏ.
5. `npm run build` và `node scripts/check-bundle-size.mjs` đều exit 0.
6. `grep -rn "image/webp" src/lib/shop src/hooks/shop supabase/functions/shop-media-lifecycle` — không hit nào còn là điểm enforcement đơn-MIME; mỗi hit còn lại chỉ được là: hằng preferred-type, sniffer/dispatch theo bytes, expectation trong test, hoặc comment. Liệt kê và giải thích từng hit trong báo cáo.
7. Sau pgTAP, fixture reseed thành công (`shop-p2b-fixture.mjs up` exit 0).
8. `git status` cuối cùng: diff mới chỉ nằm trong 10 file ở bảng điều tra; diff feature nút kích hoạt nguyên vẹn từng byte.
