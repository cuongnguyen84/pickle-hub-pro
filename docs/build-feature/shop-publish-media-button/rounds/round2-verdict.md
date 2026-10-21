# Vòng 2 — Verdict (Bước A review + Bước B kết luận, gộp một lượt)

Nguồn: `round2-prompt.md` (17 AC) · `round2-coder-report.md` · review độc lập của Codex CLI (`codex exec`, 17.9k token) · **kiểm chứng lại của prompt-engineer** (4 gate tự chạy + 4 phép thử tự viết).
PO đã chốt vòng này `tester` **không mở Chrome** ⇒ không có Bước B riêng, bằng chứng thay thế là test component.
Vòng đã dùng: **2/6**.

---

# 1. VERDICT: **ĐẠT**

Code review đạt, không có phát hiện chặn ship nào **sau khi tôi tự kiểm lại từng claim của Codex bằng phép thử chạy được**. Codex kết luận CHƯA ĐẠT với 3 mục "CHẶN SHIP"; tôi **bác 2, giữ 1 ở mức NÊN SỬA** — chi tiết và bằng chứng ở §3. Không mục nào trong 17 AC bị vi phạm.

Nói rõ giới hạn ngay từ đầu: **ĐẠT ở đây = đạt các AC kiểm chứng được bằng vitest + jsdom + 4 gate.** Không ai mở trình duyệt vòng này, và bug gốc (iPhone Safari trên production) **vẫn chưa được đo lại trên thiết bị thật** — đó là việc của Cuong ở §6.

---

# 2. Cái tôi tự chạy (không lấy từ báo cáo coder)

**4 gate — tất cả exit 0, tôi chạy lại từ đầu trong worktree:**

| Lệnh | Exit | Kết quả tôi đọc được |
|---|---|---|
| `npm run lint` | 0 | 0 error, 30 warning có sẵn |
| `npm run test` | 0 | 189 file · 2874 pass · 10 skip · **0 fail** |
| `npm run build` | 0 | built in 5.74s |
| `node scripts/check-bundle-size.mjs` | 0 | INITIAL 227.3/280 · **CODE 1574.2/1800** · CONTENT 405.6/600 |

(CODE tôi đo 1574.2, coder ghi 1574.0 — lệch 0.2 KB, dưới ngưỡng, không đáng bàn. Threshold **không** bị nâng: `git diff` không chạm `scripts/check-bundle-size.mjs`.)

**4 phép thử tôi tự viết để bắt "nhận công gian" — không phép nào lấy từ report:**

1. **Red-proof §1 làm lại từ đầu.** Tôi khôi phục `if (status === 422 && detail.startsWith("rendition_"))` trong `src/lib/shop/errors.ts` rồi chạy 2 file test → **đúng 2 test đỏ**: `errors.test.ts > pulls the reason out of failed[]…` và `MediaEditor.test.tsx > says what the worker actually refused…`. Case 422 `rendition_too_large` (đường sản phẩm) **vẫn xanh** trong lần đỏ đó ⇒ fix không nới bừa. Đã khôi phục file (`git diff --stat` trả đúng 91 dòng như trước).
2. **Red-proof nút thử lại phải sống qua F5.** Tôi đổi gate nút từ `pendingMedia` (dữ liệu server) sang `publishError` (state RAM — đúng bản nháp Codex đã bị bác ở vòng 1) → **case 6 "still offers the button on a fresh page load" đỏ**, 16 test còn lại xanh. Test này bảo vệ đúng thứ nó nói là bảo vệ.
3. **Kiểm bẫy mock `then` (bẫy tôi cảnh báo ở vòng trước).** Tôi gỡ `then` khỏi mock `shopFrom` → **4 test đỏ**, đúng 4 tên coder liệt kê trong red-proof §3. Mock thenable là **load-bearing**, không phải trang trí; con số "4 failed | 13 passed" trong report khớp chính xác với cái tôi đo được.
4. **Bẫy mock `vi.mock("@/integrations/supabase/client")`.** Cần thật: `client.ts` throw khi thiếu env lúc load. Mock chỉ thay `functions.invoke` — đường code production (`useProductMedia` → `edgeErrorMessage(error, response)` → `edgeError`) vẫn chạy thật, kể cả `await response.text()` trên `Response` thật do test dựng. Không che đường thật.

