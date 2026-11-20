import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { assertAllowedUrl, safeFetch, SCRAPE_HOSTS, BROWSER_REQUEST_ALLOWLIST, workerFetch, readScrapeRequest, addScrapeBytes } from "../safe-fetch";
const URL_OK = "https://brackets.pickleballtournaments.com/tournaments/example";
const policy = { hosts: SCRAPE_HOSTS, maxBytes: 300_000, timeoutMs: 1000, contentTypes: ["text/html"] };
const response = (body = "fixture") => new Response(body, { headers: { "content-type": "text/html" } });
afterEach(() => vi.restoreAllMocks());

describe("scraper network origin boundary", () => {
  it.each(["http://brackets.pickleballtournaments.com/a", "https://127.0.0.1/", "https://2130706433/", "https://[::1]/", "https://169.254.169.254/", "https://localhost/", "https://10.0.0.1/", "https://brackets.pickleballtournaments.com.evil.test/", "https://user:pass@brackets.pickleballtournaments.com/", "https://brackets.pickleballtournaments.com:8443/", "https://%62rackets.pickleballtournaments.com/", "//brackets.pickleballtournaments.com/a"])("rejects unsafe initial URL %s without fetching", async (url) => {
    const fetcher = vi.fn();
    await expect(safeFetch(url, {}, policy, fetcher)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("preserves approved HTTPS/default port URLs", () => {
    for (const host of SCRAPE_HOSTS) expect(assertAllowedUrl(`https://${host}:443/a`, SCRAPE_HOSTS).hostname).toBe(host);
  });
  it.each(["http://127.0.0.1/x", "https://evil.test/x", "//127.0.0.1/x", "https://%62rackets.pickleballtournaments.com/x"])("validates redirect destination before any next request %s", async (location) => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    await expect(safeFetch(URL_OK, {}, policy, fetcher)).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
  });
  it("follows bounded legitimate relative redirects", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "/next" } })).mockResolvedValueOnce(response());
    expect(await (await safeFetch(URL_OK, {}, policy, fetcher)).text()).toBe("fixture");
    expect(fetcher.mock.calls[1][0]).toBe("https://brackets.pickleballtournaments.com/next");
  });
  it("stops redirect loops and rejects mutation redirects", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(null, { status: 302, headers: { location: "/loop" } }));
    await expect(safeFetch(URL_OK, {}, policy, fetcher)).rejects.toThrow("redirect rejected");
    expect(fetcher).toHaveBeenCalledTimes(4);
    fetcher.mockClear();
    await expect(safeFetch(URL_OK, { method: "POST" }, policy, fetcher)).rejects.toThrow("redirect rejected");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("bounded streamed responses", () => {
  it("preserves the existing PPA HTML fixture", async () => {
    const fixture = readFileSync(new URL("../../__fixtures__/2026-ppa-finals-mens-doubles.html", import.meta.url), "utf8");
    const result = await safeFetch(URL_OK, {}, policy, vi.fn().mockResolvedValue(response(fixture)));
    expect(await result.text()).toBe(fixture);
  });
  it.each(["application/octet-stream", "", "text/plain"])("rejects unsupported content type %s", async (type) => {
    await expect(safeFetch(URL_OK, {}, policy, vi.fn().mockResolvedValue(new Response("x", { headers: { "content-type": type } })))).rejects.toThrow("content type");
  });
  it("caps an oversized declared length before reading", async () => {
    const cancel = vi.fn();const stream = new ReadableStream({ cancel });
    await expect(safeFetch(URL_OK, {}, { ...policy, maxBytes: 4 }, vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-type": "text/html", "content-length": "5" } })))).rejects.toThrow("limit");expect(cancel).toHaveBeenCalled();
  });
  it("caps one large chunk without content-length and cancels it", async () => {
    const cancel = vi.fn();const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(100)); }, cancel });
    await expect(safeFetch(URL_OK, {}, { ...policy, maxBytes: 4 }, vi.fn().mockResolvedValue(new Response(stream, { headers: { "content-type": "text/html" } })))).rejects.toThrow("limit");expect(cancel).toHaveBeenCalled();
  });
  it("caps cumulative chunks and accepts exact limit with no declared length", async () => {
    const build = () => new ReadableStream({ start(c) { c.enqueue(new Uint8Array([65,66])); c.enqueue(new Uint8Array([67,68]));c.close(); } });
    const make = () => vi.fn().mockResolvedValue(new Response(build(), { headers: { "content-type": "text/html" } }));
    await expect(safeFetch(URL_OK, {}, { ...policy, maxBytes: 3 }, make())).rejects.toThrow("limit");
    expect(await (await safeFetch(URL_OK, {}, { ...policy, maxBytes: 4 }, make())).text()).toBe("ABCD");
  });
  it("deadline covers a stalled body after headers", async () => {
    const cancel = vi.fn();let signal: AbortSignal | undefined;
    const fetcher = vi.fn(async (_url, init) => { signal=init.signal;return new Response(new ReadableStream({ cancel }), { headers: { "content-type": "text/html" } }); });
    await expect(safeFetch(URL_OK, {}, { ...policy, timeoutMs: 10 }, fetcher)).rejects.toThrow("deadline");expect(signal?.aborted).toBe(true);expect(cancel).toHaveBeenCalled();
  });
  it("rejects pre-aborted requests without a network call", async () => {
    const c=new AbortController();c.abort();const fetcher=vi.fn();await expect(safeFetch(URL_OK,{signal:c.signal},policy,fetcher)).rejects.toThrow("aborted");expect(fetcher).not.toHaveBeenCalled();
  });
  it("allows supported JSON and blocks redirects on credential-bearing API POST", async () => {
    const fetcher=vi.spyOn(globalThis,"fetch").mockResolvedValueOnce(new Response('{"ok":true}',{headers:{"content-type":"application/json; charset=utf-8"}}));
    expect(await(await workerFetch("https://api.cloudflare.com/client/v4/test",{method:"POST"})).json()).toEqual({ok:true});expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("browser allowlist rejects non-approved remote browser navigations/resources",()=>{
    const re=new RegExp(BROWSER_REQUEST_ALLOWLIST[0]);expect(re.test(URL_OK)).toBe(true);for(const u of["http://127.0.0.1/","https://127.0.0.1/","https://evil.test/","https://user@brackets.pickleballtournaments.com/","https://brackets.pickleballtournaments.com.evil.test/"])expect(re.test(u)).toBe(false);
  });
});


