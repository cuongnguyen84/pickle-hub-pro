/** Network boundary for scraper-owned fetches; no ambient redirect following. */
export const SCRAPE_HOSTS = [
  "majorleaguepickleball.co",
  "brackets.pickleballteamleagues.com",
  "brackets.pickleballtournaments.com",
] as const;
export const BROWSER_REQUEST_ALLOWLIST = ["^https://brackets\\.pickleballtournaments\\.com(?::443)?/"];

export function assertAllowedUrl(input: string, hosts: readonly string[]): URL {
  if (typeof input !== "string" || !/^https:\/\//i.test(input)) throw new Error("Unsafe URL scheme");
  const authority = input.slice(input.indexOf("//") + 2).split(/[/?#]/, 1)[0];
  if (/[\\%]/.test(authority)) throw new Error("Encoded or ambiguous authority");
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.includes(url.hostname)) {
    throw new Error("URL origin not allowed");
  }
  return url;
}

interface Policy {
  hosts: readonly string[];
  maxBytes: number;
  timeoutMs: number;
  contentTypes: readonly string[];
  maxRedirects?: number;
}

export async function safeFetch(
  input: string,
  init: RequestInit,
  policy: Policy,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      void reader?.cancel().catch(() => {});
      reject(new Error("Upstream deadline exceeded"));
    }, policy.timeoutMs);
  });
  let rejectAbort: ((error: Error) => void) | undefined;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    controller.abort();
    void reader?.cancel().catch(() => {});
    rejectAbort?.(new Error("Upstream aborted"));
  };
  init.signal?.addEventListener("abort", abort, { once: true });
  try {
    if (init.signal?.aborted) throw new Error("Upstream aborted");
    const operation = async () => {
      let url = assertAllowedUrl(input, policy.hosts);
      for (let hop = 0; ; hop++) {
        const res = await fetcher(url.href, { ...init, signal: controller.signal, redirect: "manual" });
        if (res.status >= 300 && res.status <= 399 && res.status !== 304) {
          await res.body?.cancel();
          // Credential-bearing API mutations must never be replayed elsewhere.
          if ((init.method ?? "GET") !== "GET" || hop >= (policy.maxRedirects ?? 3)) throw new Error("Upstream redirect rejected");
          const location = res.headers.get("location");
          if (!location) throw new Error("Redirect missing location");
          const next = location.startsWith("//") ? `${url.protocol}${location}` : /^[a-z][a-z0-9+.-]*:/i.test(location) ? location : new URL(location, url).href;
          url = assertAllowedUrl(next, policy.hosts);
          continue;
        }
        if (!res.body) return res;
        const type = (res.headers.get("content-type") ?? "").split(";", 1)[0].trim().toLowerCase();
        if (!policy.contentTypes.includes(type)) {
          await res.body.cancel();
          throw new Error("Upstream content type rejected");
        }
        const length = res.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > policy.maxBytes)) {
          await res.body.cancel();
          throw new Error("Upstream body exceeds limit");
        }
        reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > policy.maxBytes) {
            await reader.cancel();
            throw new Error("Upstream body exceeds limit");
          }
          chunks.push(value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return new Response(bytes, { status: res.status, statusText: res.statusText, headers: res.headers });
      }
    };
    return await Promise.race([operation(), timeout, aborted]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    init.signal?.removeEventListener("abort", abort);
  }
}

/** Internal API hosts are exact runtime project origins, never scrape input. */
export function workerFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const host = new URL(input).hostname;
  const isScrape = (SCRAPE_HOSTS as readonly string[]).includes(host);
  const apiHosts = host === "api.cloudflare.com" ? [host] : /^[a-z0-9]{20}\.supabase\.co$/.test(host) ? [host] : [];
  return safeFetch(input, init, {
    hosts: isScrape ? SCRAPE_HOSTS : apiHosts,
    maxBytes: host === "api.cloudflare.com" ? 10 * 1024 * 1024 : isScrape ? 8 * 1024 * 1024 : 2 * 1024 * 1024,
    timeoutMs: host === "api.cloudflare.com" ? 130_000 : 25_000,
    contentTypes: isScrape ? ["text/html", "application/xhtml+xml"] : ["application/json"],
  });
}

/** Bound the unauthenticated request body before HMAC verification. */
export async function readScrapeRequest(request: Request, maxBytes = 64 * 1024, timeoutMs = 10_000): Promise<string> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new Error("Request body exceeds limit");
  if (!request.body) return "";
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
    void reader.cancel().catch(() => {});
    reject(new Error("Request deadline exceeded"));
  }, timeoutMs); });
  try {
    return await Promise.race([(async () => {
      const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
      let size = 0, text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { await reader.cancel(); throw new Error("Request body exceeds limit"); }
        text += decoder.decode(value, { stream: true });
      }
      return text + decoder.decode();
    })(), timeout]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

/** Cap retained HTML across all MLP overview/pool pages, not just each fetch. */
export function addScrapeBytes(total: number, html: string, maxBytes = 16 * 1024 * 1024): number {
  const next = total + new TextEncoder().encode(html).byteLength;
  if (next > maxBytes) throw new Error("Aggregate scrape body exceeds limit");
  return next;
}
