# Round 1 — Code review (Bước A, prompt-engineer)

Reviewer độc lập: Codex CLI (`codex exec --skip-git-repo-check`, chạy OK, 8 finding) + tôi xác minh lại từng claim bằng code/migration thật. Diff review: `git -C .claude/worktrees/shop-ui-polish diff 65703e41...HEAD` (20 files, +887/−134, 7 commit). Spot-check chống xanh giả: tự chạy lại 4 file test touched trong worktree → 49/49 pass; diff stat + commit list khớp báo cáo coder; 3 chuỗi VI bị bỏ đúng như coder khai (dl "Đang bán", label "{count} ảnh", chips "Đang tải…"), không phát hiện chuỗi nào bị xoá lén.

## VERDICT CODE REVIEW: CHƯA ĐẠT HẲN — 2 defect thật phải sửa (nhỏ), 1 fix tuỳ chọn. Không blocker. Chờ kết quả tester (Bước B) rồi gộp thành prompt sửa vòng 2.

### Finding Codex + phán quyết của tôi

| # | Codex | Phán quyết |
|---|---|---|
| F1 | MAJOR — `SellerHome.tsx` ProductStats: `total = Object.values(c).reduce(...)` cộng cả `archived`; shop chỉ còn sản phẩm archived → không vào empty state, hiện 4 ô toàn 0 | **ĐỒNG Ý — SỬA vòng 2.** Đã verify RPC `product_status_counts` (migration `20260811200000:543`) GROUP BY mọi status kể cả archived. Fix 1 dòng: tính total từ đúng 4 nhóm hiển thị. |
| F2 | MAJOR — empty state stats hiện nút "Đăng sản phẩm đầu tiên" cho cả shop `pending_activation/suspended/...` → mở lại flow bị chặn | **ĐỒNG Ý — SỬA vòng 2** (hạ MAJOR→MINOR: lỗ hổng của prompt, không phải coder tự ý; SellerProducts có guard riêng nên không mất dữ liệu). Fix: gate nút (hoặc cả empty-CTA) theo `state === "active"`, state khác chỉ hiện dòng trống. |
| F3 | MAJOR — ghost timeline nằm trong điều kiện `events.data.length > 0`, submitted mà 0 event thì ghost biến mất | **HẠ XUỐNG NIT, KHÔNG SỬA.** Đã verify migration `20260811090000:470`: submit/resubmit LUÔN insert event row → status submitted/under_review không thể 0 event. Trường hợp events đang loading/error thì cả timeline ẩn — hành vi có sẵn từ trước, ngoài scope. Tester sẽ xác nhận ghost hiện thật (TC-08). |
| F4 | MAJOR — ghost đặt CUỐI trái spec "trên cùng", phải đưa lên đầu hoặc xin đổi spec | **BÁC — PHÂN XỬ: CODER ĐÚNG, spec sai giả định.** Bằng chứng: `useApplicationEvents` order `created_at ascending:true` (useSellerApplication.ts:75) — timeline chạy cũ→mới. Chữ "trên cùng" trong spec viết theo giả định mới-nhất-trước; đặt bước-chưa-xảy-ra TRƯỚC "Tạo hồ sơ" là phi thời gian. Ghost ở cuối = vị trí "bước kế tiếp" chuẩn của mọi stepper cũ→mới. Intent spec (seller thấy có người thật sẽ trả lời) giữ nguyên. **Sai lệch #3 của coder: CHẤP NHẬN, đóng — không cần hỏi PO.** |
| F5 | MINOR — link "Tìm hiểu cách mở shop" (ShopHome empty) vùng chạm < 44px | **GHI SỔ, KHÔNG BẮT SỬA** — link inline trong prose là pattern sẵn có toàn app (notice SellerHome cũng vậy); tester đo thực tế nếu rảnh. |
| F6 | MINOR — `Thumb` state `broken` không reset khi src đổi → sửa ảnh xong vẫn ImageOff nếu component không remount | **ĐỒNG Ý — fix TUỲ CHỌN vòng 2** (1 useEffect reset theo src). Thực tế seller sửa ảnh ở route khác → quay lại là remount, tác động thấp. |
| F7 | NIT — key `paths.join("\|")` nhập nhằng | **BÁC** — body hook được spec YÊU CẦU giữ nguyên khi lift (hành vi y hệt trước lift); đổi serialization là ngoài scope. |
| F8 | NIT — `toUpperCase()` có thể nở 1 code point thành 2 ("ß"→"SS") | **BÁC** — audience VN, edge không đáng diff. |

