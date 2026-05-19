// ============================================================================
// news-translate — AI EN→VI translation for news_items
// ----------------------------------------------------------------------------
// Picks up to BATCH_SIZE pending EN rows from news_items, asks Gemini Flash
// to rewrite them into natural Vietnamese with light context for VN readers,
// and inserts the VI siblings with parent_news_id → EN.id so hreflang in
// Phase 4 SEO pages can link the two together.
//
// Triggers:
//   - POST  /                      — manual run (service_role Bearer or
//                                    SCRAPER_AUTH_SECRET header)
//   - pg_cron via pg_net every 30m — set up in a separate migration after
//                                    this function is deployed
//
// Error policy:
//   - Per-row try/catch — one bad Gemini response never kills the batch.
//   - On API or parse failure: mark the EN row 'failed' with the reason
//     in ai_translation_error. Admin can manually re-queue via UI in P5.
//
// Rate handling:
//   - Gemini 2.0 Flash free tier: 15 RPM. We do max 10 per run with a 1s
//     gap between calls → 10 RPM, comfortable margin.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// BATCH_SIZE chosen with Supabase edge runtime's 25s wall-clock budget
// in mind. Each row costs ~2-3s (Gemini call + insert + status update)
// plus a 1s gap → 6 rows ≈ 18-24s, comfortable margin under 25s.
// First test with BATCH_SIZE=10 hit the 25s ceiling and orphaned the
// last 2 rows in 'translating' state.
const BATCH_SIZE = 6;
const REQUEST_GAP_MS = 1_000;
// Stale claim recovery — any 'translating' row older than this got
// orphaned by a timeout/crash. Recovered to 'pending' at the top of
// each run so it gets retried.
const STALE_CLAIM_AGE_MIN = 5;
// gemini-flash-lite-latest works on the free tier with this project's API
// key (verified 2026-05-19). Other 1.5-* model aliases now return 404; the
// 2.0/2.5 flash models return 429 quota-exceeded on this key. flash-lite
// also has the highest free-tier RPM in the 2.x family.
const GEMINI_MODEL = "gemini-flash-lite-latest";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-auth-secret",
};

interface NewsEnRow {
  id: string;
  title: string;
  summary: string;
  source: string;
  source_id: string | null;
  source_url: string;
  image_url: string | null;
  category: string | null;
  importance: number;
  published_at: string;
  slug: string | null;
}

interface GeminiTranslation {
  title_vi: string;
  summary_vi: string;
}

interface RunResult {
  picked: number;
  inserted: number;
  failed: number;
  details: Array<{
    en_id: string;
    status: "done" | "failed";
    error?: string;
    vi_slug?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
// Tone:  natural Vietnamese, casual-but-informed (báo thể thao chuyên).
// Goal:  rewrite — not literal translate. Add 1–2 word context when a
//        US-specific reference would confuse VN readers (e.g. "MLP" →
//        "MLP (giải đồng đội Mỹ)"). Keep player names + tournament
//        acronyms in original.
const TRANSLATION_PROMPT_TEMPLATE = `Bạn đang biên tập tin pickleball cho thepicklehub.net — độc giả Việt theo dõi pickleball pro Mỹ và châu Á.

Dịch tiêu đề + tóm tắt sau từ English sang tiếng Việt tự nhiên. Yêu cầu:
- Không dịch máy thô. Viết lại thoáng, mượt, đúng giọng báo thể thao Việt.
- GIỮ NGUYÊN tên VĐV (vd: "Anna Bright" không phiên âm).
- GIỮ NGUYÊN tên giải/tour (PPA, MLP, APP, US Open) và brand thiết bị (Joola, Selkirk, Franklin).
- Nếu có thuật ngữ Mỹ mà độc giả VN có thể không hiểu (vd "MLP", "DUPR"), thêm 2–4 chữ giải thích trong ngoặc (vd: "MLP (giải đồng đội Mỹ)") — CHỈ khi cần thiết, không lặp nếu đã giải thích trong title.
- Tiêu đề tối đa 110 ký tự, summary tối đa 280 ký tự.
- Nếu bài có liên quan VĐV Việt / giải VN / châu Á, có thể nhấn nhẹ điểm đó.
- KHÔNG thêm emoji.

Trả về JSON đúng schema, không có gì khác.

TITLE: {{TITLE}}
SUMMARY: {{SUMMARY}}`;

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ name: "news-translate", status: "ok" });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Auth: accept either the service_role Bearer token OR the shared
  // SCRAPER_AUTH_SECRET header (so pg_cron via pg_net can call without
  // leaking service_role into more places than necessary).
  const auth = req.headers.get("authorization") ?? "";
  const sharedSecret = req.headers.get("x-auth-secret") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const scraperSecret = Deno.env.get("SCRAPER_AUTH_SECRET") ?? "";

  const authedByService =
    serviceRole !== "" && auth === `Bearer ${serviceRole}`;
  const authedBySecret =
    scraperSecret !== "" && sharedSecret === scraperSecret;

  if (!authedByService && !authedBySecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiKey) {
    return json({ error: "GEMINI_API_KEY not configured" }, 500);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRole);

  try {
    const result = await runBatch(supabase, geminiKey);
    return json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[news-translate] fatal:", message);
    return json({ error: message }, 500);
  }
});

