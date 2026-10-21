# Prompt vòng 2 — giao cho `coder`

> Nguồn: bản nháp trong `round1-verdict.md` §3 (Codex soạn, prompt-engineer bổ sung ngữ cảnh repo) + mục "nối dây" do Codex CLI soạn riêng vòng này, prompt-engineer đã **sửa 2 chỗ Codex không thấy được** (nút thử lại phải sống sót sau khi tải lại trang; mock `shopFrom` trong test hiện không await được cho truy vấn danh sách).
> Vòng đã dùng: **1/6**. Đây là vòng **2**.

Bạn thực thi trực tiếp trên worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-publish-btn`, nhánh `fix/shop-publish-media-button`. **Không** làm lại vòng 1, **không** mở rộng phạm vi. Nguyên tắc: diff ngắn nhất chạy được.

`.env` đã có sẵn trong worktree (tester copy vào ở vòng 1, `.gitignore:18` chặn nên không lọt git) — **đừng xoá**, thiếu nó thì app treo ở shell "Loading…" trên mọi route mà không có lỗi nào để lần ra.

---

## 1. Sửa lỗi chặn ship — phân loại sai đúng lỗi production

File `src/lib/shop/errors.ts`, dòng 113. Hiện tại:

```ts
if (status === 422 && detail.startsWith("rendition_")) {
  return { message: "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.", code };
}
```

Sửa **tối thiểu** — bỏ đúng ràng buộc status, giữ nguyên vị trí nhánh và giữ prefix guard:

```ts
if (detail.startsWith("rendition_")) {
  return { message: "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.", code };
}
```

Vì sao (đã xác minh trong `supabase/functions/shop-media-lifecycle/index.ts`, **không** phải suy đoán):

- Nhánh publish **sản phẩm** (`:165`): `json({ error: outcome.error, media_id }, outcome.status)` — **có** trả 422 kèm top-level `error: "rendition_*"`. Nhánh 422 **không** phải code chết, nó đang phục vụ đường sản phẩm ⇒ phải tiếp tục chạy y nguyên.
- Nhánh publish **profile** (`:234-236`): luôn `json({ ok, shop_id, published, failed }, failed.length === 0 ? 200 : 502)`. Mọi lỗi ảnh nằm trong `failed[0].error`, status **luôn 502, không bao giờ 422** ⇒ điều kiện `status === 422` giết trọn nhánh này.

Vì sao nới như vậy là an toàn, không phải nới bừa: toàn bộ mã lỗi worker sinh ra là `rendition_source_missing`, `rendition_too_large`, `rendition_not_image`, `rendition_dimensions`, `rendition_<verdict.reason>` (ví dụ `rendition_metadata_present`), `copy_failed`, `commit_failed`. Hai mã cuối **không** bắt đầu bằng `rendition_` ⇒ vẫn rơi vào câu "lỗi hệ thống, thử lại sau" — đúng, vì đó là lỗi phía server và retry mới là lối thoát.

**Cấm:** hard-code danh sách mã thành mảng/enum/map mới; đổi nội dung câu; đổi thứ tự các nhánh khác; đụng `shopErrorMessage`.

## 2. Sửa 2 test đang khoá cứng hành vi sai + thêm 1 test chống nới quá tay

`src/lib/shop/__tests__/errors.test.ts:23-33` — case 502 + `failed[0].error = "rendition_metadata_present"`:
- đổi `expect(out.message).toContain("Lỗi từ phía hệ thống")` → `toContain("Thử chọn ảnh khác")`;
- **giữ nguyên** `expect(out.code).toBe("502 · rendition_metadata_present")`.

`src/components/shop/__tests__/MediaEditor.test.tsx`, test *"says what the worker actually refused, and shows the code to screenshot"* (~dòng 502-527) — cùng vấn đề:
- `role="alert"` phải chứa `"Thử chọn ảnh khác"`, không còn `"Lỗi từ phía hệ thống"`;
- giữ nguyên assertion `screen.getByText("502 · rendition_metadata_present")` và `reportCaughtError` được gọi.

**Thêm mới** vào `errors.test.ts`: 502 + `failed[0].error = "copy_failed"` → message **vẫn phải** chứa `"Lỗi từ phía hệ thống"`, code chứa `"502 · copy_failed"`. Đây là test bảo vệ chiều ngược lại: chứng minh fix không biến mọi 502 thành "lỗi tại ảnh".

**Không được đụng** case sẵn có *"blames the photo only when the server actually rejected the photo"* (`errors.test.ts:70`, 422 + `rendition_too_large`) — nó là guard cho đường publish sản phẩm, phải xanh nguyên trạng sau khi sửa.

**Red-proof (quy ước của repo, bắt buộc nộp bằng chứng hai chiều):** với cả 2 test đã đổi + 1 test mới, chạy một lượt **trước** khi áp fix ở §1 (phải ĐỎ đúng những case đó) rồi **sau** khi áp (phải XANH). Dán output tóm tắt cả hai chiều vào report. Test không đỏ được trước khi fix là test không bảo vệ gì.

## 3. Nối dây thật: kích hoạt shop xong thì ảnh tự lên trang shop

**Quyết định của PO (PO-1): NỐI DÂY THẬT, không đổi copy.** Câu ở `MediaEditor.tsx:517` — *"Ảnh đã lưu. Shop được kích hoạt xong là ảnh tự lên trang shop, anh/chị không phải làm gì thêm."* — phải trở thành sự thật. **Cấm** đổi/làm nhẹ câu này.

Chỗ nối rẻ nhất, đã khảo sát hộ bạn (vẫn tự kiểm lại trước khi gõ):

- **Tiền lệ y hệt ở nhánh sản phẩm** — bắt chước, đừng phát minh: `src/pages/admin/shop/AdminShopProductReview.tsx:118` `if (decided === "approve") await publishNow(row.id);`, hàm `publishNow` (`:124-134`) nuốt lỗi publish vào **state riêng** `publishError` với câu *"Duyệt đã ghi nhưng chưa đưa lên sàn được: … — bấm “Đưa lên sàn” để thử lại."*, và nút thử lại `:226-238` hiện theo **sự thật từ server** (`row.status === "approved" && !row.moderation_state.publicly_visible`), không theo state lỗi trong RAM.
- **File phải sửa:** `src/pages/admin/shop/AdminShopApplicationReview.tsx`, component nội bộ `ActivationSection({ shopId })` (khai báo ngay trong file đó, ~dòng 49-195). Lưu ý đường dẫn: file nằm ở `src/pages/admin/shop/`, **không** phải `src/components/shop/`.
- **Hook đã có, cấm viết mới:** `usePublishProfileMedia(shopId)` trong `src/hooks/shop/useProductMedia.ts:105` (mutationFn không nhận tham số, đã có `timeout: 20_000`, đã ném `edgeError` có `.message` tiếng Việt + `.code`), và `useShopProfileMedia(shopId)` cùng file (`:22`).
- **Vì sao không làm bằng SQL/trigger:** publish phải **copy bytes** giữa 2 storage bucket qua edge function giữ service-role. Postgres không làm được. **Cấm** viết migration cho việc này.
- **Quyền đã đủ:** `shop_profile_media_publish_prepare` cho phép `is_shop_manager(_shop_id) OR is_admin()` (`supabase/migrations/20260817090000_shop_profile_media_publish.sql:50`) ⇒ admin gọi `publish_profile` được ngay sau khi activate. Đọc `shop_profile_media` cũng được nhờ policy `shop_profile_media_select_member USING (is_shop_member(shop_id) OR is_admin())`.

### Hành vi bắt buộc

1. **Gọi tuần tự, sau khi activate resolve.** `shop_profile_media_publish_prepare` raise nếu `shop.state <> 'active'` ⇒ publish chạy song song hoặc chạy trước là 403 chắc chắn.
2. **Activate không được fail vì publish fail.** Hai state lỗi tách rời: lỗi publish **không** ghi đè `error` của activate, **không** làm nút "Kích hoạt shop" hiện lại, **không** thoát ngược vào `catch` của `onActivate`.
3. **Không gọi publish khi không có gì để publish.** Gate cả auto-publish lẫn nút thử lại bằng dữ liệu server: `useShopProfileMedia(shopId)` có row nào `verified_at != null && public_path == null` hay không. Không có row nào ⇒ **không gọi**, **không hiện lỗi**, không hiện nút.
   Vì sao gate bằng row chứ không bắt chuỗi lỗi (đây là chỗ tôi sửa bản nháp của Codex, làm theo bản này):
   - `prepare` raise `'chưa có ảnh nào được xác minh'` khi shop chưa có ảnh verified (`20260817090000:72-74`) → edge trả **403** → `edgeErrorMessage` gắn thêm đuôi *"Ảnh đã lưu rồi, kích hoạt shop xong bấm lại là hiện."* → vô nghĩa và doạ admin. Đa số shop kích hoạt khi **chưa** có logo ⇒ đây là ca phổ biến nhất, không phải ca hiếm.
   - Bắt theo câu tiếng Việt của server là guard giòn (một lần sửa chính tả trong migration là gãy). Row check dùng đúng hook có sẵn.
   - Repo đã có đúng tiền lệ này ở phía seller: `MediaEditor.test.tsx` có case *"does not fire at a shop the prepare RPC will refuse anyway"*.
   Nếu bạn khảo sát và thấy cách rẻ hơn thật sự, được phép làm khác — nhưng phải giữ đủ 3 tính chất: không gọi vô ích, không doạ admin, và **nút thử lại vẫn hiện sau khi F5**.
4. **Publish lỗi (lỗi thật, khác ca 3):** shop vẫn active, vẫn hiện thông báo "Đã kích hoạt…" hiện có; **thêm** một dòng lỗi riêng `<p className="tl-shop-error" role="alert">` theo mẫu sản phẩm, gợi ý: `Shop đã kích hoạt nhưng chưa đưa ảnh lên trang shop được: ${message} — bấm “Đưa ảnh lên trang shop” để thử lại.` Dùng `.message` của Error do hook ném (đã là tiếng Việt), đừng viết mapper mới.
5. **Nút thử lại "Đưa ảnh lên trang shop"** hiện khi `state === "active"` **và** còn row verified-chưa-publish — tức **theo server, không theo state lỗi trong RAM**. Đây là điểm tôi bác bản nháp của Codex ("hiện nút khi lần publish gần nhất thất bại"): admin F5 hoặc quay lại trang thì state lỗi mất sạch, và ta lại rơi đúng vào lỗi Wave 0 — "trạng thái hoàn chỉnh, kệ hàng trống, không ai bấm được gì".
6. **Đang chạy:** nút thử lại `disabled` khi publish đang chạy, có nhãn đang chạy (mẫu: `publish.isPending ? "Đang đưa lên sàn…" : "Đưa lên sàn"`). Bấm liên tiếp không được tạo request trùng.

### Test bắt buộc (mở rộng file đã có, **không** tạo file test mới)

`src/pages/admin/shop/__tests__/AdminShopApplicationReview.activate.test.tsx` (217 dòng, đã render page thật + hook thật qua shop-client giả).

Hai bẫy hạ tầng trong file này, đọc trước khi viết test:

- File **chưa** mock `@/integrations/supabase/client`. `usePublishProfileMedia` import động module đó, và `client.ts` **throw khi thiếu env lúc load** ⇒ thêm publish vào luồng activate sẽ làm vỡ cả file test trên CI. Thêm `vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }))` theo đúng kiểu `MediaEditor.test.tsx` đang làm.
- Mock `shopFrom` hiện tại (`:17-26`) chỉ chạy được truy vấn `select().eq().maybeSingle()`; builder **không thenable** nên `useShopProfileMedia` (await thẳng builder) sẽ nhận về chính object builder và im lặng trả `[]`. Phải mở rộng mock cho truy vấn danh sách (thêm `then`, hoặc cho `tableFetch[table]` phục vụ cả 2 kiểu) — nếu không, test "có ảnh chờ publish" sẽ **xanh giả**.

Các case:

1. Confirm kích hoạt → `shopRpc("shop_activate", …)` xong **rồi mới** `functions.invoke("shop-media-lifecycle", { body: { action: "publish_profile", shop_id: SHOP_ID }, timeout: 20_000 })`. Khẳng định cả thứ tự lẫn payload.
2. `shop_activate` lỗi → **không** gọi `functions.invoke` lần nào, vẫn hiện lỗi activate như test cũ.
3. Shop **không có** row verified-chưa-publish → activate thành công, `functions.invoke` **không** được gọi, **không** có `role="alert"`, **không** có nút "Đưa ảnh lên trang shop".
4. Có row verified-chưa-publish, publish trả lỗi → shop vẫn hiện "Đã kích hoạt"; có `role="alert"` chứa câu ở mục 4; có nút "Đưa ảnh lên trang shop" bấm được (`disabled === false`).
5. Bấm nút thử lại → gọi `functions.invoke` lần nữa; thành công thì dòng lỗi biến mất.
6. **Mount lại trang** (không bấm activate) với `state === "active"` + row verified-chưa-publish → nút thử lại **vẫn hiện**. Đây là case chứng minh nút không phụ thuộc state lỗi trong RAM.
7. Các test cũ trong file (`shop_activate` với đúng tên tham số, `_verified_method: null`, lỗi RPC, `active`/`suspended`) phải **xanh nguyên trạng**.

**Red-proof:** ít nhất case 1 và case 6 phải ĐỎ trước khi bạn nối dây, XANH sau. Dán bằng chứng hai chiều vào report.

### Cấm ở mục này

Đổi copy `MediaEditor.tsx:517`; viết migration / sửa RPC / sửa edge function; tạo hook mới, file source mới, file test mới; thêm class CSS mới (dùng `tl-shop-error`, `tl-shop-btn`, `tl-shop-hint` đã có); nuốt im lặng lỗi publish (trừ đúng ca "không có gì để publish" ở mục 3); để lỗi publish làm hỏng kết quả activate.

## 4. Bù đường kiểm chứng mà trình duyệt không làm được

**Quyết định của PO (PO-2): TEST COMPONENT thay browser. CẤM dựng Playwright vòng này.**

Vòng 1 `tester` chạy 0/8 case: bộ tool không có khả năng chạy JavaScript nên không ghi đè được `window.fetch`, và `/seller/settings` cần session seller thật trong khi dev server của worktree nối **thẳng Supabase production**. Vòng 2 **không chờ trình duyệt nữa**: agent `tester` sẽ **không** mở Chrome, chỉ đối chiếu kết quả test component + 4 gate. Nghiệm thu trên thiết bị thật là việc của Cuong ở bước cuối, sau khi bản này lên production.

Đưa bằng chứng xuống `src/components/shop/__tests__/MediaEditor.test.tsx` (vitest + jsdom), file đã mock sẵn `supabase.functions.invoke`, `shopRpc`, `reportCaughtError` và đã có `describe("publishing the logo and cover")` (`:425`). **Thêm case vào chính describe đó**, tái dùng helper `verifiedRow()` (`:426`) và `renderProfile()` (`:130`) có sẵn. Không tạo file test mới, không tạo harness mới.

Bốn case còn thiếu:

1. **Timeout 20s nổ** (bằng chứng cho tiêu chí "không trạng thái nào treo >30s mà không có nút bấm được"). **Không cần fake timer, không cần đợi 20 giây thật**: `supabase-js` khi abort trả về `{ data: null, error: <Error có name "FunctionsFetchError">, response: undefined }` — mock đúng shape đó. Kỳ vọng: `role="alert"` chứa `"Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại."`, có dòng `Mã lỗi:`, và **nút quay lại nhãn "Thử đưa logo lên trang shop lại" với `disabled === false`**. Giữ nguyên assertion `timeout: 20_000` đã có ở case khác, đừng lặp lại.
2. **403 mất phiên**: body `{"error":"JWT expired"}` → `role="alert"` chứa `"Phiên đăng nhập đã hết hạn"`.
3. **403 tiếng Anh của Postgres**: body `{"error":"permission denied for function shop_profile_media_publish_prepare"}` → `role="alert"` **không** chứa `"permission denied"`; dòng `Mã lỗi:` **có** chứa. Bảo vệ hợp đồng hiển thị 2 tầng của vòng 1.
4. **200 thành công sau một lần lỗi**: bấm lần 1 lỗi (shape 502 ở §2), lần 2 mock 200 `{ok:true, published:[...], failed:[]}` → sau lần 2 **không còn** phần tử `role="alert"` và **không còn** text `"Mã lỗi:"`.

Nếu case nào phát hiện production code sai thật thì sửa production code — nhưng chỉ trong `errors.ts` / `MediaEditor.tsx` / `useProductMedia.ts`, và ghi rõ vì sao trong report.

**Cấm vòng này:** thêm Playwright spec, sửa `playwright.config.ts`, tạo user/seller bằng service-role key, thêm query param dev-only để ép lỗi (đó là code production phục vụ test). Repo có Playwright thật nhưng 0 spec shop, 0 chỗ dùng `page.route`, `baseURL` mặc định trỏ production và `TEST_USERS` không có role seller ⇒ ghi thành backlog kèm điều kiện cần, đừng làm.

## 5. Bù biên cho `stripJpegMetadata`

`src/lib/shop/__tests__/imagePipeline.test.ts`, mở rộng test có sẵn, fixture khai báo inline theo đúng style hiện tại (không thêm file binary, không thêm helper):

1. JPEG có **nhiều** APP segment liên tiếp (ví dụ APP1 + APP13 + APP2) → tất cả bị loại, SOI + APP0/JFIF + segment cấu trúc + scan data giữ nguyên byte;
2. có **fill byte `FF FF`** trước marker → không crash, output đúng kỳ vọng;
3. segment khai báo `length < 2` (hoặc tràn khỏi buffer) → hàm trả về **đúng mảng đầu vào** (so sánh toàn bộ byte, không chỉ `length`), không throw.

## 6. Dọn rác production (PO-3: PO cho phép thử xoá lại)

Vòng 1 bạn tạo một auth user thật trên production khi điều tra: `publish-probe-1786962691@thepicklehub.net` / `0bbe10dc-b091-41f5-a448-473e3c997d99`. PO **cho phép** thử xoá.

- Dùng PAT trong `~/Downloads/secrets.local.md` qua Supabase Management API (query endpoint), câu SQL đã ghi sẵn trong `round1-report.md:363`:
  ```sql
  delete from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';
  ```
  Hoặc `DELETE /auth/v1/admin/users/0bbe10dc-…` bằng service key nếu đường đó thông.
- **Nếu classifier lại chặn:** ghi vào report **đã chạy lệnh gì (che secret), chặn ở bước nào, thông báo lỗi ra sao**, rồi để lại đúng câu SQL trên cho Cuong tự chạy. **Cấm** im lặng bỏ qua, cấm ghi "đã dọn" khi chưa xác nhận row biến mất.
- Xác nhận bằng `select count(*) from auth.users where id = '0bbe10dc-…';` trả 0 nếu chạy được.
- **Cấm** ghi bất kỳ PAT / service key / anon key nào vào report hay vào git.

_Ghi chú: prompt-engineer đã thử đọc `~/Downloads/secrets.local.md` khi soạn prompt này và bị permission system từ chối. Nhiều khả năng bạn gặp đúng bức tường đó — thử một lần, đừng lặp._

## 7. Ràng buộc giữ nguyên từ vòng 1

- **Ponytail:** không thêm file source mới nếu file cũ dùng được; không thêm dependency; không thêm lớp trừu tượng; không refactor ngoài phạm vi.
- **Không commit, không push, không mở PR.**
- Không đổi `verify_jwt`; không sửa edge function trong `supabase/functions/`; không viết/áp migration; không viết backfill.
- Shop UI đang **VI-only có chủ đích** (lệch chuẩn song ngữ đã được ghi nhận) — đừng "sửa" bằng cách thêm chuỗi EN.
- 4 gate bắt buộc trước khi báo xong, chạy đủ và ghi exit code từng lệnh: `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs`. Headroom CODE chỉ còn ~9 KB (1572.7/1800) — gate đỏ thì giảm diff, **cấm** nâng threshold.
- Báo cáo: `docs/build-feature/shop-publish-media-button/rounds/round2-report.md`.

## 8. Nội dung bắt buộc trong `round2-report.md`

1. Root cause của lỗi phân loại: product 422 vs profile 502, vì sao `status === 422` giết nhánh profile.
2. Danh sách file thay đổi (`git diff --stat`) + kết quả **red-proof hai chiều** (đỏ trước fix / xanh sau fix) cho 3 test ở §2 và 2 case ở §3.
3. Mục §3 đã nối ở đâu, gate "có gì để publish" cài kiểu nào và vì sao (nếu bạn chọn khác row-check thì phải chứng minh 3 tính chất ở §3.3).
4. Kết quả 4 gate, exit code từng lệnh, + xác nhận `AdminShopProductReview.publish.test.tsx`, `AdminShopApplicationReview.activate.test.tsx` (case cũ) và case 422 `rendition_too_large` vẫn xanh.
5. Giới hạn kiểm chứng: vì sao vòng này không có bằng chứng trình duyệt, và vì sao vitest + jsdom là tầng thay thế rẻ nhất.
6. Backlog Playwright kèm **điều kiện cần**: tạo seller test user + shop test, thêm role vào `tests/helpers/auth.ts`, chạy với `PLAYWRIGHT_BASE_URL` trỏ localhost (mặc định hiện tại là production), dùng `page.route` chặn `functions/v1/shop-media-lifecycle`.
7. **Rủi ro dữ liệu tồn đọng** (bắt buộc, không code vòng này): rendition JPEG đã nằm trong draft bucket **trước** bản sửa vẫn còn EXIF ⇒ bấm "Thử lại" gửi lại đúng byte cũ và vẫn fail vĩnh viễn. Không có backfill. Trước khi mở cho seller thứ hai phải đếm `shop_profile_media` có `verified_at IS NOT NULL AND public_path IS NULL` và xử lý từng row.
8. Kết quả §6 (dọn user rác): xoá được hay bị chặn ở đâu.
9. **Cấm** viết rằng tính năng "đã kiểm chứng trên trình duyệt" — vòng này không ai mở trình duyệt.

## 9. Acceptance criteria vòng 2 (kiểm chứng được)

1. 502 + `failed[0].error = "rendition_metadata_present"` → message chứa `"Thử chọn ảnh khác"`, code vẫn `"502 · rendition_metadata_present"`.
2. 502 + `failed[0].error = "copy_failed"` → message vẫn chứa `"Lỗi từ phía hệ thống"`.
3. 422 + `rendition_too_large` (đường publish sản phẩm) vẫn hoạt động y nguyên, test cũ xanh không sửa.
4. `MediaEditor.test.tsx` có case `FunctionsFetchError` + `response: undefined` → hiện câu mạng + dòng `Mã lỗi:` + nút `disabled === false`.
5. Có case 403 `JWT expired` → "Phiên đăng nhập đã hết hạn".
6. Có case 403 `permission denied…` → không lọt lên `role="alert"`, có ở dòng `Mã lỗi:`.
7. Có case 200 sau một lần lỗi → không còn `role="alert"`, không còn `"Mã lỗi:"`.
8. 3 edge case `stripJpegMetadata` xanh; case `length < 2` khẳng định trả về **đúng byte đầu vào**.
9. **Activate thành công → `publish_profile` được gọi ngay sau đó**, đúng payload `{ action: "publish_profile", shop_id }`, có test khẳng định thứ tự.
10. **Activate thất bại → publish không được gọi**; **publish thất bại → activate vẫn được coi là thành công**, có test cho cả hai chiều.
11. **Shop không có ảnh verified-chưa-publish → không gọi publish, không hiện lỗi, không hiện nút.**
12. **Nút "Đưa ảnh lên trang shop" hiện sau khi mount lại trang** (không bấm activate) khi shop active + còn row verified-chưa-publish — có test riêng.
13. Red-proof hai chiều được dán vào report cho 3 test ở §2 và 2 case ở §3.
14. Diff vòng 2 chỉ chạm **6 file source/test + 1 report**:
    - `src/lib/shop/errors.ts`
    - `src/lib/shop/__tests__/errors.test.ts`
    - `src/components/shop/__tests__/MediaEditor.test.tsx`
    - `src/lib/shop/__tests__/imagePipeline.test.ts`
    - `src/pages/admin/shop/AdminShopApplicationReview.tsx`
    - `src/pages/admin/shop/__tests__/AdminShopApplicationReview.activate.test.tsx`
    - `docs/build-feature/shop-publish-media-button/rounds/round2-report.md`
    File nào ngoài danh sách này phải giải thích bằng bằng chứng trong report. Đặc biệt: **không** đụng `src/styles/shop.css`, **không** đụng `src/hooks/shop/useProductMedia.ts` trừ khi test ở §4 chứng minh nó sai.
15. Không có Playwright spec mới, không có file source mới, không có dependency mới, không có migration mới.
16. `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs` — cả 4 xanh.
17. Không commit, không push, không PR.

---

## 10. Việc chỉ Cuong làm được (không giao coder)

1. Nghiệm thu iPhone Safari sau khi bản này lên production — đây là bug gốc mở chặn Wave 1, chưa ai đo lại trên thiết bị thật.
2. Chạy 2 lệnh cần service key/PAT nếu coder vẫn bị chặn ở §6: xoá user rác, và `select proname, pronargs, proacl::text from pg_proc where proname like 'shop_profile_media_publish%';`.
3. Quyết định thời điểm mở Wave 1 + indexing (vẫn đang gate PO).
