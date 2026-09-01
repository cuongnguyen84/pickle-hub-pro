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
  readonly failed: number;
  constructor(failed: number) {
    super(`${failed} news origin insert(s) failed`);
    this.failed = failed;
  }
}

// Four active sources × 8 article fetches + feed/DB/health calls stays below
// the Workers free-plan subrequest ceiling on a scheduled invocation.
const MAX_ITEMS_PER_FEED = 8;
// Trần 50 subrequest/lần chạy của Workers free là ràng buộc thật, và nó tính
// CẢ RUN chứ không tính theo nguồn. Chi phí cố định với 9 nguồn: 9 feed/listing
// + ~9 dedupe + ~4 insert + 9 PATCH + 2 job-health ≈ 33. Phần còn lại chia cho
// việc tải body bài — đếm chung một ngân sách để thêm nguồn không âm thầm
// đẩy run qua trần. Bài vượt ngân sách KHÔNG insert (để lần chạy sau lấy đủ
// body), backlog tự rút cạn qua các run 2h kế tiếp.
const MAX_ARTICLE_FETCHES_PER_RUN = 10;
// Thử lại feed tối đa 2 lần cho CẢ run (không phải mỗi nguồn) — nếu mỗi nguồn
// được thử lại thì 9 nguồn cùng hỏng sẽ đẩy run qua trần 50 subrequest.
const MAX_FEED_RETRIES_PER_RUN = 2;

// Một chuỗi User-Agent duy nhất cho MỌI request ra ngoài (feed, listing, trang
// bài). Trước 2026-09-01 chuỗi này là "ThePickleHub-news-fetcher/1.0 (+...)" —
// lễ phép và trung thực, nhưng KHÔNG theo khuôn "Mozilla/5.0 (compatible;
// <bot>; +<url>)" mà Googlebot/Bingbot dùng, nên WAF của pickleball.com bắt
// đầu trả 403 cho nó từ 2026-08-28: 4 ngày, ~48 lượt fetch, 1/9 nguồn chết âm
// thầm (run vẫn ở trạng thái "warning" nên không ai bị đánh thức).
//
// Đo tay 2026-09-01 trên https://pickleball.com/api/feed:
//   "ThePickleHub-news-fetcher/1.0 (+...)"                          → 403
//   + Accept / Accept-Language / Accept-Encoding                     → 403
//   "SimplePie/1.5 (Feed Parser)"                                    → 403
//   "Mozilla/5.0 (compatible; ThePickleHub-news-fetcher/1.0; +...)"  → 200
//
// Nên đổi KHUÔN, không đổi DANH TÍNH: vẫn tự khai đúng tên bot + URL liên hệ,
// chỉ bọc trong tiền tố "Mozilla/5.0 (compatible; …)" mà bộ lọc mong đợi.
// KHÔNG giả dạng trình duyệt. robots.txt của pickleball.com cho phép "/" với
// mọi user-agent, nên đây là đi đúng cửa chứ không phải lách. Đã thử lại cả 9
// nguồn với chuỗi mới: 8 nguồn giữ nguyên mã trạng thái, pickleball-com
// 403 → 200.
export const NEWS_FETCHER_USER_AGENT =
  "Mozilla/5.0 (compatible; ThePickleHub-news-fetcher/1.0; +https://www.thepicklehub.net)";

const MAX_AGE_DAYS = 30;
const TITLE_LIMIT = 120;
const SUMMARY_LIMIT = 300;

