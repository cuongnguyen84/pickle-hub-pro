import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "create-tournament-by-chat",
  publishedDate: "2026-10-20",
  updatedDate: "2026-10-20",
  author: "The PickleHub Team",
  tags: ["tạo giải pickleball", "dán danh sách", "chat", "vòng bảng", "round robin"],
  ctaPath: "/tools/quick-tables/chat",
  ctaLabel: { en: "Open the chat", vi: "Mở chat tạo giải" },
  heroImage: {
    src: "/images/blog/create-tournament-by-chat-hero.webp",
    alt: "ThePickleHub chat screen ready to create Giải CLB tối thứ 7, with groups A and B and a Create button",
  },
  content: {
    en: {
      title: "Create a Pickleball Draw by Chat: Paste a List, Up to 48 Teams",
      metaTitle: "Paste a Pickleball List into Chat | ThePickleHub",
      metaDescription: "Paste a Zalo or Excel list into ThePickleHub chat and create a round-robin for up to 48 teams. 8 teams, 2 courts: 28 or 12 matches. 20 Oct 2026.",
      howToSteps: [
        { name: "Choose doubles or singles", text: "Open the chat and tap Doubles or Singles. That tap does not call the model." },
        { name: "Paste the list and read the draft", text: "One team per line, like Nam - Hung. Open the draft and read every name before the next question." },
        { name: "Review groups, then create", text: "Pick a legal group split, name the event, then tap Create on the review card." },
        { name: "Send the link", text: "Copy the link, or copy the Zalo message that lists the groups." },
      ],
      sections: [
        {
          heading: "Open the chat",
          content: "Last updated: 20 October 2026. ThePickleHub chat at https://www.thepicklehub.net/tools/quick-tables/chat turns a pasted list into one round-robin draw for up to 48 doubles teams or 48 singles players. Sign in, paste the names, read every name in the draft, then tap Create. For 8 teams and 2 courts, one group is 28 matches and two groups of 4 are 12 group matches before the playoff. The Vietnamese screen is https://www.thepicklehub.net/vi/tools/quick-tables/chat. A chip tap does not call the model. Typed text, a photo, a PDF, or a spreadsheet does.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-1.webp",
            alt: "Chat asking doubles or singles, with Doubles highlighted and a message box underneath",
            caption: "Step 1. Tap Doubles or Singles. The screen in this guide is the Vietnamese one; English uses the same layout.",
          },
        },
        {
          heading: "Paste the list, then read every name",
          content: "Put one team on each line, written as “Nam - Hung”. A photo, PDF, Excel, CSV, TSV, or text file works too, up to 4 MB. The reply “Got N teams” is not the list. Open Draft at the top and read every name. If a name is wrong, edit it there before you answer the next question. Four teams stay in one round-robin group. The chat only offers splits with 3 to 8 teams per group, and at most 16 groups.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-2.webp",
            alt: "Draft open with four team names, the user paste on the right, and a one-group chip",
            caption: "Step 2. The draft is the list. Read it before you pick a group split.",
          },
        },
        {
          heading: "Review the card, then tap Create",
          content: "After the list, the chat asks for a group split, a playoff shape when more than one bracket is possible, a name, and optionally courts and a start time. Time is only asked when you set courts. The review card shows the name, the format, the groups, and the time. Read it. Use Edit in the draft if a name or a group is wrong. Tap Create only when the card matches the event. One bracket per finishing place is available when you ask for it: 1st to A, 2nd to B, and so on, up to eight brackets.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-3.webp",
            alt: "Review card for Giải CLB tối thứ 7 with two groups of four and a Create button",
            caption: "Step 3. The review card is the last check. Create writes the draw.",
          },
        },
        {
          heading: "Send the link to the group",
          content: "After Create, Open tournament goes to the draw. Copy link is the page for the schedule and results. Copy Zalo message pastes the group names plus that link, ready for a group chat. The conversation itself stays on this device. A tournament already created is not deleted if you start over.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-4.webp",
            alt: "Success card with Open tournament, Copy link, and Copy Zalo message",
            caption: "Step 4. Copy the link, or the Zalo message, and send it to the players.",
          },
          internalLinks: [
            { text: "Round-robin sizes, from 4 players up", path: "/blog/how-to-create-pickleball-bracket" },
          ],
        },
        {
          heading: "Worked example: 8 teams, 2 courts, 7:00 pm",
          content: "Eight doubles teams and two courts is the club-night case. One group means every team plays the other seven: 8 × 7 ÷ 2 = 28 matches. Two courts run two matches at a time, so that is 14 rounds. At 15 minutes a match, the group stage is about 3 hours 30 minutes, plus changeovers. Two groups of four is 6 matches per group, 12 group matches, then a short playoff. The chat only offers splits with 3 to 8 teams in a group, so 8 teams can be one group or two groups of four, not three groups. Tie-break rules for equal wins are in the group-draw guide, not repeated here.",
          internalLinks: [
            { text: "How group standings break a tie", path: "/blog/pickleball-group-draw-schedule-guide" },
          ],
        },
        {
          heading: "What this chat will not build",
          content: "The chat creates a round-robin group draw and, when you ask, the playoff that follows those groups. It will not build an MLP team event, a double-elimination bracket, a flex draw, or a DUPR sign-up event. Those stay on the classic form. More than 48 entries also go to the classic form. If you upload a photo and later paste the real list on the “almost done” step, that paste can be read as seeds, not as a new roster. Put the list in at the list step, and check Draft before you continue.",
        },
      ],
      faqItems: [
        {
          question: "Do I need an account?",
          answer: "Yes. The chat asks you to sign in before it creates a tournament. The draw is saved to your account. The conversation is saved on the device.",
        },
        {
          question: "Can I send a photo or an Excel file?",
          answer: "Yes. A photo, PDF, Excel, CSV, TSV, or text file up to 4 MB. After it replies, open Draft and read every name.",
        },
      ],
    },
    vi: {
      title: "Tạo giải pickleball bằng chat: dán danh sách Zalo, tối đa 48 đội",
      metaTitle: "Tạo giải pickleball bằng chat | Dán danh sách",
      metaDescription: "Dán danh sách Zalo vào chat ThePickleHub, đọc từng tên, tạo giải vòng bảng tối đa 48 đội. 8 đội 2 sân: 28 trận hoặc 12 trận. 20/10/2026.",
      howToSteps: [
        { name: "Chọn đôi hoặc đơn", text: "Mở chat và bấm Đôi hoặc Đơn. Bấm chip không gọi AI." },
        { name: "Dán danh sách và đọc Bản nháp", text: "Mỗi dòng một đội, kiểu Nam - Hùng. Mở Bản nháp và đọc từng tên trước câu hỏi tiếp theo." },
        { name: "Xem thẻ rồi bấm Tạo giải", text: "Chọn cách chia bảng hợp lệ, đặt tên, rồi bấm Tạo giải trên thẻ kiểm tra." },
        { name: "Gửi link", text: "Copy link, hoặc copy tin Zalo có tên từng bảng." },
      ],
      sections: [
        {
          heading: "Mở chat",
          content: "Cập nhật lần cuối: 20/10/2026. Chat của ThePickleHub tại https://www.thepicklehub.net/vi/tools/quick-tables/chat tạo giải vòng bảng pickleball từ danh sách dán — tin Zalo, ảnh hoặc Excel — cho tối đa 48 đội đánh đôi hoặc 48 VĐV đánh đơn. Bạn đăng nhập, dán tên, đọc từng tên trong Bản nháp, rồi bấm Tạo giải. Với 8 đội và 2 sân: một bảng là 28 trận; hai bảng 4 đội là 12 trận vòng bảng rồi vào nhánh. Bản tiếng Anh nằm ở https://www.thepicklehub.net/tools/quick-tables/chat. Bấm chip thì trả lời ngay, không gọi AI. Chữ gõ tay, ảnh, PDF hoặc file bảng tính thì có gọi.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-1.webp",
            alt: "Màn chat hỏi đánh đôi hay đánh đơn, chip Đôi đang được chọn, ô nhắn ở dưới",
            caption: "Bước 1. Bấm Đôi hoặc Đơn. Chip này không gọi AI.",
          },
        },
        {
          heading: "Dán danh sách, rồi đọc từng tên",
          content: "Mỗi dòng một đội, viết kiểu “Nam - Hùng”. Ảnh, PDF, Excel, CSV, TSV hoặc file chữ cũng được, tối đa 4 MB. Câu “Đã nhận N đội” không phải là danh sách. Mở Bản nháp ở trên và đọc từng tên. Tên sai thì sửa tại đó, rồi mới trả lời câu tiếp theo. Bốn đội ở một bảng vòng tròn. Chat chỉ đưa cách chia có 3 đến 8 đội mỗi bảng, tối đa 16 bảng.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-2.webp",
            alt: "Bản nháp mở với bốn tên đội, bong bóng danh sách vừa dán, và chip 1 bảng vòng tròn",
            caption: "Bước 2. Bản nháp mới là danh sách. Đọc tên trước khi chọn cách chia bảng.",
          },
        },
        {
          heading: "Xem thẻ, rồi bấm Tạo giải",
          content: "Sau danh sách, chat hỏi cách chia bảng, số nhánh khi giải có hơn một nhánh, tên giải, rồi sân và giờ nếu bạn muốn. Giờ chỉ được hỏi khi đã có sân. Thẻ kiểm tra hiện tên giải, thể thức, các bảng và giờ. Đọc thẻ. Sai thì bấm Sửa trong Bản nháp. Đúng thì bấm Tạo giải. Muốn mỗi hạng một nhánh thì nói rõ: nhất vào A, nhì vào B, tối đa 8 nhánh.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-3.webp",
            alt: "Thẻ kiểm tra Giải CLB tối thứ 7 với bảng A, bảng B và nút Tạo giải",
            caption: "Bước 3. Thẻ này là lần kiểm cuối. Bấm Tạo giải thì bảng đấu được ghi.",
          },
        },
        {
          heading: "Gửi link cho cả nhóm",
          content: "Sau khi tạo, Mở giải vào trang bảng đấu. Copy link là trang lịch và kết quả. Copy tin Zalo ra một tin có tên từng bảng kèm link, dán vào nhóm là xong. Hội thoại nằm trên máy này. Giải đã tạo không bị xoá khi bạn làm lại từ đầu.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-4.webp",
            alt: "Thẻ đã tạo giải với nút Mở giải, Copy link và Copy tin Zalo",
            caption: "Bước 4. Copy link hoặc tin Zalo rồi gửi cho người chơi.",
          },
          internalLinks: [
            { text: "Cỡ bảng vòng tròn, từ 4 người trở lên", path: "/blog/how-to-create-pickleball-bracket" },
          ],
        },
        {
          heading: "Ví dụ 8 đội, 2 sân, 19:00",
          content: "Tám đội đánh đôi và hai sân là buổi tối câu lạc bộ. Một bảng thì mỗi đội gặp bảy đội kia: 8 × 7 ÷ 2 = 28 trận. Hai sân đánh hai trận một lượt, thành 14 lượt. Nếu mỗi trận khoảng 15 phút, vòng bảng hết khoảng 3 giờ 30 phút, chưa kể thời gian đổi sân. Hai bảng 4 đội thì mỗi bảng 6 trận, cả thảy 12 trận vòng bảng, rồi một nhánh ngắn. Chat chỉ đưa cách chia có 3 đến 8 đội trong một bảng, nên 8 đội là một bảng hoặc hai bảng 4 đội, không phải ba bảng. Luật xếp hạng khi bằng điểm nằm ở bài chia bảng, không lặp lại ở đây.",
          internalLinks: [
            { text: "Cách chia bảng và xếp hạng khi bằng điểm", path: "/vi/blog/cach-chia-bang-xep-lich-thi-dau-pickleball" },
          ],
        },
        {
          heading: "Chat này không tạo những thể thức nào",
          content: "Chat tạo giải vòng bảng, và nhánh playoff sau vòng bảng khi bạn yêu cầu. Chat không tạo giải đồng đội MLP, loại kép, thể thức flex, hay giải đăng ký theo DUPR. Những thể thức đó ở form thường. Hơn 48 đội cũng chuyển sang form thường. Nếu bạn gửi ảnh rồi dán danh sách thật ở bước “Gần xong”, đoạn dán đó có thể bị hiểu là hạt giống, không phải danh sách mới. Hãy đưa danh sách ở bước danh sách, và đọc Bản nháp trước khi đi tiếp.",
        },
      ],
      faqItems: [
        {
          question: "Có cần tài khoản không?",
          answer: "Có. Chat yêu cầu đăng nhập trước khi tạo giải. Giải lưu vào tài khoản. Hội thoại lưu trên máy.",
        },
        {
          question: "Gửi ảnh hoặc file Excel được không?",
          answer: "Được. Ảnh, PDF, Excel, CSV, TSV hoặc file chữ, tối đa 4 MB. Sau câu trả lời, mở Bản nháp và đọc từng tên.",
        },
      ],
    },
  },
};

export default post;