describe("request stream and caller aborts", () => {
  it("aborts stalled response reading when caller aborts", async () => {
    const controller = new AbortController(); const cancel = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers: { "content-type": "text/html" } }));
    const pending = safeFetch(URL_OK, { signal: controller.signal }, policy, fetcher);
    await new Promise(resolve => setTimeout(resolve, 0));controller.abort();
    await expect(pending).rejects.toThrow("aborted");expect(cancel).toHaveBeenCalled();
  });
  it("bounds unauthenticated request bodies with and without length", async () => {
    await expect(readScrapeRequest(new Request(URL_OK, { method: "POST", body: "12345" }), 4)).rejects.toThrow("limit");
    expect(await readScrapeRequest(new Request(URL_OK, { method: "POST", body: "{}" }), 4)).toBe("{}");
    await expect(readScrapeRequest(new Request(URL_OK, { method: "POST", body: "{}", headers: { "content-length": "100" } }), 4)).rejects.toThrow("limit");
  });
  it("deadlines stalled request bodies before signature verification", async () => {
    const cancel = vi.fn();
    const request = { headers: new Headers(), body: new ReadableStream({ cancel }) } as Request;
    await expect(readScrapeRequest(request, 4, 10)).rejects.toThrow("deadline");expect(cancel).toHaveBeenCalled();
  });
});


describe("API credentials cannot cross origins", () => {
  it("does not forward Supabase auth on a redirect to another API host", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://api.cloudflare.com/client/v4/x" } }));
    await expect(workerFetch("https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/x", { headers: { Authorization: "Bearer test-only-fixture" } })).rejects.toThrow("not allowed");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("allows an empty successful204 API response", async () => {
    vi.spyOn(globalThis,"fetch").mockResolvedValue(new Response(null,{status:204}));
    expect((await workerFetch("https://ajvlcamxemgbxduhiqrl.supabase.co/rest/v1/x",{method:"PATCH"})).status).toBe(204);
  });
});


it("caps retained HTML across pages using UTF8 byte counts", () => {
  const first = addScrapeBytes(0, "é", 4);expect(first).toBe(2);
  expect(addScrapeBytes(first, "ab", 4)).toBe(4);
  expect(() => addScrapeBytes(first, "abc", 4)).toThrow("Aggregate");
});
