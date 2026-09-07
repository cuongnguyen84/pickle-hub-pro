import type { BlogPost } from "@/content/blog/types";

// The prose is static and carries only the stable numbers — 69 events, 156
// teams, the dates, the venues. Every volatile fact (how many matches have a
// result, who won what, when the page was last updated) lives in the liveBlock
// table, which reads wc_pro_matches at request time. A results page whose prose
// claims "12 of 69 decided" is wrong within hours and nobody notices; the same
// goes for a hand-typed "last updated" line, which is why the dateline is
// generated inside the block. See functions/_lib/render/wc-results.ts.
//
// Scope claims track what the scraper actually stores. It kept Vietnamese
// finals only until 2026-08-31; it now keeps every completed Pro match, so the
// page says so. The one thing still worth stating plainly is the boundary: the
// five Pro draws, not the amateur, junior, senior and master brackets.

const post: BlogPost = {
  slug: "pickleball-world-cup-2026-da-nang-results",
  publishedDate: "2026-08-31",
  updatedDate: "2026-09-07",
  author: "Cuong Nguyen",
  tags: [
    "ket qua pickleball world cup 2026",
    "pickleball world cup 2026 results",
    "world cup pickleball da nang",
    "heineken pickleball world cup",
    "doi tuyen pickleball viet nam",
    "pickleball da nang 2026",
    "pro singles pickleball",
  ],
  ctaPath: "/live",
  ctaLabel: {
    en: "Follow the World Cup live on ThePickleHub",
    vi: "Theo dõi World Cup trực tiếp trên ThePickleHub",
  },
  heroImage: {
    src: "/images/blog/pickleball-world-cup-2026-da-nang-results-hero.webp",
    alt: "Illustration: a courtside results board glows beside a blue championship court at the Pickleball World Cup 2026 in Da Nang, Vietnam, as a player walks past carrying a paddle.",
  },
  content: {
    en: {
      title: "Pickleball World Cup 2026 Da Nang Results: Every Pro Match, Day by Day",
      metaTitle: "Pickleball World Cup 2026 Results: Every Pro Match",
      metaDescription:
        "Pickleball World Cup 2026 Da Nang results: every match in the five Pro draws, live and completed, with per-game scores and winners.",
      sections: [
        {
          heading: "Latest results",
          content:
            "The Heineken Pickleball World Cup 2026 in Da Nang, Vietnam finished on Sunday September 6, 2026, and all five Pro finals are decided. Last updated Monday September 7, 2026. Ly Hoang Nam beat his compatriot Phuc Huynh 6-15, 16-14, 15-10 to take Pro men's singles gold in the only all-Vietnamese final of the tournament. Katerina Stewart beat Roos Van Reek 15-4, 15-9 in Pro women's singles. Jack Munro and Nicola Schoeman beat Ly Hoang Nam and Roos Van Reek 15-11, 15-10 in Pro mixed doubles. Selina Turulja and Nicola Schoeman beat Domenika Turkovic and Katerina Stewart 15-7, 15-8 in Pro women's doubles. Richard Livornese Jr and Jack Munro beat Ly Hoang Nam and Nguyen Anh Gia Huy 15-12, 15-13 in Pro men's doubles. In the Open national-team final that closed the tournament at 19:40, the United States beat Vietnam 4-0 — 21-17, 21-10, 21-16, 21-14 — so Vietnam took silver. Ly Hoang Nam played four of the eight finals and won one. The tournament ran August 30 to September 6, 2026 with 69 events, 156 national teams and nearly 5,000 athletes from more than 80 countries and territories, and Vietnam finished top of the medal table. ThePickleHub tracks the five Pro individual draws here: the table below lists every completed match in those draws, with the score game by game and the winner, grouped by the day it was played, newest day first. The table is now a final record rather than a live one — the organizers' feed returned its last new Pro match at 17:57 on September 6, shortly after the men's doubles final, and then stopped.",
          liveBlock: "wc-results",
          internalLinks: [
            {
              text: "Full schedule for both tournaments, day by day",
              path: "/blog/pickleball-world-cup-2026-da-nang-schedule",
            },
          ],
        },
        {
          heading: "What this table covers, and what it leaves out",
          content:
            "Worth being exact, because a results page that overstates its scope is worse than one that states it plainly. The table above holds every completed match in the five Pro individual draws at the Pickleball World Cup 2026 — both Vietnamese and foreign. What it does not hold is the rest of the individual tournament: the amateur brackets split by DUPR band, and the junior, senior and master draws, which ran on their own schedule and were not part of the Pro competition. Scores are read from the tournament's official bracket pages, which publish the per-game final and name the winner. The tournament is over, so the table no longer changes: the organizers' feed returned its last new Pro match at 17:57 on September 6 and has been silent since, and the timestamp above the table is the honest reading of when it was last refreshed.",
        },
        {
          heading: "The medal table: Vietnam 106 golds after five days",
          content:
            "Vietnam finished top of the Heineken Pickleball World Cup 2026 medal table. Kenh14, republishing Doi song &amp; Phap luat on the night of September 6, put the host on 106 gold medals at the close of the tournament, ahead of South Korea and the United States. One caveat readers deserve: 106 is the same gold count Tuoi Tre reported on September 4 for play through September 3, alongside 244 medals in total, so the closing figure may be a carried-forward number rather than a recount, and no organizer-published final table has appeared. ThePickleHub tracks the five Pro draws in the table above, but the medal table counts something far wider, and the size of the lead has a structural explanation rather than a competitive one. The tournament ran close to 8,500 matches across seven court clusters in Da Nang, roughly 1,000 a day, spread over 69 events: the 156-team national competition and a much larger individual programme banded by DUPR level, age group and category. The host had by far the most entrants across those bands, so it reached the most finals. Tuoi Tre quotes a Da Nang badminton federation official making the point plainly — the Vietnam Pickleball Federation itself was founded only months ago, and Da Nang 2026 is better read as a sport-tourism festival than as a ranking of national strength. Both things hold at once: the number is real, and it does not mean what a World Cup medal table usually means.",
          table: {
            caption: "Vietnam's medal count at the Pickleball World Cup 2026, day by day",
            headers: ["Counted through", "Gold", "Silver", "Bronze", "Total"],
            rows: [
              ["September 1 (3 days)", "90", "62", "54", "206"],
              ["September 2 (4 days)", "96", "66", "58", "220"],
              ["September 3 (5 days)", "106", "not published", "not published", "244"],
            ],
          },
        },
        {
          heading: "Two tournaments on one schedule",
          content:
            "The individual tournament and the national-team competition are separate events sharing a venue and a name, and confusing them is the most common mistake in coverage of this World Cup. The individual tournament — the Pro draws in the table above, plus the amateur, junior, senior and master brackets — started Sunday August 30 and runs to September 6, 2026. The national-team competition, the one Vietnam's team is in, started Thursday September 3 and finishes Sunday September 6. A Vietnamese player winning a Pro draw is not the Vietnam team winning anything, and the reverse.",
          table: {
            caption: "The two competitions at the Pickleball World Cup 2026",
            headers: ["", "Individual tournament", "National-team competition"],
            rows: [
              ["Dates", "August 30 – September 6, 2026", "September 3 – September 6, 2026"],
              ["Who enters", "Individuals, by DUPR band and age", "156 teams, five divisions"],
              ["Vietnam", "Vietnamese players across many draws", "Top seed, Group A (Open)"],
              ["Format", "Standard draws", "Six fixed matches per tie, to 21, rally scoring"],
              ["In the table above", "Yes — the five Pro draws", "From September 3"],
            ],
          },
        },
        {
          heading: "When Vietnam plays at the Pickleball World Cup 2026",
          content:
            "Vietnam won Group A of the Open division at the Pickleball World Cup 2026 on Thursday September 3, beating Chile, the Cayman Islands and Colombia 6-0 each — 18 individual matches to nil — as the group's top seed. Vietnam's junior teams played from Friday September 4: U18 in Group A with Malaysia, Costa Rica and South Korea, and U14 in Group A with Australia and Singapore. The Open team then went through the knockout unbeaten — South Africa and the Netherlands on September 4, then Australia and Japan on September 5. The Australia quarter-final went the distance: Vietnam lost the women's doubles 11-21, won the men's doubles 21-6 and the mixed 21-13, lost the fourth rubber and the women's singles 14-21 to trail 2-3, levelled at 3-3 through the men's singles 21-13, and took the deciding Final Battle 21-16 from 8-12 down. The semi-final against Japan was 4-0 and ended early: Ly Hoang Nam and Trinh Linh Giang won the men's doubles 21-12, Ly Hoang Nam and Si Boi Ngoc the mixed 21-12, Sophia Huynh Tran and Ken Tam the women's doubles 21-15, and Sophia Huynh Tran with Quang Duong the second mixed 21-17, so the two singles rubbers were not needed. That is the national-team competition; in the individual junior draws Vietnam had already taken a world title on September 3, when Tong Nhat Minh (Minh Tit) and Jolie Lam beat Hudson Hall and Circa Luna Sacca 2-0 in the U18 mixed doubles final, the first game 15-7. Sources disagree on whether Vietnam also entered a Masters team: VNA's report of the August 16 draw put Vietnam in Group A in Open, Masters, Juniors and Kids, while the squad announcement of August 17 named athletes for the Open, U18 and U14 teams only. Because a team tie is six predetermined singles and doubles matches rather than a best-of-three between two stars, squad depth decides these ties more often than a headline name does — which is the thing to watch in Group A.",
        },
        {
          heading: "The finals, September 6",
          content:
            "The Pickleball World Cup 2026 closed on Sunday September 6, 2026 at Tien Son Sports Palace in Da Nang with eight finals. Five were Pro finals on court 1. Pro women's singles 09:30: Katerina Stewart beat Roos Van Reek 15-4, 15-9. Pro men's singles 10:50: Ly Hoang Nam beat Phuc Huynh 6-15, 16-14, 15-10, so both the gold and the silver went to Vietnam. Pro mixed doubles 12:40: Jack Munro and Nicola Schoeman beat Ly Hoang Nam and Roos Van Reek 15-11, 15-10. Pro women's doubles: Selina Turulja and Nicola Schoeman beat Domenika Turkovic and Katerina Stewart 15-7, 15-8. Pro men's doubles: Richard Livornese Jr and Jack Munro beat Ly Hoang Nam and Nguyen Anh Gia Huy 15-12, 15-13. Three were national-team finals: Juniors at 08:00 and the Open final at 19:40, both Vietnam against the United States, and Seniors at 14:00, Brazil against Spain. The United States won the Open final 4-0 — 21-17, 21-10, 21-16, 21-14 — and Vietnam took the silver, the country's first World Cup team medal. One note on timing for anyone reconciling this page against the bracket: the two evening Pro finals were played about 75 minutes earlier than the published 17:00 and 18:20 slots. The Opening Ceremony was on Wednesday September 2, Vietnam's national holiday, 18:00 to 20:00 — the ceremony sat in the middle of the individual tournament rather than before it, a consequence of two events sharing one schedule.",
          internalLinks: [
            {
              text: "Tickets, venues and how to watch on FPT Play",
              path: "/blog/pickleball-world-cup-2026-da-nang-how-to-watch",
            },
            {
              text: "Every pickleball tournament in Vietnam in 2026",
              path: "/blog/vietnam-pickleball-tournament-calendar-2026",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "Where can I find Pickleball World Cup 2026 results?",
          answer:
            "ThePickleHub publishes live Pickleball World Cup 2026 results from Da Nang on this page: every match in the five Pro individual draws, on court and completed, with per-game scores and the winner, grouped by the day it was played. The feed is read from the tournament's own system every minute rather than typed up once a day.",
        },
        {
          question: "Are these the official Pickleball World Cup 2026 scores?",
          answer:
            "Yes for completed matches: ThePickleHub reads them from the tournament's official bracket pages, which publish the per-game final and name the winner. The single exception is a match that has just finished and left the live feed before its bracket page updates — it shows the last observed score for a minute or two until the official result replaces it.",
        },
        {
          question: "Does this page cover every match at the Pickleball World Cup 2026?",
          answer:
            "It covers the five Pro individual draws in full — men's and women's singles, men's and women's doubles, and mixed — every match live and completed, whatever the players' nationality. The amateur brackets split by DUPR band and the junior, senior and master draws are separate competitions and are not included.",
        },
        {
          question: "When does Vietnam's national team play at the Pickleball World Cup 2026?",
          answer:
            "Vietnam's Open team won Group A on Thursday September 3, 2026, beating Chile, the Cayman Islands and Colombia 6-0 each as the group's top seed. The U18 and U14 national teams played their group stage on Friday September 4, 2026. Separately, in the individual junior draws, Tong Nhat Minh and Jolie Lam won the U18 mixed doubles world title on September 3.",
        },
        {
          question: "How many medals has Vietnam won at the Pickleball World Cup 2026?",
          answer:
            "106 gold medals and 244 medals in total after five days of play, counted through September 3, 2026, ahead of South Korea on 10 golds and the United States on 9. That count covers every division at the event — the 156-team national competition, the Pro draws, and the much larger amateur, age-group and junior individual brackets — not the five Pro draws listed on this page. The host enters by far the most players across those bands, which is the main reason the lead is this wide.",
        },
        {
          question: "Who won the Pickleball World Cup 2026 in Da Nang?",
          answer:
        "It finished on Sunday September 6, 2026 at Tien Son Sports Palace in Da Nang. Eight finals were played. Ly Hoang Nam won Pro men's singles over Phuc Huynh 6-15, 16-14, 15-10; Katerina Stewart won Pro women's singles over Roos Van Reek 15-4, 15-9; Jack Munro and Nicola Schoeman won Pro mixed doubles; Selina Turulja and Nicola Schoeman won Pro women's doubles; Richard Livornese Jr and Jack Munro won Pro men's doubles over Ly Hoang Nam and Nguyen Anh Gia Huy; and the United States beat Vietnam 4-0 in the Open national-team final at 19:40 to take the title, with Vietnam taking silver.",
        },
        {
          question: "How many events are there at the Pickleball World Cup 2026?",
          answer:
            "69 in total — 33 international individual events and 36 in the national-team competition, contested by 156 teams across five divisions: Open, Senior, Master, Junior and Kids.",
        },
      ],
    },
    vi: {
      title: "Kết quả Pickleball World Cup 2026 Đà Nẵng: mọi trận Pro, cập nhật từng phút",
      metaTitle: "Kết quả Pickleball World Cup 2026 Đà Nẵng",
      metaDescription:
        "Kết quả Pickleball World Cup 2026 Đà Nẵng: mọi trận Pro ở năm nội dung cá nhân, tỉ số từng ván, cập nhật liên tục.",
      sections: [
        {
          heading: "Kết quả mới nhất",
          content:
            "Heineken Pickleball World Cup 2026 tại Đà Nẵng đã khép lại Chủ nhật 6/9/2026, và cả năm trận chung kết Pro đều đã có kết quả. Cập nhật lần cuối thứ Hai 7/9/2026. Lý Hoàng Nam thắng ngược đồng hương Phúc Huỳnh 6-15, 16-14, 15-10 để giành HCV đơn nam Pro — trận chung kết nội bộ Việt Nam duy nhất của giải. Đơn nữ Pro: Katerina Stewart thắng Roos Van Reek 15-4, 15-9. Đôi nam nữ Pro: Jack Munro – Nicola Schoeman thắng Lý Hoàng Nam – Roos Van Reek 15-11, 15-10. Đôi nữ Pro: Selina Turulja – Nicola Schoeman thắng Domenika Turkovic – Katerina Stewart 15-7, 15-8. Đôi nam Pro: Richard Livornese Jr – Jack Munro thắng Lý Hoàng Nam – Nguyễn Ảnh Gia Huy 15-12, 15-13. Ở chung kết Đồng đội Quốc gia Open lúc 19:40 — trận khép lại cả giải — Mỹ thắng Việt Nam 4-0 (21-17, 21-10, 21-16, 21-14), Việt Nam giành huy chương bạc. Lý Hoàng Nam đánh bốn trong tám trận chung kết và thắng một. Giải diễn ra từ 30/8 đến 6/9/2026 với 69 nội dung, 156 đội tuyển quốc gia và gần 5.000 VĐV từ hơn 80 quốc gia và vùng lãnh thổ; Việt Nam dẫn đầu bảng tổng sắp huy chương. ThePickleHub theo dõi năm nội dung cá nhân Pro tại đây: bảng ngay bên dưới liệt kê mọi trận đã kết thúc ở năm nhánh đó, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu, ngày mới nhất trước. Bảng giờ là bản ghi cuối chứ không còn trực tiếp — dữ liệu ban tổ chức trả về trận Pro mới cuối cùng lúc 17:57 ngày 6/9, ngay sau chung kết đôi nam, rồi ngừng.",
          liveBlock: "wc-results",
          internalLinks: [
            {
              text: "Lịch thi đấu đầy đủ cả hai giải, theo từng ngày",
              path: "/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang",
            },
          ],
        },
        {
          heading: "Bảng này có gì và không có gì",
          content:
            "Nói rõ cho đúng, vì một trang kết quả nói quá phạm vi của mình thì tệ hơn một trang nói thẳng. Bảng phía trên chứa mọi trận đã kết thúc ở năm nội dung cá nhân Pro của Pickleball World Cup 2026 — cả trận Việt Nam lẫn trận nước ngoài. Thứ bảng không có là phần còn lại của giải cá nhân: các bảng nghiệp dư chia theo trình DUPR, cùng các nhánh trẻ, senior và master, vốn chạy lịch riêng và không thuộc hệ Pro. Tỉ số lấy từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng. Giải đã kết thúc nên bảng không còn thay đổi: dữ liệu ban tổ chức trả về trận Pro mới cuối cùng lúc 17:57 ngày 6/9 rồi im, và mốc thời gian ngay trên bảng là con số trung thực về lần làm mới cuối.",
        },
        {
          heading: "Bảng tổng sắp huy chương: Việt Nam 106 HCV sau 5 ngày",
          content:
            "Việt Nam dẫn đầu bảng tổng sắp Heineken Pickleball World Cup 2026 khi giải khép lại. Kenh14 dẫn lại Đời sống &amp; Pháp luật tối 6/9 ghi chủ nhà có 106 huy chương vàng lúc kết thúc giải, xếp trên Hàn Quốc và Hoa Kỳ. Một lưu ý người đọc xứng đáng được biết: 106 đúng bằng số HCV mà Tuổi Trẻ đăng ngày 4/9 cho phần thi đấu tính tới hết 3/9 (kèm 244 huy chương các loại), nên con số cuối có thể là số cũ được chép lại chứ không phải kết quả đếm lại, và chưa có bảng tổng sắp chung cuộc nào do ban tổ chức công bố. ThePickleHub theo dõi năm nhánh Pro ở bảng phía trên, nhưng bảng tổng sắp đếm phạm vi rộng hơn rất nhiều, và khoảng cách lớn này đến từ cấu trúc giải chứ không phải từ tương quan trình độ. Giải có gần 8.500 trận trên bảy cụm sân tại Đà Nẵng, trung bình khoảng 1.000 trận mỗi ngày, trải trên 69 nội dung: giải đồng đội 156 đội, cộng với một chương trình cá nhân lớn hơn nhiều, chia theo trình DUPR, nhóm tuổi và hạng mục. Chủ nhà có số lượng VĐV dự các nhánh đó đông áp đảo, nên vào tới chung kết ở nhiều nhánh nhất. Tuổi Trẻ dẫn lời một thành viên Liên đoàn Cầu lông TP Đà Nẵng nói thẳng điều này: Liên đoàn Pickleball Việt Nam mới thành lập vài tháng, và nên xem Đà Nẵng 2026 là ngày hội thể thao — du lịch chứ không phải bảng xếp hạng sức mạnh pickleball các nước. Hai điều cùng đúng: con số là thật, và nó không mang ý nghĩa mà một bảng tổng sắp World Cup thường mang.",
          table: {
            caption: "Huy chương của đoàn Việt Nam tại Pickleball World Cup 2026, theo từng mốc",
            headers: ["Tính tới hết", "HCV", "HCB", "HCĐ", "Tổng"],
            rows: [
              ["1/9 (3 ngày)", "90", "62", "54", "206"],
              ["2/9 (4 ngày)", "96", "66", "58", "220"],
              ["3/9 (5 ngày)", "106", "chưa công bố", "chưa công bố", "244"],
            ],
          },
        },
        {
          heading: "Hai giải trên cùng một lịch",
          content:
            "Giải cá nhân và giải đồng đội quốc gia là hai giải riêng biệt dùng chung địa điểm và chung cái tên, và nhầm hai giải này là lỗi phổ biến nhất khi đưa tin về World Cup lần này. Giải cá nhân — các nhánh Pro trong bảng trên, cộng với các bảng nghiệp dư, trẻ, senior và master — bắt đầu Chủ nhật 30/8 và chạy tới 6/9/2026. Giải đồng đội quốc gia, nơi đội tuyển Việt Nam góp mặt, đã bắt đầu thứ Năm 3/9 và kết thúc Chủ nhật 6/9. Một vận động viên Việt Nam vô địch một nhánh Pro không có nghĩa là đội tuyển Việt Nam vô địch, và ngược lại.",
          table: {
            caption: "Hai giải tại Pickleball World Cup 2026",
            headers: ["", "Giải cá nhân", "Giải đồng đội quốc gia"],
            rows: [
              ["Thời gian", "30/8 – 6/9/2026", "3/9 – 6/9/2026"],
              ["Ai dự", "Cá nhân, theo trình DUPR và độ tuổi", "156 đội, 5 hạng mục"],
              ["Việt Nam", "VĐV Việt Nam ở nhiều nhánh", "Hạt giống số 1, bảng A (Open)"],
              ["Thể thức", "Nhánh đấu thông thường", "6 trận ấn định mỗi cặp, 21 điểm, rally"],
              ["Có trong bảng trên", "Có — năm nhánh Pro", "Từ 3/9"],
            ],
          },
        },
        {
          heading: "Việt Nam thi đấu ngày nào tại Pickleball World Cup 2026",
          content:
            "Việt Nam nhất bảng A nội dung Open tại Pickleball World Cup 2026 ngay trong ngày thứ Năm 3/9, thắng Chile, Quần đảo Cayman và Colombia cùng tỉ số 6-0 — tổng cộng 18 trận thắng, 0 thua — với tư cách hạt giống số 1. Các đội trẻ vào cuộc từ thứ Sáu 4/9: U18 ở bảng A cùng Malaysia, Costa Rica và Hàn Quốc, U14 ở bảng A cùng Úc và Singapore. Đội Open sau đó đi qua vòng loại trực tiếp mà không thua trận nào — thắng Nam Phi và Hà Lan ngày 4/9, thắng Australia và Nhật Bản ngày 5/9. Trận tứ kết với Australia đi tới ván cuối: Việt Nam thua đôi nữ 11-21, thắng đôi nam 21-6 và đôi nam nữ 21-13, thua ván thứ tư rồi thua đơn nữ 14-21 để bị dẫn 2-3, gỡ hoà 3-3 nhờ đơn nam 21-13, và thắng ván phụ Final Battle 21-16 sau khi bị dẫn 8-12. Bán kết gặp Nhật Bản kết thúc sớm với tỉ số 4-0: Lý Hoàng Nam – Trịnh Linh Giang thắng đôi nam 21-12, Lý Hoàng Nam – Sĩ Bội Ngọc thắng đôi nam nữ 21-12, Sophia Huỳnh Trần – Tâm Ken thắng đôi nữ 21-15, Sophia Huỳnh Trần – Quang Dương thắng trận đôi nam nữ thứ hai 21-17, nên hai trận đơn còn lại không cần thi đấu. Đó là giải đồng đội; còn ở các nhánh trẻ cá nhân, Việt Nam đã có một chức vô địch thế giới từ ngày 3/9, khi Tống Nhật Minh (Minh Tít) và Jolie Lam thắng Hudson Hall – Circa Luna Sacca 2-0 ở chung kết đôi nam nữ U18, ván đầu 15-7. Các nguồn còn vênh nhau về việc Việt Nam có đội Master hay không: TTXVN khi đưa tin bốc thăm ngày 16/8 xếp Việt Nam vào bảng A ở Open, Master, Junior và Kids, còn bản công bố danh sách ngày 17/8 chỉ nêu VĐV cho ba đội Open, U18 và U14. Vì một cặp đấu đồng đội gồm sáu trận đơn và đôi đã ấn định trước chứ không phải cuộc so tài giữa hai ngôi sao, chiều sâu đội hình quyết định nhiều hơn một cái tên lớn — và đó là điều đáng theo dõi ở bảng A.",
        },
        {
          heading: "Chung kết ngày 6/9",
          content:
            "Pickleball World Cup 2026 khép lại Chủ nhật 6/9/2026 tại Cung Thể thao Tiên Sơn, Đà Nẵng, với tám trận chung kết. Năm trận là chung kết Pro trên sân 1. Đơn nữ Pro 09:30: Katerina Stewart thắng Roos Van Reek 15-4, 15-9. Đơn nam Pro 10:50: Lý Hoàng Nam thắng Phúc Huỳnh 6-15, 16-14, 15-10, nên cả HCV lẫn HCB đều thuộc về Việt Nam. Đôi nam nữ Pro 12:40: Jack Munro – Nicola Schoeman thắng Lý Hoàng Nam – Roos Van Reek 15-11, 15-10. Đôi nữ Pro: Selina Turulja – Nicola Schoeman thắng Domenika Turkovic – Katerina Stewart 15-7, 15-8. Đôi nam Pro: Richard Livornese Jr – Jack Munro thắng Lý Hoàng Nam – Nguyễn Ảnh Gia Huy 15-12, 15-13. Ba trận còn lại là chung kết đồng đội: Junior 08:00 và Open 19:40, đều là Việt Nam gặp Mỹ, và Senior 14:00 Brazil gặp Tây Ban Nha. Mỹ thắng chung kết Open 4-0 (21-17, 21-10, 21-16, 21-14); Việt Nam giành huy chương bạc — tấm huy chương đồng đội World Cup đầu tiên của pickleball Việt Nam. Một lưu ý về giờ giấc cho ai đối chiếu trang này với nhánh đấu: hai trận chung kết Pro buổi tối diễn ra sớm hơn khoảng 75 phút so với hai mốc 17:00 và 18:20 trong lịch công bố. Lễ khai mạc diễn ra thứ Tư 2/9, đúng Quốc khánh, từ 18:00 đến 20:00 — nằm giữa giải cá nhân chứ không phải trước giải, một hệ quả của việc hai giải dùng chung một lịch.",
          internalLinks: [
            {
              text: "Cẩm nang xem và vé Pickleball World Cup 2026",
              path: "/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang",
            },
            {
              text: "Cách chia bảng và xếp lịch thi đấu pickleball",
              path: "/vi/blog/cach-chia-bang-xep-lich-thi-dau-pickleball",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "Xem kết quả Pickleball World Cup 2026 ở đâu?",
          answer:
            "ThePickleHub đăng kết quả trực tiếp Pickleball World Cup 2026 Đà Nẵng trên trang này: mọi trận ở năm nội dung cá nhân Pro, cả đang đấu lẫn đã kết thúc, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu. Dữ liệu đọc từ hệ thống của ban tổ chức mỗi phút chứ không nhập tay mỗi ngày một lần.",
        },
        {
          question: "Đây có phải tỉ số chính thức của Pickleball World Cup 2026 không?",
          answer:
            "Với các trận đã kết thúc thì có: ThePickleHub lấy từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng. Ngoại lệ duy nhất là trận vừa kết thúc và rời bảng trực tiếp trước khi nhánh đấu kịp cập nhật — trận đó hiển thị tỉ số ghi nhận cuối cùng trong một hai phút, rồi được thay bằng kết quả chính thức.",
        },
        {
          question: "Trang này có đủ mọi trận của Pickleball World Cup 2026 không?",
          answer:
            "Trang này bao gồm đầy đủ năm nội dung cá nhân Pro — đơn nam, đơn nữ, đôi nam, đôi nữ và đôi nam nữ — mọi trận đang đấu và đã kết thúc, không phân biệt quốc tịch. Các bảng nghiệp dư chia theo trình DUPR cùng các nhánh trẻ, senior và master là những giải riêng, không nằm trong bảng.",
        },
        {
          question: "Đội tuyển Việt Nam thi đấu Pickleball World Cup 2026 ngày nào?",
          answer:
            "Đội Open Việt Nam nhất bảng A ngày thứ Năm 3/9/2026, thắng Chile, Quần đảo Cayman và Colombia cùng tỉ số 6-0 với tư cách hạt giống số 1. Hai đội tuyển trẻ U18 và U14 đã đấu vòng bảng thứ Sáu 4/9/2026. Riêng ở nhánh trẻ cá nhân, Tống Nhật Minh và Jolie Lam vô địch thế giới đôi nam nữ U18 ngày 3/9.",
        },
        {
          question: "Việt Nam giành bao nhiêu huy chương tại Pickleball World Cup 2026?",
          answer:
            "106 huy chương vàng và 244 huy chương sau 5 ngày thi đấu, tính tới hết 3/9/2026, xếp trên Hàn Quốc (10 HCV) và Hoa Kỳ (9 HCV). Con số này đếm toàn bộ các hạng mục của giải — giải đồng đội 156 đội, các nhánh Pro, và phần lớn hơn nhiều là các nhánh cá nhân nghiệp dư, nhóm tuổi và trẻ — chứ không phải năm nhánh Pro liệt kê trong bảng ở trang này. Chủ nhà có số VĐV dự các nhánh đó đông áp đảo, đây là lý do chính khiến khoảng cách rộng đến vậy.",
        },
        {
          question: "Ai vô địch Pickleball World Cup 2026 tại Đà Nẵng?",
          answer:
        "Giải khép lại Chủ nhật 6/9/2026 tại Cung Thể thao Tiên Sơn, Đà Nẵng, với tám trận chung kết. Lý Hoàng Nam vô địch đơn nam Pro sau khi thắng Phúc Huỳnh 6-15, 16-14, 15-10; Katerina Stewart vô địch đơn nữ Pro sau khi thắng Roos Van Reek 15-4, 15-9; Jack Munro – Nicola Schoeman vô địch đôi nam nữ Pro; Selina Turulja – Nicola Schoeman vô địch đôi nữ Pro; Richard Livornese Jr – Jack Munro vô địch đôi nam Pro sau khi thắng Lý Hoàng Nam – Nguyễn Ảnh Gia Huy; và Mỹ thắng Việt Nam 4-0 ở chung kết Đồng đội Quốc gia Open lúc 19:40 để lên ngôi vô địch, Việt Nam giành huy chương bạc.",
        },
        {
          question: "Pickleball World Cup 2026 có bao nhiêu nội dung thi đấu?",
          answer:
            "69 nội dung — 33 nội dung cá nhân quốc tế và 36 nội dung của giải đồng đội quốc gia, với 156 đội tuyển ở 5 hạng mục: Open, Senior, Master, Junior và Kids.",
        },
      ],
    },
  },
};

export default post;