// ---------------------------------------------------------------------------
// Batch runner
// ---------------------------------------------------------------------------

async function runBatch(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  geminiKey: string
): Promise<RunResult> {
  // 0) Recover stale claims — rows stuck in 'translating' for >N min
  //    were orphaned by a previous run's timeout/crash. Bounce them back
  //    to 'pending' so this run picks them up again.
  const staleCutoff = new Date(
    Date.now() - STALE_CLAIM_AGE_MIN * 60_000
  ).toISOString();
  await supabase
    .from("news_items")
    .update({ ai_translation_status: "pending" })
    .eq("ai_translation_status", "translating")
    .lt("ai_translated_at", staleCutoff);

  // 1) Claim a batch atomically by setting status='translating' on the
  //    oldest pending EN rows and RETURNING the rows we got. This is the
  //    standard PostgreSQL claim pattern — even if two runs race, each row
  //    is claimed by exactly one.
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_pending_news_translations",
    { p_batch_size: BATCH_SIZE }
  );

  if (claimErr) {
    throw new Error(`claim RPC failed: ${claimErr.message}`);
  }

  const rows = (claimed ?? []) as NewsEnRow[];
  if (rows.length === 0) {
    return { picked: 0, inserted: 0, failed: 0, details: [] };
  }

  const result: RunResult = {
    picked: rows.length,
    inserted: 0,
    failed: 0,
    details: [],
  };

  for (const row of rows) {
    try {
      const translation = await translateOne(row, geminiKey);
      const viRow = buildViRow(row, translation);
      const { error: insertErr } = await supabase
        .from("news_items")
        .insert(viRow);

      if (insertErr) throw new Error(`insert VI row: ${insertErr.message}`);

      await supabase
        .from("news_items")
        .update({
          ai_translation_status: "done",
          ai_translation_error: null,
          ai_translated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      result.inserted += 1;
      result.details.push({
        en_id: row.id,
        status: "done",
        vi_slug: viRow.slug,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : String(err ?? "unknown");
      console.warn(`[news-translate] row ${row.id} failed: ${message}`);
      await supabase
        .from("news_items")
        .update({
          ai_translation_status: "failed",
          ai_translation_error: message.slice(0, 500),
          ai_translated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      result.failed += 1;
      result.details.push({
        en_id: row.id,
        status: "failed",
        error: message.slice(0, 200),
      });
    }

    // Rate-limit cushion. 1s between calls keeps us well under
    // Gemini Flash free-tier 15 RPM.
    await sleep(REQUEST_GAP_MS);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Gemini call
// ---------------------------------------------------------------------------

async function translateOne(
  row: NewsEnRow,
  geminiKey: string
): Promise<GeminiTranslation> {
  const prompt = TRANSLATION_PROMPT_TEMPLATE.replace(
    "{{TITLE}}",
    row.title
  ).replace("{{SUMMARY}}", row.summary);

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          title_vi: { type: "string" },
          summary_vi: { type: "string" },
        },
        required: ["title_vi", "summary_vi"],
      },
      temperature: 0.4,
      // Cap output — title + summary are small.
      maxOutputTokens: 800,
    },
  };

  const res = await fetch(
    `${GEMINI_ENDPOINT}?key=${encodeURIComponent(geminiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no text part");

  let parsed: GeminiTranslation;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(
      `Gemini JSON parse failed: ${text.slice(0, 200)} (${(e as Error).message})`
    );
  }

  if (
    typeof parsed.title_vi !== "string" ||
    typeof parsed.summary_vi !== "string" ||
    !parsed.title_vi.trim() ||
    !parsed.summary_vi.trim()
  ) {
    throw new Error("Gemini returned empty title_vi or summary_vi");
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// VI row builder
// ---------------------------------------------------------------------------

function buildViRow(en: NewsEnRow, t: GeminiTranslation) {
  const title = truncate(t.title_vi, 110);
  const summary = truncate(t.summary_vi, 280);
  return {
    title,
    summary,
    source: en.source,
    source_id: en.source_id,
    source_url: en.source_url,
    image_url: en.image_url,
    category: en.category,
    importance: en.importance,
    published_at: en.published_at,
    status: "published",
    language: "vi",
    slug: slugify(title, en.source_url),
    ai_translated: true,
    parent_news_id: en.id,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function truncate(text: string, limit: number): string {
  const clean = text.trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit).lastIndexOf(" ");
  return (
    (cut > limit * 0.8 ? clean.slice(0, cut) : clean.slice(0, limit)).trim() +
    "…"
  );
}

function slugify(title: string, link: string): string {
  let base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    // Vietnamese-specific: đ → d
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!base) base = "tin";

  const hash = shortHash(link);
  return `${base}-${hash}`;
}

function shortHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