---

# 3. Đối chiếu với review của Codex — đồng ý / bác, kèm bằng chứng

| Codex nói | Mức Codex gán | Kết luận của tôi | Căn cứ |
|---|---|---|---|
| `pendingMedia` là closure chụp trước 2 lần `await` ⇒ media về muộn thì auto-publish không chạy | CHẶN SHIP | **ĐỒNG Ý là có thật, BÁC mức "chặn ship" → NÊN SỬA (vòng sau)** | Tôi viết probe tạm: giữ query `shop_profile_media` pending, bấm Kích hoạt, thả query sau khi activate resolve → `functions.invoke` **0 lần** ⇒ race có thật. Nhưng cùng probe đó khẳng định **nút "Đưa ảnh lên trang shop" hiện ra ngay sau khi query về** ⇒ không có trạng thái kẹt, không mất dữ liệu, admin bấm 1 nút là xong. Cửa sổ race trong thực tế: query 2 row chạy lúc mount, còn admin phải đọc hồ sơ + chọn hình thức xác minh + bấm + xác nhận dialog. |
| `disabled={publish.isPending}` không chống được double-click, cần single-flight guard | CHẶN SHIP | **BÁC — sai** | Tôi viết test tạm bắn **3 `fireEvent.click` liên tiếp trong cùng một tick** vào nút thử lại với request không bao giờ settle → `functions.invoke` được gọi **đúng 1 lần** (18/18 pass). React 18 flush đồng bộ discrete event, `isPending` bật trước khi click thứ 2 được dispatch, jsdom không dispatch onClick lên button `disabled`. Đây cũng đúng pattern `AdminShopProductReview` đang chạy production. |
| Test thứ tự dùng `invocationCallOrder` là xanh giả: chỉ chứng minh gọi trước, không chứng minh đã resolve xong | CHẶN SHIP | **BÁC ở mức chặn ship, ĐỒNG Ý assertion yếu** | Codex không thấy test kề bên: *"does not publish when the activation itself failed"* mock `shop_activate` **reject** và khẳng định `functions.invoke` **không** được gọi. Nếu code chạy song song hoặc chạy trước, test đó đỏ. Hai test cộng lại phủ đúng ca Codex lo. Code thật đọc lên cũng là `await activate.mutateAsync()` → `catch { setError; return }` → `if (pendingMedia) await publishNow()`, tuần tự thuần. |
| Test "clears the line when it works" có thể xanh sớm vì `setPublishError(null)` chạy ngay đầu `publishNow` | NÊN SỬA | **ĐỒNG Ý — NIT** | Đúng, và lỗi tương tự ở `MediaEditor` (dòng lỗi bám `publish.isError`, mà `isError` về false ngay khi mutation sang pending). Hành vi production vẫn đúng (thất bại thì dòng lỗi hiện lại); chỉ là test không phân biệt được "biến mất vì đang chạy" với "biến mất vì thành công". AC7/AC (retry) chỉ đòi đúng cái test đang đo ⇒ không vi phạm AC. |
| `publishError` nằm lồng trong `{pendingMedia && …}` nên có thể bị ẩn cùng nút | NÊN SỬA | **ĐỒNG Ý — NIT, rủi ro thấp** | Publish thất bại ⇒ row vẫn `verified_at != null, public_path == null` ⇒ `pendingMedia` vẫn true. Query lỗi thì react-query giữ `data` cũ. Ca duy nhất mất dòng lỗi là ca lỗi đã tự khỏi. |
| Mock builder bỏ qua `select/eq` nên không chứng minh query lọc đúng `shop_id` | NÊN SỬA | **ĐỒNG Ý — NIT có chủ đích** | Đúng, nhưng đây là test nối dây, không phải test query. Query `.eq("shop_id", shopId)` được `MediaEditor.test.tsx` và pgTAP phủ ở tầng khác. |
| (a) `rendition_source_missing` (409) nay hiện "Thử chọn ảnh khác" | CHẤP NHẬN | **CHẤP NHẬN** | Source đã mất khỏi bucket ⇒ retry cùng byte không bao giờ cứu được; "chọn ảnh khác" là lối thoát duy nhất đúng. Đúng tinh thần fix. |
| (b) media chưa resolve ⇒ auto-publish không chạy | BÁC, chặn ship | **NÊN SỬA vòng sau, không chặn ship** | Xem dòng đầu bảng — có bằng chứng nút vẫn hiện. |
| (c) lỗi publish ở trang admin không gọi `reportCaughtError` | BÁC, nên sửa | **ĐỒNG Ý — NÊN SỬA (nhỏ)** | Phía seller có report, phía admin không ⇒ lỗi publish do admin gây ra sẽ không vào telemetry. Không AC nào đòi; ghi vào backlog. |

