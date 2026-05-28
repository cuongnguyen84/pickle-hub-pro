import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "vietnam-dupr-leaderboard-launch",
  publishedDate: "2026-05-27",
  updatedDate: "2026-05-27",
  author: "Cuong Nguyen",
  tags: [
    "dupr",
    "dupr vietnam",
    "vietnam pickleball ranking",
    "dupr leaderboard",
    "thepicklehub",
    "pickleball vietnam",
    "asia pickleball",
    "tournament rating",
  ],
  ctaPath: "/rankings",
  ctaLabel: {
    en: "View the Vietnam DUPR Leaderboard",
    vi: "Xem bảng xếp hạng DUPR Việt Nam",
  },
  heroImage: {
    src: "/images/blog/vietnam-dupr-leaderboard-launch-hero.webp",
    alt: "Vietnam DUPR pickleball leaderboard on ThePickleHub.net showing top Vietnamese players with live DUPR doubles and singles ratings, ranked highest to lowest in a dark editorial table layout.",
  },
  content: {
    en: {
      title:
        "Vietnam DUPR Leaderboard Launches on ThePickleHub | Live Rankings, Bracket Seeding, Balanced Matchmaking",
      metaTitle:
        "Vietnam DUPR Leaderboard | Live Pickleball Rankings on ThePickleHub",
      metaDescription:
        "ThePickleHub now hosts a live Vietnam DUPR pickleball leaderboard updated by webhook. Plus DUPR-required tournaments, auto-seeded brackets, and balanced Mexicano pairings.",
      sections: [
        {
          heading: "What's new",
          content:
            "ThePickleHub now has a live Vietnam DUPR leaderboard at /rankings — the first national-scope DUPR ranking page built specifically for the Vietnamese pickleball community. The list reads directly from the profiles of players who have linked their DUPR account and chosen to appear publicly, and it updates in real time whenever DUPR pushes a rating change via webhook. No more 30-day-old screenshots; no more guessing whether your latest match has been counted.",
          internalLinks: [
            { text: "Open the live Vietnam DUPR leaderboard", path: "/rankings" },
          ],
        },
        {
          heading: "Why a Vietnam-only scope matters",
          content:
            "DUPR's official site shows global and continental rankings, but a Vietnamese player wanting to know where they stand inside Vietnam has had no clean answer. Asia is large; the top of the continental table is dominated by players from countries with deeper professional infrastructure. By scoping the leaderboard to Vietnam and reading from our own profiles table, we surface the people you actually play with, study with, and beat at your weekend tournament — not just the best in Asia overall.",
          listItems: [
            "Vietnam-only filter — country = VN on the profile",
            "Doubles and singles tabs (doubles by default — 95% of VN tournaments are doubles)",
            "City column so you can spot players from your own scene",
            "Stale marker (◐) when a rating hasn't synced in 30+ days",
          ],
        },
        {
          heading: "Three new features that ship together",
          content:
            "The leaderboard is the visible piece, but it sits on top of a broader DUPR integration we shipped this month. Three pieces of the same puzzle:",
          orderedList: [
            "Live leaderboard at /rankings — top 100 Vietnamese players by DUPR doubles or singles, real-time webhook updates, links into each player's public profile.",
            "DUPR-required tournaments on Quick Tables — organizers choose between 'self-reported', 'DUPR required', and 'either (DUPR preferred)' when creating a bracket. With DUPR required, registration auto-fills the player's rating, blocks out-of-range entries (e.g. ≤ 4.5), and shows a clear eligibility verdict.",
            "Auto-seeded brackets — one click and the bracket generator pulls every approved player's DUPR rating, sorts them, and applies snake distribution across groups. A small card explains coverage (X of Y players had a DUPR) so the organizer knows exactly what was seeded by rating vs by name.",
          ],
          internalLinks: [
            {
              text: "Quick Tables: round robin & single elimination",
              path: "/tools/quick-tables",
            },
            {
              text: "What is DUPR? — the global rating system explained",
              path: "/blog/what-is-dupr-pickleball-rating-system",
            },
          ],
        },
        {
          heading: "Balanced Mexicano pairing (for Mexicano nights)",
          content:
            "If you run a Mexicano session at your club, the matchmaking page now offers an 'Prefer DUPR-balanced pairing' option. When at least 75% of your selected players have a DUPR rating, the generator picks the 2v2 partition that minimises combined-DUPR difference between teams on each court — so the closest match-ups happen instead of accidentally lopsided ones. Below 75% coverage it falls back to the legacy random shuffle and tells you why. Each round shows a fairness percentage so you can see at a glance whether the math worked out.",
        },
        {
          heading: "How to appear on the leaderboard",
          content:
            "Three steps, all free:",
          orderedList: [
            "Create an account on ThePickleHub (if you don't already have one).",
            "From the header, click 'Connect DUPR' and sign in with your DUPR account — the rating syncs instantly.",
            "Open Account → 'Public profile' and turn it on. That's the opt-in switch; without it your rating stays private and you don't appear on the leaderboard, in player search, or in the public sitemap.",
          ],
        },
        {
          heading: "What we deliberately did not build (yet)",
          content:
            "A few things people will ask about: there is no men/women split on the Vietnam leaderboard today because the profile table doesn't store gender — we'll add it once the form supports it without forcing anyone to disclose. There's no age-group filter for the same reason (no birth year). There's no global view from inside Vietnam scope — that's intentional, the global and continental tabs already exist for that. And there's no 'follow' or DM yet; the leaderboard is read-only on purpose.",
        },
        {
          heading: "What's next",
          content:
            "The honest current count is small — we launched with seven publicly opted-in Vietnamese players because the DUPR SSO connection is new and most users haven't toggled their profile to public yet. That number will grow as more of the community connects DUPR and opts in. If you organise tournaments in Vietnam, the fastest way to grow the leaderboard is to require DUPR on your next bracket — every signup creates a verified rating that shows up here.",
          internalLinks: [
            {
              text: "DUPR Vietnam partnership announcement — TA Pickleball x ThePickleHub",
              path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub",
            },
            {
              text: "How to improve your DUPR rating in 30 days",
              path: "/blog/dupr-rating-improvement-30-day-plan",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "How often does the Vietnam DUPR leaderboard update?",
          answer:
            "In real time. Whenever DUPR pushes a rating change to ThePickleHub via webhook (typically minutes after a match is submitted), the cached row updates and the leaderboard reflects the new rating on the next page load.",
        },
        {
          question: "Why am I not on the leaderboard even though my DUPR is connected?",
          answer:
            "Check Account → 'Public profile' — the toggle has to be on. The leaderboard, the player search, and the public sitemap all gate on that flag. New users default to private until they opt in.",
        },
        {
          question: "Can a tournament require DUPR ratings?",
          answer:
            "Yes. When creating a Quick Table bracket, pick 'DUPR required' as the rating source and optionally set a min/max range. Players without a connected DUPR will see a 'Connect DUPR' gate instead of the registration form, and out-of-range players will see a clear ineligibility message.",
        },
        {
          question: "Does the bracket auto-seed by DUPR work if some players don't have a rating?",
          answer:
            "Yes. The seed explainer card shows how many players had a rating vs how many seeded by name (alphabetical at the bottom of the order). Players without a DUPR don't break the bracket — they just lose the rating-based seeding advantage.",
        },
      ],
    },
    vi: {
      title:
        "Bảng xếp hạng DUPR Việt Nam ra mắt trên ThePickleHub | Cập nhật real-time, seed bracket tự động, ghép cặp cân bằng",
      metaTitle:
        "Bảng xếp hạng DUPR Việt Nam | Cập nhật real-time trên ThePickleHub",
      metaDescription:
        "ThePickleHub ra mắt bảng xếp hạng DUPR Việt Nam cập nhật real-time qua webhook. Kèm tính năng giải đấu yêu cầu DUPR, seed bracket tự động, ghép cặp Mexicano cân bằng.",
      sections: [
        {
          heading: "Có gì mới",
          content:
            "ThePickleHub vừa ra mắt bảng xếp hạng DUPR Việt Nam tại /vi/rankings — trang ranking DUPR quy mô quốc gia đầu tiên xây riêng cho cộng đồng pickleball Việt Nam. Danh sách đọc thẳng từ profile của những VĐV đã kết nối DUPR và bật chế độ công khai, cập nhật theo thời gian thực mỗi khi DUPR đẩy thay đổi rating qua webhook. Không còn screenshot cũ 30 ngày; không còn đoán xem trận đấu gần nhất đã được tính chưa.",
          internalLinks: [
            { text: "Mở bảng xếp hạng DUPR Việt Nam", path: "/vi/rankings" },
          ],
        },
        {
          heading: "Tại sao cần scope riêng cho Việt Nam",
          content:
            "Trang DUPR chính thức có ranking toàn cầu và theo châu lục, nhưng VĐV Việt Nam muốn biết mình đứng đâu trong nước thì chưa có câu trả lời gọn gàng. Châu Á rộng; top bảng xếp hạng Asia bị dominate bởi VĐV từ các nước có hạ tầng pro sâu hơn. Scope bảng xếp hạng vào Việt Nam, đọc từ chính profiles của ThePickleHub, em surface đúng những người anh em chơi cùng, học cùng, đánh bại ở giải cuối tuần — không phải top Asia tổng thể.",
          listItems: [
            "Filter Việt Nam — country = VN trên profile",
            "Tab Đôi và Đơn (Đôi mặc định — 95% giải VN là đôi)",
            "Cột Thành phố để spot VĐV cùng khu",
            "Marker stale (◐) khi rating chưa sync trong 30+ ngày",
          ],
        },
        {
          heading: "Ba tính năng ship cùng nhau",
          content:
            "Bảng xếp hạng là phần thấy được, nhưng nó nằm trên một tích hợp DUPR rộng hơn em mới ship tháng này. Ba mảnh ghép cùng bộ:",
          orderedList: [
            "Bảng xếp hạng live tại /vi/rankings — top 100 VĐV Việt Nam theo DUPR đôi hoặc đơn, cập nhật real-time qua webhook, link sang profile công khai của từng người.",
            "Giải đấu yêu cầu DUPR trên Quick Tables — BTC chọn giữa 'Tự kê khai', 'Bắt buộc DUPR', và 'Cả hai (ưu tiên DUPR)' khi tạo bảng. Với bắt buộc DUPR, form đăng ký auto-fill rating, block VĐV ngoài range (vd ≤ 4.5), và hiển thị verdict 'đủ điều kiện / không' rõ ràng.",
            "Bracket auto-seed — một click và bracket generator pull DUPR của mọi VĐV đã duyệt, sắp xếp, áp snake distribution vào các bảng. Một card nhỏ giải thích coverage (X trong Y VĐV có DUPR) để BTC biết chính xác cái gì seed theo rating, cái gì seed theo tên.",
          ],
          internalLinks: [
            {
              text: "Quick Tables: round robin & single elimination",
              path: "/tools/quick-tables",
            },
            {
              text: "DUPR là gì? — hệ thống rating toàn cầu giải thích cho VĐV Việt",
              path: "/blog/what-is-dupr-pickleball-rating-system",
            },
          ],
        },
        {
          heading: "Ghép cặp Mexicano cân bằng DUPR (cho các buổi Mexicano CLB)",
          content:
            "Nếu CLB anh chạy buổi Mexicano, trang matchmaking giờ có option 'Ưu tiên cân bằng theo DUPR'. Khi ít nhất 75% VĐV chọn có DUPR, generator chọn partition 2v2 minimize chênh lệch DUPR combined giữa 2 đội mỗi sân — tức là các trận sát nhất xảy ra thay vì lệch một bên. Dưới 75% coverage, hệ thống fallback về random shuffle cũ và báo rõ lý do. Mỗi vòng hiển thị fairness % để anh biết ngay con số có ra hợp lý không.",
        },
        {
          heading: "Cách xuất hiện trên bảng xếp hạng",
          content:
            "Ba bước, đều free:",
          orderedList: [
            "Tạo tài khoản trên ThePickleHub (nếu chưa có).",
            "Trên header, click 'Kết nối DUPR' và đăng nhập DUPR — rating sync ngay.",
            "Vào Tài khoản → 'Hiển thị profile công khai' và bật lên. Đây là opt-in switch; không bật thì rating của anh vẫn riêng tư, không xuất hiện trên leaderboard, player search, hay sitemap công khai.",
          ],
        },
        {
          heading: "Cái em cố tình KHÔNG build (chưa)",
          content:
            "Vài thứ anh em sẽ hỏi: chưa có split nam/nữ trên bảng xếp hạng Việt Nam vì profile table chưa lưu giới tính — em sẽ thêm khi form support được mà không buộc ai disclose. Chưa có filter nhóm tuổi cùng lý do (chưa có năm sinh). Không có view global từ trong scope Việt Nam — có chủ ý, tab toàn cầu và châu lục đã có rồi. Chưa có 'follow' hay DM; bảng xếp hạng read-only cố tình.",
        },
        {
          heading: "Tiếp theo",
          content:
            "Con số honest hiện tại là nhỏ — em launch với 7 VĐV Việt Nam opt-in công khai vì kết nối DUPR SSO mới và đa số user chưa toggle profile sang public. Con số này sẽ tăng khi nhiều người trong cộng đồng connect DUPR và opt-in. Nếu anh là BTC tổ chức giải tại Việt Nam, cách nhanh nhất để grow bảng xếp hạng là yêu cầu DUPR cho giải tiếp theo — mỗi đăng ký tạo một rating đã verify hiện lên đây.",
          internalLinks: [
            {
              text: "Thông báo hợp tác DUPR Việt Nam — TA Pickleball x ThePickleHub",
              path: "/blog/dupr-vietnam-partnership-ta-pickleball-thepicklehub",
            },
            {
              text: "Tăng điểm DUPR trong 30 ngày: kế hoạch thực tế",
              path: "/blog/dupr-rating-improvement-30-day-plan",
            },
          ],
        },
      ],
      faqItems: [
        {
          question: "Bảng xếp hạng DUPR Việt Nam cập nhật bao lâu một lần?",
          answer:
            "Real-time. Mỗi khi DUPR đẩy thay đổi rating sang ThePickleHub qua webhook (thường vài phút sau khi trận đấu được submit), cached row update và bảng xếp hạng phản ánh rating mới trong lần load trang tiếp theo.",
        },
        {
          question: "Tại sao em đã kết nối DUPR mà không xuất hiện trên bảng xếp hạng?",
          answer:
            "Kiểm tra Tài khoản → 'Hiển thị profile công khai' — toggle phải bật. Bảng xếp hạng, player search, và sitemap công khai đều gate theo flag này. User mới mặc định private cho đến khi opt-in.",
        },
        {
          question: "Giải đấu có thể yêu cầu rating DUPR không?",
          answer:
            "Có. Khi tạo Quick Table bracket, chọn 'Bắt buộc DUPR' làm nguồn rating và optionally set range min/max. VĐV chưa connect DUPR sẽ thấy gate 'Kết nối DUPR' thay vì form đăng ký, VĐV ngoài range sẽ thấy thông báo không đủ điều kiện rõ ràng.",
        },
        {
          question: "Auto-seed bracket có hoạt động nếu một số VĐV không có rating?",
          answer:
            "Có. Card seed explainer hiển thị bao nhiêu VĐV có rating vs bao nhiêu seed theo tên (alphabetical cuối bảng). VĐV không có DUPR không phá bracket — chỉ mất lợi thế seeding theo rating.",
        },
      ],
    },
  },
};

export default post;
