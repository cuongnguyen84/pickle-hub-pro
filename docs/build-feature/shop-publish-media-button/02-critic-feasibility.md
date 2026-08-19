# 02 — Phản biện khả thi kỹ thuật (critic-feasibility)

## 1. H1 chết — xác nhận bằng code, kèm phép thử 30 giây để đóng nắp quan tài

- `index.ts:85` định nghĩa `copyRenditionToPublic`, gọi ở `:163` (product) và `:212` (profile). **Cùng hàm, cùng thứ tự** download → sniff (`:103-111`) → `inspectJpeg`/`inspectWebp` (`:112`) → dimension (`:117`) → upload (`:124`). Không nhánh nào rẽ theo purpose.
- Bytes cùng một lò: `useMediaUpload.ts:182` gọi `processImage` chung; ladder WebP→JPEG ở `imagePipeline.ts:176-180` không biết gì về product/profile. Khác biệt duy nhất là `cap` (logo 512px, `useMediaUpload.ts:130`) — chỉ làm ảnh **nhỏ hơn**, không đổi định dạng.

⇒ Ảnh sản phẩm iPhone publish được ⇒ `inspectJpeg` đã ăn bytes iOS thật và trả `ok`. **H1 loại vĩnh viễn.**

Falsifier cuối (rẻ, chạy 1 lần cho hết cãi): script tay dùng Storage `object/copy` (`publish-shop-profile-media-manually.sh:25-27`) nên object công khai hiện tại **chính là bytes rendition của PO, giữ nguyên content-type**:
```
curl -sI ".../object/public/shop-product-media/<LOGO>/live.webp"
```
`image/webp` ⇒ iPhone PO ra WebP, nhánh JPEG còn không được đụng tới. Không cần key. **Cắt toàn bộ phép thử "tải rendition bằng service key rồi chạy inspectJpeg" (mục 4/H1 + AC#1 bản 01).**

## 2. Cái gì CHỈ có ở nhánh profile — xếp lại hạng

### A. "Anon probe → 403" là bằng chứng RỖNG — lỗ hổng lớn nhất của bản 01
`index.ts:199` trả `json({ error: planError.message }, 403)` cho **mọi** lỗi của `rpc()`, kể cả lỗi PostgREST *trước khi* thân hàm chạy. Ba thứ khác hẳn nhau ra cùng HTTP 403:
- `insufficient_privilege` "not a manager of this shop" (thân hàm chạy, đúng logic)
- `42501 permission denied for function` (thiếu `GRANT ... TO authenticated`)
- `PGRST202 Could not find the function ... in the schema cache` (hàm tạo 17/08, PostgREST chưa reload)

Bản 01 chép "anon probe 403 ⇒ action tồn tại" từ PHASE-PROGRESS rồi dùng nó hạ hạng H3. Sai: 403 chỉ chứng minh code có nhánh `publish_profile`, **không** chứng minh RPC gọi được. Đúng loại lỗi mà chính bản 01 chỉ ra ở probe Management API (superuser-blind) — ở đây là *status-blind*.

H2 của bản 01 cũng vá sai chỗ: `has_function_privilege(...)` trả lời câu hỏi GRANT nhưng **mù với schema cache**.

*Phép thử đúng, 10 giây, chỉ cần anon key:*
```
curl -s -X POST "$BASE/rest/v1/rpc/shop_profile_media_publish_prepare" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
  -H "Content-Type: application/json" -d '{"_shop_id":"<uuid>"}' -i
```
Đọc **body**: `PGRST202` = schema cache (fix = reload/`NOTIFY pgrst`, nhớ luật cấm giờ livestream) · `42501` = thiếu GRANT · `insufficient_privilege` tiếng Anh = hàm khoẻ, chuyển hạng sang B/C. Chạy kèm `select proname, pronargs, proacl from pg_proc where proname like 'shop_profile_media_publish%'` để bắt migration `20260817090000` chưa áp đủ (drift mãn tính: áp qua Management API không ghi `schema_migrations`).

Đây là RPC **duy nhất** trong đường publish sinh ngày 17/08; `product_publish_prepare` có từ `20260811140000:498` và đã chạy hàng chục lần. Prior nghiêng hẳn về đây.

### B. Kế hoạch publish của profile gộp CẢ HAI ảnh, còn UI có HAI nút
`20260817090000:70-71` lọc **chỉ** `verified_at IS NOT NULL`, không loại row đã có `public_path`. `index.ts:211-237` lặp cả plan và trả **502 nếu `failed.length > 0`**. `MediaEditor.tsx:410-515` render **hai `ProfileSlot` độc lập**, mỗi cái một `usePublishProfileMedia` (`:422`) nhưng cùng gọi một action shop-wide.

⇒ logo commit thành công, cover lỗi ⇒ 502 ⇒ `useProductMedia.ts:115` ném ⇒ **nút của LOGO báo lỗi dù logo đã lên**. Với PO đó đúng là "nút không hoạt động". Nhánh product không có hình dạng này (`:165` trả thẳng status của item lỗi). **Defect thật, chỉ có ở profile**, bản 01 không liệt kê.

### C. Authz KHÔNG khác — loại được một nửa H4 bằng code, không cần hỏi PO
`is_shop_manager` (`20260811120000:60-73`) chỉ đọc `shop_members`, không đụng `is_admin()`/aal2. `shop_profile_media_finalize` (`20260816120000:152`) đòi đúng `is_shop_manager(_media.shop_id)` và **đã chạy được** (row có `verified_at`, nút mới hiện ở `MediaEditor.tsx:487`). ⇒ Phiên iPhone của PO chắc chắn là manager hợp lệ lúc upload. H4 chỉ sống nếu token hết hạn giữa upload và lúc bấm.

Đính chính bảng mục 3 bản 01: "thiếu `Authorization` → 401" (`index.ts:189`) là **nhánh chết** — supabase-js luôn gửi `Authorization` (anon key nếu mất session) ⇒ mất session ra **403**. Đừng dùng 401/403 để phân biệt.

### D. `asCaller` dùng `ANON_KEY` (`index.ts:137-140`, `:46`)
Nếu secret `SUPABASE_ANON_KEY` rỗng trong bản deploy → PostgREST "No API key found" → lại 403. Prior thấp (chung cả hai nhánh) nhưng phép thử ở A đọc body lộ ngay, chi phí 0.

### E. Auto-publish chạy TRƯỚC khi PO kịp bấm (`MediaEditor.tsx:427-432`)
Mỗi lần upload xong đã có một lần `publish.mutate()` thất bại ⇒ lỗi xảy ra ít nhất hai lần. Vá H0 rồi mở lại trang là ra lỗi, **không cần PO bấm gì** ⇒ câu hỏi "màn hình hiện gì" bớt quan trọng.

**Xếp hạng đề nghị: A > B > D > (H4 hẹp: token hết hạn) > H6 > H5/H7.** H3 giữ hạng nhưng phép thử phải là `supabase functions download` + diff, không suy từ 403.

## 3. Phép thử nào agent chạy được thật

Chạy được ngay: curl PostgREST ở mục A (anon key trong `.env`) · SQL qua Management API (PAT ở `~/Downloads/secrets.local.md`) · `curl -I` bucket công khai · `supabase functions download` (cần `SUPABASE_ACCESS_TOKEN=$PAT`).

**Không chạy được như bản 01 giả định:** bất cứ thứ gì cần *phiên đăng nhập của PO*. Nhưng PO vừa cho phép tạo user/shop test trên prod ⇒ đường thay thế rẻ hơn local stack rất nhiều, **không cần trình duyệt**:

1. `POST /auth/v1/admin/users` bằng service key → user test (`email_confirm: true`, có password).
2. Management API: `INSERT INTO shop_members (shop_id, user_id, role) VALUES ('<shop PO>', <uid>, 'manager')` — **vào thẳng shop PO**, không dựng shop mới, không upload ảnh mới.
3. Management API: `UPDATE shop_profile_media SET public_path = NULL WHERE purpose='cover'` — "lên đạn" đúng trạng thái lỗi, **không bump version, không enqueue cleanup, không mất ảnh live**. `shop_media_referenced_objects` (`20260817090000:216-220`) vẫn giữ key vì row còn `verified_at`.
4. `POST /auth/v1/token?grant_type=password` → access_token user test.
5. `curl -i` thẳng `POST /functions/v1/shop-media-lifecycle` với `Authorization: Bearer <token>`, body `{"action":"publish_profile","shop_id":"..."}`.

Bước 5 là **đúng cái `supabase.functions.invoke` gửi** (`FunctionsClient.js:251-262`) — khác biệt duy nhất: ta đọc được status + body. Blast radius = 0 (upsert đè đúng key đang giữ đúng bytes, commit recompute ra đúng path cũ). Xong thì `DELETE` row `shop_members` + xoá user test.

~20-30 phút, kết luận **toàn bộ** A/B/C/D/H3/H6 trong một phát, trên đúng bản deploy prod / schema cache prod / GRANT prod. Nếu bước 3-5 **thành công** thì root cause nằm hẳn phía trình duyệt/phiên (H4/H5/H7) và lúc đó mới cần iPhone.

## 4. Acceptance #3 (`supabase db reset` + stack local): **cắt bỏ**

Chi phí thật: `supabase stop` ở checkout gốc → `supabase start` **từ worktree** (edge runtime mount theo thư mục lúc start; `docker restart` không đổi mount) → `db reset` áp ~200 migration → seed shop + member + storage object + JWT giả. 1-2 giờ nếu thuận, nửa ngày nếu vấp; và làm hỏng stack local của checkout gốc.

Đổi lại **không được gì mà bước 5 ở trên không cho**. Tệ hơn: local **không thể** tái hiện A (schema cache/GRANT prod), không thể tái hiện H3 (bản deploy prod). Nó chỉ chứng minh logic trong repo đúng — mà logic đó đã có pgTAP + `scripts/shop-p2b-media-lifecycle.test.mjs` từ P2b.

Thay AC#3 bằng: *"gọi thật `publish_profile` trên prod bằng JWT manager của user test, dán nguyên status + body"*.

## 5. Đường quan sát lỗi: rủi ro thấp hơn bản 01 nghĩ, diff nhỏ hơn bản 01 nghĩ

**Bundle: không phải vấn đề.** `MediaEditor` là chunk lazy (`SellerShopSettings.tsx:49-51`) ⇒ không đụng INITIAL (280 KB). CODE budget 1800 KB, headroom ~9 KB — vài trăm byte là an toàn; `reportCaughtError` **đã nằm trong bundle** (`main.tsx:19,25`; `App.tsx:302`) nên thêm call site ≈ 0 byte. Điều kiện: fixture bytes (nếu có) phải nằm trong `__tests__/`.

**Rò rỉ: thấp, hàng rào có sẵn.** `index.ts:64-66` `safeError` cắt query string; body 502 chỉ chứa `media_id` + `error` enum-like (`:234-237`); `_shared/client-errors.ts:54-74` `sanitizeClientErrorUrl` xoá `search`/`hash`/user:pass, cắt message 1000 ký tự. Lưu ý: `errorReporter.ts:31-41` **dedupe 5 phút** theo fingerprint ⇒ bấm lại lần 2 trong 5 phút không sinh dòng thứ hai — AC#4 phải nêu lý do này.

**Diff cho H0 nhỏ hơn bản 01 mô tả.** SDK `^2.89.0` đã trả về **field thứ ba**:
```js
// FunctionsClient.js:289,295-297
return { data, error: null, response };
return { data: null, error, response: error instanceof FunctionsHttpError ? error.context : undefined };
```
⇒ ở `useProductMedia.ts:112` chỉ cần thêm `response` vào destructure và `await response?.text()`. Không import `FunctionsHttpError`, không đụng type. Cùng SDK đã có option `timeout` (`FunctionsClient.js:184,238-240`) — H6 chỉ tốn một key trong object, không cần wrapper.

## 6. Ponytail: cắt gì, diff nhỏ nhất trông thế nào

**Cắt khỏi scope:** toàn bộ nhánh điều tra H1 (mục 4/H1, AC#1 phần inspectJpeg, câu hỏi PO #2 và #6, rủi ro "hàng rào riêng tư APP1/GPS") · AC#3 local stack · fixture "bytes thật từ iPhone" · kịch bản tái hiện "up ảnh mới" (thay bằng `public_path = NULL`).

**Diff nhỏ nhất thật sự, nếu root cause là A:** **không có diff code nào cả** — một lệnh `NOTIFY pgrst, 'reload schema'` hoặc một `GRANT`. Đó là lý do phải chạy phép thử 2A **trước khi viết bất kỳ dòng nào**. Bản 01 đang sắp xếp để agent bổ vào code trước.

**Diff bắt buộc bất kể root cause (H0), ~8 dòng, 3 file có sẵn, 0 file mới:**
1. `src/lib/shop/errors.ts` — thêm `edgeErrorMessage(error, response)`: có `response` thì `await response.text()`, rút `error`/`failed[0].error` + status; ngược lại trả `shopErrorMessage(error)`.
2. `useProductMedia.ts:112-115` và `useProductModeration.ts:158-161` — thêm `response` vào destructure, `throw new Error(await edgeErrorMessage(error, response))`.
3. `MediaEditor.tsx:498-502` — in `publish.error.message` sau câu cố định; một dòng `reportCaughtError(e, "shop:publish_profile")` trong `onError` (≈0 byte).

Red-proof: một test vitest cho `edgeErrorMessage` với `new Response(JSON.stringify({failed:[{error:"rendition_metadata_present"}]}), {status:502})` — 3 giây, không fixture ảnh, không docker. Đó là AC#2 và nó thay luôn AC#3.

**Defect B** — không phải blocker, **đừng gộp vào PR fix**. Nếu vòng điều tra buộc phải sửa `..._publish_prepare` anyway thì thêm một `AND` vào `WHERE` (`20260817090000:71`) loại row đã ở đúng target; và cân nhắc `index.ts:236` trả 200 kèm `ok:false` cho partial success thay vì 502 (khi đó `useProductMedia.ts:121` — code viết sẵn đang chết — mới sống lại). Backlog, nhãn "chặn Wave 1 khi có seller thứ hai".

## Chốt

- **SỬA:** bỏ hạng H1 và mọi phép thử phụ thuộc nó; hạng 1 mới = **"RPC `shop_profile_media_publish_prepare` không gọi được qua PostgREST vai `authenticated` (PGRST202 schema cache / thiếu GRANT / migration chưa áp đủ)"**; ghi rõ bằng chứng "anon probe → 403" là **rỗng** vì `index.ts:199` gộp mọi lỗi RPC vào 403.
- **SỬA:** phép thử H2 phải là **gọi PostgREST thật rồi đọc body**, không phải `has_function_privilege`.
- **SỬA:** bỏ dòng "thiếu Authorization → 401"; mất phiên ra **403**.
- **THÊM:** defect chỉ có ở profile (plan shop-wide + 502 partial + hai nút độc lập) ⇒ một ảnh hỏng làm nút ảnh kia báo lỗi. Backlog, không gộp PR.
- **THÊM:** loại H4-rộng bằng code (`finalize` đã chứng minh `is_shop_manager` đúng; không dính aal2).
- **CẮT:** AC#3 local stack → thay bằng end-to-end prod với JWT manager của user test.
- **CẮT:** kịch bản "up ảnh mới trên shop PO" + rủi ro mất logo kèm theo → thay bằng `UPDATE ... SET public_path = NULL`.
- **CẮT:** AC#4 phần fixture "bytes thật từ iPhone".
- **GIỮ:** H0 là điều kiện cần chứ không phải bản sửa — nhưng diff nhỏ hơn (SDK 2.89 trả `response` cùng `error`). Bundle/rò rỉ không phải rủi ro; ghi chú dedupe 5 phút của `errorReporter.ts:31-41`.
- **GIỮ:** "cấm suy từ absence of logs", ranh giới ngoài phạm vi, AC#5 (không hồi quy publish sản phẩm).
