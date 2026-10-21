# Round 1 — Technical prompt cho `coder`

**Việc**: gỡ blocker Wave 1 — nút "Đưa lên trang shop" (publish logo + ảnh bìa của shop) không hoạt động. Seller (PO) bấm trên iPhone/iOS Safari, ảnh không lên trang shop. Hiện phải chạy tay bằng `scripts/publish-shop-profile-media-manually.sh`.

**Phạm vi quan trọng**: publish **ảnh sản phẩm** CHẠY TỐT (admin bấm sau khi duyệt). Chỉ nhánh **profile media (logo/bìa)** hỏng. Đây là publish duy nhất mà **seller tự bấm**, dưới JWT seller thường, đi qua RPC **MỚI** `shop_profile_media_publish_prepare` (migration `20260817090000_shop_profile_media_publish.sql`, sinh 17/08, **chưa từng thành công lần nào từ trình duyệt**). RPC anh em `product_publish_prepare` có từ `20260811140000` và đã chạy hàng chục lần. Đây là khác biệt lớn nhất giữa hai nhánh — bắt đầu từ đó.

Làm theo **4 pha đúng thứ tự**. Không đoán root cause trước khi có bằng chứng D1-D7.

---

## Môi trường bắt buộc

- Worktree duy nhất được phép: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-publish-btn`
- Nhánh: `fix/shop-publish-media-button`, base `origin/main` = `8f833e5a`. `npm ci` đã chạy.
- **CẤM chạm** checkout gốc `/Users/cm10/pickle-hub-pro` — đang ở nhánh cũ, thiếu 25 migration shop.
- Supabase project ref: `ajvlcamxemgbxduhiqrl`.
- PAT Management API + service key: `~/Downloads/secrets.local.md`. Anon key: `.env` → `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Được phép áp SQL lên production qua Management API query endpoint — PO đã cấp quyền từ trước, **không hỏi lại**.
- **Không commit, không push, không mở PR.**
- Không để PAT / service key / anon key / access token / password xuất hiện trong report, diff hay output cuối.

## Nguyên tắc triển khai — Ponytail

Dừng ở nấc đơn giản đầu tiên đủ dùng: (1) việc này có cần tồn tại không → (2) repo đã có helper/pattern chưa → (3) stdlib → (4) tính năng native của nền tảng → (5) dependency đã cài → (6) một dòng → (7) tối thiểu code chạy được.

- Không abstraction mới. Không file source mới nếu file cũ dùng được — `src/lib/shop/errors.ts` đã có `shopErrorMessage` + `isConflict`, thêm helper vào đó.
- Không thêm dependency, không Sentry, không hàng đợi/retry tự động, không lớp "publish service".
- Trước khi sửa bất kỳ hàm nào, `rg` tìm **toàn bộ caller** và ghi vào report. Sửa tận gốc, không vá triệu chứng.
- Diff ngắn nhất **SAU KHI** đã hiểu trọn vấn đề. Diff nhỏ nhưng đặt sai chỗ không phải là lười, đó là bug thứ hai.
- Mọi đơn giản hoá có chủ đích: comment `// ponytail:` nêu rõ trần của nó.

---

## Kiến trúc phải đọc trước khi làm

Luồng đang hỏng:

`/seller/settings` → `src/pages/shop/SellerShopSettings.tsx` → `<details>` "Logo & ảnh bìa" → `ShopProfileMediaSection` (`src/components/shop/MediaEditor.tsx:583-604`) → hai `ProfileSlot` (`MediaEditor.tsx:410-515`).

1. Seller chọn ảnh → nén ở client (`imagePipeline.ts`) → upload vào draft bucket.
2. RPC `shop_profile_media_finalize` đặt `verified_at`.
3. Callback của `useMediaUpload` (`MediaEditor.tsx:427-432`) **tự gọi** `publish.mutate()` — publish là auto, không phải thao tác seller khởi xướng.
4. `usePublishProfileMedia` (`src/hooks/shop/useProductMedia.ts:104-128`) gọi
   `supabase.functions.invoke("shop-media-lifecycle", { body: { action: "publish_profile", shop_id } })`.

