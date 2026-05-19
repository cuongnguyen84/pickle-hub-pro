-- VI blog post insert: hop-dong-app-tour-vs-ppa-tour-2026
-- Generated 2026-05-05 by daily growth check.
-- Source: src/content/blog/posts/app-tour-vs-ppa-tour-contracts-2026.ts (vi: block)
-- EN counterpart: /blog/app-tour-vs-ppa-tour-contracts-2026
--
-- Workflow:
--   1. Open Supabase SQL Editor → project ajvlcamxemgbxduhiqrl.
--   2. Paste the diagnose block first to confirm slug isn't already present.
--   3. If empty → run the INSERT block.
--   4. After INSERT, verify row exists + alternate_en_slug linkage.
--   5. Test live: https://www.thepicklehub.net/vi/blog/hop-dong-app-tour-vs-ppa-tour-2026

-- ─── 1. Diagnose ────────────────────────────────────────────────────────
SELECT id, slug, status, published_at
FROM vi_blog_posts
WHERE slug = 'hop-dong-app-tour-vs-ppa-tour-2026';

-- Expect: 0 rows.


-- ─── 2. Insert ──────────────────────────────────────────────────────────
INSERT INTO vi_blog_posts (
  slug, title, meta_title, meta_description, excerpt,
  content_html, cover_image_url, author_name, category,
  tags, focus_keyword, faq_items, related_post_slugs,
  alternate_en_slug, status, published_at
) VALUES (
  'hop-dong-app-tour-vs-ppa-tour-2026',
  'Hợp đồng APP Tour vs PPA Tour: Hai cách tổ chức pro pickleball năm 2026',
  'APP Tour vs PPA Tour 2026 | Hợp đồng, tiền thưởng, độc quyền',
  'So sánh APP Tour vs PPA Tour 2026: hợp đồng, tiền thưởng, điều khoản độc quyền, Global Pickleball Alliance, và hợp đồng APP của Quang Dương.',
  'Pickleball chuyên nghiệp 2026 chạy trên hai hệ thống song song — PPA Tour và APP Tour — và chúng khác nhau gần như mọi mặt. Bài này phân tích hợp đồng APP, lý do APP bất ngờ ký VĐV đầu 2026, ý nghĩa của Global Pickleball Alliance với châu Á, và case study hợp đồng APP của Quang Dương.',
  '<h2>Hai tour, hai triết lý hoàn toàn khác nhau</h2>
<p>Pickleball chuyên nghiệp 2026 vận hành trên hai hệ thống song song — <strong>PPA Tour</strong> và <strong>APP Tour</strong> — và chúng khác nhau gần như mọi mặt. PPA hoạt động như một công ty: trả lương VĐV, ký hợp đồng độc quyền nhiều năm, kiểm soát chặt thương hiệu và lịch thi đấu. APP, cho đến gần đây, hoạt động như một chợ tự do: ai muốn đăng ký thì đánh, thắng thì cầm tiền thưởng, thua thì về. Không lương. Không độc quyền. Không ràng buộc.</p>
<p>Sau khi phân tích hợp đồng PPA ở bài trước, bài này làm điều tương tự với APP — bao gồm lý do APP bất ngờ ký VĐV đầu 2026, ý nghĩa của <strong>Global Pickleball Alliance</strong> với châu Á, và vì sao hợp đồng APP của ngôi sao Việt Nam <strong>Quang Dương</strong> là case study rõ ràng nhất để so sánh hai hệ thống.</p>

<h2>Mô hình gốc của APP Tour: Chợ tự do cho VĐV</h2>
<p>Từ khi thành lập đến hết 2025, APP gần như không ký hợp đồng VĐV nào. Mô hình rất đơn giản: đăng ký, đánh, thắng tiền, về. Tom Webb (CMO của APP) tóm gọn triết lý trên PicklePod: VĐV nên được tự do chơi ở đâu và khi nào họ muốn.</p>
<p>Mặt tích cực rõ ràng — pro có thể tham gia giải APP, giải PPA mở (khi được phép), tour khu vực như D Joy Việt Nam, exhibition từ thiện, clinic được tài trợ, sự kiện cá nhân — không cần xin phép ai. Mặt tiêu cực cũng rõ không kém: không lương, không thu nhập đảm bảo, không có giải đồng đội trả tiền lớn, không có appearance fee hay phí truyền thông. Muốn sống bằng nghề pickleball chỉ qua APP — phải thắng liên tục.</p>

<h2>Tiền thật sự nằm ở đâu: 3–4 triệu USD vs 31 triệu USD</h2>
<p>Sự thật khó nuốt nhất trong tranh luận APP vs PPA là quy mô tiền chi cho VĐV. <strong>APP chi khoảng 3–4 triệu USD/năm</strong> cho player compensation. <strong>PPA chi khoảng 31 triệu USD</strong>. Gấp gần 10 lần. Và sự chênh lệch này hiện diện ở mọi thước đo:</p>
<ul>
  <li>Giải APP lớn nhất (''Major''): tổng quỹ thưởng khoảng 150.000 USD cho toàn bộ các nội dung.</li>
  <li>PPA Slam: riêng đôi nam Gold Contract đã trả khoảng 90.000 USD/cặp — chưa kể lương đảm bảo, thu nhập MLP, appearance fee.</li>
  <li>Vô địch MLP (thuộc hệ sinh thái PPA) thưởng tới 250.000 USD/đội.</li>
  <li>APP không có giải đồng đội pro tương đương, không có lương đảm bảo, và không có khoản appearance/truyền thông tương đương.</li>
</ul>

<h2>Độc quyền: Khác biệt lớn nhất</h2>
<p>Ký với PPA — điều khoản hợp đồng có thể rất rộng. VĐV cần xin phép để tổ chức clinic riêng, thường phải thông báo trước 60 ngày. Sự kiện từ thiện, exhibition cá nhân, giải ngoài tour thường yêu cầu duyệt văn bản. Mức phạt được đưa tin lên tới 50.000 USD/lần vi phạm, và vi phạm nặng có thể dẫn đến chấm dứt hợp đồng.</p>
<p>Hợp đồng APP thì ngược lại — <strong>không độc quyền chút nào</strong>. VĐV ký APP vẫn có thể tham gia giải D Joy ở Việt Nam, mở academy riêng, đánh exhibition, ký deal tài trợ phụ, chọn vợt nào tùy thích. Như bố Quang Dương trả lời PicklePod: chúng tôi tự do — và tự do chính là điều APP cung cấp.</p>

<h2>Vì sao APP bắt đầu ký VĐV đầu 2026</h2>
<p>Bất chấp triết lý chợ tự do, APP ký khoảng 11 VĐV trong vòng 2 tuần đầu 2026 — gồm <strong>Quang Dương, Sofia Sewing, Megan Fudge, Will Howells, Jack Munro, Simone Jardim</strong>. Hầu hết đã chơi APP nhiều năm; Dương là gương mặt mới đáng chú ý nhất.</p>
<p>Lý do đơn giản: ''tự do'' thôi thì không giữ được VĐV khi tour đối thủ đang chào hợp đồng đảm bảo bảy chữ số. APP cần cam kết. Nhưng cấu trúc họ dùng khác hoàn toàn PPA. Hợp đồng APP chỉ yêu cầu VĐV tham gia một số giải xác định — không cấm bất cứ điều gì khác. Hợp đồng của Quang Dương là thỏa thuận nhiều năm: <strong>4 giải APP tại Mỹ + 4 giải D Joy tại Việt Nam mỗi năm</strong>. Ngoài ra muốn đánh, tổ chức, dạy, tài trợ ở đâu cũng được. CEO PPA Connor Pardoe thậm chí lên X cà khịa các thông báo này — dấu hiệu cho thấy chênh lệch tài chính vẫn còn quá lớn.</p>

<h2>PPA vs APP — Khác biệt cốt lõi 2026</h2>
<figure>
  <img src="/images/blog/app-tour-vs-ppa-tour-infographic.webp" alt="Infographic so sánh mô hình mở của APP Tour với cấu trúc 4 cấp độc quyền của PPA (Gold, Standard, New Player, Futures) — đợt ký APP 2026 của Quang Dương, chênh lệch tiền thưởng, và các vụ thực thi hợp đồng PPA gồm Tokyo 3 và Parris Todd" loading="lazy" />
  <figcaption>Mô hình mở của APP vs Lồng vàng của PPA — phân tích trực quan hợp đồng, tiền và thực thi</figcaption>
</figure>
<p>Nếu đang muốn hiểu tour nào phù hợp với loại VĐV nào, đây là so sánh quan trọng năm 2026:</p>
<ol>
  <li><strong>Lương đảm bảo</strong> — PPA: có, từ 40.000 đến hơn 1 triệu USD/năm cho top pro. APP: gần như không, hoặc không công khai.</li>
  <li><strong>Độc quyền</strong> — PPA: chặt; vi phạm có thể bị phạt hoặc chấm dứt hợp đồng. APP: không; đánh ở đâu cũng được.</li>
  <li><strong>Tiền thưởng mỗi giải</strong> — PPA Slam: ~90.000 USD/cặp (Gold). APP Major: ~150.000 USD tổng quỹ cả giải.</li>
  <li><strong>Số giải bắt buộc</strong> — PPA: thường 25+ sự kiện/năm. APP (hợp đồng Quang Dương): 4 APP + 4 D Joy.</li>
  <li><strong>Giải đồng đội pro</strong> — PPA: MLP, vô địch tới 250.000 USD/đội. APP: không có giải đồng đội pro.</li>
  <li><strong>Tự do thương mại</strong> — PPA: vợt, trang phục, clinic thường phải duyệt. APP: tự do hoàn toàn về thiết bị và kinh doanh phụ.</li>
</ol>

<h2>APP ở Châu Á: Liên minh, không phải đế chế</h2>
<p>PPA Tour Asia về cơ bản là một chi nhánh khu vực — PPA sở hữu, vận hành, kiểm soát lịch và truyền hình, đưa pro hàng đầu thế giới vào châu Á dưới một thương hiệu. APP đi hướng ngược lại với <strong>Global Pickleball Alliance (GPA)</strong>. Thay vì một công ty con sở hữu hoàn toàn, GPA là quan hệ đối tác giữa các tour quốc gia: APP, D Joy (Việt Nam), NPL (Úc), Global Sports (Ấn Độ), CNPL (Canada), EPF (Châu Âu), Pickleball England.</p>
<p>Mỗi đối tác tự tổ chức giải. APP đóng góp thương hiệu, hệ thống xếp hạng GPR, và liên kết VĐV qua liên minh. Chi phí thấp hơn, kiểm soát ít hơn. Riêng Việt Nam: <strong>D Joy Tour là cánh tay của GPA tại Việt Nam — 4 chặng/năm</strong>, đó chính là lý do hợp đồng APP của Quang Dương cam kết 4 giải D Joy song song với 4 giải APP Mỹ. Cấu trúc GPA là cái khiến cam kết kép này có lý.</p>
<p><strong>Đọc thêm:</strong></p>
<ul>
  <li><a href="/blog/ppa-tour-asia-2026-complete-guide">PPA Tour Asia 2026 — lịch thi đấu, tiền thưởng và cách VĐV nghiệp dư tham gia</a></li>
</ul>

<h2>VĐV chuyển tour: Vài case study tiêu biểu</h2>
<p>Mùa chuyển nhượng 2025–2026 kể câu chuyện rõ hơn bất kỳ điều khoản hợp đồng nào.</p>
<ul>
  <li><strong>Quang Dương</strong> — bị PPA cắt hợp đồng tháng 7/2025, ký APP tháng 3/2026: không độc quyền, 4 APP + 4 D Joy.</li>
  <li><strong>Sofia Sewing</strong> — ký APP đầu 2026, có tin sẽ chuyển sang PPA từ 2027.</li>
  <li><strong>Will Howells</strong> — đi ngược chiều, rời APP về PPA hợp đồng 3 năm.</li>
  <li><strong>Chris Haworth</strong> — từng là số 1 APP, giờ đã sang PPA.</li>
</ul>
<p>Quy luật khá rõ: VĐV ưu tiên thu nhập tối đa và sân khấu toàn cầu thường về PPA và chấp nhận mất tự do; VĐV ưu tiên tự chủ, thi đấu khu vực, và xây thương hiệu cá nhân thường ở APP và chấp nhận tiền ít hơn.</p>

<h2>Hợp đồng Quang Dương: Case study rõ nhất từ Châu Á</h2>
<p>Quang Dương đặc biệt mang tính học thuật vì sự nghiệp của anh đã đi qua cả hai hệ thống. Anh thi đấu và lên hạng tại các giải PPA Mỹ trong 2024–2025, bị cắt hợp đồng giữa 2025, và cuối cùng ký APP đầu 2026 khi rõ ràng PPA không định gia hạn.</p>
<p>Hợp đồng APP — nhiều năm, không độc quyền, 4 APP + 4 D Joy — cho anh đúng những gì một top pro Việt Nam thực sự cần: <strong>sân khấu quốc tế qua các giải APP Mỹ, sự hiện diện trong nước qua D Joy Việt Nam, và tự do tổ chức camp, exhibition, branding cá nhân</strong> mà không phải xin phép tour nào. PPA, tại thời điểm này, không thực tế mở cửa cho anh nữa. APP là tổ chức lớn nhất còn lại để ký.</p>
<p><strong>Đọc thêm:</strong></p>
<ul>
  <li><a href="/blog/pickleball-world-cup-2026-da-nang">World Cup Pickleball 2026 tại Đà Nẵng — vì sao Việt Nam là tâm điểm pickleball châu Á</a></li>
</ul>

<h2>Ý nghĩa với pro Việt Nam: Ba con đường năm 2026</h2>
<p>Với một VĐV pro Việt Nam đủ trình để có offer thực sự, năm 2026 có 3 con đường nghề nghiệp — mỗi đường có đánh đổi rõ ràng:</p>
<ol>
  <li><strong>Ký PPA (như Vinh Hiển)</strong> — được seed, được nhân đôi tiền thưởng ở một số nội dung, vào thẳng main draw. Đánh đổi: có thể mất hoàn toàn tự do về lịch và thương mại.</li>
  <li><strong>Ký APP (như Quang Dương)</strong> — giữ tự do, đánh D Joy ở Việt Nam, xây thương hiệu cá nhân, nhưng chấp nhận tiền ít hơn nhiều và không được vào PPA.</li>
  <li><strong>Không ký gì (như Lý Hoàng Nam và Phúc Huỳnh trước đây)</strong> — tự do hoàn toàn nhưng không seed, hạng tiền thưởng thấp nhất, thường phải đánh sơ loại tại các giải lớn.</li>
</ol>
<p>Không có lựa chọn nào hoàn hảo. Chỉ có lựa chọn phù hợp với mỗi người.</p>

<h2>Thực tế tài chính của APP và điều gì sắp tới</h2>
<p>Có một biến số khó chịu trong bức tranh APP: tour này <strong>đang lỗ khoảng 8–9 triệu USD/năm</strong> theo nguồn báo cáo. Đường băng còn dài bao lâu — chưa ai trả lời chắc chắn.</p>
<p>Cuối 2026 sẽ là thời điểm bản lề cho cả hệ sinh thái pro pickleball. Phần lớn hợp đồng độc quyền PPA gốc ký trong giai đoạn ''Tour Wars'' 2023 sẽ hết hạn. Công đoàn VĐV mới <strong>WPPA</strong> đang xây dựng lập luận pháp lý chống lại các điều khoản độc quyền nghiêm khắc nhất. Nếu đủ top player từ chối gia hạn theo điều khoản cũ — hoặc WPPA thắng kiện — cán cân giữa PPA và APP có thể dịch chuyển nhiều hơn trong năm 2027 so với cả ba năm vừa qua cộng lại.</p>
<p>Hiện tại, câu trả lời cho ''APP hay PPA — cái nào tốt hơn?'' vẫn là câu cũ: tùy bạn là VĐV nào.</p>
<p><strong>Đọc thêm:</strong></p>
<ul>
  <li><a href="/blog/how-to-watch-ppa-tour-live-2026">Cách xem PPA Tour trực tiếp 2026 — hướng dẫn streaming đầy đủ</a></li>
  <li><a href="/tournaments">Xem các giải đấu pro và nghiệp dư sắp tới</a></li>
</ul>',
  '/images/blog/app-tour-vs-ppa-tour-contracts-hero.webp',
  'Cuong Nguyen',
  'Phân tích',
  ARRAY['app tour', 'ppa tour', 'pickleball chuyên nghiệp', 'hợp đồng', 'quang dương', 'global pickleball alliance', 'd joy tour'],
  'hợp đồng app tour',
  '[
    {"question": "APP Tour là gì?", "answer": "APP Tour (Association of Pickleball Players Tour) là một trong hai tour pro pickleball lớn. Trước đây APP hoạt động theo mô hình chợ tự do — đăng ký mở, chỉ trả tiền thưởng theo giải, không lương và không hợp đồng độc quyền — nhưng đầu 2026 đã bắt đầu ký một số ít hợp đồng nhiều năm không độc quyền."},
    {"question": "APP Tour và PPA Tour khác nhau như thế nào năm 2026?", "answer": "PPA Tour có lương đảm bảo, tổng quỹ thưởng lớn, và giải MLP — nhưng hợp đồng độc quyền và kiểm soát chặt. APP Tour trả tiền danh nghĩa thấp hơn nhiều (~3–4 triệu USD/năm so với 31 triệu của PPA), không có MLP tương đương, và dùng hợp đồng không độc quyền nên VĐV vẫn đánh được tour khu vực như D Joy Việt Nam."},
    {"question": "Hợp đồng APP Tour có độc quyền không?", "answer": "Không. Khác PPA, hợp đồng APP năm 2026 không độc quyền. VĐV ký APP vẫn được tham gia giải khu vực, mở clinic riêng, đánh exhibition, chọn vợt và trang phục bất kỳ mà không cần tour duyệt. Hợp đồng thường chỉ yêu cầu VĐV cam kết một số giải APP và tour đối tác mỗi năm."},
    {"question": "Vì sao Quang Dương ký với APP thay vì PPA?", "answer": "Quang Dương bị PPA cắt hợp đồng tháng 7/2025. Sau khi PPA không gia hạn, anh ký hợp đồng APP nhiều năm không độc quyền đầu 2026, gồm 4 giải APP tại Mỹ và 4 giải D Joy Tour tại Việt Nam mỗi năm. Cấu trúc này cho phép anh thi đấu cả quốc tế lẫn trong nước Việt Nam và giữ tự do thương mại hoàn toàn."},
    {"question": "Global Pickleball Alliance (GPA) là gì?", "answer": "Global Pickleball Alliance là mạng lưới tour quốc gia đối tác của APP — gồm D Joy (Việt Nam), NPL (Úc), Global Sports (Ấn Độ), CNPL (Canada), EPF (Châu Âu), Pickleball England. APP cung cấp thương hiệu, hệ thống xếp hạng GPR và kết nối VĐV xuyên tour, mỗi đối tác tự tổ chức giải. Đây là mô hình chi phí thấp hơn so với cách PPA Tour Asia sở hữu hoàn toàn."},
    {"question": "Một pro có thể kiếm được bao nhiêu trên APP Tour?", "answer": "Giải APP lớn nhất có tổng quỹ thưởng khoảng 150.000 USD chia cho tất cả các nội dung. Không có lương đảm bảo, MLP, hay phí appearance lớn, VĐV chỉ dựa vào APP phải liên tục đi sâu mới đủ thu nhập sống bằng nghề — đó là lý do hầu hết VĐV ký APP còn dựa vào thu nhập từ tour khu vực và tài trợ cá nhân."},
    {"question": "Vì sao D Joy Tour của APP quan trọng với pickleball Việt Nam?", "answer": "D Joy Tour là cánh tay của GPA tại Việt Nam và tổ chức 4 chặng/năm. Đó là lý do chính khiến việc ký APP có ý nghĩa với một pro Việt Nam — VĐV có thể thi đấu quốc tế qua circuit APP Mỹ và vẫn đánh 4 giải lớn tại Việt Nam, tất cả trong cùng một khung hợp đồng."}
  ]'::jsonb,
  ARRAY['cach-choi-pickleball-cho-nguoi-moi'],
  'app-tour-vs-ppa-tour-contracts-2026',
  'published',
  NOW()
);

-- ─── 3. Verify ──────────────────────────────────────────────────────────
SELECT id, slug, title, status, published_at, alternate_en_slug, jsonb_array_length(faq_items) AS faq_count
FROM vi_blog_posts
WHERE slug = 'hop-dong-app-tour-vs-ppa-tour-2026';

-- Expect: 1 row with status='published', alternate_en_slug='app-tour-vs-ppa-tour-contracts-2026', faq_count=7.

-- ─── 4. Test live (after EN post deploys to www.thepicklehub.net) ───────
-- VI: https://www.thepicklehub.net/vi/blog/hop-dong-app-tour-vs-ppa-tour-2026
-- EN: https://www.thepicklehub.net/blog/app-tour-vs-ppa-tour-contracts-2026
-- Hreflang: should appear in both pages' <head> linking each other.
