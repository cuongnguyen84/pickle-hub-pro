-- VI blog post insert: tour-wars-2023-pickleball
-- Generated 2026-05-05 by daily growth check (second post of the day).
-- Source: src/content/blog/posts/pickleball-tour-wars-2023-explained.ts (vi: block)
-- EN counterpart: /blog/pickleball-tour-wars-2023-explained
--
-- Workflow:
--   1. Open Supabase SQL Editor → project ajvlcamxemgbxduhiqrl.
--   2. Paste the diagnose block first to confirm slug isn't already present.
--   3. If empty → run the INSERT block.
--   4. After INSERT, verify row exists + alternate_en_slug linkage.
--   5. Test live: https://www.thepicklehub.net/vi/blog/tour-wars-2023-pickleball

-- ─── 1. Diagnose ────────────────────────────────────────────────────────
SELECT id, slug, status, published_at
FROM vi_blog_posts
WHERE slug = 'tour-wars-2023-pickleball';

-- Expect: 0 rows.


-- ─── 2. Insert ──────────────────────────────────────────────────────────
INSERT INTO vi_blog_posts (
  slug, title, meta_title, meta_description, excerpt,
  content_html, cover_image_url, author_name, category,
  tags, focus_keyword, faq_items, related_post_slugs,
  alternate_en_slug, status, published_at
) VALUES (
  'tour-wars-2023-pickleball',
  'Tour Wars 2023: 10 ngày thay đổi pickleball chuyên nghiệp mãi mãi',
  'Tour Wars 2023 | 10 ngày định hình pickleball pro hiện đại',
  'Tour Wars 2023: PPA và MLP đua ký 150 VĐV trong 10 ngày, tạo Gold Contract mãi mãi, dẫn đến sáp nhập UPA — và ý nghĩa cho VĐV Việt Nam hôm nay.',
  '10 ngày tháng 8/2023 khi MLP và PPA Tour đua nhau ký 150 VĐV vào hợp đồng triệu đô, tạo ra hệ thống Gold/Standard/Futures vĩnh viễn — và đặt nền móng cho mọi drama Quang Dương, Phúc Huỳnh, Lý Hoàng Nam đang chứng kiến hôm nay.',
  '<h2>Vì sao Tour Wars là gốc rễ của mọi câu chuyện pro pickleball hôm nay</h2>
<p>Nếu muốn hiểu vì sao <strong>Quang Dương</strong> bị phạt 50.000 USD rồi sa thải, vì sao <strong>Phúc Huỳnh và Lý Hoàng Nam</strong> vĩnh viễn không bao giờ được Gold Contract dù giỏi tới đâu, vì sao Ignatowich và Glozman mất hợp đồng PPA chỉ vì 1 buổi clinic ở Tokyo, và vì sao Việt Nam đột nhiên trở thành thị trường giành giật khốc liệt nhất pickleball toàn cầu — anh phải bắt đầu từ <strong>10 ngày tháng 8/2023</strong>.</p>
<p>Đó là lúc Major League Pickleball và PPA Tour bước vào cuộc chiến giành tương lai môn thể thao này, ký khoảng <strong>150 VĐV vào hợp đồng đảm bảo trong chưa đầy 2 tuần</strong>, và đóng băng một hệ thống đẳng cấp định hình toàn bộ kinh tế pro pickleball ba năm sau.</p>

<h2>Bối cảnh: Ba thế lực trước Tour Wars</h2>
<p>Trước tháng 8/2023, pickleball chuyên nghiệp vận hành trên 3 đường ray song song.</p>
<ul>
  <li><strong>PPA Tour</strong> do Connor Pardoe sáng lập năm 2018, được tỷ phú Tom Dundon (chủ đội hockey Carolina Hurricanes NHL) rót tiền. PPA mô phỏng theo ATP — giải cá nhân, điểm xếp hạng, và quan trọng nhất là <em>hợp đồng độc quyền VĐV đầu tiên trong lịch sử môn này</em>. Pardoe đã gọi đó là quyết định kinh doanh quan trọng nhất của PPA, vì nó cho phép anh ta cam kết với nhà tài trợ rằng 16 trên 20 tay vợt hàng đầu sẽ có mặt ở mọi giải.</li>
  <li><strong>Major League Pickleball (MLP)</strong> do Steve Kuhn sáng lập năm 2021 theo mô hình ngược lại — giải đồng đội kiểu NBA. Danh sách chủ sở hữu đội MLP đọc như một bài Forbes: LeBron James, Tom Brady, Kevin Durant, Drew Brees, Patrick Mahomes, Mark Cuban, Gary Vaynerchuk, Naomi Osaka, Michael Phelps. Phí mua đội leo lên khoảng 1 triệu USD; định giá đội đạt 10–15 triệu USD/franchise.</li>
  <li><strong>APP Tour</strong> do Ken Herrmann sáng lập 2019, được USA Pickleball công nhận, ít tiền nhất nhưng có pipeline VĐV nghiệp dư sâu nhất.</li>
</ul>
<p>Hè 2023 ba bên là láng giềng căng thẳng. Rồi đột nhiên không còn nữa.</p>

<h2>24/8/2023: Ngày mọi thứ diễn ra</h2>
<p>Trong khi cả giới pickleball đang dõi theo giải PPA Kansas City Open, Steve Kuhn của MLP bắt đầu gọi điện cho hàng loạt top player. Lời chào hàng chưa từng có trong môn này — hợp đồng nhiều năm, lương đảm bảo, bảo hiểm y tế. MLP ra thông cáo báo chí gọi đây là bước ngoặt cách mạng.</p>
<p>CEO PPA Connor Pardoe sau này kể câu chuyện theo lời mình: anh nhận ra có chuyện gì đó khi ban lãnh đạo MLP <em>im lặng 4 ngày liền</em>, rồi chạy thẳng ra sân bay không hành lý, không sạc điện thoại, không bàn chải đánh răng — chỉ kịp bay đến Kansas City để cố cứu công ty.</p>
<p>Trong 10 ngày tiếp theo MLP và PPA đấu giá nhau theo thời gian thực. VĐV đăng ảnh hợp đồng lên Instagram theo từng giờ. The Dink Pickleball đặt cái tên về sau dính chặt: <strong>Tour Wars</strong>.</p>

<h2>Tiền: Những con số phá vỡ môn thể thao</h2>
<figure>
  <img src="/images/blog/pickleball-tour-wars-2023-money.webp" alt="Bảng phân tích lương Tour Wars 2023 — VĐV tầm trung tăng từ 100.000 lên 250–500K USD bảo đảm, top pro ký hợp đồng triệu đô (Ben Johns ~2,5 triệu, Anna Leigh Waters ~4 triệu), tổng đợt ký PPA + MLP đạt ~150 VĐV với chi phí lương khoảng 30 triệu USD/năm" loading="lazy" />
  <figcaption>Kinh tế lương Tour Wars — tầm trung tăng 5x, top pro 7 chữ số, tổng ~30 triệu USD/năm</figcaption>
</figure>
<p>Các con số tiền của Tour Wars vẫn là cực đoan nhất lịch sử pickleball.</p>
<ul>
  <li><strong>VĐV tầm trung</strong>: nhảy từ ~100.000 USD lên 250.000–500.000 USD/năm, bảo đảm hoàn toàn. Có VĐV chưa từng lên podium APP mà được offer 200.000 USD.</li>
  <li><strong>Top pro</strong>: hợp đồng 7 chữ số. <strong>Ben Johns</strong> — số 1 thế giới — kiếm khoảng 2,5 triệu USD năm 2024, gồm lương PPA ~1,5 triệu cộng hợp đồng vợt JOOLA trọn đời <em>đầu tiên trong lịch sử pickleball</em>.</li>
  <li><strong>Anna Leigh Waters</strong> — 16 tuổi năm 2023 — kiếm khoảng 4 triệu USD năm 2024. Hợp đồng vợt Franklin 3 năm của cô được định giá hơn 10 triệu USD, lớn nhất lịch sử môn này.</li>
  <li>Tổng cộng: hơn <strong>150 VĐV</strong> ký hợp đồng đảm bảo, tổng chi lương khoảng <strong>30 triệu USD/năm</strong>.</li>
  <li>VĐV-blogger Zane Navratil tóm gọn: lương VĐV tăng vọt, có người từ 100K lên 500K, tất cả đều bảo đảm.</li>
  <li>VĐV tầm trung Kyle Yates kể về sự đảo chiều: vài tuần trước anh còn phải trả phí đăng ký để đánh giải PPA, rồi đột nhiên PPA muốn ký hợp đồng với anh.</li>
</ul>

<h2>Ai theo ai trong cửa sổ Tour Wars</h2>
<p>Cuối 10 ngày, danh sách VĐV đã được vẽ lại.</p>
<ul>
  <li><strong>MLP ký khoảng 100 VĐV</strong> gồm Tyson McGuffin, Anna Bright, James Ignatowich, Zane Navratil, Federico Staksrud, và toàn bộ nhóm <em>Johnson 5</em> — JW Johnson, Jorja Johnson, Dylan Frazier, Gabe Tardio, Milan Rane — chốt vào ngày 31/8/2023. Riêng Tardio được trả hơn 800.000 USD trong 3 năm.</li>
  <li><strong>PPA giữ được khoảng 55 VĐV</strong>, với Ben Johns và Anna Leigh Waters là hai gương mặt giữ chân quan trọng nhất, và mạnh tay ký cựu VĐV tennis chuyên nghiệp — Jack Sock, Sam Querrey, Donald Young, Genie Bouchard — để bù chỗ trống.</li>
  <li><strong>APP Tour gần như bị bỏ rơi ở tầng đỉnh.</strong> Những VĐV mạnh nhất bị MLP và PPA hút hết, APP buộc phải tái định vị thành tour phát triển.</li>
</ul>

<h2>Sáp nhập: Chiến tranh kết thúc, đế chế bắt đầu</h2>
<p>Cả hai bên nhanh chóng nhận ra điều khó chịu: chi 30 triệu USD/năm lương VĐV trong khi doanh thu chưa đủ bù — không bền vững.</p>
<p>Ngày <strong>13/9/2023</strong> — chưa đầy 3 tuần sau khi cuộc chiến nổ ra — PPA và MLP công bố sáp nhập, được hậu thuẫn bằng cam kết đầu tư 50 triệu USD. Đầu 2024 thương vụ chính thức hoàn tất với 75 triệu USD, và <strong>United Pickleball Association (UPA)</strong> ra đời — tổ chức mẹ kiểm soát cả PPA Tour lẫn MLP.</p>
<p>Steve Kuhn rời vị trí lãnh đạo mà chính anh đã xây dựng MLP từ con số 0. Connor Pardoe và Tom Dundon nắm quyền. Trong vòng vài tuần sau sáp nhập, VĐV ký với MLP bị yêu cầu cắt lương 25–35%. VĐV ký với PPA thì không. Những vết nứt bất bình đầu tiên xuất hiện ngay trong tổ chức vừa hợp nhất.</p>

<h2>Thực tế tài chính: Tiền hết trước khi kế hoạch thành</h2>
<p>Đến tháng 1/2025, UPA cần khoản vay khẩn cấp <strong>10 triệu USD</strong> để trả lương. Trong 75 triệu USD đầu tư công bố, theo nguồn báo cáo chỉ khoảng 35 triệu thực tế đã giải ngân. Tiền mặt cuối 2024 ước tính chỉ còn 2–4 triệu USD.</p>
<p>Pardoe phản bác công khai bằng narrative doanh thu mạnh hơn — hơn 50 triệu USD doanh thu 2024, dự kiến 65 triệu năm 2025 — nhưng anh không phủ nhận việc cần huy động thêm vốn.</p>
<p>Đến <strong>tháng 6/2025 UPA buộc phải tái cấu trúc hợp đồng VĐV hoàn toàn</strong>. Bảo đảm Tour Wars gốc bị cắt khoảng 2/3, và hệ thống cấp bậc nổi tiếng giờ đây — <strong>Gold, Standard, New Player, Futures</strong> — ra đời. Đây chính là cấu trúc tier khung mọi phân tích hợp đồng chúng tôi đăng hôm nay.</p>
<p><strong>Đọc thêm:</strong></p>
<ul>
  <li><a href="/blog/app-tour-vs-ppa-tour-contracts-2026">Hợp đồng APP Tour vs PPA Tour 2026 — gồm phân tích Gold/Standard/New Player/Futures</a></li>
</ul>

<h2>Vì sao Gold Contract là hàng rào đẳng cấp vĩnh viễn</h2>
<p>Đây là sự thật quan trọng nhất pro pickleball hôm nay, ẩn trong đợt tái cấu trúc hợp đồng hậu sáp nhập: <strong>Gold Contract — bảng tiền thưởng cao nhất — chỉ dành cho VĐV ký trong cửa sổ 10 ngày Tour Wars tháng 8/2023</strong>. Không ai khác đủ điều kiện. Không có lộ trình nâng cấp. Không có tiêu chí thành tích.</p>
<p>Nếu anh ký trong khoảng 24/8 đến đầu tháng 9/2023, anh có quyền vào bảng prize Gold suốt thời hạn hợp đồng. Nếu không, anh không được — bất kể giỏi tới đâu, vô địch bao nhiêu giải, xếp hạng cao tới đâu. Đó là lý do Gold tier hoạt động ít giống một thang thành tích, mà giống <em>một di sản lịch sử</em> hơn.</p>

<h2>Vì sao Tour Wars liên quan đến pickleball Việt Nam</h2>
<p>Nếu anh đang đọc từ Việt Nam, câu chuyện Tour Wars có thể giống lịch sử thể thao Mỹ. Không phải vậy. Nó là nguyên nhân trực tiếp của <strong>3 động lực quan trọng nhất</strong> đang định hình pro pickleball Việt Nam hôm nay.</p>
<ol>
  <li><strong>Độc quyền nghiêm ngặt tồn tại vì Tour Wars.</strong> Trước 2023, PPA có điều khoản độc quyền nhưng ít khi thực thi nghiêm. Sau Tour Wars, khi UPA cam kết 30 triệu USD/năm lương VĐV, thực thi trở thành sống còn. Pardoe nói thẳng: không có độc quyền, tour không thể thu hút đầu tư, ký hợp đồng truyền hình, hay bảo vệ giá trị thương hiệu. <em>Đó là lý do</em> Quang Dương bị phạt 50.000 USD rồi sa thải, và James Ignatowich, Christian Alshon Glozman, Andrew Fu mất hợp đồng PPA sau buổi clinic Tokyo.</li>
  <li><strong>Gold Contract là trần vĩnh viễn cho VĐV không ký 2023.</strong> Phúc Huỳnh, Lý Hoàng Nam, Vinh Hiển — dù xếp hạng cao tới đâu — chỉ có thể ký Standard hoặc Futures contract. Tháng 8/2023, Phúc Huỳnh chưa ký; Lý Hoàng Nam còn đang đánh tennis; pickleball Việt Nam còn chưa bùng nổ. Cùng giải, cùng cúp, nhưng tiền thưởng chỉ bằng <strong>1/3 (Standard) hoặc 1/6 (Futures) bảng Gold</strong>. 10 ngày năm 2023 đã đặt trần cho cả một thế hệ pro châu Á.</li>
  <li><strong>Việt Nam là chiến trường tiếp theo.</strong> Pardoe đã công khai bay sang châu Á 2 lần để chốt độc quyền, và Việt Nam — thị trường pickleball lớn thứ 2 thế giới sau Mỹ — là phần thưởng địa lý. UPA đầu tư mạnh qua PPA Tour Asia, MB Hanoi Cup, và Vietnam Open tại TP.HCM. APP/GPA, D Joy Tour, Pickleball World Cup đẩy song song. Mọi pro Việt Nam đi qua hệ thống từ 2026 trở đi đều đối mặt cùng một lựa chọn mà pro Mỹ đối mặt tháng 8/2023: <em>ký độc quyền lấy tiền lớn, hay giữ tự do chấp nhận ít hơn</em>. Không có câu trả lời dễ dàng.</li>
</ol>
<p><strong>Đọc thêm:</strong></p>
<ul>
  <li><a href="/blog/ppa-tour-asia-2026-complete-guide">PPA Tour Asia 2026 — lịch thi đấu, tiền thưởng và cách VĐV nghiệp dư tham gia</a></li>
  <li><a href="/blog/pickleball-world-cup-2026-da-nang">World Cup Pickleball 2026 tại Đà Nẵng — vì sao Việt Nam là tâm điểm pickleball châu Á</a></li>
</ul>

<h2>Kết luận: Tour Wars chưa bao giờ thực sự kết thúc</h2>
<p>Tour Wars kéo dài 10 ngày. Hậu quả của nó vẫn đang tiếp diễn. Nó tạo ra hệ thống độc quyền nghiêm ngặt nhất trong bất kỳ môn thể thao non trẻ nào. Nó thổi phồng lương VĐV vượt mức doanh thu có thể duy trì, dẫn đến sáp nhập, cắt lương, vay khẩn cấp, và tái cấu trúc hợp đồng. Nó chia VĐV thành hệ thống đẳng cấp vĩnh viễn — người ký trong cửa sổ, và mọi người đến sau.</p>
<p>Và nó đặt nền móng cho mọi drama công khai môn này tạo ra từ đó tới giờ.</p>
<ul>
  <li><strong>Quang Dương sa thải</strong> — vì Tour Wars.</li>
  <li><strong>Phúc Huỳnh phải đánh sơ loại tại sân nhà</strong> — vì Tour Wars.</li>
  <li><strong>Lý Hoàng Nam không được seed</strong> dù vô địch PPA Tour Asia — vì Tour Wars.</li>
  <li><strong>Hợp đồng 300.000 USD của Ignatowich bị chấm dứt vì clinic Tokyo</strong> — vì Tour Wars.</li>
</ul>
<p>Cuộc chiến chưa thực sự kết thúc. Nó chuyển sang chiến trường mới. Và <strong>Việt Nam giờ nằm chính giữa chiến trường đó</strong>.</p>
<p><strong>Đọc thêm:</strong></p>
<ul>
  <li><a href="/blog/app-tour-vs-ppa-tour-contracts-2026">Hợp đồng APP Tour vs PPA Tour 2026 — phân tích sâu</a></li>
  <li><a href="/tournaments">Xem các giải đấu pro và nghiệp dư sắp tới</a></li>
</ul>',
  '/images/blog/pickleball-tour-wars-2023-hero.webp',
  'Cuong Nguyen',
  'Phân tích',
  ARRAY['tour wars', 'ppa tour', 'mlp', 'upa', 'pickleball chuyên nghiệp', 'lịch sử', 'gold contract', 'quang dương'],
  'tour wars 2023',
  '[
    {"question": "Tour Wars 2023 là gì?", "answer": "Tour Wars là khoảng 10 ngày bắt đầu từ 24/8/2023 khi Major League Pickleball (MLP) và PPA Tour cạnh tranh ký top VĐV pickleball chuyên nghiệp vào hợp đồng nhiều năm có lương đảm bảo. Cuộc đua chuyển khoảng 150 VĐV trong chưa đầy 2 tuần và định hình lại toàn bộ kinh tế pro pickleball."},
    {"question": "Vì sao gọi là Tour Wars?", "answer": "Tên này được The Dink Pickleball phổ biến trong suốt cuộc đua đấu giá. Nó nắm bắt cuộc cạnh tranh chưa từng có giữa MLP và PPA — hai tour giành nhau theo thời gian thực cho cùng một nhóm hữu hạn top VĐV, với thông báo hợp đồng mới được đăng công khai mỗi vài giờ."},
    {"question": "United Pickleball Association (UPA) là gì?", "answer": "United Pickleball Association là tổ chức mẹ thành lập 2024 sau khi PPA Tour và MLP sáp nhập. Sáp nhập được công bố chỉ 3 tuần sau Tour Wars và hoàn tất với cam kết đầu tư 75 triệu USD. UPA giờ kiểm soát cả PPA Tour (giải cá nhân) lẫn MLP (giải đồng đội) dưới một cấu trúc doanh nghiệp chung do Connor Pardoe và Tom Dundon dẫn dắt."},
    {"question": "Gold Contract trong pickleball là gì?", "answer": "Gold Contract là cấp tiền thưởng cao nhất trong hệ thống tái cấu trúc hợp đồng UPA hậu 2025. Nó trả bảng prize lớn nhất (PPA Slam đôi Gold trả khoảng 90.000 USD/cặp). Quan trọng: Gold Contract chỉ dành riêng cho VĐV đã ký trong cửa sổ Tour Wars tháng 8/2023 — không VĐV nào ký sau đó có thể vào tier Gold dù thành tích thế nào."},
    {"question": "Vì sao top pro hiện tại không đủ điều kiện Gold Contract?", "answer": "Gold Contract là di sản lịch sử gắn với cửa sổ ký 8/2023, không phải thang thành tích. Top pro ký sau cửa sổ đó — bao gồm các ngôi sao Việt Nam như Phúc Huỳnh, Lý Hoàng Nam, Vinh Hiển — chỉ vào được tier Standard hoặc Futures, trả khoảng 1/3 hoặc 1/6 bảng prize Gold cho cùng kết quả giải đấu."},
    {"question": "Tour Wars ảnh hưởng đến pro pickleball Việt Nam thế nào?", "answer": "Tour Wars khoá ba thứ ảnh hưởng trực tiếp đến pro Việt Nam: độc quyền PPA nghiêm ngặt (dẫn đến vụ phạt 50.000 USD và sa thải Quang Dương), hàng rào đẳng cấp Gold Contract (pro Việt ký từ 2026 trở đi vĩnh viễn bị giới hạn ở Standard hoặc Futures), và cuộc chiến địa lý cho châu Á (UPA, APP, D Joy giờ đang cạnh tranh quyết liệt tại Việt Nam). Mọi top pro Việt 2026 đều đối mặt cùng lựa chọn độc-quyền-vs-tự-do mà pro Mỹ gặp năm 2023."},
    {"question": "Vì sao UPA phải cắt lương VĐV năm 2025?", "answer": "Bảo đảm Tour Wars gốc cam kết khoảng 30 triệu USD/năm lương VĐV trước khi tour có doanh thu hỗ trợ. Đến tháng 1/2025, UPA cần vay khẩn cấp 10 triệu USD để trả lương, và đến tháng 6/2025 hợp đồng VĐV được tái cấu trúc — bảo đảm gốc bị cắt khoảng 2/3, và hệ thống cấp bậc Gold/Standard/New Player/Futures mới ra đời."}
  ]'::jsonb,
  ARRAY['hop-dong-app-tour-vs-ppa-tour-2026', 'cach-choi-pickleball-cho-nguoi-moi'],
  'pickleball-tour-wars-2023-explained',
  'published',
  NOW()
);

-- ─── 3. Verify ──────────────────────────────────────────────────────────
SELECT id, slug, title, status, published_at, alternate_en_slug, jsonb_array_length(faq_items) AS faq_count
FROM vi_blog_posts
WHERE slug = 'tour-wars-2023-pickleball';

-- Expect: 1 row with status='published', alternate_en_slug='pickleball-tour-wars-2023-explained', faq_count=7.

-- ─── 4. (Optional) Cross-link from APP Tour post → this Tour Wars post ──
-- Update vi_blog_posts row hop-dong-app-tour-vs-ppa-tour-2026 to add this slug
-- as a related post (so VI cross-links work both directions).
UPDATE vi_blog_posts
SET related_post_slugs = ARRAY['tour-wars-2023-pickleball', 'cach-choi-pickleball-cho-nguoi-moi']
WHERE slug = 'hop-dong-app-tour-vs-ppa-tour-2026';

-- ─── 5. Test live (after EN post deploys to www.thepicklehub.net) ───────
-- VI: https://www.thepicklehub.net/vi/blog/tour-wars-2023-pickleball
-- EN: https://www.thepicklehub.net/blog/pickleball-tour-wars-2023-explained
-- Hreflang: should appear in both pages' <head> linking each other.
