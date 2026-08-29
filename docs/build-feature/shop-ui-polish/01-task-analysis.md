# Phân tích công việc — Vòng UI polish khu Shop

## 1. Tóm tắt ý tưởng

Cuong (PO) vừa tự onboard end-to-end trên production bằng iPhone và kết luận giao diện khu Shop "quá xấu": nội dung đúng nhưng trình bày khô, toàn hộp text xám, thumbnail sản phẩm chỉ là ô chữ "1 ẢNH". Vòng này là **polish thị giác** trên toàn bộ bề mặt Shop (seller-facing, buyer/public, admin) — không đổi luồng nghiệp vụ đã acceptance — và phải xong **trước khi mời 3-5 seller Wave 1**, vì đây là ấn tượng đầu tiên của họ.

## 2. Mục tiêu / bài toán cần giải

Shop pilot đã đúng về chức năng, an toàn (RLS, AA, touch target đều đã qua audit) nhưng được xây theo tư duy "prototype được promote lên production" — mọi thứ là card xám + notice xám + text 13-14px, không có điểm nhấn thị giác, không có ảnh thật. Bài toán: nâng cảm nhận "hiện đại, đáng tin" cho seller Wave 1 và người mua đầu tiên, mà không phá bất kỳ ràng buộc kỹ thuật nào (bundle, AA, coverage, acceptance).

## 3. Khảo sát hiện trạng từng bề mặt (worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-ui-polish`)

**`/shop/sell` — SellLanding** (`src/pages/shop/SellLanding.tsx`): đúng như PO mô tả. Trang là **một cột 760px (`tl-shop-page--narrow`) chứa 6 khối xám xếp dọc giống hệt nhau**: 3 card requirement + 4 section (Giấy tờ / Duyệt / Phí / Huy hiệu) đều render bằng cùng một class `tl-shop-notice` — cùng nền `--tl-surface`, cùng border, cùng cỡ chữ 13.5px. Không có hero, không hình ảnh, không phân cấp giữa "checklist cần chuẩn bị" và "ghi chú phụ về phí". CTA chính chỉ là một nút giữa dòng với inline style `margin: "20px 0 28px"`. Landing thuyết phục người bán mà thị giác ngang một trang FAQ.

**`/seller` — SellerHome**: "dashboard" thực chất là **1 notice + 1 card DefList 5 dòng label/value + 1 card văn xuôi**. Không có con số nào (số sản phẩm theo trạng thái đã có sẵn hook `useProductStatusCounts` ở màn Products nhưng dashboard không dùng). Link sang trang shop công khai chôn trong một câu văn.

**`/seller/products` — SellerProducts**: điểm xấu nhất là component `Thumb` (dòng 404-415) — **ô placeholder chữ "N ảnh" font mono uppercase hoặc icon ImageOff**, không bao giờ hiển thị ảnh thật vì ảnh nằm ở bucket draft private và chưa ai mint signed URL (comment ghi rõ). Vùng filter dày đặc: search + 6 chip trạng thái + 2 select, khoảng cách toàn inline style rời rạc. Cấu trúc table/card responsive thì tốt.

**Form sản phẩm — SellerProductForm** (**1390 dòng**): bề mặt lớn nhất khu seller, stepper + autosave + variant editor + media editor. Có 3 file test hành vi (save / lifecycle / draft-recovery) — polish ở đây rủi ro chạm logic cao nhất.

**`/shop` — ShopHome**: h1 text trần + search + chip ngành hàng + grid "Mới đăng". Không hero là **quyết định có chủ đích** (comment đầu file: card sản phẩm phải lộ trên fold ở 320px — acceptance B01) — polish không được đổi thành hero to. Cái khô là phần đầu trang thuần chữ, và grid gần trống trong pilot nên empty state chiếm phần lớn màn.

**PDP + `/shop/store/:slug`**: cấu trúc PDP khá ổn (grid 2 cột, gallery, sticky media desktop). ShopStore đầu trang chỉ có **h1 + card DefList** — shop không có avatar/logo, không ảnh bìa, nên trang shop công khai của seller "đã xác minh" trông như trang settings.

**Admin queue** (5 màn): `AdminShopFrame` (sidebar riêng của Shop) lồng **bên trong** `AdminLayout` (đã có sidebar 18 mục) → khung kép, nhiều lớp chrome. Bảng dữ liệu eyebrow mono + table xám. Xấu nhưng chỉ 1 người dùng.

**Xuyên suốt:** (a) `shop.css` (~1370 dòng) rất kỷ luật — toàn token, đầy comment ghi lại defect đã sửa (touch target 44px, min-width:0, light-mode ink flip, chip count…) — polish phải giữ nguyên các fix này; (b) TSX lạm dụng **inline style** cho spacing/layout thay vì class → polish sẽ rải qua nhiều file nhỏ; (c) mọi màu mới bắt buộc alias token The Line (gate cấm raw hex ngoài block token).

## 4. Phạm vi đề xuất (chia tier)

**Tier 1 — seller-facing (ưu tiên, chặn Wave 1).** SellLanding, SellerHome, SellerProducts, SellerProductForm, SellerApplication + Status, SellerShopSettings. Hướng: phân cấp lại thị giác (thoát "mọi thứ là notice xám"), dashboard có con số, form dễ thở hơn. Độ lớn: **6-7 màn + shell**, riêng form 1390 dòng tách bước riêng; ~60% khối lượng.

