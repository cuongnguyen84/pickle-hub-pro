-- VI version of blog post "pickleball-world-cup-2026-vietnam-team-lineup"
-- Run AFTER the EN post is merged to main and deployed (the reciprocal
-- hreflang needs /blog/pickleball-world-cup-2026-vietnam-team-lineup live).
-- Idempotent: ON CONFLICT (slug) DO NOTHING.

INSERT INTO vi_blog_posts (
  slug, title, meta_title, meta_description, excerpt, content_html,
  cover_image_url, author_name, category, tags, focus_keyword,
  faq_items, related_post_slugs, alternate_en_slug, status, published_at
) VALUES (
  'doi-tuyen-pickleball-viet-nam-world-cup-2026',
  'Đội tuyển Việt Nam trước giờ G World Cup Pickleball 2026: đội hình không hoàn hảo, nhưng đủ để chiến',
  'Đội tuyển Việt Nam trước giờ G World Cup 2026',
  'Đội tuyển pickleball Việt Nam đá giải Đồng đội World Cup 2026 ở Đà Nẵng 3–6/9: kỳ vọng Lý Hoàng Nam và phép tính 6 trận.',
  'Lần đầu dự World Cup, ngay sân nhà Đà Nẵng, thiếu hai trụ cột — nhưng với Lý Hoàng Nam ở đỉnh phong độ, phép tính 6 trận vẫn mở cửa cho Việt Nam.',
  $html$
<h2>Trước giờ G: lần đầu tiên, ngay trên sân nhà</h2>
<p>Giải Đồng đội Quốc gia tại <strong>Heineken Pickleball World Cup 2026</strong> diễn ra từ <strong>3 đến 6/9</strong> tại Đà Nẵng. Đội tuyển Việt Nam nằm ở <a href="/vi/blog/bang-a-world-cup-pickleball-2026-doi-thu-viet-nam">bảng A</a>, ra quân gặp Colombia lúc 08:00 thứ Năm 3/9, sau đó lần lượt gặp Chile và Cayman Islands. Đây là lần đầu tiên Việt Nam tham dự ngày hội pickleball lớn nhất hành tinh — ngay trên sân nhà, trước hàng nghìn khán giả, giữa tuần lễ Quốc khánh. Bài này là góc nhìn của ThePickleHub về đội hình: ai vắng mặt, ai gánh kỳ vọng, và phép tính 6 trận quyết định mọi cuộc đối đầu ra sao. Đội hình từng trận là quyền của ban huấn luyện — mọi dự kiến bên dưới là phân tích, và chúng tôi nói rõ điều đó ở cuối bài. Vì không phải mọi thứ đều hoàn hảo. Xem thêm <a href="/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang">lịch thi đấu World Cup từng ngày</a>.</p>

<h2>Tổn thất: hai trụ cột, không ai ở 100%</h2>
<p>Đáng tiếc là trước thời khắc lịch sử, đội tuyển lại chịu tổn thất nhân sự cực kỳ đáng tiếc. <strong>Trương Vinh Hiển</strong> — một nửa của cặp đôi nam giành huy chương ở mọi chặng PPA Tour Asia mùa này — chấn thương, chưa hẹn ngày trở lại. <strong>Quang Dương</strong> liên tục dính chấn thương. Hai trụ cột, hai cái tên mà bất kỳ đội hình nào cũng muốn có, và cả hai đều không ở thể trạng tốt nhất. Đội hình Open 10 VĐV do ban huấn luyện công bố ngày 17/8/2026:</p>
<ul>
<li>Đỗ Minh Quân (đội trưởng)</li>
<li>Lý Hoàng Nam</li>
<li>Quang Dương</li>
<li>Phúc Huỳnh</li>
<li>Trương Vinh Hiển</li>
<li>Trịnh Linh Giang</li>
<li>Ken Tâm (Hồ Thị Trúc Tâm)</li>
<li>Sophia Huỳnh Trần</li>
<li>Trang Huỳnh</li>
<li>Sĩ Bội Ngọc</li>
</ul>

<h2>Lý Hoàng Nam — niềm trông chờ số 1</h2>
<p>Thời điểm này, tất cả hy vọng của người hâm mộ đổ dồn vào một người: <strong>Lý Hoàng Nam</strong>. Phong độ đang chạm đỉnh đúng lúc. Ở giải Cá nhân của World Cup, Nam vào chung kết cả hai nội dung anh dự — <strong>đơn nam</strong>, nơi anh thắng bán kết ngày 31/8 và sẽ gặp Phúc Huỳnh trong trận chung kết Pro toàn Việt Nam ngày 6/9, và <strong>đôi nam</strong>, nơi anh cùng Nguyễn Ảnh Gia Huy hạ Quang Dương – Harsh Mehta 11-15, 15-11, 15-12 ở bán kết. Lối đánh ngày càng hoàn thiện, tinh thần thi đấu ổn định. Nếu tôi là coach, tôi chắc chắn xếp Nam vào cả 3 trận anh có thể tham gia: đơn nam, đôi nam và một trận mixed. Với phong độ này, đơn nam và mixed có Nam là những trận Việt Nam nắm cửa thắng rất lớn — không nhiều đối thủ ở World Cup này chạm tới đẳng cấp đó. Theo dõi <a href="/vi/blog/ket-qua-pickleball-world-cup-2026-da-nang">kết quả mọi trận Pro tại Đà Nẵng, cập nhật liên tục</a>.</p>

<h2>Đôi nam: Giang và Nam</h2>
<p>Cặp <strong>Trịnh Linh Giang – Lý Hoàng Nam</strong> từng nhiều lần vô địch trong năm 2025, sự ăn ý được mài giũa qua hàng chục giải. Nói thẳng: chỉ nhóm đầu của nhánh đôi nam — những cặp cỡ Munro – Livornese hay Devilliers – Burnel, <a href="/vi/blog/doi-nam-chuyen-nghiep-pickleball-world-cup-2026-da-nang">hai cặp dẫn đầu nhánh cá nhân tại Đà Nẵng theo tổng điểm DUPR</a> — mới thật sự đáng lo. Còn lại, kể cả pro PPA như Acevedo hay Tellez, khi không có partner xứng tầm, cũng sẽ không quá khó với Giang và Nam. Đôi nam gần như chắc 1 điểm mỗi cuộc đối đầu.</p>

<h2>Đơn nam: Nam hoặc Phúc</h2>
<p>Lựa chọn giữa Lý Hoàng Nam và <strong>Phúc Huỳnh</strong> — và đó là lựa chọn xa xỉ: cả hai đều tiệm cận top thế giới ở nội dung đơn, đến mức chính họ sẽ gặp nhau ở chung kết đơn nam Pro giải Cá nhân ngày 6/9. Vòng bảng có thể thay phiên nhau, mỗi người một trận — giữ sức, tối ưu thể lực cho vòng knockout. Trình của cả hai hoàn toàn đủ để thắng đa số đối thủ tại World Cup này.</p>

<h2>Suất đôi còn lại: Quang Dương vẫn là phương án khác biệt</h2>
<p>Dù chấn thương, thật sự mà nói, <strong>Quang Dương</strong> ở ô số 2 vẫn là một cái gì đó khác biệt so với phần còn lại — đặc biệt khi các ngôi sao pro PPA của Mỹ không tham dự nội dung đồng đội năm nay. Sự kết hợp có thể là Quân – Quang Dương (kinh nghiệm và sự ổn định), hoặc Quang Dương – Phúc Huỳnh (sức bật và uy lực cả hai cánh). Cùng xem HLV chọn ai đứng cạnh Quang Dương — quyết định đó sẽ ảnh hưởng đến cơ hội của Việt Nam nhiều hơn bất kỳ lựa chọn nào khác.</p>

<h2>Đơn nữ: Ken Tâm</h2>
<p><strong>Ken Tâm</strong> đến giải với phong độ cao sau khi vừa vào chung kết một chặng PPA Tour Asia — á quân Macao Open 2026 — và là lựa chọn rõ ràng nhất cho vị trí đơn nữ. <strong>Sĩ Bội Ngọc</strong> nhiều khả năng là phương án dự bị, sẵn sàng vào thay khi lịch đấu hoặc đối thủ đòi hỏi.</p>

<h2>Đôi nữ: Sophia và Ken Tâm</h2>
<p><strong>Sophia Huỳnh Trần – Ken Tâm</strong> vừa vô địch đôi nữ tại Thâm Quyến trên PPA Tour — danh hiệu đầu tiên của pickleball Việt Nam ở đẳng cấp đó. Sự tiến bộ rõ rệt của Sophia thời gian gần đây, đặc biệt khi đứng cạnh Ken Tâm, đã biến cặp này thành lựa chọn mạnh nhất cho đôi nữ Việt Nam hiện tại. Đôi nữ từng là điểm yếu chết người của mọi đội hình Việt Nam. Giờ đã có lý do để hy vọng. Xem thêm <a href="/vi/blog/tay-vot-pickleball-viet-nam-dang-chu-y-2026">các tay vợt Việt Nam đáng chú ý năm 2026</a>.</p>

<h2>Hai đôi mixed — chìa khóa của mọi cuộc đối đầu</h2>
<p>Mixed chiếm 2 trong 6 trận, và là nơi các cuộc đối đầu sít sao được phân định. <strong>Mixed 1:</strong> Quân – Sophia hoặc Nam – Sophia. Sophia đã cùng Quân chinh chiến nhiều giải nên quen đánh mixed với partner Việt Nam; nếu lịch đấu cho phép, kết hợp với Nam đang ở đỉnh phong độ thì đây hoàn toàn là trận có thể lấy điểm. <strong>Mixed 2:</strong> Quang Dương – Ken Tâm, tổ hợp vừa được thử lửa ở nội dung mixed giải Cá nhân World Cup. Còn mới — nhưng cả hai đều đủ đẳng cấp cá nhân để bù đắp sự ăn ý chưa hoàn hảo.</p>

<h2>Phép tính 6 trận</h2>
<p>Nhớ thể thức: mỗi cuộc đối đầu giữa hai quốc gia gồm 6 trận — 1 đôi nam, 1 đôi nữ, 2 mixed, 1 đơn nam, 1 đơn nữ. Thắng nhiều trận hơn là thắng cuộc đối đầu; hòa 3-3 thì vào dreambreaker, nơi không ai muốn đứng. Với Nam ở đỉnh phong độ, 3 trận anh có thể tham gia — đơn nam, đôi nam, mixed — là 3 trận nghiêng hẳn về Việt Nam, gần như chắc điểm. Vấn đề quyết định nằm ở 3 trận còn lại: đơn nữ, đôi nữ và mixed thứ 2. <strong>Thắng 1 trong 3 trận đó = thắng cuộc đối đầu. Thua cả 3 = dreambreaker, và có thể tệ hơn.</strong> Đơn nữ và đôi nữ vẫn là bài toán khó trước các cường quốc thực thụ — nhưng với Ken Tâm đang phong độ cao và Sophia tiến bộ vượt bậc, hy vọng lấy ít nhất 1 điểm từ 3 trận này là có thật, không phải cầu may.</p>
<table>
<caption>Đội hình dự kiến từng trận — phân tích của ThePickleHub, không phải danh sách chính thức</caption>
<thead><tr><th>Trận</th><th>Đội hình dự kiến</th><th>Đánh giá</th></tr></thead>
<tbody>
<tr><td>Đơn nam</td><td>Lý Hoàng Nam / Phúc Huỳnh (thay phiên)</td><td>Cửa thắng rất cao</td></tr>
<tr><td>Đôi nam</td><td>Trịnh Linh Giang – Lý Hoàng Nam</td><td>Gần như chắc điểm</td></tr>
<tr><td>Mixed 1</td><td>Đỗ Minh Quân – Sophia, hoặc Lý Hoàng Nam – Sophia</td><td>Có thể lấy điểm</td></tr>
<tr><td>Mixed 2</td><td>Quang Dương – Ken Tâm</td><td>50/50, trần rất cao</td></tr>
<tr><td>Đơn nữ</td><td>Ken Tâm (dự bị: Sĩ Bội Ngọc)</td><td>Khó, nhưng có hy vọng</td></tr>
<tr><td>Đôi nữ</td><td>Sophia Huỳnh Trần – Ken Tâm</td><td>Đang tiến bộ vượt bậc</td></tr>
</tbody>
</table>

<h2>Thiếu người. Không thiếu hy vọng.</h2>
<p>Lần đầu tiên. Sân nhà. Thiếu người. Nhưng không thiếu hy vọng. Lý Hoàng Nam đang ở phong độ tốt nhất sự nghiệp. Giang ổn định. Quân kinh nghiệm. Phúc sẵn sàng. Quang Dương dù chấn thương vẫn nguy hiểm. Ken Tâm và Sophia đang tiến bộ từng ngày. Đội hình không hoàn hảo. Nhưng đủ để chiến.</p>

<h2>Phần nào là dữ kiện, phần nào là dự đoán</h2>
<p>Minh bạch để bạn tự đánh giá.</p>
<ul>
<li><strong>Dữ kiện:</strong> giải Đồng đội đấu 3–6/9/2026 tại Đà Nẵng; Việt Nam ở bảng A cùng Colombia, Chile, Cayman Islands, ra quân gặp Colombia 08:00 ngày 3/9; đội hình Open 10 VĐV công bố 17/8; Lý Hoàng Nam vào chung kết cả đơn nam lẫn đôi nam giải Cá nhân; Sophia – Ken Tâm vô địch đôi nữ Thâm Quyến; Ken Tâm á quân Macao Open 2026.</li>
<li><strong>Dự đoán:</strong> toàn bộ phân bổ đội hình từng trận trong bài là góc nhìn của ThePickleHub. Ban huấn luyện mới là người chốt danh sách mỗi cuộc đối đầu, và tình trạng chấn thương có thể thay đổi từng ngày. Hãy đọc bảng dự kiến như một bài phân tích, không phải thông báo chính thức.</li>
</ul>
$html$,
  '/images/blog/vietnam-pickleball-players-to-watch-2026-hero.webp',
  'Cuong Nguyen',
  'Giải đấu',
  ARRAY['doi tuyen pickleball viet nam','pickleball world cup 2026','world cup pickleball da nang','ly hoang nam','quang duong','ken tam','sophia huynh tran'],
  'đội tuyển pickleball việt nam',
  $faq$[
    {"question": "Đội tuyển Việt Nam thi đấu giải Đồng đội World Cup 2026 khi nào?", "answer": "Giải Đồng đội Quốc gia diễn ra 3–6/9/2026 tại Đà Nẵng. Việt Nam nằm ở bảng A, ra quân gặp Colombia lúc 08:00 thứ Năm 3/9, sau đó gặp Chile và Cayman Islands. Các trận chung kết diễn ra Chủ nhật 6/9 tại Cung Thể thao Tiên Sơn."},
    {"question": "Đội tuyển pickleball Việt Nam gồm những ai?", "answer": "Đội hình Open 10 VĐV công bố ngày 17/8/2026: Đỗ Minh Quân (đội trưởng), Lý Hoàng Nam, Quang Dương, Phúc Huỳnh, Trương Vinh Hiển, Trịnh Linh Giang, Ken Tâm, Sophia Huỳnh Trần, Trang Huỳnh và Sĩ Bội Ngọc. Trương Vinh Hiển chấn thương chưa hẹn ngày trở lại, Quang Dương cũng liên tục gặp vấn đề thể trạng."},
    {"question": "Thể thức đồng đội gồm những nội dung nào?", "answer": "Mỗi cuộc đối đầu giữa hai quốc gia gồm 6 trận: 1 đôi nam, 1 đôi nữ, 2 đôi nam nữ (mixed), 1 đơn nam và 1 đơn nữ. Đội thắng nhiều trận hơn thắng cuộc đối đầu; hòa 3-3 sẽ phân định bằng dreambreaker."},
    {"question": "Ai là hy vọng lớn nhất của Việt Nam ở giải Đồng đội?", "answer": "Lý Hoàng Nam. Anh vào chung kết cả đơn nam lẫn đôi nam ở giải Cá nhân World Cup, và sẽ gặp Phúc Huỳnh trong trận chung kết đơn nam toàn Việt Nam ngày 6/9. Nam có thể tham gia 3 trong 6 trận của một cuộc đối đầu — đơn nam, đôi nam và mixed — và cả 3 đều nghiêng về Việt Nam khi anh ra sân."},
    {"question": "Xem đội tuyển Việt Nam thi đấu trực tiếp ở đâu?", "answer": "ThePickleHub cập nhật tỉ số từng ván mọi trận Pro tại Đà Nẵng ở trang thepicklehub.net/live, và trang kết quả cập nhật liên tục cho tới các trận chung kết ngày 6/9."}
  ]$faq$::jsonb,
  ARRAY['bang-a-world-cup-pickleball-2026-doi-thu-viet-nam','ket-qua-pickleball-world-cup-2026-da-nang','lich-thi-dau-pickleball-world-cup-2026-da-nang','tay-vot-pickleball-viet-nam-dang-chu-y-2026'],
  'pickleball-world-cup-2026-vietnam-team-lineup',
  'published',
  now()
)
ON CONFLICT (slug) DO NOTHING;