Edge function `supabase/functions/shop-media-lifecycle/index.ts`:

- `publishProfile()` (~`:186-238`): gọi `shop_profile_media_publish_prepare` **dưới JWT caller** qua `asCaller(authorization).rpc(...)`.
- `:199` — `planError` bị gom hết thành `json({ error: planError.message }, 403)`.
- `copyRenditionToPublic()` (`:85-134`) **dùng chung** với publish sản phẩm (`:163`).
- Commit qua `shop_profile_media_publish_commit` dưới service role.
- Kết: `json({ ok: failed.length===0, published, failed }, failed.length===0 ? 200 : 502)` — partial thì **502**.
- `verify_jwt = false` (workaround ES256/HS256 của project) — **CẤM đổi**.
- `publish()` sản phẩm (`:144-182`) lặp qua **toàn bộ** rendition của sản phẩm (nhiều ảnh) — ghi nhớ khi cân nhắc timeout ở pha 3.

RPC `shop_profile_media_publish_prepare` (migration `20260817090000`):

- `SECURITY DEFINER`. Raise `insufficient_privilege` nếu không phải manager/admin.
- Raise `invalid_parameter_value` với câu tiếng Việt `'shop đang ở trạng thái % nên chưa đưa ảnh lên trang công khai được'` nếu `shop.state <> 'active'`.
- Raise `'chưa có ảnh nào được xác minh'` nếu plan rỗng.
- Dòng `86`: `GRANT EXECUTE ... TO authenticated, service_role`.
- Dòng `71`: `WHERE p.shop_id = _shop_id AND p.verified_at IS NOT NULL` — plan là **shop-wide**, không lọc theo slot đang bấm.
- Migration này áp lên prod qua Management API nên **có thể không ghi `schema_migrations`** (drift mãn tính của repo). **Cấm suy luận "file có trong repo = đã áp trên prod".**

Client hiện đang vứt sạch thông tin lỗi:

- `useProductMedia.ts:104-128` chỉ destructure `{ data, error }`, `if (error) throw error`, rồi `if (!result?.ok) throw new Error("publish_profile_failed")`.
- `useProductModeration.ts:150-166` (`usePublishProduct`) cùng pattern.
- `MediaEditor.tsx:487-515` là nhánh loại trừ `publish.isPending ? <p> : <>hint + lỗi + nút</>`: pending thì **không nút, không huỷ, không giới hạn thời gian**; lỗi thì **một chuỗi cứng cho mọi nguyên nhân**.

---

## Giả thuyết ĐÃ BỊ GIẾT — cấm điều tra lại

1. **H1 — JPEG do iOS encode mang APP1/EXIF bị `inspectJpeg` chặn.** `copyRenditionToPublic` dùng chung cho product và profile; bytes qua cùng một pipeline nén. PO xác nhận ảnh sản phẩm up từ iPhone publish được bằng nút ⇒ nhánh JPEG iOS đã chạy thật. **CHẾT.**
2. **H4 bản rộng — phiên không phải manager.** `shop_profile_media_finalize` cũng đòi `is_shop_manager` và ĐÃ chạy được (row có `verified_at` nên nút mới hiện). `is_shop_manager` không dính aal2. **CHẾT**, chỉ còn bản hẹp "token hết hạn giữa upload và lúc bấm".
3. **Suy luận "401 = thiếu Authorization".** supabase-js LUÔN gửi `Authorization` (anon key nếu mất session) ⇒ mất session ra **403** chứ không phải 401. Nhánh 401 ở `index.ts:189` là code chết. **Cấm dùng 401/403 để phân biệt nguyên nhân.**

## Bằng chứng RỖNG — loại khỏi hồ sơ

- **"Anon probe → 403 ⇒ action tồn tại và server khỏe"** (chép từ PHASE-PROGRESS cũ) **không chứng minh gì về RPC**: `index.ts:199` gộp mọi lỗi `rpc()` vào một mã 403 — `insufficient_privilege` (thân hàm chạy đúng) / `42501` (thiếu GRANT) / `PGRST202` (schema cache chưa reload). Ba nguyên nhân khác hẳn nhau, cùng một status. **Phải đọc BODY.**
- Probe cũ chạy qua Management API là **superuser** ⇒ mù với GRANT của vai `authenticated`.
- **CẤM suy luận từ absence of logs**: `function_edge_logs` prod ghi thiếu nặng (24h chỉ 1 dòng toàn hệ thống). Không thấy log ≠ request không tới.