Kiểm thêm của riêng tôi (Codex không nêu): `useSignedPreviews` đánh dấu thất bại bằng `""` — cả 2 call site MediaEditor (dòng 276 và 444) đều truthy-check nên `""` falsy → hành vi MediaEditor giữ nguyên, kết luận của coder đúng. `--mono-accent` do ShopStore header và ShopMonogram cùng gọi `monogramAccent()` → không thể lệch. Href `/shop/store/${s.slug}`: slug từ DB của mình, nội suy vào path segment qua React attribute escaping — không có vector XSS. CSS mới chỉ APPEND cuối shop.css + 1 dòng đổi font-size giá — không đụng các fix đã ghi sổ (44px, min-width:0, ink flip, chip count, data-mobile-only, scroll ownership); toàn bộ màu mới qua var/color-mix — 0 hex/rgb raw.

### Phân xử 9 sai lệch coder tự khai

1. `useSignedPreviews` thêm đánh dấu thất bại `""` — **CHẤP NHẬN** (bắt buộc cho AC4d, MediaEditor không đổi hành vi — đã verify call sites).
2. `emptyIcon` + `emptyAction` (2 prop thay 1) — **CHẤP NHẬN** (mục tiêu "không fork component" đạt; gộp 1 prop sẽ xấu hơn).
3. Ghost timeline CUỐI thay vì "trên cùng" — **CHẤP NHẬN, coder đúng** (phân xử ở F4, có bằng chứng ordering).
4. `.tl-shop-stat` 76px — **CHẤP NHẬN** (đã phân xử sẵn trong prompt).
5. Bundle đo sau hạng mục 5 — **CHẤP NHẬN** (kết quả xanh, còn 9.9 KB).
6. `shop-schema.ts` mở rộng Pick — **CHẤP NHẬN** (hệ quả bắt buộc của LIST_COLUMNS, không thuộc danh CẤM).
7. FileText inline style — **CHẤP NHẬN** (1 chỗ dùng, đúng ponytail).
8. Bước 0.2 bằng chứng policy thay runtime — **CHẤP NHẬN CÓ ĐIỀU KIỆN**: TC-01/TC-02 dưới đây chính là bằng chứng runtime; nếu fail vì join không trả cột thì quay lại điểm này.
9. 2 commit test bổ sung — **CHẤP NHẬN** (test-only, giữ coverage ≥83%).

### Danh sách sửa vòng 2 (chốt sau khi có kết quả tester)

- BẮT BUỘC: F1 (total bỏ archived) · F2 (gate nút "Đăng sản phẩm đầu tiên" theo state active).
- TUỲ CHỌN rẻ: F6 (reset `broken` khi src đổi).
- KHÔNG sửa: F3, F4, F5, F7, F8 (lý do ở trên).

---

## Test case cho `tester` (Chrome MCP + dev server local từ WORKTREE)

### Setup (y hệt các vòng trước)

1. `cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-ui-polish`
2. `supabase db reset --local` (bắt buộc — `supabase start` không áp hết migration)
3. `.env.local` trỏ local stack (URL + anon key local)
4. Fixture: `node scripts/shop-p2b-fixture.mjs up` — lấy tài khoản seller + admin từ output fixture
5. `npm run dev` (port 8080), đăng nhập qua `/login`
6. Fixture phải có ≥1 shop active với ≥1 sản phẩm có ảnh (nếu fixture chưa có ảnh, tester upload 1 ảnh qua form sửa sản phẩm bước 6 trước khi chạy TC-01)

Mỗi TC: chụp screenshot + soát console. **TC-12 (console 0 error) áp cho MỌI TC.**

### Case

