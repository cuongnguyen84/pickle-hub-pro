-- ROLLBACK SNAPSHOT — vi_blog_posts, taken 2026-07-27 before SEO P1 step 3.
--
-- Written BEFORE any write, because vi_blog_posts has no migration history, no
-- audit table and no trigger: an UPDATE overwrites content_html irrecoverably
-- and `git revert` does not reach it. This file IS the down migration. It is
-- the condition risk-auditor set for lowering the step from RED to AMBER
-- (docs/proposals/seo-p1-tasks-3-5/round2/risk-auditor.json).
--
-- The four rows below were all published and live at snapshot time.
-- To roll back: run the UPDATE for the affected slug via the Supabase
-- Management API query endpoint. Each restores content_html byte for byte.
--
-- Verify after restoring:
--   curl -sI -A "Googlebot" https://www.thepicklehub.net/vi/blog/<slug>?nocache=1


-- ─── cam-nang-xem-pickleball-world-cup-2026-da-nang ─────────────────────────────────────────────
-- status=published  updated_at=2026-07-26 08:07:49.037812+00  8438 chars
UPDATE vi_blog_posts
   SET content_html = $body$<h2>Tóm tắt nhanh</h2>
<p><strong>Heineken Pickleball World Cup 2026</strong> diễn ra từ <strong>30/8 đến 6/9/2026</strong> tại <strong>bảy địa điểm</strong> ở Đà Nẵng. Bài trụ cột của chúng tôi trả lời <em>"giải này là gì"</em>; bài này là phần thực tế đi kèm — đi lúc nào, sân nằm ở đâu, không ở Đà Nẵng thì xem bằng cách nào, và muốn thi đấu thì đăng ký ra sao.</p>
<p>Hai điều đáng biết trước. <strong>Gấp nhất</strong>: đăng ký thi đấu Giải Cá nhân đóng ngày <strong>31/7/2026</strong>, và chặng giá hiện tại là chặng cuối cùng. <strong>Đáng chú ý nhất với người Việt</strong>: đây sẽ là <strong>lần đầu tiên Việt Nam góp mặt</strong> tại World Cup Pickleball, với tư cách chủ nhà — các kỳ trước Việt Nam chưa từng có đội tuyển thi đấu.</p>
<p>👉 <a href="/vi/blog/world-cup-pickleball-2026-da-nang">Đọc bài đầy đủ về Heineken Pickleball World Cup 2026</a></p>

<h2>Tôi đăng ký thi đấu được không? Được — nhưng hạn chót là 31/7/2026</h2>
<p>Có hai giải chạy song song, và chỉ một giải mở cho bạn. Giải <strong>World Cup đồng đội quốc gia</strong> chỉ theo lời mời qua liên đoàn quốc gia. Song song là <strong>2026 Heineken International Tournament – Pickleball World Cup Edition</strong>, ai cũng đăng ký được qua nền tảng chính thức <strong>sporttora.com/pwc2026</strong> — trang này có sẵn giao diện tiếng Việt.</p>
<p>Điều kiện: <strong>có tài khoản DUPR đang hoạt động</strong>. Các nội dung phong trào chia theo <strong>trình DUPR từ 3.0 đến 5.0</strong>, ngoài ra có nhóm <strong>Pro</strong> riêng cùng nội dung <strong>Junior</strong> và <strong>xe lăn</strong>. Phí tăng dần qua từng chặng, và chặng đang mở là chặng cuối:</p>
<ul>
  <li>Unique Chance (1–30/5/2026): 30 USD nội dung đầu, 20 USD mỗi nội dung thêm — <em>đã đóng</em></li>
  <li>1º Presale (1–30/6/2026): 40 USD nội dung đầu, 20 USD mỗi nội dung thêm — <em>đã đóng</em></li>
  <li>2º Presale (1–15/7/2026): 50 USD nội dung đầu, 20 USD mỗi nội dung thêm — <em>đã đóng</em></li>
  <li><strong>Last Chance (16–31/7/2026): 60 USD nội dung đầu, 20 USD mỗi nội dung thêm — đang mở, và là chặng cuối</strong></li>
  <li>Nhóm <strong>Pro</strong>: 100 USD nội dung đầu, 75 USD mỗi nội dung thêm</li>
  <li><strong>Ưu đãi Junior Đà Nẵng</strong>: trọn gói 500.000₫ mỗi nội dung (không phí đăng ký, không phí dịch vụ)</li>
</ul>

<h2>Ưu đãi Junior Đà Nẵng mà gần như chưa báo nào viết</h2>
<p>Nếu con bạn từ <strong>8 đến 16 tuổi</strong> và gia đình <strong>cư trú tại Đà Nẵng</strong>, ban tổ chức có một mức giá địa phương khá kín tiếng cho các nội dung Junior: <strong>500.000₫ mỗi nội dung, trọn gói</strong> — không phí đăng ký, không phí dịch vụ cộng thêm. So với mức 60 USD quốc tế thì đây chỉ là một phần nhỏ.</p>
<p>Hai điều kiện cần nhớ: khi đăng ký phải <strong>chọn quốc tịch Việt Nam rồi chọn tỉnh/thành Đà Nẵng</strong>, và <strong>CCCD</strong> của VĐV sẽ được kiểm tra lúc check-in — khai sai sẽ bị tính lại theo giá chuẩn.</p>
<p>Đây là cách rẻ nhất để một gia đình Việt đưa con ra sân ở một giải vô địch thế giới, và theo những gì chúng tôi tra được thì chưa có báo Việt Nam nào đưa tin.</p>
<p>👉 <a href="/vi/san/khu-vuc/da-nang">Danh bạ sân pickleball Đà Nẵng — tìm chỗ tập trước đã</a></p>

<h2>Lịch từng ngày: hai buổi đáng canh nhất</h2>
<p>Lịch công bố cho thấy mỗi ngày thi đấu chạy từ <strong>08:00 đến 18:00</strong>, với hai buổi tối mới là khoảnh khắc dành cho khán giả. Lưu ý ban tổ chức ghi rõ lịch <em>"có thể thay đổi"</em> — nên xác nhận lại trước khi đặt vé máy bay theo một ngày cụ thể.</p>
<ul>
  <li><strong>CN 30/8</strong> — Đơn và đôi nam, đơn và đôi nữ (3.0–5.0), cùng Pro đơn nam và đơn nữ</li>
  <li><strong>Thứ Ba 1/9</strong> — Đôi nam, đơn nữ, đôi nam nữ (3.0–5.0), Pro đôi và Pro đôi nam nữ. <strong>Lễ khai mạc 18:00–20:00</strong></li>
  <li><strong>Thứ Năm 3/9</strong> — Đôi nam nữ Junior</li>
  <li><strong>Thứ Sáu 4/9</strong> — Đơn Junior và đơn xe lăn</li>
  <li><strong>CN 6/9</strong> — Đôi Junior và đôi xe lăn, sau đó <strong>Chung kết toàn bộ nhóm Pro 18:00–20:00</strong></li>
</ul>

<h2>Ở đâu: bảy địa điểm, không phải một</h2>
<p>Đây là chi tiết mà hầu hết bài preview đều nói sai, và nó quan trọng nếu bạn phải di chuyển. Giải <strong>không gói gọn trong một nhà thi đấu</strong> — nó trải ra bảy địa điểm khắp Đà Nẵng: hai nơi chính và năm cụm sân vệ tinh. Sân bay quốc tế Đà Nẵng (DAD) chỉ cách các địa điểm khoảng <strong>4,5km — chừng mười phút</strong>, tiện bất thường so với một sự kiện quy mô này.</p>
<ul>
  <li><strong>Cung Thể thao Tiên Sơn</strong> — 8 sân, đường Phan Đăng Lưu <em>(địa điểm chính)</em></li>
  <li><strong>Làng Thể thao Tuyên Sơn</strong> — 31 sân, đường Nại Nam 2 <em>(địa điểm chính)</em></li>
  <li>Trang Hoàng Pickleball — 16 sân <em>(vệ tinh)</em></li>
  <li>AK Pickleball — 9 sân <em>(vệ tinh)</em></li>
  <li>KingKong Pickleball — 8 sân <em>(vệ tinh)</em></li>
  <li>Hợp Thành Phát Pickleball — 8 sân <em>(vệ tinh)</em></li>
  <li>Furama Pickleball — 7 sân <em>(vệ tinh)</em></li>