## Giả thuyết còn sống, đã xếp hạng

| Hạng | Giả thuyết | Phép thử quyết định |
|---|---|---|
| **1** | `shop_profile_media_publish_prepare` **không gọi được qua PostgREST dưới vai `authenticated`** — PGRST202 (schema cache) / 42501 (thiếu GRANT) / migration chưa áp đủ trên prod | D2 + D3 |
| 2 | **Lỗi chéo slot**: prepare trả plan shop-wide, edge trả 502 khi partial, UI có hai nút độc lập ⇒ bìa hỏng làm nút logo báo lỗi dù logo đã lên | Lộ ra ở D6 — đọc `failed[]` |
| 3 | `SUPABASE_ANON_KEY` rỗng trong bản deploy (`index.ts:46,137-140`) → PostgREST "No API key found" → lại ra 403 | D2/D6, đọc body |
| 4 | Bản deploy edge ≠ code trong repo | `supabase functions download` + diff. **Không** suy từ 403 |
| 5 | Token hết hạn giữa upload và lúc bấm | Chỉ có nghĩa **nếu D6 trả 200** |
| 6 | Mutation không settle (kẹt spinner vĩnh viễn) | Đúng bất kể root cause ⇒ đã nâng thành yêu cầu UX pha 4, không cần chứng minh |
| 7 | Request không rời máy / bundle cũ do Service Worker | Chỉ điều tra **nếu D6 trả 200** |

---

# PHA 1 — Chẩn đoán trên production. TUYỆT ĐỐI KHÔNG SỬA CODE

Chạy đủ D1-D7 **trước** khi đụng bất kỳ dòng source hay SQL nào. Ghi nguyên văn (đã che secret) command + HTTP status + headers/body liên quan + kết luận vào `docs/build-feature/shop-publish-media-button/rounds/round1-report.md`.

### D1 — Object công khai hiện tại

`curl -sI` lên URL object logo công khai hiện tại của shop PO. Lưu nguyên response headers, đặc biệt status + `Content-Type`. (Đóng nắp quan tài H1 bằng dữ liệu prod, 5 giây.)

### D2 — Gọi RPC bằng anon qua PostgREST

```
POST <SUPABASE_URL>/rest/v1/rpc/shop_profile_media_publish_prepare
apikey: <anon>
Authorization: Bearer <anon>
Content-Type: application/json
{"_shop_id":"<UUID shop PO>"}
```

Lưu **nguyên status + body**. Phân biệt bằng body:
- `PGRST202` → schema cache không thấy function.
- `42501` → thiếu quyền/GRANT.
- `insufficient_privilege` → function tồn tại, chạy được, từ chối đúng vì caller là anon.

**Không được chỉ ghi "403".** Không dùng `has_function_privilege` thay cho D2 — catalog mù với schema cache của PostgREST.

### D3 — Catalog + ACL qua Management API

```sql
select proname, pronargs, proacl from pg_proc where proname like 'shop_profile_media_publish%';
```

Dùng kết quả để bắt migration chưa áp đủ / GRANT thiếu trên prod thật.

### D4 — User test làm manager của shop PO

- `POST /auth/v1/admin/users` với `email_confirm: true`, mật khẩu tạm.
- `INSERT INTO shop_members(shop_id, user_id, role) VALUES ('<shop PO>', '<user test>', 'manager')`.
- Ghi lại id user + id row để dọn đúng target. **Không ghi token/password vào report.**

### D5 — "Lên đạn" đúng trạng thái lỗi

Báo rõ trong tiến trình: cover của shop PO có thể tạm thời không hiển thị.

Trước khi update, **đọc và lưu lại giá trị `public_path` cũ** để phục hồi nếu D6 không tự publish lại được. Rồi:

