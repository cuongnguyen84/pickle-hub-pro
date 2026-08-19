# Vòng 1 — Bước A: code review (Codex độc lập + prompt-engineer xác minh)

Người review: Codex CLI (`codex exec`, model khác Claude) + prompt-engineer tự kiểm chứng bằng `git diff`, đọc source và chạy lại 4 gate.
Diff: working tree nhánh `fix/shop-publish-media-button`, chưa commit — 9 file sửa + 1 file test mới, `467 ++ / 35 --`.

## Verdict sơ bộ

**CHƯA ĐẠT — 1 lỗi chặn ship, 1 quyết định phải hỏi PO/ux-designer, 2 tiêu chí không kiểm chứng được vì môi trường.** Chưa kết luận cuối; chờ kết quả `tester` (bộ test case ở mục 4).

Đánh giá tổng: hướng sửa của coder **có khả năng đúng và diff đủ nhỏ**, không vi phạm ponytail đáng kể, 4 gate xanh (tôi chạy lại, không tin báo cáo). Nhưng đường quan sát lỗi — thứ được thêm vào để chính bug này *tự khai tên* — lại **phân loại sai đúng cái lỗi đó**, và chuỗi bằng chứng root cause còn hở đúng một mắt xích rẻ tiền.

## 0. Gate — tôi chạy lại, không lấy từ báo cáo coder

| Lệnh | Kết quả tôi đo |
|---|---|
| `npm run test` | 189 file / **2860 pass** / 10 skip / 0 fail, exit 0 |
| `npm run lint` | exit 0 — 30 warning `react-refresh/only-export-components` (có sẵn), 0 error |
| `npm run build` | exit 0, PWA precache 40 entries |
| `node scripts/check-bundle-size.mjs` | exit 0 — INITIAL 227.0/280, **CODE 1572.7/1800**, CONTENT 405.6/600 |
| `npx tsc -b` | exit 0 |

`AdminShopProductReview.publish.test.tsx` nằm trong 189 file trên và xanh ⇒ **tiêu chí 5 ĐẠT**, tiêu chí 7 ĐẠT.

---

## 1. Phán xử root cause

### (a) Bằng chứng byte chứng minh được đến đâu

Bằng chứng của coder chứng minh **chắc chắn**:
1. Hai object công khai của shop PO là JPEG (`content-type: image/jpeg` dù key kết thúc `.webp`);
2. Chúng mang APP1 (`Exif`, 76 byte) + APP13 (`Photoshop 3.0`);
3. `inspectJpeg` của worker trả `metadata_present` trên đúng các byte đó — tôi đã đọc `supabase/functions/shop-media-lifecycle/jpeg.ts:56` và xác nhận **bất kỳ APP1 nào cũng bị từ chối** (APP13 thì không);
4. Sau `stripJpegMetadata` thì cũng bytes đó `{ok:true}` — server sẽ nhận.

Nó **chưa chứng minh** rằng lần `publish_profile` thật đã đọc chính các byte đó. Object công khai do **script chạy tay** tạo, và script `publish-shop-profile-media-manually.sh` **không tồn tại trong worktree này** (tôi tìm `find` + `git log --all` → không có) ⇒ không ai kiểm chứng được nó copy nguyên byte hay re-encode. Codex chốt cùng kết luận, tôi đồng ý.

**Bổ sung của tôi (Codex không nêu, làm chuỗi kín hơn coder tưởng):** `content-type: image/jpeg` trên object công khai chỉ có thể lan truyền từ metadata của object draft, mà metadata đó do client đặt bằng `processed.blob.type` khi upload. Tức **rendition trong draft bucket gần như chắc chắn là JPEG** (nhánh fallback đã chạy). Phần còn hở hẹp hơn nhiều so với mô tả của Codex: chỉ còn câu hỏi "rendition draft có APP1 không" — mà một thao tác copy thuần thì không thể *thêm* APP1 vào. Ước lượng của tôi: chuỗi ~90% kín, không phải "chỉ khả nghi".