</ul>
<p>👉 <a href="/vi/san/khu-vuc/da-nang">Xem toàn bộ sân pickleball tại Đà Nẵng</a></p>

<h2>Một lưu ý về con số sân</h2>
<p>Trang chủ của giải quảng cáo <em>"97 sân tại 7 địa điểm"</em>, nhưng trang địa điểm liệt kê ra <strong>87 sân</strong> (8 + 31 + 16 + 9 + 8 + 8 + 7), và có ghi thêm rằng đang cân nhắc thêm địa điểm. Chúng tôi liệt kê số sân theo từng địa điểm ở trên thay vì lấy một trong hai con số tổng, vì đó mới là thứ bạn dùng để lên kế hoạch được. Nhiều khả năng con số này còn thay đổi: giải vẫn đang bổ sung địa điểm khi chỉ còn sáu tuần nữa là khai cuộc.</p>

<h2>Không ở Đà Nẵng thì xem thế nào?</h2>
<p><strong>FPT Play</strong> vừa là đơn vị đồng tổ chức vừa là đơn vị <strong>phát sóng độc quyền</strong> tại Việt Nam, phát trên SmartTV, di động, FPT Play Box và fptplay.vn — cần thuê bao. FPT Play cũng nắm bản quyền độc quyền <strong>PPA Tour Asia 2026</strong>, nên một thuê bao phủ gần như toàn bộ pickleball chuyên nghiệp diễn ra tại Việt Nam năm nay.</p>
<p>Các thỏa thuận phát sóng quốc tế chưa được công bố. Từ nay tới tháng 8, kênh cập nhật nhanh nhất là Instagram chính thức (@pickleballworldcupofficial) và kênh YouTube của giải; ThePickleHub theo dõi song ngữ và cập nhật trận đấu trực tiếp.</p>
<p>👉 <a href="/vi/live">Xem pickleball trực tiếp trên ThePickleHub</a> · <a href="/vi/blog/lich-giai-pickleball-viet-nam-2026">Lịch giải Pickleball Việt Nam 2026</a></p>

<h2>Đi xem trực tiếp: đặt phòng sớm, và đây là lý do</h2>
<p>Giải cố ý trùng <strong>tuần lễ Quốc khánh 2/9</strong> — và đó chính là lý do bạn nên đặt phòng ngay bây giờ thay vì đợi tới tháng 8. Tuần đó vốn đã là cao điểm du lịch nội địa của Đà Nẵng, giờ có thêm World Cup chồng lên.</p>
<p>Ban tổ chức công bố danh sách khách sạn đối tác từ khoảng <strong>55–60 USD/đêm</strong> (Wink Hotel Danang Riverside và Danang Centre 55 USD, Wyndham Golden Bay Danang 60 USD). Đà Nẵng hiện có <strong>31 đường bay thẳng quốc tế từ 15 quốc gia</strong> — trong đó có Incheon, Busan, Narita, Osaka, Singapore, Kuala Lumpur, Bangkok, Manila và Bali — cùng các chuyến nội địa nối qua Hà Nội hoặc TP.HCM.</p>

<h2>Ngoài các trận đấu</h2>
<p>Có ba hoạt động bên lề mở cho người không thi đấu, và với các CLB, HLV Việt Nam thì chúng có thể còn giá trị lâu hơn cả bảng huy chương:</p>
<ul>
  <li><strong>Clinic pickleball cùng một tay vợt chuyên nghiệp</strong> — ban tổ chức nói sẽ công bố tên trong vài tuần tới</li>
  <li><strong>Referee Masterclass</strong> — lớp tập huấn trọng tài cả lý thuyết lẫn thực hành, do các trọng tài giàu kinh nghiệm đứng lớp</li>
  <li><strong>Pickleball World Promoters Forum</strong> — dự kiến quy tụ đại diện hơn 50 quốc gia, bàn về lộ trình đưa pickleball tới Olympic</li>
</ul>
<p>Chương trình chung còn có triển lãm gian hàng kết hợp trưng bày sản phẩm <strong>OCOP</strong> của các địa phương và triển lãm văn hóa giới thiệu các nước tham dự.</p>

<h2>Những gì vẫn chưa biết</h2>
<p>Nói thẳng về các khoảng trống, tính tới ngày <strong>17/7/2026</strong>:</p>
<ul>
  <li><strong>Giá vé cho khán giả chưa được công bố</strong> — nền tảng hiện chỉ bán suất đăng ký thi đấu, chưa bán vé vào cửa</li>
  <li>Tay vợt chuyên nghiệp đứng lớp clinic chưa được nêu tên</li>
  <li>Danh sách tay vợt top-20 được mời chưa xác nhận — <em>lời mời không đồng nghĩa với đăng ký</em>, nên mọi line-up đang lan truyền đều chỉ là đồn đoán</li>
  <li>Lịch thi đấu được ghi rõ là <em>có thể thay đổi</em></li>
</ul>
<p>Chúng tôi sẽ cập nhật bài này khi từng mục được xác nhận.</p>
$body$
 WHERE slug = 'cam-nang-xem-pickleball-world-cup-2026-da-nang';


-- ─── hcmc-open-2026 ─────────────────────────────────────────────
-- status=published  updated_at=2026-07-26 08:07:49.037812+00  7075 chars
UPDATE vi_blog_posts
   SET content_html = $body$<h2>Chặng tour chuyên nghiệp thứ hai của Việt Nam trong 2026</h2>
<p>Pickleball chuyên nghiệp trở lại Việt Nam trong tháng 8 này. <strong>MB Ho Chi Minh City Open</strong> — chặng PPA Tour Asia cấp 500 với tổng thưởng <strong>70.000 USD</strong> — diễn ra từ <strong>6 đến 9/8/2026</strong> tại Global City Sports Park, TP.HCM. Đây là chặng tour thứ hai của Việt Nam trong mùa giải, sau MB Hanoi Cup hồi tháng 4, và là sự kiện pickleball chuyên nghiệp lớn nhất mùa hè trước khi Pickleball World Cup đổ bộ Đà Nẵng cuối tháng.</p>
<p>Cổng đăng ký cho các nhánh nghiệp dư đã mở, và dù danh sách VĐV chuyên nghiệp chưa được công bố (tính đến 23/7, chỉ còn hơn hai tuần), mức độ quan trọng thì đã rõ: từ 2026, điểm PPA Tour Asia được tính vào bảng xếp hạng PPA toàn cầu hợp nhất, nên 500 điểm tại TP.HCM có giá trị vượt xa phạm vi khu vực. Bài preview này tổng hợp mọi thông tin đã xác nhận — và sẽ được cập nhật ngay khi line-up công bố. Xem thêm <a href="/vi/blog/lich-giai-pickleball-viet-nam-2026">lịch giải pickleball Việt Nam 2026 đầy đủ</a>.</p>

<h2>HCMC Open 2026 trong một cái nhìn</h2>
<p>Toàn bộ thông tin PPA Tour Asia đã xác nhận, tính đến 23/7/2026:</p>
<ul>
  <li><strong>Thời gian:</strong> 6–9/8/2026 (thứ Năm đến Chủ nhật)</li>
  <li><strong>Địa điểm:</strong> Global City Sports Park, City Park thuộc The Global City, TP.HCM</li>
  <li><strong>Cấp giải:</strong> PPA Asia 500 — cấp cao thứ hai trong hệ thống tour 2026</li>
  <li><strong>Tổng thưởng:</strong> 70.000 USD</li>
  <li><strong>Điểm xếp hạng:</strong> 500 điểm PPA cho nhà vô địch — tính vào bảng xếp hạng PPA toàn cầu</li>
  <li><strong>Nhà tài trợ:</strong> MB (tài trợ chính), JOOLA (đối tác trang thiết bị), Facolos, Franklin và Paddletek (đối tác vợt)</li>
  <li><strong>Nội dung:</strong> đơn nam/nữ, đôi nam/nữ và đôi hỗn hợp chuyên nghiệp — kèm đầy đủ nhánh nghiệp dư theo trình độ và độ tuổi</li>
  <li><strong>Đăng ký nghiệp dư:</strong> đang mở tại pickleballbrackets.com</li>
</ul>

