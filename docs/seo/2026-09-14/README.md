# ThePickleHub: SEO theo ưu tiên Zyppy — 14/09/2026

Phạm vi: cải thiện website hiện tại theo [Ranking Factor Definitions của Zyppy](https://zyppy.com/ranking-factor-definitions/). Danh sách này dùng làm khung đánh giá; không phải mọi mục đều là yếu tố xếp hạng đã được Google xác nhận. Không gán điểm tổng giả định hoặc hứa tăng hạng.

## Thứ tự xử lý

| Ưu tiên | Tiêu chí Zyppy | Phát hiện / thay đổi |
| --- | --- | --- |
| P0 | Factual Accuracy, Content Freshness, Search Intent Match | Cập nhật lịch 2026 tới 14/09: HCMC và World Cup đã kết thúc; lịch Kuala Lumpur đã qua; Hong Kong 19–25/10 là chặng kế tiếp. Có nguồn và ngày cập nhật. Sửa lời hứa “không cần đăng ký”: tạo/quản lý giải cần đăng nhập, người xem bảng công khai không cần tài khoản. |
| P1 | Content Requires Client-Side JavaScript, Correct Canonicalization, Hreflang Accuracy | Các trang biên tập/marketing được chọn có HTML chứa nội dung và metadata theo URL ngay trước JavaScript; giữ ứng dụng React. Canonical bỏ query/fragment. Giữ schema lúc tải lần đầu, bỏ schema máy chủ khi chuyển trang. Giữ status 404/redirect và fallback khi nguồn dữ liệu lỗi/chậm. |
| P2 | Information Gain, Content Effort, Factual Accuracy | Viết lại so sánh phần mềm bằng tài liệu chính thức, công khai ThePickleHub là bên xuất bản, phân biệt mô tả sản phẩm với trải nghiệm thử thực tế. Có bài tập diễn tập 16 đội/4 sân; đây là hướng dẫn thử, chưa phải kết quả thử nghiệm. |
| P3 | Creator Expertise / Authority, Demonstrates Experience, Structured Data | Thêm hồ sơ Cuong Nguyen và liên kết bài viết có đúng tên tác giả; dùng Person/Organization theo byline thật. Hồ sơ chỉ nêu thông tin có bằng chứng từ nhật ký World Cup, không tự nhận chứng chỉ hoặc chức danh chuyên môn. |
| P4 | Internal Anchor Text Relevance, Links from Topically Relevant Pages | Bài liên quan EN dùng cùng thuật toán theo chủ đề ở React và máy chủ; bỏ gợi ý chỉ cùng tag chung “pickleball”. Hồ sơ tác giả được nối từ About và bài viết, có sitemap/hreflang. Backlink bên ngoài mới dừng ở kế hoạch có mục tiêu; chưa có backlink mới và chưa gửi liên hệ. |
| P5 | Core Web Vitals, Mobile Usability, Organic CTR, Satisfaction / Task Completion | Lưu baseline GSC/GA4, URL Inspection, sự kiện hành trình và chất lượng web-vital. Không dùng tổng traffic World Cup làm bằng chứng tác động của đợt sửa này. |

## Dữ liệu trước triển khai

- GSC, 15/08–11/09 so với 18/07–14/08: **12.374 / 817 click**, **123.375 / 39.781 impression**, CTR **10,03% / 2,05%**, vị trí trung bình **7,1 / 9,0**. World Cup chiếm phần lớn tăng trưởng; không suy diễn đây là tăng trưởng evergreen.
- GA4, 17/08–13/09: **18.836 session**, **14.061 user**, **52.743 lượt xem**; Organic Search **12.169 session**. Cửa sổ GA4 khác GSC vì độ trễ dữ liệu.
- URL Inspection: calendar EN, comparison EN, `/tools`, bài lịch World Cup VI đều **Submitted and indexed**, canonical Google chọn trùng canonical khai báo. Đây là kết quả tại thời điểm kiểm tra, không bảo đảm trạng thái sau này. Không có căn cứ nói toàn site mất index.
- GA4 Việt Nam, cùng cửa sổ GA4: sự kiện bắt đầu tạo giải **32**, thử submit **7**, tạo thành công **7**. Đây là **event count**, không phải cohort người dùng hoặc tỷ lệ chuyển đổi 7/32.
- Web-vital events Việt Nam: LCP good **11.271/13.586 (83,0%)**; INP good **8.982/10.102 (88,9%)**; CLS good **4.623/5.750 (80,4%)**. Mẫu và mẫu số khác nhau. GA4 chỉ có dimension tên/mức đánh giá, chưa có phân phối metric value để tính p75; đây **không phải kết quả CrUX/Core Web Vitals toàn site**.

Các JSON kèm theo là bằng chứng tổng hợp đọc từ tài khoản GSC/GA4 hiện có. Không chứa khóa truy cập. `inspection-baseline.json` lưu các lần kiểm tra URL; không phải yêu cầu Google lập chỉ mục lại.

## Kiểm tra và vận hành

- `npm run lint`, `npx tsc -b --noEmit`, `npm test`, `npm run build`, bundle budget và kiểm tra TheLine.
- Chrome mobile 390 × 844, bật/tắt JavaScript: tools EN/VI, lịch giải EN, hồ sơ tác giả; nội dung xuất hiện, một H1, canonical không có UTM, không tràn ngang, không pageerror. Localhost canonical sau React là hành vi preview; production phải trỏ www.thepicklehub.net.
- Unit coverage bổ sung: phạm vi public không bao gồm thao tác riêng tư; fallback/time budget; 404/redirect; metadata extraction; tác giả thật; related World Cup; schema handoff; exact editorial title/canonical.
- `tsc -p functions/tsconfig.json` riêng của toàn bộ edge test tree còn lỗi sẵn có (Node typings/unknown ở các test cũ). Không dùng nó làm bằng chứng một gate mới đã qua; Pages Functions được biên dịch trong Wrangler preview và test chính.
- Cache bot tăng v124 → v125. Không thay slug bài đang có traffic. Không sửa legacy prerender-worker.
- Human progressive HTML áp dụng danh sách route tường minh; render dữ liệu chậm/lỗi sẽ fallback về app shell trong ngân sách 2,5 giây. Theo dõi `X-Public-Render` và TTFB sau phát hành. Không coi đây là hoàn tất SSR cho toàn website.

### Hai bài VI trong Supabase

Nguồn nội dung VI công khai là `vi_blog_posts`, khác file TS. `vi-blog-patches.json` là nội dung cụ thể đã rà soát cho đúng hai slug có sẵn. Sinh lại bằng `node scripts/seo/build-reviewed-blog-patches.mjs` khi sửa hai bài TS. Script Python mặc định chỉ preview; `--apply` sao lưu, kiểm tra trạng thái/slug đối ứng/updated_at trước khi PATCH và xác minh kết quả. Nếu có người sửa cùng lúc, dừng để rà soát; không ghi đè.

```sh
python3 scripts/seo/apply_reviewed_blog_patches.py
python3 scripts/seo/apply_reviewed_blog_patches.py --apply
```

Không thêm credential vào repo. Rollback nội dung dùng backup ngoài repo sau khi kiểm tra không có sửa đổi mới; rollback mã bằng revert commit triển khai.

## Đo tiếp sau khi phát hành

1. Ngay sau deploy: xác minh bot + trình duyệt thường với `?nocache=1`, title/canonical/hreflang, **body thực**, EN/VI và trang 404. Kiểm tra schema trên trang thực, không chỉ bản rút gọn của web fetch.
2. Sau 7 ngày dữ liệu GSC đầy đủ: đọc từng URL đã đổi và query tương ứng; tách bài World Cup khỏi công cụ/lịch evergreen. Xem indexed/canonical, impressions, clicks và CTR tại nhóm vị trí tương đương; không đặt ngưỡng thắng/thua khi số impression quá ít.
3. Sau 28 ngày: so cửa sổ đủ dữ liệu bằng nhau, ghi rõ hiệu ứng mùa giải. Đối chiếu hành trình bắt đầu → tạo giải theo người dùng/journey nếu dữ liệu cho phép; event count riêng không đủ chứng minh conversion.
4. Kiểm tra field CWV/CrUX hoặc phân phối giá trị trước khi chọn tối ưu hiệu năng tiếp theo. Hiện chưa đủ bằng chứng để viết lại UI nặng hoặc tuyên bố CWV đã đạt.
5. Nội dung tự thử sản phẩm và backlink cần bằng chứng mới: làm diễn tập thực tế, lưu ảnh/lỗi/kết quả rồi mới ghi “đã thử”; chỉ xin liên kết ở nơi tài liệu hữu ích cho người đọc. Không mua link, không tạo review giả.

## Nguồn kiểm chứng nội dung

- [PPA Asia — Kuala Lumpur Cup](https://www.ppatour-asia.com/tournament/2026/kuala-lumpur-cup/): lịch 09–13/09; chưa tự suy ra nhà vô địch.
- [PPA Asia — Hong Kong Slam](https://www.ppatour-asia.com/tournament/2026/hong-kong-slam/): 19–25/10/2026.
- [PPA Asia — lịch mùa 2026](https://www.ppatour-asia.com/hong-kong-slam-to-close-2026-as-ppa-tour-asia-reveals-calendar/).
- [Challonge pricing](https://challonge.com/pricing): giới hạn và điều kiện của gói; tránh gán tính năng thiếu khi chưa kiểm chứng.
- [UTR Sports providers](https://www.utrsports.net/pages/providers): thông tin do nhà cung cấp công bố; không coi là thử nghiệm độc lập.
- [Google: dynamic rendering](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering): phương án xử lý JavaScript và khuyến nghị render phía máy chủ.
