// ============================================================================
// news-fetcher — Cloudflare Worker
// ----------------------------------------------------------------------------
// Pulls pickleball news from the active news_sources rows, parses RSS/Atom,
// and writes deduped source material into the protected news_origins queue.
//
// Phase 2 of the news aggregator feature. See:
//   - supabase/migrations/20260519000000_news_aggregator_phase_1.sql
//   - docs/news-aggregator.md (TODO Phase 5)
//
// Design constraints we respect:
//   - Per-source try/catch — one broken feed never kills the whole run.
//   - Only ingest items published in the last 30 days — avoids backfilling
//     ancient archives on first run from a new source.
//   - UPSERT semantics: source_url UNIQUE → ON CONFLICT DO NOTHING
//     gives us idempotent re-runs without needing a separate news-check call.
//   - Source images are intentionally not copied or hotlinked.
//   - Article pages are fetched for factual input. If extraction is too thin,
//     the RSS title/summary is queued as a short brief instead.
//   - The news-rewrite edge function produces the public EN/VI pair.
// ============================================================================

import { XMLParser } from "fast-xml-parser";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCRAPER_AUTH_SECRET: string;
}

interface NewsSource {
  id: string;
  name: string;
  base_url: string;
  feed_url: string | null;
  feed_type: "rss" | "atom" | "html_scrape" | "manual";
  language: "en" | "vi";
  trust_tier: number;
  auto_publish: boolean;
  active: boolean;
}

interface ParsedItem {
  title: string;
  link: string;
  summary: string;
  image_url: string | null;
  published_at: string; // ISO
}

interface SourceRunResult {
  source_id: string;
  ok: boolean;
  fetched: number;
  inserted: number;
  skipped_dup: number;
  skipped_old: number;
  failed: number;
  error: string | null;
  duration_ms: number;
}

class IngestError extends Error {
  constructor(public readonly failed: number) {
    super(`${failed} news origin insert(s) failed`);
  }
}

// Four active sources × 8 article fetches + feed/DB/health calls stays below
// the Workers free-plan subrequest ceiling on a scheduled invocation.
const MAX_ITEMS_PER_FEED = 8;
const MAX_AGE_DAYS = 30;
const TITLE_LIMIT = 120;
const SUMMARY_LIMIT = 300;
const MAX_ARTICLE_BYTES = 1_500_000;
// A 500–800 word rewrite needs enough factual substrate. Anything thinner is
// deliberately treated as a 150–250 word brief to avoid padding/invention.
const MIN_FULL_BODY_CHARS = 2_500;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  // Always wrap repeating tags as arrays so item[] / entry[] is consistent.
  isArray: (name: string) => ["item", "entry"].includes(name),
});

// ---------------------------------------------------------------------------
// Worker entrypoints
// ---------------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return json({ name: "news-fetcher", status: "ok" });
    }

    if (req.method === "POST" && url.pathname === "/run") {
      const auth = req.headers.get("x-auth-secret");
      if (!auth || auth !== env.SCRAPER_AUTH_SECRET) {
        return json({ error: "Unauthorized" }, 401);
      }
      const results = await runAllSources(env);
      return json({ ok: results.every((result) => result.ok), results });
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    const results = await runAllSources(env);
    console.log("[news-fetcher cron]", JSON.stringify(results));
  },
};

// ---------------------------------------------------------------------------
// Main run loop
// ---------------------------------------------------------------------------

