# 02 — Bản phân tích ĐÃ CHỐT (orchestrator tổng hợp)

Nguồn: `01-task-analysis.md` + `02-po-answers.md` + `02-critic-feasibility.md` + `02-critic-user.md`.
Hai critic **không mâu thuẫn nhau** ở điểm nào quan trọng — cả hai đều giết H1, đều đòi vá đường quan sát lỗi, đều phát hiện độc lập cùng một defect "một plan shop-wide vs hai nút", đều đòi cắt local stack. Khác biệt duy nhất là **thứ tự**: feasibility nói "điều tra trước, có thể không cần diff code nào"; user nói "vài sửa UX là đúng bất kể root cause". Chốt: **làm theo pha**, điều tra trước, UX sau, và chỉ giữ phần UX rẻ + chặn được lỗi lặp lại ở Wave 1.

---

## A. Đã chết, cắt khỏi mọi tài liệu sau

- **H1 (iOS JPEG mang APP1 bị `inspectJpeg` chặn).** `copyRenditionToPublic` (`index.ts:85-134`) dùng chung cho product (`:163`) và profile (`:212`); bytes cũng chung một lò (`useMediaUpload.ts:182` → `imagePipeline.ts:176-180`). PO xác nhận ảnh sản phẩm up từ iPhone **publish được bằng nút** ⇒ nhánh JPEG đã chạy thật với bytes iOS.
  ⇒ Cắt: phép thử "tải rendition bằng service key rồi chạy inspectJpeg", fixture "bytes thật từ iPhone", rủi ro riêng tư APP1/GPS, câu hỏi PO về nới hàng rào GPS.
- **H4 bản rộng (phiên không phải manager).** `shop_profile_media_finalize` (`20260816120000:152`) đòi đúng `is_shop_manager` và **đã chạy được** (row có `verified_at` nên nút mới hiện, `MediaEditor.tsx:487`); `is_shop_manager` (`20260811120000:60-73`) không dính aal2. Chỉ còn bản hẹp: token hết hạn giữa upload và lúc bấm.
- **Suy luận "401 = thiếu Authorization".** supabase-js luôn gửi `Authorization` (anon key nếu mất session) ⇒ mất session ra **403**. Nhánh 401 (`index.ts:189`) là code chết; cấm dùng 401/403 để phân biệt.

## B. Bằng chứng RỖNG phải loại khỏi hồ sơ

"Anon probe → 403 ⇒ action tồn tại và server khỏe" (chép từ PHASE-PROGRESS) **không chứng minh gì về RPC**. `index.ts:199` gộp **mọi** lỗi của `rpc()` vào một mã 403: `insufficient_privilege` (thân hàm chạy đúng) · `42501` (thiếu GRANT) · `PGRST202` (schema cache chưa reload). Cùng loại lỗi với probe Management API cũ (chạy dưới superuser ⇒ mù với GRANT) — lần này là *mù với status*.

## C. Giả thuyết đã xếp lại hạng

| Hạng | Giả thuyết | Phép thử quyết định |
|---|---|---|
| **1** | RPC mới `shop_profile_media_publish_prepare` (migration `20260817090000`, sinh 17/08) **không gọi được qua PostgREST dưới vai `authenticated`** — PGRST202 schema cache / thiếu GRANT / migration chưa áp đủ | `curl -i POST /rest/v1/rpc/shop_profile_media_publish_prepare` bằng anon key rồi **đọc body** (không phải `has_function_privilege` — catalog mù với schema cache). Kèm `select proname, pronargs, proacl from pg_proc where proname like 'shop_profile_media_publish%'` |
| **2** | **Lỗi chéo slot**: prepare trả plan **shop-wide** (`20260817090000:70-71` chỉ lọc `verified_at IS NOT NULL`), edge trả **502 khi partial** (`index.ts:234-237`), UI có **hai nút độc lập** (`MediaEditor.tsx:410-515`, `:422`) ⇒ **bìa hỏng làm nút logo báo lỗi dù logo đã lên** | Lộ ra ngay ở bước gọi thật (mục D) — đọc `failed[]` |
| 3 | `SUPABASE_ANON_KEY` rỗng trong bản deploy (`index.ts:46,137-140`) → PostgREST "No API key found" → lại 403 | Cùng phép thử mục D, đọc body |
| 4 | Bản deploy edge ≠ repo (H3 cũ) | `supabase functions download` + diff. **Không** suy từ 403 |
| 5 | H4 hẹp: token hết hạn giữa upload và lúc bấm | Chỉ còn ý nghĩa nếu mục D thành công |
| 6 | H6: mutation không settle (kẹt spinner vĩnh viễn) | Đúng bất kể root cause ⇒ đã nâng thành yêu cầu UX, không cần chứng minh |
| 7 | H5/H7: request không rời máy / bundle cũ do SW | Chỉ điều tra nếu mục D thành công |