- **TC-01 — Thumbnail thật (SellerProducts):** đăng nhập seller → `/seller/products`. Kỳ vọng: sản phẩm có ảnh hiện ẢNH THẬT vuông (44px trong bảng desktop, 56px card mobile), KHÔNG còn chữ "N ảnh"; ảnh không méo (object-fit cover). Đây đồng thời là bằng chứng runtime cho Bước 0.2 (RLS join trả cột) — nếu mọi thumbnail đều rơi về ImageOff dù có ảnh: FAIL, ghi rõ.
- **TC-02 — Thumbnail 4 trạng thái:** cùng trang: sản phẩm 0 ảnh → icon ImageOff + pill "Chưa có ảnh"; sản phẩm chỉ có ảnh draft (chưa duyệt public) → thoáng shimmer rồi ra ảnh (throttle mạng nếu cần thấy shimmer). Không có notice/retry nào quanh thumbnail.
- **TC-03 — SellerHome dashboard:** `/seller`. Kỳ vọng: hàng CTA 2 nút "Xem shop của tôi" + "Đăng sản phẩm" (chỉ khi shop active); 4 ô số "Đã duyệt · Chờ duyệt · Cần sửa · Nháp" khớp số thật của fixture; ô "Cần sửa" có màu danger CHỈ khi >0, 3 ô kia không màu; bấm 1 ô → về `/seller/products`.
- **TC-04 — "Xem shop của tôi" mở đúng:** bấm nút → tab mới `/shop/store/<slug>` đúng shop, trang render.
- **TC-05 — ShopStore header (dark + LIGHT):** mở `/shop/store/<slug>`. Kỳ vọng: banner gradient thấp (~56px) + monogram chữ cái đầu tên shop đè lên banner + h1 + dòng "N sản phẩm · region"; card thông tin KHÔNG còn dòng "Đang bán"; **toggle sang light mode**: banner/monogram/chữ vẫn đọc rõ, không mảng màu chói/mất chữ; reload — monogram giữ NGUYÊN màu (hash ổn định).
- **TC-06 — SellLanding hết "6 khối xám":** `/shop/sell` (đăng xuất hoặc user thường). Kỳ vọng: eyebrow "Thử nghiệm kín · Chưa thu phí" trên h1; 4 mục Giấy tờ/Bao lâu/Phí/Huy hiệu KHÔNG còn là hộp xám — thành nhịp gạch ngang (border-top), riêng "Huy hiệu Đã xác minh" có vạch màu trái; toàn bộ câu chữ cũ còn nguyên văn. Kiểm cả light mode.
- **TC-07 — Status: thứ tự khối:** đăng nhập user có hồ sơ submitted/under_review (fixture; nếu không có, tạo hồ sơ mới rồi submit) → `/seller/application/status`. Kỳ vọng thứ tự: notice → (Cần sửa nếu có) → "Diễn biến" → "Thông tin đã gửi" → hàng nút → khối liên hệ "Cần hỏi nhanh?… nhắn Zalo…" — khối này KHÔNG có nút/link Zalo nào.
- **TC-08 — Ghost timeline:** cùng trang, status submitted/under_review: cuối danh sách Diễn biến có item chấm gạch-đứt rỗng, chữ mờ "Quản trị viên xem hồ sơ và trả lời tại đây". Đọc theo mạch cũ→mới phải tự nhiên (đây là placement đã phân xử — cuối, không phải đầu).
- **TC-09 — ProductCard fallback + giá:** `/shop` hoặc trang catalog có sản phẩm không ảnh. Kỳ vọng: ô ảnh trống hiện ImageOff + "Chưa có ảnh" (chữ nhỏ, mờ — không phải hộp trống); giá trên card to hơn nhìn thấy được (15.5px, đậm).
- **TC-10 — ShopHome chips skeleton:** `/shop` với Network throttle (Slow 3G) + hard reload. Kỳ vọng: chỗ "Ngành hàng" hiện 4 viên skeleton pill (không còn chữ "Đang tải…"), xong thay bằng chips thật. Nếu local nhanh quá không bắt được dù đã throttle → SKIP có lý do, ghi lại.
- **TC-11 — Responsive 500px + không scroll ngang:** resize ~500px và ~390px, đi qua `/shop`, `/shop/sell`, `/shop/store/<slug>`, `/seller`, `/seller/products`: không thanh cuộn ngang, CTA row SellerHome xếp dọc (<560px), stats 2 cột, storehead không đẩy catalog sâu bất thường. LƯU Ý bài học cũ: Chrome MCP resize KHÔNG kết luận được responsive tuyệt đối — báo best-effort, ghi rõ là proxy.
- **TC-12 — Console:** trong tất cả TC trên, console 0 error (warning ghi lại nhưng không tính fail).

### SKIP có lý do (không giao tester)

- B01 fold 320px trên máy thật + cảm nhận thị giác light mode tinh (contrast cảm quan): Chrome MCP resize là proxy không kết luận được — chuyển Cuong kiểm tay.
- Ảnh draft-only shimmer đúng timing từng ms: phụ thuộc tốc độ local, chỉ cần thấy "không phải ImageOff khi đang chờ".
- Visual regression baseline (`tests/visual.spec.ts` 2 route mới): cần workflow_dispatch sau khi push — ngoài scope vòng local.
