import type { BlogPost } from "@/content/blog/types";

// First-person account, not a report. Cuong was in the stands at Tien Son for
// the whole week and this is his own writing, published close to verbatim —
// the editing was limited to three factual points that would otherwise have
// contradicted our own results pages one click away:
//   * "QD chưa thua set nào" -> the national-team event. Quang Duong dropped
//     games in the Pro draws (R32 v Mahajan, QF v Arjun Singh, the singles
//     semifinal he retired from, the doubles semifinal, mixed R16), all of
//     which /vi/blog/ket-qua-... now shows game by game.
//   * "65 quốc gia" -> 81 countries and territories, the figure TTXVN and FPT
//     Play carried and the one the other six World Cup posts use. 65 appeared
//     only on the organizers' livestream-package page; their homepage said 66
//     national teams, which counts a different thing.
//   * "gần chục cụm sân" -> seven, per the schedule and the how-to-watch post.
// The opening carries the dateline, the outcome and the ThePickleHub mention
// so the passage survives being extracted on its own (GEO rule, CLAUDE.md).
// Section images are wired once Cuong's own photos land in public/images/blog/.

const post: BlogPost = {
  slug: "pickleball-world-cup-2026-da-nang-from-the-stands",
  publishedDate: "2026-09-07",
  updatedDate: "2026-09-07",
  author: "Cuong Nguyen",
  tags: [
    "pickleball world cup 2026",
    "world cup pickleball da nang",
    "pickleball da nang 2026",
    "nhat ky pickleball world cup",
    "heineken pickleball world cup",
    "cong dong pickleball viet nam",
    "pickleball viet nam",
  ],
  ctaPath: "/vi/blog/ket-qua-pickleball-world-cup-2026-da-nang",
  ctaLabel: {
    en: "See every result from Da Nang 2026",
    vi: "Xem toàn bộ kết quả Đà Nẵng 2026",
  },
  heroImage: {
    src: "/images/blog/wc-2026-from-the-stands-hero.webp",
    alt: "Stands at Tien Son Sports Palace during the Pickleball World Cup 2026 in Da Nang, Vietnam: teams applauding courtside beneath the Heineken boards, a Vietnamese flag in the upper tier, photographers working the near court.",
  },
  content: {
    en: {
      title: "Pickleball World Cup 2026 in Da Nang, From the Stands",
      metaTitle: "Pickleball World Cup 2026 Da Nang: From the Stands",
      metaDescription: "A week at the Pickleball World Cup 2026 in Da Nang from a seat in the stands: the crowd, the city, the organizers, and the friends made from 81 countries.",
      sections: [
        {
          heading: "Da Nang airport, September 6, 2026",
          content: "Notes by Cuong Nguyen, who builds ThePickleHub, written at Da Nang airport on September 6, 2026 — a few hours after the Heineken Pickleball World Cup 2026 (August 30 – September 6, 2026, Da Nang, Vietnam) finished. That day Ly Hoang Nam won the Pro men's singles title, coming back to beat his compatriot Phuc Huynh 6-15, 16-14, 15-10; Vietnam took silver in the Open national-team event after losing the final 4-0 to the United States; and Vietnam finished top of the medal table. This is not the report — the full results live on the results page. This is what the week was like from a seat in the stands.\n\nDa Nang, September 6, 2026. The airport. Waiting for a flight back to Hanoi again.\n\nLast time I sat in this airport I had just left the PPA Tour Asia stop at Tien Son. This time is different. This time I had just left the biggest pickleball gathering on the planet.\n\nHappy to be going home after a week away. Wistful, because I know it will be a long time before these days come back. Or that they never will.",
          internalLinks: [
            {
              text: "Full results: every Pro match and all eight finals",
              path: "/blog/pickleball-world-cup-2026-da-nang-results",
            },
          ],
        },
        {
          heading: "My second time at Tien Son",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-team-vn.webp",
            alt: "Cuong Nguyen at Tien Son with a supporter wearing Vietnam national-team kit during the Pickleball World Cup 2026 in Da Nang.",
            caption: "Tien Son, World Cup week.",
          },
          content: "But not for a PPA event. For the Pickleball World Cup 2026.\n\nEighty-one countries and territories. Thousands of athletes. Seven court clusters. Flags everywhere. Languages everywhere. Laughter everywhere.\n\nSo much curiosity and excitement before arriving. And on leaving, only that ache.\n\nI remember the days spent giving everything from the stands. I remember Si Boi Ngoc pulling back seven straight points in the Final Battle rubber and the whole arena standing up, applauding and not stopping. I remember Phuc Huynh being clutch in every match. I remember Quang Duong carrying the team in the national-team event. I remember Sophia getting better match by match.\n\nI remember all of it.",
          internalLinks: [
            {
              text: "The full week, day by day, with results",
              path: "/blog/pickleball-world-cup-2026-da-nang-schedule",
            },
          ],
        },
        {
          heading: "The people of Da Nang",
          content: "In a taxi. A motorbike cuts us off. The driver rolls down his window: “Đi kiểu chi á mi.” Roughly: what kind of riding is that.\n\nEven the swearing sounds sweet. Gentle. Not sharp. Not aggressive. That is Da Nang. Even the cursing comes out endearing.\n\nI feel this every time I come to Da Nang. People here are mild. Friendly in a natural way, nothing forced about it. And that matters more than any arena — because international visitors remember people, not court clusters.",
          internalLinks: [
            {
              text: "Pickleball courts in Da Nang, where locals and visitors play all year",
              path: "/san/khu-vuc/da-nang",
            },
          ],
        },
        {
          heading: "The organizers — impressively smooth",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-organizer.webp",
            alt: "Courtside at Tien Son Sports Palace with a member of the Pickleball World Cup 2026 organizing team; the United States squad is warming up behind them.",
            caption: "Courtside, with one of the organizers.",
          },
          content: "Eighty-one countries and territories. Thousands of athletes. Seven court clusters across the city. A full week of continuous play, 69 events.\n\nAnd I barely saw a delay. I did not see a single event with a real problem. Everything ran smoothly from the first day to the last.\n\nMaybe I do not know everything that happened behind the scenes. But from a spectator's seat, it all ran clean. At this scale, that is extremely hard.\n\nCongratulations to the organizing committee on a World Cup done properly.",
        },
        {
          heading: "New friends",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-friends.webp",
            alt: "A friend made at the Pickleball World Cup 2026 in Da Nang, in front of the KIVIX banner for Richard Livornese Jr, who went on to win the Pro men's doubles title.",
            caption: "One of the week's new friends.",
          },
          content: "And this was the most beautiful part of the whole trip.\n\nJamaica. Malaysia. Portugal. People from places I would never normally meet. Now sitting next to each other in the stands. Taking photos together. Swapping Instagram handles. Promising to meet again at the next one.\n\nMost of them were in Vietnam for the first time. Competing and travelling at once. Impressed by the organization. Impressed by how friendly Da Nang is. And especially surprised that Vietnam has this many good players.\n\nA guy from Jamaica asked me: “Vietnam has this many good players? How?”\n\nI laughed. I did not know how to answer. I just said: “We love the game.”\n\nThey told me how pickleball is growing where they live. Jamaica has a few dozen players. Portugal is exploding. Malaysia is at roughly the same stage as Vietnam.\n\nEvery person a different story. Every country a different journey. All of them in Da Nang for the same love.",
        },
        {
          heading: "The die-hards",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-night.webp",
            alt: "An evening in Da Nang during the Pickleball World Cup 2026, national flags strung across the ceiling of the bar.",
            caption: "After the matches.",
          },
          content: "I also owe thanks to the friends who drove me around. Who piled into the stands with me for days on end. Screamed ourselves hoarse. Clapped our hands red.\n\nOld friends, talking rubbish all night. New friends, met courtside. Morning coffee arguing tactics. Evening beer retelling the matches.\n\nPickleball brings us together. A World Cup keeps us together longer.",
        },
        {
          heading: "They are calling boarding",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-jersey.webp",
            alt: "A Heineken Pickleball World Cup 2026 organizer jersey held up in the stands at Tien Son Sports Palace on the final day.",
            caption: "Last day at Tien Son.",
          },
          content: "Hanoi is waiting.\n\nBut part of me is still at Tien Son. In those stands. In that roar of “Việt Nam”. In that Jamaican friend's smile. In that Da Nang driver's sweet little curse.\n\nPickleball World Cup 2026. Da Nang. The first time in Asia. The first time in Vietnam.\n\nAnd I was there.\n\nThank you Da Nang. Thank you to the organizers. Thank you to the friends, old and new. Thank you to the Vietnam national team.\n\nThank you, pickleball.\n\nSee you again.",
        },
      ],
    },
    vi: {
      title: "Nhật ký Pickleball World Cup 2026 Đà Nẵng: tôi đã ở đó",
      metaTitle: "Nhật ký Pickleball World Cup 2026 Đà Nẵng",
      metaDescription: "Một tuần ở Pickleball World Cup 2026 Đà Nẵng nhìn từ khán đài: đám đông, thành phố, ban tổ chức và những người bạn mới.",
      sections: [
        {
          heading: "Sân bay Đà Nẵng, 6/9/2026",
          content: "Ghi chép của Cường Nguyễn, người dựng ThePickleHub, viết tại sân bay Đà Nẵng ngày 6/9/2026 — vài giờ sau khi Heineken Pickleball World Cup 2026 (30/8 – 6/9/2026, Đà Nẵng) khép lại. Hôm đó Lý Hoàng Nam vô địch đơn nam Pro sau khi thắng ngược đồng hương Phúc Huỳnh 6-15, 16-14, 15-10; đội tuyển Việt Nam giành huy chương bạc nội dung Đồng đội Open sau khi thua Mỹ 0-4; và Việt Nam dẫn đầu bảng tổng sắp huy chương toàn đoàn. Đây không phải bài tường thuật — kết quả đầy đủ nằm ở trang kết quả. Đây là chuyện của một người ngồi trên khán đài suốt tuần đó.\n\nĐà Nẵng, 6/9/2026. Sân bay. Lại chờ máy bay về Hà Nội.\n\nLần trước ngồi ở sân bay này, tôi vừa rời PPA Tour Asia tại Tiên Sơn. Lần này khác. Lần này tôi vừa rời ngày hội pickleball lớn nhất hành tinh.\n\nVui vì sắp về nhà sau cả tuần đi xa. Bồi hồi vì biết rằng những ngày vừa qua sẽ rất lâu mới lặp lại. Hoặc không bao giờ nữa.",
          internalLinks: [
            {
              text: "Kết quả đầy đủ: mọi trận Pro và toàn bộ chung kết",
              path: "/vi/blog/ket-qua-pickleball-world-cup-2026-da-nang",
            },
          ],
        },
        {
          heading: "Tôi trở lại Tiên Sơn lần thứ hai",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-team-vn.webp",
            alt: "Cường Nguyễn tại Tiên Sơn cùng một người mặc áo đội tuyển Việt Nam trong tuần Pickleball World Cup 2026 ở Đà Nẵng.",
            caption: "Tiên Sơn, tuần World Cup.",
          },
          content: "Nhưng không phải giải PPA. Mà là Pickleball World Cup 2026.\n\n81 quốc gia và vùng lãnh thổ. Hàng nghìn vận động viên. Bảy cụm sân. Cờ khắp nơi. Ngôn ngữ khắp nơi. Tiếng cười khắp nơi.\n\nBiết bao tò mò và háo hức trước khi đến. Và khi rời đi thì chỉ còn lại bồi hồi.\n\nNhớ những ngày hết mình trên khán đài. Nhớ khoảnh khắc Sĩ Bội Ngọc gỡ liền 7 điểm ở ván phụ Final Battle mà cả nhà thi đấu đứng dậy vỗ tay không ngớt. Nhớ Phúc Huỳnh clutch ở mọi trận. Nhớ Quang Dương gánh đội ở nội dung Đồng đội. Nhớ Sophia tiến bộ từng trận một.\n\nNhớ hết.",
          internalLinks: [
            {
              text: "Lịch thi đấu cả tuần, từng ngày, kèm kết quả",
              path: "/vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang",
            },
          ],
        },
        {
          heading: "Con người Đà Nẵng",
          content: "Ngồi taxi. Một xe máy tạt đầu. Bạn tài xế mở cửa sổ: “Đi kiểu chi á mi.”\n\nChửi mà nghe cũng dễ thương. Nhẹ nhàng. Không gắt. Không hung hăng. Đà Nẵng kiểu vậy. Chửi cũng thành dễ thương.\n\nMỗi lần vào Đà Nẵng tôi đều thấy vậy. Con người ở đây hiền. Thân thiện một cách tự nhiên, không gượng ép. Và điều đó quan trọng hơn bất kỳ nhà thi đấu nào — vì khách quốc tế nhớ con người, không nhớ cụm sân.",
          internalLinks: [
            {
              text: "Sân pickleball tại Đà Nẵng — nơi khách và dân địa phương chơi quanh năm",
              path: "/vi/san/khu-vuc/da-nang",
            },
          ],
        },
        {
          heading: "Ban tổ chức — trơn tru đáng nể",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-organizer.webp",
            alt: "Bên sân Cung Thể thao Tiên Sơn cùng một thành viên ban tổ chức Pickleball World Cup 2026; phía sau là đội tuyển Mỹ đang khởi động.",
            caption: "Bên sân, cùng một thành viên ban tổ chức.",
          },
          content: "81 quốc gia và vùng lãnh thổ. Hàng nghìn vận động viên. Bảy cụm sân trải khắp thành phố. Thi đấu liên tục cả tuần, 69 nội dung.\n\nVà tôi gần như không thấy trễ. Không thấy nội dung nào có vấn đề lớn. Mọi thứ diễn ra trơn tru từ ngày đầu đến ngày cuối.\n\nCó thể tôi không biết hết những gì xảy ra phía sau. Nhưng ở góc nhìn người xem — mọi thứ chạy mượt. Và với quy mô như này, đó là điều cực kỳ khó.\n\nChúc mừng ban tổ chức đã làm được một kỳ World Cup đàng hoàng.",
        },
        {
          heading: "Những người bạn mới",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-friends.webp",
            alt: "Một người bạn mới quen tại Pickleball World Cup 2026 Đà Nẵng, trước tấm banner KIVIX của Richard Livornese Jr — người sau đó vô địch đôi nam Pro.",
            caption: "Một trong những người bạn mới của tuần đó.",
          },
          content: "Và đây là thứ đẹp nhất của cả chuyến đi.\n\nJamaica. Malaysia. Bồ Đào Nha. Những con người từ những nơi mà bình thường tôi không bao giờ gặp. Giờ ngồi cạnh nhau trên khán đài. Chụp ảnh cùng nhau. Trao đổi Instagram. Hẹn gặp lại ở giải sau.\n\nHọ đa số sang Việt Nam lần đầu. Kết hợp thi đấu và du lịch. Ấn tượng với cách tổ chức. Ấn tượng với sự thân thiện của Đà Nẵng. Và đặc biệt bất ngờ khi Việt Nam có nhiều người chơi hay đến vậy.\n\nMột anh bạn Jamaica hỏi tôi: “Vietnam has this many good players? How?”\n\nTôi cười. Không biết trả lời sao. Chỉ nói: “We love the game.”\n\nHọ cũng kể pickleball ở đất nước họ phát triển thế nào. Jamaica mới có vài chục người chơi. Bồ Đào Nha đang bùng nổ. Malaysia thì tương đương Việt Nam.\n\nMỗi người một câu chuyện. Mỗi nước một hành trình. Nhưng cùng đến Đà Nẵng vì cùng một tình yêu.",
        },
        {
          heading: "Những “fan cứng”",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-night.webp",
            alt: "Một buổi tối ở Đà Nẵng trong tuần Pickleball World Cup 2026, cờ các nước treo kín trần quán.",
            caption: "Sau trận đấu.",
          },
          content: "Cũng phải cảm ơn những anh em đã đưa đón. Cùng nhau “vầy” trên khán đài mấy ngày liền. Hét khàn cổ. Vỗ tay đỏ tay.\n\nGặp bạn cũ chém gió cả đêm. Gặp bạn mới ngay trên sân. Cà phê sáng bàn chiến thuật. Bia tối kể chuyện trận đấu.\n\nPickleball đưa chúng ta đến với nhau. World Cup giữ chúng ta ở lại lâu hơn.",
        },
        {
          heading: "Máy bay sắp gọi boarding",
          image: {
            src: "/images/blog/wc-2026-from-the-stands-jersey.webp",
            alt: "Chiếc áo ban tổ chức Heineken Pickleball World Cup 2026 được giơ lên trên khán đài Cung Thể thao Tiên Sơn ngày thi đấu cuối.",
            caption: "Ngày cuối ở Tiên Sơn.",
          },
          content: "Hà Nội đang chờ.\n\nNhưng một phần của tôi vẫn ở Tiên Sơn. Ở khán đài đó. Ở tiếng hét “Việt Nam” vang dội đó. Ở nụ cười anh bạn Jamaica đó. Ở câu chửi dễ thương của anh tài xế Đà Nẵng đó.\n\nPickleball World Cup 2026. Đà Nẵng. Lần đầu tiên tại châu Á. Lần đầu tiên tại Việt Nam.\n\nVà tôi đã ở đó.\n\nCảm ơn Đà Nẵng. Cảm ơn ban tổ chức. Cảm ơn những người bạn cũ và mới. Cảm ơn đội tuyển Việt Nam.\n\nCảm ơn pickleball.\n\nHẹn gặp lại.",
        },
      ],
    },
  },
};

export default post;
