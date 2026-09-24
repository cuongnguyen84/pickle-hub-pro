import { afterEach, describe, expect, it, vi } from "vitest";

import { onRequestPost, signBody } from "../api/wriai-webhook";

/**
 * The Wriai webhook is a public URL that writes into the database, so the
 * contract worth pinning is: no secret → closed, bad signature → 401 before any
 * storage call, and a signed publish lands in wriai_inbox (never vi_blog_posts).
 */

const SECRET = "test-secret";
const env = (secret: string | undefined = SECRET) => ({
  WRIAI_WEBHOOK_SECRET: secret,
  SUPABASE_URL: "https://db.example",
  SUPABASE_SERVICE_ROLE_KEY: "service",
});

async function call(body: unknown, opts: { secret?: string; sign?: string } = {}) {
  const raw = JSON.stringify(body);
  const sig = opts.sign ?? (await signBody(SECRET, raw));
  const request = new Request("https://x/api/wriai-webhook", {
    method: "POST",
    headers: { "x-wriai-signature": sig },
    body: raw,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return onRequestPost({ request, env: env(opts.secret) } as any);
}

afterEach(() => vi.restoreAllMocks());

describe("wriai-webhook", () => {
  it("is closed when no secret is configured", async () => {
    const res = await call({ event: "ping" }, { secret: "" });
    expect(res.status).toBe(503);
  });

  it("rejects a bad signature without touching storage", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await call({ event: "article.publish", article: { title: "x" } }, { sign: "sha256=00" });
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("answers a signed ping", async () => {
    const res = await call({ event: "ping" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("stores a publish in wriai_inbox and returns its id", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "11111111-1111-1111-1111-111111111111", slug: "vot-tot" }]), { status: 201 }),
    );
    const res = await call({ event: "article.publish", article: { title: "Vợt tốt", slug: "Vot-Tot!" } });
    expect(await res.json()).toMatchObject({
      success: true,
      post_id: "11111111-1111-1111-1111-111111111111",
      url: "https://www.thepicklehub.net/vi/blog/vot-tot",
    });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe("https://db.example/rest/v1/wriai_inbox");
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({ title: "Vợt tốt", slug: "vot-tot" });
  });
});
