# 02 — Phản biện góc người dùng (critic-user) — bản cuối, đã cập nhật theo `02-po-answers.md`

## 0. Dữ kiện PO khép lại H1 — và mở ra một câu hỏi thiết kế lớn hơn

Kiểm chứng bằng code: hàm copy/giám định **dùng chung** cho cả hai nhánh — `copyRenditionToPublic` (`supabase/functions/shop-media-lifecycle/index.ts:85-134`) gọi ở `:163` (sản phẩm) và `:212` (profile), cùng `sniff` + `inspectJpeg` + `inspectWebp`. PO xác nhận ảnh sản phẩm up từ iPhone publish được bằng nút ⇒ **H1 (APP1/EXIF của iOS) chết vĩnh viễn**, không cần thử thêm. Bỏ luôn "fixture phải là bytes thật từ iPhone" (`01-task-analysis.md:68`) và câu hỏi mở về nới hàng rào GPS (`:98`).

Nhưng dữ kiện đó còn nói một điều bản phân tích chưa khai thác: **hai "nút publish" đó không cùng một trải nghiệm, thậm chí không cùng một người bấm.**

## 1. Bất đối xứng logo/bìa vs ảnh sản phẩm — đây mới là vết thiết kế

| | Ảnh sản phẩm | Logo / ảnh bìa |
|---|---|---|
| Ai bấm publish | **Cuong (admin)**, ngay sau khi duyệt sản phẩm — `useProductModeration.ts:142-166` | **Seller**, tự bấm trong Cài đặt shop — `MediaEditor.tsx:504-510` |
| Seller thấy gì | Không thấy gì cả. Duyệt xong ảnh lên. | Một nút lạ + một dòng trạng thái khó hiểu |
| Có bước người duyệt | Có (admin approve) | **Không** — `verified_at` là xác minh **máy**, set trong `shop_profile_media_finalize` (`20260811220000:386-409`) |
| Phiên đăng nhập lúc chạy | admin (aal2) | seller thường |
| RPC prepare | `product_publish_prepare` — cũ, chạy prod nhiều lần | `shop_profile_media_publish_prepare` — **mới toanh (`20260817090000`), chưa từng thành công lần nào từ trình duyệt** |

Từ góc seller, "tại sao ảnh sản phẩm không cần bấm gì mà logo lại cần?" **không có câu trả lời hợp lý**. Với ảnh sản phẩm, publish gắn vào một quyết định có thật (admin duyệt). Với logo/bìa **không có quyết định nào** — máy verify xong ngay trong lần bấm "Chọn ảnh". Code cũng tự hiểu vậy: publish **đã tự chạy** sau upload (`MediaEditor.tsx:427-432`). Cái nút chỉ là **retry của một bước tự động vừa chết**, nhưng đặt tên như bước bắt buộc. Ba tên cho một thứ trong 20 dòng: comment "Thử lại" (`:424-426`), dòng lỗi "Bấm thử lại" (`:500`), nhãn nút "Đưa lên trang shop" (`:509`).

Hệ quả: seller Wave 1 đọc là **"tôi làm thiếu bước"**, không phải **"hệ thống lỗi"** ⇒ tự trách mình, không báo Cuong. Kiểu lỗi im lặng nhất — và là lý do bug này chỉ lộ vì chính PO bấm.

**Đề nghị:** giữ nút (vẫn cần retry thủ công) nhưng đổi nhãn thành **"Thử lại"**, đổi câu trạng thái sang mô tả **hậu quả**. Hai chuỗi text, không phải refactor ⇒ gỡ khỏi "không đụng UI vừa ship #603" (`:70`).

**Defect chỉ lộ khi nhìn từ seller:** `publish_profile` publish **cả logo lẫn bìa cùng lúc** (prepare lấy mọi row verified — `20260817090000:70-71`; edge lặp `plan.copies` `index.ts:211-232`). Nhưng UI có **hai** `ProfileSlot`, mỗi cái một mutation riêng (`MediaEditor.tsx:422`). Nên: bấm nút dưới "Logo shop" cũng publish luôn ảnh bìa; nếu **bìa** hỏng thì response `ok:false` + **502** (`index.ts:234-237`) và **slot logo hiện lỗi dù logo đã lên thành công**. Khớp hoàn hảo với "nút không chạy" mà không cần iOS dính dáng. Hiện **không cách nào phân biệt** vì client vứt hết `failed[]` (`useProductMedia.ts:115`). Đáng thêm vào mục 4 của phân tích, hạng ngang H2/H3.