<h2>Địa điểm: Global City Sports Park</h2>
<p>The Global City là khu đô thị mới rộng 117 ha tại TP. Thủ Đức, phía Đông TP.HCM, với khu liên hợp thể thao được xây để phục vụ các sự kiện quốc tế. Hệ thống sân pickleball tại đây kết hợp sân ngoài trời chuẩn quốc tế với khán đài hơn 300 chỗ và nhà thi đấu TGC Arena có điều hòa — chi tiết đáng chú ý cho một giải đấu diễn ra giữa mùa mưa miền Nam.</p>
<p>PPA Tour Asia từng tổ chức MB Vietnam Open 2025 tại TP.HCM, nhưng Global City Sports Park cho phiên bản 2026 một sân khấu lớn hơn và chuyên dụng hơn. Nếu bạn đến TP.HCM xem giải và muốn tự cầm vợt ra sân, hãy xem <a href="/vi/san/khu-vuc/tp-hcm">danh bạ sân pickleball tại TP.HCM</a> — thành phố có mạng lưới sân dày đặc bậc nhất châu Á.</p>

<h2>Tiền thưởng và điểm xếp hạng: chi tiết đầy đủ</h2>
<p>Tổng thưởng 70.000 USD được chia cho các nhánh đơn và đôi, với 500 điểm xếp hạng cho HCV. Đây là mức thưởng chính thức theo từng thành tích (giải đôi tính theo đội):</p>
<ul>
  <li><strong>HCV:</strong> 2.000 USD đơn / 5.500 USD đôi — 500 điểm</li>
  <li><strong>HCB:</strong> 1.000 USD đơn / 3.000 USD đôi — 400 điểm</li>
  <li><strong>HCĐ:</strong> 800 USD đơn / 1.800 USD đôi — 300 điểm</li>
  <li><strong>Hạng 4:</strong> 595 USD đơn / 1.450 USD đôi — 200 điểm</li>
  <li><strong>Tứ kết:</strong> 395 USD đơn / 800 USD đôi — 100 điểm</li>
  <li><strong>Vòng 16:</strong> 195 USD đơn / 420 USD đôi — 50 điểm</li>
</ul>

<h2>Ai sẽ thi đấu? Chờ line-up</h2>
<p>Chỉ còn hơn hai tuần nữa, PPA Tour Asia vẫn chưa công bố danh sách VĐV chuyên nghiệp (kiểm tra ngày 23/7/2026) — line-up thường được xác nhận trong những ngày sát giải, và chúng tôi sẽ cập nhật đầy đủ ngay khi có. Điều có thể nói ngay là người hâm mộ Việt Nam sẽ chờ đợi ai: <strong>Lý Hoàng Nam</strong> vô địch đơn nam MB Hanoi Cup hồi tháng 4 trong trận chung kết toàn Việt Nam với <strong>Trương Vinh Hiển</strong>. Từ đó, Vinh Hiển trở thành hiện tượng của mùa giải: vô địch tại Kuala Lumpur và giành HCV đôi nam cùng <strong>Đỗ Minh Quân</strong> tại Beijing Open tháng 6. Ngay tuần này, anh là tay vợt đang có phong độ cao nhất tại <strong>Leapmotor Singapore Open</strong> (23–26/7), nơi bảng đấu công bố xếp anh là hạt giống số 1 đơn nam — phép thử phong độ rõ ràng nhất trước TP.HCM.</p>
<p>Một chặng đấu sân nhà tại TP.HCM với 500 điểm xếp hạng toàn cầu chính là sân khấu mà thế hệ VĐV chuyên nghiệp mới của Việt Nam hướng tới — và các ngôi sao quốc tế của tour, trong đó có Tama Shimabukuro (Nhật Bản) với cú đúp tại Macao, được kỳ vọng góp mặt xuyên suốt chuỗi giải châu Á. Đọc thêm <a href="/vi/blog/ppa-tour-asia-2026-tong-ket-nua-mua">tổng kết giữa mùa PPA Tour Asia 2026</a>.</p>

<h2>Nhánh nghiệp dư: đăng ký thế nào</h2>
<p>Như mọi chặng PPA Tour Asia, HCMC Open mở cửa cho người chơi nghiệp dư — bạn có thể thi đấu cùng địa điểm, cùng tuần với các VĐV chuyên nghiệp. Giải nghiệp dư chia hai cách: theo trình độ (dưới 3.5, và từ 3.5 trở lên) và theo nhóm tuổi (U18, 19+, 35+, 50+), ở các nội dung đơn nam/nữ, đôi nam/nữ và đôi hỗn hợp.</p>
<p>VĐV được xếp theo thang điểm DUPR từ 2.0 đến 8.0 — nghiệp dư từ 2.0 đến 5.0 — nên bạn sẽ gặp đối thủ cùng trình độ. Đăng ký đang mở tại pickleballbrackets.com và số chỗ có hạn, nên nếu muốn thi đấu thay vì chỉ xem, hãy đăng ký sớm. Nếu chưa rõ điểm DUPR là gì, hãy bắt đầu từ <a href="/vi/blog/dupr-la-gi-huong-dan-cho-nguoi-choi-viet-nam">hướng dẫn DUPR cho người chơi Việt Nam</a>.</p>

<h2>Xem HCMC Open ở đâu</h2>
<p>Nếu bạn ở TP.HCM trong tuần diễn ra giải, sân vận động ngoài trời có hơn 300 chỗ ngồi và sự kiện được thiết kế như một trải nghiệm cho khán giả — bốn ngày thi đấu đỉnh cao giữa lòng thành phố. Nếu không thể đến sân, PPA Tour Asia phát trực tiếp trên kênh YouTube chính thức, và <a href="/live">chuyên mục Live của ThePickleHub</a> tổng hợp link xem, tỷ số và lịch thi đấu của mọi sự kiện lớn trong suốt tuần giải.</p>
<p>Chúng tôi sẽ đăng lịch thi đấu từng ngày khi tuần giải bắt đầu. Trong lúc chờ, xem <a href="/vi/blog/xem-ppa-tour-truc-tiep-2026">cách xem PPA Tour trực tiếp năm 2026 — đầy đủ mọi nền tảng</a>.</p>

<h2>Bức tranh lớn: tháng 8 lịch sử của Việt Nam</h2>
<p>HCMC Open mở màn cho tháng quan trọng nhất trong lịch sử pickleball Việt Nam. Ba tuần sau trận chung kết tại TP.HCM, <a href="/vi/blog/world-cup-pickleball-2026-da-nang">Heineken Pickleball World Cup đến Đà Nẵng (30/8 – 6/9)</a> — World Cup đầu tiên được tổ chức tại châu Á, dự kiến quy tụ hàng nghìn VĐV từ tối đa 80 quốc gia. Trước đó, chuỗi giải châu Á đi qua Leapmotor Singapore Open (23–26/7) — đang diễn ra ngay lúc này — một chặng PPA Asia 500 với 70.000 USD tiền thưởng, phép thử phong độ ngay trước TP.HCM.</p>
<p>Với một quốc gia mới đón chặng PPA Tour Asia đầu tiên năm 2025, việc tổ chức hai chặng tour và một kỳ World Cup trong cùng một mùa giải là tuyên bố rõ ràng về việc trọng tâm của môn thể thao này tại châu Á đang dịch chuyển về đâu. Muốn hiểu các hệ thống giải chuyên nghiệp vận hành ra sao — PPA, MLP, APP và PPA Tour Asia — hãy đọc <a href="/vi/blog/cac-giai-pickleball-chuyen-nghiep-2026-toan-canh">cẩm nang các giải pickleball chuyên nghiệp 2026</a>.</p>$body$
 WHERE slug = 'hcmc-open-2026';


-- ─── lich-giai-pickleball-viet-nam-2026 ─────────────────────────────────────────────
-- status=published  updated_at=2026-07-26 08:07:49.037812+00  6106 chars
UPDATE vi_blog_posts
   SET content_html = $body$<h2>Lịch giải pickleball Việt Nam 2026 — nhìn nhanh</h2>
