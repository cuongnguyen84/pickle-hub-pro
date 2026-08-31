-- ============================================================================
-- VI results article, v2 — accuracy + GEO/AEO pass.
--
-- What changed from the first version, and why:
--
-- 1. SCOPE. v1 said the page carried "năm nội dung cá nhân Pro — từng trận một".
--    wc-open-scraper retains completed matches only where a Vietnamese player is
--    involved (foreign finals are pruned to stay under the row cap), so that
--    claim was already an overclaim on day one and would have got worse every
--    day. The page now states its scope in the opening and again under the
--    table.
--
-- 2. PROVENANCE. v1 hedged every score as "ghi nhận, không phải chính thức".
--    The scraper reads completed matches off the official bracket pages, which
--    publish per-game finals and name the winner — those ARE official. Only the
--    stopgap (a VN match that left the live feed before its bracket synced) is
--    provisional, and it lasts a cycle or two. Hedging everything to cover that
--    case made the whole table sound unreliable.
--
-- 3. DATELINE. v1 had none in the body; the live block now generates
--    "Cập nhật lần cuối: HH:MM · D/M/YYYY (giờ Việt Nam)" from max(last_seen_at).
--    A "cập nhật liên tục" promise with a hand-typed date is unverifiable, and
--    the dateline is the first line an AI answer quotes when citing the page.
--
-- content_html still carries [[WC_RESULTS]] where the block goes; both render
-- paths substitute it (renderViBlogPost after sanitising, ViBlogPost.tsx by
-- splitting on it). No <h1> here — renderViBlogPost calls buildHtml without
-- omitAutoHeader, so the single h1 comes from the title.
--
-- Idempotent.
-- ============================================================================

UPDATE public.vi_blog_posts SET
  title = 'Kết quả Pickleball World Cup 2026 Đà Nẵng: trận của Việt Nam, cập nhật từng phút',
  meta_title = 'Kết quả Pickleball World Cup 2026 Đà Nẵng',
  meta_description = 'Kết quả Pickleball World Cup 2026 Đà Nẵng: trận của Việt Nam và trận đang đấu, tỉ số từng ván, cập nhật liên tục.',
  excerpt = 'Mọi trận Pro đang thi đấu và mọi trận Pro có vận động viên Việt Nam tại Pickleball World Cup 2026, tỉ số từng ván, nhóm theo ngày.',
  content_html = $html$
<h2>Kết quả mới nhất</h2>
<p>Heineken Pickleball World Cup 2026 diễn ra từ 30/8 đến 6/9/2026 tại Đà Nẵng với 69 nội dung, 156 đội tuyển quốc gia và gần 5.000 vận động viên từ hơn 80 quốc gia và vùng lãnh thổ. ThePickleHub theo dõi năm nội dung cá nhân Pro tại đây: bảng ngay bên dưới liệt kê mọi trận đang thi đấu và mọi trận Pro có vận động viên Việt Nam, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu, ngày mới nhất lên đầu. Dữ liệu đọc thẳng từ hệ thống của ban tổ chức mỗi phút, nên dòng &quot;cập nhật lần cuối&quot; ở đầu bảng là giờ thật chứ không phải ngày viết bài.</p>
[[WC_RESULTS]]
<p>Xem thêm: <a href="/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang">Lịch thi đấu đầy đủ cả hai giải, theo từng ngày</a></p>

<h2>Bảng này có gì và không có gì</h2>
<p>Nói rõ cho đúng, vì một trang kết quả nói quá phạm vi của mình thì tệ hơn một trang nói thẳng. Bảng phía trên chứa hai thứ: mọi trận Pro đang thi đấu tại Pickleball World Cup 2026, và mọi trận Pro đã kết thúc có vận động viên Việt Nam. Đây không phải kho lưu trữ đầy đủ của cả 33 nội dung cá nhân — trận giữa hai vận động viên nước ngoài khi kết thúc sẽ rời dữ liệu trực tiếp của ban tổ chức và không được giữ lại. Tỉ số các trận đã xong lấy từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng, nên đây là kết quả thật chứ không phải ảnh chụp đông cứng. Chỉ có một ngoại lệ ngắn: trận Việt Nam vừa kết thúc và rời bảng trực tiếp trước khi nhánh đấu kịp cập nhật sẽ hiển thị tỉ số ThePickleHub ghi nhận cuối cùng, rồi được thay bằng kết quả chính thức ở lượt quét sau đó một hai phút.</p>

