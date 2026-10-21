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
    src: "/images/blog/create-tournament-by-chat-hero-en.webp",
    alt: "ThePickleHub chat review for Saturday Night Club, with groups A and B and a Create tournament button",
  },
  content: {
    en: {
      title: "AI Pickleball Round Robin: Paste a List in Chat, Up to 48 Teams",
      metaTitle: "AI Pickleball Round Robin in Chat | ThePickleHub",
      metaDescription: "44 teams, 11 groups, then 2 or 3 brackets. ThePickleHub AI reads a pasted list or photo. Up to 48 teams. 20 Oct 2026.",
      howToSteps: [
        { name: "Choose doubles or singles", text: "Open the chat and tap Doubles or Singles." },
        { name: "Paste the list or send a photo", text: "One team per line, one or more photos, or a Google Sheet link shared as anyone with the link. Open the draft and read every name." },
        { name: "Review groups, then create", text: "Pick a legal group split, name the event, then tap Create tournament on the review card." },
        { name: "Send the link", text: "Copy the link, or copy the group-chat message that lists the groups." },
      ],
      sections: [
        {
          heading: "Open the chat",
          content: "Last updated: 20 October 2026. ThePickleHub AI chat at https://www.thepicklehub.net/tools/quick-tables/chat reads a pasted list, a photo, or a spreadsheet and builds a round-robin draw for up to 48 doubles teams or 48 singles players. A 44-team event is 11 groups of 4, then either 2 brackets (32 and 12) or 3 brackets (16, 14 and 14). Sign in, send the list, read every name in the draft, then tap Create tournament. The Vietnamese screen is https://www.thepicklehub.net/vi/tools/quick-tables/chat. A misread name has to be fixed in the draft before you continue.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-1-en.webp",
            alt: "Chat asking doubles or singles, with Doubles and Singles chips and a message box underneath",
            caption: "Step 1. Tap Doubles or Singles.",
          },
        },
        {
          heading: "Paste the list, then read every name",
          content: "Paste the list, or send photos of it — up to four photos at once, when one photo cannot show every name. One team per line, written as “Nam - Hung”. A photo of a message, a handwritten sheet, a PDF, Excel, CSV, TSV, a text file, or a Google Sheet link also works, up to 4 MB. The sheet has to be shared as anyone with the link. A file that has no team names is refused, and the list already read stays as it was. The reply “Got N teams” is not the list. Open Draft at the top and read every name. If a name is wrong, edit it there before you answer the next question. Another photo or file adds names; it does not wipe the ones already there. The chat only offers splits with 3 to 8 teams per group, and at most 16 groups.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-2-en.webp",
            alt: "Draft open with four team names, the pasted list, and a one round-robin group chip",
            caption: "Step 2. Paste a list, send up to four photos, or a Google Sheet link. Then read every name in the draft.",
          },
        },
        {
          heading: "Review the card, then tap Create",
          content: "After the list, the chat asks for a group split, a playoff shape when more than one bracket is possible, a name, and optionally courts and a start time. Time is only asked when you set courts. The review card shows the name, the format, the groups, and the time. Read it. Use Edit in the draft if a name or a group is wrong. Tap Create tournament only when the card matches the event. One bracket per finishing place is available when you ask for it: 1st to A, 2nd to B, and so on, up to eight brackets.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-3-en.webp",
            alt: "Review card for Saturday Night Club with two groups of four and a Create tournament button",
            caption: "Step 3. The review card is the last check. Create writes the draw.",
          },
        },
        {
          heading: "Send the link to the group",
          content: "After Create, Open tournament goes to the draw. Copy link is the page for the schedule and results. Copy group-chat message pastes the group names plus that link, ready for a group chat. The conversation itself stays on this device. A tournament already created is not deleted if you start over.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-4-en.webp",
            alt: "Success card with Open tournament, Copy link, and Copy group-chat message",
            caption: "Step 4. Copy the link, or the group-chat message, and send it to the players.",
          },
          internalLinks: [
            { text: "Round-robin sizes, from 4 players up", path: "/blog/how-to-create-pickleball-bracket" },
          ],
        },
        {
          heading: "Worked example: 44 teams, 11 groups, 2 or 3 brackets",
          content: "Forty-four doubles teams split into 11 groups of 4. Each group plays a round robin of 6 matches, so the group stage is 66 matches. Two brackets, on the default rule: the first takes 1st and 2nd from all 11 groups (22 teams) plus the 10 best 3rd-place teams, which is 32 teams and a full bracket of 32. The other 12 teams go to the second bracket, a bracket of 16 with 4 byes. Three brackets are not available on that default rule, because a group of 4 has no 5th place. To get three, set the sizes: 16 in the first bracket, then 14 and 14, with 2 byes in each of the last two. Tie-break rules for equal wins are in the group-draw guide, not repeated here.",
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
      title: "Tạo giải pickleball bằng AI: dán danh sách Zalo, tối đa 48 đội",
      metaTitle: "Tạo giải AI pickleball | Dán danh sách Zalo",
      metaDescription: "44 đội, 11 bảng, rồi 2 hoặc 3 nhánh. AI ThePickleHub đọc ảnh hoặc tin Zalo. Tối đa 48 đội. 20/10/2026.",
      howToSteps: [
        { name: "Chọn đôi hoặc đơn", text: "Mở chat và bấm Đôi hoặc Đơn." },
        { name: "Dán danh sách hoặc gửi ảnh", text: "Mỗi dòng một đội, nhiều ảnh, hoặc link Google Sheet để quyền bất kỳ ai có link. Mở Bản nháp và đọc từng tên." },
        { name: "Xem thẻ rồi bấm Tạo giải", text: "Chọn cách chia bảng hợp lệ, đặt tên, rồi bấm Tạo giải trên thẻ kiểm tra." },
        { name: "Gửi link", text: "Copy link, hoặc copy tin Zalo có tên từng bảng." },
      ],
      sections: [
        {
          heading: "Mở chat",
          content: "Cập nhật lần cuối: 20/10/2026. AI của ThePickleHub tại https://www.thepicklehub.net/vi/tools/quick-tables/chat đọc danh sách dán, ảnh hoặc file Excel và tạo giải vòng bảng pickleball cho tối đa 48 đội đánh đôi hoặc 48 VĐV đánh đơn. 44 đội là 11 bảng 4 đội, rồi 2 nhánh (32 và 12) hoặc 3 nhánh (16, 14 và 14). Bạn đăng nhập, gửi danh sách, đọc từng tên trong Bản nháp, rồi bấm Tạo giải. Bản tiếng Anh nằm ở https://www.thepicklehub.net/tools/quick-tables/chat. Tên đọc sai thì sửa trong Bản nháp trước khi đi tiếp.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-1.webp",
            alt: "Màn chat hỏi đánh đôi hay đánh đơn, chip Đôi đang được chọn, ô nhắn ở dưới",
            caption: "Bước 1. Bấm Đôi hoặc Đơn.",
          },
        },
        {
          heading: "Dán danh sách, rồi đọc từng tên",
          content: "Dán danh sách, hoặc gửi ảnh — tối đa bốn ảnh một lần, khi một ảnh không hết tên. Mỗi dòng một đội, viết kiểu “Nam - Hùng”. Ảnh chụp tin nhắn, ảnh danh sách viết tay, PDF, Excel, CSV, TSV, file chữ, hoặc link Google Sheet đều đọc được, tối đa 4 MB. Sheet phải để quyền “Bất kỳ ai có đường liên kết”. File không có tên đội thì chat báo lại và giữ nguyên danh sách đang có. Câu “Đã nhận N đội” không phải là danh sách. Mở Bản nháp ở trên và đọc từng tên. Tên sai thì sửa tại đó, rồi mới trả lời câu tiếp theo. Ảnh hoặc file gửi sau được cộng thêm, không xoá tên đã có. Chat chỉ đưa cách chia có 3 đến 8 đội mỗi bảng, tối đa 16 bảng.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-2.webp",
            alt: "Bản nháp mở với bốn tên đội, bong bóng danh sách vừa dán, và chip 1 bảng vòng tròn",
            caption: "Bước 2. Dán danh sách, gửi tối đa bốn ảnh, hoặc link Google Sheet. Rồi đọc từng tên trong Bản nháp.",
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
          heading: "Ví dụ 44 đội, 11 bảng, 2 hoặc 3 nhánh",
          content: "44 đội đánh đôi chia thành 11 bảng, mỗi bảng 4 đội. Mỗi bảng đấu vòng tròn 6 trận, vòng bảng của cả giải là 66 trận. Hai nhánh theo luật mặc định: nhánh đầu lấy nhất và nhì của cả 11 bảng (22 đội) cộng 10 đội hạng 3 tốt nhất, thành 32 đội, đúng một cây 32. 12 đội còn lại vào nhánh sau, cây 16, 4 đội xếp cao được miễn vòng 1. Ba nhánh theo luật mặc định không chia được, vì bảng 4 đội không có hạng 5. Muốn 3 nhánh thì đặt cỡ: nhánh đầu 16 đội, hai nhánh sau mỗi nhánh 14 đội, mỗi nhánh 2 suất miễn vòng 1. Luật xếp hạng khi bằng điểm nằm ở bài chia bảng, không lặp lại ở đây.",
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
