# Round 1 — Báo cáo tester (Chrome MCP, dev server + Supabase local)

## Kết quả: 9 PASS · 1 PARTIAL · 2 SKIP · 0 FAIL

Môi trường: worktree shop-ui-polish, db reset exit 0, fixture run `msw0bjq5`, dev 8080, /login. Shop slug `p2b7-shop-new-msw0bjq5`.
**Tiền đề quan trọng:** ảnh fixture là WebP 26-byte không pixel data → render "trong suốt"; tester thay bytes thật (PNG 800×400) cho 3 object + tạo 1 sản phẩm nháp 0 ảnh qua RPC `product_create` để có case fallback.

| # | Case | KQ | Bằng chứng |
|---|---|---|---|
| TC-01 | Thumbnail thật SellerProducts | ✅ | Ảnh thật 44px cover-crop đúng; hết chữ "N ảnh" toàn trang. Kiêm bằng chứng runtime RLS Bước 0.2 (join cột + mint draft OK) |
| TC-02 | Thumbnail 4 trạng thái | ✅ | 0 ảnh → ImageOff + pill; draft-only → ảnh qua signed URL, chờ = ô sk trơn (không ImageOff); không notice/retry |
| TC-03 | SellerHome dashboard | ✅ | CTA row 2 nút; 4 ô 5·1·1·1 khớp DB tuyệt đối; "Cần sửa" đỏ + viền danger duy nhất; ô → /seller/products |
| TC-04 | "Xem shop của tôi" | ✅ (proxy) | href đúng slug + target/rel đủ đôi; URL mở trực tiếp render đủ |
| TC-05 | ShopStore header dark + LIGHT | ✅ | Banner ~60px + monogram "S" đè mép + meta "5 sản phẩm · Hà Nội"; card hết dòng "Đang bán"; light mode sạch; màu monogram ổn định qua reload |
| TC-06 | SellLanding hết 6 khối xám | ✅ | Eyebrow + FAQ border-top + vạch màu Huy hiệu; câu chữ nguyên văn; cả 2 mode |
| TC-07 | Status thứ tự khối | ✅ | notice → Diễn biến → Thông tin → nút → khối "Cần hỏi nhanh?" text thuần, KHÔNG link/nút Zalo |
| TC-08 | Ghost timeline | ✅ | Chấm rỗng viền đứt cuối Diễn biến, đúng placement đã phân xử |
| TC-09 | ProductCard fallback + giá | 🟡 | Giá PASS (15.5px/700). Fallback SKIP: public catalog LOẠI sản phẩm không approved cover ở tầng RPC → nhánh fallback defensive, không reachable bằng dữ liệu hợp lệ |
| TC-10 | ShopHome chips skeleton | ⏭️ | Không throttle được mạng local; bằng chứng tĩnh ShopHome.tsx:69-74 đúng spec; chips thật đúng sau load |
| TC-11 | Responsive 500/390px | ⏭️ | resize_window vô hiệu (Chrome fullscreen, viewport giữ 1396px cả 3 lần) — KHÔNG có kết luận responsive, chuyển Cuong kiểm tay iPhone |
| TC-12 | Console 0 error | ✅ | 0 error app qua 5 lượt soát + sweep cuối |

## Phát hiện ngoài scope (ghi sổ)
1. Fixture ảnh 26-byte không pixel — test tay sau nên seed ảnh thật.
2. Public catalog loại sản phẩm thiếu approved cover ở tầng RPC — fallback ProductCard không bao giờ kích hoạt với dữ liệu hợp lệ (cần reviewer xác nhận chủ đích).
3. **Hàng suspended trong SellerProducts: pill trạng thái RỖNG + filter "Ngừng bán (0)" đếm sai dù có 1 sản phẩm suspended** — bug hiển thị có sẵn (không thuộc 12 TC).
4. form_input không ăn với React login form — phải gõ bàn phím thật; autofill đè email cũ (quirk môi trường).

## Dọn dẹp: fixture down sạch tuyệt đối (0 hàng/0 tệp), state file tự xoá, .env.local xoá, dev tắt, tab đóng.