## 2. Thông báo lỗi: "hiện mã lỗi server" giúp dev, không giúp seller — giờ càng ít giúp

H1 chết ⇒ các mã `rendition_*` gần như chắc chắn **không phải** lỗi seller sẽ gặp. Lỗi thực tế sẽ rơi vào: message tiếng Việt của RPC prepare, 401, hoặc 404/PGRST202 nếu hàm mới chưa vào schema cache. Acceptance #4 đang lấy **ví dụ sai** làm chuẩn (`:87`).

Nghiêm trọng hơn: máy chủ **đã nói tiếng Việt rất chuẩn** và câu đó đang bị vứt. `shop_profile_media_publish_prepare` raise *"shop đang ở trạng thái pending_activation nên chưa đưa ảnh lên trang công khai được"* (`20260817090000:56-59`), edge trả nguyên văn `planError.message` (`index.ts:199`), client ném đi ở `useProductMedia.ts:115`.

Cách lười nhất vẹn cả hai: đọc `error.context` → lấy `message` / `failed[].error` → cho qua **`shopErrorMessage`** (`src/lib/shop/errors.ts:16-41`, vốn đã ưu tiên giữ nguyên message tiếng Việt của RPC). Hiển thị **hai dòng**: câu tiếng Việt to + dòng mờ "Mã lỗi: …" để chụp màn hình gửi Zalo. Không cần từ điển mã lỗi.

| Tình huống | Câu cho seller |
|---|---|
| Shop chưa kích hoạt / tạm ngưng (403, `20260817090000:56-59`, `:135-138`) | Giữ nguyên câu server + "Ảnh đã lưu, kích hoạt shop xong bấm lại là hiện." |
| Hết phiên đăng nhập (401, `index.ts:189`) | "Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm lại giúp em." + nút đăng nhập tại chỗ |
| Không gửi được (`FunctionsFetchError`) | "Không kết nối được máy chủ. Kiểm tra mạng (thử tắt/bật Wi-Fi) rồi bấm Thử lại." |
| Ảnh máy chủ không nhận (422 `rendition_*`) | "Ảnh này máy chủ chưa nhận được. Thử chọn ảnh khác, hoặc chụp màn hình ảnh này rồi chọn ảnh chụp màn hình." |
| Còn lại (409 / 502 / commit_failed / không rõ) | "Lỗi từ phía hệ thống, không phải do ảnh của anh/chị. Em đã nhận được báo lỗi rồi, bấm Thử lại sau vài phút." |

Dòng cuối quan trọng nhất về niềm tin: **"không phải lỗi của anh/chị"** + **"em đã nhận được báo lỗi"** (đúng — `reportCaughtError` sẽ bắn).

## 3. Kẹt vĩnh viễn: cần **cả** timeout **lẫn** lối thoát

`MediaEditor.tsx:489-513` là nhánh loại trừ: khi `publish.isPending` thì **chỉ** render dòng "Đang đưa ảnh lên trang shop công khai…" — không nút, không huỷ. Mutation không settle ⇒ seller kẹt tới khi tự nghĩ ra việc tải lại trang. Với seller không rành kỹ thuật, "vòng quay mãi" = **"app này hỏng"** — ấn tượng đầu tiên của Wave 1 về toàn bộ shop.

Yêu cầu tối thiểu: **quá ~30 giây thì trạng thái tự chuyển thành lỗi có nút Thử lại**, kèm "Lâu bất thường — có thể mạng yếu. Ảnh đã lưu, bấm Thử lại." **Acceptance bắt buộc**, đúng bất kể root cause, và là thứ duy nhất trong gói mà seller cảm nhận trực tiếp.

## 4. "Logo biến mất giữa chừng" — PO đã mở khoá thử nghiệm, rủi ro Wave 1 vẫn nguyên

PO cho phép tạo shop test riêng + up lại logo/bìa shop PO (`02-po-answers.md`) ⇒ **hạ mục này khỏi rủi ro thử nghiệm**, đừng để nó chặn agent. Nhưng nó là **hành vi sản xuất bình thường**:

`shop_profile_media_upload_init` khi thay ảnh xếp hàng xoá object công khai cũ rồi set **`public_path = NULL`, `verified_at = NULL`** trong cùng transaction (`20260811220000:314-342`). **Giây phút seller chọn ảnh logo mới, trang shop mất logo ngay**, trước cả khi ảnh mới xử lý xong. Publish hỏng ⇒ shop **không logo vô thời hạn**, phục hồi duy nhất là Cuong chạy script.