**Một lệnh đóng nốt** (cần service key — hiện agent bị chặn, để Cuong chạy):
```sh
curl -fsS "$SUPABASE_URL/storage/v1/object/shop-product-media/<draft rendition path>" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -o /tmp/draft-rendition
xxd -l 64 /tmp/draft-rendition   # tìm FFE1 "Exif" trước FFC0
```
Hoặc dứt điểm hơn: gọi `publish_profile` bằng JWT manager và đọc nguyên body — kỳ vọng `502 {"failed":[{"error":"rendition_metadata_present"}]}` (đây chính là D6 chưa chạy được).

### (b) Vì sao sản phẩm ra WebP mà logo/bìa ra JPEG — **CHƯA GIẢI THÍCH ĐƯỢC**

Tôi đọc `processImage` (`src/lib/shop/imagePipeline.ts:196-280`) và `useMediaUpload.ts:130`: chỉ có **một** điều kiện chọn định dạng — `ladder("image/webp")` trả `null` khi `blob.type !== "image/webp"` thì mới rơi xuống JPEG. `cap` (logo 512 / còn lại 2048) chỉ đổi kích thước canvas, **không** tham gia vào việc chọn MIME. `canvas.toBlob` không fail theo kích thước ở dải này (2048×1536 = 3.1 MP, xa giới hạn diện tích canvas của Safari). Codex kết luận y hệt.

⇒ **Cùng một trình duyệt thì product và profile phải ra cùng định dạng.** Lỗ này chưa bịt được và **không nằm trong diff** — nó chỉ có ba lời giải khả dĩ, cả ba đều là dữ kiện ngoài code:
- ảnh sản phẩm được up từ máy khác (desktop Chrome) chứ không phải iPhone như PO nhớ;
- up ở phiên bản iOS/Safari khác (Safari mới encode được WebP, cũ thì không);
- ảnh sản phẩm đó có từ trước một thay đổi pipeline.

Cách bịt: tải rendition draft của **chính ảnh sản phẩm PO viện dẫn** (`file`/`xxd` 12 byte đầu) + hỏi PO up từ thiết bị nào. **Không cần chặn ship vì lỗ này** — nó chỉ quyết định "H1 có phải nguyên nhân *duy nhất* không", trong khi bản thân `stripJpegMetadata` là no-op với JPEG sạch nên không gây hại nếu H1 sai.

### (c) Chỉ sửa được ảnh upload MỚI — rủi ro thật

Đồng ý với Codex: mọi rendition JPEG đã nằm trong draft bucket vẫn mang APP1 ⇒ bấm "Thử lại" gửi lại **đúng byte cũ** ⇒ fail vĩnh viễn. Coder có khai điều này trong report. Cộng với lỗi #1 dưới đây (UI bảo "thử lại sau vài phút") thì kết quả là **vòng lặp bấm-lỗi vô tận đúng cho seller Wave 1 đầu tiên**. Đây là lý do tôi nâng lỗi #1 lên mức chặn ship thay vì "nên sửa".

---

## 2. Đối chiếu 8 acceptance criteria