```sql
UPDATE shop_profile_media SET public_path = NULL WHERE shop_id = '<shop PO>' AND purpose = 'cover';
```

**Không** bump `version`, **không** enqueue cleanup, **không** xoá `verified_at`, **không** đụng object/key. Row còn `verified_at` nên `shop_media_referenced_objects` (`20260817090000:216-220`) vẫn giữ key khỏi bị dọn ⇒ ảnh live không mất.

### D6 — Gọi đúng cái mà trình duyệt gọi

- Lấy access token user test: `POST /auth/v1/token?grant_type=password`.
- `POST <SUPABASE_URL>/functions/v1/shop-media-lifecycle` với JWT manager đó, body `{"action":"publish_profile","shop_id":"<UUID shop PO>"}`.

**Đây đúng là request mà `supabase.functions.invoke` gửi** — khác biệt duy nhất là ta đọc được status + body. Lưu nguyên status + body, **đặc biệt `failed[]`**.

Sau D6, query SQL đọc ít nhất `purpose, version, verified_at, public_path`.

**Nếu D6 trả 200** ⇒ root cause nằm phía trình duyệt/phiên/bundle (hạng 5-7), và **chỉ khi đó** mới chuyển hướng điều tra sang đó.

### D7 — Dọn dữ liệu test

Dù D6 thành công hay thất bại: `DELETE` row `shop_members` của user test → xoá user test qua Admin API → nếu D6 không publish lại cover thì **phục hồi `public_path`** về giá trị đã lưu ở D5 → query xác nhận đã sạch.

### Không làm gì ở pha 1

- Không sửa source / migration / SQL function trước khi xong D1-D7.
- **Không** `supabase db reset`, **không** dựng local Supabase stack. Lý do dứt khoát: mất 1-2 giờ (nửa ngày nếu vấp mount edge runtime theo worktree), làm hỏng stack local của checkout gốc, và **không tái hiện được** thứ đang nghi (schema cache prod, GRANT prod, bản deploy prod). Chỉ dùng làm dự phòng nếu D6 thực sự không phân biệt được nguyên nhân.
- Không điều tra lại giả thuyết đã chết. Không suy luận từ absence of logs.
- Không để dữ liệu test tồn tại sau pha này.

### Bằng chứng phải nộp (pha 1)

D1 nguyên response · D2 nguyên status + body · D3 `proname/pronargs/proacl` · D4 xác nhận đã tạo (không lộ secret) · D5 trạng thái row trước/sau · D6 nguyên status + body + SQL 4 cột · D7 bằng chứng đã dọn · kết luận hạng 1-4 cái nào xác nhận / cái nào loại.

---

# PHA 2 — Sửa đúng root cause

Chọn biện pháp **chỉ** theo bằng chứng pha 1. **Một kết quả hợp lệ của pha này là KHÔNG có diff code nào** — nếu vậy phải ghi rõ vì sao đó là kết quả đúng.

- **Schema cache stale / PGRST202** → `NOTIFY pgrst, 'reload schema'`. Tránh giờ livestream tối VN (đã có tiền lệ outage PGRST002). Nếu đang trong khung giờ rủi ro: dừng lại, báo tình trạng cụ thể.
- **Thiếu GRANT / 42501** → **đúng một câu** `GRANT EXECUTE ON FUNCTION ... TO authenticated` cho đúng signature.
- **Migration chưa áp đủ** → chỉ áp phần còn thiếu, ghi ledger `schema_migrations` đúng convention đang có trong repo (tìm migration shop gần nhất để copy nếp).
- **Buộc phải sửa `supabase/functions/shop-media-lifecycle/index.ts`** → **code ≠ deployed**: `supabase functions download` diff với worktree TRƯỚC; sửa xong phải deploy tay và xác nhận bằng HTTP hoặc `supabase functions list --project-ref ajvlcamxemgbxduhiqrl`.
- **D6 trả 200** → không sửa SQL/RPC theo phỏng đoán; điều tra theo thứ tự hạng 5 → 6 → 7.

Sau fix: chạy lại D6 (user test mới, dọn sạch sau) xác nhận **HTTP 200** và `public_path` khớp `version` hiện tại.

