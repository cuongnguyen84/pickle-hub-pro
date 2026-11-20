import { afterEach, expect, it, vi } from "vitest";
type Handler = (request: Request) => Promise<Response>;
type Row = { registration_id: string; magic_token: string; profile_id: string; contact_email: string | null; event_title_vi: string; cancelled_at: string | null; zalo_user_id?: string };
interface Query { select: () => Query; eq: () => Query; gte: () => Promise<{ count: number; error: object | null }>; maybeSingle: () => Promise<{ data: { expires_at: string } }>; insert: (value: unknown) => Promise<{ error: null }>; }
const state = vi.hoisted(() => ({ handler: null as Handler | null, rows: [] as Row[], confirmed: true, send: vi.fn(), rateError: false, captcha: true, email: "owner@example.test", expired: false, providerOk: true, rpc: vi.fn(), ledger: vi.fn() }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.89.0", () => ({ createClient: () => ({
  from: () => { const c: Query = { select: () => c, eq: () => c,
    gte: async () => ({ count: 0, error: state.rateError ? {} : null }), maybeSingle: async () => ({ data: { expires_at: state.expired ? "2000-01-01" : "2099-01-01" } }), insert: async (value: unknown) => { state.ledger(value); return { error: null }; } }; return c; },
  rpc: async () => { state.rpc(); return { data: state.rows }; },
  auth: { admin: { getUserById: async () => ({ data: { user: { email: state.email, email_confirmed_at: state.confirmed ? "2026-01-01" : null } } }) } },
}) }));
vi.mock("../auth.ts", () => ({ jsonResponse: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }) }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); state.rows = []; state.confirmed = true; state.rateError = false; state.send.mockReset(); state.rpc.mockReset(); state.ledger.mockReset(); state.captcha = true; state.email = "owner@example.test"; state.expired = false; state.providerOk = true; });
async function run(captcha = true) {
  vi.stubGlobal("Deno", { env: { get: (key: string) => ({ TURNSTILE_SECRET: "test", RESEND_API_KEY: "test", ZALO_OA_ACCESS_TOKEN: "test", ZALO_TEMPLATE_ID_RECOVERY: "test" }[key]) }, serve: (handler: Handler) => { state.handler = handler; } });
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (String(url).includes("siteverify")) return Response.json({ success: state.captcha });
    state.send(url, init); return state.providerOk ? Response.json({ id: "test", error: 0 }) : new Response("provider unavailable", { status: 503 });
  }));
  await import("../../request-recovery-link/index.ts");
  return state.handler!(new Request("https://example.test", { method: "POST", body: JSON.stringify({ phone_e164: "+84901234567", ...(captcha ? { captcha_token: "human-not-owner" } : {}) }) }));
}
const registration = { registration_id: "reg", magic_token: "never-disclose-this-token", profile_id: "profile", contact_email: "owner@example.test", event_title_vi: "Test", cancelled_at: null };
it.each(["absent", "no-channel", "unverified-email", "verified-email"])("never reveals token or existence: %s", async (kind) => {
  state.rows = kind === "absent" ? [] : [{ ...registration, ...(kind === "no-channel" ? { contact_email: null } : {}) }];
  state.confirmed = kind !== "unverified-email";
  const response = await run();
  expect(await response.json()).toEqual({ ok: true, channel: "registered_channel" });
  expect(state.send).toHaveBeenCalledTimes(kind === "verified-email" ? 1 : 0);
  if (kind === "verified-email") {
    const payload = JSON.parse(state.send.mock.calls[0][1].body);
    expect(payload.to).toBe("owner@example.test");
    expect(payload.html).toContain("never-disclose-this-token");
  }
});
it("requires CAPTCHA before sending to a verified channel", async () => {
  state.rows = [registration]; expect(await (await run(false)).json()).toEqual({ ok: false, code: "captcha_required" }); expect(state.send).not.toHaveBeenCalled();
});
it("fails closed when the attempt lookup fails", async () => {
  state.rateError = true; expect((await run()).status).toBe(503); expect(state.send).not.toHaveBeenCalled();
});
it("frontend acknowledges conditionally and has no response-token navigation sink", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("src/pages/RecoveryRegistration.tsx", "utf8");
  expect(source).toContain('data.channel === "registered_channel"');
  expect(source).toContain("contact the organizer to verify ownership");
  expect(source).not.toMatch(/data\.(?:magic_token|recovery_url)|result\.magic_token/);
});

it("does not send to a confirmed but mismatched email", async () => {
  state.rows = [registration]; state.email = "other@example.test";
  expect(await (await run()).json()).toEqual({ ok: true, channel: "registered_channel" }); expect(state.send).not.toHaveBeenCalled();
});
it("invalid CAPTCHA cannot look up registrations or send", async () => {
  state.captcha = false; expect((await run()).status).toBe(400); expect(state.rpc).not.toHaveBeenCalled(); expect(state.send).not.toHaveBeenCalled();
});
it("ZNS recipient is registered phone, never a request-selected delivery address", async () => {
  state.rows = [{ ...registration, zalo_user_id: "stored-follower" }]; await run();
  expect(JSON.parse(state.send.mock.calls[0][1].body).phone).toBe("84901234567");
});
it.each(["cancelled", "expired", "provider-failure"])("does not disclose delivery state: %s", async (kind) => {
  state.rows = [{ ...registration, cancelled_at: kind === "cancelled" ? "2026-01-01" : null }];
  state.expired = kind === "expired"; state.providerOk = kind !== "provider-failure";
  expect(await (await run()).json()).toEqual({ ok: true, channel: "registered_channel" });
  expect(state.send).toHaveBeenCalledTimes(kind === "provider-failure" ? 1 : 0);
});

it.each(["zalo", "email"])("does not accept malformed %s provider success", async (kind) => {
  state.rows = [{ ...registration, ...(kind === "zalo" ? { zalo_user_id: "stored-follower", contact_email: null } : {}) }];
  await run();
  vi.stubGlobal("fetch", vi.fn(async (url) => String(url).includes("siteverify") ? Response.json({ success: true }) : Response.json({}))); 
  const response = await state.handler!(new Request("https://example.test", { method: "POST", body: JSON.stringify({ phone_e164: "+84901234567", captcha_token: "test" }) }));
  expect(await response.json()).toEqual({ ok: true, channel: "registered_channel" });
  expect(state.ledger).toHaveBeenLastCalledWith(expect.objectContaining({ succeeded: false }));
});
