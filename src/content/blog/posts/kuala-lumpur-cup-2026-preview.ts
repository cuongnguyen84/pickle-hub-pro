import type { BlogPost } from "@/content/blog/types";

// Leapmotor Kuala Lumpur Cup 2026 — PPA Tour Asia's 1000-point stop, Sep 9-13.
// Written T-1 on 2026-09-08. Every fact here is from the organizers' own event
// page (ppatour-asia.com/tournament/2026/kuala-lumpur-cup/, modified
// 2026-09-07), except Gabe Tardio's world ranking, which is attributed to the
// New Straits Times in the text.
//
// What the page does NOT publish is stated as such in the post rather than
// filled in: ticket prices, whether the YouTube stream is free, the broadcaster
// list (renders empty), the venue street address, and which event plays on
// which day. The Shenzhen post learned that lesson the expensive way.
//
// Two name traps handled deliberately in both languages:
//   - "A. Truong" (WD #3, XD #2) is US-flagged, NOT Vietnamese. The Vietnamese
//     entry that looks like it is "S. Tran" (Sophia Phuong Anh Tran).
//   - "Q. Do" is US-flagged too, despite the name.
// Getting either wrong would put a false Vietnamese medal claim on the page.

const post: BlogPost = {
  slug: "kuala-lumpur-cup-2026-preview",
  publishedDate: "2026-09-08",
  updatedDate: "2026-09-09",
  author: "The PickleHub Team",
  tags: [
    "kuala lumpur cup 2026",
    "leapmotor kuala lumpur cup",
    "ppa tour asia",
    "ppa asia 1000",
    "pickleball malaysia",
    "lich thi dau ppa tour asia",
    "ho tam pickleball",
  ],
  ctaPath: "/live",
  ctaLabel: {
    en: "Follow live scores on ThePickleHub",
    vi: "Theo dõi tỷ số trực tiếp trên ThePickleHub",
  },
  heroImage: {
    src: "/images/blog/kuala-lumpur-cup-2026-preview-hero.webp",
    alt:
      "Leapmotor Kuala Lumpur Cup 2026 banner — a rooftop pickleball court at blue hour with a paddle and a yellow ball on the teal-blue surface, the floodlit Kuala Lumpur skyline and Petronas Twin Towers behind, and the tournament lockup reading \"PPA Asia 1000 · Leapmotor Kuala Lumpur Cup 2026 · September 9-13 · The Hood, Kuala Lumpur, Malaysia\".",
  },
  content: {
    en: {
      title: "Leapmotor Kuala Lumpur Cup 2026: Schedule, Seeds, Prize Money and How to Watch",
      metaTitle: "Leapmotor KL Cup 2026: Schedule, Seeds, Prize Money",
      metaDescription: "Leapmotor Kuala Lumpur Cup 2026, Sep 9-13 at The Hood, KL: US$300,000, 1000 points, day-by-day schedule, every seed and where to watch.",
      sections: [
        {
          heading: "Leapmotor Kuala Lumpur Cup 2026 at a glance",
          content: "Last updated September 9, 2026, day one — the Leapmotor Kuala Lumpur Cup 2026 is under way and runs September 9-13, 2026 at The Hood in Kuala Lumpur, Malaysia, with up to US$300,000 in prize money and 1000 ranking points to each gold medalist. It is the season's second PPA Asia 1000 stop, level with the MB Hanoi Cup played April 1-5, and it lands the week after the Pickleball World Cup in Da Nang finished. Today, Wednesday September 9, is qualifying day, 09:00-21:00 GMT+8 (08:00-20:00 Vietnam time); the finals are Sunday September 13, 13:00-18:00 GMT+8 (12:00-17:00 Vietnam time). Gabe Tardio, the world No. 2 as reported by the New Straits Times, tops the Men's Doubles seeds with Noe Khlif; Kaitlyn Christian tops the Women's Singles seeds; and Vietnam's Ho Tam is seeded 8th in Women's Singles, seventeen days after winning Vietnam's first PPA Tour Asia Women's Doubles gold on August 23. This ThePickleHub guide has the day-by-day schedule in both Malaysian and Vietnamese time, the full prize and points table, every seed, the five Vietnamese players in the main draw, and an honest account of what the organizers have and have not published.",
          internalLinks: [
            {
              text: "See the full PPA Tour Asia 2026 calendar and prize money",
              path: "/blog/ppa-tour-asia-2026-complete-guide",
            },
            {
              text: "Live scores and streams on ThePickleHub",
              path: "/live",
            },
          ],
        },
        {
          heading: "Day-by-day schedule",
          content: "PPA Tour Asia publishes the tournament by round, not by event: the schedule below is exactly what the organizers list, and they have not said which of the five pro events plays on which court or in which order. Malaysia is GMT+8, one hour ahead of Vietnam, so every Vietnamese time below is the Malaysian time minus one hour.",
          table: {
            caption: "Leapmotor Kuala Lumpur Cup 2026 schedule, The Hood, Kuala Lumpur",
            headers: [
              "Day",
              "Rounds",
              "Local time (GMT+8)",
              "Vietnam time (GMT+7)",
            ],
            rows: [
              [
                "Wed, Sep 9",
                "Qualifying",
                "09:00-21:00",
                "08:00-20:00",
              ],
              [
                "Thu, Sep 10",
                "R64 / R32 / R16",
                "09:00-22:00",
                "08:00-21:00",
              ],
              [
                "Fri, Sep 11",
                "R16 and quarterfinals",
                "09:00-19:00",
                "08:00-18:00",
              ],
              [
                "Sat, Sep 12",
                "Semifinals",
                "09:00-19:00",
                "08:00-18:00",
              ],
              [
                "Sun, Sep 13",
                "Finals",
                "13:00-18:00",
                "12:00-17:00",
              ],
            ],
          },
        },
        {
          heading: "Prize money and ranking points",
          content: "The event is worth up to US$300,000 and 1000 ranking points to each gold medalist. The table below is the organizers' own, and it carries an important condition they state directly: these figures are for PPA pros on a Gold Contract. Players signed under other categories are paid on a separate scale, published as a separate document, and non-contracted players are on a different sheet again — so a player winning gold here does not necessarily earn the number in the top row.",
          table: {
            caption: "Prize money in US dollars, per player, by finish",
            headers: [
              "Finish",
              "Singles",
              "Gender doubles",
              "Mixed doubles",
              "Points",
            ],
            rows: [
              [
                "Gold",
                "9,000",
                "38,000",
                "30,000",
                "1000",
              ],
              [
                "Silver",
                "5,000",
                "20,000",
                "17,000",
                "800",
              ],
              [
                "Semifinal",
                "2,500",
                "10,000",
                "8,000",
                "500",
              ],
              [
                "Quarterfinal",
                "1,500",
                "5,000",
                "4,000",
                "200",
              ],
            ],
          },
        },
        {
          heading: "Vietnam in the main draw: five players, and one notable absence",
          content: "Five Vietnamese-flagged players are in the main draw, and the headline is Ho Tam — Ho Thi Truc Tam, entered as \"HO Tam\" — seeded 8th in Women's Singles. On August 23 in Shenzhen she and Sophia Nhi Huynh won the first Women's Doubles gold taken by a Vietnamese pair on PPA Tour Asia. In Kuala Lumpur that pair is split: Ho Tam plays Women's Doubles with Chinese Taipei's A. Huang, while Sophia Nhi Huynh partners Sophia Phuong Anh Tran, a different player often confused with her. The absence is just as worth naming: Hien Truong (Truong Vinh Hien), who took two silvers in Shenzhen and is Vietnam's most visible man on this tour, does not appear anywhere in the Kuala Lumpur entry lists — not in the main draw, not in qualifying, not in any event. The organizers have not said why.",
          listItems: [
            "Women's Singles main draw: Ho Tam (seeded 8), Sophia Phuong Anh Tran, Sophia Nhi Huynh",
            "Men's Singles main draw: Ngo Dang, Hoang Nguyen Anh",
            "Women's Doubles main draw: A. Huang (TPE) / Ho Tam, and Sophia Phuong Anh Tran / Sophia Nhi Huynh",
            "Mixed Doubles main draw: Sophia Nhi Huynh with A. Koller (USA), and Ho Tam with Q. Do (USA)",
            "Men's Doubles main draw: no Vietnamese pair — three are in qualifying (H. Anh / T. Nguyen, N. Dang / R. Kurosawa, A. Pham / L. Duc)",
            "Singles qualifying: Anh Pham, Tien Nguyen, Pham Nghi, Thuan Ngo",
          ],
          internalLinks: [
            {
              text: "How Huynh and Ken Tam won Vietnam's first Women's Doubles gold",
              path: "/blog/sophia-huynh-ken-tam-womens-doubles-gold-2026",
            },
          ],
        },
        {
          heading: "One name Vietnamese readers will misread",
          content: "\"A. Truong\" appears twice high in the draw — seeded 3rd in Women's Doubles with J. Irvine and 2nd in Mixed Doubles with Tama Shimabukuro — and she is not Vietnamese. PPA Tour Asia lists her under the flag of the United States in both events. The Vietnamese entry that looks similar is \"S. Tran\", Sophia Phuong Anh Tran, who is a separate player in a separate part of the draw. Anyone scanning the seed list for a Vietnamese name will land on the wrong one.",
        },
        {
          heading: "The seeds",
          content: "PPA Tour Asia numbers up to eight seeds per event and lists the rest of the field unnumbered. Women's Doubles is the exception: the organizers published only four seeds there. Seeds as published:",
          listItems: [
            "Men's Singles: 1 Zane Ford (USA), 2 Hong Kit Wong (HKG), 3 Tama Shimabukuro (USA), 4 Noe Khlif (FRA), 5 Luc Pham (USA), 6 Kenta Miyoshi (JPN), 7 Matthew Finnerty (GBR), 8 Harrison Brown (AUS)",
            "Women's Singles: 1 Kaitlyn Christian (USA), 2 Brooke Buckner (USA), 3 Chao Yi Wang (TPE), 4 Sahra Dennehy (AUS), 5 Judit Castillo (ESP), 6 Yufei Long (CHN), 7 Rika Fujiwara (JPN), 8 Ho Tam (VIE)",
            "Men's Doubles: 1 Tardio / Khlif, 2 Ge / Yang, 3 Shimabukuro / Funemizu, 4 Wong / Kim, 5 Bhatia / Powell, 6 Protzek / Miyoshi, 7 Koller / Do, 8 Pham / Wall",
            "Women's Doubles: 1 Schneemann / Buckner, 2 Wei / Wang, 3 Truong / Irvine, 4 Jones / Christian",
            "Mixed Doubles: 1 Irvine / Tardio, 2 Truong / Shimabukuro, 3 Christian / Kim, 4 Buckner / Khlif, 5 Wang / Bhatia, 6 Townsend / Wild, 7 Dennehy / Yang, 8 Wei / Ge",
          ],
        },
        {
          heading: "How to watch, and what has not been published",
          content: "PPA Tour Asia says matches stream on its own YouTube channel across all five days, and points viewers to \"your local broadcaster\" through a regional list. Three caveats are worth stating plainly, because the organizers have not: the page does not say whether the YouTube stream is free or gated, the broadcaster list renders empty, and Media Prima Omnia is credited as Official Media Partner without any statement that it will carry the event. Tickets are a separate trap. The tournament page carries only a bare Tixr button, but PPA Tour Asia published a full ticket breakdown as a news post on August 7 that is easy to miss from the tournament page itself. Four passes are on sale: a DINKER GA Season Pass covering all five days; single-day general admission split into BANGER (left stand, directly behind the players) and DINKER (right stand); a VIP Pass with reserved seating, lounge access, complimentary food and drink and player meet-and-greets; and a Premium Courtside Pass in the front row of Championship Court, which carries everything the VIP Pass does — lounge, complimentary food and drink, meet-and-greets — and adds priority entry plus an official merch pack the organizers value at over RM200. Every pass includes Pickletown, the food-and-games area running all five days, and every pass allows re-entry on a credential scan. What is genuinely missing is the price: no ticket figure appears on either PPA page, so the only way to see what a seat costs is to open Tixr. There is also still no street address for The Hood, only a map link. If any of that changes during the week, this page will be updated.",
          listItems: [
            "Stream: PPA Tour Asia's YouTube channel (youtube.com/@ppatourasia), September 9-13. The organizers do not say whether it is free or gated",
            "Broadcast: a regional broadcaster list exists on the tournament page but is currently empty",
            "Tickets: on sale via Tixr. Four passes \u2014 GA season, single-day Banger or Dinker, VIP, Premium Courtside. Prices appear on Tixr only, not on PPA's own pages",
            "Venue: The Hood, Kuala Lumpur. Map link only, no address given",
          ],
          internalLinks: [
            {
              text: "How to watch PPA Tour events live in 2026",
              path: "/blog/how-to-watch-ppa-tour-live-2026",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "When is the Leapmotor Kuala Lumpur Cup 2026?",
          answer: "September 9-13, 2026, at The Hood in Kuala Lumpur, Malaysia. Qualifying is Wednesday September 9; the finals are Sunday September 13, 13:00-18:00 GMT+8, which is 12:00-17:00 Vietnam time.",
        },
        {
          question: "How much prize money is at the Leapmotor Kuala Lumpur Cup 2026?",
          answer: "Up to US$300,000, with 1000 ranking points to each gold medalist. A gold medalist on a PPA Gold Contract earns US$9,000 in singles, US$38,000 in gender doubles and US$30,000 in mixed doubles. Players on other contract categories are paid on a separate scale.",
        },
        {
          question: "Which Vietnamese players are at the Kuala Lumpur Cup 2026?",
          answer: "Five are in the main draw: Ho Tam, seeded 8th in Women's Singles, plus Sophia Nhi Huynh, Sophia Phuong Anh Tran, Ngo Dang and Hoang Nguyen Anh. Several more are in qualifying. Hien Truong (Truong Vinh Hien) is not entered in any event.",
        },
        {
          question: "Where can I watch the Leapmotor Kuala Lumpur Cup 2026?",
          answer: "PPA Tour Asia streams the event on its own YouTube channel across all five days, September 9-13. The tournament page also links a regional broadcaster list, but that list is currently empty, and the organizers have not said whether the stream is free or gated.",
        },
        {
          question: "What tier is the Kuala Lumpur Cup on PPA Tour Asia?",
          answer: "It is the tour's 1000-point tier, above the 500-point stops such as the Skechers Shenzhen Open. It is the second 1000-point stop of the 2026 Asian season — the MB Hanoi Cup in April was the first, at the same prize ceiling. Only the Hong Kong Slam in October carries more prize money.",
        },
      ],
    },
    vi: {
      title: "Leapmotor Kuala Lumpur Cup 2026: lịch thi đấu, hạt giống, tiền thưởng và cách xem",
      metaTitle: "KL Cup 2026 (9–13/9): lịch thi đấu, cách xem",
      metaDescription: "Leapmotor Kuala Lumpur Cup 2026 (9–13/9): lịch thi đấu theo giờ Việt Nam, 300.000 USD, Hồ Tâm hạt giống số 8, và cách xem trực tiếp.",
      sections: [
        {
          heading: "Leapmotor Kuala Lumpur Cup 2026 — những điều cần biết",
          content: "Cập nhật ngày 9/9/2026, ngày thi đấu đầu tiên — Leapmotor Kuala Lumpur Cup 2026 đã khởi tranh, diễn ra từ 9 đến 13/9/2026 tại The Hood, Kuala Lumpur (Malaysia), tổng thưởng tối đa 300.000 USD và 1000 điểm xếp hạng cho mỗi nhà vô địch. Đây là chặng thang 1000 điểm thứ hai của PPA Tour Asia mùa 2026, ngang hạng với MB Hanoi Cup hồi 1–5/4, và diễn ra ngay tuần sau khi Pickleball World Cup ở Đà Nẵng khép lại. Hôm nay thứ Tư 9/9 là ngày vòng loại, 09:00–21:00 giờ Malaysia (08:00–20:00 giờ Việt Nam); chung kết vào Chủ nhật 13/9 lúc 12:00–17:00 giờ Việt Nam. Đáng chú ý với người hâm mộ Việt: Hồ Tâm là hạt giống số 8 đơn nữ, 17 ngày sau khi cùng Sophia Nhi Huynh giành HCV đôi nữ đầu tiên của Việt Nam trên PPA Tour Asia ngày 23/8. Bài viết này do ThePickleHub tổng hợp, gồm lịch thi đấu quy đổi sang giờ Việt Nam, bảng tiền thưởng đầy đủ, toàn bộ hạt giống, năm tay vợt Việt trong main draw, và cả những thông tin ban tổ chức CHƯA công bố.",
          internalLinks: [
            {
              text: "Xem lịch và tiền thưởng toàn mùa PPA Tour Asia 2026",
              path: "/vi/blog/ppa-tour-asia-2026-lich-thi-dau-tien-thuong",
            },
            {
              text: "Tỷ số trực tiếp và livestream trên ThePickleHub",
              path: "/vi/live",
            },
          ],
        },
        {
          heading: "Lịch thi đấu theo giờ Việt Nam",
          content: "Ban tổ chức công bố lịch theo VÒNG ĐẤU, không theo nội dung — tức là họ không nói nội dung nào (đơn nam, đơn nữ, đôi nam, đôi nữ, đôi nam nữ) đánh sân nào hay theo thứ tự nào trong ngày. Malaysia ở múi GMT+8, sớm hơn Việt Nam 1 tiếng, nên mọi giờ Việt Nam dưới đây bằng giờ Malaysia trừ đi 1.",
          table: {
            caption: "Lịch Leapmotor Kuala Lumpur Cup 2026 tại The Hood, Kuala Lumpur",
            headers: [
              "Ngày",
              "Vòng đấu",
              "Giờ Malaysia (GMT+8)",
              "Giờ Việt Nam (GMT+7)",
            ],
            rows: [
              [
                "Thứ Tư 9/9",
                "Vòng loại",
                "09:00–21:00",
                "08:00–20:00",
              ],
              [
                "Thứ Năm 10/9",
                "Vòng 1/32 · 1/16 · 1/8",
                "09:00–22:00",
                "08:00–21:00",
              ],
              [
                "Thứ Sáu 11/9",
                "Vòng 1/8 và tứ kết",
                "09:00–19:00",
                "08:00–18:00",
              ],
              [
                "Thứ Bảy 12/9",
                "Bán kết",
                "09:00–19:00",
                "08:00–18:00",
              ],
              [
                "Chủ nhật 13/9",
                "Chung kết",
                "13:00–18:00",
                "12:00–17:00",
              ],
            ],
          },
        },
        {
          heading: "Tiền thưởng và điểm xếp hạng",
          content: "Giải có tổng thưởng tối đa 300.000 USD và 1000 điểm cho mỗi HCV. Bảng dưới đây là bảng của chính ban tổ chức, kèm một điều kiện họ ghi rõ và cần nhắc lại: các con số này áp dụng cho VĐV chuyên nghiệp có hợp đồng PPA hạng Gold. VĐV ký hợp đồng hạng khác được trả theo thang riêng, công bố ở tài liệu riêng, còn VĐV không có hợp đồng lại theo một bảng khác nữa. Nên một người vô địch ở đây không đương nhiên nhận đúng con số ở dòng đầu.",
          table: {
            caption: "Tiền thưởng (USD, mỗi VĐV) theo thành tích",
            headers: [
              "Thành tích",
              "Đơn",
              "Đôi cùng giới",
              "Đôi nam nữ",
              "Điểm",
            ],
            rows: [
              [
                "HCV",
                "9.000",
                "38.000",
                "30.000",
                "1000",
              ],
              [
                "HCB",
                "5.000",
                "20.000",
                "17.000",
                "800",
              ],
              [
                "Bán kết",
                "2.500",
                "10.000",
                "8.000",
                "500",
              ],
              [
                "Tứ kết",
                "1.500",
                "5.000",
                "4.000",
                "200",
              ],
            ],
          },
        },
        {
          heading: "Năm tay vợt Việt ở main draw — và một cái tên vắng mặt",
          content: "Năm tay vợt mang cờ Việt Nam có tên ở main draw, nổi bật nhất là Hồ Tâm — Hồ Thị Trúc Tâm, đăng ký dưới tên \"HO Tam\" — hạt giống số 8 đơn nữ. Ngày 23/8 tại Thâm Quyến, cô cùng Sophia Nhi Huynh giành HCV đôi nữ đầu tiên cho một cặp Việt Nam trên PPA Tour Asia. Ở Kuala Lumpur, cặp đó TÁCH RA: Hồ Tâm đánh đôi nữ với A. Huang (Đài Bắc Trung Hoa), còn Sophia Nhi Huynh ghép với Sophia Phương Anh Trần — một tay vợt khác, rất hay bị nhầm là cùng một người. Sự vắng mặt cũng đáng nói không kém: Trương Vinh Hiển, người giành 2 HCB ở Thâm Quyến và là gương mặt nam Việt Nam nổi bật nhất trên tour này, KHÔNG có tên ở bất kỳ nội dung nào tại Kuala Lumpur — không main draw, không vòng loại. Ban tổ chức không giải thích lý do.",
          listItems: [
            "Đơn nữ (main draw): Hồ Tâm (hạt giống 8), Sophia Phương Anh Trần, Sophia Nhi Huynh",
            "Đơn nam (main draw): Ngô Đăng, Hoàng Nguyễn Anh",
            "Đôi nữ (main draw): A. Huang (TPE) / Hồ Tâm, và Sophia Phương Anh Trần / Sophia Nhi Huynh",
            "Đôi nam nữ (main draw): Sophia Nhi Huynh với A. Koller (Mỹ), và Hồ Tâm với Q. Do (Mỹ)",
            "Đôi nam (main draw): không có cặp Việt Nam nào — ba cặp đang ở vòng loại (H. Anh / T. Nguyễn, N. Dang / R. Kurosawa, A. Phạm / L. Đức)",
            "Vòng loại đơn: Anh Phạm, Tiến Nguyễn, Phạm Nghị, Thuận Ngô",
          ],
          internalLinks: [
            {
              text: "Hồ Tâm và Sophia Nhi Huynh giành HCV đôi nữ đầu tiên cho Việt Nam",
              path: "/vi/blog/sophia-huynh-tran-ken-tam-vo-dich-doi-nu-tham-quyen",
            },
            {
              text: "Toàn bộ kết quả chặng Thâm Quyến 2026",
              path: "/vi/blog/shenzhen-open-2026-lich-thi-dau-cach-xem",
            },
          ],
        },
        {
          heading: "Một cái tên rất dễ đọc nhầm",
          content: "\"A. Truong\" xuất hiện hai lần ở nhóm hạt giống cao — hạt giống 3 đôi nữ (cùng J. Irvine) và hạt giống 2 đôi nam nữ (cùng Tama Shimabukuro) — và cô KHÔNG phải người Việt. PPA Tour Asia để cờ Mỹ cho cô ở cả hai nội dung. Cái tên Việt trông na ná là \"S. Tran\", tức Sophia Phương Anh Trần, một tay vợt khác ở nhánh khác. Ai lướt bảng hạt giống tìm tên Việt sẽ dừng nhầm ở đúng dòng này.",
        },
        {
          heading: "Bảng hạt giống",
          content: "PPA Tour Asia đánh số tối đa 8 hạt giống mỗi nội dung, phần còn lại của nhánh không đánh số. Riêng đôi nữ là ngoại lệ: ban tổ chức chỉ công bố 4 hạt giống. Danh sách theo công bố:",
          listItems: [
            "Đơn nam: 1 Zane Ford (Mỹ), 2 Hong Kit Wong (Hồng Kông), 3 Tama Shimabukuro (Mỹ), 4 Noe Khlif (Pháp), 5 Luc Pham (Mỹ), 6 Kenta Miyoshi (Nhật), 7 Matthew Finnerty (Anh), 8 Harrison Brown (Úc)",
            "Đơn nữ: 1 Kaitlyn Christian (Mỹ), 2 Brooke Buckner (Mỹ), 3 Chao Yi Wang (Đài Bắc TH), 4 Sahra Dennehy (Úc), 5 Judit Castillo (Tây Ban Nha), 6 Yufei Long (Trung Quốc), 7 Rika Fujiwara (Nhật), 8 Hồ Tâm (Việt Nam)",
            "Đôi nam: 1 Tardio / Khlif, 2 Ge / Yang, 3 Shimabukuro / Funemizu, 4 Wong / Kim, 5 Bhatia / Powell, 6 Protzek / Miyoshi, 7 Koller / Do, 8 Pham / Wall",
            "Đôi nữ: 1 Schneemann / Buckner, 2 Wei / Wang, 3 Truong / Irvine, 4 Jones / Christian",
            "Đôi nam nữ: 1 Irvine / Tardio, 2 Truong / Shimabukuro, 3 Christian / Kim, 4 Buckner / Khlif, 5 Wang / Bhatia, 6 Townsend / Wild, 7 Dennehy / Yang, 8 Wei / Ge",
          ],
        },
        {
          heading: "Xem ở đâu — và những gì ban tổ chức chưa nói",
          content: "PPA Tour Asia nói các trận được phát trên kênh YouTube của chính họ suốt 5 ngày, và có mục \"đài phát sóng tại khu vực của bạn\". Có ba điểm cần nói thẳng vì ban tổ chức không nói: trang giải KHÔNG ghi stream YouTube miễn phí hay phải trả tiền, danh sách đài phát sóng hiện đang TRỐNG, và Media Prima Omnia được ghi là Đối tác truyền thông chính thức nhưng không có câu nào khẳng định đài này sẽ phát giải. Riêng chuyện vé thì dễ hiểu nhầm: trang giải chỉ có đúng một nút Tixr trơ trọi, nhưng PPA Tour Asia đã đăng một bài riêng ngày 7/8 mô tả đầy đủ các hạng vé — từ trang giải rất dễ bỏ sót. Vé ĐANG BÁN với bốn hạng: DINKER GA Season Pass trọn 5 ngày; vé ngày hạng phổ thông chia làm BANGER (khán đài trái, ngay sau lưng VĐV) và DINKER (khán đài phải); VIP Pass có chỗ ngồi riêng, phòng chờ VIP, đồ ăn uống miễn phí và cơ hội gặp VĐV; và Premium Courtside Pass ngồi hàng đầu sân Championship — có đủ mọi quyền lợi của VIP Pass (phòng chờ, đồ ăn uống miễn phí, gặp VĐV), cộng thêm lối vào ưu tiên và một túi merch chính hãng ban tổ chức định giá trên 200 RM. Mọi hạng vé đều vào được khu hội chợ Pickletown mở suốt 5 ngày, và đều được ra vào lại khi quét thẻ. Thứ thật sự còn thiếu là GIÁ: không trang PPA nào ghi giá vé, muốn biết bao nhiêu tiền thì phải mở Tixr. Và vẫn không có địa chỉ đường phố của The Hood, chỉ có link bản đồ. Nếu trong tuần có thay đổi, bài này sẽ được cập nhật.",
          listItems: [
            "Livestream: kênh YouTube PPA Tour Asia (youtube.com/@ppatourasia), 9–13/9. Ban tổ chức không nói miễn phí hay phải trả tiền",
            "Truyền hình: trang giải có mục danh sách đài theo khu vực nhưng hiện không hiển thị đài nào",
            "Vé: ĐANG BÁN qua Tixr. Bốn hạng — GA trọn 5 ngày, vé ngày Banger/Dinker, VIP, Premium Courtside. Giá chỉ hiện trên Tixr, không có trên trang PPA",
            "Địa điểm: The Hood, Kuala Lumpur. Chỉ có link bản đồ, không có địa chỉ",
          ],
          internalLinks: [
            {
              text: "Cách xem trực tiếp các giải PPA Tour 2026",
              path: "/vi/blog/xem-ppa-tour-truc-tiep-2026",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "Leapmotor Kuala Lumpur Cup 2026 diễn ra khi nào?",
          answer: "Từ 9 đến 13/9/2026 tại The Hood, Kuala Lumpur, Malaysia. Vòng loại thứ Tư 9/9; chung kết Chủ nhật 13/9 lúc 13:00–18:00 giờ Malaysia, tức 12:00–17:00 giờ Việt Nam.",
        },
        {
          question: "Giải Kuala Lumpur Cup 2026 có bao nhiêu tiền thưởng?",
          answer: "Tối đa 300.000 USD, kèm 1000 điểm xếp hạng cho mỗi HCV. VĐV có hợp đồng PPA hạng Gold khi vô địch nhận 9.000 USD ở nội dung đơn, 38.000 USD ở đôi cùng giới và 30.000 USD ở đôi nam nữ. VĐV thuộc hạng hợp đồng khác được trả theo thang riêng.",
        },
        {
          question: "Có những tay vợt Việt Nam nào dự Kuala Lumpur Cup 2026?",
          answer: "Năm người ở main draw: Hồ Tâm (hạt giống 8 đơn nữ), Sophia Nhi Huynh, Sophia Phương Anh Trần, Ngô Đăng và Hoàng Nguyễn Anh. Một số tay vợt khác ở vòng loại. Trương Vinh Hiển không đăng ký nội dung nào.",
        },
        {
          question: "Xem trực tiếp Kuala Lumpur Cup 2026 ở đâu?",
          answer: "PPA Tour Asia phát trực tiếp trên kênh YouTube của họ suốt 5 ngày 9–13/9. Trang giải cũng có mục danh sách đài phát sóng theo khu vực nhưng hiện đang trống, và ban tổ chức chưa nói stream miễn phí hay phải trả tiền.",
        },
        {
          question: "Kuala Lumpur Cup thuộc hạng nào của PPA Tour Asia?",
          answer: "Đây là chặng thang 1000 điểm, trên các chặng 500 điểm như Skechers Shenzhen Open. Đây là chặng 1000 điểm thứ hai của mùa châu Á 2026 — MB Hanoi Cup hồi tháng 4 là chặng đầu, cùng trần tiền thưởng. Chỉ Hong Kong Slam tháng 10 có tổng thưởng lớn hơn.",
        },
      ],
    },
  },
};

export default post;
