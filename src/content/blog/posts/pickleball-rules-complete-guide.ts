import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "pickleball-rules-complete-guide",
  publishedDate: "2026-04-19",
  updatedDate: "2026-04-19",
  author: "Cuong Nguyen",
  tags: ["pickleball rules", "beginner", "kitchen rule", "serving", "scoring", "ppa tour asia"],
  ctaPath: "/tools/quick-tables",
  ctaLabel: { en: "Try Free Scoring Tool", vi: "Dùng thử chấm điểm miễn phí" },
  content: {
    en: {
      title: "Pickleball Rules 2026: The Complete Guide (With Asia's Hardest Calls Explained)",
      metaTitle: "Pickleball Rules 2026 | Complete Guide with Asia's Hardest Calls Explained",
      metaDescription: "The complete 2026 Pickleball rulebook simplified: serve, two-bounce, kitchen/NVZ, scoring, faults. Plus: the 5 calls that start fights in Asian tournaments — and how to settle them.",
      sections: [
        {
          heading: "Why Another Pickleball Rules Guide?",
          content: "Pickleball has exploded across Asia. Vietnam alone went from a few thousand players in 2023 to over 500,000 in early 2026. PPA Tour Asia is now staging pro events in Hanoi, Bangkok, Singapore, and Manila. But most English rulebooks are written for US players, and the calls that spark arguments in Asian tournaments — especially around the kitchen rule and serving mechanics — need a clearer explanation than 'just read the USA Pickleball rulebook.' This guide covers the complete 2026 rules, then ends with the five most-disputed calls we've seen across ThePickleHub's coverage of PPA Tour Asia — and exactly how to settle them."
        },
        {
          heading: "What Is Pickleball?",
          content: "Pickleball is a paddle sport that blends elements of tennis, badminton, and table tennis. Played with a solid paddle and a perforated plastic ball on a court roughly a quarter the size of a tennis court, with a net slightly lower than tennis height.",
          listItems: [
            "Invented — 1965, Bainbridge Island, Washington, USA",
            "US players — 13+ million (2025)",
            "Asia players — estimated 2+ million across Vietnam, Thailand, Singapore, India, and Southeast Asia (early 2026)",
            "Governing bodies — USA Pickleball (official rules), International Federation of Pickleball (IFP), PPA Tour (pro circuit)",
            "PPA Tour Asia — official Asian expansion, with tournaments in Vietnam, Thailand, Philippines, Singapore"
          ]
        },
        {
          heading: "Court, Net, and Equipment",
          content: "The court is 44 ft long and 20 ft wide (13.41 × 6.10 m) for both singles and doubles. The Non-Volley Zone (kitchen) extends 7 ft from the net on each side. Net height is 34 in (0.86 m) at the center and 36 in (0.91 m) at the posts.",
          listItems: [
            "Court length — 44 ft (13.41 m)",
            "Court width — 20 ft (6.10 m) for both singles and doubles",
            "Non-Volley Zone (kitchen) — 7 ft × 20 ft (2.13 × 6.10 m) each side",
            "Net height at center — 34 in (0.86 m)",
            "Net height at posts — 36 in (0.91 m)",
            "Paddle — composite, graphite, or fiberglass. Combined length + width max 24 in (61 cm). Most paddles weigh 210–240 g.",
            "Ball — hard plastic with perforations. Outdoor balls have 40 holes (heavier); indoor balls have 26 holes (softer)."
          ]
        },
        {
          heading: "Serving Rules",
          content: "The serve has the most rules for beginners to remember. Serves must go diagonally into the opposite service box, land beyond the kitchen line, and be made from behind the baseline.",
          listItems: [
            "Serve must be below waist level (upward arc motion).",
            "Paddle head must be below the wrist at contact.",
            "Serve diagonally to the opposite service box.",
            "Ball must clear the kitchen and land in the opposite service box — kitchen line is out for serves.",
            "Server's feet must be behind the baseline and within the imaginary extensions of the sidelines and center line.",
            "Volley serve — toss the ball, strike mid-air. Paddle below wrist required.",
            "Drop serve — let the ball drop naturally, hit after it bounces. No below-wrist requirement for drop serves.",
            "Ball hits net and lands in-bounds = live ball (no 'let' serves since 2021).",
            "Foot fault — any contact with the court before contact is an illegal serve."
          ]
        },
        {
          heading: "The Two-Bounce Rule",
          content: "This is the rule that defines pickleball's tactical flow. After the serve, the receiving team must let the ball bounce once before returning. Then the serving team must also let the ball bounce once before returning. After those two bounces, either team may volley (hit before the bounce). The rule prevents the serving team from rushing the net and smashing every third shot.",
          orderedList: [
            "Team A serves → ball crosses net → bounces once on Team B's side.",
            "Team B returns (must let it bounce) → ball crosses net → bounces once on Team A's side.",
            "From the third shot onward, either team may volley or hit off the bounce."
          ]
        },
        {
          heading: "The Kitchen (Non-Volley Zone)",
          content: "The 'kitchen' is the 7-foot zone extending from the net on both sides. Officially called the Non-Volley Zone (NVZ) because you cannot volley while standing in it — or while touching any part of its line. If the ball bounces in the kitchen, you may enter it to hit, then leave. Momentum carrying you into the kitchen after a volley = fault.",
          listItems: [
            "Stand outside kitchen, volley, momentum carries foot into kitchen → fault.",
            "Ball bounces in kitchen, you step in to dink → legal.",
            "Paddle or hat flies into kitchen during a volley → fault (anything attached to or worn by you counts).",
            "Jump to volley from outside, land inside kitchen → fault.",
            "Strategy — most rallies happen at the kitchen line. The team that gets there first usually wins the point. The dink is the foundational shot that forces opponents to hit up."
          ]
        },
        {
          heading: "Scoring — The Short Version",
          content: "Only the serving team scores. Games are played to 11 points, win by 2 (tournaments may play to 15 or 21). In doubles, call the score as server's score — receiver's score — server number (1 or 2). Example: '4-2-1' means serving team has 4, receiving has 2, and it's the first server. When the serving team loses a rally, it's a side-out and the serve transfers. Full breakdown in the dedicated guide.",
          internalLinks: [
            { text: "Full Pickleball Scoring Explained", path: "/blog/pickleball-scoring-rules-guide" }
          ]
        },
        {
          heading: "Faults — When the Rally Ends",
          content: "A fault ends the rally. Side-out or opponents score, depending on who served.",
          orderedList: [
            "Illegal serve (waist height, paddle above wrist, foot fault, wrong box).",
            "Ball lands out of bounds.",
            "Ball doesn't clear the net, or hits the net and falls on your side.",
            "Volleying while in the kitchen (or touching its line).",
            "Double-hit with intent (accidental double contact in one swing is legal).",
            "Ball touches you (other than the paddle or paddle-hand) before crossing the net.",
            "Violating the two-bounce rule.",
            "Foot fault on serve.",
            "Catching or carrying the ball on the paddle."
          ]
        },
        {
          heading: "Doubles vs Singles",
          content: "The big differences are serving rotation and court position. In doubles, both partners serve in rotation until side-out. In singles, one server serves from the right court when their score is even (0, 2, 4…) and from the left when odd (1, 3, 5…).",
          listItems: [
            "Doubles — both partners serve in rotation; server switches sides (left/right) after each point their team scores. First serve of the match is an exception: only server 2 of the first team serves before side-out.",
            "Singles — one server, one receiver. Even score = serve from right. Odd score = serve from left. Side-out transfers serve directly to opponent."
          ]
        },
        {
          heading: "Timeouts and Medical Stoppages",
          content: "Tournament timeout rules matter — especially during heated knockout matches.",
          listItems: [
            "Standard timeout — 2 per team per game, 1 minute each.",
            "Medical timeout — 15 minutes. Requires referee verification.",
            "Between games — 2 minutes rest.",
            "Between games 2 and 3 — 2 minutes rest."
          ]
        },
        {
          heading: "Asia's 5 Most-Disputed Calls — and How to Settle Them",
          content: "From covering PPA Tour Asia and hundreds of local Vietnamese tournaments through ThePickleHub, we've tracked the calls that most often start arguments. Here's how each one actually resolves by the book.",
          orderedList: [
            "'Did their foot touch the kitchen line?' — The kitchen line is part of the kitchen. Any contact during a volley = fault. Ask for a self-call; if it's refereed, the referee decides. If neither, replay the point — both teams can agree under Rule 6.D.1.",
            "'The ball hit their hand — point to us, right?' — It depends on where. The hand from wrist down to fingertips, while holding the paddle, is considered part of the paddle. Ball hitting that area = legal hit. Ball hitting the forearm, body, or non-paddle hand = fault for the team that got hit.",
            "'The serve clipped the net and dropped in — do we replay?' — No. As of 2021 there is no 'let' on serves. If the ball lands in the correct service box without touching the kitchen, play continues.",
            "'Wrong score was called — do we replay the point?' — If the score was wrong but the rally already happened, the rally result stands; correct the score before next serve. If the wrong server or wrong side was used: if caught before the next serve, replay the point; if caught after, the game continues as if it were correct.",
            "'The ball landed right on the line — in or out?' — On the line = in. Exception: on the kitchen line during a serve = fault (kitchen line counts as kitchen for serves). For all other lines, any part of the ball touching the line = in bounds."
          ]
        },
        {
          heading: "Downloads, References, and Tools",
          content: "For tournament organizers and referees, having a digital scoring tool removes most of the 'Asia's disputed calls' problem — score disputes and server-number confusion vanish when the score is projected on every phone at the court.",
          internalLinks: [
            { text: "Free Pickleball Scoring Tool (Quick Tables)", path: "/tools/quick-tables" },
            { text: "How to Organize a Pickleball Tournament", path: "/blog/how-to-organize-pickleball-tournament" },
            { text: "Pickleball Scoring Rules Explained", path: "/blog/pickleball-scoring-rules-guide" },
            { text: "Luật Pickleball cơ bản (Vietnamese)", path: "/vi/blog/luat-pickleball-co-ban" }
          ]
        }
      ],
      faqItems: [
        { question: "Is the kitchen line part of the kitchen?", answer: "Yes. The kitchen line counts as kitchen. Touching any part of the line during a volley — with your foot, paddle, or anything attached to you — is a fault." },
        { question: "Is there still a 'let' serve in pickleball in 2026?", answer: "No. As of 2021, serves that clip the net and land in the correct service box are live balls. Play continues." },
        { question: "Do you have to keep your paddle below your wrist on the serve?", answer: "Only on the traditional volley serve. The drop serve — where you let the ball bounce before striking — has no below-wrist requirement." },
        { question: "What happens if I call the score wrong during a match?", answer: "If the score itself is wrong but the rally already happened, the rally result stands; correct the score before the next serve. If the wrong server or wrong side was used and caught before the next serve, replay the point." },
        { question: "Is a ball on the sideline in or out?", answer: "In. Any part of the ball touching the line counts as in bounds — except on the kitchen line during a serve, where it's a fault." },
        { question: "How long is a standard pickleball timeout?", answer: "One minute. Each team gets two standard timeouts per game. Medical timeouts are 15 minutes and require referee verification." }
      ]
    },
    vi: {
      title: "Luật Pickleball 2026 — Hướng dẫn đầy đủ (kèm 5 tình huống tranh cãi nhất ở châu Á)",
      metaTitle: "Luật Pickleball 2026 | Hướng dẫn đầy đủ và 5 tình huống tranh cãi nhất ở châu Á",
      metaDescription: "Luật Pickleball 2026 đầy đủ: giao bóng, luật hai lần nảy, kitchen/NVZ, tính điểm, lỗi. Kèm 5 tình huống gây tranh cãi nhất ở các giải châu Á và cách xử lý đúng luật.",
      sections: [
        {
          heading: "Vì sao cần thêm một hướng dẫn Luật Pickleball nữa?",
          content: "Pickleball bùng nổ khắp châu Á. Riêng Việt Nam đã tăng từ vài nghìn người chơi năm 2023 lên hơn 500.000 vào đầu 2026. PPA Tour Asia đã tổ chức giải chuyên nghiệp tại Hà Nội, Bangkok, Singapore, Manila. Nhưng hầu hết rulebook tiếng Anh viết cho người Mỹ, và những tình huống gây tranh cãi ở giải châu Á — đặc biệt quanh luật kitchen và cơ chế giao bóng — cần giải thích rõ ràng hơn. Bài này tổng hợp luật 2026, kết thúc bằng 5 tình huống tranh cãi nhất ở PPA Tour Asia và cách xử lý đúng luật.",
          internalLinks: [
            { text: "Luật Pickleball cơ bản (chi tiết tiếng Việt)", path: "/vi/blog/luat-pickleball-co-ban" }
          ]
        },
        {
          heading: "Pickleball là gì?",
          content: "Pickleball là môn thể thao paddle kết hợp yếu tố của tennis, cầu lông và bóng bàn. Chơi bằng vợt đặc và bóng nhựa có lỗ trên sân bằng khoảng 1/4 sân tennis, lưới thấp hơn lưới tennis một chút.",
          listItems: [
            "Khai sinh — 1965, đảo Bainbridge, Washington, Mỹ",
            "Người chơi ở Mỹ — 13+ triệu (2025)",
            "Người chơi ở châu Á — ước tính 2+ triệu khắp Việt Nam, Thái Lan, Singapore, Ấn Độ, Đông Nam Á (đầu 2026)",
            "Cơ quan quản lý — USA Pickleball (luật chính thức), IFP, PPA Tour (giải chuyên nghiệp)",
            "PPA Tour Asia — mở rộng chính thức sang châu Á, có giải tại Việt Nam, Thái Lan, Philippines, Singapore"
          ]
        },
        {
          heading: "Sân, lưới, và dụng cụ",
          content: "Sân dài 44 ft (13,41 m), rộng 20 ft (6,10 m) cho cả đơn và đôi. Non-Volley Zone (kitchen) dài 7 ft mỗi bên lưới. Lưới cao 34 in (0,86 m) ở giữa và 36 in (0,91 m) ở cột.",
          listItems: [
            "Chiều dài sân — 44 ft (13,41 m)",
            "Chiều rộng sân — 20 ft (6,10 m) cho cả đơn và đôi",
            "Non-Volley Zone (kitchen) — 7 ft × 20 ft (2,13 × 6,10 m) mỗi bên",
            "Độ cao lưới giữa — 34 in (0,86 m)",
            "Độ cao lưới ở cột — 36 in (0,91 m)",
            "Vợt — composite, graphite, hoặc sợi thủy tinh. Tổng dài + rộng tối đa 24 in (61 cm). Thường nặng 210–240 g.",
            "Bóng — nhựa cứng có lỗ. Bóng ngoài trời có 40 lỗ (nặng hơn); bóng trong nhà có 26 lỗ (mềm hơn)."
          ]
        },
        {
          heading: "Luật giao bóng",
          content: "Giao bóng có nhiều luật nhất mà người mới phải nhớ. Bóng giao phải đi chéo sang ô nhận đối diện, rơi quá vạch kitchen, và thực hiện từ sau vạch cuối sân.",
          listItems: [
            "Bóng giao phải dưới thắt lưng (đánh lên vòng cung).",
            "Đầu vợt phải dưới cổ tay khi tiếp xúc.",
            "Giao chéo sang ô nhận đối diện.",
            "Bóng phải vượt qua kitchen và rơi trong ô nhận — vạch kitchen là out khi giao.",
            "Chân phải ở sau vạch cuối sân và trong phần mở rộng tưởng tượng của vạch biên và vạch giữa.",
            "Volley serve — tung bóng, đánh trên không. Vợt phải dưới cổ tay.",
            "Drop serve — thả bóng tự nhiên, đánh sau khi nảy. Không bắt buộc vợt dưới cổ tay.",
            "Bóng chạm lưới và rơi vào ô đúng = bóng sống (không còn 'let' từ 2021).",
            "Foot fault — chân chạm sân trước khi tiếp xúc bóng là giao không hợp lệ."
          ]
        },
        {
          heading: "Luật hai lần nảy",
          content: "Luật định hình lối chơi của pickleball. Sau giao bóng, đội nhận phải để bóng nảy một lần rồi mới đánh trả. Sau đó, đội giao cũng phải để bóng nảy một lần. Từ cú đánh thứ ba trở đi, hai đội có thể volley (đánh trước khi bóng nảy). Luật này ngăn đội giao lao lên lưới smash mỗi quả thứ ba.",
          orderedList: [
            "Đội A giao → bóng qua lưới → nảy một lần bên đội B.",
            "Đội B đánh trả (phải để bóng nảy) → bóng qua lưới → nảy một lần bên đội A.",
            "Từ cú thứ ba trở đi, hai đội có thể volley hoặc đánh sau khi bóng nảy."
          ]
        },
        {
          heading: "Kitchen (Non-Volley Zone)",
          content: "'Kitchen' là vùng 7 ft tính từ lưới ra hai bên. Tên chính thức là Non-Volley Zone (NVZ) vì bạn không được volley khi đứng trong đó — hoặc khi chân chạm bất kỳ phần nào của vạch kitchen. Nếu bóng nảy trong kitchen, bạn được vào để đánh, sau đó ra. Đà người đẩy bạn vào kitchen sau volley = lỗi.",
          listItems: [
            "Đứng ngoài kitchen, volley, đà đẩy chân vào kitchen → lỗi.",
            "Bóng nảy trong kitchen, bạn bước vào dink → hợp lệ.",
            "Vợt hoặc mũ rơi vào kitchen khi volley → lỗi (mọi thứ gắn/mang trên người đều tính).",
            "Nhảy volley từ ngoài, tiếp đất trong kitchen → lỗi.",
            "Chiến thuật — hầu hết rally diễn ra tại vạch kitchen. Đội lên vạch trước thường thắng điểm. Dink là cú đánh nền tảng buộc đối thủ phải đánh lên."
          ]
        },
        {
          heading: "Tính điểm — phiên bản ngắn",
          content: "Chỉ đội giao bóng được điểm. Trận chơi đến 11 điểm, thắng cách 2 (giải có thể chơi đến 15 hoặc 21). Trong đôi, đọc điểm theo thứ tự: điểm đội giao — điểm đội nhận — số người giao (1 hoặc 2). Ví dụ '4-2-1' nghĩa là đội giao 4, đội nhận 2, người giao thứ nhất. Khi đội giao thua rally là side-out, giao chuyển sang đối thủ.",
          internalLinks: [
            { text: "Luật tính điểm Pickleball đầy đủ (tiếng Anh)", path: "/blog/pickleball-scoring-rules-guide" }
          ]
        },
        {
          heading: "Các lỗi kết thúc rally",
          content: "Lỗi kết thúc rally. Side-out hoặc đối thủ được điểm, tùy bên nào đang giao.",
          orderedList: [
            "Giao bóng không hợp lệ (cao quá thắt lưng, vợt trên cổ tay, foot fault, sai ô).",
            "Bóng rơi ngoài sân.",
            "Bóng không qua lưới, hoặc chạm lưới rồi rơi bên sân mình.",
            "Volley khi đứng trong kitchen (hoặc chạm vạch kitchen).",
            "Đánh hai lần có chủ ý (chạm hai lần trong một động tác swing là hợp lệ).",
            "Bóng chạm người (ngoài vợt và tay cầm vợt) trước khi qua lưới.",
            "Vi phạm luật hai lần nảy.",
            "Foot fault khi giao.",
            "Bắt hoặc 'gánh' bóng trên vợt."
          ]
        },
        {
          heading: "Đôi vs Đơn",
          content: "Khác biệt lớn nhất là luân phiên giao bóng và vị trí sân. Trong đôi, cả hai đối tác luân phiên giao cho đến khi side-out. Trong đơn, một người giao từ ô phải khi điểm chẵn (0, 2, 4…) và ô trái khi lẻ (1, 3, 5…).",
          listItems: [
            "Đôi — cả hai đối tác luân phiên giao; người giao đổi bên (trái/phải) sau mỗi điểm đội ghi được. Ngoại lệ: đầu trận, chỉ người giao thứ 2 của đội đầu giao trước side-out.",
            "Đơn — một người giao, một người nhận. Điểm chẵn = giao từ bên phải. Điểm lẻ = giao từ bên trái. Side-out chuyển giao trực tiếp sang đối thủ."
          ]
        },
        {
          heading: "Timeout và dừng y tế",
          content: "Luật timeout giải đấu rất quan trọng — nhất là trong các trận loại trực tiếp căng thẳng.",
          listItems: [
            "Timeout tiêu chuẩn — 2 lượt mỗi đội mỗi trận, mỗi lượt 1 phút.",
            "Timeout y tế — 15 phút. Cần trọng tài xác nhận.",
            "Giữa hai ván — 2 phút nghỉ.",
            "Giữa ván 2 và 3 — 2 phút nghỉ."
          ]
        },
        {
          heading: "5 tình huống tranh cãi nhất ở châu Á — và cách xử lý đúng luật",
          content: "Từ việc theo dõi PPA Tour Asia và hàng trăm giải đấu địa phương Việt Nam qua ThePickleHub, chúng tôi đã ghi lại các tình huống gây tranh cãi nhiều nhất. Đây là cách mỗi tình huống được xử lý đúng luật.",
          orderedList: [
            "'Chân họ có chạm vạch kitchen không?' — Vạch kitchen là một phần của kitchen. Chạm vạch khi volley = lỗi. Hỏi đối thủ tự gọi (pickleball đề cao sự trung thực); nếu có trọng tài, trọng tài quyết. Nếu không có cả hai, replay điểm — hai đội có thể thỏa thuận theo Rule 6.D.1.",
            "'Bóng chạm tay họ — điểm cho mình đúng không?' — Tùy vị trí. Tay từ cổ tay đến đầu ngón, khi đang cầm vợt, được coi là một phần của vợt. Bóng chạm vùng đó = hợp lệ. Bóng chạm cẳng tay, thân, hoặc tay không cầm vợt = lỗi cho đội bị trúng.",
            "'Bóng giao cọ lưới rồi rơi vào ô — replay không?' — Không. Từ 2021 không còn 'let' khi giao. Nếu bóng rơi đúng ô nhận và không chạm kitchen, tiếp tục chơi.",
            "'Đọc sai điểm — có replay điểm không?' — Nếu điểm đọc sai nhưng rally đã xảy ra, kết quả rally giữ nguyên, chỉnh điểm trước lần giao tiếp theo. Nếu sai người giao hoặc sai bên: phát hiện trước lần giao tiếp theo thì replay; phát hiện sau thì trận tiếp tục như bình thường.",
            "'Bóng rơi đúng vạch — trong hay ngoài?' — Trên vạch = trong. Ngoại lệ: trên vạch kitchen khi giao = lỗi (vạch kitchen tính là kitchen khi giao). Các vạch khác, bất kỳ phần nào của bóng chạm vạch = trong sân."
          ]
        },
        {
          heading: "Tải xuống, tham chiếu và công cụ",
          content: "Với BTC giải đấu và trọng tài, một công cụ chấm điểm số loại bỏ hầu hết tranh cãi ở châu Á — các câu hỏi về số điểm và số người giao biến mất khi điểm được chiếu lên mọi điện thoại ngoài sân.",
          internalLinks: [
            { text: "Công cụ chấm điểm Pickleball miễn phí (Quick Tables)", path: "/tools/quick-tables" },
            { text: "Hướng dẫn tổ chức giải Pickleball (tiếng Anh)", path: "/blog/how-to-organize-pickleball-tournament" },
            { text: "Luật tính điểm Pickleball (tiếng Anh)", path: "/blog/pickleball-scoring-rules-guide" },
            { text: "Luật Pickleball cơ bản (tiếng Việt)", path: "/vi/blog/luat-pickleball-co-ban" }
          ]
        }
      ],
      faqItems: [
        { question: "Vạch kitchen có tính là kitchen không?", answer: "Có. Vạch kitchen tính là một phần của kitchen. Chạm vạch khi volley — bằng chân, vợt, hay bất kỳ thứ gì gắn trên người — đều là lỗi." },
        { question: "Năm 2026 còn 'let' khi giao bóng không?", answer: "Không. Từ 2021, bóng giao cọ lưới và rơi đúng ô nhận vẫn là bóng sống. Trận tiếp tục." },
        { question: "Có bắt buộc giữ vợt dưới cổ tay khi giao không?", answer: "Chỉ khi volley serve truyền thống. Drop serve — thả bóng nảy rồi đánh — không yêu cầu vợt dưới cổ tay." },
        { question: "Nếu đọc sai điểm giữa trận thì sao?", answer: "Nếu điểm sai nhưng rally đã xong, kết quả rally giữ nguyên, chỉnh điểm trước lần giao tiếp theo. Nếu sai người giao hoặc sai bên và phát hiện trước lần giao tiếp theo, replay điểm." },
        { question: "Bóng trên vạch biên là trong hay ngoài?", answer: "Trong. Bất kỳ phần nào của bóng chạm vạch đều tính là trong sân — trừ vạch kitchen khi giao bóng, khi đó tính là lỗi." },
        { question: "Timeout pickleball tiêu chuẩn bao lâu?", answer: "Một phút. Mỗi đội có 2 timeout tiêu chuẩn mỗi ván. Timeout y tế là 15 phút và cần trọng tài xác nhận." }
      ]
    }
  }
};

export default post;
