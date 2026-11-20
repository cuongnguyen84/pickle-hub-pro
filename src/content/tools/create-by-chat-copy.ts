/**
 * Shared copy for the AI-chat tournament-creation landing page
 * (/tools/create-by-chat and /vi/tools/tao-giai-bang-chat).
 *
 * Single source for the React page (src/pages/CreateByChat.tsx) and the
 * bot SSR renderer (functions/_lib/render/tools.ts), same pattern as
 * hub-copy.ts: the JSON-LD, the SSR body and the human page cannot drift
 * apart. Facts are capability-checked against src/lib/quick-table-chat.ts
 * (MLP Team Match supported since PR #1003, created WITHOUT a DreamBreaker
 * by default; double elimination is NOT supported and the copy says so).
 * Positioning differs by market on purpose (Cuong, 2026-11-21): the EN copy
 * leads with paste-any-list + MLP + the all-in-one platform and answers US
 * organizer questions; the VI copy leads with Zalo lists. Proof numbers:
 * production data, November 2026 - keep the "Nov 2026" labels when reusing
 * the stats.
 */

export const CREATE_BY_CHAT_PATHS = { en: "/tools/create-by-chat", vi: "/vi/tools/tao-giai-bang-chat", chatEn: "/tools/quick-tables/chat", chatVi: "/vi/tools/quick-tables/chat" } as const;

export interface CreateByChatCopy {
  metaTitle: string;
  metaDescription: string;
  kicker: string;
  h1: string;
  lead: string;
  cta: string;
  demoTitle: string;
  demo: [string, string][];
  stepsHeading: string;
  steps: [string, string][];
  formatsHeading: string;
  formats: string[];
  formatsNote: string;
  proofHeading: string;
  proofStats: [string, string][];
  proofText: string;
  faqHeading: string;
  faq: [string, string][];
  closing: string;
}

