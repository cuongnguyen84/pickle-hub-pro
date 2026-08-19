/**
 * Shared copy for the /tools + /vi/tools hub — FAQ and how-to steps.
 *
 * Single source of truth for BOTH renderers, same pattern as
 * src/content/tournaments/pro-calendar-2026.ts:
 *   - SSR bot path: functions/_lib/render/tools.ts (FAQPage + HowTo JSON-LD
 *     and the bot-visible body)
 *   - React path:   src/components/seo/ToolsSeoContent.tsx (ToolsHubFaqSection),
 *     mounted by src/pages/Tools.tsx
 *
 * Why it lives here: Google requires FAQ/HowTo structured data to match content
 * that is actually visible on the page. Before SEO-GUARD-01 the Q&As existed
 * only inside the SSR string template with a comment asking future editors to
 * hand-copy them into the React tree — which never happened, so human visitors
 * saw none of the answers the JSON-LD claimed. Importing the same arrays in
 * both places makes drift impossible.
 *
 * Pages Functions import from src/ directly (no import.meta.glob, no bundler
 * magic) — keep this file dependency-free.
 */

/** [question, answer] — order is the display order. */
export type QaPair = [string, string];

export const TOOLS_FAQ_EN: QaPair[] = [
  [
    "Is the pickleball bracket generator free?",
    "Yes. Every format — round robin, single elimination, double elimination, MLP team match and flex — is free with no trial and no subscription. Viewing a bracket needs no account at all; an account is only required to create and manage your own tournament.",
  ],
  [
    "How do I generate a round robin schedule?",
    "Open Quick Tables, enter the player or team count, pick your group size, and the tool pairs every player against every other in their group, assigns courts, and keeps standings with point differential as the tiebreaker. A 6-player group is 15 matches; the formula is n × (n − 1) ÷ 2.",
  ],
  [
    "Can it build a double elimination bracket?",
    "Yes. The double elimination tool builds winners and losers brackets for 4–32 teams, handles byes, and creates the grand-final reset match automatically when the losers-bracket team wins the first final.",
  ],
  [
    "How many players or teams are supported?",
    "From 2 to 200+ participants. Large fields are split into balanced groups automatically, with snake seeding across groups when you enter skill ratings or DUPR scores.",
  ],
  [
    "Can players follow the bracket on their phones?",
    "Yes. Every tournament has one shareable link — players and spectators see the schedule, live scores and standings on any phone browser, with no app install. You can also print the bracket for the venue wall.",
  ],
];

export const TOOLS_FAQ_VI: QaPair[] = [
  [
    "Chia cặp vòng tròn pickleball thế nào cho công bằng?",
    "Nhập danh sách người chơi (4–32 người, đơn hoặc đôi), Bảng đấu nhanh tự chia cặp vòng tròn để ai cũng gặp nhau, tự tính bảng xếp hạng theo trận thắng và hiệu số điểm, rồi tự động vào vòng playoff.",
  ],
  [
    "Có tạo được bảng đấu loại trực tiếp cho giải đôi không?",
    "Có — định dạng Loại trực tiếp Đôi hỗ trợ 4–32 đội, nhánh thắng nhánh thua đầy đủ, thua một trận vẫn còn cơ hội đánh ngược lên chung kết.",
  ],
  [
    "Dùng cho giải câu lạc bộ đông người được không?",
    "Được — định dạng Linh hoạt cho phép tự định nghĩa vòng, bảng và luật hạt giống cho king of the court, ladder hay festival nhiều ngày.",
  ],
  [
    "Tạo bảng đấu pickleball có mất phí không?",
    "Không. Cả năm thể thức — vòng tròn tính điểm, loại trực tiếp đơn, loại trực tiếp đôi, đấu đồng đội MLP và Linh hoạt — đều miễn phí, không dùng thử giới hạn, không thuê bao. Xem bảng đấu không cần tài khoản; chỉ khi tự tạo và quản lý giải mới cần đăng nhập.",
  ],
  [
    "Tối đa bao nhiêu người chơi hoặc bao nhiêu đội?",
    "Từ 2 đến hơn 200 người. Giải đông sẽ tự chia thành các bảng cân bằng, và nếu bạn nhập trình độ hoặc điểm DUPR thì hệ thống chia hạt giống kiểu rắn giữa các bảng.",
  ],
];

/**
 * How-to steps for building a bracket — HowTo JSON-LD + visible <ol>.
 *
 * Added 2026-08-19 (SEO-GUARD-01). GSC 10–16/8 vs 3–9/8: /tools fell from 16
 * clicks to 0 and "pickleball bracket generator" slid pos 12.2 → 19. The page
 * ranked on the head term but carried no procedural content, while the results
 * above it all answer "how do I actually make one". Steps are numbered,
 * self-contained and name the tool so an AI answer can cite a single step
 * standalone (GEO rule, CLAUDE.md 2026-08-14).
 */