**Ghi chú prior:** `product_publish_prepare` có từ `20260811140000:498`, đã chạy hàng chục lần; `shop_profile_media_publish_prepare` sinh 17/08 và **chưa từng thành công lần nào từ trình duyệt**. Đây là khác biệt lớn nhất giữa hai nhánh.

**Bất đối xứng cần nhớ khi đọc mọi triệu chứng:** publish ảnh sản phẩm do **admin** bấm sau khi duyệt (`useProductModeration.ts:142-166`, phiên aal2); publish logo/bìa là **publish duy nhất seller tự bấm**, dưới JWT seller thường, qua RPC mới.

## D. Đường điều tra đã chốt — chạy TRƯỚC khi viết bất kỳ dòng code nào

PO đã cho phép tạo user/shop test trên prod và up lại logo/bìa shop PO. Nhưng **không cần up ảnh mới** — có đường rẻ hơn và không phá gì:

1. `curl -sI` object công khai hiện tại → đọc `Content-Type` (đóng nắp quan tài H1, 5 giây).
2. `curl -i POST /rest/v1/rpc/shop_profile_media_publish_prepare` bằng anon key → đọc body (phân biệt PGRST202 / 42501 / insufficient_privilege).
3. `pg_proc` + `proacl` qua Management API → bắt migration chưa áp đủ (drift mãn tính: áp qua Management API **không** ghi `schema_migrations`).
4. Tạo user test (`POST /auth/v1/admin/users`, `email_confirm:true`) → `INSERT shop_members(..., 'manager')` vào **thẳng shop PO**.
5. `UPDATE shop_profile_media SET public_path = NULL WHERE purpose='cover'` — "lên đạn" đúng trạng thái lỗi. **Không bump version, không enqueue cleanup, không mất ảnh live** (row còn `verified_at` nên `shop_media_referenced_objects` (`20260817090000:216-220`) vẫn giữ key).
6. Lấy access_token user test (`/auth/v1/token?grant_type=password`) → `curl -i POST /functions/v1/shop-media-lifecycle` body `{"action":"publish_profile","shop_id":"..."}`. **Đây đúng là cái `supabase.functions.invoke` gửi** (`FunctionsClient.js:251-262`), khác biệt duy nhất là ta đọc được status + body.
7. Dọn: `DELETE` row `shop_members` + xoá user test.

~20-30 phút, kết luận được hạng 1-4 trong một phát, trên đúng schema cache / GRANT / bản deploy của prod. **Nếu bước 6 thành công** ⇒ root cause nằm phía trình duyệt/phiên (hạng 5-7) và lúc đó mới cần iPhone.

**CẮT hẳn** phương án `supabase db reset` + stack local: 1-2 giờ (hoặc nửa ngày nếu vấp mount edge runtime theo worktree), làm hỏng stack local của checkout gốc, và **không tái hiện được** thứ đang nghi (schema cache prod, GRANT prod, bản deploy prod). Chỉ dùng làm dự phòng nếu bước 6 không phân biệt được.

## E. Phạm vi công việc đã chốt

### Pha 1 — Chẩn đoán (không sửa code)
Chạy D1-D7, dán nguyên **status + body** vào `rounds/`. Cấm suy luận từ absence of logs (`function_edge_logs` prod ghi thiếu nặng).