<p>Việt Nam đang ở tâm điểm của làn sóng pickleball châu Á năm 2026. Chỉ trong một năm, nước ta đăng cai hai chặng PPA Tour Asia và kỳ Pickleball World Cup đầu tiên tổ chức tại châu Á — cộng thêm một hệ thống giải trong nước đang bùng nổ. Đây là lịch giải cập nhật liên tục cho mọi sự kiện lớn liên quan tới người chơi và fan Việt Nam trong 2026: các giải quốc tế trên sân nhà, lịch PPA Tour Asia đầy đủ của khu vực, và những giải trong nước lớn nhất. Ba sự kiện cần khoanh tròn trước tiên: MB Hanoi Cup (Hà Nội, 1–5/4, đã xong), Ho Chi Minh City Open (6–9/8), và Heineken Pickleball World Cup tại Đà Nẵng (30/8–6/9). Muốn hiểu bức tranh tổng thể các giải chuyên nghiệp, đọc thêm <a href="/vi/blog/cac-giai-pickleball-chuyen-nghiep-2026-toan-canh">toàn cảnh PPA, MLP, APP và PPA Tour Asia 2026</a>.</p>
<h2>Các giải quốc tế trên sân nhà Việt Nam 2026</h2>
<p>Hai loại sự kiện quốc tế đình đám rất khác nhau cùng đổ về Việt Nam năm nay. Thứ nhất, Việt Nam đăng cai hai trong mười chặng PPA Tour Asia: MB Hanoi Cup mở màn mùa giải hồi tháng 4 — và tạo ra một trận chung kết đơn nam toàn Việt, khi Lý Hoàng Nam thắng Trương Vĩnh Hiển — còn Ho Chi Minh City Open nối tiếp vào tháng 8. Thứ hai, hoàn toàn tách biệt với tour chuyên nghiệp, Đà Nẵng tổ chức Heineken Pickleball World Cup, lần đầu tiên World Cup đến châu Á. Cùng nhau, chúng biến 2026 thành năm lớn nhất từ trước tới nay của pickleball Việt Nam. Xem lại thành tích các tay vợt Việt trong bài <a href="/vi/blog/ppa-tour-asia-2026-tong-ket-nua-mua">PPA Tour Asia 2026 tổng kết nửa mùa</a>.</p>
<h2>Ho Chi Minh City Open (PPA Tour Asia) — 6–9/8/2026</h2>
<p>Ho Chi Minh City Open là một chặng PPA Tour Asia cấp 500, tổng thưởng 70.000 USD, dự kiến diễn ra 6–9/8/2026 — chặng thứ hai của Việt Nam trong năm, sau Hanoi Cup. Từ 2026, điểm PPA Tour Asia cộng vào bảng xếp hạng PPA toàn cầu, nên 500 điểm ở đây có giá trị vượt ra ngoài khu vực. Như ở các chặng châu Á khác, người chơi trong nước có thể đăng ký các nhánh nghiệp dư song song với pro — một cơ hội hiếm để thi đấu ngay tại nơi các ngôi sao hàng đầu góp mặt. Danh sách tay vợt chuyên nghiệp thường được chốt gần ngày thi đấu; khi có, chúng tôi sẽ bổ sung vào đây. Xem thêm <a href="/vi/blog/ppa-tour-asia-2026-lich-thi-dau-tien-thuong">lịch PPA Tour Asia đầy đủ, tiền thưởng và cách thi đấu</a>, hoặc <a href="/live">xem giải trực tiếp trên ThePickleHub</a>.</p>
<h2>Heineken Pickleball World Cup — Đà Nẵng, 30/8–6/9/2026</h2>
<p>Tách biệt với PPA Tour, Đà Nẵng đăng cai Heineken Pickleball World Cup từ 30/8 đến 6/9/2026 — kỳ World Cup đầu tiên từng tổ chức ở châu Á. Ban tổ chức kỳ vọng hơn 4.000 vận động viên từ tối đa 80 quốc gia và vùng lãnh thổ, tranh tài ở hai hệ: hệ Đồng đội quốc gia (các nội dung Open, Kids, Junior, Senior và Master) và hệ Cá nhân chia theo nhóm tuổi và trình độ DUPR. Các trận đấu dự kiến diễn ra tại những địa điểm như Cung Thể thao Tiên Sơn và Làng Thể thao Tuyên Sơn. Đọc bối cảnh, thể thức và lịch chi tiết trong bài <a href="/vi/blog/world-cup-pickleball-2026-da-nang">World Cup Pickleball 2026 tại Đà Nẵng</a>.</p>
<h2>Lịch PPA Tour Asia 2026 đầy đủ (cả 10 chặng)</h2>
<p>Fan Việt theo dõi cả tour khu vực, không chỉ hai chặng sân nhà — và cả hai sự kiện của Việt Nam đều nằm trong một mùa giải 10 chặng trải khắp bảy thị trường. Đây là lịch PPA Tour Asia 2026 đầy đủ, kèm tiền thưởng, cấp độ và trạng thái tính tới đầu tháng 7/2026 (các chặng Việt Nam in đậm):</p>
<ul>
<li><strong>MB Hanoi Cup — Hà Nội, Việt Nam — 1–5/4 — tối đa 300.000 USD (cấp 1000) — Đã xong</strong></li>
<li>Panas Kuala Lumpur Open — Malaysia — 13–17/5 — 50.000 USD (cấp 500) — Đã xong</li>
<li>Macao Open — Macao — 28–31/5 — 70.000 USD (cấp 500) — Đã xong</li>
<li>China Open — Trung Quốc — 17–21/6 — 70.000 USD (cấp 500) — Đã xong</li>
<li>Tokyo Open — Nhật Bản — 1–4/7 — 50.000 USD (cấp 500) — Đã xong</li>
<li>Singapore Open — Singapore — 23–26/7 — 70.000 USD (cấp 500) — Sắp diễn ra</li>
<li><strong>Ho Chi Minh City Open — Việt Nam — 6–9/8 — 70.000 USD (cấp 500) — Sắp diễn ra</strong></li>
<li>China Open 2 — Trung Quốc — 20–23/8 — 70.000 USD (cấp 500) — Sắp diễn ra</li>
<li>Kuala Lumpur Cup — Malaysia — 9–13/9 — tối đa 300.000 USD (cấp 1000) — Sắp diễn ra</li>
<li>Hong Kong Slam — Hồng Kông — 19–25/10 — tối đa 1.100.000 USD — Sắp diễn ra (chung mùa)</li>
</ul>
<p>Muốn biết PPA Tour Asia đứng ở đâu so với các tour khác, đọc <a href="/vi/blog/mlp-vs-ppa-2026-tour-nao-dang-xem">MLP vs PPA 2026 — nên xem giải nào</a>.</p>
<h2>Giải trong nước & phong trào tại Việt Nam</h2>
<p>Ngoài các sự kiện quốc tế, hệ thống giải trong nước của Việt Nam đã bùng nổ, với các giải câu lạc bộ, doanh nghiệp và mở rộng diễn ra gần như mỗi cuối tuần trên khắp cả nước. Một ví dụ của 2026 là giải Vietstock Pickleball tại TP.HCM (25/7), và các giải khối báo chí — doanh nghiệp như giải Báo Người Lao Động tổ chức đầu năm. Giải phong trào mới được công bố liên tục, nên một danh sách in một lần mỗi năm sẽ nhanh lỗi thời — cách theo kịp đáng tin cậy là theo dõi bảng tin sự kiện và danh bạ CLB. Nếu bạn tự quản lý một CLB, bạn có thể tổ chức và đăng giải của mình chỉ trong vài phút bằng bộ <a href="/tools">công cụ tạo bracket và xếp lịch miễn phí</a> — xem thêm <a href="/vi/blog/huong-dan-to-chuc-giai">hướng dẫn tổ chức giải pickleball từng bước</a>.</p>
<h2>Cách theo dõi mọi giải — và tìm sân để chơi</h2>
<p>Cách nhanh nhất để lịch giải này luôn hữu ích là để website tự theo dõi giúp bạn. ThePickleHub phát và liệt kê các trận trực tiếp, bám sát kết quả và bảng xếp hạng, đồng thời tổng hợp tin tức giải đấu liên quan tới Việt Nam theo từng sự kiện. Và nếu xem các pro thi đấu khiến bạn muốn chơi, bước tiếp theo nhanh nhất là tìm một sân gần bạn: mở <a href="/vi/san">danh bạ sân pickleball toàn quốc</a>, lọc theo thành phố của bạn, và đặt buổi tập đầu tiên. Chúng tôi làm mới trang này khi Singapore Open, Ho Chi Minh City Open và World Cup Đà Nẵng tới gần — hãy quay lại để xem line-up và kết quả đã xác nhận.</p>
<p><strong>Bắt đầu ngay:</strong> <a href="/live">xem giải pickleball trực tiếp trên ThePickleHub →</a></p>$body$
 WHERE slug = 'lich-giai-pickleball-viet-nam-2026';


