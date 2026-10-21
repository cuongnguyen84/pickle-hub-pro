# Vòng 1 — Bước B: quyết định cuối + prompt vòng 2

Nguồn: `round1-code-review.md` (Codex + prompt-engineer xác minh) · `round1-test-report.md` (tester, Chrome MCP) · `round1-prompt.md` (8 acceptance criteria).
Vòng đã dùng: **1/6**.

---

# 1. VERDICT: CHƯA ĐẠT

Luật của vòng lặp: đạt **chỉ khi** code review Bước A đạt **VÀ** toàn bộ test case của `tester` pass. Cả hai đều thiếu.

- Code review: **chưa đạt** — 1 lỗi chặn ship có thật trong `src/lib/shop/errors.ts:113`.
- Test thật: **0/8 pass, 8/8 BLOCKED** — không có case nào FAIL, cũng không có case nào PASS. Đây là **vô hiệu**, không phải bằng chứng ủng hộ.

Phân biệt quan trọng khi đọc bảng dưới: **"SAI"** = đã chứng minh hành vi lệch yêu cầu. **"CHƯA CHỨNG MINH"** = có thể đúng, nhưng không ai đo được ở vòng này (thiếu quyền / thiếu công cụ) — không được tính là đạt, cũng không được tính là lỗi của `coder`.

## Bảng đối chiếu 8 acceptance criteria

| # | Tiêu chí | Kết quả | Loại | Căn cứ |
|---|---|---|---|---|
| 1 | Bằng chứng root cause (D1/D2/D6) | **CHƯA ĐẠT** | chưa chứng minh | D1 (`curl -sI`) + D2 (RPC qua anon) có nguyên status/body trong `round1-report.md`. D3–D7 **không chạy được**: permission classifier chặn PAT/service key. **Không có D6** — tức chưa ai gọi `publish_profile` bằng đúng đường trình duyệt gọi. Chuỗi suy luận kín ~90% (xem review §1a) nhưng vẫn là suy luận. |
| 2 | Red-proof `edgeErrorMessage` | **ĐẠT CÓ ĐIỀU KIỆN** | đạt, phải sửa | `src/lib/shop/__tests__/errors.test.ts:23-33` có đúng shape production (502 + `failed[0].error`), coder ghi bằng chứng đỏ/xanh hai chiều. Nhưng nó **khẳng định câu trả lời sai** (xem tiêu chí 4) ⇒ đang bảo vệ nhầm hành vi. |
| 3 | `publish_profile` trả 200 thật trên prod | **CHƯA ĐẠT** | chưa chứng minh | Không chạy được (quyền). Đây là tiêu chí **duy nhất** chứng minh bug đã hết; hiện chưa có gì thay thế nó. |
| 4 | Đường quan sát lỗi | **KHÔNG ĐẠT** | **SAI** | Hạ tầng đúng (2 tầng: câu tiếng Việt + `Mã lỗi:`, có `reportCaughtError`). Nhưng đúng lỗi production `502 · rendition_metadata_present` bị map vào nhánh mặc định ⇒ hiện *"Lỗi từ phía hệ thống, không phải do ảnh của anh/chị… bấm Thử lại sau vài phút."*. Với rendition cũ còn EXIF trong draft bucket, "thử lại sau vài phút" là **vòng lặp không lối thoát**; lối thoát đúng là "chọn ảnh khác". |
| 5 | Không hồi quy publish sản phẩm | **ĐẠT** | đạt | Tôi chạy lại toàn suite: 189 file / 2860 pass / 0 fail, gồm `AdminShopProductReview.publish.test.tsx`. |
| 6 | Không trạng thái nào treo >30s | **ĐẠT (code) / CHƯA ĐẠT (UI thật)** | một nửa chưa chứng minh | `timeout: 20_000` chỉ đặt ở `usePublishProfileMedia`, đã có test khẳng định body + timeout; nhánh in-flight có test (nút vẫn hiện, `disabled`, có `role="status"`). **Chưa có test nào cho lúc timeout NỔ** — tức chưa ai chứng minh sau 20s nút quay lại bấm được. Trên UI thật: chưa đo (tester blocked). |
| 7 | 4 gate | **ĐẠT** | đạt | Tôi chạy lại, không lấy từ báo cáo coder: `lint` exit 0 (30 warning có sẵn), `test` exit 0, `build` exit 0, `check-bundle-size` exit 0 (CODE 1572.7/1800), `tsc -b` exit 0. |
| 8 | Nghiệm thu iPhone | **CHƯA CHẠY** | ngoài tầm agent | Chỉ Cuong bấm được, và chỉ sau khi bản sửa lên production. |