Với Wave 1: "tôi chỉ định đổi logo cho đẹp hơn, giờ shop tôi trắng trơn" ⇒ loại sự cố khiến 1 trong 3-5 người rời bỏ. Copy hiện tại *"Logo cũ sẽ được thay và thu hồi"* (`MediaEditor.tsx:451`) không nói được rằng trang shop **trống ngay lập tức**. Cần: confirm trước khi thay (dùng `useConfirm()` có sẵn) · trạng thái trung gian nói hậu quả ("Trang shop của anh/chị hiện đang KHÔNG có logo") · báo trước cho Cuong khi thử trên shop PO.

## 5. Cắt gì / thiếu gì

**Nên cắt:**
- Toàn bộ nhánh H1: fixture "bytes thật từ iPhone" (`:86`), câu hỏi mở #6 về nới GPS (`:98`), rủi ro riêng tư (`:76`). Chết bằng chứng cứ — cắt hẳn, không chỉ hạ ưu tiên.
- Acceptance #3 (dựng `supabase db reset` + local stack): H1 chết ⇒ giá trị còn lại thấp; PO đã cho phép **chạy end-to-end thật trên prod** bằng shop test — nhanh hơn và thật hơn. Giữ local chỉ khi prod-test không phân biệt được.

**Thiếu, và seller cần:**
- **Bẫy trạng thái shop:** `prepare` từ chối mọi shop khác `active` (`20260817090000:56-59`) trong khi UI chỉ gate theo **vai trò** (`SellerShopSettings.tsx:78`), không theo `shop.state`. Seller `pending_activation` up logo → auto-publish bắn ngay (`MediaEditor.tsx:430`) → 403 → bấm mãi. Với Wave 1 gần như **chắc chắn xảy ra**. Fix rẻ nhất: **không auto-publish khi shop chưa `active`** + *"Ảnh đã lưu. Sẽ tự hiện trên trang shop khi shop được kích hoạt."*
- **Link "Xem trang shop của tôi"** trong `SellerShopSettings` (không có link nào tới `/shop/<slug>`): trang công khai là sự thật duy nhất với seller.
- **Badge "đang hiển thị / chưa hiển thị"** đọc `row.public_path`: preview luôn lấy từ **draft** qua signed URL (`MediaEditor.tsx:438-439`) nên logo trông y hệt nhau dù đã lên hay chưa.
- **Ngôn ngữ:** bề mặt shop thuần tiếng Việt hardcode — ghi rõ là **lệch chuẩn song ngữ có chủ đích**.

## Chốt

1. **Cắt H1 khỏi tài liệu**, không chỉ hạ ưu tiên (`copyRenditionToPublic` dùng chung `:163`/`:212` + Q2 của PO). Bỏ fixture iPhone, rủi ro riêng tư, câu hỏi mở #6.
2. **Thêm mục "bất đối xứng hai luồng publish"**: sản phẩm do **admin** bấm sau khi duyệt; logo/bìa là **publish duy nhất seller tự bấm**, chạy dưới JWT seller qua RPC mới toanh chưa từng thành công từ trình duyệt.
3. **Đổi nhãn nút** `:509` → **"Thử lại"**; câu trạng thái `:495-497` → mô tả hậu quả. Gỡ khỏi "ngoài phạm vi".
4. **Thêm giả thuyết hạng ngang H2/H3: lỗi chéo slot** — bìa hỏng làm slot logo báo lỗi dù logo đã live (`20260817090000:70-71`, `index.ts:211-237` vs 2 mutation ở `MediaEditor.tsx:422`).
5. **Sửa acceptance #4**: bỏ `rendition_metadata_present (422)` làm ví dụ chuẩn; yêu cầu = câu tiếng Việt hành động được theo 5 nhóm, đi qua **`shopErrorMessage`** có sẵn, **+** dòng mờ "Mã lỗi: …".
6. **Thêm acceptance bắt buộc**: không trạng thái nào >30s mà không có nút bấm được.
7. **Thêm vào phạm vi**: không auto-publish khi `shop.state ≠ active`.
8. **Thêm 2 việc nhỏ giá trị cao**: link "Xem trang shop của tôi"; badge đang/chưa hiển thị.
9. **Chuyển "logo biến mất" sang rủi ro sản phẩm Wave 1**: confirm trước khi thay + copy nói rõ hậu quả. Thử nghiệm không còn bị chặn (PO đã cho phép), chỉ cần báo trước + dọn dữ liệu test.
10. **Hạ acceptance #3** (local stack) xuống dự phòng; ưu tiên end-to-end thật bằng shop test trên prod.
11. **Ghi rõ shop UI là VI-only có chủ đích.**