-- ─── ppa-tour-asia-2026-lich-thi-dau-tien-thuong ─────────────────────────────────────────────
-- status=published  updated_at=2026-07-26 08:07:49.037812+00  6931 chars
UPDATE vi_blog_posts
   SET content_html = $body$<h2>PPA Tour Asia 2026 — Giải Pickleball chuyên nghiệp lớn nhất ngoài Mỹ</h2>
<p>PPA Tour Asia trở lại năm 2026 với mùa giải hoành tráng nhất từ trước đến nay — <strong>10 chặng đấu tại 7 thị trường châu Á</strong>, tổng tiền thưởng hơn <strong>2,15 triệu USD</strong>. Mùa giải mở màn với MB Hanoi Cup tại Việt Nam và kết thúc với Hong Kong Slam — giải pickleball chuyên nghiệp lớn nhất từng được tổ chức tại châu Á với tiền thưởng lên tới 1,1 triệu USD.</p>
<p>Dù bạn là fan theo dõi các pro hay VĐV nghiệp dư muốn thi đấu trên cùng sân với các ngôi sao, bài viết này cung cấp mọi thứ bạn cần biết về mùa giải 2026.</p>

<h2>Lịch thi đấu đầy đủ 2026</h2>
<p>Lịch PPA Tour Asia 2026 gồm 10 chặng từ tháng 4 đến tháng 10, trải dài qua Việt Nam, Malaysia, Macao, Trung Quốc, Nhật Bản, Singapore và Hồng Kông:</p>
<ol>
  <li><strong>MB Hanoi Cup</strong> — 1–5/4/2026 | Hà Nội, Việt Nam | Tiền thưởng lên tới $300,000 | Nhà thi đấu Mỹ Đình | Gần 800 VĐV đăng ký</li>
  <li><strong>Panas Kuala Lumpur Open</strong> — 13–17/5/2026 | Kuala Lumpur, Malaysia | $50,000</li>
  <li><strong>Macao Open</strong> — 27–31/5/2026 | Macao | $70,000 | Lần đầu PPA Tour đến Macao</li>
  <li><strong>China Open 1</strong> — 17–21/6/2026 | Trung Quốc | $70,000</li>
  <li><strong>Sansan Tokyo Open</strong> — 1–4/7/2026 | Tokyo, Nhật Bản | $50,000 | PPA Tour Asia lần đầu đến Nhật</li>
  <li><strong>Singapore Open</strong> — 23–26/7/2026 | Singapore | $70,000</li>
  <li><strong>Ho Chi Minh City Open</strong> — 6–9/8/2026 | TP.HCM, Việt Nam | $70,000 | Chặng thứ 2 tại Việt Nam</li>
  <li><strong>China Open 2</strong> — 20–23/8/2026 | Trung Quốc | $70,000</li>
  <li><strong>Kuala Lumpur Cup</strong> — 9–13/9/2026 | Kuala Lumpur, Malaysia | Lên tới $300,000</li>
  <li><strong>Hong Kong Slam</strong> — 19–25/10/2026 | Hồng Kông | Lên tới $1,100,000 | Trận chung kết mùa giải</li>
</ol>

<h2>Tổng tiền thưởng: 2,15 triệu USD cho cả mùa giải</h2>
<p>Mùa giải 2026 có tổng tiền thưởng ấn tượng phân bổ theo 3 hạng. Hai giải Slam (Hanoi Cup và Hong Kong Slam) có tiền thưởng lớn nhất — lần lượt <strong>$300,000</strong> và <strong>$1,100,000</strong>. Kuala Lumpur Cup cũng có $300,000. Bảy giải còn lại từ $50,000 đến $70,000 mỗi giải.</p>
<p>Riêng Hong Kong Slam chiếm hơn một nửa tổng tiền thưởng cả mùa — đây cũng là giải có cúp rồng, biểu tượng nhà vô địch mùa giải.</p>

<h2>Hệ thống xếp hạng hoạt động thế nào</h2>
<p>PPA Tour Asia dùng thang rating từ <strong>2.0 đến 8.0</strong>. VĐV nghiệp dư nằm trong khoảng 2.0–5.0, trong khi các pro thi đấu từ 5.0 trở lên. Xếp hạng dựa trên tổng điểm tích lũy qua các chặng đấu — càng tham gia nhiều giải và đi sâu, bạn càng leo cao.</p>
<p>Hong Kong Slam là cơ hội duy nhất để hoàn thành bộ huy chương 2026, bao gồm chiếc cúp rồng — biểu tượng nhà vô địch mùa giải.</p>
<p>Đọc thêm: <a href="/vi/blog/dupr-la-gi-huong-dan-cho-nguoi-choi-viet-nam">DUPR là gì? — hệ thống xếp hạng pickleball toàn cầu và ảnh hưởng đến seeding tại PPA Tour Asia (Phần 1/3)</a></p>

<h2>Play Where the Pros Play — VĐV nghiệp dư thi đấu cùng sao</h2>
<p>Điểm đặc biệt của PPA Tour Asia là chương trình <strong>"Play Where the Pros Play"</strong>. Không giống các tour thể thao chuyên nghiệp khác, PPA Tour Asia tổ chức giải nghiệp dư song song với giải pro tại mỗi chặng. Bạn được thi đấu trên cùng sân, cùng ánh đèn, cùng địa điểm với các pro.</p>
<p>Các giải nghiệp dư có phân hạng theo tuổi và trình độ. Đăng ký thường mở trước 6–8 tuần qua website chính thức <strong>ppatour-asia.com</strong>.</p>

<h2>Tại sao Việt Nam là trung tâm pickleball châu Á</h2>
<p>Việt Nam là quốc gia duy nhất có <strong>2 chặng đấu</strong> (Hà Nội và TP.HCM) trong mùa giải 2026. Lý do rõ ràng: Việt Nam dẫn đầu châu Á về nhận diện và tham gia pickleball.</p>
<p>Theo nghiên cứu của UPA Asia và YouGov, <strong>88% người Việt biết đến pickleball</strong> — cao nhất trong tất cả các quốc gia khảo sát. Hơn 37% dân số đã từng chơi, với hơn 16 triệu người chơi hàng tháng. MB Vietnam Cup 2025 tại Đà Nẵng đã lập kỷ lục Guinness với 7.906 khán giả trong ngày thứ Bảy.</p>
<p>Xem các giải đấu tại Việt Nam: <a href="/vi/tournaments">trang Giải đấu trên ThePickleHub</a>.</p>

<h2>Pickleball bùng nổ khắp châu Á: Những con số ấn tượng</h2>
<p>Khoảng <strong>812 triệu người châu Á</strong> đã từng chơi pickleball, với 282 triệu người chơi hàng tháng. Tăng trưởng <strong>60% mỗi năm</strong>, 62% người chơi mới biết đến môn thể thao này trong 2 năm gần đây.</p>
<ul>
  <li><strong>Ấn Độ</strong> dẫn đầu với 178 triệu người chơi thường xuyên.</li>
  <li><strong>Trung Quốc</strong> 60 triệu người chơi hàng tháng.</li>
  <li><strong>Malaysia</strong> tăng trưởng 132% về nhận diện pickleball.</li>
  <li><strong>Philippines</strong> dự kiến tăng từ 10.000 lên 50.000+ VĐV đến 2026.</li>
</ul>
<p>Những con số này giải thích tại sao PPA Tour Asia mở rộng mạnh mẽ trong 2026.</p>