**Tier 2 — buyer/public.** ShopHome, ShopSearch/ShopCategory (dùng chung `CatalogResults`), ProductDetail, ShopStore. Cấu trúc đã khá; việc chính là nhận diện thị giác đầu trang, card sản phẩm, bộ mặt trang shop công khai. ~30%.

**Tier 3 — admin (1 người dùng).** 5 màn dùng chung `AdminShopFrame` — chỉ sửa ở tầng frame/CSS chung, không polish từng màn. ~10%, có thể cắt nếu vòng phình.

**Out of scope:** bulk approve (PO đã hoãn), thay đổi luồng nghiệp vụ/copy đã acceptance, thêm thư viện UI, đổi token The Line tầng gốc, indexing/SEO catalog (noindex chờ PO), cart/đơn hàng.

## 5. Ràng buộc cứng

- **Bundle headroom ~13.6 KB gz** (gate `check-bundle-size.mjs`): gần trung tính bundle → chỉ CSS/markup/reorganize, cấm thư viện UI hay icon set mới; lucide có sẵn.
- **Token AA đã retune (`aed296ab`) — cấm hạ contrast.** `shop.css` có assertion trong `src/styles/__tests__/contrast.test.ts` (INK_ON_FILL); mọi màu mới qua cùng phép đo.
- **Coverage ≥83%**; 3 test hành vi SellerProductForm + `SellerHome.copy.test.tsx` (đổi copy sẽ đỏ) phải xanh nguyên trạng.
- **Không đổi hành vi đã acceptance** (12/12 TC P2b, Wave-0 fixes): polish = markup/CSS, không đổi state machine, không đổi query (trừ khi được chốt riêng — xem Q1/Q3).
- **VI-first**; seller + admin VI-only — giữ nguyên.
- Bất biến responsive/a11y đã trả giá mới có: touch target 44px thật, `[data-mobile-only]`/`[data-desktop-only]` không đè bằng inline display, min-width:0 cho grid con, scroll ownership (mỗi trang tự sở hữu scroller).

## 6. Rủi ro / điểm cần cẩn thận

- **"Polish" phình thành redesign.** SellLanding + SellerHome khô đến mức dễ bị cám dỗ viết lại cả trang. Cần định nghĩa "xong" theo từng màn trước khi code; ux-designer phải dùng skill `hallmark`.
- **Visual CI**: repo có `visual.yml` + `visual-baseline.yml` — vòng này cố tình đổi pixel nên **mọi baseline khu shop sẽ đỏ**; cập nhật baseline MỘT LẦN cuối vòng, không update từng commit (che regression).
- **Regression các fix đã ghi sổ**: shop.css là "bảo tàng defect đã sửa" — refactor mạnh tay có thể hồi sinh đúng những bug đó; ưu tiên thêm/điều chỉnh thay vì viết lại block.
- **Inline style rải rác trong TSX**: dọn về class đúng hướng nhưng diff to, đụng nhiều file — tăng khả năng đụng test/coverage.
- **Thumbnail thật SellerProducts** — cân nhắc nhất: vừa là món "xấu" rõ nhất, vừa **không phải việc CSS** (bucket draft private, cần mint signed URL — đường data mới chạm policy storage đã qua pgTAP; bài học "RLS không lọc CỘT" + storage test giả xanh). Khuyến nghị: hạng mục riêng có test riêng trong tier 1, hoặc tách PR sau — không trộn vào commit CSS.
- ShopHome: acceptance B01 (card đầu lộ trên fold 320px) là ràng buộc ngầm dễ phá nếu phần đầu trang to hơn.

## 7. Câu hỏi mở

1. **Thumbnail thật SellerProducts**: trong vòng này (hạng mục riêng) hay tách PR sau? Nếu trong: chấp nhận thêm đường signed-URL cho bucket private?
2. **Shop công khai có avatar/logo không?** Schema public (`shop_public_shop`) không lộ trường ảnh — muốn logo là việc data + upload + duyệt, vượt "polish". Chấp nhận trang shop không ảnh trong vòng này?
3. **SellerHome thêm số liệu** (đếm sản phẩm theo trạng thái — hook có sẵn)? Chỉ thêm read, không đổi luồng — đề nghị coi là trong phạm vi, critics xác nhận.
4. **Tier 3 (admin) làm ngay hay cắt** nếu tier 1+2 chạm trần?
5. **"Hiện đại" theo chuẩn nào** — PO có ảnh tham chiếu (Shopee seller center? marketplace cụ thể?) hay giao toàn quyền hallmark audit? Không có neo là rủi ro phình phạm vi số một.

**File chính:** `src/pages/shop/` (11 màn), `src/pages/admin/shop/` (5 màn), `src/components/shop/ShopShell.tsx`, `CatalogResults.tsx`, `ProductCard.tsx`, `MediaEditor.tsx`, `VariantEditor.tsx`, `src/styles/shop.css`, `src/styles/__tests__/contrast.test.ts`; test ràng buộc: `src/pages/shop/__tests__/*`, `src/components/shop/__tests__/*` (đường dẫn đầy đủ dưới worktree shop-ui-polish).