**Không làm**: sửa nhiều giả thuyết cùng lúc "cho chắc" · đổi `verify_jwt` · đổi preset CORS · thêm retry/queue/dependency/monitoring/abstraction · sửa nhánh publish sản phẩm nếu bằng chứng không chỉ vào đó · gộp defect shop-wide/partial (xem "Ngoài phạm vi") · tin code repo là bản đang deploy.

**Bằng chứng phải nộp**: root cause cuối cùng nối trực tiếp với status/body/query của pha 1 · chính xác SQL nào đã áp hoặc edge nào đã deploy, lúc nào, bằng cách nào · D6 sau fix = 200 · query xác nhận `public_path` khớp version · bằng chứng bản edge deployed nếu có chạm · bằng chứng dữ liệu test đã dọn.

---

# PHA 3 — Đường quan sát lỗi. BẮT BUỘC, bất kể root cause là gì

Mục tiêu ~8 dòng logic, **3 file source có sẵn, 0 file source mới**.

### 3.1 `src/lib/shop/errors.ts` — thêm `edgeErrorMessage(error, response)`

- Có `response` → `await response.text()`, parse nếu được, rút theo thứ tự ưu tiên: `error` → `failed[0].error` → fallback từ lỗi hiện có.
- Không có `response` → dựa trên `shopErrorMessage(error)`.
- **Phải giữ nguyên câu tiếng Việt của RPC** — `shopErrorMessage` vốn đã ưu tiên chuỗi tiếng Việt qua regex `VIETNAMESE` ở đầu file. Đừng viết lại logic đó, gọi lại nó.
- Trả `{ message, code }`. `code` format `"<status> · <mã>"`, **≤ 80 ký tự**, dài hơn thì cắt + `…`.
- Helper phải đủ dữ liệu để UI phân loại đúng 5 nhóm copy ở 3.3.

### 3.2 Không vứt `Response` của Edge Function

Sửa **cả hai** call site (root cause chung, một helper, hai caller):

- `src/hooks/shop/useProductMedia.ts:104-128` — `usePublishProfileMedia`
- `src/hooks/shop/useProductModeration.ts:150-166` — `usePublishProduct`

Ở cả hai: thêm `response` vào destructure của `invoke`; khi lỗi thì `throw new Error(await edgeErrorMessage(error, response))` (hoặc dạng giữ được cả `message` lẫn `code` cho UI). **Không** import `FunctionsHttpError`, **không** đọc `error.context` trực tiếp.

Đã kiểm chứng trong `node_modules`, `@supabase/supabase-js` **2.110.7**:
- `FunctionsClient.js:289` trả `{ data, error: null, response }` ở nhánh thành công;
- `:295-297` trả `response: error.context` (một `Response` **chưa bị đọc body**) khi `FunctionsHttpError`/`FunctionsRelayError`;
- `:184,238-240` hỗ trợ option `timeout` bằng `AbortController` + `setTimeout`.

⚠️ **`{ timeout: 20000 }` CHỈ áp cho `usePublishProfileMedia`, KHÔNG áp cho `usePublishProduct`.** Lý do: `publishProfile` xử lý tối đa 2 item (logo + bìa), còn `publish()` sản phẩm (`index.ts:166-172`) lặp qua **toàn bộ** rendition của sản phẩm — đặt timeout 20s ở đó là tự tạo regression trên một luồng đang chạy tốt. `usePublishProduct` chỉ nhận phần quan sát lỗi (`response` + `edgeErrorMessage`).

Trước khi sửa, `rg` xác nhận toàn bộ caller của hai hook và ghi vào report.

### 3.3 `src/components/shop/MediaEditor.tsx:487-515` — hiển thị 2 tầng

- Dòng 1 (to): `.tl-shop-error`, `role="alert"`, **có `id`** để nút trỏ `aria-describedby`.
- Dòng 2 (mờ): `.tl-shop-hint` chứa `Mã lỗi: <code>{code}</code>` + `Chụp màn hình dòng này gửi cho ThePickleHub nếu bấm mấy lần vẫn lỗi.`
  **Không bịa** kênh Zalo / số điện thoại / đầu mối hỗ trợ — PO chưa xác nhận.
