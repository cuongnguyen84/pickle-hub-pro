import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "dupr-algorithm-explained-performance-vs-expectation",
  publishedDate: "2026-05-14",
  updatedDate: "2026-05-14",
  author: "Cuong Nguyen",
  tags: ["dupr", "dupr algorithm", "pickleball rating", "performance vs expectation", "reliability score", "ppa tour", "mlp", "vietnam"],
  ctaPath: "/blog/what-is-dupr-pickleball-rating-system",
  ctaLabel: { en: "Read Part 1: What Is DUPR?", vi: "Đọc Phần 1: DUPR là gì?" },
  heroImage: {
    src: "/images/blog/dupr-algorithm-performance-vs-expectation-hero.webp",
    alt: "Diagram explaining how the DUPR (Dynamic Universal Pickleball Rating) algorithm works after the July 2025 rewrite: it compares actual match score to an expected score derived from the average rating of both sides, so a player can win a match and still lose rating points if they underperformed expectation, or lose a match and still gain points if they overperformed."
  },
  content: {
    en: {
      title: "How the DUPR Algorithm Works: Performance vs Expectation Explained (Part 2 of 3)",
      metaTitle: "DUPR Algorithm Explained 2025: Why You Lose Points After Winning | Part 2 of 3",
      metaDescription: "DUPR's July 2025 algorithm: why winning can lose points and losing can gain them. Match weights, exclusion rules, reliability score. Part 2 of 3.",
      sections: [
        {
          heading: "Part 2 of 3: The Brain Behind DUPR",
          content: "You won the match — and your DUPR went down. You lost the match — and your DUPR went up. Sound illogical? Keep reading. Part 1 of this series explained what DUPR is and how the 2.000–8.000 scale works. Part 2 goes inside the brain of the system: the algorithm. After this post, you'll understand exactly why so many players win a match and still complain \"why did my rating drop?\""
        },
        {
          heading: "Before July 2025: Simple Win/Loss",
          content: "DUPR used to be easy to read. Win = points up. Lose = points down. Win big = points up a lot. Lose big = points down a lot. Everyone understood it. Everyone accepted it. Then on July 8, 2025, DUPR rewrote the entire algorithm. CEO Tito Machado said on LinkedIn: \"Yesterday we took the risk of disrupting stability. This was not an easy decision.\""
        },
        {
          heading: "After July 2025: Performance vs Expectation",
          content: "The new algorithm works like this. Before every match, DUPR computes an expected score based on the average rating of the two sides. After the match, DUPR compares the actual score to the expected score. Play better than expected → rating goes up. Play worse than expected → rating goes down. It does this regardless of whether you won or lost. The win/loss line is no longer the line that moves your rating. The expectation line is."
        },
        {
          heading: "Three Concrete Examples",
          content: "Three scenarios that show exactly how the new algorithm rewards or punishes you:",
          listItems: [
            "Lose the match — gain rating. You are DUPR 3.5, your opponent is DUPR 4.0. DUPR predicted you would lose 5–11. The actual score: you lost 9–11. You played better than expected → your rating goes up. Even though you lost.",
            "Win the match — lose rating. You are DUPR 5.0, your opponent is DUPR 3.5. DUPR predicted you would win 11–3. The actual score: you won 11–9. You played worse than expected → your rating goes down. Even though you won.",
            "Big upset — big jump. You are DUPR 4.5, your opponent is DUPR 5.0. DUPR predicted you would lose 6–11. The actual score: you won 11–3. Large upset → big rating jump, anywhere from 0.05 to 0.10 in a single match."
          ],
          internalLinks: [
            { text: "Tama Shimabukuro just beat the world #1 and #2 DUPR holders at 15 — exactly the kind of upset that moves rating fast", path: "/blog/tama-shimabukuro-ppa-atlanta-final-15-year-old" }
          ]
        },
        {
          heading: "How Much Can DUPR Change Per Match?",
          content: "Typical volatility: 0.003 to 0.05 per match. Large upset: as much as 0.10. New ratings (few logged matches) move more. Stable ratings (many logged matches) move less. Points update almost immediately after a match result is confirmed."
        },
        {
          heading: "Not All Matches Carry Equal Weight",
          content: "DUPR weights matches by where they were played and how they were entered:",
          listItems: [
            "Official tournaments (PPA, MLP, USA Pickleball): highest weight.",
            "DUPR Verified events: 50% higher weight than a regular event.",
            "Matches submitted by a club manager: 5× the weight of a self-reported match.",
            "Self-entered recreational matches: lowest weight — but they still count."
          ]
        },
        {
          heading: "What This Means in Practice",
          content: "Want an accurate, fast-moving DUPR? Play tournaments. Play at clubs that submit results to DUPR. Don't rely on self-reporting weekend rec matches. The numbers will still move, but they will move slowly and the system will not trust them as much."
        },
        {
          heading: "Match Exclusion Rules",
          content: "DUPR will throw out a match entirely under any of these conditions. An excluded match still appears on your profile but does not move your rating.",
          listItems: [
            "The average rating difference between the two teams is greater than 0.625 (too lopsided to be informative).",
            "Two doubles partners differ by more than 1.500 in rating (e.g., a 6.0 partnered with a 4.0).",
            "Neither side reaches 6 points (match too short or someone walked off)."
          ]
        },
        {
          heading: "Reliability Score: How Much DUPR Trusts Your Number",
          content: "Every player has a Reliability Score from 0–100%. Above 60% means DUPR considers your rating trustworthy. Most tournaments require at least 60% to register. Reaching 60% typically takes 10–20 matches against a variety of opponents. To maintain reliability you need at least 3 matches in 90 days, 6 matches in 180 days, or 12 matches in 270 days. Stop playing long enough and your reliability drops — your rating is then treated as stale."
        },
        {
          heading: "Bottom Line",
          content: "The new DUPR algorithm does not grade you on whether you won or lost. It grades you on whether you played at your level. Beat a much weaker opponent comfortably? Not impressive. Lose narrowly to a much stronger opponent? Very impressive. This is exactly why a player like Tama Shimabukuro — 15 years old — can climb rating very quickly when he loses close matches against Ben Johns or Federico Staksrud. And it is also why so many recreational players are shocked when they win a match and watch their rating drop. DUPR doesn't care that you won. DUPR cares how you played relative to expectation.",
          internalLinks: [
            { text: "DUPR Vietnam partnership: how DUPR is coming to Vietnamese tournaments", path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub" }
          ]
        },
        {
          heading: "What's Next",
          content: "Part 3 of this series will be a practical playbook: how to create a DUPR account, how to build reliability fast, and which matches to prioritize to climb rating most efficiently. Coming next in the DUPR series on ThePickleHub."
        },
        {
          heading: "Source",
          content: "Adapted from DUPR public communications about the July 8, 2025 algorithm change (CEO Tito Machado's LinkedIn post), DUPR documentation on match weighting and reliability score thresholds, and direct examples from active player rating data. Numerical volatility ranges (0.003–0.10) and reliability maintenance thresholds reflect the public DUPR rating rules as of early 2026."
        }
      ],
      faqItems: [
        {
          question: "How does the DUPR algorithm work?",
          answer: "Since July 8, 2025 DUPR no longer rewards you for winning per se. Before every match it computes an expected score from the two sides' average ratings. After the match it compares the real score to that expected score. If you played better than expected your DUPR goes up — even after a loss. If you played worse than expected your DUPR goes down — even after a win."
        },
        {
          question: "Why did my DUPR drop after I won?",
          answer: "Because you won by a smaller margin than DUPR predicted. If you are rated much higher than your opponent, the algorithm expects you to win comfortably. Winning narrowly counts as underperforming expectation, and the system lowers your rating to reflect that you did not play at your level."
        },
        {
          question: "How much can a DUPR rating change in a single match?",
          answer: "Typically between 0.003 and 0.05 points per match. A large upset against a much higher-rated opponent can move you 0.10 or more in one match. New players with few logged matches move faster than established players with many matches."
        },
        {
          question: "What is the DUPR Reliability Score?",
          answer: "A 0–100% score showing how much DUPR trusts your rating. Above 60% is considered reliable and is the minimum most tournaments require. You typically need 10–20 matches against varied opponents to reach 60%, and you must keep playing — at least 3 matches in 90 days, 6 in 180 days, or 12 in 270 days — to maintain it."
        },
        {
          question: "Do all DUPR matches count the same?",
          answer: "No. Official tournaments (PPA, MLP, USA Pickleball) carry the most weight. DUPR Verified events are weighted 50% higher than regular events. Matches submitted by a club manager are weighted 5× more than a self-reported match. Self-entered recreational matches still count but carry the lowest weight."
        }
      ]
    },
    vi: {
      title: "Thuật toán DUPR: Vì sao thắng vẫn mất điểm, thua vẫn tăng điểm? (Phần 2/3)",
      metaTitle: "Thuật toán DUPR 2025 giải thích | Thắng mất điểm, thua tăng điểm — Phần 2/3",
      metaDescription: "DUPR thay đổi thuật toán tháng 7/2025: thắng có thể vẫn mất điểm, thua có thể vẫn tăng điểm. Performance vs Expectation, trọng số trận, Reliability Score — Phần 2/3 series DUPR.",
      sections: [
        {
          heading: "Phần 2/3: Phần \"não\" của DUPR",
          content: "Thắng mà mất điểm. Nghe vô lý? Đọc tiếp. Phần 1 đã giải thích DUPR là gì và thang điểm. Phần 2 đi vào phần \"não\" của hệ thống: thuật toán. Đọc xong bài này, bạn sẽ hiểu chính xác tại sao nhiều người chơi thắng trận mà vẫn la làng \"sao điểm tôi tụt?\""
        },
        {
          heading: "Trước tháng 7/2025: đơn giản — thắng lên, thua xuống",
          content: "Trước đây DUPR rất dễ hiểu. Thắng = lên điểm. Thua = mất điểm. Thắng đậm = lên nhiều. Thua đậm = mất nhiều. Ai cũng hiểu. Ai cũng chấp nhận. Rồi ngày 8/7/2025, DUPR thay đổi hoàn toàn thuật toán. CEO Tito Machado nói trên LinkedIn: \"Hôm qua chúng tôi mạo hiểm phá vỡ sự ổn định. Đây không phải quyết định dễ dàng.\""
        },
        {
          heading: "Sau tháng 7/2025: Performance vs Expectation",
          content: "Thuật toán mới hoạt động thế này. Trước mỗi trận, DUPR tính ra một \"tỷ số kỳ vọng\" dựa trên rating trung bình của hai bên. Sau trận, DUPR so sánh tỷ số thực tế với tỷ số kỳ vọng. Đánh tốt hơn kỳ vọng → lên điểm. Đánh kém hơn kỳ vọng → mất điểm. BẤT KỂ BẠN THẮNG HAY THUA. Đường ranh \"thắng/thua\" không còn là đường ranh quyết định điểm DUPR nữa. Đường ranh kỳ vọng mới là."
        },
        {
          heading: "Ba ví dụ cụ thể",
          content: "Ba kịch bản show chính xác cách thuật toán mới thưởng/phạt:",
          listItems: [
            "Thua mà LÊN điểm. Bạn DUPR 3.5, đối thủ DUPR 4.0. DUPR dự đoán bạn thua 5–11. Thực tế: bạn thua 9–11. Bạn đánh TỐT HƠN kỳ vọng → điểm DUPR tăng. Dù thua.",
            "Thắng mà MẤT điểm. Bạn DUPR 5.0, đối thủ DUPR 3.5. DUPR dự đoán bạn thắng 11–3. Thực tế: bạn thắng 11–9. Bạn đánh KÉM HƠN kỳ vọng → điểm DUPR giảm. Dù thắng.",
            "Upset lớn, LÊN mạnh. Bạn DUPR 4.5, đối thủ DUPR 5.0. DUPR dự đoán bạn thua 6–11. Thực tế: bạn thắng 11–3. Upset lớn → điểm tăng mạnh, có thể 0.05 đến 0.10 trong một trận."
          ],
          internalLinks: [
            { text: "Tama Shimabukuro 15 tuổi vừa hạ số 1 và số 2 thế giới — chính kiểu upset này khiến điểm DUPR leo cực nhanh", path: "/blog/tama-shimabukuro-15-tuoi-vao-chung-ket-ppa-atlanta" }
          ]
        },
        {
          heading: "Mỗi trận thay đổi bao nhiêu điểm?",
          content: "Biến động thông thường: 0.003 đến 0.05 mỗi trận. Upset lớn: có thể thay đổi đến 0.10. Rating mới (ít trận): biến động lớn hơn. Rating ổn định (nhiều trận): biến động nhỏ hơn. Điểm cập nhật gần như ngay lập tức sau khi kết quả được xác nhận."
        },
        {
          heading: "Các loại trận và trọng số",
          content: "Không phải trận nào cũng có giá trị ngang nhau. DUPR cân nhắc theo nơi đánh và cách nhập điểm:",
          listItems: [
            "Giải đấu chính thức (PPA, MLP, USA Pickleball): trọng số cao nhất.",
            "Giải DUPR Verified: trọng số cao hơn 50% so với giải thường.",
            "Trận do quản lý CLB gửi kết quả: trọng số gấp 5 lần trận tự báo cáo.",
            "Trận tự nhập (recreational): trọng số thấp nhất — nhưng vẫn tính."
          ]
        },
        {
          heading: "Áp dụng thực tế",
          content: "Muốn DUPR chính xác và tăng nhanh? Đánh giải. Đánh ở CLB có DUPR. Đừng chỉ tự nhập điểm từ trận giao lưu cuối tuần. Điểm vẫn nhúc nhích nhưng nhúc nhích chậm, và hệ thống không \"tin\" những trận đó nhiều."
        },
        {
          heading: "Quy tắc loại trừ",
          content: "DUPR loại bỏ hoàn toàn các trận thuộc một trong những trường hợp sau. Trận bị loại vẫn hiện trên profile nhưng không ảnh hưởng rating.",
          listItems: [
            "Chênh lệch rating trung bình hai đội hơn 0.625 (quá chênh lệch).",
            "Hai người đánh đôi chênh nhau hơn 1.500 (ví dụ 6.0 đánh cùng 4.0).",
            "Không bên nào đạt được 6 điểm (trận quá ngắn / bỏ cuộc)."
          ]
        },
        {
          heading: "Độ tin cậy (Reliability Score)",
          content: "Mỗi người chơi có một Reliability Score từ 0–100%. Trên 60% — rating được coi là đáng tin cậy. Đa số giải yêu cầu mức này để đăng ký. Để đạt 60%: cần khoảng 10–20 trận với nhiều đối thủ khác nhau. Để duy trì: cần ít nhất 3 trận trong 90 ngày, 6 trận trong 180 ngày, hoặc 12 trận trong 270 ngày. Không đánh đủ → reliability giảm → rating bị coi là \"cũ\"."
        },
        {
          heading: "Tóm lại Phần 2",
          content: "Thuật toán DUPR mới không đánh giá bạn thắng hay thua. Nó đánh giá bạn có đánh ĐÚNG TRÌNH không. Thắng dễ dàng đối thủ yếu hơn nhiều? Không ấn tượng. Thua sát nút đối thủ mạnh hơn nhiều? Rất ấn tượng. Đó là lý do Tama Shimabukuro — 15 tuổi — có thể leo rating cực nhanh khi thua sát Ben Johns hay Staksrud. Và đó cũng là lý do nhiều người chơi phong trào bị sốc khi thắng mà vẫn tụt điểm. DUPR không quan tâm bạn thắng. DUPR quan tâm bạn đánh thế nào so với kỳ vọng.",
          internalLinks: [
            { text: "DUPR x TA Pickleball x ThePickleHub: thỏa thuận đưa DUPR vào giải Việt Nam", path: "/blog/dupr-doi-tac-ta-pickleball-thepicklehub-viet-nam" }
          ]
        },
        {
          heading: "Phần tiếp theo",
          content: "Phần 3 sẽ là hướng dẫn thực tế: cách tạo tài khoản DUPR, cách xây dựng reliability nhanh, và những loại trận nào nên ưu tiên để tăng điểm nhanh nhất. Đón đọc Phần 3 trên ThePickleHub."
        },
        {
          heading: "Nguồn",
          content: "Adapt từ thông tin DUPR công bố về việc đổi thuật toán ngày 8/7/2025 (post LinkedIn của CEO Tito Machado), tài liệu DUPR về trọng số trận và ngưỡng Reliability Score, cùng ví dụ trực tiếp từ rating người chơi. Biên độ biến động (0.003–0.10) và ngưỡng duy trì reliability là theo quy tắc rating công khai của DUPR đầu năm 2026."
        }
      ],
      faqItems: [
        {
          question: "Thuật toán DUPR hoạt động thế nào?",
          answer: "Từ ngày 8/7/2025 DUPR không còn thưởng đơn thuần cho thắng. Trước mỗi trận, hệ thống tính một tỷ số kỳ vọng từ rating trung bình hai bên. Sau trận, so sánh tỷ số thực tế với tỷ số kỳ vọng. Đánh tốt hơn kỳ vọng → DUPR tăng, kể cả khi thua. Đánh kém hơn kỳ vọng → DUPR giảm, kể cả khi thắng."
        },
        {
          question: "Vì sao thắng trận mà DUPR tôi vẫn tụt?",
          answer: "Vì bạn thắng sát hơn DUPR kỳ vọng. Nếu bạn rating cao hơn đối thủ nhiều, thuật toán kỳ vọng bạn thắng đậm. Thắng sát nút = đánh kém kỳ vọng → DUPR giảm để phản ánh bạn không đánh đúng trình."
        },
        {
          question: "Mỗi trận DUPR thay đổi tối đa bao nhiêu điểm?",
          answer: "Thông thường 0.003 đến 0.05 điểm mỗi trận. Upset lớn với đối thủ rating cao hơn nhiều có thể khiến DUPR thay đổi 0.10 hoặc hơn trong một trận. Người mới ít trận biến động nhanh hơn người đã có nhiều trận ổn định."
        },
        {
          question: "Reliability Score của DUPR là gì?",
          answer: "Là chỉ số 0–100% cho biết DUPR \"tin\" rating của bạn đến mức nào. Trên 60% được coi là đáng tin cậy và là mức tối thiểu đa số giải yêu cầu. Cần khoảng 10–20 trận với nhiều đối thủ khác nhau để đạt 60%, và phải tiếp tục đánh — ít nhất 3 trận trong 90 ngày, 6 trận trong 180 ngày, hoặc 12 trận trong 270 ngày — để duy trì."
        },
        {
          question: "Mọi trận DUPR có giá trị như nhau không?",
          answer: "Không. Giải chính thức (PPA, MLP, USA Pickleball) có trọng số cao nhất. Giải DUPR Verified có trọng số cao hơn 50% so với giải thường. Trận do quản lý CLB gửi kết quả có trọng số gấp 5 lần trận tự báo cáo. Trận tự nhập (recreational) vẫn tính, nhưng trọng số thấp nhất."
        }
      ]
    }
  }
};

export default post;
