// Gọi Gemini với chuỗi model dự phòng — dùng chung cho chat tạo giải và trợ lý nổi.
// Model chính hay báo 503 "high demand" → thử lần lượt model dự phòng (lite cuối cùng).

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";

export const geminiConfigured = () => GEMINI_API_KEY !== "";

export async function callGemini(
  primary: string,
  payload: string,
  opts: { budgetMs: number; perModelMs: number; tag: string },
): Promise<{ text: string | null; error: string }> {
  const models = [...new Set([primary, "gemini-2.5-flash", "gemini-flash-lite-latest"])];
  const deadline = Date.now() + opts.budgetMs;
  let lastErr = "";
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 3_000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        signal: AbortSignal.timeout(Math.min(left, opts.perModelMs)),
        body: payload,
      });
      if (res.ok) {
        const data = await res.json();
        return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null, error: "" };
      }
      lastErr = `${model} ${res.status} ${(await res.text()).slice(0, 300)}`;
      if (res.status === 400) break; // lỗi request, model khác cũng vậy
    } catch (err) {
      lastErr = `${model} ${String(err).slice(0, 200)}`;
    }
    console.error(`[${opts.tag}] gemini`, lastErr);
  }
  return { text: null, error: lastErr || "no_model" };
}