- Trong `onError` gọi `reportCaughtError(e, "shop:publish_profile")` (`src/lib/errorReporter.ts:105`, đã có sẵn trong bundle nên ≈0 byte).
- **Ghi vào report**: `errorReporter.ts:31-41` **dedupe 5 phút** ⇒ bấm lần 2 trong 5 phút **không** sinh dòng client event thứ hai. Đây là hành vi dự kiến, không phải mất log.

**5 nhóm copy — chép thẳng, không tự chế:**

1. Shop chưa kích hoạt / tạm ngưng (403, server có câu trạng thái):
   `{câu tiếng Việt nguyên văn của server} Ảnh đã lưu rồi, kích hoạt shop xong bấm lại là hiện.`
2. Hết phiên đăng nhập:
   `Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm Thử lại giúp em.`
3. Không gửi được / quá 20s (`FunctionsFetchError`, abort do timeout):
   `Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại.`
4. Ảnh máy chủ không nhận (422 `rendition_*`):
   `Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.`
5. Còn lại (409 / 502 / không rõ):
   `Lỗi từ phía hệ thống, không phải do ảnh của anh/chị. Em đã nhận được báo lỗi rồi, bấm Thử lại sau vài phút.`

### 3.4 Red-proof test

Thêm test Vitest cho `edgeErrorMessage`. `src/lib/shop/__tests__/` đã tồn tại nhưng **chưa có** file test cho `errors.ts` ⇒ tạo `src/lib/shop/__tests__/errors.test.ts` (file test mới là hợp lệ, khác với cấm tạo file **source** mới).

Case bắt buộc: `new Response(JSON.stringify({failed:[{error:"rendition_metadata_present"}]}), {status:502})` → helper phải rút được mã từ `failed[0].error`. **Gỡ bản sửa thì test phải ĐỎ**; ghi bằng chứng đã chạy thử cả hai chiều vào report.

---

# PHA 4 — 3 sửa UX (theo đặc tả UI/UX đã chốt ở `03-ux-spec.md`)

### 4.1 Không auto-publish khi `shop.state ≠ active`

`MediaEditor.tsx:427-432` hiện bắn publish sau **mọi** upload, trong khi RPC prepare từ chối mọi shop khác `active` ⇒ seller `pending_activation` rơi vào **vòng lặp bấm-lỗi** — gần như chắc chắn xảy ra với seller Wave 1 up logo trước khi được duyệt.

- `ProfileSlot` (`MediaEditor.tsx:410-420`) nhận thêm prop `shopState: ShopState`.
- `ShopProfileMediaSection` (`:583-604`) nhận và truyền xuống cả hai slot.
- `src/pages/shop/SellerShopSettings.tsx:335` truyền `shopState={row.state}` — **dữ liệu đã có sẵn, CẤM thêm query mới**.
- Auto-publish chỉ chạy khi `shopState === "active"`.
- Khi `verified_at && !public_path && shopState !== "active"` → **không render nút** (bấm chỉ nhận 403), chỉ một dòng hint:
  - `pending_activation`: `Ảnh đã lưu. Shop được kích hoạt xong là ảnh tự lên trang shop, anh/chị không phải làm gì thêm.`
  - `restricted` / `suspended` / `closed`: `Ảnh đã lưu. Shop đang ở trạng thái "{SHOP_STATE_LABEL[state]}" nên chưa đưa ảnh lên trang shop được.`
  - `SHOP_STATE_LABEL` đã có ở `src/lib/shop/applicationState.ts:158` — import lại, đừng viết map mới.

### 4.2 Đổi nhãn nút + câu trạng thái nói hậu quả

Hiện có **ba tên cho một hành động**: comment `:424-426` "Thử lại", dòng lỗi `:500` "Bấm thử lại", nhãn nút `:509` "Đưa lên trang shop". Publish **đã tự chạy** sau upload nên nút chỉ là retry.

