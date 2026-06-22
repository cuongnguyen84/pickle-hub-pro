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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-auth-secret, apikey, x-client-info",
  "Content-Type": "application/json",
};

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
- Tổng độ dài 150-300 từ. Tối đa 2-3 emoji. Không lạm dụng hashtag.
- KHÔNG bịa số liệu. Chỉ dùng thông tin trong tin gốc.
- Kết bài luôn mời người đọc bấm link để đọc đầy đủ.

ĐỊNH DẠNG OUTPUT: Chỉ trả về nội dung bài đăng (không tiêu đề meta, không markdown, không tag "BÀI ĐĂNG FACEBOOK"). Kết thúc bằng 3-5 hashtag.

LINK PHẢI CHÈN NGUYÊN VĂN VÀO CUỐI THÂN BÀI (trước hashtag):
${item.link}

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
