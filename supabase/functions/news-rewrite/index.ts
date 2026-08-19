import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { cronCorsHeaders as corsHeaders } from "../_shared/cors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { adminSessionAalOk, bearerToken } from "../_shared/admin-aal.ts";

const BATCH_SIZE = 2;
const STALE_MINUTES = 15;
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type ContentKind = "full" | "brief";

interface OriginRow {
  id: string;
  source_id: string | null;
  source_name: string;
  source_url: string;
  raw_title: string;
  raw_summary: string;
  raw_body: string | null;
  content_kind: ContentKind;
  published_at: string;
}

interface LanguageDraft {
  title: string;
  summary: string;
  category: string;
  importance: number;
  sections: Array<{
    heading?: string;
    paragraphs: string[];
  }>;
}

interface RewriteDraft {
  en: LanguageDraft;
  vi: LanguageDraft;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ name: "news-rewrite", status: "ok" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const auth = req.headers.get("authorization") ?? "";
  const authedByService = serviceRole !== "" && auth === `Bearer ${serviceRole}`;
  let authedByAdmin = false;
  if (!authedByService && auth.toLowerCase().startsWith("bearer ")) {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const user = await getAuthUser(req, authClient);
    if (user) {
      const { data: role } = await authClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      authedByAdmin =
        role?.role === "admin" && adminSessionAalOk(user, bearerToken(req));
    }
  }
  if (!authedByService && !authedByAdmin) {
    const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
    if (authError) return authError;
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiKey) return json({ error: "GEMINI_API_KEY not configured" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRole,
  );

  try {
    const result = await runBatch(supabase, geminiKey);
    return json({ ok: result.failed === 0, ...result });
  } catch (error) {
    console.error(
      "[news-rewrite] fatal",
      error instanceof Error ? error.message : String(error),
    );
    return json({ error: "internal_error" }, 500);
  }
});

