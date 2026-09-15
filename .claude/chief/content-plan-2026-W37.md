# Kế hoạch nội dung tuần 2026-W37 (07–13/09)

> Plan đầu tiên — do phiên Claude 07/09 soạn dựa trên khảo sát nội dung.
> Từ W38 trở đi, agent content tự soạn plan mỗi sáng thứ Hai.

Hiện trạng: VI blog 73 bài, nhịp tốt (liveblog World Cup 07/09). EN blog đứng
im từ 05/08 (51 bài). World Cup 2026 Đà Nẵng đang là dòng sự kiện nóng nhất.

## [x] ket-qua-chung-cuoc-world-cup-2026-da-nang — draft PR #742 (https://github.com/cuongnguyen84/pickle-hub-pro/pull/742) — CẬP NHẬT bài kết quả đã có (`pickleball-world-cup-2026-da-nang-results` / `ket-qua-pickleball-world-cup-2026-da-nang`, đang 2.500 click/tuần) thay vì viết bài mới cạnh tranh; VI DB = `docs/sql/2026-09-08-wc-results-vi-team-finals.sql` chưa áp
- Thứ Ba 08/09 · VI+EN · trụ Sự kiện · công thức BAB
- Từ khoá: "kết quả pickleball world cup 2026", "world cup pickleball đà nẵng"
- Lý do: sự kiện quốc tế trên sân nhà, search volume đang đạt đỉnh; EN đáng
  viết vì độc giả quốc tế theo dõi giải. Nếu giải chưa kết thúc khi viết →
  chuyển thành bài cập nhật vòng knockout + thành tích ĐT Việt Nam đến hiện tại.

## [x] doi-tuyen-viet-nam-world-cup-2026-nhin-lai — draft `vi_blog_posts` id 64d91ee9 (status=draft, published_at=null, 10/09) + file `.claude/chief/draft-doi-tuyen-viet-nam-world-cup-2026-nhin-lai.html`
- Thứ Năm 10/09 · VI · trụ Người Việt · công thức StoryBrand
- Từ khoá: "đội tuyển pickleball việt nam", tên các VĐV chủ lực
- Lý do: nối tiếp bài hồ sơ 03/09 đang có traffic; kể hành trình cả giải,
  khoảnh khắc đắt giá, điều rút ra cho phong trào trong nước.

## [ ] evergreen-vi-theo-gsc-gap
- Thứ Bảy 12/09 · VI · trụ Evergreen · công thức PAS
- Slug chốt khi viết: agent chạy `gsc_report.py --days 28`, chọn query có
  impression cao nhất mà site chưa có bài riêng (ưu tiên cụm kỹ thuật/luật/
  chi phí/chọn vợt). Fallback nếu GSC lỗi: "cách chọn vợt pickleball cho người
  mới 2026".
