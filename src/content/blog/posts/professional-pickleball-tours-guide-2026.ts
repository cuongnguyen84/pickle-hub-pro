import type { BlogPost } from "@/content/blog/types";

/**
 * Cluster B pillar — comprehensive guide to all major professional
 * pickleball tours in 2026 (PPA Tour, MLP, PPA Tour Asia, APP Tour),
 * plus the UPA holding company, top players, and how to follow each.
 *
 * Pairs with VI post `cac-giai-pickleball-chuyen-nghiep-2026-toan-canh`
 * via `alternate_en_slug` on Supabase `vi_blog_posts`. Internal links
 * back to existing posts (Tour Wars 2023, PPA Tour Asia, MLP format,
 * World Cup Da Nang, DUPR rating system, how-to-watch-ppa-tour-live).
 *
 * 30-day content plan post P1/15. Published Mon 2026-05-18.
 */
const post: BlogPost = {
  slug: "professional-pickleball-tours-guide-2026",
  publishedDate: "2026-05-18",
  updatedDate: "2026-05-18",
  author: "Cuong Nguyen",
  tags: [
    "professional pickleball",
    "ppa tour",
    "mlp",
    "ppa tour asia",
    "app tour",
    "upa",
    "2026",
    "pro pickleball comparison",
    "asia",
  ],
  ctaPath: "/blog/ppa-tour-asia-2026-complete-guide",
  ctaLabel: {
    en: "Read: PPA Tour Asia 2026 Complete Guide",
    vi: "Đọc: Hướng dẫn đầy đủ PPA Tour Asia 2026",
  },
  heroImage: {
    src: "/images/blog/professional-pickleball-tours-guide-2026-hero.webp",
    alt: "Professional pickleball tours 2026 — PPA Tour, MLP, PPA Tour Asia, and APP Tour shown across global venues with crowded stadiums and broadcast cameras, the four pro circuits operating under the UPA umbrella that define competitive pickleball in 2026",
  },
  content: {
    en: {
      title: "Professional Pickleball Tours 2026: Complete Guide to PPA, MLP, PPA Tour Asia, and APP",
      metaTitle: "Pro Pickleball Tours 2026 | PPA vs MLP vs APP vs PPA Asia Compared",
      metaDescription:
        "2026 guide to pro pickleball tours: PPA Tour, MLP, PPA Tour Asia, APP — schedules, prize money, formats, top players, how to watch from Asia.",
      sections: [
        {
          heading: "The Pro Pickleball Landscape in 2026, at a Glance",
          content:
            "Pickleball's professional scene in 2026 is more organized than ever — and more confusing than ever, if you're new to following it. After the chaotic Tour Wars of 2023 and the PPA-MLP merger of 2024, four major pro circuits now operate side by side: the PPA Tour (the US-flagship singles and doubles circuit), Major League Pickleball or MLP (team-format competition), PPA Tour Asia (the fastest-growing regional tour), and the APP Tour (independent of UPA, broadcast-focused, increasingly collegiate). This guide explains how each tour works in 2026, what's different about them, who the top players are, and — for our Vietnamese and Asian readers — how all of this connects back to the events you can actually watch and play in.",
          internalLinks: [
            {
              text: "Background: Pickleball Tour Wars 2023 — the 10 days that reshaped pro pickleball",
              path: "/blog/pickleball-tour-wars-2023-explained",
            },
          ],
        },
        {
          heading: "How the United Pickleball Association (UPA) Holds It All Together",
          content:
            "In March 2024, the Professional Pickleball Association (PPA) and Major League Pickleball (MLP) officially merged into a single parent holding company: the United Pickleball Association, or UPA. The deal received a $75 million investment from private equity firm SC Holdings and unified two organizations that had spent most of 2023 in a hostile bidding war for top players. As of 2026, UPA is the holding company that owns both the PPA Tour and MLP. PPA Tour Asia operates as a UPA-affiliated regional partner. The APP Tour, importantly, is not part of UPA — it remains independent. UPA has also publicly signaled plans for a $150–200 million capital raise to build what they call a 'vertically integrated pickleball platform,' which in practice means more broadcast deals, more international expansion, and tighter integration with the DUPR rating system through a strategic partnership announced in 2025.",
          internalLinks: [
            {
              text: "Related: What is DUPR — the pickleball rating system explained",
              path: "/blog/what-is-dupr-pickleball-rating-system",
            },
          ],
        },
        {
          heading: "The PPA Tour — Singles, Doubles, and Mixed at the Highest Level",
          content:
            "The PPA Tour is the flagship singles, doubles, and mixed doubles circuit in professional pickleball, and the most direct way to find out who the world's best player is. In 2026, the PPA Tour calendar features more than 25 tournaments across the United States, plus a robust international schedule featuring stops in Australia, Canada, Italy, and the PPA Tour Asia events. Each PPA event is categorized into one of five tiers based on ranking points awarded to the winner: Worlds (3,000 points), Slam (2,000), Cup (1,500), Open (1,000), and Challenger (125–500). Prize money scales accordingly. A winning men's doubles team at a Slam-tier event in 2026 takes home $90,000, while a Round of 16 finisher earns $6,000. At the very top, PPA Australia 2026 will host an Australian Pickleball Open with a record-setting $500,000 prize pool. The season-long race ends at the PPA Finals, where the eight highest-ranked players and teams compete for the title of PPA World No. 1 — the closest thing professional pickleball has to a single, undisputed annual champion.",
        },
        {
          heading: "Major League Pickleball (MLP) — Team Format, Different Rules, Different Drama",
          content:
            "Where the PPA Tour is built around individual achievement, MLP is built around teams. In 2026, all 20 MLP franchises compete at a single league level — the Premier/Challenger split from previous seasons has been retired. Each team plays five of the nine regular-season events from May through August, then 12 teams advance to a three-week playoff series culminating with Championship Weekend in New York City. Each MLP match consists of four games — women's doubles, men's doubles, and two mixed doubles. If teams are tied 2-2 after those four games, the match is decided by a DreamBreaker singles tiebreaker using rally scoring to 21. Two notable 2026 franchise changes: the Brooklyn Pickleball Team and NY Hustlers merged into a single Brooklyn-based entity, while the Nashville Chefs and DC Pickleball Team are not participating in the 2026 season as ownership sale agreements are being finalized. MLP rosters mix elite PPA Tour stars with rising talent, creating cross-pollination between the two circuits — many top players, including Anna Leigh Waters and Ben Johns, compete on both.",
          internalLinks: [
            {
              text: "Deep dive: MLP format explained — rotation, DreamBreaker, scoring",
              path: "/blog/mlp-format-explained",
            },
          ],
        },
        {
          heading: "PPA Tour Asia 2026 — The Fastest-Growing Regional Tour",
          content:
            "PPA Tour Asia is no longer a side project. The 2026 season features 10 tournament stops across seven markets — Vietnam, Malaysia, Macao, China, Japan, Singapore, and Hong Kong — with a total prize pool of approximately $2.15 million. Vietnam holds two stops on the calendar: the MB Hanoi Cup (April 1–5, opening event of the season with up to $300,000 in prize money and nearly 800 registered players) and the Ho Chi Minh City Open (August 6–9, $70,000 prize pool, PPA Asia 500 tier). The season finale is the Hong Kong Slam in October, with up to $1.1 million on the line — the largest single event in Asian pickleball history. PPA Tour Asia uses a signature 'Play Where the Pros Play' format: amateur events run alongside the pro draw at every stop, meaning recreational players can compete on the same courts, in the same venues, as the world's top professionals. For Vietnamese and Southeast Asian players, this is the most accessible high-level competition available.",
          internalLinks: [
            {
              text: "Full PPA Tour Asia 2026 schedule, prize money, and how to register",
              path: "/blog/ppa-tour-asia-2026-complete-guide",
            },
          ],
        },
        {
          heading: "The APP Tour — Independent, Broadcast-First, Increasingly Collegiate",
          content:
            "The Association of Pickleball Players (APP) Tour is the major independent circuit in professional pickleball — not part of UPA, with its own roster of contracted players, its own ranking system, and its own broadcast strategy. In 2026, the APP Tour features 12 US stops with 13 nationally televised events through partnerships with CBS Sports and ESPN — a meaningful difference versus the PPA Tour, where broadcast distribution skews more heavily toward streaming. APP's 2026 calendar opens with the Daytona Beach Open in February and includes high-profile stops in Fort Lauderdale, Sacramento, Newport Beach (Southern California Open), Virginia Beach, and Cincinnati (the Vlasic Classic). Beyond the main tour, APP runs three additional circuits: APP Next (a player development tournament series), the APP Selkirk Collegiate Series (culminating in the U.S. Collegiate Championships in Cape Coral, Florida — a $85,000 purse event), and at least four pro invitational events featuring the highest-level competition with major prize money. The Tour Wars contract structure from 2023 still affects which top players appear on APP versus UPA events, so the rosters at any given APP stop look quite different from a PPA Tour stop.",
          internalLinks: [
            {
              text: "Context: APP Tour vs PPA Tour player contracts in 2026",
              path: "/blog/app-tour-vs-ppa-tour-contracts-2026",
            },
          ],
        },
        {
          heading: "Tour-by-Tour Comparison: What Makes Each Different",
          content:
            "The four tours each occupy a distinct niche. Use the table below as a quick reference, then dig deeper into the dedicated posts for the events that matter most to you.",
          orderedList: [
            "PPA Tour — Individual format (singles, doubles, mixed) | 25+ US stops + international | Ranking-points system | Owned by UPA | Watch: PickleballTV streaming + select ESPN broadcasts | Headlined by Ben Johns, Anna Leigh Waters",
            "MLP — Team format (4-game matches with DreamBreaker tiebreaker) | 20 teams, 9 regular-season events May–August | Owned by UPA | Watch: PickleballTV + Pickleball.com app | Headlined by team franchises (NY/Brooklyn, LA, Miami, Texas, etc.)",
            "PPA Tour Asia — Individual format with 'Play Where the Pros Play' amateur integration | 10 stops across 7 Asian markets, April–October | UPA-affiliated regional tour | $2.15M total prize pool, Hong Kong Slam $1.1M finale | Watch: Asia Pickleball TV, ESPN select coverage, ThePickleHub recaps",
            "APP Tour — Individual format, independent of UPA | 12 US stops + collegiate series + invitationals | National TV via CBS Sports + ESPN | Distinct player roster from PPA Tour due to 2023 Tour Wars contract structure | Watch: CBS Sports, ESPN, streaming",
          ],
        },
        {
          heading: "Top Players to Watch in 2026 — Who Sits at the Top",
          content:
            "Two names dominate the global rankings in 2026. On the women's side, 18-year-old Anna Leigh Waters is the No. 1-ranked singles, doubles, and mixed doubles player in the world by the PPA Tour — a level of multi-format dominance no other player has matched in the sport's professional era. She is widely considered the greatest female pickleball player ever and the face of the women's game for the foreseeable future. On the men's side, Ben Johns enters 2026 as the world's No. 1 mixed doubles player and No. 1 men's doubles player, with his singles ranking fluctuating in the top 15 as a new wave of singles specialists has emerged. As of May 2026, his DUPR rating is above 7.35 — among the highest ever recorded. Beyond these two, watch for Anna Bright (the 2026 PPA Mesa Cup champion in mixed doubles alongside Hayden Patriquin), Federico Staksrud, Tyson McGuffin, JW Johnson, Riley Newman, Christian Alshon, Catherine Parenteau, and the growing Asian contingent across PPA Tour Asia events. Newer faces like 15-year-old Tama Shimabukuro — who reached the PPA Atlanta singles final — represent the next generation already pushing through.",
          internalLinks: [
            {
              text: "Profile: 15-year-old Tama Shimabukuro reaches PPA Atlanta singles final",
              path: "/blog/tama-shimabukuro-ppa-atlanta-final-15-year-old",
            },
          ],
        },
        {
          heading: "Vietnam and the Asian Pro Scene — Why 2026 Is the Inflection Year",
          content:
            "For Vietnamese players and fans, 2026 is the most consequential year in pickleball history so far. The country hosts two PPA Tour Asia stops (Hanoi and Ho Chi Minh City) — more than any other Asian country — and the inaugural Pickleball World Cup arrives in Da Nang in August. Vietnam's pickleball awareness sits at 88% of the adult population per UPA Asia and YouGov research, the highest in any country surveyed globally, with over 16 million monthly players. The Vietnam Pickleball Federation has formalized partnerships with DUPR Vietnam through ThePickleHub-affiliated programs, meaning Vietnamese players competing in domestic tournaments are now building DUPR ratings recognized at international PPA Tour Asia events. This is the year a clear path emerged: amateur play in Vietnam → DUPR rating → PPA Tour Asia amateur draws → professional pathway. It did not exist three years ago.",
          internalLinks: [
            {
              text: "Pickleball World Cup 2026 Da Nang — full preview",
              path: "/blog/pickleball-world-cup-2026-da-nang",
            },
            {
              text: "DUPR Vietnam partnership with TA Pickleball and ThePickleHub",
              path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub",
            },
          ],
        },
        {
          heading: "How to Watch the Pro Tours From Asia",
          content:
            "Distribution is the single biggest practical question for fans outside the US. Here is the realistic 2026 landscape from a Vietnamese viewer's perspective:",
          listItems: [
            "PPA Tour main events — Primary source: PickleballTV (PickleballTV.com) for paid streaming; select Sunday finals air on ESPN+ and broadcast ESPN in the US. From Asia, you'll usually need PickleballTV or a VPN for ESPN+.",
            "MLP regular season and playoffs — Primary source: PickleballTV and the Pickleball.com mobile app. Championship Weekend (New York, August) sometimes gets broadcast network coverage.",
            "PPA Tour Asia events — Asia Pickleball TV broadcasts most events; ESPN covers select rounds; some events stream free on YouTube and Facebook for opening days.",
            "APP Tour — CBS Sports and ESPN broadcast 13 events on national TV in 2026 — among the most accessible options globally. APP also streams events on their own platforms.",
            "ThePickleHub — English- and Vietnamese-language coverage of all four tours with recaps, player profiles, and links to where you can watch each event.",
          ],
          internalLinks: [
            {
              text: "How to watch PPA Tour live in 2026 — full streaming + free options",
              path: "/blog/how-to-watch-ppa-tour-live-2026",
            },
          ],
        },
        {
          heading: "What's Coming in 2027 and Beyond",
          content:
            "Three trends are worth tracking past 2026. First, UPA's planned $150–200 million capital raise is intended to fund continued international expansion — expect new PPA Tour stops in additional Asian markets, more dedicated broadcast deals, and tighter integration between MLP and PPA scheduling. Second, the APP Tour's collegiate series is building a US college-to-pro pipeline that didn't exist before, which will reshape who the next generation of American pros looks like. Third, on the Asian side, the Pickleball World Cup in Da Nang is the first event truly designed to crown a global champion outside the UPA umbrella — if it succeeds, expect more independent international competition to follow, including a likely European Pickleball Tour expansion already being discussed. For now, 2026 is the year to set up your tournament-watching habits: pick the tours that matter to you, bookmark where they stream, and treat the next 12 months as the most important year for pickleball as a global professional sport.",
        },
        {
          heading: "Quick Action Items for Players and Fans",
          content:
            "If you're a Vietnamese or Asian player who wants to actually do something with this guide, here are the four next steps that turn watching into participating:",
          orderedList: [
            "Pick one tour to follow in depth — don't try to track all four. PPA Tour Asia is the highest-relevance option for Vietnamese fans.",
            "Register for a DUPR rating if you don't have one yet — every PPA Tour Asia amateur event uses DUPR for skill matching, and your domestic results count.",
            "Enter a local amateur event — start with a club tournament, then move up to a PPA Tour Asia amateur draw. The pathway is real and accessible.",
            "Bookmark ThePickleHub for bilingual coverage — we recap every major event in English and Vietnamese, with internal links to the deeper guides on each tour.",
          ],
          internalLinks: [
            {
              text: "Free tools for running your own tournament",
              path: "/tools",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "What's the difference between the PPA Tour and MLP?",
          answer:
            "Both are owned by UPA, but the PPA Tour is an individual-player circuit (singles, doubles, mixed doubles) where players compete for personal rankings, while MLP is a team-based league where 20 franchises compete in 4-game matches with a DreamBreaker singles tiebreaker. Many top players, including Ben Johns and Anna Leigh Waters, compete on both.",
        },
        {
          question: "Is the APP Tour part of UPA?",
          answer:
            "No. The APP (Association of Pickleball Players) Tour is independent of UPA. It has its own roster of contracted players, ranking system, and broadcast deals with CBS Sports and ESPN. This is why the player lineups at APP events look different from PPA Tour events — a legacy of the 2023 Tour Wars contract structure.",
        },
        {
          question: "How big is PPA Tour Asia in 2026 versus the US PPA Tour?",
          answer:
            "PPA Tour Asia features 10 stops across 7 markets with a total prize pool of approximately $2.15 million. The Hong Kong Slam alone ($1.1M) is one of the largest single events in pro pickleball anywhere. The US PPA Tour has more events (25+) but PPA Tour Asia's growth rate is significantly higher — and it's the only major tour with full amateur integration at every stop.",
        },
        {
          question: "Who is the No. 1 ranked pickleball player in the world right now?",
          answer:
            "On the men's side, Ben Johns enters 2026 as world No. 1 in men's doubles and mixed doubles with a DUPR rating above 7.35. On the women's side, 18-year-old Anna Leigh Waters is No. 1 in singles, doubles, and mixed doubles simultaneously — an unprecedented level of dominance.",
        },
        {
          question: "Can amateur players compete in any of these pro tours?",
          answer:
            "Yes — PPA Tour Asia is the most accessible. Every PPA Tour Asia stop in 2026 includes 'Play Where the Pros Play' amateur events with age and rating divisions, on the same courts as the pros. The US-based PPA Tour and APP Tour also run amateur events at most stops, though logistics and travel costs are higher for international players.",
        },
        {
          question: "Where can I watch professional pickleball from Vietnam?",
          answer:
            "PPA Tour Asia events are broadcast on Asia Pickleball TV and select ESPN coverage. PPA Tour main events stream on PickleballTV.com (paid). MLP streams on PickleballTV and the Pickleball.com mobile app. APP Tour events air on CBS Sports and ESPN. ThePickleHub publishes bilingual English-Vietnamese recaps and links to where each event is available.",
        },
        {
          question: "Is professional pickleball profitable for top players in 2026?",
          answer:
            "For the top 20 players globally, yes — a combination of tournament prize money, MLP team contracts, sponsorship deals, and equipment endorsements puts annual earnings well into six and sometimes seven figures. Below the top 50, professional pickleball is still a developing economic ecosystem — many players supplement tour income with coaching, clinics, and content creation.",
        },
      ],
    },
    vi: {
      title: "Các giải Pickleball chuyên nghiệp 2026: Hướng dẫn đầy đủ về PPA, MLP, PPA Tour Asia và APP",
      metaTitle: "Pro Pickleball 2026 | PPA, MLP, APP, PPA Tour Asia — So sánh đầy đủ",
      metaDescription:
        "Hướng dẫn đầy đủ về 4 giải pickleball chuyên nghiệp 2026 — PPA Tour, MLP, PPA Tour Asia, APP — lịch thi đấu, tiền thưởng, format, top VĐV và cách xem từ Việt Nam.",
      sections: [
        {
          heading: "Bức tranh pickleball chuyên nghiệp 2026 — tổng quan",
          content:
            "Pickleball chuyên nghiệp năm 2026 chưa bao giờ có tổ chức tốt như hiện tại — và cũng chưa bao giờ phức tạp đến mức này nếu bạn mới theo dõi. Sau Tour Wars hỗn loạn năm 2023 và vụ sáp nhập PPA-MLP đầu năm 2024, hiện có 4 giải chuyên nghiệp lớn cùng hoạt động song song: PPA Tour (giải cá nhân chủ lực ở Mỹ — đơn, đôi, đôi hỗn hợp), Major League Pickleball hay MLP (thể thức đồng đội), PPA Tour Asia (tour khu vực phát triển nhanh nhất), và APP Tour (độc lập với UPA, tập trung vào phát sóng truyền hình và giải đại học). Bài này giải thích từng giải hoạt động ra sao trong 2026, khác nhau ở đâu, ai là top VĐV — và quan trọng nhất với độc giả Việt Nam: tất cả những điều này kết nối ra sao với các sự kiện bạn có thể xem và thi đấu thực tế.",
          internalLinks: [
            {
              text: "Bối cảnh: Tour Wars 2023 — 10 ngày định hình pickleball pro hiện đại",
              path: "/vi/blog/tour-wars-2023-pickleball",
            },
          ],
        },
        {
          heading: "UPA — Công ty mẹ giữ cả hệ thống lại với nhau",
          content:
            "Tháng 3/2024, Professional Pickleball Association (PPA) và Major League Pickleball (MLP) chính thức sáp nhập thành một công ty mẹ duy nhất: United Pickleball Association — UPA. Thương vụ nhận đầu tư 75 triệu USD từ quỹ private equity SC Holdings và thống nhất hai tổ chức đã trải qua gần như cả năm 2023 trong cuộc chiến giành VĐV gay gắt. Tính đến 2026, UPA là công ty mẹ sở hữu cả PPA Tour và MLP. PPA Tour Asia hoạt động như đối tác khu vực liên kết với UPA. Lưu ý quan trọng: APP Tour KHÔNG thuộc UPA — vẫn độc lập. UPA đã công bố kế hoạch huy động thêm 150–200 triệu USD vốn để xây dựng cái họ gọi là 'nền tảng pickleball tích hợp dọc', cụ thể là nhiều hợp đồng phát sóng hơn, mở rộng quốc tế mạnh hơn, và tích hợp chặt chẽ hơn với hệ thống xếp hạng DUPR qua quan hệ chiến lược đã công bố năm 2025.",
          internalLinks: [
            {
              text: "Liên quan: DUPR là gì — hệ thống xếp hạng pickleball giải thích",
              path: "/vi/blog/dupr-la-gi-huong-dan-cho-nguoi-choi-viet-nam",
            },
          ],
        },
        {
          heading: "PPA Tour — Giải cá nhân đẳng cấp cao nhất",
          content:
            "PPA Tour là giải đơn, đôi, đôi hỗn hợp chủ lực trong pickleball chuyên nghiệp, và là cách trực tiếp nhất để xác định ai là VĐV số 1 thế giới. Mùa 2026 có hơn 25 giải tại Mỹ, cộng thêm lịch quốc tế với các chặng ở Úc, Canada, Ý và toàn bộ PPA Tour Asia. Mỗi giải PPA được phân vào một trong 5 hạng dựa trên điểm xếp hạng trao cho nhà vô địch: Worlds (3.000 điểm), Slam (2.000), Cup (1.500), Open (1.000), và Challenger (125–500). Tiền thưởng tăng theo hạng giải. Đội đôi nam vô địch giải Slam năm 2026 nhận $90.000, còn đội về tới vòng 16 nhận $6.000. Đỉnh cao là PPA Australia 2026 — Australian Pickleball Open với quỹ tiền thưởng kỷ lục $500.000. Mùa giải kết thúc bằng PPA Finals, nơi 8 VĐV và cặp đôi xếp hạng cao nhất tranh ngôi PPA World No. 1 — danh hiệu gần nhất pickleball có được với một nhà vô địch thế giới được công nhận chung.",
        },
        {
          heading: "Major League Pickleball (MLP) — Thể thức đồng đội, luật khác, drama khác",
          content:
            "Trong khi PPA Tour xoay quanh thành tích cá nhân, MLP xoay quanh đội. Mùa 2026, cả 20 đội MLP thi đấu cùng một hạng — không còn split Premier/Challenger như các mùa trước. Mỗi đội chơi 5 trong 9 chặng vòng bảng từ tháng 5 đến tháng 8, sau đó 12 đội vào playoff 3 tuần và kết thúc bằng Championship Weekend tại New York. Mỗi trận MLP gồm 4 ván — đôi nữ, đôi nam, và 2 đôi hỗn hợp. Nếu hòa 2-2 sau 4 ván, sẽ có ván tiebreaker DreamBreaker đơn nam-nữ tính điểm rally đến 21. Hai thay đổi đáng chú ý 2026: Brooklyn Pickleball Team và NY Hustlers sáp nhập thành một đội duy nhất tại Brooklyn, còn Nashville Chefs và DC Pickleball Team không tham gia mùa 2026 do đang hoàn tất thương vụ chuyển nhượng. Roster MLP trộn các pro hàng đầu của PPA Tour với tài năng đang lên — kéo theo dòng chảy giữa hai giải. Anna Leigh Waters và Ben Johns đều thi đấu cả hai.",
          internalLinks: [
            {
              text: "Chi tiết: Luật chơi MLP — luân chuyển, DreamBreaker, scoring",
              path: "/blog/mlp-format-explained",
            },
          ],
        },
        {
          heading: "PPA Tour Asia 2026 — Tour khu vực phát triển nhanh nhất",
          content:
            "PPA Tour Asia không còn là 'dự án phụ'. Mùa 2026 có 10 chặng đấu tại 7 thị trường — Việt Nam, Malaysia, Macao, Trung Quốc, Nhật Bản, Singapore, Hồng Kông — tổng tiền thưởng khoảng 2,15 triệu USD. Việt Nam có 2 chặng trong lịch: MB Hanoi Cup (1–5/4, giải mở màn mùa, tiền thưởng lên tới $300.000, gần 800 VĐV đăng ký) và Ho Chi Minh City Open (6–9/8, $70.000, hạng PPA Asia 500). Trận chung kết mùa giải là Hong Kong Slam tháng 10, tiền thưởng lên tới 1,1 triệu USD — giải đơn lẻ lớn nhất trong lịch sử pickleball châu Á. PPA Tour Asia dùng mô hình đặc trưng 'Play Where the Pros Play': giải nghiệp dư chạy song song với giải pro tại mỗi chặng, nghĩa là VĐV phong trào có thể thi đấu trên cùng sân, cùng địa điểm với các pro hàng đầu thế giới. Với VĐV Việt Nam và Đông Nam Á, đây là sân chơi cấp cao dễ tiếp cận nhất hiện nay.",
          internalLinks: [
            {
              text: "Lịch đầy đủ PPA Tour Asia 2026 + cách đăng ký",
              path: "/blog/ppa-tour-asia-2026-complete-guide",
            },
          ],
        },
        {
          heading: "APP Tour — Độc lập, ưu tiên truyền hình, ngày càng mạnh ở giải đại học",
          content:
            "Association of Pickleball Players (APP) Tour là giải chuyên nghiệp độc lập lớn nhất — không thuộc UPA, có roster VĐV ký hợp đồng riêng, hệ thống xếp hạng riêng, và chiến lược phát sóng riêng. Năm 2026, APP Tour có 12 chặng tại Mỹ với 13 sự kiện được phát sóng truyền hình toàn quốc qua hợp tác với CBS Sports và ESPN — điểm khác biệt rõ so với PPA Tour, vốn nghiêng nhiều về streaming. Lịch APP 2026 mở màn với Daytona Beach Open tháng 2 và có các chặng nổi bật ở Fort Lauderdale, Sacramento, Newport Beach (Southern California Open), Virginia Beach và Cincinnati (Vlasic Classic). Ngoài tour chính, APP còn vận hành 3 hệ thống bổ trợ: APP Next (giải phát triển VĐV trẻ), APP Selkirk Collegiate Series (kết thúc bằng U.S. Collegiate Championships ở Cape Coral, Florida — giải tổng quỹ thưởng $85.000), và ít nhất 4 giải pro invitational quy tụ VĐV đỉnh cao thế giới với tiền thưởng lớn. Cấu trúc hợp đồng từ Tour Wars 2023 đến nay vẫn ảnh hưởng đến chuyện VĐV nào có thể xuất hiện ở APP hay UPA — nên roster mỗi chặng APP rất khác so với PPA Tour.",
          internalLinks: [
            {
              text: "Bối cảnh: Hợp đồng VĐV APP Tour vs PPA Tour 2026",
              path: "/vi/blog/hop-dong-app-tour-vs-ppa-tour-2026",
            },
          ],
        },
        {
          heading: "So sánh nhanh 4 giải — điểm khác biệt cốt lõi",
          content:
            "4 giải mỗi giải một niche riêng. Dùng bảng dưới làm tham chiếu nhanh, sau đó đào sâu vào bài chuyên đề của giải bạn quan tâm nhất.",
          orderedList: [
            "PPA Tour — Cá nhân (đơn, đôi, đôi hỗn hợp) | 25+ chặng Mỹ + quốc tế | Hệ thống điểm xếp hạng | Sở hữu bởi UPA | Xem: PickleballTV trả phí + ESPN chọn lọc | Đầu bảng: Ben Johns, Anna Leigh Waters",
            "MLP — Đồng đội (4 ván + DreamBreaker tiebreaker) | 20 đội, 9 chặng vòng bảng tháng 5–8 | Sở hữu bởi UPA | Xem: PickleballTV + app Pickleball.com | Đầu bảng: các franchise như NY/Brooklyn, LA, Miami, Texas",
            "PPA Tour Asia — Cá nhân + tích hợp nghiệp dư 'Play Where the Pros Play' | 10 chặng tại 7 thị trường châu Á, tháng 4–10 | Liên kết UPA | $2,15 triệu tổng tiền thưởng, Hong Kong Slam $1,1 triệu | Xem: Asia Pickleball TV, ESPN chọn lọc, ThePickleHub",
            "APP Tour — Cá nhân, độc lập với UPA | 12 chặng Mỹ + giải đại học + invitationals | TV toàn quốc qua CBS Sports + ESPN | Roster VĐV khác PPA Tour do cấu trúc hợp đồng Tour Wars 2023 | Xem: CBS Sports, ESPN, streaming riêng",
          ],
        },
        {
          heading: "Top VĐV đáng theo dõi 2026 — ai đang đứng đầu",
          content:
            "Hai cái tên thống trị bảng xếp hạng toàn cầu 2026. Bên nữ, Anna Leigh Waters 18 tuổi đứng số 1 thế giới ở cả đơn, đôi và đôi hỗn hợp theo PPA Tour — mức độ thống trị đa thể thức chưa VĐV nào sánh được trong kỷ nguyên chuyên nghiệp. Cô được xem là tay vợt nữ vĩ đại nhất lịch sử pickleball và là gương mặt đại diện cho phong trào nữ trong tương lai gần. Bên nam, Ben Johns vào 2026 ở vị trí số 1 đôi hỗn hợp và số 1 đôi nam, hạng đơn dao động trong top 15 do làn sóng chuyên gia đơn mới nổi. Tính đến tháng 5/2026, DUPR rating của anh trên 7.35 — một trong những con số cao nhất từng ghi nhận. Ngoài hai cái tên này, đáng chú ý: Anna Bright (vô địch đôi hỗn hợp PPA Mesa Cup 2026 cùng Hayden Patriquin), Federico Staksrud, Tyson McGuffin, JW Johnson, Riley Newman, Christian Alshon, Catherine Parenteau, cùng lứa VĐV châu Á đang trỗi dậy qua PPA Tour Asia. Tài năng mới như Tama Shimabukuro 15 tuổi — vào chung kết đơn PPA Atlanta — đại diện cho thế hệ kế cận đã sẵn sàng vượt lên.",
          internalLinks: [
            {
              text: "Hồ sơ: Tama Shimabukuro 15 tuổi vào chung kết PPA Atlanta",
              path: "/vi/blog/tama-shimabukuro-15-tuoi-vao-chung-ket-ppa-atlanta",
            },
          ],
        },
        {
          heading: "Việt Nam và pro scene châu Á — vì sao 2026 là năm bản lề",
          content:
            "Với VĐV và fan Việt Nam, 2026 là năm có ý nghĩa lớn nhất trong lịch sử pickleball cho đến nay. Việt Nam đăng cai 2 chặng PPA Tour Asia (Hà Nội và TP.HCM) — nhiều hơn bất kỳ quốc gia châu Á nào khác — và Pickleball World Cup khai mạc tại Đà Nẵng vào tháng 8. Mức độ nhận diện pickleball ở Việt Nam đạt 88% dân số trưởng thành theo nghiên cứu của UPA Asia và YouGov — cao nhất trong tất cả quốc gia được khảo sát toàn cầu, với hơn 16 triệu người chơi hàng tháng. Liên đoàn Pickleball Việt Nam đã chính thức hóa quan hệ với DUPR Vietnam qua các chương trình liên kết với ThePickleHub, nghĩa là VĐV Việt thi đấu giải trong nước nay đang xây dựng DUPR rating được công nhận tại các sự kiện PPA Tour Asia quốc tế. Đây là năm đầu tiên có lộ trình rõ ràng: thi đấu phong trào tại Việt Nam → có DUPR rating → vào draw nghiệp dư PPA Tour Asia → mở đường lên chuyên nghiệp. Ba năm trước, lộ trình này chưa tồn tại.",
          internalLinks: [
            {
              text: "Pickleball World Cup 2026 Đà Nẵng — tổng quan đầy đủ",
              path: "/vi/blog/world-cup-pickleball-2026-da-nang",
            },
            {
              text: "DUPR Vietnam ký kết với TA Pickleball và ThePickleHub",
              path: "/vi/blog/dupr-doi-tac-ta-pickleball-thepicklehub-viet-nam",
            },
          ],
        },
        {
          heading: "Xem pro tour từ Việt Nam ở đâu",
          content:
            "Phân phối là câu hỏi thực tế nhất với fan ngoài Mỹ. Đây là bức tranh 2026 thực tế từ góc nhìn khán giả Việt Nam:",
          listItems: [
            "PPA Tour giải chính — Nguồn chính: PickleballTV (PickleballTV.com) streaming trả phí; chung kết Chủ nhật chọn lọc phát trên ESPN+ và ESPN tại Mỹ. Từ châu Á thường cần PickleballTV hoặc VPN cho ESPN+.",
            "MLP vòng bảng và playoff — Nguồn chính: PickleballTV và app Pickleball.com. Championship Weekend (New York, tháng 8) đôi khi có phát sóng truyền hình quốc gia.",
            "PPA Tour Asia — Asia Pickleball TV phát phần lớn các giải; ESPN phủ một số vòng; nhiều giải stream miễn phí trên YouTube và Facebook ở những ngày khai mạc.",
            "APP Tour — CBS Sports và ESPN phát sóng 13 sự kiện toàn quốc tại Mỹ năm 2026 — trong số những lựa chọn dễ tiếp cận nhất toàn cầu. APP cũng stream sự kiện trên nền tảng riêng.",
            "ThePickleHub — Tường thuật tiếng Anh và tiếng Việt cho cả 4 giải, có recap, hồ sơ VĐV và link dẫn tới nơi xem từng sự kiện.",
          ],
          internalLinks: [
            {
              text: "Cách xem PPA Tour live 2026 — đầy đủ tùy chọn streaming + miễn phí",
              path: "/blog/how-to-watch-ppa-tour-live-2026",
            },
          ],
        },
        {
          heading: "Điều gì đang đến trong 2027 và xa hơn",
          content:
            "Ba xu hướng đáng theo dõi sau 2026. Thứ nhất, kế hoạch huy động 150–200 triệu USD vốn của UPA sẽ tài trợ mở rộng quốc tế tiếp theo — kỳ vọng thêm các chặng PPA Tour ở thị trường châu Á mới, nhiều hợp đồng phát sóng chuyên biệt hơn, và tích hợp chặt chẽ hơn giữa MLP và lịch PPA. Thứ hai, hệ thống giải đại học của APP Tour đang xây dựng đường ống Mỹ-college-to-pro chưa từng có, sẽ định hình thế hệ pro Mỹ tiếp theo. Thứ ba, ở phía châu Á, Pickleball World Cup tại Đà Nẵng là sự kiện đầu tiên thực sự thiết kế để xác định nhà vô địch toàn cầu ngoài hệ thống UPA — nếu thành công, sẽ có thêm nhiều giải quốc tế độc lập, gồm khả năng mở rộng European Pickleball Tour đã được bàn tới. Hiện tại, 2026 là năm để định hình thói quen theo dõi giải: chọn tour quan trọng nhất với bạn, đánh dấu nơi xem, và xem 12 tháng tới như năm bản lề nhất của pickleball với tư cách một môn thể thao chuyên nghiệp toàn cầu.",
        },
        {
          heading: "Hành động cụ thể cho VĐV và fan",
          content:
            "Nếu bạn là VĐV Việt Nam hay châu Á muốn làm gì đó thực sự sau khi đọc bài này, đây là 4 bước biến việc xem giải thành việc tham gia giải:",
          orderedList: [
            "Chọn 1 tour theo dõi sâu — đừng cố bao quát cả 4. PPA Tour Asia là lựa chọn liên quan nhất với fan Việt Nam.",
            "Đăng ký DUPR rating nếu chưa có — mọi sự kiện nghiệp dư PPA Tour Asia đều dùng DUPR để xếp trình độ, và kết quả thi đấu trong nước của bạn đều được tính.",
            "Tham gia 1 giải nghiệp dư — bắt đầu từ giải CLB, sau đó tiến lên draw nghiệp dư PPA Tour Asia. Lộ trình này thực sự khả thi.",
            "Bookmark ThePickleHub để theo dõi tường thuật song ngữ — chúng tôi recap mọi sự kiện lớn bằng cả tiếng Anh và tiếng Việt, có link dẫn tới hướng dẫn chuyên sâu từng tour.",
          ],
          internalLinks: [
            {
              text: "Công cụ miễn phí tổ chức giải đấu của bạn",
              path: "/vi/tools",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "Khác biệt giữa PPA Tour và MLP là gì?",
          answer:
            "Cả hai đều thuộc UPA, nhưng PPA Tour là giải cá nhân (đơn, đôi, đôi hỗn hợp) — VĐV tranh điểm cá nhân, còn MLP là giải đồng đội — 20 franchise thi đấu trận 4 ván + DreamBreaker tiebreaker đơn. Nhiều top VĐV, gồm Ben Johns và Anna Leigh Waters, thi đấu cả hai.",
        },
        {
          question: "APP Tour có thuộc UPA không?",
          answer:
            "Không. APP (Association of Pickleball Players) Tour độc lập với UPA. Có roster VĐV ký riêng, hệ thống xếp hạng riêng, hợp đồng phát sóng riêng với CBS Sports và ESPN. Đây là lý do roster các giải APP rất khác PPA Tour — di sản từ cấu trúc hợp đồng Tour Wars 2023.",
        },
        {
          question: "PPA Tour Asia 2026 lớn cỡ nào so với PPA Tour Mỹ?",
          answer:
            "PPA Tour Asia có 10 chặng tại 7 thị trường với tổng tiền thưởng khoảng 2,15 triệu USD. Riêng Hong Kong Slam ($1,1 triệu) là một trong những giải đơn lẻ lớn nhất pickleball pro toàn cầu. PPA Tour Mỹ có nhiều giải hơn (25+) nhưng tốc độ tăng trưởng của PPA Tour Asia cao hơn đáng kể — và là tour duy nhất có tích hợp nghiệp dư trọn vẹn tại mọi chặng.",
        },
        {
          question: "Ai là VĐV pickleball số 1 thế giới hiện tại?",
          answer:
            "Bên nam, Ben Johns vào 2026 ở vị trí số 1 thế giới đôi nam và đôi hỗn hợp, DUPR trên 7.35. Bên nữ, Anna Leigh Waters 18 tuổi đứng số 1 đồng thời ở đơn, đôi và đôi hỗn hợp — mức độ thống trị chưa từng có.",
        },
        {
          question: "VĐV nghiệp dư có thể thi đấu trong bất kỳ tour pro nào không?",
          answer:
            "Có — PPA Tour Asia là dễ tiếp cận nhất. Mọi chặng PPA Tour Asia 2026 đều có giải nghiệp dư 'Play Where the Pros Play' với phân hạng theo tuổi và trình độ, trên cùng sân với các pro. PPA Tour Mỹ và APP Tour cũng có giải nghiệp dư tại phần lớn các chặng, dù chi phí du lịch cao hơn cho VĐV quốc tế.",
        },
        {
          question: "Xem pickleball pro từ Việt Nam ở đâu?",
          answer:
            "PPA Tour Asia phát trên Asia Pickleball TV và một số phần trên ESPN. PPA Tour giải chính stream trên PickleballTV.com (trả phí). MLP stream trên PickleballTV và app Pickleball.com. APP Tour phát trên CBS Sports và ESPN. ThePickleHub đăng tường thuật song ngữ Anh-Việt và link dẫn tới nơi xem từng sự kiện.",
        },
        {
          question: "Pickleball pro có sinh lời cho top VĐV trong 2026 không?",
          answer:
            "Với top 20 VĐV toàn cầu, có — kết hợp tiền thưởng giải đấu, hợp đồng MLP, tài trợ thương hiệu và quảng cáo dụng cụ đưa thu nhập hàng năm vào khoảng 6-7 con số USD. Dưới top 50, pro pickleball vẫn là hệ sinh thái kinh tế đang phát triển — nhiều VĐV bổ sung thu nhập bằng huấn luyện, clinic và content.",
        },
      ],
    },
  },
};

export default post;