| # | Kết quả | Căn cứ |
|---|---|---|
| 1 — bằng chứng root cause (D1/D2/D6) | **CHƯA ĐẠT** (môi trường, không phải lỗi coder) | D1 + D2 có nguyên status/body trong `round1-report.md`; **D3–D7 không chạy được** vì permission classifier chặn PAT/service key. Không có D6. |
| 2 — red-proof `edgeErrorMessage` | **ĐẠT** | `src/lib/shop/__tests__/errors.test.ts` có đúng case `502 + failed[0].error`; coder ghi bằng chứng đỏ/xanh hai chiều. Nhưng xem lỗi #1: test đang **khoá cứng hành vi sai**. |
| 3 — publish_profile 200 thật trên prod | **CHƯA ĐẠT** | Không chạy được (quyền). Đây là tiêu chí duy nhất chứng minh bug đã hết; hiện chỉ có suy luận. |
| 4 — đường quan sát lỗi | **CHƯA ĐẠT** | Hai dòng + `Mã lỗi:` + `reportCaughtError` đều có, nhưng lỗi sống còn (`502 · rendition_metadata_present`) hiện câu **sai hướng dẫn**. |
| 5 — không hồi quy publish sản phẩm | **ĐẠT** | Tôi chạy lại toàn suite, xanh. |
| 6 — không treo >30s | **ĐẠT (code)** | `timeout: 20_000` chỉ ở `usePublishProfileMedia`; tôi xác minh `@supabase/functions-js` types có `timeout` và khi abort thì ném `FunctionsFetchError` với `response === undefined` → rơi đúng nhóm C5-3. Nút luôn render, `disabled` khi pending. Chờ `tester` xác nhận trên UI thật. |
| 7 — 4 gate | **ĐẠT** | Bảng mục 0. |
| 8 — nghiệm thu iPhone | **NGOÀI TẦM** | Chỉ Cuong làm được. |

### Những chỗ tôi **bác** Codex (đã xác minh lại bằng source)

- **"Sửa `useProductModeration.ts` là ngoài phạm vi, nên revert"** → **BÁC.** `round1-prompt.md` §3.2 yêu cầu tường minh sửa **cả hai** call site ("root cause chung, một helper, hai caller") và cấm timeout ở nhánh product. Coder làm đúng: chỉ thêm `response` + `edgeErrorMessage`, **không** timeout. Codex thiếu ngữ cảnh này vì brief của tôi không chép §3.2.
- **"`edgeError()` là abstraction thừa"** → **BÁC.** Nó có 3 call site (2 trong `useProductMedia`, 1 trong `useProductModeration`) và là một dòng `Object.assign`. Inline hoá sẽ dài hơn.
- **"CSS đúng 2 dòng nhưng thực tế 4 dòng vì comment"** → **BÁC.** Comment không phải rule CSS. Diff thêm đúng 2 rule như spec, và tôi đã kiểm tra selector `.tl-shop-sr:focus-visible + label` khớp markup thật (`MediaEditor.tsx:162-174`: input rồi tới label liền kề).
- **"Có thể stale closure / target cũ"** (ngầm trong nhận xét auto-publish) → **BÁC trước khi ai nêu.** `useMediaUpload` gán `targetRef.current = target` mỗi render (`useMediaUpload.ts:133-136`) nên callback `onSettled` luôn thấy `isActive` mới nhất.
- **"C5-2 (hết phiên) có thể không bao giờ hiện"** → **BÁC một nửa.** JWT hết hạn ⇒ PostgREST trả message chứa `JWT expired` ⇒ edge gói lại thành `json({error: planError.message}, 403)` ⇒ regex `/jwt|expired/i` trong `edgeErrorMessage` bắt được. Nhánh này SỐNG. Chỉ thiếu **test** cho đúng shape 403 đó (giữ lại ở mức "nên sửa").

### Những chỗ tôi **đồng ý** với Codex (đã tự xác minh)

- `stripJpegMetadata` an toàn ở các biên: giữ SOI + APP0/JFIF + mọi segment cấu trúc; drop APP1–APP15 + COM; fill byte `FF FF`, TEM, RSTn, EOI xử lý đúng; `len < 2` / tràn / truncated / không phải JPEG → **trả về đúng mảng đầu vào** (`return bytes`, không copy thừa); scan data + EOI copy nguyên từ sau SOS. Progressive JPEG không bị hỏng (dừng ở SOS đầu, phần sau copy verbatim) — đúng bằng blind spot của server.
- `new Blob([clean.buffer as ArrayBuffer])` an toàn: nhánh này chỉ chạy khi `clean !== raw`, mà `clean` luôn là `new Uint8Array(size)` cấp phát khít.
- `shopErrorMessage(publish.error)` ở dòng 1 UI không làm biến dạng câu đã soạn: cả 5 câu đều chứa ký tự khớp regex `VIETNAMESE` nên được trả nguyên văn.
- `role="status"` chỉ gắn khi pending là điểm a11y yếu (live region nên tồn tại trước khi nội dung đổi) — **không chặn ship**.