**Một điểm cả Codex lẫn coder đều không nêu, tôi bổ sung (NIT):** dòng lỗi phía admin dùng `shopErrorMessage(e)`. Tôi đã đối chiếu từng chuỗi: cả 4 câu do `edgeErrorMessage` sinh ra **đều** chứa ký tự trong regex `VIETNAMESE` của `shopErrorMessage` ⇒ đi qua nguyên văn, không rò chuỗi Postgres thô. Nhưng nếu sau này thêm câu tiếng Việt **không dấu khớp regex**, nó sẽ âm thầm rơi về "Không lưu được. Thử lại giúp em.". Dùng thẳng `(e as Error).message` sẽ chắc hơn. Ngoài ra admin **không** thấy dòng `Mã lỗi:` (seller thì có) — prompt không yêu cầu, nhưng khi Cuong tự nghiệm thu thì đây là dòng đáng có.

---

# 4. Bảng đối chiếu 17 acceptance criteria vòng 2

Ba loại: **đã chứng minh** · **chưa chứng minh được** (ai chứng minh được) · **sai thật**.

| # | Tiêu chí | Kết quả | Loại | Căn cứ |
|---|---|---|---|---|
| 1 | 502 + `rendition_metadata_present` → "Thử chọn ảnh khác", code `502 · rendition_metadata_present` | ĐẠT | đã chứng minh | Tôi red-proof lại: khôi phục điều kiện 422 → đúng test này đỏ |
| 2 | 502 + `copy_failed` → vẫn "Lỗi từ phía hệ thống" | ĐẠT | đã chứng minh | Test có trong `errors.test.ts`; coder red-proof chiều ngược bằng cách gỡ prefix guard → 3 test đỏ |
| 3 | 422 + `rendition_too_large` vẫn y nguyên | ĐẠT | đã chứng minh | Xanh cả trong lần tôi cố tình phá `errors.ts` lẫn suite đầy đủ |
| 4 | `FunctionsFetchError` + `response: undefined` → câu mạng + `Mã lỗi:` + nút `disabled === false` | ĐẠT | đã chứng minh | Case *"leaves a pressable button when the 20s timeout fires"* |
| 5 | 403 `JWT expired` → "Phiên đăng nhập đã hết hạn" | ĐẠT | đã chứng minh | Case *"names an expired session…"* |
| 6 | 403 `permission denied…` không lọt `role="alert"`, có ở `Mã lỗi:` | ĐẠT | đã chứng minh | Case *"keeps Postgres' English out of the sentence…"* — assert cả hai chiều |
| 7 | 200 sau một lần lỗi → hết `role="alert"`, hết `Mã lỗi:` | ĐẠT (assertion yếu) | đã chứng minh | Case có, đo đúng cái AC đòi; xem NIT ở §3 về khả năng xanh sớm |
| 8 | 3 edge case `stripJpegMetadata`; case `length < 2` trả **đúng byte đầu vào** | ĐẠT | đã chứng minh | 3 case: run APP1+APP13+APP2 (so sánh **toàn mảng byte** + `inspectJpeg` 64×64), fill byte `FF FF`, `len < 2` → `expect(out).toBe(broken)` **và** so byte đầy đủ |
| 9 | Activate xong → gọi `publish_profile`, đúng payload, có test thứ tự | ĐẠT | đã chứng minh | Payload khẳng định đủ `{action, shop_id}` + `timeout: 20_000`; thứ tự khẳng định bằng `invocationCallOrder` + test "activate lỗi thì không publish" (xem §3) |
| 10 | Activate lỗi → không publish; publish lỗi → activate vẫn thành công | ĐẠT | đã chứng minh | 2 test riêng; test thứ hai khẳng định thêm nút "Kích hoạt shop" **không** hiện lại |
| 11 | Không có ảnh chờ → không gọi, không lỗi, không nút | ĐẠT | đã chứng minh | Case *"says nothing and calls nothing when there is no photo waiting"*, assert cả 3 vế |
| 12 | Nút hiện sau khi **mount lại trang** | ĐẠT | đã chứng minh | Tôi tự red-proof: đổi gate sang state RAM → đúng case này đỏ |
| 13 | Red-proof hai chiều dán vào report | ĐẠT | đã chứng minh | Có trong report; tôi tái lập độc lập 2/2 chiều và ra đúng con số |
| 14 | Diff vòng 2 chỉ chạm 6 file source/test | ĐẠT | đã chứng minh | So `git diff --stat` hiện tại với stat vòng 1 trong `round1-coder-report.md`: `MediaEditor.tsx` 94→94, `useProductMedia.ts` 19→19, `useProductModeration.ts` 8→8, `imagePipeline.ts` 91→91, `SellerShopSettings.tsx` 1→1, **`shop.css` 4→4 (không đụng, đúng lệnh cấm)**. Chỉ tăng: `MediaEditor.test.tsx` 115→210, `imagePipeline.test.ts` 84→154, `errors.ts` 86→91, + 2 file admin mới sửa |
| 15 | Không Playwright spec / file source / dependency / migration mới | ĐẠT | đã chứng minh | `git status --porcelain -- supabase/` → **rỗng**; `git diff --stat -- package.json package-lock.json` → **rỗng**; untracked chỉ có `docs/build-feature/` + `src/lib/shop/__tests__/errors.test.ts` (file vòng 1) |
| 16 | 4 gate xanh | ĐẠT | đã chứng minh | Tôi tự chạy, bảng ở §2 |
| 17 | Không commit / push / PR | ĐẠT | đã chứng minh | `git log --oneline -1` = `8f833e5a` (merge #603 từ main), không có commit mới trên `fix/shop-publish-media-button` |

**Tổng: 17/17 ĐẠT.** 0 sai thật. 0 chưa chứng minh **trong phạm vi AC vòng 2**.

## 8 tiêu chí gốc (vòng 1) — trạng thái hiện tại

| # | Tiêu chí gốc | Vòng 1 | Vòng 2 | Ghi chú |
|---|---|---|---|---|
| 1 | Bằng chứng root cause | chưa chứng minh | **chưa chứng minh** | D3–D7 vẫn cần PAT/service key; vòng 2 bù bằng test import thẳng `inspectJpeg` của worker: JPEG kiểu WebKit → `{ok:false, reason:"metadata_present"}`, sau `stripJpegMetadata` → `{ok:true, 2048×1536}`. Đây là mắt xích mạnh nhất có thể có mà không chạm prod, nhưng **không** thay được một lần publish thật |
| 2 | Red-proof `edgeErrorMessage` | đạt có điều kiện | **ĐẠT** | Điều kiện đã gỡ: test giờ khoá đúng hành vi đúng |
| 3 | `publish_profile` trả 200 thật trên prod | chưa chứng minh | **chưa chứng minh** | Chỉ Cuong đo được, sau khi deploy |
| 4 | Đường quan sát lỗi | **SAI** | **ĐÃ SỬA** | Lỗi chặn ship của vòng 1 đã đóng, có red-proof do tôi tái lập |
| 5 | Không hồi quy publish sản phẩm | đạt | **ĐẠT** | Suite đầy đủ 2874 pass; `AdminShopProductReview.publish.test.tsx` xanh |
| 6 | Không trạng thái nào treo >30s không có nút | nửa chưa chứng minh | **ĐẠT ở tầng code** | Case timeout nổ đã có, nút `disabled === false`. UI thật: chưa đo |
| 7 | 4 gate | đạt | **ĐẠT** | Tôi tự chạy lại |
| 8 | Nghiệm thu iPhone | chưa chạy | **chưa chạy** | Xem §6 |

---

# 5. Bất đồng đáng ghi lại giữa 3 nguồn

- **Codex vs tôi:** Codex ra CHƯA ĐẠT, tôi ra ĐẠT. Khác biệt nằm ở 2 mục Codex gán CHẶN SHIP mà tôi phản chứng được bằng test chạy thật (double-click và test thứ tự). Đây đúng là lý do quy trình bắt buộc **xác minh claim của Codex chứ không chép**: Codex không đọc được repo nên không biết `AdminShopProductReview` đang chạy production với đúng pattern `disabled={isPending}`, và không thấy test kề bên phủ ca chạy song song.
- **Codex vs coder:** cả hai đều nêu race `pendingMedia`; coder tự khai và tự lập luận chấp nhận được, Codex gọi là chặn ship. Tôi đứng giữa: có thật, đã đo được, nhưng có mạng lưới hứng (nút hiện theo dữ liệu server) ⇒ để vòng sau.
- **coder vs prompt:** §6 (xoá auth user rác trên prod) **không làm** — coder ghi "bỏ qua theo chỉ đạo". Không nằm trong 17 AC nên không ảnh hưởng verdict, nhưng **món nợ vẫn còn trên production**, chuyển sang §6 dưới đây.
- **Không có `tester`** vòng này theo quyết định PO ⇒ **không** được đọc verdict này thành "đã kiểm chứng trên trình duyệt". Không ai mở trình duyệt.

---

# 6. Việc Cuong phải tự làm

### (a) Xoá auth user rác trên production — **CÒN NGUYÊN, chưa ai xoá**

Vòng 1 agent tạo user thật khi điều tra: `publish-probe-1786962691@thepicklehub.net` / `0bbe10dc-b091-41f5-a448-473e3c997d99`. Chạy qua Supabase Management API query endpoint với PAT trong `~/Downloads/secrets.local.md` (agent bị permission system chặn đọc file này):

```sql
delete from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';
select count(*) from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';  -- phải trả 0
```

Nhân tiện chạy luôn câu còn nợ từ vòng 1 (xác nhận GRANT của RPC publish):

```sql
select proname, pronargs, proacl::text from pg_proc where proname like 'shop_profile_media_publish%';
```

### (b) 🔴 Rủi ro dữ liệu tồn đọng — rendition cũ còn EXIF thì **fail vĩnh viễn**, bản sửa không cứu được

Bản sửa nằm ở **client, lúc upload** (`stripJpegMetadata`). Mọi rendition JPEG đã nằm sẵn trong draft bucket **trước** khi bản này lên production vẫn còn EXIF nguyên vẹn. Bấm "Đưa ảnh lên trang shop" chỉ gửi lại **đúng byte cũ** ⇒ worker vẫn trả `rendition_metadata_present` ⇒ 502, mãi mãi. **Không có backfill, và vòng này cấm viết backfill.**

Đếm trước, xử lý sau — chạy **trước khi mở Wave 1**:

```sql
-- 1. Logo/cover đang mắc kẹt: đã verified nhưng chưa bao giờ lên public bucket
select id, shop_id, purpose, version, content_type, byte_size,
       rendition_source_path, verified_at, updated_at
from public.shop_profile_media
where verified_at is not null
  and public_path is null
order by updated_at;

-- 2. Bao nhiêu row, và bao nhiêu là JPEG (chỉ JPEG mới dính EXIF từ WebKit)
select content_type, count(*) filter (where public_path is null) as stuck, count(*) as total
from public.shop_profile_media
where verified_at is not null
group by content_type;

-- 3. Cùng vết thương ở đường sản phẩm
select count(*) from public.product_media
where verified_at is not null and public_path is null;
```

Cách xử lý từng row mắc kẹt (chọn 1):
- **Rẻ nhất, khuyến nghị:** bảo seller vào `/seller/settings` **chọn lại đúng tấm ảnh đó** và upload lại — lần này client strip EXIF trước khi gửi, publish sẽ chạy. Với Wave 0 chỉ có 1 shop nên đây là 1 tin nhắn Zalo.
- Hoặc xoá row (`shop_profile_media_delete`) rồi để seller upload mới.
- **Đừng** thử "publish lại cho chắc": byte không đổi thì kết quả không đổi, chỉ tốn 502.

Sau bản sửa, mã lỗi tự khai tên: nếu Cuong thấy `502 · rendition_metadata_present` thì đó **chính là** row tồn đọng loại này, không phải bug mới.

### (c) Nghiệm thu thật trên iPhone Safari sau khi lên production — **đây là tiêu chí gốc số 8, chưa ai đo**

Không agent nào làm được: không có Chrome/Safari thật, không có session seller, dev server của worktree lại nối **thẳng Supabase production** (thao tác thử sẽ xoá logo thật của shop PO).

Kịch bản tối thiểu, làm đúng thứ tự:
1. `/seller/settings` trên **iPhone Safari** (không phải Chrome máy tính) → Logo & ảnh bìa → chọn **ảnh mới** từ thư viện ảnh iPhone.
2. Kỳ vọng: upload xong, publish chạy tự động, **không dòng đỏ nào**, dòng "Trang shop hiện chưa có logo" biến mất.
3. Mở `/shop/store/<slug>` bằng tab ẩn danh → logo/ảnh bìa hiện thật.
4. Nếu vẫn lỗi: chụp **cả dòng `Mã lỗi:`** — nó tự khai loại lỗi (`502 · rendition_metadata_present` = ảnh; `403 · permission denied for function …` = GRANT; `502 · copy_failed` = worker).
5. **Đường admin (mới ở vòng này, chưa ai bấm thật):** vào `/admin` → hồ sơ shop đang `pending_activation` **đã có logo verified** → bấm "Kích hoạt shop" → kỳ vọng ảnh tự lên trang shop, không cần bấm gì thêm. Nếu ảnh không lên **và cũng không thấy nút "Đưa ảnh lên trang shop"** thì nghi ngay quyền đọc `shop_profile_media` của admin (policy cho `is_admin()`, mà `is_admin()` đòi phiên **aal2** — vào `/admin` qua `AdminMFAGate` là có, nhưng chưa ai xác nhận trên prod). Ca hỏng đó **im lặng**: không có nút, không có lỗi.
6. Kiểm tay tap target / bố cục nút mới trên màn hình hẹp — máy không đo được cảm nhận này.

### (d) `shop-media-lifecycle` **KHÔNG đổi** ⇒ **không cần deploy edge function**

Tôi xác nhận bằng lệnh, không theo trí nhớ:
- `git status --porcelain -- supabase/` → **rỗng** (0 dòng)
- `git diff --stat -- supabase/` → **rỗng**

Toàn bộ diff 2 vòng nằm trong `src/**` + `docs/**`. Không migration, không edge function, không `supabase/config.toml`. ⇒ Chỉ cần merge + để Cloudflare Pages deploy. **Không** chạy `supabase functions deploy`.

*Một lưu ý kỹ thuật:* `src/lib/shop/__tests__/imagePipeline.test.ts` **import** `inspectJpeg` từ `supabase/functions/shop-media-lifecycle/jpeg.ts` (chỉ đọc, chỉ trong test — cố ý, để bytes client sinh ra được chấm bằng đúng hàm đã từ chối chúng trên production). Import này **không** kéo file edge nào vào bundle production: `npm run build` xanh và bundle CODE chỉ +1.5 KB, toàn bộ đến từ nhánh publish trong trang admin.

---

# 7. Backlog (không làm vòng này, có điều kiện cần rõ ràng)

1. **Đóng race `pendingMedia`** — đọc row từ cache/refetch **tại thời điểm gọi** thay vì boolean chụp lúc render, kèm test: giữ query media pending → bấm activate → thả query → publish vẫn phải chạy. (Tôi đã có sẵn probe dựng được ca này.)
2. **`reportCaughtError` cho lỗi publish phía admin** — hiện chỉ phía seller có; lỗi admin gây ra không vào telemetry, trong khi câu thông báo lại nói "Em đã nhận được báo lỗi rồi".
3. **Dòng `Mã lỗi:` ở trang admin** — admin đang chỉ thấy câu tiếng Việt, mất mã để chụp màn hình.
4. **Siết 2 assertion yếu**: "clears the line when it works" (cả admin lẫn `MediaEditor`) nên chờ request thứ 2 settle rồi mới khẳng định dòng lỗi biến mất.
5. **Playwright cho luồng shop** — điều kiện cần: tạo seller test user + shop test có media verified · thêm role seller vào `tests/helpers/auth.ts` · `PLAYWRIGHT_BASE_URL` trỏ localhost (mặc định hiện **trỏ production**) · `page.route` chặn `functions/v1/shop-media-lifecycle`. Cần PO duyệt vì phải mint session bằng service-role key.
