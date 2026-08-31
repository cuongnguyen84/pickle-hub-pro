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
  updatedDate: "2026-08-31",
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
      title: "Pickleball World Cup 2026 Results: Vietnam's Matches, Live from Da Nang",
      metaTitle: "Pickleball World Cup 2026 Results: Vietnam Matches",
      metaDescription:
        "Pickleball World Cup 2026 Da Nang results: every match with a Vietnamese player plus live scores from the five Pro draws, updated continuously.",
      sections: [
        {
          heading: "Latest results",
          content:
            "The Heineken Pickleball World Cup 2026 runs August 30 to September 6, 2026 in Da Nang, Vietnam, with 69 events, 156 national teams and nearly 5,000 athletes from more than 80 countries and territories. ThePickleHub tracks the five Pro individual draws here: the table below lists every match on court right now and every completed match in those draws, with the score game by game and the winner, grouped by the day it was played, newest day first. The feed is read from the organizers' own system every minute, so the \"last updated\" line at the top of the table is a real timestamp rather than the date this article was written.",
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
            "Worth being exact, because a results page that overstates its scope is worse than one that states it plainly. The table above holds every match currently being played in the five Pro individual draws at the Pickleball World Cup 2026, and every completed match in those same draws — both Vietnamese and foreign. What it does not hold is the rest of the individual tournament: the amateur brackets split by DUPR band, and the junior, senior and master draws, which run on their own schedule and are not part of the Pro competition. Completed scores are read from the tournament's official bracket pages, which publish the per-game final and name the winner, so these are real results rather than a frozen snapshot. The one exception is brief: a match that has just left the live feed before its bracket page catches up shows the last score ThePickleHub observed, and the official result replaces it on the next pass a minute or two later.",
        },
        {
          heading: "Two tournaments on one schedule",
          content:
            "The individual tournament and the national-team competition are separate events sharing a venue and a name, and confusing them is the most common mistake in coverage of this World Cup. The individual tournament — the Pro draws in the table above, plus the amateur, junior, senior and master brackets — started Sunday August 30 and runs to September 6, 2026. The national-team competition, the one Vietnam's team is in, starts Thursday September 3 and finishes Sunday September 6. A Vietnamese player winning a Pro draw is not the Vietnam team winning anything, and the reverse.",
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
            "Vietnam is the top seed in Group A of the Open division at the Pickleball World Cup 2026, drawn with Colombia, the Cayman Islands and Chile, and enters on Thursday September 3. The three remaining Vietnamese teams start on Friday September 4: Master 60+, U18 in Group A with Malaysia, Costa Rica and South Korea, and U14 in Group A with Australia and Singapore. Because a team tie is six predetermined singles and doubles matches rather than a best-of-three between two stars, squad depth decides these ties more often than a headline name does — which is the thing to watch in Group A.",
        },
        {
          heading: "The finals, September 6",
          content:
            "The Pickleball World Cup 2026 closes on Sunday September 6, 2026 at Tien Son Sports Palace in Da Nang. The individual tournament's Pro finals run 08:00 to 18:00 on court 1, with the five OPEN Pro finals timed 10:10 to 14:50. The national-team matches that day are set for 08:00, 16:00 and 18:00. Vietnam's national holiday falls on Wednesday September 2, which is also the Opening Ceremony, 18:00 to 20:00 — the ceremony sits in the middle of the individual tournament rather than before it, another consequence of two events sharing one schedule.",
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
            "Vietnam's Open team enters on Thursday September 3, 2026 as the top seed in Group A alongside Colombia, the Cayman Islands and Chile. The Master 60+, U18 and U14 teams start on Friday September 4, 2026.",
        },
        {
          question: "When is the Pickleball World Cup 2026 final?",
          answer:
            "Sunday September 6, 2026 at Tien Son Sports Palace in Da Nang. The five OPEN Pro finals run 10:10 to 14:50 on court 1; the national-team matches are timed 08:00, 16:00 and 18:00.",
        },
        {
          question: "How many events are there at the Pickleball World Cup 2026?",
          answer:
            "69 in total — 33 international individual events and 36 in the national-team competition, contested by 156 teams across five divisions: Open, Senior, Master, Junior and Kids.",
        },
      ],
    },
    vi: {
      title: "Kết quả Pickleball World Cup 2026 Đà Nẵng: trận của Việt Nam, cập nhật từng phút",
      metaTitle: "Kết quả Pickleball World Cup 2026 Đà Nẵng",
      metaDescription:
        "Kết quả Pickleball World Cup 2026 Đà Nẵng: trận của Việt Nam và trận đang đấu, tỉ số từng ván, cập nhật liên tục.",
      sections: [
        {
          heading: "Kết quả mới nhất",
          content:
            "Heineken Pickleball World Cup 2026 diễn ra từ 30/8 đến 6/9/2026 tại Đà Nẵng với 69 nội dung, 156 đội tuyển quốc gia và gần 5.000 vận động viên từ hơn 80 quốc gia và vùng lãnh thổ. ThePickleHub theo dõi năm nội dung cá nhân Pro tại đây: bảng ngay bên dưới liệt kê mọi trận đang thi đấu và mọi trận đã kết thúc ở các nội dung này, kèm tỉ số từng ván và người thắng, nhóm theo ngày thi đấu, ngày mới nhất lên đầu. Dữ liệu đọc thẳng từ hệ thống của ban tổ chức mỗi phút, nên dòng \"cập nhật lần cuối\" ở đầu bảng là giờ thật chứ không phải ngày viết bài.",
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
            "Nói rõ cho đúng, vì một trang kết quả nói quá phạm vi của mình thì tệ hơn một trang nói thẳng. Bảng phía trên chứa mọi trận đang thi đấu ở năm nội dung cá nhân Pro của Pickleball World Cup 2026, và mọi trận đã kết thúc ở chính năm nội dung đó — cả trận Việt Nam lẫn trận nước ngoài. Thứ bảng không có là phần còn lại của giải cá nhân: các bảng nghiệp dư chia theo trình DUPR, cùng các nhánh trẻ, senior và master, vốn chạy lịch riêng và không thuộc hệ Pro. Tỉ số các trận đã xong lấy từ trang nhánh đấu chính thức của giải, nơi công bố tỉ số từng ván và tên người thắng, nên đây là kết quả thật chứ không phải ảnh chụp đông cứng. Chỉ có một ngoại lệ ngắn: trận vừa kết thúc và rời bảng trực tiếp trước khi nhánh đấu kịp cập nhật sẽ hiển thị tỉ số ThePickleHub ghi nhận cuối cùng, rồi được thay bằng kết quả chính thức ở lượt quét sau đó một hai phút.",
        },
        {
          heading: "Hai giải trên cùng một lịch",
          content:
            "Giải cá nhân và giải đồng đội quốc gia là hai giải riêng biệt dùng chung địa điểm và chung cái tên, và nhầm hai giải này là lỗi phổ biến nhất khi đưa tin về World Cup lần này. Giải cá nhân — các nhánh Pro trong bảng trên, cộng với các bảng nghiệp dư, trẻ, senior và master — bắt đầu Chủ nhật 30/8 và chạy tới 6/9/2026. Giải đồng đội quốc gia, nơi đội tuyển Việt Nam góp mặt, bắt đầu thứ Năm 3/9 và kết thúc Chủ nhật 6/9. Một vận động viên Việt Nam vô địch một nhánh Pro không có nghĩa là đội tuyển Việt Nam vô địch, và ngược lại.",
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
            "Việt Nam là hạt giống số 1 bảng A nội dung Open tại Pickleball World Cup 2026, cùng bảng Colombia, Quần đảo Cayman và Chile, ra quân thứ Năm 3/9. Ba đội còn lại vào cuộc thứ Sáu 4/9: Master 60+, U18 ở bảng A cùng Malaysia, Costa Rica và Hàn Quốc, U14 ở bảng A cùng Úc và Singapore. Vì một cặp đấu đồng đội gồm sáu trận đơn và đôi đã ấn định trước chứ không phải cuộc so tài giữa hai ngôi sao, chiều sâu đội hình quyết định nhiều hơn một cái tên lớn — và đó là điều đáng theo dõi ở bảng A.",
        },
        {
          heading: "Chung kết ngày 6/9",
          content:
            "Pickleball World Cup 2026 khép lại Chủ nhật 6/9/2026 tại Nhà thi đấu Tiên Sơn, Đà Nẵng. Các trận chung kết Pro của giải cá nhân diễn ra 08:00–18:00 trên sân số 1, trong đó năm trận chung kết OPEN Pro được xếp từ 10:10 đến 14:50. Các trận đồng đội quốc gia trong ngày bắt đầu lúc 08:00, 16:00 và 18:00. Quốc khánh 2/9 rơi vào thứ Tư, cũng là ngày Lễ khai mạc 18:00–20:00 — lễ khai mạc nằm giữa giải cá nhân chứ không phải trước giải, thêm một hệ quả của việc hai giải dùng chung một lịch.",
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
            "Đội Open Việt Nam ra quân thứ Năm 3/9/2026, là hạt giống số 1 bảng A cùng Colombia, Quần đảo Cayman và Chile. Các đội Master 60+, U18 và U14 vào cuộc thứ Sáu 4/9/2026.",
        },
        {
          question: "Chung kết Pickleball World Cup 2026 diễn ra khi nào?",
          answer:
            "Chủ nhật 6/9/2026 tại Nhà thi đấu Tiên Sơn, Đà Nẵng. Năm trận chung kết OPEN Pro diễn ra 10:10–14:50 trên sân số 1; các trận đồng đội quốc gia bắt đầu lúc 08:00, 16:00 và 18:00.",
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
