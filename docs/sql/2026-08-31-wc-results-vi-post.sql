-- ============================================================================
-- VI twin of the World Cup 2026 results article.
--
-- content_html carries the literal marker [[WC_RESULTS]] where the live results
-- table goes. Both render paths substitute it: renderViBlogPost (bot) swaps it
-- for server-rendered HTML from functions/_lib/render/wc-results.ts AFTER
-- sanitising, and ViBlogPost.tsx (human) splits the sanitised HTML on it and
-- mounts <WorldCupResultsBoard/> in the gap. Neither path lets the database
-- contribute markup.
--
-- No <h1> in content_html on purpose: renderViBlogPost calls buildHtml without
-- omitAutoHeader, so the page's single <h1> comes from the title.
--
-- Idempotent — safe to re-run.
-- ============================================================================

INSERT INTO public.vi_blog_posts (
  slug, title, meta_title, meta_description, excerpt,
  content_html, cover_image_url, faq_items, alternate_en_slug,
  status, published_at, updated_at
) VALUES (
  'ket-qua-pickleball-world-cup-2026-da-nang',
  'Kết quả Pickleball World Cup 2026 Đà Nẵng: từng trận, từng ngày',
  'Kết quả Pickleball World Cup 2026 Đà Nẵng',
  'Kết quả Pickleball World Cup 2026 Đà Nẵng: từng trận Pro theo ngày, tỉ số ghi nhận, trận có VĐV Việt Nam, chung kết 6/9.',
  'Toàn bộ các trận Pro của Heineken Pickleball World Cup 2026, nhóm theo ngày, cập nhật liên tục từ dữ liệu trực tiếp của giải.',
  $html$
<h2>Kết quả, cập nhật liên tục</h2>
<p>Heineken Pickleball World Cup 2026 diễn ra từ 30/8 đến 6/9/2026 tại Đà Nẵng: 69 nội dung, 156 đội tuyển quốc gia, gần 5.000 vận động viên từ hơn 80 quốc gia và vùng lãnh thổ, thi đấu trên 76 sân tại bảy địa điểm. Trang này của ThePickleHub theo dõi năm nội dung cá nhân Pro — đơn nam, đơn nữ, đôi nam, đôi nữ và đôi nam nữ — từng trận một, nhóm theo ngày kết thúc tính theo giờ Việt Nam. Bảng bên dưới không phải ảnh chụp một thời điểm: nó đọc cùng nguồn dữ liệu trực tiếp mà bảng live của ThePickleHub đang dùng, nên luôn đúng ở thời điểm bạn mở, và kết quả đồng đội quốc gia sẽ vào bảng khi giải đó khởi tranh ngày 3/9.</p>
[[WC_RESULTS]]
<p>Xem thêm: <a href="/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang">Lịch thi đấu đầy đủ cả hai giải, theo từng ngày</a></p>

<h2>Tỉ số này là gì, và không phải là gì</h2>
<p>Có một điều cần hiểu trước khi đọc bảng. Trang trực tiếp của ban tổ chức chỉ công bố những trận đang chờ hoặc đang diễn ra; trận nào kết thúc là biến mất khỏi dữ liệu, và không trang công khai nào mang tỉ số chung cuộc chính thức của trận đó. ThePickleHub giữ lại lịch sử: khi một trận đang diễn ra biến mất, tỉ số cuối cùng ghi nhận được sẽ được lưu và trận được đánh dấu là đã ghi nhận. Vì vậy cột tỉ số ghi &quot;tỉ số ghi nhận&quot; chứ không phải &quot;chung cuộc&quot;, và cột cuối nêu bên đang dẫn chứ không tuyên bố nhà vô địch. Với đại đa số trận thì hai điều đó là một. Với trận biến mất giữa chừng thì không — và nói rõ điều đó rẻ hơn nhiều so với đăng sai tên người thắng.</p>

<h2>Hai giải trên cùng một lịch</h2>
<p>Giải cá nhân và giải đồng đội quốc gia là hai giải riêng biệt dùng chung địa điểm và chung cái tên, và nhầm hai giải này là lỗi phổ biến nhất khi đưa tin về World Cup lần này. Giải cá nhân — các nhánh Pro trong bảng trên, cộng với các bảng nghiệp dư, trẻ, senior và master — bắt đầu từ Chủ nhật 30/8 và chạy tới 6/9. Giải đồng đội quốc gia, nơi đội tuyển Việt Nam góp mặt, bắt đầu thứ Năm 3/9 và kết thúc Chủ nhật 6/9. Một VĐV Việt Nam vô địch một nhánh Pro không có nghĩa là đội tuyển Việt Nam vô địch, và ngược lại.</p>
<table>
  <caption>Hai giải tại Pickleball World Cup 2026</caption>
  <thead><tr><th></th><th>Giải cá nhân</th><th>Giải đồng đội quốc gia</th></tr></thead>
  <tbody>
    <tr><td>Thời gian</td><td>30/8 – 6/9</td><td>3/9 – 6/9</td></tr>
    <tr><td>Ai dự</td><td>Cá nhân, theo trình DUPR và độ tuổi</td><td>156 đội, 5 hạng mục</td></tr>
    <tr><td>Việt Nam</td><td>VĐV Việt Nam ở nhiều nhánh</td><td>Hạt giống số 1, bảng A (Open)</td></tr>
    <tr><td>Thể thức</td><td>Nhánh đấu thông thường</td><td>6 trận ấn định mỗi cặp, 21 điểm, rally</td></tr>
  </tbody>
</table>

<h2>Việt Nam thi đấu ngày nào</h2>
<p>Việt Nam là hạt giống số 1 bảng A nội dung Open, cùng bảng Colombia, Quần đảo Cayman và Chile, ra quân thứ Năm 3/9. Ba đội còn lại vào cuộc thứ Sáu 4/9: Master 60+, U18 ở bảng A cùng Malaysia, Costa Rica và Hàn Quốc, U14 ở bảng A cùng Úc và Singapore. Vì một cặp đấu đồng đội gồm sáu trận đơn và đôi đã ấn định trước chứ không phải cuộc so tài giữa hai ngôi sao, chiều sâu đội hình quyết định nhiều hơn một cái tên lớn — và đó là điều đáng theo dõi ở bảng A.</p>

<h2>Chung kết</h2>
<p>Giải khép lại Chủ nhật 6/9 tại Nhà thi đấu Tiên Sơn. Các trận chung kết Pro của giải cá nhân diễn ra 08:00–18:00 trên sân số 1, trong đó năm trận chung kết OPEN Pro được xếp từ 10:10 đến 14:50. Các trận đồng đội quốc gia trong ngày bắt đầu lúc 08:00, 16:00 và 18:00. Quốc khánh 2/9 rơi vào thứ Tư, cũng là ngày Lễ khai mạc 18:00–20:00 — lễ khai mạc nằm giữa giải cá nhân chứ không phải trước giải, thêm một hệ quả của việc hai giải dùng chung một lịch.</p>
<p>Xem thêm: <a href="/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang">Cẩm nang xem và vé Pickleball World Cup 2026</a> · <a href="/vi/blog/cach-chia-bang-xep-lich-thi-dau-pickleball">Cách chia bảng và xếp lịch thi đấu pickleball</a> · <a href="/live">Bảng trực tiếp World Cup trên ThePickleHub</a></p>
  $html$,
  '/images/blog/pickleball-world-cup-2026-da-nang-hero.webp',
  $faq$[
    {"question":"Xem kết quả Pickleball World Cup 2026 ở đâu?","answer":"ThePickleHub đăng toàn bộ các trận Pro của Heineken Pickleball World Cup 2026 trên trang này, nhóm theo ngày kết thúc tính theo giờ Việt Nam, cập nhật liên tục từ chính nguồn dữ liệu trực tiếp của giải chứ không nhập tay mỗi ngày một lần."},
    {"question":"Đây có phải tỉ số chung cuộc chính thức không?","answer":"Đây là tỉ số cuối cùng ghi nhận được từ dữ liệu trực tiếp của ban tổ chức trước khi trận rời khỏi bảng. Ban tổ chức không công bố công khai tỉ số chung cuộc của trận đã kết thúc, nên ThePickleHub ghi rõ tỉ số ghi nhận và nêu bên đang dẫn thay vì tuyên bố nhà vô địch chính thức."},
    {"question":"Đội tuyển Việt Nam thi đấu World Cup Pickleball 2026 ngày nào?","answer":"Đội Open Việt Nam ra quân thứ Năm 3/9/2026, là hạt giống số 1 bảng A cùng Colombia, Quần đảo Cayman và Chile. Các đội Master 60+, U18 và U14 vào cuộc thứ Sáu 4/9."},
    {"question":"Chung kết Pickleball World Cup 2026 khi nào?","answer":"Chủ nhật 6/9/2026 tại Nhà thi đấu Tiên Sơn, Đà Nẵng. Năm trận chung kết OPEN Pro diễn ra 10:10–14:50 trên sân số 1; các trận đồng đội quốc gia bắt đầu lúc 08:00, 16:00 và 18:00."},
    {"question":"Pickleball World Cup 2026 có bao nhiêu nội dung?","answer":"69 nội dung — 33 nội dung cá nhân quốc tế và 36 nội dung của giải đồng đội quốc gia, với 156 đội tuyển ở 5 hạng mục: Open, Senior, Master, Junior và Kids."}
  ]$faq$::jsonb,
  'pickleball-world-cup-2026-da-nang-results',
  'published',
  '2026-08-31T09:00:00+07:00',
  now()
)
ON CONFLICT (slug) DO UPDATE SET
  title             = EXCLUDED.title,
  meta_title        = EXCLUDED.meta_title,
  meta_description  = EXCLUDED.meta_description,
  excerpt           = EXCLUDED.excerpt,
  content_html      = EXCLUDED.content_html,
  cover_image_url   = EXCLUDED.cover_image_url,
  faq_items         = EXCLUDED.faq_items,
  alternate_en_slug = EXCLUDED.alternate_en_slug,
  status            = EXCLUDED.status,
  updated_at        = now();