const MAX_ARTICLE_BYTES = 1_500_000;
// A 500–800 word rewrite needs enough factual substrate. Anything thinner is
// deliberately treated as a 150–250 word brief to avoid padding/invention.
//
// Raised from 2_500 on 2026-08-17. The intent was always right; the number was
// not. 2_500 characters is roughly 420 words, so a "full" article was being
// asked for a rewrite as long as, or longer than, its own source. Gemini
// compressed instead — correctly — and news-rewrite then rejected the result
// against its own 350-word floor: "en body has 254 words; expected 350-800".
// Thirty origins had died that way, four of the last eight failures.
//
// 4_000 characters is roughly 670 words, so the 350–800 target becomes a
// compression rather than an expansion, which is the direction a rewrite should
// go. Anything under it is a brief, which is what a listicle or a short news
// hit actually is.
const MIN_FULL_BODY_CHARS = 4_000;

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
      const results = await runTracked(env, "manual");
      return json({ ok: results.every((result) => result.ok), results });
    }

    return json({ error: "Not found" }, 404);
  },

  async scheduled(_event: unknown, env: Env): Promise<void> {
    const results = await runTracked(env, "scheduled");
    console.log("[news-fetcher cron]", JSON.stringify(results));
  },
};

async function runTracked(
  env: Env,
  triggerKind: "scheduled" | "manual",
): Promise<SourceRunResult[]> {
  const startedAt = new Date();
  const externalRunId = `${triggerKind}:${startedAt.toISOString()}:${crypto.randomUUID()}`;
  try {
    const results = await runAllSources(env);
    const failedSources = results.filter((result) => !result.ok).length;
    const metrics = {
      sources_total: results.length,
      sources_succeeded: results.length - failedSources,
      sources_failed: failedSources,
      fetched: results.reduce((sum, result) => sum + result.fetched, 0),
      inserted: results.reduce((sum, result) => sum + result.inserted, 0),
      skipped_dup: results.reduce((sum, result) => sum + result.skipped_dup, 0),
      skipped_old: results.reduce((sum, result) => sum + result.skipped_old, 0),
      items_failed: results.reduce((sum, result) => sum + result.failed, 0),
    };
    const status = failedSources === 0 ? "success" : failedSources < results.length ? "warning" : "failed";
    await recordJobRun(env, {
      externalRunId,
      triggerKind,
      status,
      startedAt,
      summary: metrics.inserted === 0
        ? `Fetched ${metrics.sources_succeeded}/${metrics.sources_total} sources; no new articles`
        : `Inserted ${metrics.inserted} new article origin(s) from ${metrics.sources_succeeded}/${metrics.sources_total} sources`,
      metrics,
      errorMessage: results.filter((result) => result.error).map((result) => `${result.source_id}: ${result.error}`).join("; ") || null,
    });
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobRun(env, {
      externalRunId,
      triggerKind,
      status: "failed",
      startedAt,
      summary: "News fetcher failed before source processing completed",
      metrics: {},
      errorMessage: message,
    });
    throw error;
  }
}

