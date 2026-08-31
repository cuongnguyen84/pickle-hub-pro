import type { BlogPost } from "@/content/blog/types";

// The prose here is deliberately static and the numbers in it are the stable
// ones — 69 events, 156 teams, the dates, the venues. Every volatile fact (how
// many events have finished, who won what) lives in the `liveBlock` table,
// which reads wc_pro_matches at request time. A results page whose prose claims
// "12 of 69 decided" goes wrong within hours of publishing and nobody notices;
// keeping the counts in one place that cannot go stale is the point of the
// whole design. See functions/_lib/render/wc-results.ts.

const post: BlogPost = {
  slug: "pickleball-world-cup-2026-da-nang-results",
  publishedDate: "2026-08-31",
  updatedDate: "2026-08-31",
  author: "Cuong Nguyen",
  tags: [
    "pickleball world cup 2026 results",
    "ket qua pickleball world cup 2026",
    "world cup pickleball da nang",
    "heineken pickleball world cup",
    "pickleball da nang 2026",
    "doi tuyen pickleball viet nam",
    "pro singles pickleball",
  ],
  ctaPath: "/live",
  ctaLabel: {
    en: "Follow the World Cup live on ThePickleHub",
    vi: "Theo dõi World Cup trực tiếp trên ThePickleHub",
  },
  heroImage: {
    src: "/images/blog/pickleball-world-cup-2026-da-nang-hero.webp",
    alt: "Pickleball World Cup 2026 in Da Nang, Vietnam — two players at the net on a blue court with the Dragon Bridge behind them.",
  },
  content: {
    en: {
      title: "Pickleball World Cup 2026 Da Nang Results: Every Pro Match, Day by Day",
      metaTitle: "Pickleball World Cup 2026 Results: Da Nang, Day by Day",
      metaDescription:
        "Live Pickleball World Cup 2026 Da Nang results: every Pro match by day, scores as recorded, Vietnam's matches, and the finals on September 6.",
      sections: [
        {
          heading: "Results, updated as they come in",
          content:
            "The Heineken Pickleball World Cup 2026 runs August 30 to September 6, 2026 in Da Nang, Vietnam: 69 events, 156 national teams, nearly 5,000 athletes from more than 80 countries and territories, played across 76 courts at seven venues. This ThePickleHub page carries the five Pro individual draws — men's and women's singles, men's and women's doubles, and mixed — match by match, grouped by the Vietnam-time day each one finished. The table below is not a snapshot: it reads the same live feed the ThePickleHub live board reads, so it is current whenever you open it, and the national-team results join it once that competition starts on September 3.",
          liveBlock: "wc-results",
          internalLinks: [
            {
              text: "Full schedule for both tournaments, day by day",
              path: "/blog/pickleball-world-cup-2026-da-nang-schedule",
            },
          ],
        },
        {
          heading: "What these scores are, and what they are not",
          content:
            "One thing worth understanding before you read the table. The organizers' live page publishes only matches that are scheduled or in progress; a match that finishes drops out of the feed entirely, and no public page carries its official final score. ThePickleHub keeps history instead: when a match last seen in progress disappears, the score last observed is kept and the match is marked as recorded. That is why the column says 'score as recorded' rather than 'final', and why the last column names the side that was ahead rather than declaring a champion. For the overwhelming majority of matches the two are the same thing. For a match that vanished mid-game they are not, and saying so is cheaper than printing a wrong winner.",
        },
        {
          heading: "Two tournaments on one schedule",
          content:
            "The individual tournament and the national-team competition are separate events sharing a venue and a name, and confusing them is the single most common mistake in coverage of this World Cup. The individual tournament — the Pro draws in the table above, plus amateur, junior, senior and master brackets — started Sunday August 30 and runs to September 6. The national-team competition, the one Vietnam's team is in, starts Thursday September 3 and finishes Sunday September 6. A Vietnamese player winning a Pro draw is not the Vietnam team winning anything, and the reverse.",
          table: {
            caption: "The two competitions at the Pickleball World Cup 2026",
            headers: ["", "Individual tournament", "National-team competition"],
            rows: [
              ["Dates", "August 30 – September 6", "September 3 – September 6"],
              ["Who enters", "Individuals, by DUPR band and age", "156 teams, five divisions"],
              ["Vietnam", "Vietnamese players across many draws", "Top seed, Group A (Open)"],
              ["Format", "Standard draws", "Six fixed matches per tie, to 21, rally scoring"],
            ],
          },
        },
        {
          heading: "When Vietnam plays",
          content:
            "Vietnam is the top seed in Group A of the Open division, drawn with Colombia, the Cayman Islands and Chile, and enters on Thursday September 3. The three remaining Vietnamese teams start on Friday September 4: Master 60+, U18 in Group A with Malaysia, Costa Rica and South Korea, and U14 in Group A with Australia and Singapore. Because a team tie is six predetermined singles and doubles matches rather than a best-of-three between two stars, squad depth decides these ties more often than a headline name does — which is the thing to watch in Group A.",
        },
        {
          heading: "The finals",
          content:
            "The tournament closes on Sunday September 6 at Tien Son Sports Palace. The individual tournament's Pro finals run 08:00 to 18:00 on court 1, with the five OPEN Pro finals timed 10:10 to 14:50. The national-team matches that day are set for 08:00, 16:00 and 18:00. Vietnam's national holiday falls on Wednesday September 2, which is also the Opening Ceremony, 18:00 to 20:00 — the ceremony sits in the middle of the individual tournament rather than before it, another consequence of two events sharing one schedule.",
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
          question: "Where can I see Pickleball World Cup 2026 results?",
          answer:
            "ThePickleHub publishes every Pro match of the Heineken Pickleball World Cup 2026 on this page, grouped by the Vietnam-time day it finished, updated continuously from the tournament's own live feed rather than typed up once a day.",
        },
        {
          question: "Are these the official final scores?",
          answer:
            "They are the last scores observed in the organizers' live feed before each match left it. The organizers publish no public final score for a completed match, so ThePickleHub labels the column 'as recorded' and names the side that was ahead rather than declaring an official champion.",
        },
        {
          question: "When does Vietnam's national team play at the Pickleball World Cup 2026?",
          answer:
            "Vietnam's Open team enters on Thursday September 3, 2026 as the top seed in Group A alongside Colombia, the Cayman Islands and Chile. The Master 60+, U18 and U14 teams start on Friday September 4.",
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
      title: "Kết quả Pickleball World Cup 2026 Đà Nẵng: từng trận, từng ngày",
      metaTitle: "Kết quả Pickleball World Cup 2026 Đà Nẵng",
      metaDescription:
        "Kết quả Pickleball World Cup 2026 Đà Nẵng: từng trận Pro theo ngày, tỉ số ghi nhận, trận có VĐV Việt Nam, chung kết 6/9.",
      sections: [
        {
          heading: "Kết quả, cập nhật liên tục",
          content:
            "Heineken Pickleball World Cup 2026 diễn ra từ 30/8 đến 6/9/2026 tại Đà Nẵng: 69 nội dung, 156 đội tuyển quốc gia, gần 5.000 vận động viên từ hơn 80 quốc gia và vùng lãnh thổ, thi đấu trên 76 sân tại bảy địa điểm. Trang này của ThePickleHub theo dõi năm nội dung cá nhân Pro — đơn nam, đơn nữ, đôi nam, đôi nữ và đôi nam nữ — từng trận một, nhóm theo ngày kết thúc tính theo giờ Việt Nam. Bảng bên dưới không phải ảnh chụp một thời điểm: nó đọc cùng nguồn dữ liệu trực tiếp mà bảng live của ThePickleHub đang dùng, nên luôn đúng ở thời điểm bạn mở, và kết quả đồng đội quốc gia sẽ vào bảng khi giải đó khởi tranh ngày 3/9.",
          liveBlock: "wc-results",
          internalLinks: [
            {
              text: "Lịch thi đấu đầy đủ cả hai giải, theo từng ngày",
              path: "/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang",
            },
          ],
        },
        {
          heading: "Tỉ số này là gì, và không phải là gì",
          content:
            "Có một điều cần hiểu trước khi đọc bảng. Trang trực tiếp của ban tổ chức chỉ công bố những trận đang chờ hoặc đang diễn ra; trận nào kết thúc là biến mất khỏi dữ liệu, và không trang công khai nào mang tỉ số chung cuộc chính thức của trận đó. ThePickleHub giữ lại lịch sử: khi một trận đang diễn ra biến mất, tỉ số cuối cùng ghi nhận được sẽ được lưu và trận được đánh dấu là đã ghi nhận. Vì vậy cột tỉ số ghi 'tỉ số ghi nhận' chứ không phải 'chung cuộc', và cột cuối nêu bên đang dẫn chứ không tuyên bố nhà vô địch. Với đại đa số trận thì hai điều đó là một. Với trận biến mất giữa chừng thì không — và nói rõ điều đó rẻ hơn nhiều so với đăng sai tên người thắng.",
        },
        {
          heading: "Hai giải trên cùng một lịch",
          content:
            "Giải cá nhân và giải đồng đội quốc gia là hai giải riêng biệt dùng chung địa điểm và chung cái tên, và nhầm hai giải này là lỗi phổ biến nhất khi đưa tin về World Cup lần này. Giải cá nhân — các nhánh Pro trong bảng trên, cộng với các bảng nghiệp dư, trẻ, senior và master — bắt đầu từ Chủ nhật 30/8 và chạy tới 6/9. Giải đồng đội quốc gia, nơi đội tuyển Việt Nam góp mặt, bắt đầu thứ Năm 3/9 và kết thúc Chủ nhật 6/9. Một VĐV Việt Nam vô địch một nhánh Pro không có nghĩa là đội tuyển Việt Nam vô địch, và ngược lại.",
          table: {
            caption: "Hai giải tại Pickleball World Cup 2026",
            headers: ["", "Giải cá nhân", "Giải đồng đội quốc gia"],
            rows: [
              ["Thời gian", "30/8 – 6/9", "3/9 – 6/9"],
              ["Ai dự", "Cá nhân, theo trình DUPR và độ tuổi", "156 đội, 5 hạng mục"],
              ["Việt Nam", "VĐV Việt Nam ở nhiều nhánh", "Hạt giống số 1, bảng A (Open)"],
              ["Thể thức", "Nhánh đấu thông thường", "6 trận ấn định mỗi cặp, 21 điểm, rally"],
            ],
          },
        },
        {
          heading: "Việt Nam thi đấu ngày nào",
          content:
            "Việt Nam là hạt giống số 1 bảng A nội dung Open, cùng bảng Colombia, Quần đảo Cayman và Chile, ra quân thứ Năm 3/9. Ba đội còn lại vào cuộc thứ Sáu 4/9: Master 60+, U18 ở bảng A cùng Malaysia, Costa Rica và Hàn Quốc, U14 ở bảng A cùng Úc và Singapore. Vì một cặp đấu đồng đội gồm sáu trận đơn và đôi đã ấn định trước chứ không phải cuộc so tài giữa hai ngôi sao, chiều sâu đội hình quyết định nhiều hơn một cái tên lớn — và đó là điều đáng theo dõi ở bảng A.",
        },
        {
          heading: "Chung kết",
          content:
            "Giải khép lại Chủ nhật 6/9 tại Nhà thi đấu Tiên Sơn. Các trận chung kết Pro của giải cá nhân diễn ra 08:00–18:00 trên sân số 1, trong đó năm trận chung kết OPEN Pro được xếp từ 10:10 đến 14:50. Các trận đồng đội quốc gia trong ngày bắt đầu lúc 08:00, 16:00 và 18:00. Quốc khánh 2/9 rơi vào thứ Tư, cũng là ngày Lễ khai mạc 18:00–20:00 — lễ khai mạc nằm giữa giải cá nhân chứ không phải trước giải, thêm một hệ quả của việc hai giải dùng chung một lịch.",
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
            "ThePickleHub đăng toàn bộ các trận Pro của Heineken Pickleball World Cup 2026 trên trang này, nhóm theo ngày kết thúc tính theo giờ Việt Nam, cập nhật liên tục từ chính nguồn dữ liệu trực tiếp của giải chứ không nhập tay mỗi ngày một lần.",
        },
        {
          question: "Đây có phải tỉ số chung cuộc chính thức không?",
          answer:
            "Đây là tỉ số cuối cùng ghi nhận được từ dữ liệu trực tiếp của ban tổ chức trước khi trận rời khỏi bảng. Ban tổ chức không công bố công khai tỉ số chung cuộc của trận đã kết thúc, nên ThePickleHub ghi rõ 'tỉ số ghi nhận' và nêu bên đang dẫn thay vì tuyên bố nhà vô địch chính thức.",
        },
        {
          question: "Đội tuyển Việt Nam thi đấu World Cup Pickleball 2026 ngày nào?",
          answer:
            "Đội Open Việt Nam ra quân thứ Năm 3/9/2026, là hạt giống số 1 bảng A cùng Colombia, Quần đảo Cayman và Chile. Các đội Master 60+, U18 và U14 vào cuộc thứ Sáu 4/9.",
        },
        {
          question: "Chung kết Pickleball World Cup 2026 khi nào?",
          answer:
            "Chủ nhật 6/9/2026 tại Nhà thi đấu Tiên Sơn, Đà Nẵng. Năm trận chung kết OPEN Pro diễn ra 10:10–14:50 trên sân số 1; các trận đồng đội quốc gia bắt đầu lúc 08:00, 16:00 và 18:00.",
        },
        {
          question: "Pickleball World Cup 2026 có bao nhiêu nội dung?",
          answer:
            "69 nội dung — 33 nội dung cá nhân quốc tế và 36 nội dung của giải đồng đội quốc gia, với 156 đội tuyển ở 5 hạng mục: Open, Senior, Master, Junior và Kids.",
        },
      ],
    },
  },
};

export default post;
