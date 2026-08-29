# Báo cáo Round 1 — shop-ui-polish (coder)

## 1. Tóm tắt
5/5 hạng mục, **7 commit** trên `feat/shop-ui-polish` (worktree shop-ui-polish, base `65703e41`), không push, không đụng supabase/. Không cắt mục nào (§9) — không chạm trần (bundle còn 9.9 KB, mọi gate xanh). Monogram 22px PDP (tuỳ chọn) không làm. Visual spec Bước 0.8 đã thêm `/shop`, `/shop/sell` (file-only, không dispatch; PDP không thêm — pilot chưa có slug ổn định).

## 2. Kết quả 8 điểm xác minh Bước 0
1. `useMyShop` CÓ `id` + `slug` (select `*` từ shops) — href "Xem shop của tôi" từ `shop.data.slug`.
2. Seller đọc `public_path`/`draft_path`: xác minh bằng CĂN CỨ POLICY (không chạy db reset — không khả thi trong phiên): `product_media_select_member` lọc HÀNG theo membership không giới hạn cột (`20260811120000:349-352`); GRANT table-level (:367); migration siết `20260815090000` chỉ đụng anon. Join `product_media(id,position)` đã chạy prod — thêm cột không đổi tập hàng.
3. Grep `"Đang bán"` trong tests: 0 → bỏ dl ShopStore an toàn.
4. Grep zalo: URL ứng viên **https://zalo.me/2932845421782592643** (OA, ở ChatFAB.tsx:31 + FollowOaBanner.tsx:32, có `VITE_ZALO_OA_URL`). Ship KHÔNG nút — chỉ câu chữ, chờ PO duyệt URL.
5. Bẫy QueryClientProvider: đã `vi.mock` useSellerProducts cùng commit hạng mục 3; 17 test file xanh.
6. Bundle: INITIAL 227.1/280 · CODE 1569.7/1800 · Total **1960.1/1970 (còn 9.9 KB)** — exit 0 kèm cảnh báo "<5% headroom".
7. Contrast 64/64 pass sau mỗi đợt CSS; ShopHome không thêm phần tử trên grid (chips skeleton đúng cỡ 44px).
8. Visual spec: thêm 2 route (commit riêng).

## 3. Diff stat + commit
```
20 files changed, 887 insertions(+), 134 deletions(-)
(mới: ShopMonogram.tsx +50, ShopMonogram.test.tsx +35, useSignedPreviews.ts +54, SellerProducts.thumb.test.tsx +194; lớn: shop.css +151, SellerProducts +110, SellerHome +90, SellLanding 79, Status 57, ShopStore 44)
09ee93af test(visual) · b264c718 test(shop) coverage · 476ba40b hạng mục 5 · fdcac025 hạng mục 4 · bda6623b hạng mục 3 · 02ecc463 hạng mục 2 · ecda6d03 hạng mục 1
```

## 4. AC1–AC13: 13/13 PASS
- AC1 lint 0 error/30 warnings (kiểu sẵn có); AC2 tsc 0; AC3 vitest **185 files / 2742 pass**, statements **83.1%** (sau hạng mục 5 tụt 82.97% → commit b264c718 phủ nhánh loading/error/empty); AC4 test Thumb 4 case (public/draft-1-batch-call-TTL300/0-media/mint-lỗi + chốt position nhỏ nhất); AC5 CTA row đúng href/target/rel cả noopener+noreferrer, vắng khi chưa active, 4 nhãn stat + "Cần sửa"=needs_changes+rejected; AC6 copy test chỉ THÊM (1 dòng import đổi); AC7 grep hex/rgb dòng `+` shop.css = 0; AC8 build + bundle exit 0; AC9 contrast 64/64, file test không đổi; AC10 đúng 2 file source mới, MediaEditor import hook mới 26/26 xanh, monogram test "Đạt"→"Đ"; AC11 diff không chứa SellerProductForm/supabase/lockfile; AC12 chuỗi VI chỉ move/thêm, bỏ có chủ đích: dl "Đang bán", label "{count} ảnh", chips "Đang tải…"; AC13 commit 1 = trọn hạng mục 1, ls-remote rỗng.

## 5. Sai lệch so với spec (9)
1. `useSignedPreviews` thêm đánh dấu thất bại (`""` + .catch) — bắt buộc để phân biệt shimmer vs mint-lỗi (AC4d); falsy nên MediaEditor giữ nguyên hành vi.
2. ResultsGrid nhận 2 prop (`emptyIcon`+`emptyAction`) thay vì 1 — icon khác nhau theo màn.
3. **Ghost timeline đặt CUỐI (sau is-current) thay vì "trên cùng"** — timeline chạy cũ→mới, đặt trên cùng sẽ đứng trước "Tạo hồ sơ" sai dòng thời gian. CẦN prompt-engineer/PO xác nhận.
4. `.tl-shop-stat` min-height 76px (phân xử trong prompt).
5. Bundle đo sau hạng mục 5 thay vì sớm sau 1+2 (kết quả vẫn dư 9.9 KB).
6. `shop-schema.ts` sửa (Pick thêm public_path/draft_path) — hệ quả bắt buộc, không thuộc danh CẤM.
7. Icon FileText màn Status dùng inline style (1 chỗ dùng, không chế class).
8. Bước 0.2 bằng chứng policy thay vì runtime — vòng tester muốn bằng chứng thật cần phiên có Docker.
9. 2 commit test bổ sung ngoài 5 commit hạng mục (test-only).

Chưa kiểm được (việc tester): 2 mode light/dark, viewport 320-768, B01 fold 320px trên máy thật.