<h2>Các tuyến thủ và câu chuyện đáng chú ý 2026</h2>
<p>Mùa giải 2026 có nhiều câu chuyện hấp dẫn. Tài năng trẻ từ Việt Nam, Malaysia và Trung Quốc đang vươn lên mạnh mẽ. Xu hướng <strong>"Đông gặp Tây"</strong> tiếp tục khi các pro Bắc Mỹ ngày càng sang châu Á tranh tài vì tiền thưởng hấp dẫn, đặc biệt là Hong Kong Slam $1,1 triệu.</p>
<p>Các giải nghiệp dư cũng rất thú vị, với VĐV phong trào từ khắp khu vực lần đầu trải nghiệm thi đấu chuyên nghiệp.</p>
<p>Đọc thêm: <a href="/vi/blog/tama-shimabukuro-15-tuoi-vao-chung-ket-ppa-atlanta">Tama Shimabukuro 15 tuổi vừa hạ số 1 và số 2 thế giới — kiểu tài năng trẻ đang trỗi dậy mạnh mẽ tại PPA Tour Asia</a> · <a href="/vi/live">Theo dõi livestream giải đấu trên ThePickleHub</a></p>

<h2>Cách theo dõi PPA Tour Asia 2026</h2>
<p>Cập nhật PPA Tour Asia 2026 qua nhiều kênh:</p>
<ul>
  <li><strong>Website chính thức</strong>: ppatour-asia.com — lịch, đăng ký, kết quả.</li>
  <li><strong>ESPN</strong> — phát sóng các giải lớn.</li>
  <li><strong>ThePickleHub</strong> — bài tường thuật, hồ sơ VĐV, thảo luận cộng đồng, và <a href="/vi/tools">công cụ tổ chức giải miễn phí</a>.</li>
  <li><strong>Mạng xã hội</strong>: Follow @ppatourasia trên Instagram và Facebook.</li>
</ul>

<h2>Ý nghĩa với pickleball toàn cầu</h2>
<p>PPA Tour Asia 2026 đánh dấu bước ngoặt cho pickleball như một môn thể thao toàn cầu. Với 2,15 triệu USD tiền thưởng, 10 chặng đấu tại 7 thị trường, và hàng trăm VĐV nghiệp dư thi đấu cùng các pro — tour đang xây dựng hệ sinh thái bền vững cho pickleball chuyên nghiệp tại châu Á.</p>
<p>Hong Kong Slam với $1,1 triệu USD ngang ngửa các giải lớn nhất Bắc Mỹ. Mô hình tích hợp nghiệp dư có thể trở thành khuôn mẫu phát triển pickleball ở các thị trường mới trên toàn thế giới.</p>
<p>Đọc thêm: <a href="/vi/blog/hop-dong-app-tour-vs-ppa-tour-2026">App Tour vs PPA Tour 2026: hai mô hình hợp đồng pro tour đang định hình tương lai pickleball</a> · <a href="/vi/blog/world-cup-pickleball-2026-da-nang">Pickleball World Cup 2026 tại Đà Nẵng — sự kiện toàn cầu kế tiếp tại Việt Nam</a></p>$body$
 WHERE slug = 'ppa-tour-asia-2026-lich-thi-dau-tien-thuong';

-- ─── ADDENDUM 2026-07-27 ────────────────────────────────────────────────
-- The first snapshot only captured content_html. meta_description and excerpt
-- also carried the wrong venue name, and they feed the SSR <meta> tags, the
-- og: tags and the BlogPosting JSON-LD — which is why "Global City Sports Park"
-- still appeared 6 times in the rendered VI page after content_html was fixed.
-- Caught by grepping the rendered HTML, not the column that was edited.
UPDATE vi_blog_posts SET
  meta_description = 'MB Ho Chi Minh City Open 6–9/8/2026 tại Global City Sports Park — chặng PPA Tour Asia 500, thưởng 70.000 USD. Lịch, đăng ký, cách xem.',
  excerpt = 'Pickleball chuyên nghiệp trở lại Việt Nam: MB Ho Chi Minh City Open — chặng PPA Tour Asia 500, tổng thưởng 70.000 USD — diễn ra 6–9/8/2026 tại Global City Sports Park, TP.HCM. Đăng ký nghiệp dư đã mở; bài viết cập nhật ngay khi line-up công bố.'
WHERE slug = 'hcmc-open-2026';

-- faq_items (venue name + added ticket FAQ) — restore:
UPDATE vi_blog_posts SET faq_items = $j$[{"answer": "MB Ho Chi Minh City Open diễn ra từ 6 đến 9/8/2026 tại Global City Sports Park (City Park, The Global City), TP. Thủ Đức, TP.HCM. Đây là chặng PPA Tour Asia cấp 500.", "question": "HCMC Open 2026 diễn ra khi nào, ở đâu?"}, {"answer": "70.000 USD. Nhà vô địch nhận 2.000 USD ở nội dung đơn và 5.500 USD mỗi đội ở nội dung đôi, kèm 500 điểm PPA tính vào bảng xếp hạng toàn cầu hợp nhất.", "question": "Tổng tiền thưởng HCMC Open 2026 là bao nhiêu?"}, {"answer": "Có. Giải mở các nhánh nghiệp dư theo trình độ (dưới 3.5 và từ 3.5 trở lên) và nhóm tuổi (U18, 19+, 35+, 50+) ở nội dung đơn, đôi và đôi hỗn hợp. Đăng ký tại pickleballbrackets.com, số chỗ có hạn.", "question": "Người chơi nghiệp dư có được thi đấu tại HCMC Open không?"}, {"answer": "Line-up chuyên nghiệp chưa được công bố (tính đến 23/7/2026). Danh sách thường xác nhận vài ngày trước giải — Lý Hoàng Nam và Trương Vinh Hiển là hai cái tên Việt Nam đáng chờ đợi nhất. Bài viết sẽ được cập nhật khi có line-up.", "question": "Những VĐV nào sẽ thi đấu tại HCMC Open 2026?"}, {"answer": "PPA Tour Asia phát trực tiếp trên kênh YouTube chính thức. Chuyên mục Live của ThePickleHub tổng hợp link xem, tỷ số và lịch thi đấu suốt tuần giải, còn nếu ở TP.HCM bạn có thể đến sân với hơn 300 chỗ ngồi.", "question": "Xem trực tiếp HCMC Open 2026 ở đâu?"}]$j$::jsonb WHERE slug = 'hcmc-open-2026';

-- ─── luat-pickleball-co-ban (step 4: added id="kitchen" + one glossary link) ───
UPDATE vi_blog_posts SET content_html = $body$<p>Pickleball đang bùng nổ tại Việt Nam. Hàng trăm sân mới mở trong năm 2025-2026, cộng đồng người chơi vượt mốc 100.000 thành viên. Nhưng khi bước ra sân lần đầu, nhiều người vẫn lúng túng: <strong>giao bóng thế nào mới đúng?</strong> <strong>Khi nào được lên vùng gần lưới?</strong> <strong>Ai phát bóng khi tỉ số 0-0?</strong></p>

<p>Bài này tóm gọn <strong>toàn bộ luật pickleball cơ bản</strong> theo USA Pickleball Association (tổ chức luật chuẩn toàn cầu) mà bạn cần biết để bắt đầu chơi — hiểu trong 5 phút, không rườm rà.</p>

<blockquote>
  <p>💡 Nếu bạn chưa biết pickleball là gì, đọc trước: <a href="/vi/blog/pickleball-la-gi">Pickleball là gì? Hướng dẫn A-Z 2026</a>.</p>
</blockquote>

<h2>1. Sân pickleball và thiết bị cơ bản</h2>

<h3>Kích thước sân</h3>

<p>Sân pickleball tiêu chuẩn <strong>dài 13,41m × rộng 6,10m</strong> (44 feet × 20 feet) — cùng kích thước cho cả đánh đơn (singles) và đánh đôi (doubles). Lưới cao <strong>91,4 cm ở hai đầu và 86,4 cm ở giữa</strong> (hụt 5cm giữa lưới).</p>

<p>Trên sân có 3 vùng chính:</p>

<ul>
  <li><strong>Vùng phát bóng (bên phải + bên trái)</strong>: 2 ô mỗi bên, chia bởi đường giữa sân.</li>
  <li><strong>Vùng không volley hay "Kitchen"</strong>: dải rộng <strong>2,13m</strong> tính từ lưới sang mỗi bên. Đây là vùng quan trọng nhất (chi tiết bên dưới).</li>
  <li><strong>Baseline</strong>: đường cuối sân — nơi đứng khi giao bóng.</li>
</ul>

<h3>Thiết bị</h3>

