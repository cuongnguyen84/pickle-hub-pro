# 01 — Task analysis: bug nút "Đưa lên trang shop"

## 1. Tóm tắt ý tưởng

Nút **"Đưa lên trang shop"** (đưa logo/ảnh bìa đã xác minh sang bucket công khai) không hoạt động khi PO bấm trên iPhone/iOS Safari ngày 17/08. Logo và bìa của shop Wave-0 hiện đang live **chỉ nhờ script tay** (`scripts/publish-shop-profile-media-manually.sh`) — tức chặng thật của tính năng chưa từng chạy thành công lần nào từ trình duyệt. Việc cần làm: truy ra nguyên nhân thật, sửa bằng diff ngắn nhất, và để lại một đường quan sát lỗi để lần sau không phải đoán. Đây là thứ code duy nhất còn chặn Wave 1.

Đính chính quan trọng: **chưa có bằng chứng nào cho thấy đây là bug "chỉ có trên iOS"**. Chặng `publish_profile` mới lên prod cùng #603 (17/08) và chưa ai bấm nó từ máy khác. "iOS Safari" hiện là *nơi duy nhất đã thử*, không phải *điều kiện gây lỗi đã chứng minh*.

## 2. Mục tiêu / bài toán cần giải

Seller (hiện là PO, sau đó 3-5 seller Wave 1) phải tự đưa được logo + ảnh bìa lên trang shop công khai mà không cần ai chạy script service-role hộ. Cho tới khi việc đó chạy được từ điện thoại, Wave 1 không mở được vì mỗi seller mới đẻ ra một lần chạy script thủ công.

Bài toán phụ ngang tầm quan trọng: hệ thống hiện **không có cách nào biết vì sao nó hỏng**. `function_edge_logs` prod ghi thiếu nặng (24h/1 dòng), client thì vứt mất nội dung lỗi của server (mục 4). Hai thứ cộng lại = nút chết câm chỉ sửa được bằng phỏng đoán.

## 3. Đường đi thật của tính năng (truy vết trong worktree `shop-publish-btn`)

| Chặng | File : dòng | Điều cần biết |
|---|---|---|
| Nút | `src/components/shop/MediaEditor.tsx:504-510` | `<button type="button" onClick={() => publish.mutate()}>Đưa lên trang shop</button>` |
| Điều kiện hiện nút | `MediaEditor.tsx:487` | chỉ hiện khi `row.verified_at && !row.public_path`; `:503` ẩn nếu `disabled` |
| Trạng thái chạy / lỗi | `MediaEditor.tsx:490-502` | pending → "Đang đưa ảnh lên trang shop công khai…"; lỗi → **một câu cố định**, không mã lỗi server |
| Auto-publish sau upload | `MediaEditor.tsx:427-432` | `profileMediaTarget(..., () => { onChanged(); publish.mutate(); })` |
| Hook | `src/hooks/shop/useProductMedia.ts:104-128` | `import()` client (`:111`) → `supabase.functions.invoke("shop-media-lifecycle", { body: { action: "publish_profile", shop_id } })` (`:112`) → `if (error) throw error` (`:115`) |
| SDK client | `src/integrations/supabase/client.ts:11-17` | một instance duy nhất; `shop-client.ts:58` chỉ cast lại chính nó |
| SDK invoke | `@supabase/functions-js FunctionsClient.js:178-306` | POST JSON; **không** gửi header `x-supabase-client-*` |
| Kiểu lỗi SDK | `functions-js types.js:37-71` | `FunctionsFetchError` vs `FunctionsHttpError`; body thật nằm ở `error.context` (Response) |
| Edge entry | `supabase/functions/shop-media-lifecycle/index.ts:292-328` | OPTIONS → `corsHeaders`; dispatch `publish_profile` `:309-311` |
| Authz | `index.ts:187-200` | thiếu `Authorization` → **401**; `prepare` lỗi → **403** kèm `planError.message` |
| Copy leg | `index.ts:85-134` | download `:86` (409) · >1 MiB `:93` (422) · sniff WebP/JPEG `:103-111` (422 `rendition_not_image`) · `inspectJpeg`/`inspectWebp` `:112-116` (422 `rendition_<reason>`) · >2048px `:117` · upload public `:124` (502) |
| Commit từng ảnh | `index.ts:218-227` | lỗi → `failed[]`, không rollback ảnh kia |
| **Mã trả về khi 1 ảnh lỗi** | `index.ts:234-237` | `ok:false` + **HTTP 502** |
| SQL prepare | `migrations/20260817090000_shop_profile_media_publish.sql:35-83` | manager/admin `:50` · shop phải `active` `:56` · chỉ lấy row `verified_at IS NOT NULL` `:71` · target `<shop>/profile/<purpose>/<id>/v<n>/live.webp` `:66-67` · `_plan IS NULL` → raise `:73` |
| SQL commit | cùng file `:92-154` | verified `:111` · path phải khớp **đúng version hiện tại** `:124-129` · shop còn `active` `:135` |
| Client encode | `src/lib/shop/imagePipeline.ts:164-187` | WebP trước; iOS Safari trả blob sai type → rơi xuống ladder JPEG; luôn ≤1 MiB |
| Giám định JPEG | `supabase/functions/shop-media-lifecycle/jpeg.ts:51-53` | **bất kỳ APP1 nào → `metadata_present` → 422** |
| Workaround | `scripts/publish-shop-profile-media-manually.sh:23-35` | copy bằng service key + gọi thẳng `..._publish_commit` — **bỏ qua toàn bộ chặng download/sniff/inspect** |

