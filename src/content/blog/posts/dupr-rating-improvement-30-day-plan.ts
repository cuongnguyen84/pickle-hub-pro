import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "dupr-rating-improvement-30-day-plan",
  publishedDate: "2026-05-20",
  updatedDate: "2026-05-20",
  author: "Cuong Nguyen",
  tags: [
    "dupr",
    "dupr rating",
    "pickleball rating",
    "training plan",
    "improvement",
    "30 day plan",
    "dupr algorithm",
    "performance vs expectation",
    "vietnam pickleball",
  ],
  ctaPath: "/blog/dupr-algorithm-explained-performance-vs-expectation",
  ctaLabel: {
    en: "Read Part 2: How the DUPR Algorithm Actually Works",
    vi: "Đọc Phần 2: Thuật toán DUPR — thắng mất điểm, thua tăng điểm",
  },
  heroImage: {
    src: "/images/blog/dupr-rating-improvement-30-day-plan-hero.webp",
    alt: "A vertical bar chart showing a DUPR (Dynamic Universal Pickleball Rating) climbing from 3.50 to 4.20 across 30 days, beside a pickleball paddle and DUPR logo, illustrating a realistic week-by-week training plan to improve a pickleball rating.",
  },
  content: {
    en: {
      title:
        "How to Improve Your DUPR Rating: A Realistic 30-Day Plan",
      metaTitle:
        "Improve DUPR Rating in 30 Days | Realistic Training Plan 2026",
      metaDescription:
        "A 30-day plan to raise your DUPR rating: how DUPR's algorithm rewards consistent play, the 4 rules from Part 2, and a week-by-week training schedule.",
      sections: [
        {
          heading: "Why Your DUPR Has Been Stuck for Weeks",
          content:
            "You play three nights a week. You win more than you lose. Yet your DUPR has been parked at 3.42 since January. Sound familiar? The problem is almost never your skill. It is how DUPR's post-July-2025 algorithm reads your matches. DUPR no longer tracks wins and losses directly. It tracks performance against expectation, then applies a reliability weight, then averages with your recent history. Once you understand those three moving parts, the plan to move your rating writes itself.",
          internalLinks: [
            {
              text: "Part 2 of the DUPR series breaks the algorithm down match by match",
              path: "/blog/dupr-algorithm-explained-performance-vs-expectation",
            },
          ],
        },
        {
          heading: "Two Players, Same Month, Opposite Outcomes",
          content:
            "A simple example puts the algorithm on display. Player A goes 12 wins, 4 losses across a month — but every match is against the same two club partners rated 0.2 below them. ΔDUPR after one month: +0.02. Player B goes 6 wins, 10 losses — but most of those matches are against opponents rated 0.4 to 0.7 above them, and the losses are 9-11, not 4-11. ΔDUPR after one month: +0.18. Same calendar, same effort, nine times the rating movement. The 30-day plan below is built around Player B's pattern: harder opponents, smaller margins, no padding the W column with games you were always going to win.",
        },
        {
          heading: "The 4 Rules from Part 2 — Applied as Action",
          content:
            "Part 2 of this series explains why these rules work. This post is about turning them into concrete weekly behavior:",
          orderedList: [
            "Play opponents 0.3 to 0.7 above your DUPR. Expected loss with a small margin moves your rating up more than three blowout wins against weaker players. The sweet spot is half a point above you — high enough to challenge expectation, low enough that 9-11 is achievable.",
            "Mixed doubles raises ceiling faster than men's or women's doubles. The gendered rating gap creates an expectation asymmetry the algorithm doesn't fully neutralize. If you have access to mixed sessions, aim for one out of every three matches in mixed.",
            "Don't sandbag down. Playing weaker opponents has near-zero upside (you were expected to win comfortably) and an asymmetric downside if you drop a game. Either skip the match or treat it as a drill day — practice a specific shot rather than scorekeeping.",
            "Tournament matches weigh roughly twice the value of recreational matches. One sanctioned tournament moves your rating more than two weeks of pickup at the club. If you only have time for one DUPR-priority action per month, it is a tournament — not a higher rec volume.",
          ],
        },
        {
          heading: "Week 1 — Baseline and Opponent Search",
          content:
            "The first week is diagnosis. Most players skip it and wonder why their plan stalls in week 3.",
          listItems: [
            "Days 1-2: Open the DUPR app and log your current rating, reliability score, and the last 10 matches. Note partner DUPR and opponent DUPR for each. Highlight the matches where the spread was inside 0.3 — those are your data points worth repeating.",
            "Days 3-4: Drill days, no scorekeeping. 30 minutes of wall dink, 30 minutes of third-shot drop reps. These two skills separate 3.5 players from 4.0 players more than any other shot.",
            "Days 5-7: Two doubles sessions. Pick a partner roughly 0.2 to 0.4 above you. Decline games where opponents are 0.5 or more below — they actively damage your DUPR trajectory.",
          ],
        },
        {
          heading: "Week 2 — Match Volume and Score Discipline",
          content:
            "Volume only helps if the matches are the right matches. Week 2 trades quantity-against-anyone for quality-against-targets.",
          listItems: [
            "Days 8-10: Three doubles sessions at minimum three games each. Goal: close losses to opponents +0.3, not blowout wins to opponents -0.5. Rule of thumb — if the score is 11-3, you played the wrong opponent.",
            "Days 11-13: Two drill blocks (dink consistency + third-shot drop) plus one mixed-doubles match if available. The drill blocks compound — they raise the floor under your match performance so close losses turn into close wins.",
            "Day 14: Self-review. Open the DUPR app, look at ΔDUPR per match for the past 14 days. If you see a pattern of small positive moves on losses and small negative moves on wins, you are doing this right. If you see large positive moves on wins, you are still beating up on the wrong opponents — stop.",
          ],
        },
        {
          heading: "Week 3 — Tournament Prep",
          content:
            "The single biggest lever in the algorithm is sanctioned-tournament weight. Week 3 is about lining one up.",
          listItems: [
            "Days 15-19: Register for one sanctioned tournament inside the next two weeks. In Vietnam, that means a VFP-listed event, a DUPR Vietnam event run by the TA Pickleball partnership, or any ThePickleHub /tournaments-listed open. Entering one division above your current rating is fine — DUPR doesn't penalize playing up.",
            "Days 20-21: Match practice at tournament pace. Best-of-3 to 11, switch partners between games, simulate the rhythm of a draw. The goal is calibrating to the tempo, not winning the practice session.",
          ],
          internalLinks: [
            {
              text: "DUPR Vietnam partnership now means your local sanctioned matches feed the global rating",
              path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub",
            },
          ],
        },
        {
          heading: "Week 4 — Tournament Weekend and Recovery",
          content:
            "Tournament weekend is where the bulk of your 30-day movement happens. Treat it as the appointment the rest of the plan was building toward.",
          listItems: [
            "Days 22-25: The tournament. Six to ten matches over a weekend at twice the algorithm weight of rec play. Even a 0-3 result against good opponents typically moves DUPR positive if the scores are close.",
            "Days 26-28: Light recovery. Easy dinking, no power drills, no heavy match volume. The algorithm has already digested the tournament — pushing more rec matches now mostly noise.",
            "Days 29-30: Two or three closing mixed-doubles sessions against opponents +0.4 above your current DUPR. Self-rate honestly, check the app, and compare your day-30 DUPR against day-1.",
          ],
        },
        {
          heading: "Realistic Expectations — How Much DUPR Will Move",
          content:
            "Numbers people quote on Facebook are usually outliers. The honest ranges below come from looking at hundreds of public DUPR profiles over a 30-day window with a consistent volume of 12 to 18 matches.",
          listItems: [
            "Current DUPR 3.0 to 3.5: realistic 30-day move = +0.15 to +0.30. Bigger when reliability is still building.",
            "Current DUPR 3.5 to 4.0: realistic 30-day move = +0.08 to +0.20. The middle band is where the algorithm gets sticky — closer scores matter more here.",
            "Current DUPR 4.0+: realistic 30-day move = +0.03 to +0.10. Every 0.05 at this level is meaningful and earned.",
          ],
        },
        {
          heading: "Three Traps That Flatten Your DUPR",
          content:
            "These are the most common reasons a player executes the plan above and still sees flat movement.",
          orderedList: [
            "Sandbagging partners. Always playing with the same 4.2 partner against 3.5 teams looks like wins on paper but signals the algorithm that your rating is partner-dependent. Rotate partners weekly.",
            "Logging only the matches you won. Some apps let you cherry-pick. DUPR assumes a representative sample, and the system can retroactively dampen rating moves when it detects selection bias. Log every match or none — consistency wins.",
            "Skipping tournaments. Rec-only players bump against the reliability ceiling. Without one tournament every four to six weeks, DUPR caps how much it trusts your number, and individual rating moves get smaller and smaller.",
          ],
        },
        {
          heading: "Vietnam-Specific DUPR Play Guide",
          content:
            "Vietnamese pickleball is in its DUPR ramp. As of 2026 there are four practical paths to sanctioned matches in country:",
          listItems: [
            "VFP National Series — the Vietnam Pickleball Federation runs four to six sanctioned stops a year across HCMC, Hanoi, and Da Nang.",
            "TA Pickleball events — the DUPR Vietnam partnership feeds these directly into global ratings. Schedule shifts month to month; check the operator's social channels.",
            "ThePickleHub /tournaments listings — community-organized opens, some DUPR-flagged. The flag in the listing tells you whether results feed the global rating.",
            "Regional Asia stops — Asia Pacific Series and PPA Tour Asia events host VN players who qualify; entries open three to six weeks ahead of each stop.",
          ],
          internalLinks: [
            {
              text: "Start with DUPR's fundamentals — Part 1 covers what the number actually measures",
              path: "/blog/what-is-dupr-pickleball-rating-system",
            },
          ],
        },
        {
          heading: "Drills That Move DUPR (and the Ones That Don't)",
          content:
            "Not every drill compounds at the same rate. The list below is sorted by how often the underlying skill shows up in a moved-rating delta.",
          listItems: [
            "High ROI — Third-shot drop wall reps (15 minutes a session). The single biggest gap between 3.5 and 4.0 players is third-shot quality, and the algorithm rewards close transition games heavily.",
            "High ROI — Dink rallies with a partner, 20-touch minimum. Patience under pressure is what turns 8-11 losses into 11-9 wins.",
            "High ROI — Return-of-serve depth drills off a ball machine. Most rec players return short; a deep return is hidden free expectation upside.",
            "Low ROI — Driving the ball at the wall. Fun, builds confidence, doesn't translate to match swings.",
            "Low ROI — Solo serve practice beyond 10 minutes. Diminishing returns — the serve is the lowest-leverage shot in pickleball.",
            "Low ROI — Footwork ladder work. Useful athletically, but it does not show up in DUPR deltas the way shot drills do.",
          ],
        },
        {
          heading: "Bottom Line",
          content:
            "A 30-day plan does not turn a 3.5 into a 4.5. What it does is move you from the static-bracket cohort to the active-cohort that DUPR reads as moving — and those are two very different rating trajectories over six months. Pick opponents above you. Play one tournament. Keep your match volume at a level you can recover from. Drill the two shots that matter and skip the ones that don't. Then look at the app on day 30 and compare honestly. If the plan worked, you will see it. If it didn't, the report card tells you exactly which lever to pull on the next 30.",
        },
      ],
      faqItems: [
        {
          question: "How fast does DUPR update after a match?",
          answer:
            "Verified matches typically show within 24-48 hours in the DUPR app. Tournament matches uploaded by organizers can take three to seven days depending on how the tournament desk processes results.",
        },
        {
          question: "Will I lose DUPR rating if I take a 30-day break?",
          answer:
            "Your rating itself does not decay automatically, but your reliability score drops. That means once you come back, the first five to eight matches will move your rating a little less than they would have otherwise — until reliability rebuilds.",
        },
        {
          question: "Does ThePickleHub support DUPR for tournament brackets?",
          answer:
            "Yes. Bracket Lab on /tools accepts DUPR ratings as a seeding input for round-robin and single-elim formats, so you can balance brackets by rating instead of guessing.",
        },
        {
          question:
            "Is mixed doubles really better for DUPR than men's or women's doubles?",
          answer:
            "Yes, especially in the 3.5 to 4.5 band. The expectation asymmetry between gendered ratings creates upside the algorithm doesn't fully neutralize. Above 5.0 the effect shrinks because ratings are tighter and matches more predictable.",
        },
        {
          question: "My DUPR went down after a 5-0 weekend — why?",
          answer:
            "Almost always because you played opponents 0.5 or more below your rating and won by small margins. The algorithm expected larger wins, so 11-9 results against weaker players register as underperformance even though the scoreboard says you won every match.",
        },
        {
          question: "Can I improve DUPR without playing tournaments?",
          answer:
            "Yes, but expect roughly half the movement of a player mixing rec play with one tournament every four to six weeks. Without sanctioned matches, your reliability score caps, and individual rating moves get progressively smaller.",
        },
      ],
    },
    vi: {
      title:
        "Tăng điểm DUPR trong 30 ngày: kế hoạch thực tế (không hứa nhanh)",
      metaTitle:
        "Tăng DUPR 30 ngày | Kế hoạch luyện tập thực tế 2026",
      metaDescription:
        "Kế hoạch 30 ngày tăng điểm DUPR thực tế: hiểu thuật toán DUPR, 4 quy tắc từ Phần 2, lịch luyện tập theo tuần, 3 sai lầm cần tránh.",
      sections: [
        {
          heading: "Vì sao điểm DUPR của bạn đứng yên nhiều tuần",
          content:
            "Bạn đánh ba buổi mỗi tuần. Bạn thắng nhiều hơn thua. Vậy mà DUPR vẫn nằm yên ở 3.42 từ tháng 1. Vấn đề gần như không phải ở trình độ. Vấn đề nằm ở cách thuật toán DUPR sau bản vá tháng 7/2025 đọc các trận của bạn. DUPR không còn cộng/trừ điểm theo thắng/thua. Nó so sánh kết quả thực tế với kỳ vọng, cộng thêm trọng số độ tin cậy, rồi tính trung bình với lịch sử gần đây. Hiểu rõ ba bộ phận đó, kế hoạch tăng điểm gần như tự viết ra.",
          internalLinks: [
            {
              text: "Phần 2 của series DUPR mổ xẻ thuật toán từng trận một",
              path: "/blog/dupr-algorithm-explained-performance-vs-expectation",
            },
          ],
        },
        {
          heading: "Hai người chơi, cùng một tháng, kết quả trái ngược",
          content:
            "Một ví dụ đơn giản đủ thấy thuật toán làm việc. Người A đánh 12 thắng — 4 thua trong tháng, nhưng tất cả trận đều với hai bạn chơi quen rating thấp hơn 0.2. ΔDUPR sau 1 tháng: +0.02. Người B đánh 6 thắng — 10 thua, nhưng phần lớn đối thủ cao hơn 0.4 đến 0.7 và các trận thua đều sát điểm 9-11 thay vì 4-11. ΔDUPR sau 1 tháng: +0.18. Cùng một lịch, cùng công sức, di chuyển điểm gấp 9 lần. Kế hoạch 30 ngày dưới đây được dựng quanh mô hình Người B: đối thủ khó hơn, cách biệt nhỏ hơn, không nhồi cột thắng bằng các trận chắc thắng.",
        },
        {
          heading: "4 quy tắc từ Phần 2 — biến thành hành động hàng tuần",
          content:
            "Phần 2 của series giải thích vì sao bốn quy tắc dưới đây hiệu quả. Bài này tập trung biến chúng thành hành vi cụ thể trong từng tuần:",
          orderedList: [
            "Đánh với đối thủ cao hơn DUPR của bạn 0.3 đến 0.7. Thua sát điểm trong khoảng này tăng điểm nhiều hơn ba trận thắng đậm với người yếu hơn. Điểm ngọt là cao hơn nửa điểm — đủ thử thách kỳ vọng, vẫn đủ khả năng giữ tỉ số 9-11.",
            "Đôi nam-nữ đẩy trần điểm nhanh hơn đôi nam hay đôi nữ. Khoảng cách rating theo giới tính tạo bất đối xứng kỳ vọng mà thuật toán không trung hòa hoàn toàn. Nếu có sân đôi nam-nữ, đặt mục tiêu cứ ba trận thì một trận đôi nam-nữ.",
            "Đừng đánh với người yếu hơn rõ rệt. Trận thắng với đối thủ thấp hơn 0.5 gần như không có thưởng (vì kỳ vọng bạn thắng đậm) và rủi ro mất điểm cao nếu lỡ tay thua một game. Nếu phải đánh, hãy coi đó là buổi drill — luyện một cú thay vì bắt điểm.",
            "Trận giải đấu nặng gấp đôi trận giao hữu. Một giải đấu sanctioned di chuyển điểm nhiều hơn hai tuần đánh giao hữu ở CLB. Nếu mỗi tháng chỉ có thời gian cho một việc ưu tiên — hãy là giải đấu, không phải tăng số trận giao hữu.",
          ],
        },
        {
          heading: "Tuần 1 — Chẩn đoán và tìm đối thủ",
          content:
            "Tuần đầu là chẩn đoán. Đa số người chơi bỏ qua bước này rồi tự hỏi vì sao kế hoạch hụt hơi từ tuần 3.",
          listItems: [
            "Ngày 1-2: Mở app DUPR, ghi lại rating hiện tại, reliability score, và 10 trận gần nhất. Note DUPR của partner và đối thủ từng trận. Bôi đậm các trận mà chênh lệch nằm trong 0.3 — đó là dạng trận đáng lặp lại.",
            "Ngày 3-4: Ngày drill, không tính điểm. 30 phút dink tường, 30 phút third-shot drop. Hai cú này tách trình 3.5 khỏi 4.0 hơn bất kỳ cú nào khác.",
            "Ngày 5-7: Hai buổi đánh đôi. Partner cao hơn 0.2 đến 0.4. Từ chối các trận đối thủ thấp hơn 0.5 trở lên — chúng làm hỏng quỹ đạo DUPR.",
          ],
        },
        {
          heading: "Tuần 2 — Số lượng trận và kỷ luật điểm số",
          content:
            "Đánh nhiều chỉ có ích nếu trận đúng loại. Tuần 2 đổi số-lượng-với-ai-cũng-được lấy chất-lượng-với-đối-thủ-đúng-tầm.",
          listItems: [
            "Ngày 8-10: Ba buổi đôi, mỗi buổi ít nhất ba game. Mục tiêu: thua sát với đối thủ +0.3, không phải thắng đậm với đối thủ -0.5. Quy tắc đơn giản — nếu tỉ số là 11-3, bạn đã chọn sai đối thủ.",
            "Ngày 11-13: Hai khối drill (dink + third-shot drop) cộng một trận đôi nam-nữ nếu có. Drill nâng nền tảng, biến trận thua sát thành trận thắng sát.",
            "Ngày 14: Tự đánh giá. Mở app, xem ΔDUPR từng trận 14 ngày qua. Nếu thấy điểm cộng nhỏ ở các trận thua và điểm trừ nhỏ ở các trận thắng, bạn đang đi đúng hướng. Nếu thấy cộng lớn ở các trận thắng, bạn vẫn đang bắt nạt đối thủ sai — dừng lại.",
          ],
        },
        {
          heading: "Tuần 3 — Chuẩn bị giải đấu",
          content:
            "Đòn bẩy lớn nhất trong thuật toán là trọng số giải đấu sanctioned. Tuần 3 là để khóa được một giải.",
          listItems: [
            "Ngày 15-19: Đăng ký một giải đấu sanctioned trong hai tuần tới. Ở Việt Nam, đó là một chặng VFP, một sự kiện DUPR Vietnam do partnership với TA Pickleball, hoặc giải open có flag DUPR trong /tournaments của ThePickleHub. Đăng ký lên một hạng cao hơn rating hiện tại không bị phạt — DUPR không trừ vì bạn đánh trên trình.",
            "Ngày 20-21: Tập đấu nhịp giải. Best-of-3 đến 11, đổi partner giữa các game, mô phỏng nhịp một bảng đấu. Mục tiêu là canh tempo, không phải thắng buổi tập.",
          ],
          internalLinks: [
            {
              text: "DUPR Việt Nam: hợp tác với TA Pickleball giờ đưa các trận sanctioned VN vào hệ rating toàn cầu",
              path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub",
            },
          ],
        },
        {
          heading: "Tuần 4 — Cuối tuần giải đấu và phục hồi",
          content:
            "Cuối tuần giải là nơi phần lớn chuyển động 30 ngày của bạn xảy ra. Hãy đối xử với nó như cuộc hẹn mà mọi tuần trước đang dồn tới.",
          listItems: [
            "Ngày 22-25: Giải đấu. Sáu đến mười trận trong một cuối tuần ở trọng số gấp đôi giao hữu. Ngay cả kết quả 0-3 trước đối thủ tốt thường vẫn đẩy DUPR dương nếu tỉ số sát.",
            "Ngày 26-28: Phục hồi nhẹ. Dink dễ, không power, không nhồi giao hữu. Thuật toán đã ăn dữ liệu giải — đánh thêm rec lúc này chủ yếu là nhiễu.",
            "Ngày 29-30: Hai hoặc ba buổi đôi nam-nữ với đối thủ cao hơn DUPR hiện tại 0.4. Tự đánh giá thật, mở app, so DUPR ngày 30 với ngày 1.",
          ],
        },
        {
          heading: "Kỳ vọng thực tế — DUPR sẽ di chuyển bao nhiêu",
          content:
            "Các con số người ta khoe trên Facebook thường là outlier. Khoảng dưới đây dựa trên việc quan sát hàng trăm profile DUPR công khai trong cửa sổ 30 ngày với 12 đến 18 trận đều đặn.",
          listItems: [
            "DUPR hiện tại 3.0 đến 3.5: mức di chuyển 30 ngày thực tế = +0.15 đến +0.30. Cao hơn khi reliability đang còn xây.",
            "DUPR hiện tại 3.5 đến 4.0: thực tế = +0.08 đến +0.20. Băng tầm trung là chỗ thuật toán dính chặt — sát điểm quan trọng hơn ở đây.",
            "DUPR hiện tại 4.0 trở lên: thực tế = +0.03 đến +0.10. Mỗi 0.05 ở mức này đều có ý nghĩa và phải trả giá.",
          ],
        },
        {
          heading: "3 cái bẫy làm phẳng DUPR của bạn",
          content:
            "Đây là những lý do phổ biến nhất khiến người chơi làm đúng kế hoạch trên nhưng vẫn thấy điểm phẳng lì.",
          orderedList: [
            "Bám chặt một partner. Luôn đánh cùng một partner 4.2 trước các đội 3.5 nhìn trên giấy là thắng nhưng báo cho thuật toán biết rating của bạn phụ thuộc partner. Xoay partner mỗi tuần.",
            "Chỉ log trận thắng. Một số app cho phép chọn lọc. DUPR giả định mẫu đại diện, và hệ thống có thể dampening lại nước di chuyển khi phát hiện thiên lệch chọn lọc. Log toàn bộ hoặc không log gì — nhất quán mới ăn.",
            "Bỏ qua giải đấu. Người chỉ đánh rec đụng trần reliability. Không có một giải mỗi 4-6 tuần, DUPR giới hạn niềm tin vào con số, và mức di chuyển từng trận nhỏ dần.",
          ],
        },
        {
          heading: "Hướng dẫn chơi DUPR riêng cho người Việt",
          content:
            "Pickleball Việt Nam đang trong giai đoạn ramp DUPR. Tính đến 2026, có bốn con đường thực tế để tích trận sanctioned trong nước:",
          listItems: [
            "VFP National Series — Liên đoàn Pickleball Việt Nam tổ chức 4-6 chặng sanctioned mỗi năm tại HCMC, Hà Nội, Đà Nẵng.",
            "Sự kiện TA Pickleball — partnership với DUPR Vietnam đưa các trận này thẳng vào rating toàn cầu. Lịch thay đổi từng tháng; theo dõi kênh social của BTC.",
            "Listing /tournaments của ThePickleHub — giải open do cộng đồng tổ chức, một số có flag DUPR. Flag trong listing cho bạn biết kết quả có vào rating toàn cầu hay không.",
            "Chặng khu vực châu Á — Asia Pacific Series và PPA Tour Asia mời người chơi VN đủ điều kiện; đăng ký mở trước mỗi chặng 3-6 tuần.",
          ],
          internalLinks: [
            {
              text: "Bắt đầu từ Phần 1 của series DUPR nếu bạn cần hiểu hệ rating này thực sự đo cái gì",
              path: "/blog/what-is-dupr-pickleball-rating-system",
            },
          ],
        },
        {
          heading: "Bài drill di chuyển DUPR (và những bài không)",
          content:
            "Không phải drill nào cũng cộng dồn cùng nhịp. Danh sách dưới đây sắp xếp theo mức độ kỹ năng nền tảng đó xuất hiện trong một ΔDUPR dương.",
          listItems: [
            "ROI cao — Tập third-shot drop vào tường (15 phút/buổi). Khoảng cách lớn nhất giữa người 3.5 và 4.0 là chất lượng cú thứ 3, và thuật toán thưởng nặng các trận chuyển giao sát điểm.",
            "ROI cao — Rally dink với partner, tối thiểu 20 chạm. Kiên nhẫn dưới áp lực biến trận thua 8-11 thành trận thắng 11-9.",
            "ROI cao — Bài độ sâu return-of-serve trên ball machine. Đa số rec player return ngắn; return sâu là upside kỳ vọng miễn phí ẩn.",
            "ROI thấp — Đập bom vào tường. Vui, xây dựng tự tin, không chuyển thành thay đổi tỉ số.",
            "ROI thấp — Tập giao bóng quá 10 phút mỗi buổi. Lợi nhuận giảm dần — giao bóng là cú đòn bẩy thấp nhất trong pickleball.",
            "ROI thấp — Footwork ladder. Hữu ích cho nền thể lực, nhưng không hiện trong ΔDUPR theo cách drill cú đánh hiện.",
          ],
        },
        {
          heading: "Kết luận",
          content:
            "Một kế hoạch 30 ngày không biến 3.5 thành 4.5. Cái nó làm được là đưa bạn từ cohort tĩnh sang cohort động mà DUPR đọc là đang di chuyển — và sau 6 tháng đó là hai quỹ đạo điểm số rất khác nhau. Chọn đối thủ cao hơn. Đánh một giải. Giữ khối lượng trận ở mức bạn hồi phục được. Drill hai cú quan trọng và bỏ những cú không. Rồi mở app ngày 30 và so sánh thật lòng. Nếu kế hoạch làm việc, bạn sẽ thấy. Nếu không, báo cáo điểm chính nói cho bạn biết đòn bẩy nào cần kéo trong 30 ngày tiếp theo.",
        },
      ],
      faqItems: [
        {
          question: "DUPR cập nhật sau trận trong bao lâu?",
          answer:
            "Trận verified thường lên trong 24-48 giờ trên app DUPR. Trận giải đấu do BTC upload có thể mất 3-7 ngày tùy cách bàn điều hành xử lý kết quả.",
        },
        {
          question: "Tôi có mất điểm DUPR nếu nghỉ 30 ngày không?",
          answer:
            "Điểm rating không tự giảm, nhưng reliability score sụt. Nghĩa là khi quay lại, 5-8 trận đầu sẽ di chuyển điểm ít hơn bình thường — cho tới khi reliability tích lại đủ.",
        },
        {
          question: "ThePickleHub có hỗ trợ DUPR cho sơ đồ giải đấu không?",
          answer:
            "Có. Bracket Lab tại /tools nhận DUPR rating làm input seeding cho round-robin và single-elim, để bạn cân bảng đấu theo rating thay vì đoán.",
        },
        {
          question:
            "Đôi nam-nữ có thật sự tốt cho DUPR hơn đôi nam hay đôi nữ không?",
          answer:
            "Có, đặc biệt ở băng 3.5 đến 4.5. Bất đối xứng kỳ vọng giữa rating nam và nữ tạo upside mà thuật toán không trung hòa hoàn toàn. Trên 5.0 hiệu ứng nhỏ lại vì rating chặt hơn và trận dễ đoán hơn.",
        },
        {
          question:
            "DUPR của tôi tụt sau khi đánh 5-0 cuối tuần — vì sao?",
          answer:
            "Gần như luôn là vì bạn đánh với đối thủ thấp hơn 0.5 trở lên và thắng sát điểm. Thuật toán kỳ vọng bạn thắng đậm hơn, nên các kết quả 11-9 trước đối thủ yếu hơn được hệ thống ghi là dưới kỳ vọng dù scoreboard nói bạn thắng cả trận.",
        },
        {
          question: "Tôi có thể tăng DUPR mà không đánh giải đấu không?",
          answer:
            "Có, nhưng chỉ kỳ vọng khoảng nửa mức di chuyển so với người trộn giao hữu + một giải mỗi 4-6 tuần. Không có trận sanctioned, reliability score đụng trần, và mức di chuyển rating từng trận càng ngày càng nhỏ.",
        },
      ],
    },
  },
};

export default post;