<ul>
  <li><strong>Vợt (paddle)</strong>: bằng vật liệu composite/graphite/polymer, nhẹ hơn vợt tennis, không có dây căng. Giá vợt cho người mới từ 600k-1,5 triệu VNĐ.</li>
  <li><strong>Bóng</strong>: bóng nhựa có lỗ (giống bóng wiffle), dùng <strong>bóng outdoor</strong> khi chơi ngoài trời (nặng hơn, lỗ nhỏ hơn, ít bị gió thổi) và <strong>bóng indoor</strong> khi chơi trong nhà.</li>
  <li><strong>Giày</strong>: giày thể thao đế bằng, đế cao su bám tốt. <strong>Tránh dùng giày chạy bộ</strong> vì dễ trật mắt cá khi di chuyển ngang.</li>
</ul>

<h2>2. Cách tính điểm pickleball — "Only serve team scores"</h2>

<p>Đây là <strong>luật dễ sai nhất</strong> với người mới. Quy tắc vàng: <strong>chỉ đội giao bóng mới được ghi điểm</strong>.</p>

<h3>Luật điểm cơ bản (traditional scoring)</h3>

<ul>
  <li>Đội giao bóng thắng rally → <strong>+1 điểm</strong> cho đội giao bóng.</li>
  <li>Đội nhận bóng thắng rally → <strong>KHÔNG ghi điểm</strong>. Chỉ giành quyền giao bóng (side-out).</li>
  <li>Trận thắng khi 1 đội đạt <strong>11 điểm với cách biệt ≥ 2 điểm</strong> (có thể kéo dài tới 15, 17, 19... cho đến khi cách biệt 2).</li>
</ul>

<h3>Cách đọc tỉ số (3 số)</h3>

<p>Trong đánh đôi, tỉ số đọc bằng <strong>3 con số</strong>: <code>[Điểm đội giao] – [Điểm đội nhận] – [Số người đã giao (1 hoặc 2)]</code>.</p>

<p>Ví dụ: "<strong>5 – 3 – 2</strong>" nghĩa là:</p>

<ul>
  <li>Đội giao bóng đang có 5 điểm.</li>
  <li>Đội nhận bóng có 3 điểm.</li>
  <li>Đây là người giao thứ 2 của đội (second server).</li>
</ul>

<h3>Start of game — chỉ 1 server giao đầu tiên</h3>

<p>Khi bắt đầu trận (0-0-2), đội giao đầu tiên chỉ có <strong>1 lượt giao duy nhất</strong> rồi mất quyền giao. Quy tắc này gọi là <strong>"0-0-2 rule"</strong> hoặc "start as second server". Sau đó mọi đội đều có 2 server.</p>

<h3>Rally scoring (luật mới PPA Tour)</h3>

<p>Giải chuyên nghiệp PPA Tour từ 2024 đã chuyển sang <strong>rally scoring</strong>: mỗi rally đều ghi điểm cho đội thắng (bất kể ai giao). Nhưng <strong>giải phong trào và trận thường tại Việt Nam vẫn dùng traditional scoring</strong>.</p>

<blockquote>
  <p>💡 Xem thêm: <a href="/vi/blog">Các thể thức giải pickleball phổ biến</a> — bao gồm round robin, single elimination, double elimination.</p>
</blockquote>

<h2>3. Luật giao bóng (serve rule)</h2>

<h3>Vị trí giao</h3>

<ul>
  <li>Người giao đứng <strong>sau baseline</strong>, bên phải khi tỉ số đội giao là số chẵn (0, 2, 4...) — bên trái khi tỉ số lẻ.</li>
  <li>Bóng phải được giao <strong>chéo sân</strong> sang ô đối diện bên kia lưới.</li>
</ul>

<h3>Kỹ thuật giao bóng</h3>

<p>Từ 2021, luật cho phép <strong>2 kiểu giao</strong>:</p>

<ol>
  <li><strong>Volley serve (giao không nảy)</strong>: Đánh bóng trực tiếp từ tay, <strong>điểm tiếp xúc phải dưới eo</strong>, <strong>cổ tay không lật lên trên</strong>, mặt vợt hướng lên hoặc ngang.</li>
  <li><strong>Drop serve (giao thả nảy)</strong>: Thả bóng từ tay xuống đất cho nảy tự nhiên, sau đó đánh. Không có hạn chế về góc cổ tay hay hướng vợt.</li>
</ol>

<p><strong>Drop serve dễ hơn cho người mới</strong> — không cần chuẩn động tác phức tạp.</p>

<h3>Luật 2 lần nảy (double bounce rule)</h3>

<p>Sau khi giao bóng:</p>

<ol>
  <li>Đội nhận <strong>phải để bóng nảy 1 lần</strong> trước khi đánh trả.</li>
  <li>Đội giao <strong>cũng phải để bóng đối phương trả về nảy 1 lần</strong> trước khi đánh.</li>
</ol>

<p>Sau 2 lần nảy này, 2 đội mới được đánh volley (đánh bóng không nảy) tự do.</p>

<p>Luật này giúp trận không kết thúc quá nhanh và cho đội nhận cơ hội di chuyển lên phía trước.</p>

<h2>4. Vùng "Kitchen" — Luật quan trọng nhất trong pickleball</h2>

<p>Vùng không volley (kitchen) là dải <strong>2,13m gần lưới</strong> của mỗi bên. Đây là vùng đặc trưng nhất của pickleball — không tồn tại trong tennis hay cầu lông.</p>

<h3>3 quy tắc vàng của Kitchen</h3>

<ol>
  <li><strong>KHÔNG được volley (đánh bóng không nảy) khi đứng trong kitchen</strong>. Kể cả 1 ngón chân chạm vạch kitchen cũng là lỗi.</li>
  <li><strong>Không được volley nếu momentum sau cú đánh đưa bạn vào kitchen</strong> (dù lúc đánh bạn đứng ngoài kitchen).</li>
  <li><strong>ĐƯỢC phép vào kitchen</strong> để đánh bóng đã nảy — tức groundstroke trong kitchen là hợp lệ.</li>
</ol>

<h3>Tại sao có kitchen?</h3>

<p>Lưới pickleball thấp và sân ngắn. Nếu không có kitchen, mọi người sẽ chạy sát lưới và smash xuống — trận đấu trở nên không có rally. Kitchen buộc người chơi phải đứng cách lưới ít nhất 2,13m để volley, tạo ra các pha bóng "dink" (bóng ngắn nhẹ qua lưới) đặc trưng của pickleball.</p>

<h3>Lỗi kitchen phổ biến với người mới</h3>

<ul>
  <li><strong>Đánh volley xong đà chạy vào kitchen</strong> → lỗi, mất điểm.</li>
  <li><strong>Vợt chạm vạch khi đánh volley</strong> → không sai, chỉ bàn chân mới quan trọng.</li>
  <li><strong>Partner đứng giúp trong kitchen</strong> → không sai nếu partner không đánh bóng.</li>
</ul>

<h2>5. Lỗi thường gặp khi mới chơi</h2>

<p>Ngoài lỗi kitchen, người mới hay mắc 5 lỗi sau:</p>

<h3>Lỗi 1: Giao bóng sai vị trí</h3>

<p>Người giao nhầm ô bên phải/bên trái vì không nhớ tỉ số chẵn/lẻ. <strong>Mẹo</strong>: tỉ số 0 coi là chẵn — server đứng bên phải.</p>

<h3>Lỗi 2: Đánh volley khi bóng chưa nảy đủ 2 lần</h3>

<p>Sau khi giao, đội giao thường reflexively volley ngay khi đội nhận trả lại. Sai — phải để bóng nảy trước.</p>

<h3>Lỗi 3: Đánh bóng ra ngoài baseline mà nghĩ là vào</h3>

<p>Bóng chạm <strong>vạch là vào</strong> (line in). Chỉ khi bóng chạm đất rõ ràng ngoài vạch mới tính out. Khi có tranh cãi, người đánh sai được quyết định.</p>

<h3>Lỗi 4: Gọi "out" sớm khi bóng chưa chạm đất</h3>

<p>Không được gọi "out" khi bóng còn trên không — phải chờ bóng chạm đất. Nếu lỡ gọi và bóng rơi vào sân → đội bạn bị tính sai (hindrance).</p>

<h3>Lỗi 5: Đánh bóng khi chưa đến lượt (trong đánh đôi)</h3>