Ba dữ kiện cứng:

- Script tay chạy được ⇒ row đã `verified`, shop `active`, path khớp version. Prepare/commit về dữ liệu là ổn.
- Chặng **duy nhất chưa từng chạy với bytes thật của PO** là copy leg (`index.ts:85-134`) và toàn bộ đường trình duyệt → gateway.
- Khi có ảnh lỗi, edge trả **502** ⇒ `supabase-js` ném `FunctionsHttpError` ngay ở `useProductMedia.ts:115`; dòng `if (!result?.ok)` ở `:121` **không bao giờ chạy**, `failed[].error` bị vứt cùng response.

## 4. Giả thuyết root cause, xếp theo khả năng

**H0 (sự thật đã đọc trong code, không phải giả thuyết): client vứt mất lỗi của server.** `useProductMedia.ts:115` ném nguyên `FunctionsHttpError`, `.message` luôn là "Edge Function returned a non-2xx status code"; body (`{failed:[{error:"rendition_..."}]}`) nằm trong `error.context`, không ai đọc. UI in câu cố định (`MediaEditor.tsx:498-502`). Cùng lỗi ở `useProductModeration.ts:158-161`. Vì vậy mọi nguyên nhân H1-H8 đều cho **triệu chứng giống hệt nhau**.

**H1 — Rendition JPEG do iOS sinh ra mang APP1 nên bị chặn ở `inspectJpeg` (422 `rendition_metadata_present`).** Khớp nhiều dữ kiện nhất: iOS-only theo đúng cơ chế (Chrome/Android ra WebP, iOS rơi xuống JPEG — `imagePipeline.ts:176-180`), nằm đúng chặng script tay đã nhảy qua, và giả định nền tảng chưa từng kiểm chứng: comment `jpeg.ts:4-7` + test `_shared/__tests__/shop-media-jpeg.test.ts:39-45` khẳng định "canvas không bao giờ ghi APP1" nhưng **chỉ chứng minh trên JPEG tự dựng trong test**, chưa từng chạy trên file thật do Safari/ImageIO encode. *Bác bỏ rẻ nhất:* tải 2 object `rendition.webp` của shop PO trong `shop-product-media-draft` bằng service key rồi chạy `sniffImageType` + `inspectJpeg` trên bytes đó (offline, không cần iPhone). Kiểm phụ 5 giây: `curl -I` ảnh sản phẩm live trong bucket public — nếu `Content-Type: image/jpeg` thì chặng JPEG đã chạy thật trên prod và H1 chết.

