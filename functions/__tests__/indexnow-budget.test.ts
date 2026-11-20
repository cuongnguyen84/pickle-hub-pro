import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../api/indexnow";
const env = { INDEXNOW_SECRET: "test-secret", INDEXNOW_KEY: "key", SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "private-service" };
const call = (secret = "test-secret", method = "POST") => (onRequest as unknown as (c: unknown) => Promise<Response>)({ env, request: new Request(`https://www.thepicklehub.net/api/indexnow?key=${secret}`, { method, ...(method === "POST" ? { body: JSON.stringify({ urls: ["https://www.thepicklehub.net/"] }) } : {}) }) });
afterEach(() => vi.unstubAllGlobals());
describe("IndexNow enforceable budget", () => {
  it("authenticates before any budget/network work", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect((await call("wrong")).status).toBe(401); expect(f).not.toHaveBeenCalled();
  });
  it("rejects unsupported methods before consuming a slot", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f);
    expect((await call("test-secret", "DELETE")).status).toBe(405); expect(f).not.toHaveBeenCalled();
  });
  it("returns429 without upstream submission when budget denied", async () => {
    const f = vi.fn().mockResolvedValue(Response.json(false)); vi.stubGlobal("fetch", f);
    const r = await call(); expect(r.status).toBe(429); expect(r.headers.get("Retry-After")).toBe("60"); expect(f).toHaveBeenCalledTimes(1);
  });
  it.each(["error", "malformed", "http"])("fails closed for %s budget failure without disclosure", async mode => {
    const f = vi.fn().mockImplementation(async () => { if(mode === "error") throw Error("private-service"); return mode === "http" ? new Response("private-service", {status:500}) : Response.json({allowed:true}); }); vi.stubGlobal("fetch",f);
    const r=await call(); expect(r.status).toBe(503); expect(await r.text()).not.toContain("private-service"); expect(f).toHaveBeenCalledTimes(1);
  });
  it("consumes a server-side shared budget then submits an authorized request", async () => {
    const f=vi.fn().mockResolvedValueOnce(Response.json(true)).mockResolvedValueOnce(new Response("ok")); vi.stubGlobal("fetch",f);
    expect((await call()).status).toBe(200); expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][0]).toBe("https://example.supabase.co/rest/v1/rpc/consume_indexnow_budget");
    expect(f.mock.calls[0][1].body).toBe("{}"); expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
});
