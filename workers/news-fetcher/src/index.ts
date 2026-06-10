// ============================================================================
// news-fetcher — Cloudflare Worker
// ----------------------------------------------------------------------------
// Pulls pickleball news from the active news_sources rows, parses RSS/Atom,
// and writes deduped rows into news_items via PostgREST (service_role).
//
// Phase 2 of the news aggregator feature. See:
//   - supabase/migrations/20260519000000_news_aggregator_phase_1.sql
//   - docs/news-aggregator.md (TODO Phase 5)
//
// Design constraints we respect:
//   - Per-source try/catch — one broken feed never kills the whole run.
//   - Only ingest items published in the last 30 days — avoids backfilling
//     ancient archives on first run from a new source.
//   - UPSERT semantics: (source_url, language) UNIQUE → ON CONFLICT DO NOTHING
//     gives us idempotent re-runs without needing a separate news-check call.
//   - Image: store the source's OG image URL verbatim. Self-hosting can be
//     added in Phase 4 if any source starts blocking referer / hotlinking.
//   - Status: rows land as 'published' when news_sources.auto_publish=true
//     AND trust_tier=1 (all 5 current sources). Lower-trust sources go to
//     'draft' for admin review. Today every active source is tier 1, so
//     this branch is mostly forward-compatible.
//
// Bilingual handling: this worker writes EN rows only. The news-translate
// edge function (Phase 3) listens on inserts and produces VI rows.
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
  error: string | null;
  duration_ms: number;
}

const MAX_ITEMS_PER_FEED = 20;
const MAX_AGE_DAYS = 30;
const TITLE_LIMIT = 120;
const SUMMARY_LIMIT = 300;

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
      return json({ ok: true, results });
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
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
  await fetch(url, {
    method: "PATCH",
    headers: pgHeaders(env, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      last_fetched_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      last_error: null,
    }),
  });
}

async function markSourceError(
  env: Env,
  sourceId: string,
  message: string
): Promise<void> {
  const url = `${env.SUPABASE_URL}/rest/v1/news_sources?id=eq.${sourceId}`;
  await fetch(url, {
    method: "PATCH",
    headers: pgHeaders(env, { Prefer: "return=minimal" }),
    body: JSON.stringify({
      last_fetched_at: new Date().toISOString(),
      last_error: message.slice(0, 500),
    }),
  });
}

interface IngestCounts {
  inserted: number;
  dup: number;
  old: number;
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

  for (const item of items) {
    const publishedMs = Date.parse(item.published_at);
    if (!Number.isFinite(publishedMs) || publishedMs < ageCutoff) {
      old += 1;
      continue;
    }

    const status =
      source.auto_publish && source.trust_tier === 1 ? "published" : "draft";

    const row = {
      title: truncate(item.title, TITLE_LIMIT),
      summary: truncate(item.summary || item.title, SUMMARY_LIMIT),
      source: source.name, // legacy text column, kept during transition
      source_id: source.id,
      source_url: item.link,
      published_at: new Date(publishedMs).toISOString(),
      status,
      language: source.language,
      slug: slugify(item.title, item.link),
      image_url: item.image_url,
      category: null,
      importance: 3,
      ai_translated: false,
    };

    // ON CONFLICT (source_url, language) DO NOTHING — uniq index from
    // Phase 1 migration. We MUST pass on_conflict=source_url,language on the
    // URL: PostgREST's default conflict target is the primary key, so without
    // this query string `resolution=ignore-duplicates` would either fall
    // through to a 409 on the source-url uniq index or — worse — insert
    // duplicates if that index were ever dropped. With on_conflict set,
    // resolution=ignore-duplicates silently skips and returns [].
    const url =
      `${env.SUPABASE_URL}/rest/v1/news_items` +
      `?on_conflict=source_url,language`;
    const res = await fetch(url, {
      method: "POST",
      headers: pgHeaders(env, {
        Prefer: "return=representation,resolution=ignore-duplicates",
      }),
      body: JSON.stringify(row),
    });

    if (res.status === 201) {
      const body = (await res.json()) as unknown[];
      if (Array.isArray(body) && body.length === 0) {
        dup += 1; // unique conflict, skipped
      } else {
        inserted += 1;
      }
    } else {
      const errBody = await res.text();
      console.warn(
        `[${source.id}] insert failed (${res.status}) for ${item.link}: ${errBody.slice(0, 200)}`
      );
    }
  }

  return { inserted, dup, old };
}

// ---------------------------------------------------------------------------
// Feed fetch + parse
// ---------------------------------------------------------------------------

// Reject non-https or private/loopback hosts before fetching a DB-supplied URL.
// Sources are admin-curated (service_role read), so this is defense-in-depth
// against an SSRF should a source row ever be tampered with.
function isSafePublicFeedUrl(raw: string): boolean {
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
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, limit: number): string {
  const clean = text.trim();
  if (clean.length <= limit) return clean;
  // Try to cut at a word boundary.
  const cut = clean.slice(0, limit).lastIndexOf(" ");
  return (cut > limit * 0.8 ? clean.slice(0, cut) : clean.slice(0, limit)).trim() + "…";
}

function slugify(title: string, link: string): string {
  // Base from title (handles unicode → ASCII as best we can with simple regex).
  let base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);

  if (!base) base = "news";

  // Short hash of source URL for collision safety (different articles can
  // share a base slug after the unicode strip).
  const hash = shortHash(link);
  return `${base}-${hash}`;
}

function shortHash(input: string): string {
  // FNV-1a 32-bit, then base36. Deterministic, no crypto API needed.
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36).slice(0, 6);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