async function runAllSources(env: Env): Promise<SourceRunResult[]> {
  const sources = await fetchActiveSources(env);
  const results: SourceRunResult[] = [];

  for (const source of sources) {
    const started = Date.now();
    try {
      const items = await fetchAndParse(source);
      const counts = await ingestItems(env, source, items);
      const result: SourceRunResult = {
        source_id: source.id,
        ok: true,
        fetched: items.length,
        inserted: counts.inserted,
        skipped_dup: counts.dup,
        skipped_old: counts.old,
        failed: counts.failed,
        error: null,
        duration_ms: Date.now() - started,
      };
      results.push(result);
      await markSourceSuccess(env, source.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({
        source_id: source.id,
        ok: false,
        fetched: 0,
        inserted: 0,
        skipped_dup: 0,
        skipped_old: 0,
        failed: err instanceof IngestError ? err.failed : 0,
        error: message,
        duration_ms: Date.now() - started,
      });
      await markSourceError(env, source.id, message);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (service_role, RLS bypassed)
// ---------------------------------------------------------------------------

function pgHeaders(env: Env, extra: Record<string, string> = {}): HeadersInit {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function fetchActiveSources(env: Env): Promise<NewsSource[]> {
  const url =
    `${env.SUPABASE_URL}/rest/v1/news_sources` +
    `?active=eq.true&feed_type=in.(rss,atom)&select=*`;
  const res = await fetch(url, { headers: pgHeaders(env) });
  if (!res.ok) throw new Error(`fetchActiveSources ${res.status}`);
  return (await res.json()) as NewsSource[];
}

async function markSourceSuccess(env: Env, sourceId: string): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/news_sources?id=eq.${sourceId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: pgHeaders(env, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      last_fetched_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
    }),
  });
  if (!res.ok) {
    throw new Error(`markSourceSuccess ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function markSourceError(
  env: Env,
  sourceId: string,
  message: string
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/news_sources?id=eq.${sourceId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: pgHeaders(env, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      last_fetched_at: new Date().toISOString(),
      last_error: message.slice(0, 500),
    }),
  });
  if (!res.ok) {
    console.error(
      `[${sourceId}] could not persist source error (${res.status}): ${
        (await res.text()).slice(0, 200)
      }`
    );
  }
}

interface IngestCounts {
  inserted: number;
  dup: number;
  old: number;
  failed: number;
}

async function ingestItems(
  env: Env,
  source: NewsSource,
  items: ParsedItem[]
): Promise<IngestCounts> {
  const ageCutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  let inserted = 0;
  let dup = 0;
  let old = 0;
  let failed = 0;
  const originRows: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const publishedMs = Date.parse(item.published_at);
    if (!Number.isFinite(publishedMs) || publishedMs < ageCutoff) {
      old += 1;
      continue;
    }
    if (!item.title.trim() || !isSafePublicFeedUrl(item.link)) {
      failed += 1;
      console.warn(`[${source.id}] invalid feed item skipped: ${item.link}`);
      continue;
    }

    let rawBody: string | null = null;
    try {
      rawBody = await fetchArticleBody(item.link);
    } catch (error) {
      console.warn(
        `[${source.id}] full article unavailable for ${item.link}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    originRows.push({
      source_id: source.id,
      source_url: item.link,
      source_image_url:
        item.image_url && isSafePublicFeedUrl(item.image_url)
          ? item.image_url
          : null,
      source_name: source.name,
      raw_title: truncate(item.title, TITLE_LIMIT),
      raw_summary: truncate(item.summary || item.title, SUMMARY_LIMIT),
      raw_body: rawBody,
      content_kind: rawBody ? "full" : "brief",
      auto_publish: source.auto_publish,
      pipeline_status: "pending",
      published_at: new Date(publishedMs).toISOString(),
    });
  }

  if (originRows.length > 0) {
    const url = `${env.SUPABASE_URL}/rest/v1/news_origins?on_conflict=source_url`;
    const res = await fetch(url, {
      method: "POST",
      headers: pgHeaders(env, {
        Prefer: "return=representation,resolution=ignore-duplicates",
      }),
      body: JSON.stringify(originRows),
    });

    if (res.status === 201) {
      const body = (await res.json()) as unknown[];
      inserted = Array.isArray(body) ? body.length : 0;
      dup = originRows.length - inserted;
    } else {
      failed += originRows.length;
      const errBody = await res.text();
      console.warn(
        `[${source.id}] bulk origin insert failed (${res.status}): ${errBody.slice(0, 200)}`
      );
    }
  }

  if (failed > 0) {
    throw new IngestError(failed);
  }
  return { inserted, dup, old, failed };
}

// ---------------------------------------------------------------------------
// Feed fetch + parse
// ---------------------------------------------------------------------------

// Reject non-https or private/loopback hosts before fetching a DB-supplied URL.
// Sources are admin-curated (service_role read), so this is defense-in-depth
// against an SSRF should a source row ever be tampered with.
export function isSafePublicFeedUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    host === "[::1]" ||
    host.startsWith("[fd") ||
    host.startsWith("[fe80")
  ) {
    return false;
  }
  return true;
}

async function fetchAndParse(source: NewsSource): Promise<ParsedItem[]> {
  if (!source.feed_url) throw new Error("source has no feed_url");
  if (!isSafePublicFeedUrl(source.feed_url)) {
    throw new Error(`unsafe feed_url rejected: ${source.feed_url}`);
  }

  const res = await fetch(source.feed_url, {
    headers: {
      "User-Agent": "ThePickleHub-news-fetcher/1.0 (+https://www.thepicklehub.net)",
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9",
    },
    // 12s ceiling — sources sometimes hang on cold cache. Worker scheduled
    // handler has 30s total budget, leave headroom for other sources.
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);

  if (source.feed_type === "rss") return parseRss(parsed);
  if (source.feed_type === "atom") return parseAtom(parsed);
  throw new Error(`Unsupported feed_type ${source.feed_type}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRss(parsed: any): ParsedItem[] {
  const channel = parsed?.rss?.channel;
  const items = channel?.item;
  if (!Array.isArray(items)) return [];

  return items.slice(0, MAX_ITEMS_PER_FEED).map((item) => {
    const title = textOf(item.title);
    const link = textOf(item.link);
    const pubDate = textOf(item.pubDate) || textOf(item["dc:date"]);
    const description = stripHtml(
      textOf(item.description) || textOf(item["content:encoded"]) || ""
    );

    let image: string | null = null;
    // 1) media:content / media:thumbnail (Dink uses this)
    if (item["media:content"]?.["@_url"]) {
      image = item["media:content"]["@_url"];
    } else if (item["media:thumbnail"]?.["@_url"]) {
      image = item["media:thumbnail"]["@_url"];
    } else if (item.enclosure?.["@_url"]) {
      // 2) RSS enclosure
      image = item.enclosure["@_url"];
    } else {
      // 3) fallback: first <img> in content:encoded
      const content = textOf(item["content:encoded"]) || textOf(item.description) || "";
      const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (m) image = m[1];
    }

    return {
      title,
      link,
      summary: description,
      image_url: image,
      published_at: new Date(pubDate || Date.now()).toISOString(),
    };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAtom(parsed: any): ParsedItem[] {
  const entries = parsed?.feed?.entry;
  if (!Array.isArray(entries)) return [];

  return entries.slice(0, MAX_ITEMS_PER_FEED).map((entry) => {
    const title = textOf(entry.title);
    // <link href="..." rel="alternate" />
    let link = "";
    if (Array.isArray(entry.link)) {
      const alt = entry.link.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (l: any) => !l["@_rel"] || l["@_rel"] === "alternate"
      );
      link = alt?.["@_href"] || entry.link[0]?.["@_href"] || "";
    } else if (entry.link?.["@_href"]) {
      link = entry.link["@_href"];
    }
    const published =
      textOf(entry.published) ||
      textOf(entry.updated) ||
      new Date().toISOString();
    const summary = stripHtml(
      textOf(entry.summary) || textOf(entry.content) || ""
    );

    // Kitchen's Shopify Atom uses <s:image> namespace for product images,
    // and embeds <img> in content. Try content first.
    let image: string | null = null;
    const content = textOf(entry.content) || textOf(entry.summary) || "";
    const m = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (m) image = m[1];

    return {
      title,
      link,
      summary,
      image_url: image,
      published_at: new Date(published).toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Article extraction
// ---------------------------------------------------------------------------

async function fetchArticleBody(rawUrl: string): Promise<string | null> {
  if (!isSafePublicFeedUrl(rawUrl)) {
    throw new Error("unsafe article URL");
  }

  const res = await fetch(rawUrl, {
    headers: {
      "User-Agent": "ThePickleHub-news-fetcher/1.0 (+https://www.thepicklehub.net)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`article HTTP ${res.status}`);
  if (!isSafePublicFeedUrl(res.url)) {
    throw new Error("article redirected to an unsafe URL");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(`unsupported article content-type ${contentType}`);
  }
  const declaredLength = Number(res.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_ARTICLE_BYTES) {
    throw new Error(`article exceeds ${MAX_ARTICLE_BYTES} bytes`);
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_ARTICLE_BYTES) {
    throw new Error(`article exceeds ${MAX_ARTICLE_BYTES} bytes`);
  }

  const html = new TextDecoder().decode(bytes);
  const body = extractArticleText(html);
  return body.length >= MIN_FULL_BODY_CHARS ? body : null;
}

export function extractArticleText(html: string): string {
  const withoutNoise = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|nav|footer|header|aside|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ");
  const articleMatch =
    withoutNoise.match(/<article\b[^>]*>([\s\S]*?)<\/article\s*>/i) ??
    withoutNoise.match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
  const scope = articleMatch?.[1] ?? withoutNoise;
  const paragraphs = Array.from(
    scope.matchAll(/<(?:p|h2|h3)\b[^>]*>([\s\S]*?)<\/(?:p|h2|h3)\s*>/gi),
    (match) => stripHtml(match[1]),
  ).filter((text) => text.length >= 30);

  // Deduplicate repeated newsletter/nav paragraphs while keeping source order.
  return Array.from(new Set(paragraphs)).join("\n\n").slice(0, 30_000);
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textOf(node: any): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (typeof node === "object" && "#text" in node) return String(node["#text"]);
  return "";
}

function stripHtml(html: string): string {
  // Strip + entity-decode inside ONE fixpoint loop: a tag that reassembles
  // from nested fragments (<scr<script>ipt>) OR materializes from encoded
  // entities (&lt;script&gt;, &amp;lt;script&amp;gt;) gets stripped on the
  // following iteration, so the returned text can never contain live markup
  // (CodeQL js/incomplete-multi-character-sanitization, js/bad-tag-filter,
  // js/double-escaping). Cost: tag-shaped prose like "x < 5 and y > 3" loses
  // its middle — acceptable for a scraped plain-text summary.
  let out = html;
  let prev: string;
  do {
    prev = out;
    out = out
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*[^>]*>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  } while (out !== prev);
  return out.replace(/\s+/g, " ").trim();
}

function truncate(text: string, limit: number): string {
  const clean = text.trim();
  if (clean.length <= limit) return clean;
  // Try to cut at a word boundary.
  const cut = clean.slice(0, limit).lastIndexOf(" ");
  return (cut > limit * 0.8 ? clean.slice(0, cut) : clean.slice(0, limit)).trim() + "…";
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
