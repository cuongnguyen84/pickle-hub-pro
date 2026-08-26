import type { BlogPost } from "@/content/blog/types";

/**
 * VI-first guide targeting the group-draw / round-robin scheduling queries
 * GSC already shows us ranking for without a dedicated page:
 * "chia bảng pickleball" (pos ~10), "xếp lịch thi đấu vòng tròn 5 đội
 * pickleball" (pos 4), "file excel chia bảng pickleball" (~14),
 * "chia bảng" long-tails. The EN side mirrors it with a narrower angle
 * (odd team counts + court constraints) so it does not cannibalise
 * how-to-create-pickleball-bracket / pickleball-round-robin-generator-guide.
 */
const post: BlogPost = {
  slug: "pickleball-group-draw-schedule-guide",
  publishedDate: "2026-08-26",
  updatedDate: "2026-08-26",
  author: "Cuong Nguyen",
  tags: [
    "chia bảng pickleball",
    "xếp lịch thi đấu pickleball",
    "vòng tròn pickleball",
    "chia bảng đấu",
    "lịch thi đấu vòng tròn",
    "công cụ chia bảng",
    "group draw",
    "round robin schedule",
  ],
  ctaPath: "/tools",
  ctaLabel: {
    en: "Generate your bracket free — no signup",
    vi: "Chia bảng & tạo lịch miễn phí — không cần đăng ký",
  },
  heroImage: {
    src: "/images/blog/pickleball-group-draw-schedule-guide-hero.webp",
    alt: "Top-down view of a pickleball tournament organizer setup: a clipboard with a five-team round-robin rotation diagram and schedule grid next to a blue pickleball court with two paddles, balls and a whistle.",
  },
  content: {
    en: {
      title:
        "Pickleball Group Draws & Round Robin Schedules: 4–10 Teams, Odd Counts, Limited Courts",
      metaTitle: "Pickleball Group Draw & Round Robin Schedule Guide",
      metaDescription:
        "How to split pickleball teams into groups and schedule a round robin — 5-team rotations, court-limited scheduling, tiebreakers, and a free generator.",
      sections: [
        {
          heading: "The three decisions every organizer makes",
          content:
            "Every pool-play pickleball event comes down to three decisions: how many groups to split your teams into, how to order the matches so nobody sits cold for an hour, and how the group results feed a knockout stage. Get the first two right and the day runs itself. This guide covers the exact cases that trip up first-time organizers — odd team counts, a single available court, and ties on match points — with worked schedules you can copy.",
        },
        {
          heading: "How many groups for how many teams",
          content:
            "A round robin of n teams needs n(n-1)/2 matches — that number grows fast, and it is the reason you split into groups at all. The sweet spot is groups of 4-5: every team gets 3-4 guaranteed matches and a group finishes inside a two-hour block on one court.",
          table: {
            caption: "Recommended group splits by team count",
            headers: ["Teams", "Groups", "Matches in pool play", "Advance to knockout"],
            rows: [
              ["4", "1 group of 4", "6", "Top 2 → final"],
              ["5", "1 group of 5", "10", "Top 2 → final"],
              ["6", "2 groups of 3", "6", "Top 2 each → semis"],
              ["8", "2 groups of 4", "12", "Top 2 each → semis"],
              ["10", "2 groups of 5", "20", "Top 2 each → semis"],
              ["12", "3 groups of 4", "18", "Top 2 + 2 best thirds → quarters"],
            ],
          },
        },
        {
          heading: "Scheduling 5 teams: the circle method, worked out",
          content:
            "Odd team counts are the classic headache: someone must sit out every round. The circle method solves it — add a phantom 'bye' slot, fix one position, and rotate the rest each round; whoever is paired with the bye rests. For 5 teams (A-E) you get 5 rounds of 2 matches, each team resting exactly once. The same rotation works for any odd count — 7 teams become 7 rounds of 3 matches.",
          table: {
            caption: "5-team round robin schedule (A, B, C, D, E)",
            headers: ["Round", "Match 1", "Match 2", "Resting"],
            rows: [
              ["1", "B – E", "C – D", "A"],
              ["2", "A – C", "D – E", "B"],
              ["3", "A – E", "B – D", "C"],
              ["4", "A – B", "C – E", "D"],
              ["5", "A – D", "B – C", "E"],
            ],
          },
        },
        {
          heading: "Fitting the schedule to your real courts",
          content:
            "A schedule that assumes infinite courts is fiction. With one court, just play the rounds in order. With two or more, interleave matches so the same team never plays twice in a row and rests spread evenly — this is where hand-written Excel schedules usually break, because a swap to fix one clash creates two more. Our generator schedules round-aware and pair-aware across however many courts you enter, and uses all of them for speed.",
          internalLinks: [
            { text: "Free Pickleball Bracket & Round Robin Generator", path: "/tools" },
            {
              text: "How to Run a Pickleball Round Robin — byes and tiebreakers in depth",
              path: "/blog/pickleball-round-robin-generator-guide",
            },
          ],
        },
        {
          heading: "Excel or an online tool?",
          content:
            "Excel works for a single group of 4 with one court — a 6-row table you can type by hand. Beyond that, the spreadsheet cost compounds: circle-method rotations, court assignment, standings with tiebreakers, and every late withdrawal means redoing all of it. An online generator produces the same schedule in seconds, recalculates when a team drops, and keeps live standings. Ours is free, needs no signup, and works on a phone at courtside.",
          internalLinks: [
            {
              text: "Pickleball Tournament Formats Explained — which format fits your player count",
              path: "/blog/pickleball-tournament-formats-explained",
            },
            {
              text: "Tournament Organizer Hub — every guide and tool in one place",
              path: "/blog/tournament-organizer-hub",
            },
          ],
        },
        {
          heading: "Breaking ties in the group",
          content:
            "Decide tiebreakers before the first serve and print them: 1) match wins, 2) head-to-head result, 3) point differential across all group matches, 4) points won. Announcing them after a tie has formed is how organizers lose friends. The generator tracks differential automatically as you enter scores.",
        },
      ],
      faqItems: [
        {
          question: "How many matches is a 5-team round robin?",
          answer:
            "10 matches — n(n-1)/2 with n=5. Played 2 per round over 5 rounds, each team rests exactly one round.",
        },
        {
          question: "How do I schedule a round robin with an odd number of teams?",
          answer:
            "Use the circle method with a phantom bye: fix one slot, rotate the rest each round. The team paired with the bye rests that round. Any odd count works the same way.",
        },
        {
          question: "Do I need software to run pool play?",
          answer:
            "For one group of 4 on one court, paper is fine. For anything bigger, a free generator saves the rework every time a team withdraws and keeps standings and tiebreakers current.",
        },
      ],
      howToSteps: [
        { name: "Count teams and courts", text: "Confirm final team count and how many courts you control for the pool-play block." },
        { name: "Split into groups", text: "Use groups of 4-5; with 6+ teams make multiple groups so pool play fits your time window." },
        { name: "Generate the round robin", text: "Apply the circle method or use the free generator to get a clash-free schedule across your courts." },
        { name: "Publish tiebreakers", text: "Post the tiebreak order (wins, head-to-head, differential) before matches start." },
        { name: "Seed the knockout", text: "Advance the top finishers per the table and seed so group winners meet runners-up from the other group." },
      ],
    },
    vi: {
      title:
        "Cách chia bảng & xếp lịch thi đấu pickleball: vòng tròn 4–10 đội, kèm công cụ miễn phí",
      metaTitle: "Cách chia bảng & xếp lịch thi đấu pickleball",
      metaDescription:
        "Cách chia bảng pickleball, xếp lịch vòng tròn 5 đội, luật tính hạng khi bằng điểm — kèm công cụ miễn phí.",
      sections: [
        {
          heading: "Ba việc phải quyết trước khi bốc thăm",
          content:
            "Tổ chức giải phong trào kiểu vòng bảng thực chất chỉ có ba quyết định: chia bao nhiêu bảng, xếp lịch sao cho không đội nào ngồi chờ cả tiếng, và kết quả vòng bảng dẫn vào nhánh knock-out thế nào. Chốt xong hai việc đầu là ngày thi đấu tự chạy. Bài này đi thẳng vào các tình huống hay vấp nhất: số đội lẻ, chỉ có 1-2 sân, và hai đội bằng điểm nhau — kèm lịch mẫu chép dùng được ngay.",
        },
        {
          heading: "Bao nhiêu đội thì chia mấy bảng?",
          content:
            "Đấu vòng tròn n đội cần n(n-1)/2 trận — con số phình rất nhanh, và đó là lý do phải chia bảng. Mức đẹp nhất là bảng 4-5 đội: mỗi đội chắc chắn được đánh 3-4 trận, và một bảng đánh xong gọn trong khoảng 2 tiếng trên một sân.",
          table: {
            caption: "Gợi ý chia bảng theo số đội",
            headers: ["Số đội", "Chia bảng", "Số trận vòng bảng", "Vào knock-out"],
            rows: [
              ["4", "1 bảng 4", "6", "Nhất nhì vào chung kết"],
              ["5", "1 bảng 5", "10", "Nhất nhì vào chung kết"],
              ["6", "2 bảng 3", "6", "Nhất nhì mỗi bảng vào bán kết"],
              ["8", "2 bảng 4", "12", "Nhất nhì mỗi bảng vào bán kết"],
              ["10", "2 bảng 5", "20", "Nhất nhì mỗi bảng vào bán kết"],
              ["12", "3 bảng 4", "18", "Nhất mỗi bảng + 1 nhì tốt nhất, hoặc 2 nhì tốt nhất vào tứ kết"],
            ],
          },
        },
        {
          heading: "Xếp lịch vòng tròn 5 đội: phương pháp vòng xoay",
          content:
            "Số đội lẻ là ca khó kinh điển: vòng nào cũng phải có một đội nghỉ. Cách chuẩn là phương pháp vòng xoay (circle method): thêm một suất 'nghỉ' ảo, cố định một vị trí rồi xoay các vị trí còn lại sau mỗi vòng. Với 5 đội (A-E) ta có 5 vòng, mỗi vòng 2 trận, mỗi đội nghỉ đúng 1 vòng — đội nào gặp suất ảo thì vòng đó nghỉ. Nguyên tắc này áp dụng cho mọi số đội lẻ: 7 đội thành 7 vòng mỗi vòng 3 trận, v.v.",
          table: {
            caption: "Lịch vòng tròn 5 đội (A, B, C, D, E)",
            headers: ["Vòng", "Trận 1", "Trận 2", "Đội nghỉ"],
            rows: [
              ["1", "B – E", "C – D", "A"],
              ["2", "A – C", "D – E", "B"],
              ["3", "A – E", "B – D", "C"],
              ["4", "A – B", "C – E", "D"],
              ["5", "A – D", "B – C", "E"],
            ],
          },
        },
        {
          heading: "Xếp theo số sân thật, không phải số sân lý thuyết",
          content:
            "Lịch đẹp trên giấy nhưng giả định sân vô hạn thì vô nghĩa. Có 1 sân: cứ đánh lần lượt theo vòng. Có 2 sân trở lên: phải cài xen kẽ sao cho không đội nào đánh 2 trận liên tiếp và thời gian nghỉ chia đều — đây chính là chỗ file Excel tự xếp hay vỡ, vì đổi một trận để gỡ trùng lại sinh ra hai chỗ trùng khác. Công cụ của ThePickleHub xếp lịch nhận biết theo vòng và theo cặp trên đúng số sân bạn nhập, và tận dụng hết sân để giải chạy nhanh nhất.",
          internalLinks: [
            { text: "Công cụ chia bảng & tạo lịch vòng tròn miễn phí", path: "/tools" },
            {
              text: "Các thể thức giải pickleball: chọn thể thức nào cho số đội của bạn",
              path: "/blog/pickleball-tournament-formats-explained",
            },
          ],
        },
        {
          heading: "Dùng file Excel hay công cụ online?",
          content:
            "Excel đủ dùng cho một bảng 4 đội đánh trên một sân — bảng 6 dòng gõ tay là xong. Quá mức đó, chi phí cộng dồn rất nhanh: xoay vòng theo circle method, gán sân, bảng xếp hạng kèm chỉ số phụ, và cứ mỗi đội rút lui phút chót là làm lại từ đầu. Công cụ online cho ra đúng lịch đó trong vài giây, tự tính lại khi có đội bỏ giải, và cập nhật bảng xếp hạng ngay khi nhập tỷ số. Công cụ của ThePickleHub miễn phí, không cần đăng ký, dùng tốt trên điện thoại ngay tại sân.",
          internalLinks: [
            {
              text: "Trung tâm dành cho người tổ chức giải: đủ mọi hướng dẫn & công cụ",
              path: "/blog/tournament-organizer-hub",
            },
          ],
        },
        {
          heading: "Bằng điểm thì tính hạng thế nào?",
          content:
            "Chốt luật tính hạng TRƯỚC khi bóng lăn và in ra dán ở sân: 1) số trận thắng, 2) kết quả đối đầu trực tiếp, 3) hiệu số điểm toàn vòng bảng, 4) tổng điểm ghi được. Công bố luật sau khi đã xảy ra bằng điểm là cách nhanh nhất để mất bạn chơi. Nếu dùng công cụ, hiệu số được tính tự động khi nhập tỷ số từng trận.",
        },
      ],
      faqItems: [
        {
          question: "5 đội đấu vòng tròn là bao nhiêu trận?",
          answer:
            "10 trận — theo công thức n(n-1)/2 với n=5. Đánh 5 vòng, mỗi vòng 2 trận, mỗi đội nghỉ đúng 1 vòng.",
        },
        {
          question: "Số đội lẻ thì xếp lịch kiểu gì?",
          answer:
            "Dùng phương pháp vòng xoay với một suất nghỉ ảo: cố định một vị trí, xoay các vị trí còn lại sau mỗi vòng. Đội nào rơi vào suất ảo thì vòng đó nghỉ. 5, 7, 9 đội đều làm y hệt.",
        },
        {
          question: "Có cần phần mềm để chạy vòng bảng không?",
          answer:
            "Một bảng 4 đội trên một sân thì giấy bút là đủ. Đông hơn thì nên dùng công cụ miễn phí: đỡ xếp lại lịch mỗi lần có đội rút, và bảng xếp hạng cùng chỉ số phụ luôn đúng.",
        },
        {
          question: "Chia bảng xong thì vào knock-out thế nào?",
          answer:
            "Lấy nhất nhì mỗi bảng theo bảng gợi ý ở trên, và xếp nhánh sao cho nhất bảng này gặp nhì bảng kia — hai đội cùng bảng chỉ gặp lại nhau sớm nhất ở chung kết.",
        },
      ],
      howToSteps: [
        { name: "Chốt số đội và số sân", text: "Xác nhận số đội cuối cùng và số sân dùng được cho khung giờ vòng bảng." },
        { name: "Chia bảng", text: "Ưu tiên bảng 4-5 đội; từ 6 đội trở lên chia nhiều bảng để vòng bảng gọn trong khung giờ." },
        { name: "Tạo lịch vòng tròn", text: "Áp dụng phương pháp vòng xoay hoặc dùng công cụ miễn phí để có lịch không trùng đội trên đúng số sân." },
        { name: "Công bố luật tính hạng", text: "Dán luật xếp hạng (thắng, đối đầu, hiệu số) trước trận đầu tiên." },
        { name: "Xếp nhánh knock-out", text: "Nhất bảng gặp nhì bảng chéo để hai đội cùng bảng chỉ tái ngộ ở chung kết." },
      ],
    },
  },
};

export default post;