async function recordJobRun(
  env: Env,
  input: {
    externalRunId: string;
    triggerKind: "scheduled" | "manual";
    status: "success" | "warning" | "failed";
    startedAt: Date;
    summary: string;
    metrics: Record<string, number>;
    errorMessage: string | null;
  },
): Promise<void> {
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ops_record_job_run`, {
      method: "POST",
      headers: pgHeaders(env),
      body: JSON.stringify({
        p_job_key: "news-fetcher",
        p_external_run_id: input.externalRunId,
        p_status: input.status,
        p_started_at: input.startedAt.toISOString(),
        p_completed_at: new Date().toISOString(),
        p_trigger_kind: input.triggerKind,
        p_summary: input.summary,
        p_metrics: input.metrics,
        p_error_code: input.status === "failed" ? "news_fetch_failed" : null,
        p_error_message: input.errorMessage,
        p_details_url: "https://www.thepicklehub.net/admin/news",
      }),
    });
    if (!response.ok) console.error(`[job-health] record failed: ${response.status} ${(await response.text()).slice(0, 300)}`);
  } catch (error) {
    console.error(`[job-health] record threw: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ---------------------------------------------------------------------------
// Main run loop
// ---------------------------------------------------------------------------

async function runAllSources(env: Env): Promise<SourceRunResult[]> {
  const sources = await fetchActiveSources(env);
  const results: SourceRunResult[] = [];
  // Ngân sách dùng chung cho cả run, các nguồn tiêu theo thứ tự.
  const budget: FetchBudget = { left: MAX_ARTICLE_FETCHES_PER_RUN, retries: MAX_FEED_RETRIES_PER_RUN };

  for (const source of sources) {
    const started = Date.now();
    try {
      const items = await fetchAndParse(source, env, budget);
      const counts = await ingestItems(env, source, items, budget);
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
  // html_scrape chỉ lấy các nguồn ĐÃ có config trong HTML_SCRAPE_CONFIGS —
  // nguồn html_scrape khác (APP Pickleball) vẫn nằm im như trước.
  const scrapeIds = Object.keys(HTML_SCRAPE_CONFIGS).join(",");
  const url =
    `${env.SUPABASE_URL}/rest/v1/news_sources` +
    `?active=eq.true&or=(feed_type.in.(rss,atom),id.in.(${scrapeIds}))&select=*`;
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

interface FetchBudget {
  left: number;
  /** Số lần được thử lại feed trong CẢ run — xem MAX_FEED_RETRIES_PER_RUN. */
  retries: number;
}

interface IngestCounts {
  inserted: number;
  dup: number;
  old: number;
  failed: number;
}

// source_url là khoá dedupe DUY NHẤT, nên link phải được chuẩn hoá trước khi
// so trùng — nếu không, cùng một bài với utm khác nhau sẽ vào DB hai lần.
export function normalizeItemLink(raw: string): string {
  // Feed pickleball.com trả <link> không có scheme ("pickleball.com/news/…")
  // — thêm scheme trước, không thì bị loại sạch ở bước validate.
  const withScheme = raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return withScheme; // để isSafePublicFeedUrl loại ở bước sau
  }
  // Pickleball Rookie gắn ?utm_source=rss&utm_medium=rss&utm_campaign=<slug>
  // vào mọi link. Tham số tracking không đổi nội dung bài.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") {
      url.searchParams.delete(key);
    }
  }
  return url.toString().replace(/\?$/, "");
}

async function ingestItems(
  env: Env,
  source: NewsSource,
  items: ParsedItem[],
  budget: FetchBudget
): Promise<IngestCounts> {
  const ageCutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  let inserted = 0;
  let dup = 0;
  let old = 0;
  let failed = 0;
  const originRows: Array<Record<string, unknown>> = [];

  // Lọc age/validity trước, rồi dedupe CẢ BATCH bằng MỘT query trước khi fetch
  // body — trước đây body được fetch lại cho mọi bài mỗi run (8 fetch/nguồn/2h),
  // 4 nguồn đã sát trần 50 subrequest của Workers free; steady state giờ chỉ
  // tốn body fetch cho bài thật sự mới.
  const fresh: ParsedItem[] = [];
  for (const item of items) {
    item.link = normalizeItemLink(item.link);
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
    fresh.push(item);
  }

  let known = new Set<string>();
  if (fresh.length > 0) {
    const inList = fresh.map((item) => `"${item.link}"`).join(",");
    const dupRes = await fetch(
      `${env.SUPABASE_URL}/rest/v1/news_origins?source_url=in.(${encodeURIComponent(inList)})&select=source_url`,
      { headers: pgHeaders(env) },
    );
    if (dupRes.ok) {
      known = new Set(((await dupRes.json()) as { source_url: string }[]).map((row) => row.source_url));
    }
    // Query dedupe lỗi → known rỗng, chạy tiếp như cũ; ON CONFLICT ở INSERT vẫn đỡ.
  }

  for (const item of fresh) {
    if (known.has(item.link)) {
      dup += 1;
      continue;
    }
    if (budget.left <= 0) {
      // Hết ngân sách subrequest: bỏ qua, KHÔNG insert — run sau sẽ lấy lại
      // bài này kèm body đầy đủ thay vì chôn nó thành brief vĩnh viễn.
      console.log(`[${source.id}] hoãn ${item.link} — hết ngân sách fetch của run`);
      break;
    }
    const publishedMs = Date.parse(item.published_at);

    let rawBody: string | null = null;
    budget.left -= 1;
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

// ---------------------------------------------------------------------------
// html_scrape — cho site đã bỏ RSS nhưng listing vẫn là HTML server-render.
// ponytail: config cứng theo source id; nguồn html_scrape thứ 2 thì nâng thành cột DB.
// ---------------------------------------------------------------------------

interface HtmlScrapeConfig {
  origin: string;
  // Đường og-meta (PPA): slug bài nằm ở root ("/122-shot-rally.../"), loại
  // trang mục bằng prefix, rồi fetch từng bài để đọc og:title + published_time.
  excludePrefixes?: string[];
  titleSuffix?: string; // cắt " | PPA Tour" khỏi og:title
  // Đường listing-card (APP): card trên trang listing đã có sẵn tiêu đề, ngày
  // và ảnh, trong khi trang bài KHÔNG có <meta article:published_time> nên
  // đường og-meta ở trên vô dụng. Lấy hết từ listing = 1 subrequest/nguồn.
  listingCards?: {
    splitOn: string; // chuỗi mở đầu mỗi card trong HTML
    linkPrefix: string; // prefix path của bài, vd "/news/"
  };
}

export const HTML_SCRAPE_CONFIGS: Record<string, HtmlScrapeConfig> = {
  "ppa-tour": {
    origin: "https://www.ppatour.com",
    excludePrefixes: [
      "/about", "/athletes", "/events", "/watch", "/play",
      "/rankings", "/leaderboards", "/news", "/blog", "/_next",
    ],
    titleSuffix: " | PPA Tour",
  },
  // APP Pickleball — site Webflow, listing /news là CMS collection list.
  app: {
    origin: "https://www.theapp.global",
    listingCards: {
      splitOn: 'role="listitem" class="w-dyn-item"',
      linkPrefix: "/news/",
    },
  },
};

// Mỗi run chỉ fetch meta tối đa N bài MỚI — giữ ngân sách subrequest của
// Workers; backlog tự rút cạn qua các run 2h kế tiếp.
const SCRAPE_MAX_NEW_PER_RUN = 4;

function metaContent(html: string, property: string): string | null {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  ) ?? html.match(
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  );
  return match ? match[1].trim() : null;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

// MỘT lượt quét duy nhất: thứ vừa giải mã không bị quét lại, nên không có cửa
// double-unescape (&amp;lt; → &lt; → <), CodeQL js/double-escaping.
// Phải xử cả entity SỐ: feed WordPress của MLP viết "&#038;" và "&#8211;",
// trước đây lọt nguyên vào tiêu đề bài đã đăng.
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-zA-Z]{2,8});/g, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const code = entity[1] === "x" || entity[1] === "X"
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Card Webflow: <div role="listitem" …> … class="card_news_content" …
// <span>Tiêu đề</span> … <span>August 22, 2026</span> … href="/news/slug".
// Không có year-less date nên Date.parse("August 22, 2026") là đủ.
export function parseListingCards(html: string, config: HtmlScrapeConfig): ParsedItem[] {
  const cards = config.listingCards;
  if (!cards) return [];
  const items: ParsedItem[] = [];
  const seen = new Set<string>();

  for (const chunk of html.split(cards.splitOn).slice(1)) {
    const path = chunk.match(
      new RegExp(`href="(${cards.linkPrefix}[a-z0-9][a-z0-9-]*)"`),
    )?.[1];
    const title = chunk.match(/card_news_content[\s\S]{0,600}?<span>([^<]{5,})<\/span>/)?.[1];
    const date = chunk.match(/>([A-Z][a-z]+ \d{1,2}, 20\d\d)</)?.[1];
    if (!path || !title || !date) continue;

    const link = config.origin + path;
    if (seen.has(link)) continue;
    const publishedMs = Date.parse(`${date} UTC`);
    if (!Number.isFinite(publishedMs)) continue;
    seen.add(link);

    const image = chunk.match(/src="(https:\/\/[^"]+\.(?:avif|jpg|jpeg|png|webp))"/i)?.[1] ?? null;
    items.push({
      title: decodeEntities(title).slice(0, TITLE_LIMIT),
      link,
      summary: "",
      image_url: image,
      published_at: new Date(publishedMs).toISOString(),
    });
    if (items.length >= MAX_ITEMS_PER_FEED) break;
  }

  return items;
}

