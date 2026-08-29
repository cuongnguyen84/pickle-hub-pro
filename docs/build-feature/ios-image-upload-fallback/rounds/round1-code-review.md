# Round 1 — Code review (Bước A) — fix WebP/iOS JPEG fallback

Ngày: 2026-08-16. Reviewer: prompt-engineer (Codex CLI review độc lập + xác minh lại bằng đọc diff thật).

## 1. Đối chiếu báo cáo coder với diff thật — không có xanh giả

- `git status` khớp: đúng 10 file của fix (6 sửa + 4 mới), diff feature nút kích hoạt nguyên vẹn, không file lạ.
- Diff stat khớp báo cáo (imagePipeline +56/−35 vùng ladder, useMediaUpload +5, index.ts +19, v.v.).
- Migration mới `20260816120000_shop_media_jpeg_rendition_fallback.sql`: **đã diff cơ học 3 hàm với bản gốc** (`20260811140000` cho `shop_media_limits` + `product_media_finalize`, `20260811220000` cho `shop_profile_media_finalize`) — phần lệch DUY NHẤT là MIME check (equality → membership `?`), message lỗi, và comment. Signature + DEFAULT giữ nguyên → không 42P13 (pgTAP đã chạy xanh sau `db reset` theo báo cáo). Đã kiểm `20260814110000` chỉ GỌI `shop_media_limits`, không replace hàm nào trong 3 hàm → base version đúng, không ghi đè mất bản mới hơn.
- Grep AC6 tự chạy lại (loại test): các hit `image/webp` còn lại = input allowlist, hằng preferred `renditionType`, sniffer bytes, union type `SniffedType`, và điểm dispatch theo verdict trong `index.ts` — **không còn điểm enforcement đơn-MIME**. Khớp báo cáo.
- pgTAP mới `shop_media_jpeg_rendition.test.sql`: đếm tay đúng `plan(9)` = 9 assertion; fixture cô lập (user/shop/token mới, không đụng `tok-A`); ROLLBACK cuối.
- Fixture negative flip trong `shop_phase2a_media_lifecycle.test.sql`: chỉ đổi mimetype `image/jpeg`→`image/png` + comment, expect `22023` giữ nguyên → semantics giữ, không phá dây chuyền (finalize vẫn fail nên `verified_at` không bị set).
- KHÔNG tự chạy lại `supabase test db` (sẽ wipe fixture test tay của Cuong lần nữa) — tin số liệu 43 files/1434 tests từ báo cáo, có kiểm chứng gián tiếp qua việc đọc test SQL.

## 2. Codex review độc lập — verdict Codex: CHƯA ĐẠT (7 findings)

Codex chạy OK (`codex exec --skip-git-repo-check`, ~21k tokens). Findings + phân xử của tôi:

| # | Codex nói | Mức Codex | Phân xử | Mức sau phân xử |
|---|---|---|---|---|
| F1 | Inspector dừng ở SOS, không kiểm entropy stream/EOI → JPEG cụt sau SOS vẫn `ok:true` | blocker | **BÁC mức blocker.** Đúng về kỹ thuật, nhưng (a) spec đã ký chỉ yêu cầu "segment vượt buffer → truncated" — đã làm đúng; (b) `webp.ts` hiện hành cùng mức lỏng: validate cấu trúc khai báo, không validate tính trọn vẹn bitstream (file webp kết thúc sớm sau chunk hợp lệ cũng `ok`); (c) JPEG cụt chỉ hại chính người upload (ảnh hiện nửa chừng), không phải lỗ privacy | minor — residual chấp nhận được |
| F2 | APP1 nằm GIỮA các scan (progressive multi-scan) không bị phát hiện → GPS có thể lọt | blocker | **BÁC mức blocker.** Đúng là điểm JPEG yếu hơn webp (RIFF chunk toàn top-level nên webp thấy EXIF ở mọi vị trí; JPEG sau SOS là vùng mù). Nhưng threat model của check này là chống LEAK VÔ TÌNH: mọi file thật (camera/tool giữ metadata) đặt APP1 ngay sau SOI, TRƯỚC SOF → bị bắt. APP1-giữa-scan chỉ tồn tại khi cố tình craft — người craft tự leak GPS của chính mình. Walk entropy stream (FF 00 stuffing, RSTn) là thêm code đáng kể cho một đường tấn công tự-hại | minor — residual chấp nhận được, nên ghi 1 dòng comment trần trong `jpeg.ts` |
| F3 | `SOI+SOF+EOI` không có SOS vẫn `ok:true`; comment "EOI before any scan — dims stay 0" SAI so với code (nếu SOF đứng trước EOI thì dims ≠ 0) | major | **ĐỒNG Ý một phần.** Comment-vs-code mismatch là thật — tôi xác nhận bằng đọc code (`marker === 0xd9` chỉ `break`, dims đã set thì vẫn ok). File như vậy không encoder thật nào sinh ra và không render được — vô hại về privacy. Fix 1 dòng (`EOI trước SOS → not_jpeg`) — đáng làm nhưng không chặn Wave-1 | minor — nên fix (1 dòng) |
| F4 | Test jpeg thiếu 3 case tương ứng F1-F3 | major | Theo F1-F3 → cùng hạ mức. 6 case hiện có cover đúng spec đã ký | minor |
| F5 | File giả (header craft + payload tuỳ ý) qua finalize + publish lên CDN; finalize tin mimetype client khai | major | **BÁC phần "mới".** Finalize tin `storage.objects.mimetype` (= contentType client khai) là mô hình CÓ SẴN từ webp — hàng rào bytes thật nằm ở publish, không đổi. "Payload tuỳ ý sau SOS" áp dụng Y HỆT cho webp (không ai validate nội dung VP8 bitstream). Không phải regression của fix này; size cap 1MB + Content-Type image/* giữ nguyên | không tính — pre-existing model, không do fix này mở |
| F6 | pgTAP assert "exactly the two" nhưng chỉ check membership 2 phần tử — array có thêm gif vẫn pass wording đó | minor | ĐỒNG Ý — nit wording; đã có case GIF bị 22023 nên gate thật được cover | nit |
| F7 | Chưa có test "webp trả NULL → fallback jpeg thành công" (hành vi coder mở rộng ngoài spec) | minor | ĐỒNG Ý — case cả-hai-null có test (throw message mới), case null-webp-rồi-jpeg-ok thì chưa | nit |

Codex xác nhận đúng (tôi đồng ý sau xác minh): offset SOF/length/fill bytes/loại trừ C4-C8-CC đều chuẩn; nhánh Chrome không đổi (webp ok → không bao giờ hỏi jpeg, có assert `requestedTypes`); webp-quá-nặng → throw "quá nặng" KHÔNG fallback là đúng chủ đích (fallback dành cho encoder thiếu, không phải né size limit); quyết định blob-null→fallback của coder **hợp lý** (an toàn hơn cho seller, JPEG vẫn chịu cùng verify); jsonb `?` + `coalesce(mimetype,'')` đúng; fixture png flip giữ semantics; restart 0.82 + không trộn type được test chứng minh (`requestedQualities [0.82, 0.82]`).

## 3. Verdict Bước A của tôi (khác Codex)

**TẠM ĐẠT về code** — tôi bác 2 "blocker" của Codex với lý do threat-model + đồng bộ mức bảo vệ với webp.ts hiện hành (chi tiết bảng trên). Tồn 3 việc nhỏ KHÔNG chặn iPhone test, nên gộp sửa trước khi commit (hoặc gộp vào vòng 2 nếu iPhone test fail):

1. `jpeg.ts`: EOI gặp trước SOS → return `not_jpeg` (sửa cả comment cho khớp code) — 1 dòng + 1 test case.
2. `jpeg.ts`: thêm comment trần về vùng mù sau SOS (APP1 giữa scan không quét — chấp nhận, lý do threat model).
3. (tuỳ) test null-webp→jpeg-ok; pgTAP `jsonb_array_length = 2`.

**Kết luận cuối vòng 1 CHỜ kết quả test iPhone thật** — Chrome desktop không tái hiện được nhánh Safari.

## 4. Hướng dẫn test cho Cuong trên iPhone (verification cuối)

Setup sẵn: dev server :8080 + Supabase local đang chạy, fixture P2b đã reseed, edge runtime đã restart. Mở đúng URL đã dùng hôm 16/08 khi tái hiện bug (Safari iPhone, cùng Wi-Fi với máy Mac).

1. **Đăng nhập** tài khoản seller pilot (fixture P2b) → vào trang quản lý shop.
2. **Upload ảnh sản phẩm:** thêm/sửa một sản phẩm → chọn 1 ảnh CHỤP THẬT từ thư viện iPhone (ảnh camera, càng nặng càng tốt, 3-5 MB).
   - KỲ VỌNG: KHÔNG còn lỗi "Trình duyệt này chưa tạo được ảnh WebP. Thử trình duyệt khác."; ảnh nén xong, preview hiện, trạng thái upload hoàn tất, lưu sản phẩm OK.
3. **Publish sản phẩm** (nếu đang draft) → mở trang public của sản phẩm: ảnh hiển thị bình thường (đây là bước đi qua edge function publish — verify bytes JPEG).
   - KỲ VỌNG: ảnh hiện trên trang public, không placeholder vỡ.
4. **(Nếu tiện) Logo/cover shop:** đổi logo shop bằng ảnh từ thư viện → kỳ vọng như bước 2 (nhánh `shop_profile_media_finalize`).
5. **FAIL trông như thế nào:** hiện lại message WebP cũ, hoặc message mới "Trình duyệt này không nén được ảnh...", hoặc upload treo/lỗi ở bước "đang tải ảnh đã xử lý", hoặc ảnh public vỡ — chụp màn hình + báo bước nào.

**Regression Chrome desktop (tuỳ chọn, orchestrator chạy nhanh qua Chrome MCP):** cùng flow bước 2 trên Chrome → mở DevTools Network, request upload `rendition.webp` phải có `content-type: image/webp` (KHÔNG phải jpeg) — chứng minh nhánh Chrome không đổi.

## 5. Trạng thái AC (theo báo cáo coder, đã đối chiếu diff)

AC1-AC8 đều báo đạt; AC3/AC4 khớp với test code tôi đã đọc; AC4 không re-run (bảo vệ fixture của Cuong). AC còn treo duy nhất về hành vi thật: **iPhone Safari end-to-end — chờ Cuong**.