**Tổng: 2 đạt trọn (5, 7) · 1 đạt có điều kiện (2) · 1 sai (4) · 4 chưa chứng minh (1, 3, 6-UI, 8).**

## Bất đồng giữa ba nguồn — ghi lại để không ai mở lại

- Codex đòi revert phần sửa `useProductModeration.ts` vì "ngoài phạm vi" → **tôi bác**: `round1-prompt.md` §3.2 yêu cầu tường minh sửa cả hai call site. Codex thiếu ngữ cảnh đó vì brief tôi gửi không chép §3.2.
- Codex chê `edgeError()` là abstraction thừa → **tôi bác**: 3 call site, thân hàm một dòng `Object.assign`.
- `coder` báo "đường quan sát lỗi hoàn chỉnh" → **thực tế sai với đúng lỗi cần quan sát**. Đây là lý do bước review độc lập tồn tại.
- `tester` báo 8/8 BLOCKED, không bịa kết quả và không đụng dữ liệu production → **đúng cách xử sự**; giá trị lớn nhất của vòng test này là phát hiện **worktree thiếu `.env`** (app treo ở shell "Loading…" trên mọi route, không log lỗi nào — rất dễ chẩn đoán nhầm thành lỗi của diff). Đã copy `.env` vào worktree, `.gitignore:18` chặn nên không lọt git.

## Vì sao không cố kiểm chứng lại bằng trình duyệt ở vòng 2

Bộ tool của `tester` **không có tool chạy JavaScript** (`navigate javascript:` bị chặn, Chrome không mở remote debugging). Mọi test case dựa trên "dán snippet ghi đè `window.fetch`" là **không thực thi được**, không phải "thử lại là được". Cộng thêm: route `/seller/settings` cần session seller thật, và dev server của worktree nối **thẳng Supabase production** ⇒ mọi thao tác chọn ảnh sẽ xoá logo thật của shop PO.

⇒ Vòng 2 chuyển bằng chứng xuống tầng rẻ nhất và **xác định** được: mở rộng `MediaEditor.test.tsx` (vitest + jsdom, đã mock sẵn `supabase.functions.invoke`). Đã tự kiểm tra repo: có Playwright thật (`playwright.config.ts`, `tests/`, `npm run e2e*`) **nhưng** 0 spec cho shop, 0 chỗ dùng `page.route`, `baseURL` mặc định trỏ **production**, mint session cần `SUPABASE_SERVICE_ROLE_KEY` và `TEST_USERS` **không có role seller** ⇒ Playwright là nấc thang cao hơn hẳn, cần user + shop test mới, và cần PO quyết. Vòng 2 **cấm** thêm Playwright.

---

# 2. Hai câu hỏi đang chờ PO

Đã hỏi song song. Nếu câu trả lời về kịp, orchestrator chèn vào mục **PHỤ THUỘC** của prompt dưới; nếu không, coder vẫn làm trọn phần độc lập.

**(a) Copy S3 hứa một việc không ai làm.** `MediaEditor.tsx:517` nói *"Shop được kích hoạt xong là ảnh tự lên trang shop, anh/chị không phải làm gì thêm."* — đúng nguyên văn C3a của `03-ux-spec.md`, coder chép đúng. Nhưng `publish_profile` chỉ có **một** caller (`useProductMedia.ts:119`) và nó chỉ chạy trong callback sau upload; **không** trigger/cron/edge nào publish khi shop chuyển `pending_activation → active`. Chọn: **(A)** đổi copy thành *"kích hoạt xong quay lại đây bấm Thử lại là ảnh lên"* (0 logic mới) — hoặc **(B)** nối dây thật bằng một `useEffect` bắn publish một lần khi `active && verified_at && !public_path` (gánh rủi ro tự bắn lại vô hạn với rendition hỏng vĩnh viễn).

**(b) Cách kiểm chứng trên trình duyệt cho vòng sau.** Chọn: **(i)** Cuong tự đăng nhập seller + tự dán snippet DevTools, `tester` chỉ bấm và đọc DOM — hoặc **(ii)** đầu tư Playwright: tạo user seller test + shop test, thêm role vào `TEST_USERS`, chạy với `PLAYWRIGHT_BASE_URL=http://localhost:8080` và `page.route` chặn `functions/v1/shop-media-lifecycle`. (ii) đắt hơn nhiều và chạm dữ liệu prod khi mint session.