### Pha 2 — Sửa root cause
Theo kết quả pha 1. **Có thể không có diff code nào** — nếu là schema cache thì fix là `NOTIFY pgrst, 'reload schema'` (nhớ luật cấm giờ livestream), nếu thiếu GRANT thì fix là một câu `GRANT`. Migration/deploy nào áp lên prod phải ghi ledger đúng nếp cũ.

### Pha 3 — Đường quan sát lỗi (BẮT BUỘC, bất kể root cause)
~8 dòng, 3 file có sẵn, 0 file mới:
1. `src/lib/shop/errors.ts` — thêm `edgeErrorMessage(error, response)`: có `response` thì `await response.text()`, rút `error` / `failed[0].error` + status; ngược lại trả `shopErrorMessage(error)` (hàm này **vốn đã** ưu tiên giữ nguyên message tiếng Việt của RPC, `errors.ts:14-19`).
2. `useProductMedia.ts:112-115` + `useProductModeration.ts:158-161` — thêm `response` vào destructure (**SDK 2.89 đã trả field thứ ba**, `FunctionsClient.js:289,295-297` — không cần import `FunctionsHttpError`, không đụng `error.context`), rồi `throw new Error(await edgeErrorMessage(error, response))`.
3. `MediaEditor.tsx:498-502` — hiển thị **hai dòng**: câu tiếng Việt hành động được (to) + dòng mờ "Mã lỗi: …" để seller chụp màn hình. Thêm `reportCaughtError(e, "shop:publish_profile")` trong `onError` (≈0 byte, đã có trong bundle).

Copy tiếng Việt theo nhóm (không lấy mã kỹ thuật làm thông điệp chính):

| Tình huống | Câu cho seller |
|---|---|
| Shop chưa kích hoạt / tạm ngưng (403, `20260817090000:56-59`, `:135-138`) | Giữ nguyên câu server + "Ảnh đã lưu, kích hoạt shop xong bấm lại là hiện." |
| Hết phiên đăng nhập | "Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm lại giúp em." |
| Không gửi được (`FunctionsFetchError`) | "Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại." |
| Ảnh máy chủ không nhận (422 `rendition_*`) | "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác." |
| Còn lại (409/502/không rõ) | "Lỗi từ phía hệ thống, không phải do ảnh của anh/chị. Em đã nhận được báo lỗi rồi, bấm Thử lại sau vài phút." |

### Pha 4 — 3 sửa UX rẻ, chặn lỗi lặp lại ở Wave 1 (giữ; phần còn lại đẩy backlog)
1. **Không auto-publish khi `shop.state ≠ active`** (`MediaEditor.tsx:427-432` vs `20260817090000:56-59`; gate hiện chỉ theo vai trò, `SellerShopSettings.tsx:78`). Thay bằng "Ảnh đã lưu. Sẽ tự hiện trên trang shop khi shop được kích hoạt." — chặn vòng lặp bấm-lỗi **gần như chắc chắn xảy ra** với seller Wave 1 up logo trước khi được kích hoạt.
2. **Đổi nhãn nút** `MediaEditor.tsx:509` "Đưa lên trang shop" → **"Thử lại"**, và câu trạng thái `:495-497` sang mô tả **hậu quả** ("Trang shop hiện chưa có logo"). Lý do: publish **đã tự chạy** sau upload (`:427-432`) nên nút chỉ là retry; hiện có ba tên cho một thứ (comment `:424-426` "Thử lại", dòng lỗi `:500` "Bấm thử lại", nhãn `:509`). Hai chuỗi text — không phải refactor UI #603.
3. **Không trạng thái nào hiển thị quá ~30s mà không có nút bấm được**: thêm `timeout` cho `invoke` (SDK đã có option, `FunctionsClient.js:184,238-240`) hoặc chuyển trạng thái quá hạn thành lỗi + "Thử lại". `MediaEditor.tsx:489-513` hiện là nhánh loại trừ — pending thì **không nút, không huỷ**.

