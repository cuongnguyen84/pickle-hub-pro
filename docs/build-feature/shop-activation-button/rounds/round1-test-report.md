# Vòng 1 — Báo cáo tester (Chrome MCP, dev server local + Supabase local)

## Kết quả: 8/9 pass (7 pass đầy đủ + 1 pass best-effort) · 0 fail · 1 skip

Môi trường: worktree `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button`, `supabase db reset --local` exit 0 (migration `20260816090000_shop_activate_rpc.sql` áp thành công), fixture `shop-p2b-fixture.mjs up` OK, dev server Vite cổng 8080. Slug ghi nhận ở TC1: **`shop-ho-so-qa-msvdvumv`**.

| # | Case | Kết quả | Bằng chứng ngắn |
|---|------|---------|-----------------|
| TC1 | Approve → section xuất hiện đúng chỗ | ✅ PASS | Dòng hệ quả đúng nguyên văn khi chọn Duyệt. Sau gửi: section "Kích hoạt shop" nằm GIỮA "Người nộp" và "Chấp thuận quy chế"; "Trạng thái shop: Chờ kích hoạt"; path là TEXT trơn (không phải link) `"/shop/store/shop-ho-so-qa-msvdvumv (sẽ mở khi kích hoạt)"`; notice vàng đúng; select mặc định "Gặp trực tiếp" + đủ 3 lựa chọn; nút hiện. Console 0 error |
| TC2 | SellerHome trước kích hoạt | ✅ PASS | "Shop đã mở nhưng chưa hoạt động." + câu Zalo đúng nguyên văn; KHÔNG còn câu "giai đoạn tiếp theo"; "Trạng thái: Chờ kích hoạt". Console 0 error |
| TC3 | Confirm dialog + Huỷ | ✅ PASS | Dialog title `Kích hoạt shop "Shop Hồ Sơ QA msvdvumv"?`, đúng 3 dòng riêng, nút "Kích hoạt". Huỷ → đóng, vẫn "Chờ kích hoạt", F5 vẫn vậy |
| TC4 | Kích hoạt thành công | ✅ PASS | Section tự đổi KHÔNG cần F5: "Đã kích hoạt." + link "Xem trang shop (mở tab mới)" + câu Zalo; nút BIẾN MẤT (không còn button trong DOM); "Đang hoạt động" + "Xác minh: Gặp trực tiếp"; "Trang shop" thành LINK href đúng slug. Console 0 error |
| TC5 | Shop công khai, chưa đăng nhập | ✅ PASS | Test bằng **logout thật**: `/shop/store/<slug>` render tên shop + empty state "Shop chưa đăng bán sản phẩm nào" (đúng); `/shop` render 6 sản phẩm, 0 lỗi console |
| TC6 | F5 idempotent | ✅ PASS | F5 giữ nguyên "Đã kích hoạt" / "Đang hoạt động", không nút, không nháy về pending |
| TC7 | SellerHome sau kích hoạt | ✅ PASS | Copy đúng nguyên văn; link 1 href `/shop/store/<slug>`, link 2 href `/seller/products/new` — bấm thử mở form "Thêm sản phẩm" thật, không 404; "Trạng thái: Đang hoạt động" |
| TC8 | Responsive 320px | ⚠️ PASS best-effort ở 500px | **320/375px KHÔNG ép được**: `resize_window` báo success nhưng Chrome macOS không co dưới ~500px (viewport đo thực 500×701 — đúng bài học "Chrome MCP resize không kết luận được responsive"). Ở 500px: layout mobile (bottom-nav), KHÔNG có scroll ngang, link wrap gọn. Screenshot 500px đã chụp. 320px thật cần Cuong kiểm trên iPhone |
| TC9 | Section KHÔNG hiện trên hồ sơ chưa duyệt | ⏭️ SKIP | Fixture chỉ tạo 1 hồ sơ; sau TC1 nó đã "Đã duyệt" — không còn hồ sơ chưa duyệt để mở. (Bù gián tiếp: TRƯỚC khi approve ở TC1, cùng trang ở trạng thái "Đã gửi" KHÔNG có heading "Kích hoạt shop" — thấy trực tiếp) |

## Case fail — chi tiết

Không có.

## Observation ngoài phạm vi TC (chuyển cho vòng review)

1. **Copy "xác minh giấy tờ" sai thực tế với method "Gặp trực tiếp".** Sau kích hoạt với "Gặp trực tiếp", trang công khai `/shop/store/<slug>` hiện badge sr-text "đã được xác minh giấy tờ" và dòng "ThePickleHub đã xem giấy tờ kinh doanh của shop này." — trong khi admin không hề xem giấy tờ. Nguyên nhân: `src/pages/shop/ShopStore.tsx` (dòng ~90 và ~106) chỉ dựa `shop.verified`, mà RPC public tính `verified = verified_at IS NOT NULL` (migration `20260813120000` dòng 134) — không phân biệt method. Code copy có từ trước, nhưng nhánh `gap-truc-tiep` mới do feature này mở ra làm nó thành claim sai. `ProductCard.tsx`/`ProductDetail.tsx` cũng dùng cùng label.
2. Nút huỷ trong confirm dialog label là **"Cancel"** (tiếng Anh) giữa dialog toàn tiếng Việt — cosmetic, default của `useConfirm`.
3. Teardown fixture để lại residue local (applicant user không xoá được vì đã own shop tạo qua UI — ngoài registry fixture). Đã xử lý bằng `supabase db reset --local` lần cuối + xoá state file — DB local sạch, fixture chạy lại được.

## Dọn dẹp (đã xong)

- Fixture down + `supabase db reset --local` chốt sạch; `.env.local` đã xoá; dev server đã tắt; tab Chrome đã đóng.

Ghi chú cho người chạy lại: admin fixture "CHƯA bật 2FA" vẫn bị `AdminMFAGate` bắt enroll TOTP lần đầu vào `/admin` — tester enroll bằng secret hiển thị trên trang (sinh TOTP bằng script). Sau verify lần đầu, trang báo "không có quyền" một nhịp, F5 là vào được (session cần refresh nhận aal2).
