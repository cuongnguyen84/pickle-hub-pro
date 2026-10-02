-- ============================================================================
-- 2026-09-08 · VI results article: fill the gaps the page said it could not.
--
-- Until now content_html said "chưa nguồn nào công bố kết quả chung kết Đồng
-- đội Junior và Đồng đội Senior". The organizers' bracket payload
-- (sporttora.com/pwc2026, read 2026-09-08 08:56 ICT) carries all five
-- national-team knockouts with per-rubber scores; An ninh Thủ đô (07/09 09:13)
-- independently confirms Juniors silver + Kids bronze for Vietnam; Dân trí
-- (07/09) carries the closing medal table, 117 gold / 272 total.
--
-- What changes: dateline → 8/9; closing medal table (117/272) replaces the
-- "106 carried forward" caveat; new "Huy chương Pro" section + table; the
-- Masters-team ambiguity is resolved (Vietnam fielded four teams); Juniors,
-- Kids, Masters runs with player names; all five team finals + bronze matches
-- + a five-division medal table; FAQ (3 items) and meta_description updated.
-- [[WC_RESULTS]] marker is preserved — both render paths still substitute it.
--
-- Idempotent — safe to re-run. Companion to the EN/TS twin in the same PR.
-- ============================================================================

UPDATE public.vi_blog_posts
SET
  meta_description = 'Kết quả Pickleball World Cup 2026 Đà Nẵng: Lý Hoàng Nam vô địch đơn nam, Mỹ thắng Việt Nam 4-0 chung kết Open, 117 HCV chủ nhà.',
  content_html = $html$
<h2>Kết quả mới nhất</h2>
<p>Heineken Pickleball World Cup 2026 tại Đà Nẵng đã khép lại <strong>Chủ nhật 6/9/2026</strong>, và cả năm trận chung kết Pro đều đã có kết quả. Cập nhật lần cuối <strong>thứ Ba 8/9/2026</strong>, bổ sung bảng tổng sắp chung cuộc và đủ năm trận chung kết đồng đội. Đơn nữ Pro: Katerina Stewart thắng Roos Van Reek 15-4, 15-9. Đơn nam Pro: <strong>Lý Hoàng Nam thắng Phúc Huỳnh 6-15, 16-14, 15-10</strong> — trận chung kết nội bộ Việt Nam duy nhất của giải. Đôi nam nữ Pro: Jack Munro – Nicola Schoeman thắng Lý Hoàng Nam – Roos Van Reek 15-11, 15-10. Đôi nữ Pro: Selina Turulja – Nicola Schoeman thắng Domenika Turkovic – Katerina Stewart 15-7, 15-8. Đôi nam Pro: Richard Livornese Jr – Jack Munro thắng Lý Hoàng Nam – Nguyễn Ảnh Gia Huy 15-12, 15-13. Ở chung kết Đồng đội Quốc gia Open lúc 19:40 — trận khép lại cả giải — <strong>Mỹ thắng Việt Nam 4-0 (21-17, 21-10, 21-16, 21-14)</strong>, Việt Nam giành huy chương bạc. Lý Hoàng Nam đánh bốn trong tám trận chung kết và thắng một. Ở giải đồng đội quốc gia, <strong>Mỹ vô địch bốn trong năm hạng mục</strong> — Open, Junior, Kids và Master — còn Brazil vô địch Senior; Việt Nam giành HCB Open, HCB Junior, HCĐ Kids và hạng tư Master, đối chiếu từ trang nhánh đấu của ban tổ chức. Giải diễn ra từ 30/8 đến 6/9/2026 với 69 nội dung, 156 đội tuyển quốc gia và gần 5.000 vận động viên từ hơn 80 quốc gia và vùng lãnh thổ. ThePickleHub theo dõi năm nội dung cá nhân Pro tại đây: bảng ngay bên dưới liệt kê mọi trận đã kết thúc ở các nội dung này, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu, ngày mới nhất lên đầu.</p>
<p>Xem thêm: <a href="/vi/blog/nhat-ky-pickleball-world-cup-2026-da-nang">Một tuần ở Đà Nẵng nhìn từ khán đài — ghi chép tại chỗ</a></p>
<p><strong>Về bảng bên dưới:</strong> giải đã kết thúc nên bảng là bản ghi cuối chứ không còn trực tiếp. Dữ liệu của ban tổ chức trả về trận Pro mới cuối cùng lúc <strong>17:57 ngày 6/9</strong>, ngay sau trận chung kết đôi nam, rồi ngừng. Dòng &quot;cập nhật lần cuối&quot; ở đầu bảng là giờ thật của lần làm mới cuối, không phải ngày viết bài. Việt Nam dẫn đầu bảng tổng sắp huy chương chung cuộc với <strong>117 HCV và 272 huy chương</strong>, theo Dân trí ngày 7/9; con số 106 HCV lan truyền tối 6/9 là số 5 ngày của Tuổi Trẻ được chép lại.</p>
<p><strong>Đường tới chung kết:</strong> Việt Nam nhất bảng A nội dung Open ngay trong ngày 3/9, thắng Chile, Quần đảo Cayman và Colombia cùng tỉ số 6-0 — 18 trận thắng, 0 thua. Sau đó thắng Nam Phi và Hà Lan ngày 4/9, thắng Australia 4-3 ở tứ kết (bị dẫn 8-12 trong ván phụ Final Battle rồi thắng ngược 21-16) và thắng Nhật Bản 4-0 ở bán kết ngày 5/9. Ở nhánh cá nhân, Lý Hoàng Nam vào chung kết đơn nam sau khi dẫn Quang Dương 15-8, 15-2 ở bán kết ngày 31/8 — theo Cổng thông tin TP Đà Nẵng, Quang Dương phải dừng trận vì chấn thương cổ tay; vào chung kết đôi nam cùng Nguyễn Ảnh Gia Huy sau màn ngược dòng 11-15, 15-11, 15-12 trước Quang Dương – Harsh Mehta; và vào chung kết đôi nam nữ cùng Roos Van Reek sau khi thắng Eunggwon Kim – Mihae Kwon 15-11, 15-10. Quang Dương – Harsh Mehta thắng trận tranh hạng ba đôi nam 15-10.</p>
[[WC_RESULTS]]
<p>Xem thêm: <a href="/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang">Lịch thi đấu đầy đủ cả hai giải, theo từng ngày</a></p>

