import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "pickleball-scoring-rules-guide",
  publishedDate: "2026-03-15",
  updatedDate: "2026-03-29",
  author: "The PickleHub Team",
  tags: ["scoring", "rules", "beginner"],
  ctaPath: "/tools/quick-tables",
  ctaLabel: { en: "Try Free Scoring Tool", vi: "Dùng thử chấm điểm miễn phí" },
  content: {
    en: {
      title: "Pickleball Scoring Rules Explained — Complete Guide for Beginners & Tournament Play",
      metaTitle: "Pickleball Scoring Rules 2026 | Complete Beginner & Tournament Guide",
      metaDescription: "Learn pickleball scoring rules for singles, doubles, and tournament play. Rally scoring vs side-out explained. Free digital scoring tool included.",
      sections: [
        {
          heading: "How Does Pickleball Scoring Work?",
          content: "Pickleball scoring can be confusing for newcomers, but it follows a logical system once you understand the basics. There are two main scoring systems used in pickleball: traditional side-out scoring and rally scoring. The format you use depends on whether you're playing recreationally or in organized competition."
        },
        {
          heading: "Traditional Side-Out Scoring (to 11)",
          content: "The classic pickleball scoring system where only the serving team can score points. Games are played to 11 points, win by 2. In doubles, each team gets two serves (one for each player) before the serve passes to the opponents.",
          listItems: [
            "Only the serving team can score — If the receiving team wins the rally, they earn the serve but no point.",
            "Win by 2 — The game continues past 11 until one team leads by 2 (e.g., 12-10, 13-11).",
            "Score is called as three numbers in doubles — Server score, receiver score, server number (1 or 2). Example: '4-2-1' means serving team has 4, receiving team has 2, first server.",
            "First serve exception — At the start of the game, only one player serves before the first side-out."
          ]
        },
        {
          heading: "Rally Scoring (to 21)",
          content: "Rally scoring awards a point on every rally regardless of who served. This format is increasingly popular in professional and tournament play because it creates more predictable game lengths and faster-paced matches.",
          listItems: [
            "Every rally scores a point — Whether you serve or receive, winning the rally earns a point.",
            "Games to 21, win by 2 — Higher point total but games often finish faster due to constant scoring.",
            "Used in MLP and professional events — Major League Pickleball uses rally scoring exclusively.",
            "Better for tournaments — Organizers prefer rally scoring because match duration is more predictable, making scheduling easier.",
            "Freeze rule — Some formats freeze at 20-20, requiring side-out scoring for the final points."
          ]
        },
        {
          heading: "Singles vs Doubles Scoring Differences",
          content: "While the fundamental scoring is the same, there are key differences between singles and doubles play:",
          listItems: [
            "Singles: Score is two numbers — Your score and opponent's score. Only one serve per side-out.",
            "Singles: Serve position follows score — Even score = serve from right court. Odd score = serve from left court.",
            "Doubles: Three-number score — Includes server number (1 or 2) to track which partner is serving.",
            "Doubles: Both players serve — After the first server loses a rally, the second server takes over before the serve passes."
          ]
        },
        {
          heading: "Tournament Scoring Best Practices",
          content: "When organizing a tournament, choosing the right scoring format matters for player experience and event timing:",
          listItems: [
            "Round robin events — Rally scoring to 21 keeps schedules predictable. Use time limits (20 minutes) as backup.",
            "Elimination brackets — Best-of-3 games to 11 (side-out) is the standard for competitive play.",
            "Recreational events — Games to 15 (rally) is a popular middle ground — fast enough for scheduling, long enough for fun.",
            "Use digital scoring — Paper scorecards lead to errors. Digital tools like ThePickleHub's scorer eliminate disputes and provide live standings."
          ]
        },
        {
          heading: "Common Scoring Mistakes to Avoid",
          content: "Even experienced players make these scoring errors during games and tournaments:",
          listItems: [
            "Forgetting server number — In doubles, always announce the full three-number score before serving.",
            "Wrong court position — Players must be in the correct court (right or left) based on the score. Even score = right side for server.",
            "Not switching sides — In singles, the server must switch sides after every point they score.",
            "Score disputes — Without a referee or digital scorer, disagreements can derail a tournament. Always designate a scorekeeper."
          ]
        }
      ]
    },
    vi: {
      title: "Luật chấm điểm Pickleball — Hướng dẫn đầy đủ cho người mới và giải đấu",
      metaTitle: "Luật chấm điểm Pickleball 2026 | Hướng dẫn cho người mới & giải đấu",
      metaDescription: "Học luật chấm điểm pickleball cho đơn, đôi và giải đấu. Rally scoring vs side-out giải thích chi tiết. Công cụ chấm điểm số miễn phí.",
      sections: [
        {
          heading: "Chấm điểm Pickleball hoạt động như thế nào?",
          content: "Chấm điểm pickleball có thể gây bối rối cho người mới, nhưng hệ thống rất logic khi bạn hiểu cơ bản. Có hai hệ thống chấm điểm chính: side-out scoring truyền thống và rally scoring. Thể thức bạn dùng phụ thuộc vào chơi giải trí hay thi đấu chính thức."
        },
        {
          heading: "Side-Out Scoring truyền thống (đến 11)",
          content: "Hệ thống chấm điểm cổ điển nơi chỉ đội giao bóng mới được điểm. Trận chơi đến 11 điểm, thắng cách 2. Trong đôi, mỗi đội được hai lượt giao (mỗi người một lượt) trước khi giao chuyển sang đối thủ.",
          listItems: [
            "Chỉ đội giao bóng được điểm — Nếu đội nhận thắng rally, họ nhận giao nhưng không có điểm.",
            "Thắng cách 2 — Trận tiếp tục quá 11 cho đến khi một đội dẫn 2 (ví dụ 12-10, 13-11).",
            "Điểm gọi 3 số trong đôi — Điểm đội giao, điểm đội nhận, số người giao (1 hoặc 2). Ví dụ: '4-2-1'.",
            "Ngoại lệ giao đầu — Đầu trận, chỉ một người giao trước side-out đầu tiên."
          ]
        },
        {
          heading: "Rally Scoring (đến 21)",
          content: "Rally scoring cho điểm mỗi rally bất kể ai giao. Thể thức này ngày càng phổ biến trong thi đấu chuyên nghiệp vì tạo thời gian trận dự đoán được và nhịp nhanh hơn.",
          listItems: [
            "Mỗi rally đều tính điểm — Dù giao hay nhận, thắng rally là có điểm.",
            "Đến 21, thắng cách 2 — Tổng điểm cao hơn nhưng trận thường kết thúc nhanh hơn.",
            "Dùng trong MLP và giải chuyên nghiệp — Major League Pickleball dùng rally scoring.",
            "Tốt hơn cho giải đấu — BTC thích rally scoring vì thời gian trận dự đoán được, dễ xếp lịch.",
            "Luật freeze — Một số thể thức freeze ở 20-20, yêu cầu side-out cho điểm cuối."
          ]
        },
        {
          heading: "Khác biệt chấm điểm Đơn vs Đôi",
          content: "Dù cơ bản giống nhau, có khác biệt quan trọng giữa đơn và đôi:",
          listItems: [
            "Đơn: Điểm 2 số — Điểm bạn và điểm đối thủ. Chỉ một lượt giao mỗi side-out.",
            "Đơn: Vị trí giao theo điểm — Điểm chẵn = giao từ sân phải. Điểm lẻ = sân trái.",
            "Đôi: Điểm 3 số — Bao gồm số người giao (1 hoặc 2).",
            "Đôi: Cả hai giao — Sau khi người giao thứ nhất mất rally, người thứ hai tiếp quản."
          ]
        },
        {
          heading: "Best practices chấm điểm giải đấu",
          content: "Khi tổ chức giải, chọn đúng thể thức chấm điểm ảnh hưởng đến trải nghiệm và thời gian:",
          listItems: [
            "Giải vòng tròn — Rally scoring đến 21 giữ lịch dự đoán được. Dùng giới hạn thời gian (20 phút) backup.",
            "Giải loại trực tiếp — Bo3 đến 11 (side-out) là tiêu chuẩn cho thi đấu.",
            "Giải phong trào — Đến 15 (rally) là trung gian phổ biến.",
            "Dùng chấm điểm số — Phiếu giấy dễ sai. Công cụ số như ThePickleHub loại bỏ tranh cãi."
          ]
        },
        {
          heading: "Lỗi chấm điểm thường gặp cần tránh",
          content: "Ngay cả người chơi kinh nghiệm cũng mắc các lỗi chấm điểm này:",
          listItems: [
            "Quên số người giao — Trong đôi, luôn đọc đủ 3 số trước khi giao.",
            "Sai vị trí sân — Người chơi phải ở đúng sân (phải hoặc trái) theo điểm số.",
            "Không đổi bên — Trong đơn, người giao phải đổi bên sau mỗi điểm ghi.",
            "Tranh cãi điểm — Không có trọng tài hay chấm điểm số, bất đồng có thể phá hỏng giải."
          ]
        }
      ]
    }
  }
};

export default post;