export const CREATE_BY_CHAT_COPY: Record<"en" | "vi", CreateByChatCopy> = {
  en: {
    metaTitle: "Create a Pickleball Tournament by Chat | ThePickleHub",
    metaDescription: "Paste any player list and get a pickleball bracket in about 60 seconds - round robin, knockout and MLP Team Match. Free to create.",
    kicker: "◆ Free · No install · Sign in to create",
    h1: "Create a pickleball tournament by chat",
    lead: "The first AI chat tournament builder made specifically for pickleball. Paste any list - a message thread, an email, a spreadsheet, a photo - and get the bracket in about 60 seconds, including MLP Team Matches that traditional bracket tools barely support. Your tournament lives on the same platform as the results, livestreams and courts, not in a standalone bracket tool.",
    cta: "Open chat",
    demoTitle: "From list to bracket",
    demo: [
      ["You", "Doubles list: Alex + Ben, Chris + Dan, Eli + Finn, Gabe + Hank..."],
      ["AI", "Draft ready: 12 teams in 3 groups of 4, then a single-elimination playoff. Check the names, then tap Create."],
      ["AI", "Done - your bracket and shareable link are ready."]
    ],
    stepsHeading: "How it works",
    steps: [
      ["Paste a list", "Paste text, send a list photo, or add a spreadsheet file."],
      ["Review the draft", "Check the names and tournament draft."],
      ["Create and share", "Create the bracket, share its link, and score live."]
    ],
    formatsHeading: "Formats you can create",
    formats: [
      "Round-robin groups + single-elimination playoff",
      "Single elimination",
      "MLP Team Match (from Major League Pickleball), optional DreamBreaker",
      "Pre-assigned groups from list headings (Group A, Pool 2)"
    ],
    formatsNote: "Double elimination is not supported yet. The closest alternative is round-robin groups followed by a single-elimination playoff.",
    proofHeading: "Built for real tournaments",
    proofStats: [
      ["18", "real tournaments created with AI chat (Nov 2026)"],
      ["48", "doubles teams or singles players max"],
      ["~60 sec", "from list to bracket"]
    ],
    proofText: "Example: 44 teams become 11 groups of 4, then playoff brackets of 32+12 or 16+14+14.",
    faqHeading: "Frequently asked questions",
    faq: [
      ["Can the chat create an MLP Team Match?", "Yes. Send the team rosters and ask for an MLP Team Match. The format comes from Major League Pickleball in the US, and traditional bracket tools barely support it. ThePickleHub chat has created MLP Team Matches since November 2026."],
      ["Does the bracket include a DreamBreaker?", "Not by default. MLP Team Matches are created without a DreamBreaker; if your match needs one, ask in the chat and it is added before you create."],
      ["Can I print the bracket?", "Yes. A created tournament opens on ThePickleHub with a printable bracket, and the same page carries the schedule and live results for the day."],
      ["Do players need an account to see the bracket?", "No. Anyone with the link can view a public bracket, the schedule and results without an account. Only creating a tournament needs sign-in."],
      ["Can it build a double-elimination bracket?", "Not yet. Double elimination is not supported in chat. The closest alternative is round-robin groups followed by a single-elimination playoff."]
    ],
    closing: "Ready to build your bracket?"
  },
  vi: {
    metaTitle: "Tạo giải pickleball bằng chat AI | ThePickleHub",
    metaDescription: "Dán danh sách để tạo bảng đấu pickleball trong khoảng 60 giây. Miễn phí, cần đăng nhập để tạo.",
    kicker: "◆ Miễn phí · Không cần cài đặt · Đăng nhập để tạo",
    h1: "Tạo giải pickleball bằng chat AI",
    lead: "Công cụ tạo giải bằng chat AI đầu tiên dành riêng cho pickleball. Dán danh sách, có bảng đấu trong khoảng 60 giây.",
    cta: "Mở chat",
    demoTitle: "Từ danh sách đến bảng đấu",
    demo: [
      ["Ban tổ chức", "Danh sách đôi: An + Bình, Cường + Dũng, Em + Phúc, Giang + Hoa..."],
      ["AI", "Bản nháp xong: 12 đội chia 3 bảng 4 đội, sau đó playoff loại trực tiếp. Kiểm tra tên rồi bấm Tạo giải."],
      ["AI", "Xong - bảng đấu và link chia sẻ đã sẵn sàng."]
    ],
    stepsHeading: "Cách thực hiện",
    steps: [
      ["Gửi danh sách", "Dán văn bản, gửi ảnh danh sách hoặc tệp bảng tính."],
      ["Kiểm tra bản nháp", "Kiểm tra tên người chơi và bản nháp giải."],
      ["Tạo và chia sẻ", "Tạo bảng đấu, chia sẻ liên kết và cập nhật điểm trực tiếp."]
    ],
    formatsHeading: "Thể thức có thể tạo",
    formats: [
      "Vòng tròn theo bảng + playoff loại trực tiếp",
      "Loại trực tiếp",
      "MLP Team Match, tùy chọn DreamBreaker",
      "Bảng có sẵn theo tiêu đề trong danh sách (Bảng A, Bảng B)"
    ],
    formatsNote: "Chat chưa hỗ trợ loại kép. Phương án gần nhất là vòng tròn theo bảng, sau đó playoff loại trực tiếp.",
    proofHeading: "Đã dùng cho giải thực tế",
    proofStats: [
      ["18", "giải thực tế tạo bằng chat AI (11/2026)"],
      ["48", "đội đôi hoặc người chơi đơn tối đa"],
      ["~60 giây", "từ danh sách đến bảng đấu"]
    ],
    proofText: "Ví dụ: 44 đội thành 11 bảng, mỗi bảng 4 đội; sau đó là nhánh playoff 32+12 hoặc 16+14+14.",
    faqHeading: "Câu hỏi thường gặp",
    faq: [
      ["Dùng danh sách từ Zalo được không?", "Được. Dán danh sách người chơi đã sao chép, gửi ảnh danh sách kể cả chữ viết tay, hoặc tệp bảng tính."],
      ["Có thể tạo những thể thức nào?", "Vòng tròn theo bảng rồi playoff loại trực tiếp, loại trực tiếp, MLP Team Match hoặc nhóm có sẵn theo tiêu đề."],
      ["Có tạo được giải loại kép không?", "Chưa hỗ trợ. Phương án gần nhất là vòng tròn theo bảng, sau đó playoff loại trực tiếp."],
      ["Tối đa bao nhiêu đội?", "Mỗi giải có tối đa 48 đội đôi hoặc 48 người chơi đơn."],
      ["Có miễn phí không, người chơi có cần tài khoản không?", "Miễn phí. Người tạo cần đăng nhập; mọi người xem bảng đấu công khai không cần tài khoản."]
    ],
    closing: "Sẵn sàng tạo bảng đấu của bạn?"
  }
};