async function scrapeHtmlListing(
  env: Env,
  source: NewsSource,
  budget: FetchBudget
): Promise<ParsedItem[]> {
  const config = HTML_SCRAPE_CONFIGS[source.id];
  if (!config) throw new Error(`html_scrape source ${source.id} chưa có cấu hình scrape`);
  if (!source.feed_url) throw new Error("source has no feed_url");

  const listingRes = await fetch(source.feed_url, {
    headers: { "User-Agent": NEWS_FETCHER_USER_AGENT },
    signal: AbortSignal.timeout(12_000),
  });
  if (!listingRes.ok) throw new Error(`listing HTTP ${listingRes.status}`);
  const listingHtml = await listingRes.text();

  if (config.listingCards) {
    const cardItems = parseListingCards(listingHtml, config);
    // Fail loud: Webflow đổi layout thì phải thấy đỏ, không im lặng về 0 bài.
    if (cardItems.length === 0) {
      throw new Error("listing card không parse được bài nào — layout có thể đã đổi");
    }
    return cardItems;
  }

  // Slug root một cấp, dạng bài viết (dài, có gạch ngang), giữ thứ tự listing.
  const links: string[] = [];
  for (const match of listingHtml.matchAll(/href="(\/[a-z0-9][a-z0-9-]{11,}\/)"/g)) {
    const path = match[1];
    if ((config.excludePrefixes ?? []).some((prefix) => path.startsWith(prefix + "/") || path === prefix + "/")) continue;
    if (!path.includes("-")) continue;
    const url = config.origin + path;
    if (!links.includes(url)) links.push(url);
  }
  if (links.length === 0) throw new Error("listing không có link bài nào — cấu trúc site có thể đã đổi");

  // Dedupe TRƯỚC khi fetch meta: chỉ tốn subrequest cho bài thật sự mới.
  const inList = links.map((url) => `"${url}"`).join(",");
  const dupRes = await fetch(
    `${env.SUPABASE_URL}/rest/v1/news_origins?source_url=in.(${encodeURIComponent(inList)})&select=source_url`,
    { headers: pgHeaders(env) },
  );
  const known = new Set<string>(
    dupRes.ok ? ((await dupRes.json()) as { source_url: string }[]).map((row) => row.source_url) : [],
  );

  const fresh = links.filter((url) => !known.has(url)).slice(0, SCRAPE_MAX_NEW_PER_RUN);
  const items: ParsedItem[] = [];
  for (const url of fresh) {
    // Mỗi bài ở đường og-meta tốn 1 fetch meta + 1 fetch body ở ingestItems,
    // nên phải giữ chỗ 2 slot mới được đi tiếp.
    if (budget.left < 2) break;
    budget.left -= 1;
    try {
      const articleRes = await fetch(url, {
        headers: { "User-Agent": NEWS_FETCHER_USER_AGENT },
        signal: AbortSignal.timeout(12_000),
      });
      if (!articleRes.ok) continue;
      const html = await articleRes.text();
      const rawTitle = metaContent(html, "og:title");
      const published = metaContent(html, "article:published_time");
      if (!rawTitle || !published) continue;
      const suffix = config.titleSuffix;
      const title = decodeEntities(suffix && rawTitle.endsWith(suffix)
        ? rawTitle.slice(0, -suffix.length)
        : rawTitle);
      // published_time của site không mang timezone — coi là UTC.
      const publishedIso = /Z$|[+-]\d\d:?\d\d$/.test(published) ? published : `${published}Z`;
      items.push({
        title: title.slice(0, TITLE_LIMIT),
        link: url,
        summary: decodeEntities(metaContent(html, "og:description") ?? "").slice(0, SUMMARY_LIMIT),
        image_url: metaContent(html, "og:image"),
        published_at: new Date(publishedIso).toISOString(),
      });
    } catch (error) {
      console.warn(`[${source.id}] scrape article failed ${url}: ${error instanceof Error ? error.message : error}`);
    }
  }
  return items;
}