async function runBatch(supabase: SupabaseClient, geminiKey: string) {
  const staleCutoff = new Date(
    Date.now() - STALE_MINUTES * 60_000,
  ).toISOString();
  await supabase
    .from("news_origins")
    .update({
      pipeline_status: "pending",
      last_error: "Recovered stale rewrite claim",
    })
    .eq("pipeline_status", "rewriting")
    .lt("updated_at", staleCutoff);

  const { data, error } = await supabase.rpc("claim_pending_news_origins", {
    p_batch_size: BATCH_SIZE,
  });
  if (error) throw new Error(`claim failed: ${error.message}`);

  const origins = (data ?? []) as OriginRow[];
  const result = {
    picked: origins.length,
    published: 0,
    failed: 0,
    details: [] as Array<Record<string, unknown>>,
  };

  for (const origin of origins) {
    try {
      const draft = await rewriteOrigin(origin, geminiKey);
      const en = prepareForPublish(draft.en, origin, "en");
      const vi = prepareForPublish(draft.vi, origin, "vi");
      const { data: published, error: publishError } = await supabase.rpc(
        "publish_rewritten_news",
        { p_origin_id: origin.id, p_en: en, p_vi: vi },
      );
      if (publishError) throw new Error(`publish failed: ${publishError.message}`);
      result.published += 1;
      result.details.push({ origin_id: origin.id, status: "published", published });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[news-rewrite] ${origin.id}: ${message}`);
      await markFailed(supabase, origin.id, message);
      result.failed += 1;
      result.details.push({
        origin_id: origin.id,
        status: "failed",
        error: message.slice(0, 200),
      });
    }
  }

  return result;
}

async function rewriteOrigin(
  origin: OriginRow,
  geminiKey: string,
): Promise<RewriteDraft> {
  const range = origin.content_kind === "full" ? "500–800" : "150–250";
  const sourceMaterial = [
    `SOURCE NAME: ${origin.source_name}`,
    `SOURCE TITLE: ${origin.raw_title}`,
    `SOURCE SUMMARY: ${origin.raw_summary}`,
    origin.raw_body ? `SOURCE BODY:\n${origin.raw_body}` : "",
  ].filter(Boolean).join("\n\n");

  const basePrompt = `You are the bilingual editorial desk for ThePickleHub.

Using ONLY the facts in SOURCE MATERIAL, independently write an English and a
Vietnamese pickleball news article. This is an original newsroom rewrite, not
a translation, paraphrase-by-sentence, or reproduction of the source.

Rules:
- Each language body must be ${range} words.
- For a full article, write 6–8 substantial paragraphs of roughly 80–100
  words each. For a brief, write 3–4 paragraphs of roughly 50–65 words each.
- Count the words in each language body before returning JSON. If it is outside
  the required range, revise it before responding.
- Do not copy sentences, quotations, headings, or the source's structure.
- Do not invent facts, reactions, interviews, context, dates, scores, or names.
- Do not include URLs, calls to visit the source, citations, HTML, Markdown,
  emojis, or a byline.
- Attribute uncertain claims in prose to "${origin.source_name}".
- Vietnamese must read like natural Vietnamese sports journalism and use full
  Vietnamese diacritics in the title, summary, headings, and paragraphs.
- Keep player, brand, tournament, PPA, MLP, APP, and DUPR names accurate.
- summary must be 120–300 characters and must not repeat the title.
- Use 2–4 sections. A heading is optional; paragraphs must be plain text.
- category is one of tournament, player, equipment, business, community.
- importance is an integer from 1 to 5.

SOURCE MATERIAL
${sourceMaterial}`;

  let validationFeedback = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const prompt = validationFeedback
      ? `${basePrompt}\n\nYour previous response was rejected: ${validationFeedback}. Regenerate the complete EN and VI result and strictly satisfy every rule.`
      : basePrompt;
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: rewriteSchema(),
          temperature: attempt === 1 ? 0.35 : 0.2,
          maxOutputTokens: origin.content_kind === "full" ? 5_000 : 2_000,
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`Gemini HTTP ${response.status}: ${(await response.text()).slice(0, 250)}`);
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini returned no JSON text");

    try {
      const draft = JSON.parse(text) as RewriteDraft;
      validateDraft(draft, origin.content_kind);
      return draft;
    } catch (error) {
      validationFeedback = error instanceof Error ? error.message : "invalid response";
      if (attempt === 3) throw new Error(validationFeedback);
    }
  }
  throw new Error("Gemini rewrite attempts exhausted");
}

/** The only categories the pipeline accepts, shared by the schema and the validator. */
const NEWS_CATEGORIES = ["tournament", "player", "equipment", "business", "community"] as const;

function rewriteSchema() {
  const languageSchema = {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      // Enum, not a bare string. The prompt already said "one of tournament,
    // player, equipment, business, community" and Gemini still returned
    // something else often enough to strand two articles at three attempts
    // each — "en category is invalid" is a deterministic failure, so retrying
    // it just spends the budget three times to reach the same place.
    // Structured output honours an enum, so an invalid value stops being
    // possible rather than being caught after generation.
    category: { type: "string", enum: NEWS_CATEGORIES },
      importance: { type: "integer" },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            paragraphs: { type: "array", items: { type: "string" } },
          },
          required: ["paragraphs"],
        },
      },
    },
    required: ["title", "summary", "category", "importance", "sections"],
  };
  return {
    type: "object",
    properties: { en: languageSchema, vi: languageSchema },
    required: ["en", "vi"],
  };
}

/**
 * Word-count bands, per content kind AND per language.
 *
 * One shared band was rejecting drafts in both directions at once: English
 * briefs came in at 109-134 against a 150 floor, Vietnamese ones at 280-354
 * against a 250 ceiling. Seven origins were stuck on exactly this.
 *
 * The Vietnamese numbers are not verbosity. The counter splits on whitespace,
 * and Vietnamese writes syllables separately — "Việt Nam" counts as two,
 * "vận động viên" as three — so the same article measures roughly 40% higher in
 * Vietnamese than in English. Judging both against one band guarantees that a
 * translation pair which is correct in both languages fails in one of them.
 *
 * The English floor also drops to 120: a thin source honestly yields a short
 * brief, and discarding the article entirely is worse than publishing 130 words.
 */
const WORD_BANDS: Record<ContentKind, Record<"en" | "vi", [number, number]>> = {
  full: { en: [350, 800], vi: [450, 1150] },
  brief: { en: [120, 250], vi: [170, 380] },
};

function validateDraft(draft: RewriteDraft, kind: ContentKind): void {
  for (const [language, value] of [
    ["en", draft?.en],
    ["vi", draft?.vi],
  ] as const) {
    if (!value) throw new Error(`${language} draft is missing`);
    if (
      typeof value.title !== "string" ||
      typeof value.summary !== "string" ||
      !Array.isArray(value.sections) ||
      !value.sections.length
    ) throw new Error(`${language} draft is incomplete`);
    if (value.title.trim().length < 12 || value.title.length > 120) {
      throw new Error(`${language} title length is invalid`);
    }
    if (value.summary.trim().length < 120 || value.summary.length > 300) {
      throw new Error(`${language} summary length is invalid`);
    }
    if (!(NEWS_CATEGORIES as readonly string[]).includes(value.category)) {
      throw new Error(`${language} category is invalid`);
    }
    if (!Number.isInteger(value.importance) || value.importance < 1 || value.importance > 5) {
      throw new Error(`${language} importance is invalid`);
    }
    const paragraphs = value.sections.flatMap((section) => section.paragraphs ?? []);
    if (!paragraphs.length || paragraphs.some((paragraph) => typeof paragraph !== "string")) {
      throw new Error(`${language} paragraphs are invalid`);
    }
    const words = paragraphs.join(" ").trim().split(/\s+/).filter(Boolean).length;
    // Gemini's structured bilingual output can finish slightly below the
    // editorial target even after corrective retries. Keep a hard floor that
    // still represents a substantive article instead of failing the queue
    // indefinitely; the prompt continues to target 500–800 words.
    const [minimum, maximum] = WORD_BANDS[kind][language];
    if (words < minimum || words > maximum) {
      throw new Error(`${language} body has ${words} words; expected ${minimum}-${maximum}`);
    }
    const allText = `${value.title} ${value.summary} ${paragraphs.join(" ")}`;
    if (/https?:\/\/|www\./i.test(allText)) {
      throw new Error(`${language} draft contains a URL`);
    }
    if (language === "vi") {
      const vietnameseWords = allText
        .split(/\s+/)
        .filter((word) => /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i.test(word))
        .length;
      const totalWords = allText.split(/\s+/).filter(Boolean).length;
      if (vietnameseWords / totalWords < 0.1) {
        throw new Error("vi draft is missing Vietnamese diacritics");
      }
    }
  }
}

function prepareForPublish(
  draft: LanguageDraft,
  origin: OriginRow,
  language: "en" | "vi",
) {
  return {
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    category: draft.category,
    importance: draft.importance,
    slug: slugify(draft.title, origin.id, language),
    content_html: renderSafeHtml(draft),
  };
}

function renderSafeHtml(draft: LanguageDraft): string {
  return draft.sections.map((section) => {
    const heading = section.heading?.trim()
      ? `<h2>${escapeHtml(section.heading.trim())}</h2>`
      : "";
    const paragraphs = section.paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph.trim())}</p>`)
      .join("");
    return `${heading}${paragraphs}`;
  }).join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(title: string, originId: string, language: "en" | "vi"): string {
  let base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (!base) base = language === "vi" ? "tin-pickleball" : "pickleball-news";
  return `${base}-${originId.replace(/-/g, "").slice(0, 8)}`;
}

async function markFailed(
  supabase: SupabaseClient,
  originId: string,
  message: string,
): Promise<void> {
  const { error } = await supabase
    .from("news_origins")
    .update({ pipeline_status: "failed", last_error: message.slice(0, 500) })
    .eq("id", originId);
  if (error) console.error(`[news-rewrite] failed to record ${originId}: ${error.message}`);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
