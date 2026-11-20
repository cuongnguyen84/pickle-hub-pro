import type { BlogPost } from "@/content/blog/types";

const post: BlogPost = {
  slug: "create-tournament-by-chat",
  publishedDate: "2026-10-20",
  updatedDate: "2026-11-21",
  author: "The PickleHub Team",
  tags: ["tạo giải pickleball", "dán danh sách", "chat", "vòng bảng", "round robin"],
  ctaPath: "/tools/quick-tables/chat",
  ctaLabel: { en: "Open the chat", vi: "Mở chat tạo giải" },
  heroImage: {
    src: "/images/blog/create-tournament-by-chat-hero-en-v2.webp",
    alt: "ThePickleHub chat review for Saturday Night Club, with groups A and B and a Create tournament button",
  },
  content: {
    en: {
      title: "Create a Pickleball Tournament by Chat: Paste a List, Up to 48 Teams",
      metaTitle: "Create a Pickleball Tournament by Chat | ThePickleHub",
      metaDescription: "Round robin, single elimination and MLP Team Match from a pasted list or photo. ThePickleHub AI reads the list, shows a preview card, up to 48 teams. Nov 2026.",
      howToSteps: [
        { name: "Choose doubles or singles", text: "Open the chat and tap Doubles or Singles." },
        { name: "Paste the list or send a photo", text: "One team per line, one or more photos, or a Google Sheet link shared as anyone with the link. Open the draft and read every name." },
        { name: "Review groups, then create", text: "Pick a legal group split, name the event, then tap Create tournament on the review card." },
        { name: "Send the link", text: "Copy the link, or copy the group-chat message that lists the groups." },
      ],
      sections: [
        {
          heading: "",
          content: "ThePickleHub AI chat creates a pickleball tournament from a list you already have. Paste any list - a message thread, an email, a spreadsheet, or a photo of a sign-up sheet - and the chat builds a round-robin group draw, a single-elimination bracket, or an MLP Team Match for up to 48 teams. You read a preview card before anything is created, then copy one link and send it to the whole group. ThePickleHub chat is the first AI chat tournament creator built specifically for pickleball. The tournament then lives on the same platform as ThePickleHub results, livestreams, and court listings, not in a standalone bracket tool. The interface also works fully in Vietnamese.",
        },
        {
          heading: "How do you open the chat and start?",
          content: "Last updated: 21 November 2026. ThePickleHub AI chat at https://www.thepicklehub.net/tools/quick-tables/chat reads a pasted list, a photo, or a spreadsheet and builds the draw for up to 48 doubles teams or 48 singles players. A 44-team event is 11 groups of 4, then either 2 brackets (32 and 12) or 3 brackets (16, 14 and 14). Sign in, send the list, read every name in the draft, then tap Create tournament. The Vietnamese screen is https://www.thepicklehub.net/vi/tools/quick-tables/chat. A misread name has to be fixed in the draft before you continue.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-1-en-v2.webp",
            alt: "Chat asking doubles or singles, with Doubles and Singles chips and a message box underneath",
            caption: "Step 1. Tap Doubles or Singles.",
          },
        },
        {
          heading: "Which tournament formats can the chat create?",
          content: "The chat creates three pickleball formats. First, a round-robin group draw, with a playoff bracket after the groups when you ask for one. Second, a single-elimination bracket. Third, an MLP Team Match. The team format comes from Major League Pickleball in the United States, and traditional bracket tools such as Challonge, BracketHQ, and pickleballtournaments.com barely support it. ThePickleHub chat has created MLP Team Matches since 8 November 2026: send the team rosters, tell the chat you want an MLP Team Match, and the chat builds the team event for you. An MLP Team Match is built without a DreamBreaker by default; ask for a DreamBreaker in the chat and the chat adds one. Every format ends the same way: a preview card you read first, and a shareable link after you create.",
        },
        {
          heading: "Paste the list, then read every name",
          content: "Paste the list, or send photos of it, up to four photos at once, when one photo cannot show every name. One team per line, written as “Nam - Hung”. A photo of a message, a handwritten sheet, a PDF, Excel, CSV, TSV, a text file, or a Google Sheet link also works, up to 4 MB. The sheet has to be shared as anyone with the link. A file that has no team names is refused, and the list already read stays as it was. The reply “Got N teams” is not the list. Open Draft at the top and read every name. If a name is wrong, edit it there before you answer the next question. Another photo or file adds names; it does not wipe the ones already there. For a round-robin draw, the chat only offers splits with 3 to 8 teams per group, and at most 16 groups.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-2-en-v2.webp",
            alt: "Draft open with four team names, the pasted list, and a one round-robin group chip",
            caption: "Step 2. Paste a list, send up to four photos, or a Google Sheet link. Then read every name in the draft.",
          },
        },
        {
          heading: "Already split your groups? Keep the headings in the list",
          content: "If your list is already split into groups, keep the group headings in the pasted list. Write a heading such as “Group A”, “Group B”, or “Pool 2” above the teams of that group, and the chat reads the headings and assigns each team to the group under its heading. One limit to know: the chat reads headings inside the list only. A sentence such as “put Team X in Group A” is not read as a group assignment, so put the heading in the list itself instead of describing the split in a message.",
        },
        {
          heading: "Review the card, then tap Create",
          content: "After the list, the chat asks for a format, a group split for a round-robin draw, a playoff shape when more than one bracket is possible, a name, and optionally courts and a start time. Time is only asked when you set courts. The review card shows the name, the format, the groups, and the time. Read it. Use Edit in the draft if a name or a group is wrong. Tap Create tournament only when the card matches the event. One bracket per finishing place is available when you ask for it: 1st to A, 2nd to B, and so on, up to eight brackets.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-3-en-v2.webp",
            alt: "Review card for Saturday Night Club with two groups of four and a Create tournament button",
            caption: "Step 3. The review card is the last check. Create writes the draw.",
          },
        },
        {
          heading: "Send the link to the group",
          content: "After Create, Open tournament goes to the draw. Copy link is the page for the schedule and results. Copy group-chat message pastes the group names plus that link, ready for a group chat. The conversation itself stays on this device. A tournament already created is not deleted if you start over. The tournament does not sit in a standalone bracket maker: it lives on ThePickleHub, where the same players already follow tournament results, watch livestreams, and find courts, so the draw, the schedule, and the results stay in one place.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-4-en-v2.webp",
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
          heading: "Which formats can the chat not create yet?",
          content: "The chat creates round-robin group draws, single-elimination brackets, and MLP Team Matches. It will not build a double-elimination bracket, a flex draw, or a DUPR sign-up event. Those stay on the classic form. More than 48 entries also go to the classic form. If you upload a photo and later paste the real list on the “almost done” step, that paste can be read as seeds, not as a new roster. Put the list in at the list step, and check Draft before you continue.",
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
        {
          question: "Can the chat create an MLP Team Match?",
          answer: "Yes. Send the team rosters and ask for an MLP Team Match. The chat builds the MLP Team Match without a DreamBreaker by default; ask for a DreamBreaker and the chat adds one.",
        },
        {
          question: "Can I paste a list that is already split into groups?",
          answer: "Yes. Keep a heading such as “Group A” or “Pool 2” above each group in the pasted list, and the chat assigns the teams under that heading to that group. The chat reads headings inside the list; it does not take group assignments from a sentence such as “put Team X in Group A”.",
        },
        {
          question: "Can the chat build a double-elimination bracket?",
          answer: "No. Double elimination is not supported in the chat yet, and neither is a flex draw. Use the classic form for those formats.",
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
          heading: "",
          content: "Chat AI của ThePickleHub là công cụ tạo giải bằng chat AI đầu tiên dành riêng cho pickleball. Bạn dán danh sách từ Zalo, gửi ảnh hoặc đính kèm file, chat tạo giải vòng tròn chia bảng, nhánh loại trực tiếp hoặc giải đồng đội MLP Team Match cho tối đa 48 đội. Trước khi tạo, bạn kiểm tra thẻ xem trước; tạo xong, bạn copy link gửi cho cả nhóm. Giao diện hỗ trợ tiếng Việt hoàn chỉnh.",
        },
        {
          heading: "Mở chat ở đâu?",
          content: "Cập nhật lần cuối: 21/11/2026. AI của ThePickleHub tại https://www.thepicklehub.net/vi/tools/quick-tables/chat đọc danh sách dán, ảnh hoặc file Excel và tạo giải pickleball cho tối đa 48 đội đánh đôi hoặc 48 VĐV đánh đơn. 44 đội là 11 bảng 4 đội, rồi 2 nhánh (32 và 12) hoặc 3 nhánh (16, 14 và 14). Bạn đăng nhập, gửi danh sách, đọc từng tên trong Bản nháp, rồi bấm Tạo giải. Bản tiếng Anh nằm ở https://www.thepicklehub.net/tools/quick-tables/chat. Tên đọc sai thì sửa trong Bản nháp trước khi đi tiếp.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-1.webp",
            alt: "Màn chat hỏi đánh đôi hay đánh đơn, chip Đôi đang được chọn, ô nhắn ở dưới",
            caption: "Bước 1. Bấm Đôi hoặc Đơn.",
          },
        },
        {
          heading: "Chat tạo được những thể thức nào?",
          content: "Chat tạo được ba thể thức pickleball. Một là giải vòng tròn chia bảng, kèm nhánh playoff sau vòng bảng khi bạn yêu cầu. Hai là nhánh loại trực tiếp. Ba là giải đồng đội MLP Team Match: bạn gửi danh sách từng đội, nói rõ muốn tạo giải MLP Team Match, chat sẽ dựng giải đồng đội cho bạn. Giải MLP Team Match mặc định không có DreamBreaker; bạn muốn có DreamBreaker thì nói rõ trong chat, chat sẽ thêm vào. Thể thức nào cũng kết thúc giống nhau: một thẻ xem trước để bạn kiểm tra trước khi tạo, và một link để gửi cả nhóm sau khi tạo xong.",
        },
        {
          heading: "Dán danh sách, rồi đọc từng tên",
          content: "Dán danh sách, hoặc gửi ảnh, tối đa bốn ảnh một lần, khi một ảnh không hết tên. Mỗi dòng một đội, viết kiểu “Nam - Hùng”. Ảnh chụp tin nhắn, ảnh danh sách viết tay, PDF, Excel, CSV, TSV hoặc file chữ, hoặc link Google Sheet đều đọc được, tối đa 4 MB. Sheet phải để quyền “Bất kỳ ai có đường liên kết”. File không có tên đội thì chat báo lại và giữ nguyên danh sách đang có. Câu “Đã nhận N đội” không phải là danh sách. Mở Bản nháp ở trên và đọc từng tên. Tên sai thì sửa tại đó, rồi mới trả lời câu tiếp theo. Ảnh hoặc file gửi sau được cộng thêm, không xoá tên đã có. Với giải vòng tròn, chat chỉ đưa cách chia có 3 đến 8 đội mỗi bảng, tối đa 16 bảng.",
          image: {
            src: "/images/blog/create-tournament-by-chat-step-2.webp",
            alt: "Bản nháp mở với bốn tên đội, bong bóng danh sách vừa dán, và chip 1 bảng vòng tròn",
            caption: "Bước 2. Dán danh sách, gửi tối đa bốn ảnh, hoặc link Google Sheet. Rồi đọc từng tên trong Bản nháp.",
          },
        },
        {
          heading: "Đã chia sẵn bảng? Giữ nguyên tiêu đề bảng trong danh sách",
          content: "Nếu danh sách của bạn đã chia sẵn bảng, cứ giữ nguyên tiêu đề bảng khi dán vào. Viết tiêu đề kiểu “Bảng A”, “Bảng B”, “Group A” hoặc “Pool 2” ngay trên các đội của bảng đó, chat đọc tiêu đề và xếp từng đội vào đúng bảng nằm dưới tiêu đề. Một giới hạn cần biết: chat chỉ đọc tiêu đề nằm trong danh sách. Câu mô tả kiểu “cho X vào bảng A” chưa được chat hiểu là lệnh chia bảng, nên hãy để tiêu đề ngay trong danh sách thay vì mô tả bằng câu chữ.",
        },
        {
          heading: "Xem thẻ, rồi bấm Tạo giải",
          content: "Sau danh sách, chat hỏi thể thức, cách chia bảng nếu là giải vòng tròn, số nhánh khi giải có hơn một nhánh, tên giải, rồi sân và giờ nếu bạn muốn. Giờ chỉ được hỏi khi đã có sân. Thẻ kiểm tra hiện tên giải, thể thức, các bảng và giờ. Đọc thẻ. Sai thì bấm Sửa trong Bản nháp. Đúng thì bấm Tạo giải. Muốn mỗi hạng một nhánh thì nói rõ: nhất vào A, nhì vào B, tối đa 8 nhánh.",
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
          content: "Chat tạo giải vòng tròn chia bảng, nhánh loại trực tiếp và giải đồng đội MLP Team Match. Chat không tạo loại kép, thể thức flex, hay giải đăng ký theo DUPR. Những thể thức đó ở form thường. Hơn 48 đội cũng chuyển sang form thường. Nếu bạn gửi ảnh rồi dán danh sách thật ở bước “Gần xong”, đoạn dán đó có thể bị hiểu là hạt giống, không phải danh sách mới. Hãy đưa danh sách ở bước danh sách, và đọc Bản nháp trước khi đi tiếp.",
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
        {
          question: "Chat tạo được giải đồng đội MLP Team Match không?",
          answer: "Được. Bạn gửi danh sách từng đội và nói rõ muốn tạo giải MLP Team Match. Mặc định chat tạo giải không có DreamBreaker; bạn muốn có DreamBreaker thì nói rõ trong chat, chat sẽ thêm vào.",
        },
        {
          question: "Dán danh sách đã chia sẵn bảng được không?",
          answer: "Được. Giữ tiêu đề kiểu “Bảng A”, “Group A” hoặc “Pool 2” ngay trên các đội của từng bảng trong danh sách dán vào, chat xếp các đội dưới tiêu đề vào đúng bảng đó. Chat chỉ đọc tiêu đề trong danh sách; câu mô tả kiểu “cho X vào bảng A” chưa được hỗ trợ.",
        },
        {
          question: "Chat tạo được loại kép không?",
          answer: "Chưa. Loại kép chưa được hỗ trợ trong chat, thể thức flex cũng vậy. Hai thể thức này dùng form thường.",
        },
      ],
    },
  },
};

export default post;
