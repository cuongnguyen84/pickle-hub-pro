# Phản biện góc người dùng / sản phẩm — Nút kích hoạt shop

## Điểm đồng ý

- **Kết luận từng-bước thắng full-build là đúng và lập luận đủ mạnh.** Hai trục thuyết phục nhất nhìn từ người dùng thật: (1) chưa ai biết seller VN nhỏ có cần cart không — chốt đơn qua inbox/Zalo là chuẩn de facto, mục 5 nói đúng; (2) P3a tự chặn mình bằng legal trong khi phương án từng bước cho legal chạy song song. Không cần bàn thêm.
- **Yêu cầu "đọc lại state sau khi ghi, không tin HTTP 200"** (mục 4) là requirement sản phẩm chứ không chỉ kỹ thuật — admin tưởng đã kích hoạt mà shop vẫn ẩn là kịch bản làm mất niềm tin của seller Wave 1 ngay lần đầu.
- **Đề xuất "định nghĩa trước ngưỡng tín hiệu P3a"** là điểm giá trị nhất của cả bản phân tích. Không có 3 con số viết trước thì soak 2-4 tuần không trả lời được gì và quyết định P3a sẽ là cảm tính.

## Điểm phản đối / thiếu sót

1. **"Phía seller không cần code thêm" — kết luận vội.** Tôi đã kiểm tra `src/pages/shop/SellerHome.tsx`: notice ở state `pending_activation` (dòng 77-84) đang viết *"Chức năng đăng sản phẩm sẽ bật ở giai đoạn tiếp theo — chúng tôi sẽ báo anh/chị khi sẵn sàng"* — copy này là của Wave 0, sẽ **sai sự thật** trong Wave 1 khi publish đã wiring xong. Và notice sau kích hoạt chỉ có đúng câu *"Shop đang hoạt động."* (dòng 87-92) — khoảnh khắc "được nhận vào chợ" của seller là khoảnh khắc quan trọng nhất của họ, mà màn hình không nói bước tiếp theo (đăng sản phẩm đầu tiên, link trang công khai của mình). Đây là sửa copy vài dòng, nên nằm TRONG scope buổi này, không phải để sau.

2. **Phân tích nói "admin thấy rõ cái gì thành công khai" nhưng dừng ở mức nguyên tắc.** Với công tắc một chiều làm dữ liệu ra anon ngay, đề xuất cụ thể hơn: màn xác nhận dùng `useConfirm()` có sẵn + **link xem trước trang shop** (`/shop/store/:slug` — admin đọc được row dù chưa active). Admin bấm kích hoạt mà chưa từng nhìn trang shop sẽ hiện ra thế nào là quyết định mù.

3. **Hai lựa chọn vị trí (a)/(b) không nên "để agent UI/UX quyết" — nên chốt (a) ngay.** Người dùng của nút là 1 admin, Wave 1 có 3-5 shop, tìm qua hàng đợi hồ sơ là đủ. Trang danh sách shop (b) là admin UX cho vấn đề chưa tồn tại; xây nó là tiêu buổi làm việc vào thứ không ai dùng. Treo lựa chọn này chỉ tạo cớ phình scope.

4. **7 câu hỏi mở treo quá nhiều — ít nhất 4 câu chốt được ngay bằng mặc định an toàn, không cần vòng PO:**
   - **Q1 (gộp suspend?):** Không. Chưa có seller nào để suspend; runbook B12 là nhu cầu văn bản hóa nhưng chưa có ca thật. Một chiều `pending_activation → active`, giữ đúng "~1 buổi".
   - **Q4 (dùng nút trước legal?):** Mặc định hiển nhiên — code xong bất kỳ lúc nào, lần **bấm** đầu tiên chờ PO mở Wave 1 (vốn đang CẤM sẵn). Không có gì để bàn.
   - **Q7 (ai báo seller):** Giữ nguyên quyết định đã ký — báo tay qua Zalo. 3-5 người quen, tự động hóa là lãng phí.
   - **Q2 (verified_method):** Câu này chặn thiết kế form nên không được treo — đề xuất chốt: Wave 1 toàn seller quen → ghi `gap-truc-tiep` tại lúc kích hoạt, khớp CHECK đủ-đôi của DB.
   - Chỉ **Q5+Q6 (phễu 3 số + ngưỡng P3a)** đáng đưa PO thật sự — và nên nâng thành **điều kiện tiên quyết mở Wave 1**, không phải câu hỏi lửng: mở soak mà chưa có số đo là đốt 2-4 tuần.

5. **Thiếu một dòng về trải nghiệm buyer trên `/shop` Wave 1.** 3-5 shop, noindex — trang chợ sẽ thưa. Chấp nhận được vì là closed-ish pilot, nhưng phân tích nên nói rõ đây là chủ đích (giá trị Wave 1 đo ở phía seller, không phải buyer) để không ai kỳ vọng nhầm rồi đòi thêm feature "làm đầy chợ".

## Đề xuất bổ sung (tóm tắt cho agent điều phối)

- Thêm vào scope: cập nhật 2 đoạn copy seller trong `SellerHome.tsx` (notice pending hết đúng + notice active có bước tiếp theo). Chi phí gần 0, giá trị trực tiếp cho đúng 3-5 người dùng thật đầu tiên.
- Chốt ngay tại vòng này: vị trí (a) trên trang review hồ sơ; một chiều activate; confirm dialog + link preview; `gap-truc-tiep`; báo seller bằng tay.
- Chuyển Q5/Q6 từ "câu hỏi mở" thành "gate mở Wave 1": PO phải ký 3 số + ngưỡng trước khi shop đầu tiên được kích hoạt.

File liên quan: `/Users/cm10/pickle-hub-pro/docs/build-feature/shop-activation-button/01-task-analysis.md`, `/Users/cm10/pickle-hub-pro/src/pages/shop/SellerHome.tsx`.
