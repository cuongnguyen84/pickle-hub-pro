import type { BlogPost } from "@/content/blog/types";

/**
 * Beginner "how to play pickleball" guide — gear, grip, six core shots,
 * 7-day practice plan, doubles strategy basics, and finding partners
 * (Asia-focused). Written from teaching 200+ Vietnamese players in
 * Hanoi and HCMC.
 *
 * Pairs with VI post `cach-choi-pickleball-cho-nguoi-moi` via
 * `alternate_en_slug` column on Supabase `vi_blog_posts`. See
 * `growth-tasks/blog-drafts/en-how-to-play-pickleball.md` for source.
 */
const post: BlogPost = {
  slug: "how-to-play-pickleball",
  publishedDate: "2026-04-26",
  updatedDate: "2026-04-26",
  author: "Cuong Nguyen",
  tags: ["how to play pickleball", "beginner", "pickleball technique", "dink", "third shot drop", "asia"],
  ctaPath: "/tools/quick-tables",
  ctaLabel: { en: "Run Your First Game", vi: "Chấm điểm trận đầu tiên" },
  heroImage: {
    src: "/images/blog/how-to-play-pickleball-hero.webp",
    alt: "How to play pickleball — beginner-friendly 7-day plan covering gear, grip, six core shots, and doubles strategy, taught to 200+ Vietnamese players in Hanoi and Ho Chi Minh City"
  },
  content: {
    en: {
      title: "How to Play Pickleball: 7-Day Beginner Plan (Tested with 200+ Players in Vietnam)",
      metaTitle: "How to Play Pickleball | 7-Day Beginner Plan Tested in Vietnam",
      metaDescription: "How to play pickleball as a beginner: gear to buy, correct grip, 6 core shots, and a 7-day practice plan that took 200+ Vietnamese players from zero to playing their first real match.",
      sections: [
        {
          heading: "Why this guide is different",
          content: "Most 'how to play pickleball' guides are written from a US perspective, for players who can find a coach on every corner and already have friends playing. This one is different. We've personally taught over 200 Vietnamese players the fundamentals through ThePickleHub's community events in Hanoi and Ho Chi Minh City. The average player — with no racket-sport background — went from never touching a paddle to playing a real doubles match in about 7 days, roughly 8 hours of practice total. This is the exact plan."
        },
        {
          heading: "What you'll learn",
          content: "Seven sections, designed to be read in order:",
          orderedList: [
            "Gear checklist — what to buy first",
            "How to hold the paddle",
            "The six shots you must learn",
            "The 7-day practice plan",
            "Doubles strategy basics",
            "Five mistakes beginners make",
            "Finding courts and partners (especially in Asia)"
          ]
        },
        {
          heading: "1. Gear checklist — what to buy first",
          content: "Don't overspend on your first setup. Here's the minimum you need to start playing well. Paddle (US$20–60): fiberglass or composite, 7.4–8.2 oz (210–230 g), medium face. Popular dependable models in Asia include JOOLA Ben Johns Hyperion, Selkirk Luxx, Gamma Fusion, and Joola Perseus. Avoid anything under US$15 — too light and breaks fast. Avoid heavy paddles over 8.5 oz — fatigue kills your control. Balls (US$1–2 each): Franklin X-40 or Onix Dura Fast 40 outdoors, Onix Fuse Indoor for inside courts. Buy 6–10 — outdoor balls crack easily in hot, humid Asian summers. Shoes (US$40–80): required, not optional. Running shoes have no lateral support and you will roll an ankle. Use pickleball-specific or tennis shoes only — ASICS Gel-Court, K-Swiss Hypercourt Express, Skechers Viper Court are reliable picks. Optional extras: ball hopper or tube (~US$5), wrist or knee support if you're over 35 (US$3–10), sports towel. Minimum starter budget: about US$70–100 for paddle, 10 balls, and decent shoes."
        },
        {
          heading: "2. How to hold the paddle",
          content: "Three common grips exist in pickleball; start with the Continental grip. Place your palm along the edge of the paddle as if shaking hands with it. Your thumb and index finger form a 'V' on the top of the grip handle, and your pinky rests at the end with no tight squeeze. Why Continental: no grip change is needed between forehand and backhand. In pickleball doubles where most of the rally is dinking at the kitchen line, there's no time to switch grips. Grip check: paddle held firmly by thumb plus index plus middle finger; ring and pinky just rest on the handle. Grip pressure should sit around 4 out of 10 — too tight and you lose feel, too loose and the paddle flies."
        },
        {
          heading: "3. The six shots you must learn",
          content: "These six shots cover roughly 95% of every rally you'll play. Master them in order — each one builds on the last.",
          orderedList: [
            "Serve (drop serve recommended) — stand behind the baseline, feet angled 45° to the net. Drop the ball naturally on your side of the court. After it bounces, swing upward and strike diagonally into the opposite service box. Common mistake: swinging too hard. Start soft.",
            "Return of serve — stand about a meter behind the baseline (serves tend to land deep). Let the ball bounce (two-bounce rule). Return high and deep, ideally near the opponent's baseline. Then run up to the kitchen line immediately.",
            "Third shot drop — the most important shot in pickleball, also the hardest. After your serve and their return, you're hitting the third shot. Goal: softly drop the ball into your opponent's kitchen so they have to hit up. That gives you time to approach the kitchen line. Technique: low paddle, face slightly open, soft touch from shoulder and elbow — no wrist.",
            "Dink — a soft shot landing in the opponent's kitchen when both teams are already at the kitchen line. Both feet just behind the kitchen line (not in it), paddle in front of your body around chest height. Almost 'block' the ball, push it gently over the net. Target: low, soft, cross-court.",
            "Volley — hitting the ball out of the air before it bounces. Only legal when you are outside the kitchen. Paddle up at chest height in ready position. Short punch with wrist and elbow — no big swing. Target: feet of opponents or the gap between them.",
            "Overhead smash — when your opponent pops the ball up high, you attack downward. Paddle up behind your head, step back slightly with the dominant-side foot. Strike downward at a 30–45° angle, targeting feet or open space."
          ]
        },
        {
          heading: "4. The 7-day practice plan",
          content: "Eight hours total spread across a week. Each day builds on the previous one — don't skip ahead. Day 1 (60 min): grip practice and paddle familiarity (15 min); 200 forehands and 200 backhands against a wall (20 min); drop-serve motion practice with no target yet (15 min); read the rules (10 min). Day 2 (75 min): drop serves into the court targeting 10/10 in the correct box (30 min); partner serve and return practice, 50 reps each (30 min); short game to 5 (15 min). Day 3 (75 min): third-shot drop drilling — partner feeds gentle balls from the kitchen line, you drop into their kitchen, no ball over their head (30 min); combine serve, return, and third-shot drop, 50 reps (30 min); real game to 7 (15 min). Day 4 (75 min): dink game only — both at the kitchen line, sustain 20-shot rallies, then 30, then 50 (45 min); real game forcing yourself to dink only, no smashing — learn patience (30 min). Day 5 (75 min): volleys at the kitchen line with partner feeds (20 min); overhead smashes (20 min); real game to 11 using everything (35 min). Day 6 (75 min): read Section 5 below (20 min); 2–3 real doubles games applying strategy — always approach after the third shot, stay parallel with partner, attack the middle (55 min). Day 7 (90 min): play 3–4 full doubles games with friends. Record video if possible and review for mistakes. Self-assess: can you play a full match now? What's left to work on?",
          internalLinks: [
            { text: "Pickleball Rules 2026 — complete guide", path: "/blog/pickleball-rules-complete-guide" }
          ]
        },
        {
          heading: "5. Doubles strategy basics",
          content: "Six rules cover most of competitive doubles play.",
          orderedList: [
            "Get to the kitchen line fast. After your third shot, both partners should be at the kitchen line. The team that holds the kitchen line wins most rallies.",
            "Attack the middle. Partners hesitate about who's taking the ball. Middle shots create confusion.",
            "Target their feet. Low shots at the feet are the hardest to return.",
            "Be patient — dink more than you smash. Wait for a ball that pops up before attacking.",
            "Communicate. Call 'yours' or 'mine' on every shot. No silence — and no two players going for the same ball.",
            "Stack if one of you has a clear forehand or backhand preference. (Advanced — learn this later.)"
          ],
          internalLinks: [
            { text: "Pickleball Doubles Strategy — full guide for competitive players", path: "/blog/pickleball-doubles-strategy-guide" }
          ]
        },
        {
          heading: "6. Five mistakes beginners make",
          content: "Watch out for these — they cost more matches than any technical flaw.",
          orderedList: [
            "Staying at the baseline. Beginners stay back because smashes at the kitchen line scare them. But you lose from the baseline. You must get to the kitchen line after the third shot.",
            "Hitting too hard. Pickleball is not tennis. Control beats power. A soft, well-placed shot beats a fast, inaccurate one. Hard shots that go out are self-inflicted points.",
            "Wristy shots. Dinks and drops need shoulder and elbow — no wrist. Wrist shots lack consistency and fly long.",
            "Ignoring the two-bounce rule. Beginners often volley the return of serve — automatic fault. Memorize: both teams must let the first two balls bounce.",
            "Gripping too tight. Tight grip equals tense forearm equals no feel. Grip pressure 4/10. Only firm up on a smash."
          ],
          internalLinks: [
            { text: "Pickleball Scoring Rules — keep score during your first match", path: "/blog/pickleball-scoring-rules-guide" }
          ]
        },
        {
          heading: "7. Finding courts and partners",
          content: "Asia is the fastest-growing pickleball region in the world right now. In Vietnam look for clubs in Hanoi (My Dinh, Cau Giay, Long Bien districts), Ho Chi Minh City (D1, D7, Thu Duc), Da Nang, and Nha Trang — dozens open monthly. Thailand is second, with Bangkok, Phuket, and Chiang Mai growing fastest. Singapore has several dedicated indoor clubs and is highly organized. The Philippines, Malaysia, and Indonesia are emerging — join local Facebook groups. Global tools: ThePickleHub Forum is the best place to find partners and clubs in Asia. Pickleheads.com has strong US coverage but limited Asia. Facebook Groups by city or region are essential. Meetup is useful in big cities outside Asia. First time at a club: arrive 15 minutes early to warm up, introduce yourself with 'I'm a beginner — happy to learn.' Pickleball communities are famously friendly and the culture welcomes new players everywhere.",
          internalLinks: [
            { text: "Tournament Organizer Hub — once you're ready to run your own event", path: "/blog/tournament-organizer-hub" },
            { text: "PPA Tour Asia 2026 — pro events to watch and learn from", path: "/blog/ppa-tour-asia-2026-complete-guide" },
            { text: "Pickleball World Cup 2026 in Da Nang, Vietnam", path: "/blog/pickleball-world-cup-2026-da-nang" }
          ]
        }
      ],
      faqItems: [
        {
          question: "How long does it take to learn how to play pickleball?",
          answer: "Most adults with no racket-sport background can play a real doubles match after about 7 days and 8 hours of focused practice — that's the timeline this guide is built around. To play competitively at intermediate level expect 3–6 months of regular play (2–3 sessions a week) and to be tournament-ready expect 1–2 years."
        },
        {
          question: "What gear do I need to buy as a complete beginner?",
          answer: "Just three things: a paddle (US$20–60, fiberglass or composite, 7.4–8.2 oz / 210–230 g), 6–10 balls (Franklin X-40 outdoor or Onix Fuse Indoor), and proper court shoes (US$40–80, ASICS Gel-Court / K-Swiss / Skechers — never running shoes). Total starter budget around US$70–100. Section 1 has the full breakdown."
        },
        {
          question: "What's the most important shot to learn first?",
          answer: "The third-shot drop. After serve and return, the third shot decides the rally — a good drop into your opponent's kitchen forces them to hit up and gives you time to approach the kitchen line. It's also the hardest shot to learn, so the 7-day plan dedicates Day 3 entirely to drilling it."
        },
        {
          question: "Why do beginners keep losing even after they learn the shots?",
          answer: "Almost always one of five mistakes covered in Section 6: staying at the baseline, hitting too hard, using wrist instead of shoulder/elbow, forgetting the two-bounce rule, or gripping the paddle too tight. Fix those five and your win rate jumps fast — technique matters less than positioning and discipline at this level."
        },
        {
          question: "Can I play pickleball if I've never played a racket sport?",
          answer: "Yes — that's the typical ThePickleHub student. Pickleball has a much shorter learning curve than tennis or badminton because the court is smaller, the paddle is shorter, and the ball moves slower. Almost everyone we've taught with no racket-sport background plays a real doubles match within 7 days using this exact plan."
        },
        {
          question: "Where can I find courts and partners in Vietnam?",
          answer: "Hanoi (My Dinh, Cau Giay, Long Bien), Ho Chi Minh City (D1, D7, Thu Duc), Da Nang, and Nha Trang all have active clubs opening monthly. Use the ThePickleHub Forum to find partners in your district, or join city-specific Facebook groups like 'Pickleball Hà Nội' and 'Pickleball TP.HCM' — they share open-play schedules and beginner sessions."
        }
      ]
    },
    vi: {
      title: "Cách chơi Pickleball cho người mới: Lộ trình 7 ngày từ 0 đến đánh được",
      metaTitle: "Cách chơi Pickleball cho người mới | Lộ trình 7 ngày từ 0",
      metaDescription: "Hướng dẫn cách chơi Pickleball cho người mới từ A đến Z: dụng cụ cần mua, kỹ thuật cơ bản, lộ trình 7 ngày tập luyện, lỗi thường gặp. Bắt đầu chơi tự tin sau 1 tuần.",
      sections: [
        {
          heading: "Vì sao bài này khác?",
          content: "Bạn nghe bạn bè rủ chơi Pickleball, đã thử một lần và bóng bay lung tung, không biết luật, không biết cầm vợt thế nào. Bài này sẽ giải quyết toàn bộ. Mình đã dạy hơn 200 người ở Hà Nội và TP.HCM bắt đầu chơi Pickleball từ con số 0. Trung bình sau 7 ngày tập (khoảng 8 giờ tổng), ai cũng có thể đánh được một trận đôi hoàn chỉnh, biết cầm vợt đúng, biết dink, biết giao bóng hợp lệ. Đây là lộ trình chính xác."
        },
        {
          heading: "Bạn sẽ học gì",
          content: "Bảy phần, đọc theo thứ tự:",
          orderedList: [
            "Trước khi bắt đầu — cần mua gì",
            "Cầm vợt đúng cách",
            "Kỹ thuật 6 cú đánh cơ bản",
            "Lộ trình 7 ngày tập chi tiết",
            "Chiến thuật cơ bản khi đánh đôi",
            "5 lỗi phổ biến của người mới",
            "Tìm sân và bạn cùng chơi"
          ]
        },
        {
          heading: "1. Trước khi bắt đầu — cần mua gì?",
          content: "Đừng mua đồ cao cấp ngay. Đây là bộ khởi đầu tối thiểu. Vợt (paddle, 400.000 – 1.500.000 VNĐ): chọn fiberglass hoặc composite, nặng 220–230 g, mặt vợt medium. Dòng phổ biến tại Việt Nam: JOOLA Ben Johns Hyperion (cao cấp), Selkirk Luxx, Gamma Fusion, Joola Perseus. Đừng mua paddle rẻ hơn 300.000đ — quá nhẹ và dễ hỏng. Đừng mua paddle quá nặng (>240 g) — mỏi tay, khó kiểm soát. Bóng (ball, ~30.000 VNĐ/quả): ngoài trời dùng Franklin X-40 hoặc Onix Dura Fast 40, trong nhà dùng Onix Fuse Indoor. Mua 6–10 quả vì bóng rất dễ nứt khi chơi ngoài trời nắng nóng. Giày (1.000.000 VNĐ trở lên): bắt buộc mua giày riêng. Giày chạy bộ KHÔNG phù hợp vì không đỡ ngang — rất dễ lật cổ chân. Chọn giày tennis hoặc giày pickleball chuyên dụng — ASICS Gel-Court, K-Swiss Hypercourt Express, Skechers Viper Court. Phụ kiện tuỳ chọn: ống đựng bóng (~100.000đ), băng cổ tay/đầu gối nếu trên 35 tuổi (50.000–200.000đ), khăn thể thao. Tổng chi phí tối thiểu: khoảng 1.700.000đ cho paddle, 10 bóng, giày cơ bản."
        },
        {
          heading: "2. Cầm vợt đúng cách",
          content: "Có 3 kiểu cầm phổ biến, người mới nên bắt đầu với Continental grip. Đặt lòng bàn tay dọc theo cạnh vợt như bắt tay với vợt. Ngón cái và ngón trỏ tạo hình chữ 'V' trên cạnh trên của cán vợt, ngón út ôm nhẹ cuối cán, không siết chặt. Ưu điểm: không cần đổi grip khi đánh forehand hay backhand. Rất phù hợp với đánh đôi pickleball — phần lớn rally là dink ngắn ở kitchen line, đổi grip không kịp. Kiểm tra grip đúng: vợt được giữ chắc bằng ngón cái + ngón trỏ + ngón giữa, ngón áp út và ngón út chỉ ôm nhẹ. Grip không được quá chặt — độ chặt 4/10 là vừa. Chặt quá thì mỏi và thiếu cảm giác."
        },
        {
          heading: "3. Kỹ thuật 6 cú đánh cơ bản",
          content: "6 cú này phủ khoảng 95% mọi rally bạn sẽ chơi. Học theo thứ tự — cú sau dựa vào cú trước.",
          orderedList: [
            "Serve (giao bóng) — dùng drop serve vì dễ hơn. Đứng sau baseline, chân hướng 45 độ với lưới. Cầm bóng bằng tay không thuận, thả bóng tự nhiên xuống đất. Sau khi bóng nảy 1 lần, vung vợt từ dưới lên, đánh chéo sân sang ô nhận. Sai lầm thường gặp: vung vợt quá mạnh — bắt đầu nhẹ thôi.",
            "Return of serve (đánh trả giao bóng) — đứng xa baseline khoảng 1 m vì bóng giao thường bay sâu. Đợi bóng nảy 1 lần (luật 2-bounce). Đánh bóng cao, sâu, đưa về gần baseline đối phương. Sau khi đánh trả, đi lên kitchen line ngay.",
            "Third shot drop (cú thả bóng thứ 3) — quan trọng nhất, khó nhất, cần tập nhiều nhất. Sau giao bóng và đối phương đánh trả, bạn là người đánh cú thứ 3. Mục tiêu: rơi nhẹ vào kitchen đối phương, buộc họ phải đánh bóng từ dưới lên — bạn có cơ hội lên kitchen line. Kỹ thuật: vợt thấp, mặt vợt hơi mở, đánh nhẹ bằng vai và cùi chỏ — KHÔNG dùng cổ tay.",
            "Dink — cú đánh nhẹ, rơi vào kitchen đối phương khi cả 2 đội đã ở kitchen line. Cả 2 chân sát kitchen line nhưng ngoài kitchen, vợt đặt trước mặt hơi ngang ngực. Đón bóng gần như chặn, đẩy nhẹ qua lưới. Mục tiêu: rơi thấp, nhẹ, chéo sân.",
            "Volley — đánh khi bóng còn trong không khí, chưa nảy. Chỉ dùng khi bạn đứng ngoài kitchen. Paddle ngang ngực sẵn sàng, vung ngắn bằng cổ tay và cùi chỏ — không vung lớn. Mục tiêu: chân đối thủ hoặc khoảng giữa 2 người đối phương.",
            "Smash (đánh đập) — khi đối phương đánh bóng nổi cao, bạn đập xuống. Paddle đưa lên cao sau đầu, chân thuận lùi 1 bước để lấy đà. Đánh xuống với góc 30–45 độ, nhắm vào chân đối thủ hoặc khoảng trống."
          ]
        },
        {
          heading: "4. Lộ trình 7 ngày tập chi tiết",
          content: "Tổng 8 giờ chia trong 1 tuần. Mỗi ngày dựa vào ngày trước — đừng nhảy bước. Ngày 1 (60 phút): cầm vợt, tập Continental grip, cảm nhận trọng lượng (15 phút); đánh forehand/backhand vào tường, mỗi bên 200 lần (20 phút); tập tung bóng + drop serve, chỉ tập động tác (15 phút); học luật cơ bản (10 phút). Ngày 2 (75 phút): drop serve vào sân, mục tiêu 10/10 quả rơi vào ô đúng (30 phút); tìm 1 người đánh đôi — bạn giao họ trả, đổi lượt, lặp 50 lần mỗi người (30 phút); ván ngắn đến 5 điểm (15 phút). Ngày 3 (75 phút): đứng baseline, 1 người ở kitchen line đối diện feed bóng nhẹ — bạn tập third shot drop, mục tiêu bóng rơi vào kitchen, không bay cao hơn đầu đối phương (30 phút); kết hợp serve + return + third shot drop, lặp 50 lần (30 phút); ván thực tế đến 7 điểm (15 phút). Ngày 4 (75 phút): cả 2 ở kitchen line, chỉ đánh dink — duy trì rally 20 lần không lỗi, rồi 30 lần, rồi 50 lần (45 phút); ván thực tế nhưng ép mình chỉ dink, không smash — học kiên nhẫn (30 phút). Ngày 5 (75 phút): volley tại kitchen line với partner feed (20 phút); smash bóng nổi cao (20 phút); ván thực tế đến 11 điểm dùng mọi kỹ năng (35 phút). Ngày 6 (75 phút): đọc phần 5 bài này (20 phút); 2–3 ván đôi áp dụng chiến thuật — lên kitchen line sau cú thứ 3, giữ chân song song với partner, đánh vào khoảng giữa 2 người đối phương (55 phút). Ngày 7 (90 phút): tìm 3 người bạn, đánh 3–4 ván đôi thực tế. Quay video nếu có thể, xem lại để sửa lỗi. Tự đánh giá: bạn đã đánh được chưa? Còn lỗi gì cần sửa?",
          internalLinks: [
            { text: "Luật Pickleball 2026 — hướng dẫn đầy đủ", path: "/blog/pickleball-rules-complete-guide" }
          ]
        },
        {
          heading: "5. Chiến thuật cơ bản khi đánh đôi",
          content: "6 nguyên tắc bao quát phần lớn đánh đôi cạnh tranh.",
          orderedList: [
            "Lên kitchen line càng sớm càng tốt. Sau cú thứ 3, cả 2 người phải ở kitchen line. Đội nào giữ kitchen line lâu hơn thường thắng.",
            "Đánh vào giữa 2 người đối phương. Cả 2 thường ngập ngừng không biết ai đánh, dễ thành lỗi.",
            "Đánh vào chân đối thủ. Khó đánh trả nhất là bóng thấp, gần chân.",
            "Kiên nhẫn dink. Đừng smash vội — đợi đối phương đánh bóng nổi cao mới tấn công.",
            "Giao tiếp với partner. Mỗi quả: gọi 'yours' hoặc 'mine'. Tránh cả 2 cùng đánh hoặc cả 2 cùng né.",
            "Stack nếu có người mạnh hơn — cả 2 ở cùng 1 bên sân để người giỏi forehand đứng giữa. (Chiến thuật nâng cao, học sau.)"
          ],
          internalLinks: [
            { text: "Chiến thuật Pickleball đôi — hướng dẫn đầy đủ cho người chơi giải", path: "/blog/pickleball-doubles-strategy-guide" }
          ]
        },
        {
          heading: "6. 5 lỗi phổ biến của người mới",
          content: "Cẩn thận với 5 lỗi này — chúng làm thua nhiều trận hơn bất kỳ lỗi kỹ thuật nào.",
          orderedList: [
            "Đứng sau baseline quá lâu. Người mới ngại lên kitchen line vì sợ bị smash. Nhưng ở baseline bạn sẽ thua. Bắt buộc lên kitchen line sau cú thứ 3.",
            "Dùng lực quá mạnh. Pickleball KHÔNG giống tennis — điều khiển hơn sức mạnh. Đánh nhẹ đặt bóng đúng chỗ thắng đánh mạnh out ngoài.",
            "Dùng cổ tay khi đánh dink/drop. Cần vai và cùi chỏ — không dùng cổ tay. Cổ tay làm thiếu ổn định, hay out.",
            "Không để bóng nảy khi trả giao. Luật 2-bounce — rất nhiều người mới quên và volley ngay cú trả giao, lỗi tự động.",
            "Grip quá chặt. Siết vợt chặt làm cơ tay căng và mất cảm giác. Grip 4/10 là vừa, chỉ siết thêm khi smash."
          ],
          internalLinks: [
            { text: "Luật chấm điểm Pickleball — biết cách giữ tỉ số trận đầu tiên", path: "/blog/pickleball-scoring-rules-guide" }
          ]
        },
        {
          heading: "7. Tìm sân và bạn cùng chơi",
          content: "Tại Việt Nam: Hà Nội có nhiều sân ở Mỹ Đình, Cầu Giấy, Long Biên — CLB như Gladiator Pickleball, VPA Club, Hanoi Pickleball Community. TP.HCM có sân ở Quận 1, Quận 7, Thủ Đức — CLB Saigon Pickleball, PPA Tour Asia Club. Đà Nẵng, Nha Trang, Hải Phòng đang mở sân mới liên tục. Tìm online: ThePickleHub Forum để đăng bài tìm partner và CLB địa phương; Facebook Group 'Pickleball Hà Nội', 'Pickleball TP.HCM', 'Cộng đồng Pickleball Việt Nam'; Zalo Group hỏi tại sân để được add vào. Khi mới vào CLB: đến sớm 15 phút làm quen, nói rõ 'Mình mới chơi, xin học hỏi'. Người Việt chơi Pickleball rất thân thiện — đừng ngại.",
          internalLinks: [
            { text: "Hub tổ chức giải Pickleball — khi đã sẵn sàng tổ chức giải riêng", path: "/blog/tournament-organizer-hub" },
            { text: "PPA Tour Asia 2026 — giải pro nên xem để học", path: "/blog/ppa-tour-asia-2026-complete-guide" },
            { text: "World Cup Pickleball 2026 tại Đà Nẵng", path: "/blog/pickleball-world-cup-2026-da-nang" }
          ]
        }
      ],
      faqItems: [
        {
          question: "Học chơi Pickleball mất bao lâu?",
          answer: "Người lớn không có nền tảng môn vợt nào trung bình đánh được trận đôi hoàn chỉnh sau khoảng 7 ngày, 8 giờ tập trung — đó là khung thời gian bài này được xây dựng quanh. Để đánh được mức trung cấp cần 3–6 tháng chơi đều (2–3 buổi/tuần), để sẵn sàng thi giải cần 1–2 năm."
        },
        {
          question: "Người mới cần mua những gì?",
          answer: "Chỉ 3 thứ: vợt (400.000–1.500.000đ, fiberglass hoặc composite, 220–230 g), 6–10 bóng (Franklin X-40 ngoài trời hoặc Onix Fuse trong nhà), giày sân (1.000.000đ trở lên — ASICS Gel-Court, K-Swiss, Skechers, không bao giờ giày chạy bộ). Tổng tối thiểu khoảng 1.700.000đ. Phần 1 có chi tiết đầy đủ."
        },
        {
          question: "Cú đánh nào quan trọng nhất phải học đầu tiên?",
          answer: "Third shot drop. Sau giao bóng và trả giao bóng, cú thứ 3 quyết định rally — drop tốt vào kitchen đối phương buộc họ đánh từ dưới lên và cho bạn thời gian lên kitchen line. Đây cũng là cú khó nhất nên lộ trình 7 ngày dành nguyên Ngày 3 để drill nó."
        },
        {
          question: "Vì sao người mới hay thua dù đã biết kỹ thuật?",
          answer: "Hầu như luôn là 1 trong 5 lỗi ở Phần 6: đứng sau baseline quá lâu, đánh quá mạnh, dùng cổ tay thay vì vai/cùi chỏ, quên luật 2-bounce, hoặc grip quá chặt. Sửa 5 lỗi này thì tỉ lệ thắng tăng nhanh — ở mức người mới, vị trí và kỷ luật quan trọng hơn kỹ thuật."
        },
        {
          question: "Chưa từng chơi môn vợt nào, có chơi Pickleball được không?",
          answer: "Được — đây là học viên điển hình của ThePickleHub. Pickleball có đường cong học nhanh hơn tennis hoặc cầu lông vì sân nhỏ hơn, vợt ngắn hơn, bóng đi chậm hơn. Hầu hết người mình dạy không có nền tảng môn vợt nào đều đánh được trận đôi thực tế trong 7 ngày theo lộ trình này."
        },
        {
          question: "Tìm sân và partner ở Việt Nam thế nào?",
          answer: "Hà Nội (Mỹ Đình, Cầu Giấy, Long Biên), TP.HCM (Q1, Q7, Thủ Đức), Đà Nẵng và Nha Trang đều có CLB hoạt động và mở mới hàng tháng. Dùng ThePickleHub Forum để tìm partner trong khu vực, hoặc tham gia Facebook Group theo thành phố như 'Pickleball Hà Nội' hay 'Pickleball TP.HCM' — họ chia sẻ lịch open-play và buổi tập cho người mới."
        }
      ]
    }
  }
};

export default post;