---

## 3. Danh sách lỗi

### #1 — CHẶN SHIP · `src/lib/shop/errors.ts:117` · lỗi thật của production bị phân loại thành "không phải do ảnh của anh/chị"

Nhánh profile **không bao giờ** trả 422 cho lỗi rendition: `publishProfile` (`supabase/functions/shop-media-lifecycle/index.ts:236`) gom mọi outcome hỏng vào `failed[]` và luôn trả **502**. Điều kiện `status === 422 && detail.startsWith("rendition_")` vì thế **chết** trên nhánh profile. Kết quả cho đúng bug đang sửa:

- hiện: `Lỗi từ phía hệ thống, không phải do ảnh của anh/chị. … bấm Thử lại sau vài phút.`
- đúng: `Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.`

Với ảnh đã upload trước bản sửa (còn APP1 trong draft) thì "thử lại sau vài phút" là hướng dẫn **sai và không bao giờ thoát** — chọn ảnh khác mới là lối ra. `src/lib/shop/__tests__/errors.test.ts:31` và test UI ở `MediaEditor.test.tsx` đang **khẳng định hành vi sai này**, nên phải sửa cùng.

Lưu ý phân xử: coder làm **đúng chữ** của `03-ux-spec.md` (C5-4 gắn với "422 `rendition_*`"). Đây là lỗi của spec gặp thực tế, không phải coder tự chế. Cách sửa tối thiểu — bỏ ràng buộc status, giữ ràng buộc mã:

```ts
if (detail.startsWith("rendition_")) {
  return { message: "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.", code };
}
```
(đặt trước nhánh 403, sau nhánh session/mạng) + cập nhật 2 test tương ứng.

### #2 — CẦN QUYẾT ĐỊNH (PO/ux-designer) · `MediaEditor.tsx:517` · copy S3 hứa một việc không ai làm

Copy `Ảnh đã lưu. Shop được kích hoạt xong là ảnh tự lên trang shop, anh/chị không phải làm gì thêm.` là **nguyên văn C3a của `03-ux-spec.md`**, coder chép đúng. Nhưng tôi `grep` toàn repo: `publish_profile` chỉ có **một** caller là `useProductMedia.ts:119`, và nó chỉ được kích hoạt trong callback sau upload. **Không có** trigger/cron/edge nào publish khi shop chuyển `pending_activation → active`. Lời hứa hiện sai.