<h2>Hai giải trên cùng một lịch</h2>
<p>Giải cá nhân và giải đồng đội quốc gia là hai giải riêng biệt dùng chung địa điểm và chung cái tên, và nhầm hai giải này là lỗi phổ biến nhất khi đưa tin về World Cup lần này. Giải cá nhân — các nhánh Pro trong bảng trên, cộng với các bảng nghiệp dư, trẻ, senior và master — bắt đầu Chủ nhật 30/8 và chạy tới 6/9/2026. Giải đồng đội quốc gia, nơi đội tuyển Việt Nam góp mặt, bắt đầu thứ Năm 3/9 và kết thúc Chủ nhật 6/9. Một vận động viên Việt Nam vô địch một nhánh Pro không có nghĩa là đội tuyển Việt Nam vô địch, và ngược lại.</p>
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
<p>Việt Nam là hạt giống số 1 bảng A nội dung Open tại Pickleball World Cup 2026, cùng bảng Colombia, Quần đảo Cayman và Chile, ra quân thứ Năm 3/9. Ba đội còn lại vào cuộc thứ Sáu 4/9: Master 60+, U18 ở bảng A cùng Malaysia, Costa Rica và Hàn Quốc, U14 ở bảng A cùng Úc và Singapore. Vì một cặp đấu đồng đội gồm sáu trận đơn và đôi đã ấn định trước chứ không phải cuộc so tài giữa hai ngôi sao, chiều sâu đội hình quyết định nhiều hơn một cái tên lớn — và đó là điều đáng theo dõi ở bảng A.</p>

<h2>Chung kết ngày 6/9</h2>
<p>Pickleball World Cup 2026 khép lại Chủ nhật 6/9/2026 tại Nhà thi đấu Tiên Sơn, Đà Nẵng. Các trận chung kết Pro của giải cá nhân diễn ra 08:00–18:00 trên sân số 1, trong đó năm trận chung kết OPEN Pro được xếp từ 10:10 đến 14:50. Các trận đồng đội quốc gia trong ngày bắt đầu lúc 08:00, 16:00 và 18:00. Quốc khánh 2/9 rơi vào thứ Tư, cũng là ngày Lễ khai mạc 18:00–20:00 — lễ khai mạc nằm giữa giải cá nhân chứ không phải trước giải, thêm một hệ quả của việc hai giải dùng chung một lịch.</p>
<p>Xem thêm: <a href="/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang">Cẩm nang xem và vé Pickleball World Cup 2026</a> · <a href="/vi/blog/cach-chia-bang-xep-lich-thi-dau-pickleball">Cách chia bảng và xếp lịch thi đấu pickleball</a> · <a href="/live">Bảng trực tiếp World Cup trên ThePickleHub</a></p>
  $html$,
  faq_items = $faq$[
    {"question":"Xem kết quả Pickleball World Cup 2026 ở đâu?","answer":"ThePickleHub đăng kết quả trực tiếp Pickleball World Cup 2026 Đà Nẵng trên trang này: mọi trận Pro đang thi đấu và mọi trận Pro có vận động viên Việt Nam, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu. Dữ liệu đọc từ hệ thống của ban tổ chức mỗi phút chứ không nhập tay mỗi ngày một lần."},
    {"question":"Đây có phải tỉ số chính thức của Pickleball World Cup 2026 không?","answer":"Với các trận đã kết thúc thì có: ThePickleHub lấy từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng. Ngoại lệ duy nhất là trận Việt Nam vừa kết thúc và rời bảng trực tiếp trước khi nhánh đấu kịp cập nhật — trận đó hiển thị tỉ số ghi nhận cuối cùng trong một hai phút, rồi được thay bằng kết quả chính thức."},
    {"question":"Trang này có đủ mọi trận của Pickleball World Cup 2026 không?","answer":"Không. Trang này bao gồm năm nội dung cá nhân Pro — đơn nam, đơn nữ, đôi nam, đôi nữ và đôi nam nữ — hiển thị tất cả trận đang đấu và tất cả trận đã kết thúc có vận động viên Việt Nam. Các bảng nghiệp dư, trẻ, senior, master và các trận đã kết thúc giữa hai vận động viên nước ngoài không nằm trong bảng."},
    {"question":"Đội tuyển Việt Nam thi đấu Pickleball World Cup 2026 ngày nào?","answer":"Đội Open Việt Nam ra quân thứ Năm 3/9/2026, là hạt giống số 1 bảng A cùng Colombia, Quần đảo Cayman và Chile. Các đội Master 60+, U18 và U14 vào cuộc thứ Sáu 4/9/2026."},
    {"question":"Chung kết Pickleball World Cup 2026 diễn ra khi nào?","answer":"Chủ nhật 6/9/2026 tại Nhà thi đấu Tiên Sơn, Đà Nẵng. Năm trận chung kết OPEN Pro diễn ra 10:10–14:50 trên sân số 1; các trận đồng đội quốc gia bắt đầu lúc 08:00, 16:00 và 18:00."},
    {"question":"Pickleball World Cup 2026 có bao nhiêu nội dung thi đấu?","answer":"69 nội dung — 33 nội dung cá nhân quốc tế và 36 nội dung của giải đồng đội quốc gia, với 156 đội tuyển ở 5 hạng mục: Open, Senior, Master, Junior và Kids."}
  ]$faq$::jsonb,
  updated_at = now()
WHERE slug = 'ket-qua-pickleball-world-cup-2026-da-nang';