### Ngoài phạm vi (backlog, ghi nhưng KHÔNG làm vòng này)
- **Defect "một plan shop-wide vs hai nút"** (hạng 2 ở mục C): sửa đúng là thêm điều kiện vào `WHERE` của prepare (`20260817090000:71`) loại row đã ở đúng target, **và/hoặc** `index.ts:236` trả 200 kèm `ok:false` cho partial success (khi đó `useProductMedia.ts:121` — code viết sẵn đang chết — mới sống lại). Nhãn: **"chặn Wave 1 khi có seller thứ hai"**. Chỉ gộp vào PR này nếu pha 2 buộc phải sửa chính hàm đó.
- Confirm trước khi thay ảnh (`useConfirm()`) + copy nói rõ "trang shop mất logo ngay" (`MediaEditor.tsx:451`) — vì `shop_profile_media_upload_init` set `public_path = NULL` + xếp hàng xoá **ngay khi chọn ảnh mới** (`20260811220000:314-342`).
- Badge "đang hiển thị / chưa hiển thị" đọc `row.public_path` (preview luôn là ảnh draft, `MediaEditor.tsx:438-439`); link "Xem trang shop của tôi" trong `SellerShopSettings`.
- Mọi thứ thuộc P3a/P3b/P4, mở Wave 1, bật indexing — cổng của PO.
- Không thêm dependency, không Sentry, không hàng đợi/retry tự động, không lớp trừu tượng "publish service", không đổi `verify_jwt`/preset CORS.
- Shop UI thuần tiếng Việt hardcode là **lệch chuẩn song ngữ có chủ đích** — ghi lại, đừng vá EN nửa vời.

## F. Acceptance criteria (bản chốt, thay hoàn toàn mục 7 của bản 01)

1. **Bằng chứng root cause**: dán nguyên status + body của D2/D6 (và `curl -sI` của D1) vào `rounds/`. Agent tự chạy, không cần iPhone, không cần Chrome.
2. **Red-proof**: test vitest cho `edgeErrorMessage` với `new Response(JSON.stringify({failed:[{error:"rendition_metadata_present"}]}), {status:502})` → gỡ bản sửa thì đỏ, áp vào thì xanh. `npm run test`.
3. **Chạy thật trên prod**: `publish_profile` gọi bằng JWT manager của user test trả **HTTP 200**, `public_path` khớp version hiện tại. (Thay hoàn toàn AC#3 local stack của bản 01.)
4. **Đường quan sát lỗi**: ép một lỗi → UI hiện **câu tiếng Việt hành động được** + dòng mờ "Mã lỗi: …", và có dòng trong client events. Lưu ý `errorReporter.ts:31-41` **dedupe 5 phút** ⇒ bấm lần 2 trong 5 phút không sinh dòng thứ hai (nêu rõ, kẻo lần sau tưởng mất log).
5. **Không hồi quy publish sản phẩm**: `src/pages/admin/shop/__tests__/AdminShopProductReview.publish.test.tsx` vẫn xanh.
6. **Không trạng thái nào >30s mà không có nút bấm được** (kiểm được trên Chrome desktop/vitest, không cần iPhone).
7. **Gate bắt buộc trước khi báo xong**: `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs` (headroom CODE chỉ còn ~9 KB).
8. **Nghiệm thu cuối — chỉ Cuong bấm**: up logo mới từ iPhone → bấm nút → `curl -I` URL public 200 đúng `Content-Type` + SQL đọc `purpose, version, public_path`. Nếu vẫn lỗi thì lỗi **tự khai tên** — cũng là kết quả dùng được.

## G. Ràng buộc vận hành

- Làm trong worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-publish-btn`, nhánh `fix/shop-publish-media-button`, base `origin/main` = `8f833e5a`. **Cấm** làm shop ở checkout gốc (nhánh cũ, thiếu 25 migration shop).
- Không commit/push nếu user chưa yêu cầu.
- Edge function: **code ≠ deployed** — nếu pha 2 đụng `shop-media-lifecycle` thì phải deploy tay và xác nhận.
- Dọn sạch dữ liệu test trên prod (user test + `shop_members`) sau khi xong, và trả `public_path` của cover về nguyên trạng nếu bước 6 không tự publish lại được.
- PAT/keys: `~/Downloads/secrets.local.md`; anon key trong `.env`.