Hai lối, đều nhỏ — cần PO chọn, đừng để coder tự quyết:
- (A) đổi copy: `… kích hoạt xong quay lại đây bấm "Thử lại" là ảnh lên.` (0 logic mới);
- (B) thêm một `useEffect` bắn publish một lần khi `isActive && verified_at && !public_path` — nhưng khi đó phải gánh rủi ro tự bắn lại vô hạn với rendition hỏng vĩnh viễn (lỗi #1), nên (A) là nấc thang thấp hơn.

### #3 — NÊN SỬA (không chặn) · rendition cũ trong draft vẫn hỏng

Không có backfill. Trước khi mở Wave 1 cần một truy vấn đếm: `shop_profile_media` có `verified_at IS NOT NULL AND public_path IS NULL` → bao nhiêu row, byte draft có APP1 không. Nếu chỉ là shop PO thì bỏ qua (2 ảnh đã lên bằng script tay); có seller thứ hai thì phải hoặc backfill server-side, hoặc chủ động bảo họ chọn lại ảnh. Kết hợp lỗi #1 thì UI ít nhất nói đúng việc cần làm.

### #4 — NÊN SỬA · thiếu test cho 403 mất phiên và cho vài biên của `stripJpegMetadata`

Thêm case `403 {"error":"JWT expired"}` → C5-2 (nhánh này sống, xem mục 2), và case JPEG có **nhiều** APP segment + fill byte `FF FF` + `len` không hợp lệ. Rẻ, cùng file test đã có.

### #5 — NIT (không đáng một vòng) · `CODE_STYLE` chỉ dùng 1 chỗ

Inline được, nhưng spec quy định rõ font/size cho `<code>` nên tách hằng số cũng chấp nhận được. Không sửa cũng được.

### Không phải lỗi (đã kiểm, ghi để khỏi ai mở lại)

Import `inspectJpeg` từ `supabase/functions/...` vào unit test client — coupling có thật nhưng **đó chính là giá trị của test** (chạy đúng hàm đã từ chối bytes production); `tsc -b`, lint, build đều xanh. Giữ.

---

## 4. Test case cho `tester` (Chrome MCP, Chrome desktop)

### Ràng buộc + AN TOÀN — đọc trước khi chạy

- Dev server chạy **từ worktree này**: `cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-publish-btn && npm run dev` → `http://localhost:8080`.
- ⚠️ **Dev server này nối thẳng Supabase PRODUCTION.** **TUYỆT ĐỐI KHÔNG upload/chọn ảnh thật vào ô Logo hoặc Ảnh bìa**: `shop_profile_media_upload_init` set `public_path = NULL` + xếp hàng xoá **ngay khi chọn ảnh**, tức trang shop thật của PO sẽ mất logo ngay lập tức. Mọi case dưới đây **chỉ bấm nút publish/Thử lại**, không chọn file.
- Vì lý do trên, nhánh JPEG/`stripJpegMetadata` **không test trên trình duyệt vòng này** — nó đã có unit test chạy đúng `inspectJpeg` của worker. Ghi "N/A — unit test phủ".
- Cần **đăng nhập bằng tài khoản seller/PO** ở `/login`. Nếu không có credential → báo **BLOCKED** toàn bộ TC-01…TC-07, đừng đoán.
- Kỹ thuật giả lập: **ghi đè `window.fetch` trong tab** trước khi bấm (Chrome MCP không cần chặn ở tầng network). Dán snippet vào console của đúng tab đang mở `/seller/settings`, **không reload sau khi dán** (reload là mất stub).

Snippet gốc — dùng lại cho TC-01/02/03/04/05, chỉ đổi phần `REPLY`:

```js
window.__origFetch ??= window.fetch;
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.includes("/functions/v1/shop-media-lifecycle")) {
    return REPLY;               // ← thay theo từng case
  }
  return window.__origFetch(input, init);
};
// gỡ stub: window.fetch = window.__origFetch;
```

### TC-00 — Mở màn hình (tiền đề cho mọi case)

1. Mở `http://localhost:8080/login`, đăng nhập tài khoản seller của shop PO.
2. Mở `http://localhost:8080/seller/settings`.
3. Bấm mở `<details>` có tiêu đề **Logo & ảnh bìa**.

**Kỳ vọng:** khối hiện ra, không lỗi console đỏ. Ghi lại: mỗi ô (logo / ảnh bìa) hiện đúng chữ gì và **có nút nào không** (đây là baseline cho các case sau).
**PASS/FAIL:** FAIL nếu trang trắng, crash, hoặc khối không mở được.

> Nếu ở TC-00 cả hai ô đều **đã có ảnh trên trang shop** (không có dòng "Trang shop hiện chưa có…" và không có nút) thì TC-01…TC-05 không có nút để bấm → báo **BLOCKED (thiếu trạng thái dữ liệu)** kèm ảnh chụp, đừng tự sửa DB.

### TC-01 — S5, đúng lỗi production (`502 · rendition_metadata_present`) ⭐ quan trọng nhất

`REPLY` =
```js
Promise.resolve(new Response(JSON.stringify({ok:false,published:[],failed:[{media_id:"x",error:"rendition_metadata_present"}]}), {status:502, headers:{"Content-Type":"application/json"}}))
```
**Bước:** dán snippet → bấm nút có nhãn **Thử lại** ở ô Logo (accessible name `Thử đưa logo lên trang shop lại`).

**Kỳ vọng (ghi NGUYÊN VĂN cả hai dòng):**
- dòng đỏ (`role="alert"`): **ghi lại đúng chữ hiện ra** — hiện tại dự kiến là `Lỗi từ phía hệ thống, không phải do ảnh của anh/chị…`; câu **đúng** theo phán xử review là `Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác.`
- dòng mờ dưới: `Mã lỗi: 502 · rendition_metadata_present` + `Chụp màn hình dòng này gửi cho ThePickleHub nếu bấm mấy lần vẫn lỗi.`
- nút quay lại nhãn **Thử lại** và bấm được.

**PASS** khi: dòng 2 hiện **đúng** `Mã lỗi: 502 · rendition_metadata_present` VÀ nút bấm lại được.
**FAIL** khi: thiếu dòng mã lỗi, mã sai, hoặc nút biến mất.
**Ghi thêm (không tính pass/fail):** chép nguyên văn dòng đỏ — đây là bằng chứng cho lỗi #1.

### TC-02 — S5, shop bị từ chối bằng câu tiếng Việt của server (C5-1)

`REPLY` =
```js
Promise.resolve(new Response(JSON.stringify({error:"shop đang ở trạng thái restricted nên chưa đưa ảnh lên trang công khai được"}), {status:403, headers:{"Content-Type":"application/json"}}))
```
**Bước:** như TC-01.
**Kỳ vọng:** dòng đỏ = nguyên văn câu server **rồi nối thêm** ` Ảnh đã lưu rồi, kích hoạt shop xong bấm lại là hiện.`; dòng 2 `Mã lỗi: 403 · shop đang ở trạng thái restricted…` (có thể bị cắt bằng `…`, vẫn PASS).
**FAIL** nếu câu tiếng Việt của server bị thay bằng câu chung chung.

### TC-03 — S5, 403 tiếng Anh không được rò ra dòng chính

`REPLY` = như TC-02 nhưng body `{"error":"permission denied for function shop_profile_media_publish_prepare"}`.
**Kỳ vọng:** dòng đỏ **KHÔNG** chứa `permission denied` (phải là câu `Lỗi từ phía hệ thống…`); dòng 2 **CÓ** chứa `permission denied`.
**FAIL** nếu chuỗi Postgres lọt lên dòng đỏ.

### TC-04 — S4 pending + không treo quá 20s ⭐

`REPLY` =
```js
new Promise(() => {})   // không bao giờ trả lời
```
**Bước:** dán snippet → bấm **Thử lại** ở ô Logo → **bấm đồng hồ**.
**Kỳ vọng ngay sau khi bấm (trong 1s):**
- dòng `role="status"`: `Đang đưa ảnh lên trang shop…`
- **cùng nút đó** vẫn hiện, `disabled`, nhãn nhìn thấy `Đang đưa lên trang shop…`
- không spinner, không phần trăm.

**Kỳ vọng ở ~20s (và chắc chắn trước 30s):** trạng thái pending kết thúc, hiện dòng đỏ `Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại.` + dòng `Mã lỗi: …`, nút trở lại nhãn **Thử lại** và **bấm được**.
**FAIL** nếu: nút biến mất lúc pending, hoặc sau **30 giây** vẫn còn pending (ghi số giây đo được).

### TC-05 — Không lỗi sau khi gọi thành công

`REPLY` =
```js
Promise.resolve(new Response(JSON.stringify({ok:true,shop_id:"x",published:[{media_id:"m",target:"t"}],failed:[]}), {status:200, headers:{"Content-Type":"application/json"}}))
```
**Bước:** như TC-01.
**Kỳ vọng:** không có dòng `role="alert"`, không có dòng `Mã lỗi:`, trạng thái pending kết thúc, nút trở về nhãn `Thử lại`.
(Khối chỉ **biến mất hẳn** nếu `public_path` thật đổi trong DB — với stub thì không, nên **đừng** coi việc khối còn đó là FAIL.)
**FAIL** nếu vẫn hiện dòng lỗi sau một phản hồi 200.

### TC-06 — S3 shop `pending_activation`: không nút, không auto-publish

Cần ép `shops.state`. Snippet (dán rồi **reload** trang `/seller/settings` — case này khác các case trên, phải reload để query chạy lại):
```js
window.__origFetch ??= window.fetch;
window.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : input.url;
  const res = await window.__origFetch(input, init);
  if (url.includes("/rest/v1/shops")) {
    const body = await res.clone().json().catch(() => null);
    if (body) {
      const patch = (o) => (o && typeof o === "object" && "state" in o ? { ...o, state: "pending_activation" } : o);
      const next = Array.isArray(body) ? body.map(patch) : patch(body);
      return new Response(JSON.stringify(next), { status: res.status, headers: res.headers });
    }
  }
  return res;
};
```
(Nếu URL query của shop khác `/rest/v1/shops`, tester tự log `url` ra console một lượt rồi chỉnh cho khớp; ghi lại URL thật vào báo cáo.)

**Kỳ vọng:** ô Logo/Ảnh bìa hiện **đúng một dòng**: `Ảnh đã lưu. Shop được kích hoạt xong là ảnh tự lên trang shop, anh/chị không phải làm gì thêm.` — và **không có nút nào** tên `Thử lại` / `Thử đưa logo…`. Tab Network: **không** có request tới `functions/v1/shop-media-lifecycle`.
**FAIL** nếu còn nút, hoặc có request publish.

### TC-07 — S3 shop `suspended`: gọi đúng tên trạng thái

Như TC-06 nhưng `state: "suspended"`.
**Kỳ vọng:** `Ảnh đã lưu. Shop đang ở trạng thái "Tạm ngưng" nên chưa đưa ảnh lên trang shop được.` — chữ **Tạm ngưng** phải đúng, không phải `suspended`. Không nút.
**FAIL** nếu hiện chữ tiếng Anh hoặc `undefined`.

### TC-08 — Chạm/phím (nhanh, gộp vào case cuối)

Trên trạng thái có nút (sau TC-01): bấm `Tab` tới nút → phải thấy **viền focus xanh** rõ; giữ chuột xuống nút → nút **nhích xuống 1px**. Trên ô "Chọn ảnh": `Tab` tới nó → nhãn phải có **viền focus xanh** (không được vô hình).
**FAIL** nếu focus không nhìn thấy được ở một trong hai chỗ. **KHÔNG bấm chọn file.**

### Sau khi xong

Gỡ stub: `window.fetch = window.__origFetch;` rồi reload. Xác nhận trang trở lại bình thường và **không có ảnh nào của shop bị đổi**.

---

## 5. Việc còn lại cho Cuong (agent không làm được)

1. Chạy 2 lệnh cần service key/PAT: đọc byte rendition draft (đóng nốt mắt xích (a)) và `select proname, pronargs, proacl::text from pg_proc where proname like 'shop_profile_media_publish%';`.
2. Xoá user rác coder tạo trên prod: `delete from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';` (`publish-probe-1786962691@thepicklehub.net`).
3. Quyết định lỗi #2 (copy S3 hứa auto-publish): đổi copy hay thêm hành vi.
4. Nghiệm thu iPhone (tiêu chí 8) sau khi bản này lên production.
