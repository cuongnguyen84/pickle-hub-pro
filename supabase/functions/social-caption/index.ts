// ============================================================================
// social-caption — Gemini caption generator for FB Page posts
//
// Proxy endpoint that the `social-poster` Cloudflare Worker calls instead of
// hitting Gemini directly. Workaround for FAILED_PRECONDITION "User location
// is not supported" errors when Gemini API rejects Cloudflare-edge IP ranges
// on the free tier. Supabase Edge Functions (Tokyo) are whitelisted (proven
// by the existing news-translate function).
//
// verify_jwt = false in supabase/config.toml; auth is via shared
// SOCIAL_POSTER_SECRET header to match the Worker.
//
// Request:
//   POST /functions/v1/social-caption
//   Header: X-Auth-Secret: $SOCIAL_POSTER_SECRET
//   Body: {
//     title: string,
//     summary: string | null,
//     content_html: string | null,
//     category: string | null,
//     link: string                  // canonical /vi/news/{slug} URL
//   }
//
// Response (200): { caption: string, model: string }
// Response (4xx/5xx): { error: string }
// ============================================================================

import { socialCaptionCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const SOCIAL_POSTER_SECRET = Deno.env.get("SOCIAL_POSTER_SECRET") ?? "";

interface RequestBody {
  title: string;
  summary: string | null;
  content_html: string | null;
  category: string | null;
  link: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function htmlToPlainText(html: string): string {
  // Same as workers/social-poster — kept in sync.
  let out = html;
  let prev: string;
  let i = 0;
  do {
    prev = out;
    out = out.replace(/<[^<>]*>/g, "");
    i++;
  } while (out !== prev && i < 10);
  out = out.replace(/[<>]/g, "");
  const entities: Record<string, string> = {
    "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">",
    "&quot;": '"', "&#39;": "'", "&apos;": "'",
  };
  out = out.replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => entities[m] ?? m);
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

function buildPrompt(item: RequestBody): string {
  const bodyText = htmlToPlainText(item.content_html ?? item.summary ?? "").slice(0, 1500);
  return `Bạn là chuyên gia content pickleball cho Facebook Page ThePickleHub (cộng đồng pickleball Việt Nam).

NHIỆM VỤ: Viết bài đăng Facebook bằng tiếng Việt từ tin tức bên dưới. Mục tiêu: tăng engagement, kéo traffic về website.

NGUYÊN TẮC:
- 100% tiếng Việt. Giữ nguyên thuật ngữ tiếng Anh phổ thông (dink, drive, drop, erne, ATP, stacking, rally, match point, PPA, MLP, APP). Giữ nguyên tên người + tên giải.
- Tone chuyên nghiệp, chuẩn báo chí thể thao. Câu ngắn, có nhịp. Không clickbait rẻ tiền.
- Cấu trúc: Hook 1-2 câu → Thân bài 1-2 đoạn → CTA → 3-5 hashtag cuối.
- Tổng độ dài 150-300 từ. Dùng 3-5 emoji phù hợp ngữ cảnh để bài sinh động hơn; đây là yêu cầu bắt buộc.
- Đặt 1 emoji nổi bật ở hook, 1-2 emoji làm điểm dẫn ở đầu đoạn hoặc trước ý quan trọng, và có thể dùng 1 emoji ở CTA. Ưu tiên emoji thể thao/cảm xúc liên quan trực tiếp như 🏓, 🔥, 🎯, 💪, 🏆, 👀, 📌, 📣, 🤔.
- Phân bổ emoji tự nhiên trong toàn bài, không dồn thành chuỗi, không lặp một emoji quá 2 lần, không chèn giữa tên người/tên giải/số liệu và không dùng emoji thay cho từ mang thông tin.
- Không dùng biểu tượng gây hiểu nhầm mức độ tin như 🚨 nếu tin gốc không phải cảnh báo hoặc tin khẩn. Không lạm dụng hashtag.
- KHÔNG bịa số liệu. Chỉ dùng thông tin trong tin gốc.
- KHÔNG chèn URL vào caption; hệ thống sẽ tự đăng link ở bình luận đầu tiên.

HOOK — PHẢI LÀ PHẦN MẠNH NHẤT CỦA BÀI:
- Viết hook theo tư duy T = D + I + C + K. Không cần ghi nhãn D/I/C/K trong output.
- D (Đối tượng): gọi đúng một nhóm độc giả pickleball thật cụ thể được suy ra từ tin, ví dụ: người theo dõi PPA, fan của VĐV được nhắc tới, người chơi phong trào hay đánh đôi, tay vợt đang tập chiến thuật xuất hiện trong bài. Cấm gọi chung chung kiểu “mọi người”, “các bạn”, “khách hàng”.
- I (Insight): chạm đúng một nỗi đau, bế tắc, mong muốn hoặc cảm xúc mà nhóm đó thực sự có liên quan đến nội dung tin. Không tự suy diễn insight không có cơ sở.
- C (Concept): chọn MỘT góc truyền thông phù hợp nhất để tạo tò mò — bật mí/bí mật, con số cụ thể, tranh cãi/đi ngược đám đông, nghịch lý, câu hỏi sắc, cảnh báo, so sánh, khoảnh khắc quyết định hoặc phát hiện bất ngờ. Ưu tiên chi tiết thật trong tin; tuyệt đối không bịa con số.
- K (Khác): thêm một chi tiết ngoại cảnh, hệ quả, mốc thời gian, tên VĐV/giải hoặc hậu tố ngắn để câu hook cụ thể và thuyết phục hơn.

QUY TRÌNH SUY NGHĨ TRƯỚC KHI VIẾT HOOK (thực hiện thầm, không in ra):
1. Chốt đúng một thông điệp quan trọng nhất của tin.
2. Chọn đúng một nhóm đối tượng cụ thể nhất.
3. Viết câu nháp = thông điệp + concept truyền thông.
4. “Lắp” hình thức gây chú ý bằng cách đổi góc nhìn, nhịp câu hoặc cách xưng hô có chủ đích; phải tự nhiên với cộng đồng pickleball và giọng của một fanpage thể thao.
5. Cá nhân hóa từng cụm từ, loại bỏ chữ thừa và nâng góc nhìn để hook sắc hơn cách đưa tin thông thường.

TIÊU CHUẨN HOOK ĐẦU RA:
- Hook dài 1-2 câu, xuất hiện ngay dòng đầu; ưu tiên dưới 35 từ.
- Phải khiến đúng đối tượng muốn đọc tiếp nhưng vẫn phản ánh trung thực nội dung tin.
- Có thể sắc bén, lạ hoặc đi ngược góc nhìn quen thuộc; không dùng “tao/mày”, xúc phạm, cố tình sai chính tả, giật gân, hứa hẹn quá mức hay gán cảm xúc cho toàn bộ cộng đồng.
- Không mở bài bằng cách lặp nguyên tiêu đề. Không dùng các câu rỗng như “Tin nóng đây!”, “Bạn có biết?”, “Không thể tin được!”.
- Tự kiểm tra: D đã đủ cụ thể chưa, I có thật không, C có tạo tò mò không, K có tăng sức nặng không? Nếu thiếu, viết lại hook rồi mới hoàn thiện bài.

CTA — CHỌN ĐÚNG THEO MỤC TIÊU VÀ KHẢ NĂNG THẬT CỦA FANPAGE:
- Trước khi viết, xác định MỘT hành động chính phù hợp nhất với tin. CTA phải gồm: động từ hành động + lợi ích/lý do cụ thể + chỉ dẫn rõ ràng. Không ghi tên loại CTA trong output.
- Mặc định ưu tiên Link Click để kéo traffic: “Xem diễn biến/chi tiết/phân tích đầy đủ ở link trong bình luận đầu tiên.” Luôn nói “bình luận đầu tiên”, không nói “link bio” và không chèn URL vào caption.
- Thu comment khi nội dung có góc tranh luận, dự đoán hoặc lựa chọn: đặt MỘT câu hỏi cụ thể, dễ trả lời bằng quan điểm thật, ví dụ chọn VĐV, dự đoán kết quả hoặc đồng ý/không đồng ý. Không dụ comment bằng từ khóa để nhận quà/tài liệu vì hệ thống không tự gửi tài liệu.
- Tăng follow chỉ khi có lý do tiếp nối thật như giải đang diễn ra, series tin hoặc kết quả sắp cập nhật: “Theo dõi ThePickleHub để không bỏ lỡ kết quả/diễn biến tiếp theo của …”. Không hứa “phần tiếp theo” nếu chưa có căn cứ.
- Kêu gọi chia sẻ khi tin hữu ích trực tiếp cho một nhóm rõ ràng: “Gửi bài này cho đồng đội/fan … đang cần biết …”. Kêu gọi lưu bài chỉ với nội dung hướng dẫn, lịch, danh sách hoặc phân tích có giá trị xem lại.
- Kêu gọi hành động thực tế chỉ khi bài có bước người đọc thật sự làm được, như xem lịch, theo dõi trận, đăng ký giải hoặc thử một chiến thuật. Nêu bước nhỏ và cụ thể.
- Chỉ dùng Urgency khi tin gốc có hạn chót, số chỗ hoặc thời điểm kết thúc xác thực. Phải nêu đúng dữ kiện; cấm tự tạo khan hiếm kiểu “suất cuối”, “chỉ còn 24 giờ”, “đăng ký ngay” nếu nguồn không nói.
- Không dùng CTA inbox/DM, tham gia group/classroom, nhận template/checklist/tài liệu, comment-to-get, nhận quà hoặc đăng ký nếu fanpage và tin gốc không thực sự cung cấp điều đó.
- Không công khai mục tiêu nội bộ kiểu “giúp page đạt 500 comment/300 follow”. Không yêu cầu nhiều hành động liên tiếp như vừa follow, vừa share, vừa comment, vừa bấm link.
- Với bài tin tức thông thường: dùng 1 CTA link chính; có thể thêm đúng 1 câu hỏi thảo luận ngắn ngay trước đó nếu câu hỏi bám sát nội dung. Tổng CTA tối đa 2 câu.
- Tự kiểm tra: hành động này có làm được ngay không, lợi ích có thật không, fanpage có thực hiện đúng lời hứa không? Nếu không, đổi sang CTA xem link ở bình luận đầu tiên.

ĐỊNH DẠNG OUTPUT: Chỉ trả về nội dung bài đăng (không tiêu đề meta, không markdown, không tag "BÀI ĐĂNG FACEBOOK"). Bài phải có 3-5 emoji được phân bổ tự nhiên theo quy tắc trên và kết thúc bằng 3-5 hashtag.

--- TIN GỐC ---
Tiêu đề: ${item.title}
Hạng mục: ${item.category ?? "general"}
Tóm tắt: ${item.summary ?? "(không có)"}

Nội dung:
${bodyText || "(không có nội dung — dựa vào tiêu đề và tóm tắt)"}
--- HẾT TIN GỐC ---

Viết bài đăng:`;
}

function sanitizeCaption(text: string): string {
  let out = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  out = out.replace(/^📝?\s*BÀI ĐĂNG FACEBOOK.*$/im, "").trim();
  out = out.replace(/\n{3,}/g, "\n\n");
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const provided = req.headers.get("x-auth-secret") ?? "";
  if (!SOCIAL_POSTER_SECRET || provided !== SOCIAL_POSTER_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  if (!GEMINI_API_KEY) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (!body?.title || !body?.link) {
    return json({ error: "Missing required fields: title, link" }, 400);
  }

  const prompt = buildPrompt(body);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.75, topP: 0.9, maxOutputTokens: 600 },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      ],
    }),
  });

  if (!geminiRes.ok) {
    const text = await geminiRes.text();
    return json({ error: `Gemini ${geminiRes.status}: ${text}` }, 502);
  }

  const data = await geminiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return json({ error: "Gemini returned empty caption" }, 502);

  return json({ caption: sanitizeCaption(text), model: GEMINI_MODEL });
});