<h2>Huy chương Pro: đủ năm nội dung</h2>
<p>Mười trong mười lăm huy chương Pro của Pickleball World Cup 2026 được định đoạt ngày 6/9, năm trận tranh HCĐ diễn ra sớm hơn trong tuần. Việt Nam có <strong>một HCV và ba HCB</strong> — Lý Hoàng Nam vô địch đơn nam, á quân đôi nam và đôi nam nữ; Phúc Huỳnh á quân đơn nam — cùng một HCĐ của Dương Thiên Quang – Harsh Mehta ở đôi nam. Các trận tranh HCĐ đánh một ván tới 15, riêng đôi nam nữ đánh ba ván thắng hai: Ronan Camron thắng William Sobek 15-10 và Virvienica Isearis Reyes Bejosano thắng Aaliya Ebrahim 15-9 ngày 31/8; Dương Thiên Quang – Harsh Mehta thắng Brandon Lane – Ryler DeHeart 15-10 và Roos Van Reek – Vivian Glozman thắng Bobbi Oshiro-Alconcel – Shelby Bates 15-12 ngày 1/9; Oshiro-Alconcel – Lane thắng Tang Nok Yiu – Wong Hong Kit 15-12, 15-12 ngày 6/9. Mọi tỉ số ở đây đều có trong bảng phía trên, lấy từ trang nhánh đấu của ban tổ chức.</p>
<table><caption>Huy chương Pro tại Pickleball World Cup 2026 Đà Nẵng</caption><thead><tr><th>Nội dung Pro</th><th>HCV</th><th>HCB</th><th>HCĐ</th><th>Chung kết</th></tr></thead><tbody><tr><td>Đơn nam</td><td>Lý Hoàng Nam</td><td>Phúc Huỳnh</td><td>Ronan Camron</td><td>6-15, 16-14, 15-10</td></tr><tr><td>Đơn nữ</td><td>Katerina Stewart</td><td>Roos Van Reek</td><td>Virvienica Isearis Reyes Bejosano</td><td>15-4, 15-9</td></tr><tr><td>Đôi nam</td><td>Richard Livornese Jr / Jack Munro</td><td>Lý Hoàng Nam / Nguyễn Ảnh Gia Huy</td><td>Dương Thiên Quang / Harsh Mehta</td><td>15-12, 15-13</td></tr><tr><td>Đôi nữ</td><td>Selina Turulja / Nicola Schoeman</td><td>Domenika Turkovic / Katerina Stewart</td><td>Roos Van Reek / Vivian Glozman</td><td>15-7, 15-8</td></tr><tr><td>Đôi nam nữ</td><td>Jack Munro / Nicola Schoeman</td><td>Lý Hoàng Nam / Roos Van Reek</td><td>Bobbi Oshiro-Alconcel / Brandon Lane</td><td>15-11, 15-10</td></tr></tbody></table>

