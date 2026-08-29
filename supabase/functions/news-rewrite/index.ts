import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { cronCorsHeaders as corsHeaders } from "../_shared/cors.ts";
import { getAuthUser } from "../_shared/auth.ts";
import { adminSessionAalOk, bearerToken } from "../_shared/admin-aal.ts";
import {
  WORD_LIMITS,
  classifyRewriteFailure,
  fallbackContentKind,
  validateLanguageDraft,
  type DraftValidationIssue,
  type NewsContentKind,
  type NewsLanguage,
  type NewsLanguageDraft,
} from "../_shared/news-rewrite-validation.ts";

const BATCH_SIZE = 2;
const STALE_MINUTES = 15;
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type ContentKind = NewsContentKind;

interface OriginRow {
  id: string;
  attempts: number;
  source_id: string | null;
  source_name: string;
  source_url: string;
  raw_title: string;
  raw_summary: string;
  raw_body: string | null;
  content_kind: ContentKind;
  published_at: string;
}

type LanguageDraft = NewsLanguageDraft;

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
      const rewritten = await rewriteOrigin(origin, geminiKey);
      if (rewritten.contentKind !== origin.content_kind) {
        const { error: kindError } = await supabase
          .from("news_origins")
          .update({ content_kind: rewritten.contentKind })
          .eq("id", origin.id);
        if (kindError) throw new Error(`content kind update failed: ${kindError.message}`);
      }
      const en = prepareForPublish(rewritten.draft.en, origin, "en");
      const vi = prepareForPublish(rewritten.draft.vi, origin, "vi");
      const { data: published, error: publishError } = await supabase.rpc(
        "publish_rewritten_news",
        { p_origin_id: origin.id, p_en: en, p_vi: vi },
      );
      if (publishError) throw new Error(`publish failed: ${publishError.message}`);
      await clearFailureMetadata(supabase, origin.id);
      result.published += 1;
      result.details.push({ origin_id: origin.id, status: "published", published });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[news-rewrite] ${origin.id}: ${message}`);
      await markFailed(supabase, origin, message);
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
): Promise<{ draft: RewriteDraft; contentKind: ContentKind }> {
  const target = WORD_LIMITS[origin.content_kind].target;
  const range = `${target[0]}–${target[1]}`;
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
- Title: lead with the most searchable entity (tournament, player, or brand
  name, plus the year when the source gives one) and keep the essential part
  within the first 65 characters.
- The Vietnamese title and headings must use phrases Vietnamese fans actually
  type into search ("lịch thi đấu", "kết quả", "công bố", "vô địch", "trực
  tiếp"), not a word-for-word translation of the English title.
- summary must be 120–300 characters, must not repeat the title, and must read
  like a search snippet: name the main entity and state the concrete news so a
  searcher knows why to click.
- Use 2–4 sections. For a full article give every section a short heading that
  works in a natural secondary keyword; for a brief, headings are optional.
  Paragraphs must be plain text.
- category is one of tournament, player, equipment, business, community.
- importance is an integer from 1 to 5.

SOURCE MATERIAL
${sourceMaterial}`;

  const draft = await generateJson<RewriteDraft>(geminiKey, basePrompt, rewriteSchema(),
    origin.content_kind === "full" ? 5_000 : 2_000, 0.35);

  for (let repairAttempt = 1; repairAttempt <= 2; repairAttempt += 1) {
    const issues = collectDraftIssues(draft, origin.content_kind);
    if (issues.length === 0) return { draft, contentKind: origin.content_kind };

    for (const language of ["en", "vi"] as const) {
      const languageIssues = issues.filter((issue) => issue.language === language);
      if (languageIssues.length === 0) continue;
      draft[language] = await repairLanguageDraft(
        origin,
        language,
        draft[language],
        languageIssues,
        geminiKey,
        repairAttempt,
      );
    }
  }

  const remaining = collectDraftIssues(draft, origin.content_kind);
  if (remaining.length === 0) return { draft, contentKind: origin.content_kind };

  // A source may contain plenty of scraped characters but too few independent
  // facts for a safe full article. Preserve the usable copy as a brief instead
  // of asking the model to pad it or leaving the queue permanently failed.
  const fallback = fallbackContentKind(origin.content_kind, draft.en, draft.vi);
  if (fallback) return { draft, contentKind: fallback };

  throw new Error(remaining.map((issue) => issue.message).join("; "));
}

