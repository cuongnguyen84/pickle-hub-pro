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
  /**
   * Which surface the caption is for. Absent ⇒ "fb_vi", so every existing
   * caller keeps the Vietnamese Facebook prompt byte for byte. The X prompt is
   * a separate function rather than flags on the FB one on purpose: the two
   * surfaces want opposite things (FB wants a CTA and 3-5 hashtags, X punishes
   * both), and the Facebook pipeline is in production and not to be disturbed.
   */
  mode?: "fb_vi" | "x_en";
  /**
   * One-shot correction appended to the x_en prompt when the caller rejected
   * the previous attempt (e.g. "that was 281 characters, cut it to 200").
   * Ignored by the Facebook prompt.
   */
  retry_hint?: string;
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

/**
 * X (@thepicklehub) post from an English news item. Rules and every number in
 * them come from docs/x-content-playbook.md, which reads them out of
 * home-mixer/params/param.rs in xai-org/x-algorithm (published 2026-08-14).
 *
 * The weights are quoted to the model rather than paraphrased as style advice
 * because they explain WHY each rule exists, and a model that knows a CTA aims
 * at a 0.2-weight action writes differently from one told "no CTA please".
 */
function buildXPrompt(item: RequestBody): string {
  const bodyText = htmlToPlainText(item.content_html ?? item.summary ?? "").slice(0, 1500);
  return `You write posts for @thepicklehub on X. English only.

X publishes the exact weights its "For You" ranker uses. A like is worth 0.5.
A copy-link share is 20.0 (40 likes). A reply is 5.0, or 20.0 from someone who
follows you back. A follow is 4.0. A click is 0.4 and opening a link is 0.2.
Dwell time and profile clicks are 0.0. Bookmarks are not counted at all.

The negative weights decide more than the positive ones. "Not interested" is
-43.2, muting the author is -58.8, a report is -234.0. Against a 0.5 like, one
"not interested" costs 86 likes — a post needs 87 likes just to break even on a
single tap. Promotional writing is what earns that tap.

So: write for a reply or a copy-link share. Never for a click.

HARD RULES — breaking any one of these makes the post unusable:
- No URL, no domain, not even spelled out ("thepicklehub dot net" is banned too).
- No call to action of any kind. No "read more", "full story", "check out",
  "link in bio", "thread below", "follow us for more", "swipe up".
- No engagement bait. No "like if you agree", "RT to spread", "comment your
  pick below".
- No emoji-arrow teasing (👇 ➡️) pointing at something to click.
- At most ONE hashtag, and only if a real event tag exists. Hashtags carry no
  weight, so the default is zero.
- ALWAYS use digits for numbers, scores, streaks and seeds. Write "21-10", not
  "twenty-one to ten". Write "13-match winning streak", not "thirteen-match".
  Write "3-1", "2-0", "No. 5 seed". Spelled-out numbers read wrong for sport
  and waste characters you do not have.
- Aim for 180-240 characters. 280 is a hard ceiling, not a target: a post over
  it is discarded unread, and the last draft that tried came in at 281.
- At least one concrete detail from the source: a name, a score, a number.
  Never "great match", "exciting news", "big win".
- Every fact must come from the source text below. Invent nothing. If the
  source does not give a score or a number, do not produce one.

The post must stand on its own. A reader who taps nothing should still receive
a complete piece of information — that is the whole product, not a trailer for
one.

Shape: lead with the single hardest fact. If a second line adds a non-obvious
angle, add it after a blank line. If the story genuinely divides opinion, you
may end with one real question — a question you would actually want answered,
not a prompt for engagement.

OUTPUT: the post text only. No quotes around it, no preamble, no markdown, no
explanation.
${item.retry_hint ? `\nCORRECTION FOR THIS ATTEMPT: ${item.retry_hint}\n` : ''}
--- SOURCE ---
Title: ${item.title}
Category: ${item.category ?? "general"}
Summary: ${item.summary ?? "(none)"}

Body:
${bodyText || "(no body — work from the title and summary)"}
--- END SOURCE ---

Write the post:`;
}

function buildPrompt(item: RequestBody): string {
  if (item.mode === "x_en") return buildXPrompt(item);
  const bodyText = htmlToPlainText(item.content_html ?? item.summary ?? "").slice(0, 1500);
  return `Bạn là chuyên gia content pickleball cho Facebook Page ThePickleHub (cộng đồng pickleball Việt Nam).

NHIỆM VỤ: Viết bài đăng Facebook bằng tiếng Việt từ tin tức bên dưới. Mục tiêu: tăng engagement, kéo traffic về website.

NGUYÊN TẮC:
- 100% tiếng Việt. Giữ nguyên thuật ngữ tiếng Anh phổ thông (dink, drive, drop, erne, ATP, stacking, rally, match point, PPA, MLP, APP). Giữ nguyên tên người + tên giải.
- Tone chuyên nghiệp, chuẩn báo chí thể thao. Câu ngắn, có nhịp. Không clickbait rẻ tiền.
- Cấu trúc: Hook 1-2 câu → Thân bài 1-2 đoạn → CTA → 3-5 hashtag cuối.
- Tổng độ dài 150-300 từ. Tối đa 2-3 emoji. Không lạm dụng hashtag.
- KHÔNG bịa số liệu. Chỉ dùng thông tin trong tin gốc.
- Kết bài mời người đọc xem đường dẫn ở bình luận đầu tiên.
- KHÔNG chèn URL vào caption; hệ thống sẽ tự đăng link ở bình luận đầu tiên.

ĐỊNH DẠNG OUTPUT: Chỉ trả về nội dung bài đăng (không tiêu đề meta, không markdown, không tag "BÀI ĐĂNG FACEBOOK"). Kết thúc bằng 3-5 hashtag.

--- TIN GỐC ---
Tiêu đề: ${item.title}
Hạng mục: ${item.category ?? "general"}
Tóm tắt: ${item.summary ?? "(không có)"}

Nội dung:
${bodyText || "(không có nội dung — dựa vào tiêu đề và tóm tắt)"}
--- HẾT TIN GỐC ---

Viết bài đăng:`;
}

function sanitizeCaption(text: string, mode: RequestBody["mode"] = "fb_vi"): string {
  let out = text.replace(/^```[a-z]*\n?/i, "").replace(/```$/, "").trim();
  out = out.replace(/^📝?\s*BÀI ĐĂNG FACEBOOK.*$/im, "").trim();
  out = out.replace(/\n{3,}/g, "\n\n");
  if (mode === "x_en") {
    // Gemini wraps a short one-shot answer in quotes often enough that it would
    // otherwise burn two of the 280 characters and read as a pull quote. Only
    // strip when BOTH ends match, so a post that legitimately opens with a
    // quoted phrase is left alone.
    const quoted = /^"([\s\S]+)"$/.exec(out) ?? /^'([\s\S]+)'$/.exec(out);
    if (quoted) out = quoted[1].trim();
  }
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
  // `link` is the FB caption's CTA target. X posts carry no link at all, so
  // requiring one there would mean inventing a value to satisfy a check.
  if (!body?.title || (body.mode !== "x_en" && !body?.link)) {
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

  return json({ caption: sanitizeCaption(text, body.mode), model: GEMINI_MODEL });
});