<h2>Bảng này có gì và không có gì</h2>
<p>Nói rõ cho đúng, vì một trang kết quả nói quá phạm vi của mình thì tệ hơn một trang nói thẳng. Bảng phía trên chứa mọi trận đã kết thúc ở năm nội dung cá nhân Pro của Pickleball World Cup 2026 — cả trận Việt Nam lẫn trận nước ngoài. Thứ bảng không có là phần còn lại của giải cá nhân: các bảng nghiệp dư chia theo trình DUPR, cùng các nhánh trẻ, senior và master, vốn chạy lịch riêng và không thuộc hệ Pro. Tỉ số các trận đã xong lấy từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng, nên đây là kết quả thật chứ không phải ảnh chụp đông cứng. Giải đã kết thúc nên bảng không còn thay đổi: dữ liệu ban tổ chức trả về trận Pro mới cuối cùng lúc 17:57 ngày 6/9 rồi im.</p>

<h2>Bảng tổng sắp chung cuộc: Việt Nam 117 HCV, 272 huy chương</h2>
<p>Việt Nam dẫn đầu bảng tổng sắp Heineken Pickleball World Cup 2026 khi giải khép lại với <strong>117 huy chương vàng và 272 huy chương các loại</strong>, theo Dân trí ngày 7/9/2026, xếp trên Hàn Quốc 11 HCV và Hoa Kỳ 10 HCV. Cả Dân trí lẫn ban tổ chức đều chưa công bố số HCB và HCĐ chung cuộc, nên bảng dưới giữ các mốc đếm theo ngày mà báo chí đăng trong tuần (Tuổi Trẻ 4/9, 24h 3/9, đều dẫn ban tổ chức) và thêm con số HCV cùng tổng chung cuộc. ThePickleHub theo dõi năm nhánh Pro ở bảng phía trên, nhưng bảng tổng sắp đếm phạm vi rộng hơn rất nhiều, và khoảng cách lớn này đến từ cấu trúc giải chứ không phải từ tương quan trình độ. Giải có gần 8.500 trận trên bảy cụm sân tại Đà Nẵng, trung bình khoảng 1.000 trận mỗi ngày, trải trên 69 nội dung: giải đồng đội 156 đội, cộng với một chương trình cá nhân lớn hơn nhiều, chia theo trình DUPR, nhóm tuổi và hạng mục. Chủ nhà có số lượng VĐV dự các nhánh đó đông áp đảo, nên vào tới chung kết ở nhiều nhánh nhất. Tuổi Trẻ dẫn lời một thành viên Liên đoàn Cầu lông TP Đà Nẵng nói thẳng điều này: Liên đoàn Pickleball Việt Nam mới thành lập vài tháng, và nên xem Đà Nẵng 2026 là ngày hội thể thao — du lịch chứ không phải bảng xếp hạng sức mạnh pickleball các nước. Hai điều cùng đúng: con số là thật, và nó không mang ý nghĩa mà một bảng tổng sắp World Cup thường mang.</p>
<table><caption>Huy chương của đoàn Việt Nam tại Pickleball World Cup 2026, theo từng mốc</caption><thead><tr><th>Tính tới hết</th><th>HCV</th><th>HCB</th><th>HCĐ</th><th>Tổng</th></tr></thead><tbody><tr><td>1/9 (3 ngày)</td><td>90</td><td>62</td><td>54</td><td>206</td></tr><tr><td>2/9 (4 ngày)</td><td>96</td><td>66</td><td>58</td><td>220</td></tr><tr><td>3/9 (5 ngày)</td><td>106</td><td>chưa công bố</td><td>chưa công bố</td><td>244</td></tr><tr><td>6/9 (bế mạc, Dân trí 7/9)</td><td>117</td><td>chưa công bố</td><td>chưa công bố</td><td>272</td></tr></tbody></table>
<h2>Hai giải trên cùng một lịch</h2>
<p>Giải cá nhân và giải đồng đội quốc gia là hai giải riêng biệt dùng chung địa điểm và chung cái tên, và nhầm hai giải này là lỗi phổ biến nhất khi đưa tin về World Cup lần này. Giải cá nhân — các nhánh Pro trong bảng trên, cộng với các bảng nghiệp dư, trẻ, senior và master — bắt đầu Chủ nhật 30/8 và chạy tới 6/9/2026. Giải đồng đội quốc gia, nơi đội tuyển Việt Nam góp mặt, đã bắt đầu thứ Năm 3/9 và kết thúc Chủ nhật 6/9. Một vận động viên Việt Nam vô địch một nhánh Pro không có nghĩa là đội tuyển Việt Nam vô địch, và ngược lại.</p>
<table>
  <caption>Hai giải tại Pickleball World Cup 2026</caption>
  <thead><tr><th></th><th>Giải cá nhân</th><th>Giải đồng đội quốc gia</th></tr></thead>
  <tbody>
    <tr><td>Thời gian</td><td>30/8 – 6/9/2026</td><td>3/9 – 6/9/2026</td></tr>
    <tr><td>Ai dự</td><td>Cá nhân, theo trình DUPR và độ tuổi</td><td>156 đội, 5 hạng mục</td></tr>
    <tr><td>Việt Nam</td><td>VĐV Việt Nam ở nhiều nhánh</td><td>Hạt giống số 1, bảng A (Open)</td></tr>
    <tr><td>Thể thức</td><td>Nhánh đấu thông thường</td><td>6 trận ấn định mỗi cặp, 21 điểm, rally</td></tr>
    <tr><td>Có trong bảng trên</td><td>Có — năm nhánh Pro</td><td>Từ 3/9</td></tr>
  </tbody>