<p>Trong pickleball đôi, <strong>cả 2 người trong đội đều có thể đánh bóng</strong> ở bất kỳ vị trí. Không có luật "lượt" như cầu lông. Nhưng người giao phải đúng (người đang ở chỗ giao phù hợp với tỉ số chẵn/lẻ).</p>

<h2>6. Một số lỗi "ẩn" — người chơi cấp cao còn nhầm</h2>

<h3>Double hit (đánh bóng 2 lần liên tiếp)</h3>

<p>Đánh bóng bật khỏi vợt mình và cố tình đánh tiếp lần 2 → lỗi. Nhưng nếu là <strong>continuous motion</strong> (một động tác liền, bóng trượt trên vợt tạo ra "đánh đôi" không chủ ý) → vẫn hợp lệ.</p>

<h3>Carry / sling</h3>

<p>Bóng "dính" trên vợt rồi được hất đi → lỗi carry. Bóng phải được đánh bật ra ngay, không giữ trên mặt vợt.</p>

<h3>Chạm người/quần áo</h3>

<p>Bóng chạm người chơi (không phải vợt) → lỗi, <strong>kể cả khi bóng sẽ out</strong>. Ví dụ: bóng đi vào người bạn nhưng chắc chắn sẽ ra ngoài → bạn vẫn thua điểm.</p>

<h3>Reach over the net</h3>

<p>Với vợt qua lưới để đánh bóng khi bóng còn bên sân đối thủ → lỗi. Nhưng nếu bóng đã bật ngược trở lại phía bạn (vd: backspin đưa bóng về sân đối phương rồi quay lại) — bạn được phép với qua lưới để đánh.</p>

<h2>7. Thể thức thi đấu phổ biến tại Việt Nam</h2>

<p>Khi tham gia giải hoặc chơi trong club:</p>

<ul>
  <li><strong>Đơn (singles)</strong> — 1 vs 1, ít phổ biến ở Việt Nam vì tốn thể lực.</li>
  <li><strong>Đôi (doubles)</strong> — 2 vs 2, phổ biến nhất.</li>
  <li><strong>Mixed doubles</strong> — 1 nam + 1 nữ mỗi đội.</li>
  <li><strong>Round robin</strong> — mọi đội gặp nhau 1 lần, tính điểm theo tổng trận thắng. Phù hợp cho club 8-16 người, thời gian 2-3 giờ.</li>
  <li><strong>Single/Double elimination</strong> — loại trực tiếp, phù hợp giải đấu quy mô 16-64 đội.</li>
</ul>

<blockquote>
  <p>💡 Bạn tổ chức giải club? Thử <a href="/tools/quick-tables">công cụ tạo bracket miễn phí</a> — hỗ trợ round robin, loại đơn, loại kép cho số người tuỳ ý.</p>
</blockquote>

<h2>8. Người mới nên bắt đầu như thế nào?</h2>

<h3>Tuần 1-2: Làm quen</h3>

<ul>
  <li>Học cách cầm vợt (continental grip — như cầm búa).</li>
  <li>Tập "dink" (đánh bóng nhẹ qua lưới) 15-20 phút mỗi buổi.</li>
  <li>Làm quen cảm giác bóng — nảy của pickleball chậm hơn tennis, cần chờ.</li>
</ul>

<h3>Tuần 3-4: Vào sân thi đấu phong trào</h3>

<ul>
  <li>Tham gia club tại địa phương. <a href="/vi/blog/top-san-pickleball-ha-noi-2026">Danh sách sân pickleball Hà Nội 2026</a> có chi tiết giờ mở, giá thuê.</li>
  <li>Chơi với người cùng trình độ — đừng ngại hỏi luật, cộng đồng pickleball rất thân thiện với người mới.</li>
</ul>

<h3>Tuần 5 trở đi: Cải thiện kỹ thuật</h3>

<ul>
  <li>Học thêm kỹ thuật: 3rd shot drop, lob, volley, smash.</li>
  <li>Xem các trận PPA Tour Asia trên livestream để học vị trí sân và chiến thuật.</li>
</ul>

<h2>9. Câu hỏi thường gặp về luật pickleball (FAQ)</h2>

<h3>Luật pickleball có giống tennis không?</h3>
<p>Giống ở kích thước sân và giao chéo, khác ở: (1) sân ngắn hơn tennis, (2) có vùng kitchen cấm volley, (3) tính điểm kiểu side-out (chỉ đội giao ghi điểm, trừ rally scoring PPA Tour), (4) bóng nhựa có lỗ thay vì bóng nỉ.</p>

<h3>Tại sao bóng pickleball phải để nảy trước khi đánh trả lần đầu?</h3>
<p>Đây là "double bounce rule" — buộc cả 2 đội để bóng nảy 1 lần ở 2 cú đánh đầu (cú giao + cú trả). Luật này cân bằng lợi thế, không cho đội giao volley-smash ngay và tạo cơ hội đội nhận tiến lên phía trước.</p>

<h3>Có được thay vợt giữa trận không?</h3>
<p>Có, nhưng chỉ giữa các game (không giữa một rally). Trong giải đấu chính thức, trọng tài có thể kiểm tra vợt thay thế xem có hợp chuẩn USAPA không.</p>

<h3>Khi bóng chạm lưới và rơi sang sân đối phương trong lúc giao, xử sao?</h3>
<p>Trước 2021 đó là "let" (giao lại). Từ 2021, <strong>luật mới của USAPA bỏ let serve</strong> — bóng chạm lưới và rơi vào ô giao hợp lệ → vẫn tính hợp lệ, trận tiếp tục.</p>

<h3>Có được đánh bóng bằng mặt sau của vợt không?</h3>
<p>Có. Luật pickleball không phân biệt mặt trước/sau của vợt — miễn là vợt phải <strong>composite hoặc polymer hợp chuẩn</strong>, không phải vợt tennis hay cầu lông.</p>

<h3>Sau bao nhiêu lỗi thì mất điểm?</h3>
<p>1 lỗi = mất điểm ngay. Không như tennis có first serve và second serve (2 cơ hội). Pickleball chỉ có <strong>1 cơ hội giao</strong> — giao hỏng (fault) → mất lượt giao ngay lập tức.</p>

<h3>Chơi đôi mà partner đánh không phải lượt mình có sao không?</h3>
<p>Trong pickleball đôi, <strong>cả 2 người đều có thể đánh bất kỳ bóng nào</strong> đến khu vực của đội (không có luật thay phiên như cầu lông). Tuy nhiên chỉ có <strong>đúng 1 người là server</strong> cho mỗi lượt giao.</p>

<h3>Nếu vợt tuột khỏi tay thì sao?</h3>
<p>Nếu vợt chạm bóng sau khi đã tuột khỏi tay → không hợp lệ (phải cầm vợt trong lúc đánh). Nếu vợt rơi sau khi đã đánh bóng hợp lệ → rally tiếp tục bình thường.</p>

<h2>Kết luận</h2>

<p>Luật pickleball cơ bản không phức tạp như tennis, nhưng có vài điểm độc đáo (kitchen, double bounce, 3-số tỉ số) mà bạn phải làm quen. Một khi thuộc 3 luật vàng — <strong>chỉ đội giao ghi điểm</strong>, <strong>không volley trong kitchen</strong>, <strong>bóng phải nảy 2 lần đầu</strong> — bạn đã sẵn sàng ra sân.</p>

<p>Không học lý thuyết mãi — <strong>ra sân, chơi với người có kinh nghiệm, học từ sai sót</strong>. Cộng đồng pickleball Việt Nam rất thân thiện với newbie.</p>

<p><strong>Bước tiếp theo:</strong></p>

<ul>
  <li>🎾 Xem trước <a href="/vi/blog/pickleball-la-gi">Pickleball là gì? Hướng dẫn A-Z</a> nếu chưa rõ môn thể thao này.</li>
  <li>📍 Tìm <a href="/vi/blog/top-san-pickleball-ha-noi-2026">sân pickleball Hà Nội gần nhất</a> để bắt đầu tập.</li>
  <li>🏆 Tổ chức giải club? Dùng <a href="/tools/quick-tables">công cụ tạo bracket miễn phí</a>.</li>
</ul>

<p>Chúc bạn có những rally đầu tiên thật vui!</p>$body$ WHERE slug = 'luat-pickleball-co-ban';