---

# 3. PROMPT VÒNG 2 — giao cho `coder`

> Nguồn: Codex CLI soạn nháp (`codex exec`), prompt-engineer bổ sung ngữ cảnh repo mà Codex không thấy được (quy ước red-proof, test 422 phải giữ nguyên, không cần fake timer, shop UI VI-only có chủ đích).

Bạn thực thi trực tiếp trên worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-publish-btn`, nhánh `fix/shop-publish-media-button`. Đây là **vòng 2** của một vòng lặp sửa lỗi. **Không** làm lại vòng 1, **không** mở rộng phạm vi. Nguyên tắc: diff ngắn nhất chạy được.

`.env` đã có sẵn trong worktree (tester copy vào ở vòng 1, `.gitignore` chặn) — **đừng xoá**, thiếu nó thì app treo ở shell "Loading…" trên mọi route mà không có lỗi nào để lần ra.

## 3.1 Sửa lỗi chặn ship — phân loại sai đúng lỗi production

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

## 3.2 Sửa 2 test đang khoá cứng hành vi sai + thêm 1 test chống nới quá tay

`src/lib/shop/__tests__/errors.test.ts:23-33` — case 502 + `failed[0].error = "rendition_metadata_present"`:
- đổi `expect(out.message).toContain("Lỗi từ phía hệ thống")` → `toContain("Thử chọn ảnh khác")`;
- **giữ nguyên** `expect(out.code).toBe("502 · rendition_metadata_present")`.

`src/components/shop/__tests__/MediaEditor.test.tsx`, test *"says what the worker actually refused, and shows the code to screenshot"* (~dòng 502-527) — cùng vấn đề:
- `role="alert"` phải chứa `"Thử chọn ảnh khác"`, không còn `"Lỗi từ phía hệ thống"`;
- giữ nguyên assertion `screen.getByText("502 · rendition_metadata_present")` và `reportCaughtError` được gọi.

**Thêm mới** vào `errors.test.ts`: 502 + `failed[0].error = "copy_failed"` → message **vẫn phải** chứa `"Lỗi từ phía hệ thống"`, code chứa `"502 · copy_failed"`. Đây là test bảo vệ chiều ngược lại: chứng minh fix không biến mọi 502 thành "lỗi tại ảnh".

**Không được đụng** case sẵn có *"blames the photo only when the server actually rejected the photo"* (`errors.test.ts:70`, 422 + `rendition_too_large`) — nó là guard cho đường publish sản phẩm, phải xanh nguyên trạng sau khi sửa.

**Red-proof (quy ước của repo, bắt buộc nộp bằng chứng hai chiều):** với cả 2 test đã đổi + 1 test mới, chạy một lượt **trước** khi áp fix ở 3.1 (phải ĐỎ đúng những case đó) rồi **sau** khi áp (phải XANH). Dán output tóm tắt cả hai chiều vào report. Test không đỏ được trước khi fix là test không bảo vệ gì.

## 3.3 Bù đường kiểm chứng mà trình duyệt không làm được

Vòng 1 `tester` chạy 0/8 case: bộ tool không có khả năng chạy JavaScript nên không ghi đè được `window.fetch`, và `/seller/settings` cần session seller. Vòng này **không** chờ trình duyệt nữa — đưa bằng chứng xuống `MediaEditor.test.tsx` (vitest + jsdom), file đã mock sẵn `supabase.functions.invoke`, `shopRpc`, `reportCaughtError` và đã có `describe("publishing the logo and cover")`. **Thêm case vào chính describe đó**, tái dùng helper `verifiedRow()` và `renderProfile()` có sẵn. Không tạo file test mới, không tạo harness mới.

Bốn case còn thiếu:

1. **Timeout 20s nổ** (bằng chứng cho tiêu chí "không trạng thái nào treo >30s mà không có nút bấm được"). **Không cần fake timer, không cần đợi 20 giây thật**: `supabase-js` khi abort trả về `{ data: null, error: <Error có name "FunctionsFetchError">, response: undefined }` — mock đúng shape đó. Kỳ vọng: `role="alert"` chứa `"Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại."`, có dòng `Mã lỗi:`, và **nút quay lại nhãn "Thử đưa logo lên trang shop lại" với `disabled === false`**. Giữ nguyên assertion `timeout: 20_000` đã có ở case khác, đừng lặp lại.
2. **403 mất phiên**: body `{"error":"JWT expired"}` → `role="alert"` chứa `"Phiên đăng nhập đã hết hạn"`. Nhánh này sống thật (JWT hết hạn ⇒ PostgREST raise ⇒ edge gói lại thành 403), chỉ đang thiếu test.
3. **403 tiếng Anh của Postgres**: body `{"error":"permission denied for function shop_profile_media_publish_prepare"}` → `role="alert"` **không** chứa `"permission denied"`; dòng `Mã lỗi:` **có** chứa. Bảo vệ hợp đồng hiển thị 2 tầng của vòng 1.
4. **200 thành công sau một lần lỗi**: bấm lần 1 lỗi (dùng shape 502 ở trên), lần 2 mock 200 `{ok:true, published:[...], failed:[]}` → sau lần 2 **không còn** phần tử `role="alert"` và **không còn** text `"Mã lỗi:"`. Đây là case chứng minh trạng thái lỗi được dọn, không dính lại.

Nếu case nào phát hiện production code sai thật thì sửa production code — nhưng chỉ trong `errors.ts` / `MediaEditor.tsx` / `useProductMedia.ts`, và ghi rõ vì sao trong report.

**Cấm vòng này:** thêm Playwright spec, sửa `playwright.config.ts`, tạo user/seller bằng service-role key, thêm query param dev-only để ép lỗi (đó là code production phục vụ test). Repo có Playwright thật nhưng 0 spec shop, 0 chỗ dùng `page.route`, `baseURL` mặc định trỏ production và `TEST_USERS` không có role seller ⇒ ghi thành backlog kèm điều kiện cần, đừng làm.

## 3.4 Bù biên cho `stripJpegMetadata`

`src/lib/shop/__tests__/imagePipeline.test.ts`, mở rộng test có sẵn, fixture khai báo inline theo đúng style hiện tại (không thêm file binary, không thêm helper):

1. JPEG có **nhiều** APP segment liên tiếp (ví dụ APP1 + APP13 + APP2) → tất cả bị loại, SOI + APP0/JFIF + segment cấu trúc + scan data giữ nguyên byte;
2. có **fill byte `FF FF`** trước marker → không crash, output đúng kỳ vọng;
3. segment khai báo `length < 2` (hoặc tràn khỏi buffer) → hàm trả về **đúng mảng đầu vào** (so sánh toàn bộ byte, không chỉ `length`), không throw.

## 3.5 PHỤ THUỘC — chỉ làm khi orchestrator bổ sung câu trả lời của PO

Hai mục dưới đây **chờ PO**. Chưa có câu trả lời thì **không tự chọn phương án**, chỉ ghi trạng thái vào report và làm trọn 3.1-3.4 trước.

**(A) Copy khi shop chưa kích hoạt** — `MediaEditor.tsx:517`. Câu hiện tại hứa ảnh tự lên khi shop được kích hoạt, nhưng `publish_profile` chỉ có một caller (`useProductMedia.ts:119`) chạy trong callback sau upload; không có trigger/cron nào bắn khi shop sang `active`. Chờ PO chọn (A) đổi copy — hoặc (B) thêm một `useEffect` publish một lần khi `active && verified_at && !public_path`. Chưa có trả lời: **không đổi copy, không thêm `useEffect`, không thêm auto-publish**.

**(B) Cách kiểm chứng trên trình duyệt cho vòng sau.** Chờ PO chọn giữa "Cuong tự đăng nhập + tự dán snippet DevTools, tester chỉ bấm và đọc DOM" và "đầu tư Playwright có seller test user". Chưa có trả lời: không đụng gì tới Playwright.

## 3.6 Ràng buộc giữ nguyên từ vòng 1

- **Ponytail:** không thêm file source mới nếu file cũ dùng được; không thêm dependency; không thêm lớp trừu tượng; không refactor ngoài phạm vi.
- **Không commit, không push, không mở PR.**
- Không đổi `verify_jwt`; không sửa edge function trong `supabase/functions/`; không viết/áp migration; không viết backfill.
- Shop UI đang **VI-only có chủ đích** (lệch chuẩn song ngữ đã được ghi nhận) — đừng "sửa" bằng cách thêm chuỗi EN.
- 4 gate bắt buộc trước khi báo xong, chạy đủ và ghi exit code từng lệnh: `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs`. Headroom CODE chỉ còn ~9 KB (1572.7/1800) — gate đỏ thì giảm diff, **cấm** nâng threshold.
- Báo cáo: `docs/build-feature/shop-publish-media-button/rounds/round2-report.md`. Không ghi bất kỳ PAT / service key / anon key / password nào.

## 3.7 Nội dung bắt buộc trong `round2-report.md`

1. Root cause của lỗi phân loại: product 422 vs profile 502, vì sao `status === 422` giết nhánh profile.
2. Danh sách file thay đổi (`git diff --stat`) + kết quả **red-proof hai chiều** (đỏ trước fix / xanh sau fix) cho 3 test ở 3.2.
3. Kết quả 4 gate, exit code từng lệnh, + xác nhận `AdminShopProductReview.publish.test.tsx` và case 422 `rendition_too_large` vẫn xanh.
4. Giới hạn kiểm chứng: vì sao vòng này không có bằng chứng trình duyệt (route cần seller session; tool của tester không chạy được JavaScript), và vì sao vitest + jsdom là tầng thay thế rẻ nhất.
5. Backlog Playwright kèm **điều kiện cần**: tạo seller test user + shop test, thêm role vào `tests/helpers/auth.ts`, chạy với `PLAYWRIGHT_BASE_URL` trỏ localhost (mặc định hiện tại là production), dùng `page.route` chặn `functions/v1/shop-media-lifecycle`.
6. **Rủi ro dữ liệu tồn đọng** (bắt buộc, không code vòng này): rendition JPEG đã nằm trong draft bucket **trước** bản sửa vẫn còn EXIF ⇒ bấm "Thử lại" gửi lại đúng byte cũ và vẫn fail vĩnh viễn. Không có backfill. Trước khi mở cho seller thứ hai phải chạy truy vấn đếm `shop_profile_media` có `verified_at IS NOT NULL AND public_path IS NULL` và xử lý từng row (backfill server-side hoặc chủ động bảo seller chọn lại ảnh).
7. Trạng thái hai mục PHỤ THUỘC A/B.
8. **Cấm** viết rằng tính năng "đã kiểm chứng trên trình duyệt" nếu thực tế không có session seller.

## 3.8 Acceptance criteria vòng 2 (kiểm chứng được)

1. 502 + `failed[0].error = "rendition_metadata_present"` → message chứa `"Thử chọn ảnh khác"`, code vẫn `"502 · rendition_metadata_present"`.
2. 502 + `failed[0].error = "copy_failed"` → message vẫn chứa `"Lỗi từ phía hệ thống"`.
3. 422 + `rendition_too_large` (đường publish sản phẩm) vẫn hoạt động y nguyên, test cũ xanh không sửa.
4. `MediaEditor.test.tsx` có case `FunctionsFetchError` + `response: undefined` → hiện câu mạng + dòng `Mã lỗi:` + nút `disabled === false`.
5. Có case 403 `JWT expired` → "Phiên đăng nhập đã hết hạn".
6. Có case 403 `permission denied…` → không lọt lên `role="alert"`, có ở dòng `Mã lỗi:`.
7. Có case 200 sau một lần lỗi → không còn `role="alert"`, không còn `"Mã lỗi:"`.
8. 3 edge case `stripJpegMetadata` xanh; case `length < 2` khẳng định trả về **đúng byte đầu vào**.
9. Red-proof hai chiều được dán vào report cho 3 test ở 3.2.
10. Diff vòng 2 chỉ chạm: `src/lib/shop/errors.ts`, `src/lib/shop/__tests__/errors.test.ts`, `src/components/shop/__tests__/MediaEditor.test.tsx`, `src/lib/shop/__tests__/imagePipeline.test.ts`, + `rounds/round2-report.md`. File nào ngoài danh sách này phải giải thích bằng bằng chứng trong report.
11. Không có Playwright spec mới, không có file source mới, không có dependency mới.
12. `npm run lint`, `npm run test`, `npm run build`, `node scripts/check-bundle-size.mjs` — cả 4 xanh.
13. Không commit, không push, không PR.

---

# 4. Việc chỉ Cuong làm được (chưa đổi so với vòng 1)

1. Chạy 2 lệnh cần service key/PAT: đọc byte rendition draft (đóng nốt mắt xích root cause) và `select proname, pronargs, proacl::text from pg_proc where proname like 'shop_profile_media_publish%';`.
2. Xoá user rác coder tạo trên prod: `delete from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';` (`publish-probe-1786962691@thepicklehub.net`).
3. Trả lời 2 câu hỏi PO ở mục 2.
4. Nghiệm thu iPhone (tiêu chí 8) sau khi bản này lên production.