</table>

<h2>Việt Nam thi đấu ngày nào tại Pickleball World Cup 2026</h2>
<p>Việt Nam nhất bảng A nội dung Open tại Pickleball World Cup 2026 ngay trong ngày thứ Năm 3/9, thắng Chile, Quần đảo Cayman và Colombia cùng tỉ số 6-0 — tổng cộng 18 trận thắng, 0 thua — với tư cách hạt giống số 1. Các đội trẻ vào cuộc thứ Sáu 4/9: U18 ở bảng A cùng Malaysia, Costa Rica và Hàn Quốc, U14 ở bảng A cùng Úc và Singapore. Đó là giải đồng đội; còn ở các nhánh trẻ cá nhân, Việt Nam đã có một chức vô địch thế giới từ ngày 3/9, khi Tống Nhật Minh (Minh Tít) và Jolie Lam thắng Hudson Hall – Circa Luna Sacca 2-0 ở chung kết đôi nam nữ U18, ván đầu 15-7. Việt Nam có <strong>bốn đội tuyển</strong> chứ không phải ba: nhánh đấu của ban tổ chức ghi nhận đội Việt Nam ở cả Open, Junior, Kids và Master, khép lại chỗ vênh giữa tin bốc thăm 16/8 của TTXVN và bản công bố danh sách 17/8. Ba trong bốn đội có huy chương. Đội Junior — Lê Xuân Đức, Phạm Hoài Anh, Sophia Phương Anh và Đan Linh Hương — thắng Úc 3-1 ở tứ kết và Ấn Độ 3-2 ở bán kết ngày 5/9, hoà 2-2 sau bốn trận đôi rồi thắng ván phụ Final Battle 21-12, sau đó thua Mỹ 1-3 ở chung kết sáng 6/9, giành HCB. Đội Kids — Trần Đức Lâm, Nguyễn Gia Hưng, Phạm Ngọc Hà Vy và Nguyễn Hà My — thắng Đài Bắc Trung Hoa 3-0, thua Mỹ 1-3 ở bán kết (Mỹ sau đó vô địch) và thắng Nhật Bản 3-0 ở trận tranh HCĐ ngày 5/9. Đội Master — Đặng Anh Tài, Nguyễn Hữu Hòa, Nguyễn Thị Thu Hương, Phan Thị Mộng Lan và Nguyễn Bích Phượng — thắng Ấn Độ 3-2 ở tứ kết nhờ ván phụ Final Battle 21-16, rồi thua Úc 1-3 ở bán kết và thua Hàn Quốc 1-3 ở trận tranh HCĐ, xếp hạng tư. Vì một cặp đấu đồng đội là chuỗi trận đôi và đơn ấn định trước chứ không phải cuộc so tài giữa hai ngôi sao, chiều sâu đội hình quyết định nhiều hơn một cái tên lớn — cả ba trận tứ kết Open, Junior và Master của Việt Nam đều phải phân định bằng ván phụ Final Battle.</p>

