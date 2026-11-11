# COURTS-EFFORT-READ — 7 bài sân sau khi viết lại từ danh mục sân (#868)

Đọc 11/11/2026. GSC `sc-domain:thepicklehub.net`, dimension `page`, `dataState=all`,
lọc `/blog/`, cộng đúng 14 URL (7 EN + 7 VI). Script dùng `query()` của
`scripts/seo/gsc_report.py`. Baseline đọc lại khớp số ghi trong mốc (EN 5/201, VI 4/256).

- Baseline: 14/09→11/10 (28 ngày, bản Wriai cũ không nêu tên sân).
- Sau: 14/10→08/11 (26 ngày; #868 merge 13/10, GSC trễ 3 ngày). Cửa sổ ngắn hơn 2 ngày.

## Tổng

| Nhóm | Baseline click / impr | Sau click / impr | CTR trước → sau |
|---|---|---|---|
| EN (7 bài) | 5 / 201 | 11 / 211 | 2.5% → 5.2% |
| VI (7 bài) | 4 / 256 | 14 / 662 | 1.6% → 2.1% |
| Tổng | 9 / 457 | 25 / 873 | 2.0% → 2.9% |

Theo ngày: 0.32 → 0.96 click/ngày (~3×).

## Theo trang (click / impr / pos)

| Bài | EN trước | EN sau | VI trước | VI sau |
|---|---|---|---|---|
| Vũng Tàu | 1/22/6.5 | 4/62/6.5 | 0/22/10.7 | 2/195/8.2 |
| Bình Dương | 0/14/29.4 | 0/8/5.0 | 0/18/8.2 | 3/78/20.5 |
| Cần Thơ | 1/11/6.1 | 3/36/5.3 | 2/130/8.5 | 1/20/10.7 |
| Đồng Nai | 0/4/7.0 | 0/4/4.0 | 0/8/9.5 | 5/146/7.8 |
| Hải Phòng | 0/17/6.0 | 1/23/8.6 | 0/30/7.3 | 1/121/8.4 |
| Nha Trang | 0/36/6.4 | 2/50/8.2 | 1/34/10.0 | 0/85/9.8 |
| Toàn quốc (guide) | 3/97/6.7 | 1/28/7.0 | 1/14/4.2 | 2/17/5.3 |

## Kết luận

- **Có lift, theo hướng dự đoán, nhưng mẫu nhỏ.** Click 9 → 25. EN tăng nhờ CTR
  (impr gần như đứng yên, CTR 2.5% → 5.2%). Title có số ("13 Venues & Prices")
  là giải thích hợp lý nhất cho phần này. VI tăng chủ yếu nhờ impression
  (256 → 662: Vũng Tàu, Đồng Nai, Hải Phòng), vị trí trung bình gần như không đổi.
- **Yếu tố gây nhiễu:** cụm `/san/` cùng kỳ cũng tăng (tuần 85–133 click tháng 9 →
  138–199 tháng 10, xem `seo-san-weekly.md`), nên không quy hết phần tăng cho #868.
  Bài sân tăng ~3× theo ngày, nhanh hơn mức tăng của cụm `/san/`.
- Bài toàn quốc EN giảm (3/97 → 1/28); bài city cụ thể là nơi thắng.
- Title VI hiển thị trên `/vi/blog/*` lấy từ `vi_blog_posts` (Supabase); lần đọc
  này không kiểm tra bản đó có đổi title cùng #868 không.

**Hướng lịch Wriai:** đủ tín hiệu để ưu tiên đề tài có dữ liệu riêng (danh mục sân,
kết quả, lịch) thay vì guide chung — khớp luật content effort 13/10. Chưa sửa
`scripts/ops/team_roles.json` / `WRIAI_BRIEF` trong PR này (chỉ doc); nếu muốn đổi
lịch thì sửa cả ba chỗ cùng lúc như CLAUDE.md yêu cầu.