async function generateJson<T>(
  geminiKey: string,
  prompt: string,
  responseSchema: Record<string, unknown>,
  maxOutputTokens: number,
  temperature: number,
): Promise<T> {
  const response = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(geminiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature,
          maxOutputTokens,
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
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini returned invalid JSON");
  }
}

function collectDraftIssues(draft: RewriteDraft, kind: ContentKind): DraftValidationIssue[] {
  return [
    ...validateLanguageDraft("en", draft?.en, kind),
    ...validateLanguageDraft("vi", draft?.vi, kind),
  ];
}

async function repairLanguageDraft(
  origin: OriginRow,
  language: NewsLanguage,
  draft: LanguageDraft,
  issues: DraftValidationIssue[],
  geminiKey: string,
  attempt: number,
): Promise<LanguageDraft> {
  const [minimum, maximum] = WORD_LIMITS[origin.content_kind].target;
  const sourceMaterial = [origin.raw_title, origin.raw_summary, origin.raw_body ?? ""]
    .filter(Boolean).join("\n\n");
  const prompt = `You are a strict ${language.toUpperCase()} copy editor.

Repair ONLY the supplied ${language.toUpperCase()} draft. Return one JSON language draft, not an EN/VI wrapper.
- Resolve every validation error below.
- Body target: ${minimum}-${maximum} words. Count before returning.
- Preserve the draft's verified facts and meaning; use only SOURCE MATERIAL.
- Do not add facts, quotes, URLs, Markdown, a byline, or commentary.
- Keep title 12-120 characters and summary 120-300 characters.
- Keep 2-4 sections with complete, natural paragraphs.
- Vietnamese output must use natural Vietnamese with full diacritics.

VALIDATION ERRORS
${issues.map((issue) => `- ${issue.message}`).join("\n")}

CURRENT DRAFT
${JSON.stringify(draft)}

SOURCE MATERIAL
${sourceMaterial}`;
  return await generateJson<LanguageDraft>(
    geminiKey,
    prompt,
    languageDraftSchema(),
    origin.content_kind === "full" ? 3_000 : 1_500,
    attempt === 1 ? 0.2 : 0.1,
  );
}

function languageDraftSchema() {
  return {
    type: "object",
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      category: { type: "string" },
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
  } as Record<string, unknown>;
}

function rewriteSchema() {
  const languageSchema = languageDraftSchema();
  return {
    type: "object",
    properties: { en: languageSchema, vi: languageSchema },
    required: ["en", "vi"],
  };
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
  origin: OriginRow,
  message: string,
): Promise<void> {
  const failure = classifyRewriteFailure(message);
  const retryable = failure.retryable && origin.attempts < 5;
  const retryDelayMinutes = Math.min(240, 15 * Math.max(1, 2 ** (origin.attempts - 1)));
  const { error } = await supabase
    .from("news_origins")
    .update({
      pipeline_status: "failed",
      last_error: message.slice(0, 500),
      failure_kind: failure.kind,
      retryable,
      next_retry_at: retryable
        ? new Date(Date.now() + retryDelayMinutes * 60_000).toISOString()
        : null,
    })
    .eq("id", origin.id);
  if (error) console.error(`[news-rewrite] failed to record ${origin.id}: ${error.message}`);
}

async function clearFailureMetadata(supabase: SupabaseClient, originId: string): Promise<void> {
  const { error } = await supabase
    .from("news_origins")
    .update({ failure_kind: null, retryable: false, next_retry_at: null })
    .eq("id", originId);
  if (error) console.error(`[news-rewrite] failed to clear retry metadata ${originId}: ${error.message}`);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
