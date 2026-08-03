# ui-ux-critic — VÒNG 1 (nguyên văn, 02/08/2026)

## Đánh giá tổng thể
Checklist gốc đọc như *ghi chú của người đã biết việc*, không phải *tài liệu thi hành* — 5/7 mục không nói làm ở đâu (GSC UI / repo / terminal), và mục quan trọng nhất (Index coverage) **không thể chạy được** với bộ export đang có. Nguy hiểm hơn: hai mục có tác động lên người dùng thật — "CTR quick wins" và "noindex" — đang nhắm sai chỗ; dữ liệu GSC cho thấy vấn đề của 5 query quick-win **không phải title**, mà là bản EN và bản VI của cùng trang sân có title **giống hệt nhau từng byte**, nên người Việt gõ tiếng Việt đang rơi vào trang tiếng Anh. Bản v2 đáng làm, nhưng phải sửa dữ kiện trước khi mã hoá nó thành doc.

## Luồng người dùng
**Cuong / agent thi hành checklist:** mở TODO.md → checkbox `[ ]` → tự đoán làm ở GSC UI hay repo → không có verify tại chỗ → verify bị dồn về cuối: đổi title mà không invalidate `pr:v32` ngay thì 6 tiếng sau Googlebot vẫn thấy title cũ.

**Người chơi ở Sài Gòn (gián tiếp, thật):** gõ `bsb pickleball club` → SERP vị trí 8 → **rơi vào `/san/bsb-pickleball-club-tp-hcm` bản tiếng Anh** (383 impr) chứ không phải bản VI (50 impr) → đọc "Phone… Address, map, directions…" bằng tiếng Anh. Exit point thật đang hỏng, không mục nào trong checklist chạm tới.

## Vấn đề (Blocker / Nên sửa / Nit)