export const TOOLS_HOWTO_EN: QaPair[] = [
  [
    "Pick your tournament format",
    "Choose round robin (Quick Tables) for club play, single or double elimination for a knockout draw, MLP team match for team events, or flex for a custom multi-day format. ThePickleHub's Bracket Lab supports all five and every one is free.",
  ],
  [
    "Enter players or teams",
    "Type or paste 2 to 200+ names. Add a skill rating or DUPR score next to a name and the generator snake-seeds the groups, so strong players are spread evenly instead of stacked in one bracket.",
  ],
  [
    "Set group size and court count",
    "Tell the tool how many courts you have. It sizes the groups, inserts byes when the field is not a power of two, and rotates courts so nobody plays back-to-back. A 6-player round robin group is 15 matches — n × (n − 1) ÷ 2.",
  ],
  [
    "Generate the bracket",
    "Press generate. The full schedule, match order and empty scorecards appear in about a second. Nothing is emailed, nothing is downloaded, and no signup is needed to view the result.",
  ],
  [
    "Share the link and score live",
    "Every bracket gets one shareable URL. Players open it on any phone browser to see the schedule and live standings; you enter scores as matches finish and the table recomputes instantly, with point differential as the tiebreaker. Print the bracket for the venue wall if you want a paper copy.",
  ],
];

export const TOOLS_HOWTO_VI: QaPair[] = [
  [
    "Chọn thể thức giải",
    "Vòng tròn tính điểm (Bảng đấu nhanh) cho giải câu lạc bộ, loại trực tiếp đơn hoặc đôi cho nhánh knock-out, đấu đồng đội kiểu MLP cho giải đội, hoặc Linh hoạt cho thể thức nhiều ngày tự định nghĩa. Bracket Lab của ThePickleHub hỗ trợ cả năm, tất cả đều miễn phí.",
  ],
  [
    "Nhập danh sách người chơi hoặc đội",
    "Gõ hoặc dán từ 2 đến hơn 200 tên. Thêm trình độ hoặc điểm DUPR cạnh mỗi tên, công cụ sẽ chia hạt giống kiểu rắn để người mạnh trải đều các bảng thay vì dồn hết vào một nhánh.",
  ],
  [
    "Đặt số người mỗi bảng và số sân",
    "Khai báo số sân đang có. Công cụ tự chia bảng, chèn suất miễn đấu khi số đội không chẵn, và xoay sân để không ai phải đánh hai trận liên tiếp. Bảng 6 người đấu vòng tròn là 15 trận — công thức n × (n − 1) ÷ 2.",
  ],
  [
    "Tạo bảng đấu",
    "Bấm tạo. Toàn bộ lịch thi đấu, thứ tự trận và phiếu điểm trống hiện ra trong khoảng một giây. Không cần email, không cần tải về, không cần đăng ký để xem kết quả.",
  ],
  [
    "Chia sẻ link và chấm điểm trực tiếp",
    "Mỗi bảng đấu có một link chia sẻ duy nhất. Người chơi mở trên trình duyệt điện thoại để xem lịch và bảng xếp hạng trực tiếp; bạn nhập tỉ số khi trận kết thúc, bảng xếp hạng tự tính lại ngay, phân định bằng hiệu số điểm. Cần bản giấy thì in bracket treo tường.",
  ],
];

/** Localized heading + intro for the how-to block (shared SSR + React). */
export const TOOLS_HOWTO_META = {
  en: {
    heading: "How to make a pickleball bracket in 5 steps",
    name: "How to make a pickleball tournament bracket",
    description:
      "Build a pickleball tournament bracket in about 60 seconds with ThePickleHub's free Bracket Lab — pick a format, enter players, set courts, generate, then share one live-scoring link.",
    totalTime: "PT1M",
    faqHeading: "Frequently asked questions",
  },
  vi: {
    heading: "Cách tạo bảng đấu pickleball trong 5 bước",
    name: "Cách tạo bảng đấu giải pickleball",
    description:
      "Tạo bảng đấu giải pickleball trong khoảng 60 giây bằng Bracket Lab miễn phí của ThePickleHub — chọn thể thức, nhập người chơi, khai báo số sân, bấm tạo, rồi chia sẻ một link chấm điểm trực tiếp.",
    totalTime: "PT1M",
    faqHeading: "Câu hỏi thường gặp",
  },
} as const;