**H2 — `prepare` bị PostgREST từ chối cho vai `authenticated` (thiếu GRANT / schema cache) → 403.** Probe cũ chạy qua Management API với `set_config`, tức **postgres superuser** — mù với GRANT. Edge gọi bằng anon key + JWT người dùng = vai `authenticated`. *Bác bỏ rẻ nhất:* `select has_function_privilege('authenticated','public.shop_profile_media_publish_prepare(uuid)','execute')` + `select proname, pronargs from pg_proc where proname like 'shop_profile_media_publish%'`.

**H3 — Bản deploy của edge function không phải bản trong repo.** Anon probe 403 chứng tỏ action tồn tại, không chứng tỏ có nhánh sniff JPEG (`index.ts:103-112`, từ #584). *Bác bỏ rẻ nhất:* `npx supabase functions download shop-media-lifecycle --project-ref ajvlcamxemgbxduhiqrl` rồi diff.

**H4 — Session/JWT của PO trên iPhone không hợp lệ lúc bấm** (refresh token hỏng, ITP/private mode) → 401 (`index.ts:189`) hoặc `auth.uid()` null → 403. Query đọc vẫn hiện dữ liệu nên PO tưởng còn đăng nhập.

**H5 — Request không rời được máy (network/CORS/PWA).** Nếu vậy là `FunctionsFetchError` chứ không phải HTTP — phân biệt được ngay khi có H0-fix. CORS khả năng thấp: `_shared/cors.ts:16-30` cho đúng bộ header SDK 2.89 gửi.

**H6 — Mutation không bao giờ settle**, UI đứng vĩnh viễn ở "Đang đưa ảnh lên trang shop công khai…" (`MediaEditor.tsx:490-492`). Không có `timeout` truyền vào `invoke`.

**H7 — Bundle cũ do service worker**: thấp (PO nhìn thấy nút ⇒ chunk mới đã tải), vẫn nên loại trừ bằng hard reload.

**H8 — commit bị từ chối vì lệch version** (`publish.sql:126-129`) nếu PO up ảnh mới trong lúc publish đang bay. Thấp, nhưng rơi đúng nhánh 502 nên hiện không phân biệt được với H1.

**Đã loại bỏ:** "plan rỗng nên hàm trả ok mà chẳng làm gì" (prepare raise khi `_plan IS NULL`) · "hai supabase client / hai session" (`shop-client.ts:58` dùng lại instance ở `client.ts:11`) · "`crypto.randomUUID` thiếu" (đã polyfill `src/main.tsx:4-9`, đường publish không sinh UUID).

## 5. Phạm vi công việc

**Trong phạm vi.** (1) Chốt root cause bằng phép thử rẻ nhất, **offline trước**, thứ tự H1 → H2/H3 → còn lại; kết luận phải dựa trên bytes/quyền/diff thật, cấm suy từ thiếu log. (2) Sửa đúng nguyên nhân, diff ngắn nhất, không thêm phụ thuộc. (3) Bắt buộc bất kể nguyên nhân: **cho lỗi thật hiện ra và ghi lại được** — đọc `error.context` một lần ở chỗ dùng chung của cả hai call site (`useProductMedia.ts:104-128` và `useProductModeration.ts:150-166` cùng lỗi), hiển thị mã lỗi server ở `MediaEditor.tsx:498-502`, báo cáo qua `reportCaughtError()` có sẵn (`src/lib/errorReporter.ts:105-113`) — độc lập với `function_edge_logs` đang hỏng. (4) Đúng một phép kiểm chạy được chứng minh logic mới; nếu H1 đúng thì fixture phải là **bytes thật từ iPhone**.

**Ngoài phạm vi.** Không mở Wave 1, không bật indexing, không đụng P3a/P3b/P4. Không refactor `MediaEditor`/UI vừa ship #603. Không thêm thư viện ảnh, Sentry, hàng đợi/retry, lớp trừu tượng "publish service". Không sửa backlog khác (bulk-approve, `owner_user_id` lộ REST, pill suspended, B14). Không đổi `verify_jwt`/preset CORS. Không coi "chạy lại script tay" là cách sửa.

## 6. Rủi ro

Rủi ro lớn nhất: **sửa nhầm tầng** — chỉ làm đẹp thông báo lỗi thì nút vẫn chết, chỉ là chết có lời giải thích. H0 là điều kiện cần để chẩn đoán, không phải bản sửa.

Nếu H1 đúng, bản sửa chạm hàng rào quyền riêng tư: `jpeg.ts:51-53` chặn APP1 để toạ độ nhà seller không lên CDN. Nới vô điều kiện là đánh đổi thật — phải giữ chặn GPS, và lựa chọn (nới có kiểm soát ở server vs bắt client strip trước khi upload) cần PO ký.

Rủi ro vận hành: muốn tái hiện phải up **ảnh mới**, mà `shop_profile_media_upload_init` (`migrations/20260811220000:314-326`) bump version và **xếp hàng xoá object công khai cũ** ⇒ thử trên shop PO có thể làm logo đang live biến mất nếu bản sửa chưa xong.

Ngoài ra: bản sửa edge function **phải deploy tay** và xác nhận (code ≠ deployed = H3). Trên iOS, sau ship bundle mới PO phải hard-reload. Cấm lập luận "không có log ⇒ request không tới".

## 7. Acceptance criteria

1. **Bằng chứng root cause** dán vào tài liệu: output thật (verdict `inspectJpeg` trên bytes thật kèm path object / `has_function_privilege` / diff bản deploy). Agent tự chạy, không cần iPhone.
2. **Red-proof:** gỡ bản sửa ⇒ test đỏ; áp vào ⇒ xanh (`npm run test`). Agent.
3. **Chạy thật ở tầng dưới:** local stack (`supabase db reset` + mẫu `scripts/shop-p2b-media-lifecycle.test.mjs`) publish một rendition **JPEG thật của iOS** → HTTP 200, `public_path` khớp version hiện tại. Agent.
4. **Đường quan sát lỗi:** ép lỗi (rendition rỗng) → UI hiện mã lỗi server thật (dạng `rendition_metadata_present (422)`) thay vì câu cố định, và đúng một dòng client events. Kiểm trên Chrome desktop/vitest — không cần iPhone.
5. **Không hồi quy publish sản phẩm:** `src/pages/admin/shop/__tests__/AdminShopProductReview.publish.test.tsx` vẫn xanh.
6. **Nghiệm thu cuối prod — chỉ Cuong bấm:** up logo mới từ iPhone → bấm nút → xác nhận bằng `curl -I` URL public 200 đúng `Content-Type` + SQL đọc `purpose, version, public_path`. Nếu vẫn lỗi thì lỗi **tự khai tên** — cũng là kết quả dùng được.

## 8. Câu hỏi mở cần PO trả lời

1. **Khi bấm nút, màn hình hiện chính xác cái gì?** (không đổi gì / kẹt "Đang đưa ảnh lên…" / dòng đỏ / trang tự tải lại) — loại được một nửa giả thuyết.
2. **Ảnh sản phẩm Wave 0 up từ iPhone được publish bằng nút trong admin hay bằng script?** Nếu bằng nút thì copy leg đã chạy với bytes iOS ⇒ H1 chết.
3. Safari thường, PWA đã cài, hay in-app browser?
4. Có được up lại logo/bìa mới trên shop PO để tái hiện (chấp nhận ảnh công khai bị hạ + xếp hàng xoá), hay phải dựng shop test riêng?
5. Có cho phép agent tạo tài khoản seller test trên prod (createUser + `shop_members`) để tự chạy end-to-end?
6. Nếu root cause đúng là APP1 do iOS ghi: chấp nhận phương án nào — server chỉ chặn khi có GPS thay vì mọi APP1, hay client strip metadata trước upload? (quyết định quyền riêng tư, cần chữ ký PO)

---

*Ghi chú:* `docs/proposals/shop-closed-pilot/PHASE-PROGRESS-2026-08-17.md` **chỉ có ở checkout gốc** `/Users/cm10/pickle-hub-pro/`; toàn bộ code shop mới nhất **chỉ có trong worktree** `shop-publish-btn`.