<h2>Chung kết ngày 6/9 và ai đã vô địch</h2>
<p>Pickleball World Cup 2026 khép lại Chủ nhật 6/9/2026 tại Cung Thể thao Tiên Sơn, Đà Nẵng, với tám trận chung kết.</p>
<p><strong>Ba trận Đồng đội Quốc gia:</strong> Junior 08:00, <strong>Mỹ thắng Việt Nam 3-1</strong> — Sophia Phương Anh – Đan Linh Hương thua đôi nữ 20-22 trước Jayda Maldonado – CC Eleven Sacca, Lê Xuân Đức – Phạm Hoài Anh thắng đôi nam 21-12 trước Andrew Angulo – Hudson Hall, hai trận đôi nam nữ thua 13-21 và 10-21. Senior 14:00, Brazil thắng Tây Ban Nha 3-1 (21-16, 21-12, 28-30, 21-15). Open 19:40, trận khép lại cả giải, <strong>Mỹ thắng Việt Nam 4-0</strong> — Bobbi Oshiro-Alconcel – Katerina Stewart thắng Tâm Ken – Sophia Huỳnh Trần 21-17 ở đôi nữ, Jack Munro – Richard Livornese Jr thắng Lý Hoàng Nam – Trịnh Linh Giang 21-10 ở đôi nam, rồi hai trận đôi nam nữ 21-16 và 21-14, nên hai trận đơn không cần đấu. Việt Nam giành huy chương bạc — tấm huy chương đồng đội World Cup đầu tiên của pickleball Việt Nam, và là tấm thứ hai trong ngày. Hai chung kết đồng đội còn lại đã đấu từ thứ Bảy 5/9: Kids, Mỹ thắng Ấn Độ 3-0 (21-11, 21-11, 21-16); Master, Mỹ thắng Úc 3-0 (21-19, 21-16, 21-18). HCĐ thuộc về Hong Kong (Trung Quốc) ở Open (thắng Nhật Bản 4-3 sau ván phụ Final Battle), Brazil ở Junior (3-0 Ấn Độ), Việt Nam ở Kids (3-0 Nhật Bản), Hàn Quốc ở Master (3-1 Việt Nam) và Úc ở Senior (3-2 Singapore).</p>
<table><caption>Chung kết đồng đội quốc gia Pickleball World Cup 2026, đủ năm hạng mục</caption><thead><tr><th>Hạng mục</th><th>HCV</th><th>HCB</th><th>HCĐ</th><th>Tỉ số chung kết</th><th>Việt Nam</th></tr></thead><tbody><tr><td>Open</td><td>Mỹ</td><td>Việt Nam</td><td>Hong Kong (Trung Quốc)</td><td>4-0 (6/9, 19:40)</td><td>HCB</td></tr><tr><td>Junior</td><td>Mỹ</td><td>Việt Nam</td><td>Brazil</td><td>3-1 (6/9, 08:00)</td><td>HCB</td></tr><tr><td>Kids</td><td>Mỹ</td><td>Ấn Độ</td><td>Việt Nam</td><td>3-0 (5/9)</td><td>HCĐ</td></tr><tr><td>Master</td><td>Mỹ</td><td>Úc</td><td>Hàn Quốc</td><td>3-0 (5/9)</td><td>Hạng tư</td></tr><tr><td>Senior</td><td>Brazil</td><td>Tây Ban Nha</td><td>Úc</td><td>3-1 (6/9, 14:00)</td><td>Không vào vòng loại trực tiếp</td></tr></tbody></table>
<p><strong>Năm trận chung kết Pro trên sân 1 Tiên Sơn:</strong> đơn nữ, Katerina Stewart thắng Roos Van Reek 15-4, 15-9; đơn nam, <strong>Lý Hoàng Nam thắng Phúc Huỳnh 6-15, 16-14, 15-10</strong>; đôi nam nữ, Jack Munro – Nicola Schoeman thắng Lý Hoàng Nam – Roos Van Reek 15-11, 15-10; đôi nữ, Selina Turulja – Nicola Schoeman thắng Domenika Turkovic – Katerina Stewart 15-7, 15-8; đôi nam, Richard Livornese Jr – Jack Munro thắng Lý Hoàng Nam – Nguyễn Ảnh Gia Huy 15-12, 15-13. Lịch công bố xếp đôi nữ 17:00 và đôi nam 18:20, nhưng nhánh đấu ghi nhận hai trận này vào khoảng 15:45 và 17:05.</p>
<p>Quốc khánh 2/9 rơi vào thứ Tư, cũng là ngày Lễ khai mạc 18:00–20:00 — lễ khai mạc nằm giữa giải cá nhân chứ không phải trước giải, thêm một hệ quả của việc hai giải dùng chung một lịch.</p>
<p>Xem thêm: <a href="/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang">Cẩm nang xem và vé Pickleball World Cup 2026</a> · <a href="/vi/blog/cach-chia-bang-xep-lich-thi-dau-pickleball">Cách chia bảng và xếp lịch thi đấu pickleball</a> · <a href="/vi/blog/doi-tuyen-pickleball-viet-nam-world-cup-2026">Đội tuyển pickleball Việt Nam trước giờ G World Cup 2026</a> · <a href="/live">Bảng trực tiếp World Cup trên ThePickleHub</a></p>
$html$,
  faq_items = $faq$[
  {
    "answer": "ThePickleHub đăng kết quả đầy đủ Pickleball World Cup 2026 Đà Nẵng trên trang này: mọi trận đã kết thúc ở năm nội dung cá nhân Pro, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu. Giải khép lại ngày 6/9/2026 nên bảng là bản ghi cuối; dữ liệu ban tổ chức trả về trận Pro mới cuối cùng lúc 17:57 tối hôm đó rồi ngừng.",
    "question": "Xem kết quả Pickleball World Cup 2026 ở đâu?"
  },
  {
    "answer": "Có. ThePickleHub lấy tỉ số từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng. Giải đã kết thúc nên toàn bộ 714 trận trong bảng đều là kết quả chính thức, không còn trận nào đang chờ đồng bộ.",
    "question": "Đây có phải tỉ số chính thức của Pickleball World Cup 2026 không?"
  },
  {
    "answer": "Trang này bao gồm đầy đủ năm nội dung cá nhân Pro — đơn nam, đơn nữ, đôi nam, đôi nữ và đôi nam nữ — mọi trận đã kết thúc, không phân biệt quốc tịch. Các bảng nghiệp dư chia theo trình DUPR cùng các nhánh trẻ, senior và master là những giải riêng, không nằm trong bảng.",
    "question": "Trang này có đủ mọi trận của Pickleball World Cup 2026 không?"
  },
  {
    "answer": "Việt Nam có bốn đội tuyển và ba đội có huy chương. Đội Open nhất bảng A ngày 3/9 (thắng Chile, Quần đảo Cayman và Colombia cùng 6-0), thắng Úc 4-3 và Nhật Bản 4-0 ngày 5/9, rồi thua Mỹ 0-4 ở chung kết 6/9, giành HCB. Đội Junior thắng Úc 3-1 và Ấn Độ 3-2, thua Mỹ 1-3 ở chung kết, cũng HCB. Đội Kids giành HCĐ sau khi thắng Nhật Bản 3-0; đội Master xếp hạng tư sau khi thua Hàn Quốc 1-3 ở trận tranh HCĐ. Riêng ở nhánh trẻ cá nhân, Tống Nhật Minh và Jolie Lam vô địch thế giới đôi nam nữ U18 ngày 3/9.",
    "question": "Đội tuyển Việt Nam xếp hạng mấy ở giải đồng đội Pickleball World Cup 2026?"
  },
  {
    "answer": "Giải khép lại Chủ nhật 6/9/2026 tại Cung Thể thao Tiên Sơn, Đà Nẵng, với tám trận chung kết. Lý Hoàng Nam vô địch đơn nam Pro sau khi thắng Phúc Huỳnh 6-15, 16-14, 15-10; Katerina Stewart vô địch đơn nữ Pro sau khi thắng Roos Van Reek 15-4, 15-9; Jack Munro – Nicola Schoeman vô địch đôi nam nữ Pro; Selina Turulja – Nicola Schoeman vô địch đôi nữ Pro; Richard Livornese Jr – Jack Munro vô địch đôi nam Pro sau khi thắng Lý Hoàng Nam – Nguyễn Ảnh Gia Huy 15-12, 15-13; và Mỹ thắng Việt Nam 4-0 (21-17, 21-10, 21-16, 21-14) ở chung kết Đồng đội Quốc gia Open lúc 19:40 để lên ngôi vô địch, Việt Nam giành huy chương bạc. Mỹ còn vô địch đồng đội Junior (3-1 Việt Nam), Kids (3-0 Ấn Độ) và Master (3-0 Úc); Brazil vô địch Senior 3-1 trước Tây Ban Nha.",
    "question": "Ai vô địch Pickleball World Cup 2026 tại Đà Nẵng?"
  },
  {
    "answer": "69 nội dung — 33 nội dung cá nhân quốc tế và 36 nội dung của giải đồng đội quốc gia, với 156 đội tuyển ở 5 hạng mục: Open, Senior, Master, Junior và Kids.",
    "question": "Pickleball World Cup 2026 có bao nhiêu nội dung thi đấu?"
  },
  {
    "answer": "117 huy chương vàng và 272 huy chương các loại khi giải khép lại, theo Dân trí ngày 7/9/2026, xếp trên Hàn Quốc (11 HCV) và Hoa Kỳ (10 HCV); số HCB và HCĐ chung cuộc chưa được công bố. Con số này đếm toàn bộ các hạng mục của giải — giải đồng đội 156 đội, các nhánh Pro, và phần lớn hơn nhiều là các nhánh cá nhân nghiệp dư, nhóm tuổi và trẻ — chứ không phải năm nhánh Pro liệt kê trong bảng ở trang này. Chủ nhà có số VĐV dự các nhánh đó đông áp đảo, đây là lý do chính khiến khoảng cách rộng đến vậy.",
    "question": "Việt Nam giành bao nhiêu huy chương tại Pickleball World Cup 2026?"
  }
]$faq$::jsonb,
  updated_at = '2026-09-08T02:00:00+00:00'
WHERE slug = 'ket-qua-pickleball-world-cup-2026-da-nang';

-- Verify: expect 1 row, updated_at 2026-09-08, stale_marker = 0, live_marker > 0.
SELECT slug, updated_at, length(content_html) AS html_len,
       position('chưa nguồn nào công bố' in content_html) AS stale_marker,
       position('[[WC_RESULTS]]' in content_html) AS live_marker
FROM public.vi_blog_posts
WHERE slug = 'ket-qua-pickleball-world-cup-2026-da-nang';