- Nhãn nút → `Thử lại`; `aria-label` = `Thử đưa logo lên trang shop lại` / `Thử đưa ảnh bìa lên trang shop lại`.
- Khi pending: **vẫn là chính nút đó**, `disabled={publish.isPending}`, nhãn `Đang đưa lên trang shop…`. **Không spinner, không phần trăm.**
- Câu trạng thái `:495-497` → nói hậu quả:
  - logo: `Trang shop hiện chưa có logo. Ảnh đã lưu trên hệ thống, lần đưa lên trước chưa xong.`
  - bìa: `Trang shop hiện chưa có ảnh bìa. Ảnh đã lưu trên hệ thống, lần đưa lên trước chưa xong.`
- Từ vựng: thống nhất **"trang shop"**. Bỏ "công khai" (`:491,496`) và "ra ngoài" (`:485`).

### 4.3 Không trạng thái nào treo quá 30s mà không có nút bấm được

- Thay nhánh loại trừ `:487-515` bằng: dòng trạng thái + **MỘT** nút luôn render khi `shopState === "active" && !disabled`, đổi nhãn theo pending. **Cấm** ẩn nút rồi chỉ hiện `<p>` khi pending.
- `{ timeout: 20000 }` cho `invoke` của **profile publish** (xem 3.2). 20s < 30s ⇒ ràng buộc được bảo đảm **bằng code**, không bằng lời hứa.
- Test (fake timers / mock request không resolve): pending → nút vẫn hiện và `disabled`; sau timeout → nút hiện `Thử lại` và bấm được.

### 4.4 CSS — đúng 2 dòng, không hơn

Thêm vào `src/styles/shop.css`:

```css
.tl-shop-btn:active:not(:disabled) { transform: translateY(1px); }
.tl-shop-sr:focus-visible + label { outline: 2px solid var(--tl-green); outline-offset: 2px; }
```

Tái dùng `.tl-shop-btn--sm`, `.tl-shop-hint`, `.tl-shop-error`, `.tl-shop-pill--ok`, `<code>` trần trong `.tl-shop-hint` (pattern đã dùng ở `SellerShopSettings.tsx`). Vùng bấm `.tl-shop-btn--sm` **đã 44px** (`shop.css:1183`) — không override chiều cao. Màu dùng `--shop-danger` và `--tl-fg-3` có sẵn (đã qua retune AA ở commit `aed296ab`) — không đặt màu mới.

**Cấm**: bọc hai dòng lỗi trong `.tl-shop-notice--danger` (trong `ProfileSlot` mọi thông báo đang là dòng chữ trần) · đổi layout card-first của PR #603 · thêm chuỗi tiếng Anh. Shop UI thuần tiếng Việt hardcode là **lệch chuẩn song ngữ CÓ CHỦ ĐÍCH** — ghi nhận trong report, đừng vá EN nửa vời.

---

# Acceptance criteria (8 tiêu chí — bản chốt, vòng review sẽ đối chiếu đúng bản này)

1. **Bằng chứng root cause**: dán nguyên status + body của D2/D6 (và `curl -sI` của D1) vào `rounds/`. Agent tự chạy, không cần iPhone, không cần Chrome.
2. **Red-proof**: test vitest cho `edgeErrorMessage` với `new Response(JSON.stringify({failed:[{error:"rendition_metadata_present"}]}), {status:502})` → gỡ bản sửa thì ĐỎ, áp vào thì XANH. `npm run test`.
3. **Chạy thật trên prod**: `publish_profile` gọi bằng JWT manager của user test trả **HTTP 200**, `public_path` khớp version hiện tại.
4. **Đường quan sát lỗi**: ép một lỗi → UI hiện **câu tiếng Việt hành động được** + dòng mờ "Mã lỗi: …", và có dòng trong client events. Lưu ý `errorReporter.ts:31-41` **dedupe 5 phút** ⇒ bấm lần 2 trong 5 phút không sinh dòng thứ hai (nêu rõ, kẻo lần sau tưởng mất log).
5. **Không hồi quy publish sản phẩm**: `src/pages/admin/shop/__tests__/AdminShopProductReview.publish.test.tsx` vẫn xanh.
6. **Không trạng thái nào >30s mà không có nút bấm được** (kiểm được trên Chrome desktop/vitest, không cần iPhone).
7. **Gate bắt buộc trước khi báo xong**: `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs` (headroom CODE chỉ còn ~9 KB).
8. **Nghiệm thu cuối — chỉ Cuong bấm**: up logo mới từ iPhone → bấm nút → `curl -I` URL public 200 đúng `Content-Type` + SQL đọc `purpose, version, public_path`. Nếu vẫn lỗi thì lỗi **tự khai tên** — cũng là kết quả dùng được.