| # | Mức độ | Vấn đề | Sửa |
|---|--------|--------|-----|
| 1 | **Blocker** | Recon sai: `/vi/blog/singapore-open-2026` TỒN TẠI (curl 200, 52 click/263 impr/CTR 19,77%/pos 5,63). Bài recap là URL khác (`/vi/blog/singapore-open-2026-ket-qua`, 1 click) | Bỏ premise khỏi recon; nếu "sửa" theo recon sẽ trỏ internal-link từ trang 52 click sang trang 1 click |
| 2 | **Blocker** | "Redirect 301" không nói đặt ở đâu; `public/_redirects` là chỗ SAI cho bot — `_middleware.ts` chạy TRƯỚC (repo tự ghi bài học 4 lần: `_middleware.ts:118, 298-301, 339-342, 382-383`) | Mọi 301 SEO mirror vào `_middleware.ts` cùng commit; done-criteria = curl Googlebot trả 301 |
| 3 | **Blocker** | Mục Index coverage không thực thi được: export Coverage chỉ có số đếm tổng, không cột URL | Tách 2 bước: 3a export URL-level từng issue từ GSC UI (Trang → lý do → Xuất) vào `~/Downloads/gsc-coverage-urls/`; 3b mới chạy classifier. Script TỪ CHỐI chạy nếu chỉ có aggregate |
| 4 | **Blocker** | 138 Discovered nhiều khả năng CHÍNH LÀ venue stub đang noindex CHỦ Ý (isThinVenue noindex+loại sitemap → Google không crawl → "Discovered") — "cải thiện nội dung + internal link" cho nhóm này là hành động NGƯỢC | Bước đầu mục coverage = đối chiếu 138 URL với tập thin venue, disposition "đúng ý đồ, không làm gì" |
| 5 | **Blocker** | Không hàng rào chống noindex nhầm; classifier suy "thin" từ 0 click sẽ thổi bay trang có hiển thị | CHỈ `isThinVenue()` định nghĩa thin; script hard-fail nếu ứng viên noindex có impressions > 0 (trừ --force) |
| 6 | **Blocker** | CTR quick wins nhắm sai bệnh: title EN và VI trùng NHAU TỪNG BYTE khi tên sân chứa "pickleball" (`venues.ts:298` nameHasKw); x-default trỏ EN → query tiếng Việt đẩy hiển thị sang trang EN (bsb: EN 383 vs VI 50) | Phân hoá ngôn ngữ TRƯỚC rewrite: VI thêm tiền tố `Sân ` cả khi nameHasKw; EN dùng city name tiếng Anh |
| 7 | Nên sửa | Done-criteria "CTR 2,5-3%" phẳng, không chuẩn hoá vị trí (dk đã 2,42% ở pos 7,8 = đúng baseline; picklezone 0% ở pos 5,5/147 impr mới bất thường — thường do local pack ăn click) | Đổi sang "CTR ≥ 50% kỳ vọng theo vị trí"; tách mục local pack riêng |
| 8 | Nên sửa | Title mất tỉnh/quận trong khi user gõ có (nghệ an, quận 2) | Chèn district + tỉnh vào cityTail (`venues.ts:305`); cắt: bỏ brand → bỏ tỉnh → bỏ quận, không bao giờ cắt tên sân |
| 9 | Nên sửa | `RALLY PICKLEBALL` — tên DB toàn HOA ra thẳng SERP, Google hay rewrite | Normalize title-case khi >70% hoa, dài >4 |
| 10 | Nên sửa | Invalidate cache nằm ẩn ở mục cuối, trong khi TTL 6h — verify cuối cho kết quả sai | Invalidate = sub-step bắt buộc ngay dưới mỗi mục đổi SSR, kèm lệnh `?nocache=1` cụ thể |
| 11 | Nên sửa | Bump pr:v33 = invalidate toàn bộ, cold render 8s budget → bot nhận SPA shell | Không bump global; warm theo lô `?nocache=1` từ Trang.csv, throttle |
| 12 | Nên sửa | tests/seo.spec.ts chỉ fetch URL đầu mỗi segment | Done-criteria: ≥10 URL /san/* ngẫu nhiên, cả 2 ngôn ngữ, curl Googlebot |
| 13 | Nên sửa | CLI không tự đoán thư mục export (export cũ trông vẫn hợp lệ) | `--performance-dir` bắt buộc; in ngày export ra stderr dòng đầu |
| 14 | Nên sửa | Mốc SEO-CLUSTER-READ 23/08 cùng property — thi hành trước 23/08 trộn nhiễu | Đóng băng title/noindex tới sau 23/08 HOẶC sửa mốc trước (ghi cohort loại trừ + ngày cắt) |
| 15 | Nit | Thuật ngữ GSC tiếng Anh trong khi UI GSC của Cuong tiếng Việt | Ghi song song VI (EN) |
| 16 | Nit | "Xác minh sau xử lý" gộp 4 việc 1 checkbox | Tách 4; một checkbox = một hành động = một bằng chứng |
| 17 | Nit | Không checkbox nào ghi làm ở đâu | Prefix `[GSC UI]` `[repo]` `[terminal]` `[prod verify]` |

## Trạng thái CLI
- Empty: exit 0, JSON `{"candidates": []}` stdout, summary stderr (VI+EN). Empty ≠ error.
- Error thiếu URL-level: exit 5, không đoán (copy cụ thể trong bản đầy đủ).
- Error sai schema: exit 4, nêu tên cột thiếu + cột đọc được.
- Offline-first; mọi thứ cần mạng sau flag `--online`.
- Exit codes: 0 ok/empty · 2 tham số · 3 file · 4 schema · 5 thiếu URL-level · 6 safety gate. Khớp convention gsc_report.py.
- Ngôn ngữ error: tiếng Anh (tiền lệ 3 script scripts/seo/); nhãn GSC UI trong hướng dẫn giữ tiếng Việt.

## Copy title đề xuất (trích)
- `/vi/san/dk-…`: `Sân DK Pickleball Club – Thảo Điền, TP.HCM` (hiện trùng byte với EN)
- `/san/dk-…`: `DK Pickleball Club – Thao Dien, Ho Chi Minh City`
- `/vi/san/rally-…`: `Sân Rally Pickleball – Thảo Điền, TP.HCM` (hiện RALLY toàn hoa)
- Quy tắc cắt >60: bỏ ` | ThePickleHub` → bỏ tỉnh → bỏ quận; KHÔNG cắt tên sân.

## A11y
Không có UI mới. Hệ quả thật: `<title>` là thứ screen reader đọc đầu tiên — giữ tên sân ở ĐẦU chuỗi; title VI phải là tiếng Việt thật (hiện VI/EN trùng → SR tiếng Việt đọc chuỗi khai báo EN).

## Panel đa model (GPT-5.6, model id `gpt-5.6-sol`)
Transcript: external/ui-ux-critic-gpt56.md. Lưu ý: `scripts/agents/ask-model.mjs` KHÔNG tồn tại — gọi trực tiếp POST /v1/responses.

- **Đồng thuận độc lập Claude+GPT:** (1) coverage/404 không thực thi được với export hiện có, script phải từ chối bịa cohort; (2) isThinVenue() là định nghĩa duy nhất của thin, cấm suy từ 0 click (GPT: nhóm zero-click = 23.552 impr, /san = 56,2% click); (3) không bump global pr:v33.
- **GPT tìm ra, Claude verify đúng:** bot bypass _redirects (→ Blocker #2); GONE_EXACT ship 30/07 chỉ 2 ngày trước export 01/08 → baseline là ảnh chụp GIỮA một đợt sửa, một phần 61 URL đã trả 410 đúng; nhiễm mốc 23/08 (→ #14).
- **Bất đồng với GPT:** GPT nói title rewrite bản thân không nguy hiểm, chỉ cần rollout cẩn thận. TÔI GIỮ #6: với 3/5 query, rewrite cùng template GIỮ NGUYÊN trùng lặp EN/VI — phân hoá ngôn ngữ phải đi trước. Bằng chứng production (bsb EN 383 vs VI 50) mạnh hơn suy diễn blast radius.
- **GPT hụt:** không trả lời 4 câu UX cụ thể (CLI signature, ngôn ngữ error, dịch thuật ngữ, chuỗi title) — các mục #13, #15-17 + Copy là một-model, rủi ro thấp, đảo ngược được.

**Blocker phải giải quyết trước khi viết v2:** #1 #2 #3 #4 #5 #6.