async function fetchAndParse(
  source: NewsSource,
  env: Env,
  budget: FetchBudget
): Promise<ParsedItem[]> {
  if (source.feed_type === "html_scrape") return scrapeHtmlListing(env, source, budget);
  if (!source.feed_url) throw new Error("source has no feed_url");
  if (!isSafePublicFeedUrl(source.feed_url)) {
    throw new Error(`unsafe feed_url rejected: ${source.feed_url}`);
  }

  const res = await fetchFeedWithRetry(source.feed_url, budget);
  if (!res.ok) throw new Error(`feed HTTP ${res.status}`);
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);

  if (source.feed_type === "rss") return parseRss(parsed);
  if (source.feed_type === "atom") return parseAtom(parsed);
  throw new Error(`Unsupported feed_type ${source.feed_type}`);
}

/** Lỗi mạng nhất thời (timeout / abort) — đáng thử lại; HTTP 4xx/5xx thì không. */
export function isTransientFetchError(error: unknown): boolean {
  const name = (error as { name?: string } | null)?.name;
  return name === "TimeoutError" || name === "AbortError";
}

// pickleball-com abort ~4/15 lần cron trong khi đo từ edge Cloudflare feed đó
// trả lời trong 250ms — tức là sự cố NHẤT THỜI chứ không phải chậm kinh niên,
// nên nới thời gian chờ không chữa được mà thử lại thì chữa được. Lần thử lại
// chỉ tốn ~250ms trong trường hợp thường vì nó chỉ chạy khi đã hỏng.
async function fetchFeedWithRetry(feedUrl: string, budget: FetchBudget): Promise<Response> {
  try {
    return await fetchFeedOnce(feedUrl);
  } catch (error) {
    if (budget.retries <= 0 || !isTransientFetchError(error)) throw error;
    budget.retries -= 1;
    console.warn(
      `[feed] thử lại ${feedUrl} sau lỗi nhất thời: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return await fetchFeedOnce(feedUrl);
  }
}

async function fetchFeedOnce(feedUrl: string): Promise<Response> {
  return await fetch(feedUrl, {
    headers: {
      "User-Agent": NEWS_FETCHER_USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9",
    },
    // 20s (trước là 12s). Đo từ chính edge Cloudflare: feed pickleball.com trả
    // lời 250ms, lần đầu 2.4s — nên 20s là dư sức cho đường bình thường, và
    // những lần abort là sự cố nhất thời, xử bằng thử lại chứ không phải bằng
    // nới thêm. Đây là thời gian CHỜ mạng, không tính vào 30s CPU của
    // scheduled handler.
    signal: AbortSignal.timeout(20_000),
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRss(parsed: any): ParsedItem[] {
  const channel = parsed?.rss?.channel;
  const items = channel?.item;
  if (!Array.isArray(items)) return [];

  return items.slice(0, MAX_ITEMS_PER_FEED).map((item) => {
    const title = decodeEntities(textOf(item.title));
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
    const title = decodeEntities(textOf(entry.title));
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
      "User-Agent": NEWS_FETCHER_USER_AGENT,
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

// Linear-time comment stripper (CodeQL js/polynomial-redos: the old
// /<!--[\s\S]*?-->/ regex is quadratic on pathological "<!--<!--<!--" input,
// and this runs on HTML fetched from external sources).
function stripHtmlComments(html: string): string {
  let out = "";
  let i = 0;
  for (;;) {
    const start = html.indexOf("<!--", i);
    if (start === -1) return out + html.slice(i);
    out += html.slice(i, start) + " ";
    const end = html.indexOf("-->", start + 4);
    if (end === -1) return out; // unterminated comment swallows the rest, same as the regex did
    i = end + 3;
  }
}

export function extractArticleText(html: string): string {
  const withoutNoise = stripHtmlComments(html)
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