Không được báo xong nếu một gate đỏ. Nếu gate đỏ do lỗi có sẵn không liên quan: phải đưa bằng chứng baseline rõ ràng, **không tự ý sửa lan sang phần khác**.

---

# Ngoài phạm vi — ghi backlog vào report, TUYỆT ĐỐI KHÔNG code vòng này

- **Defect "một plan shop-wide vs hai nút"** (hạng 2 ở bảng giả thuyết). Sửa đúng là thêm điều kiện vào `WHERE` của prepare (`20260817090000:71`) loại row đã ở đúng target, và/hoặc `index.ts:236` trả 200 kèm `ok:false` cho partial (khi đó code viết sẵn đang chết ở `useProductMedia.ts:121` mới sống lại). Nhãn backlog: **"chặn Wave 1 khi có seller thứ hai"**. Chỉ gộp vào vòng này NẾU pha 2 buộc phải sửa chính function/query đó — và phải giải thích bằng bằng chứng.
- Confirm trước khi thay ảnh (`useConfirm()`) + copy nói rõ "trang shop mất logo ngay" — vì `shop_profile_media_upload_init` set `public_path = NULL` + xếp hàng xoá **ngay khi chọn ảnh mới** (`20260811220000:314-342`).
- Badge thường trực "đang hiển thị / chưa hiển thị" đọc `row.public_path`; link "Xem trang shop của tôi" trong `SellerShopSettings`.
- Pill success "Đã lên trang shop": **chỉ** chấp nhận nếu nó rơi tự nhiên ra từ việc bỏ nhánh loại trừ ở 4.3. Không đầu tư logic/style/test riêng cho nó.
- Mọi thứ thuộc P3a / P3b / P4, mở Wave 1, bật indexing — cổng ký của PO.
- Dependency mới, Sentry/monitoring mới, hàng đợi/retry tự động, lớp trừu tượng "publish service", đổi `verify_jwt`, đổi preset CORS.
- Refactor ngoài 3 file source + CSS + test + report cần thiết, trừ khi bằng chứng pha 2 buộc phải sửa migration/edge function.

---

# Báo cáo phải nộp

Ghi vào `docs/build-feature/shop-publish-media-button/rounds/round1-report.md`:

- Kết luận root cause + nguyên status/body của D1, D2, D6 + kết quả D3-D7.
- SQL / deploy nào đã áp lên production, lúc nào, bằng cách nào. Nếu không có diff code root-cause thì ghi rõ vì sao đó là kết quả đúng.
- Danh sách file thay đổi + danh sách caller đã `rg` trước khi sửa.
- Kết quả red-proof (cả hai chiều đỏ/xanh).
- Kết quả 4 lệnh gate (exit status + tóm tắt) + xác nhận `AdminShopProductReview.publish.test.tsx` vẫn xanh.
- Xác nhận đã dọn user test + `shop_members`, và phục hồi `public_path` nếu cần.
- Ghi chú dedupe client events 5 phút.
- Backlog "ngoài phạm vi" + ghi nhận shop UI VI-only là lệch chuẩn có chủ đích.
- Mục "Còn lại cho Cuong tự kiểm" — chỉ gồm nghiệm thu iPhone ở tiêu chí 8.
- **Không** ghi bất kỳ PAT / service key / anon key / access token / password nào.

Câu trả lời cuối chỉ tóm tắt: root cause đã chứng minh · fix production đã áp · diff source/test · kết quả 4 gate · việc duy nhất còn lại cho Cuong nghiệm thu trên iPhone. Không commit, không push, không mở PR.
