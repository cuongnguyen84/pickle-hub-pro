// site-assistant { support }: kiểm form, hạn mức, câu trả lời, tin Telegram.
import { describe, expect, it } from "vitest";
import {
  ADMIN_SUPPORT_URL, needsContact, normPhone, readSupport, supportLimitsFrom, supportQuotaOutcome, supportReply, telegramText,
} from "../support.ts";

const ok = (raw: unknown) => {
  const r = readSupport(raw);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe("readSupport", () => {
  it("requires a message", () => {
    expect(readSupport({ message: " " })).toEqual({ ok: false, error: "message_required" });
    expect(readSupport(null)).toEqual({ ok: false, error: "message_required" });
  });
  it("light-validates email and phone", () => {
    expect(readSupport({ message: "help", email: "nope" })).toEqual({ ok: false, error: "invalid_email" });
    expect(readSupport({ message: "help", phone: "12ab" })).toEqual({ ok: false, error: "invalid_phone" });
    expect(ok({ message: "help", phone: "0912 345 678", email: "a@b.vn" })).toMatchObject({ phone: "0912345678", email: "a@b.vn" });
    expect(normPhone("+84 (912) 345-678")).toBe("+84912345678");
    expect(normPhone("123")).toBeNull();
  });
  it("clips every field, strips control chars, keeps message newlines", () => {
    const v = ok({
      message: "a\u0000b\nline2\n\n\n\nend" + "x".repeat(5000), name: "N".repeat(500), zalo: "z".repeat(500),
      route: "/r".repeat(500), page_label: "L\u0007".repeat(500), page_type: "hacker", lang: "fr",
    });
    expect(v.message.startsWith("a b\nline2\n\nend")).toBe(true);
    expect(v.message.length).toBeLessThanOrEqual(1000);
    expect(v.name!.length).toBe(80);
    expect(v.zalo!.length).toBe(60);
    expect(v.route!.length).toBeLessThanOrEqual(200);
    expect(v.page_label).not.toContain("\u0007");
    expect(v.page_type).toBe("general");
    expect(v.lang).toBe("vi");
  });
  it("never takes user_id from the client; clips transcript to 6 × 300", () => {
    const v = ok({
      message: "help", user_id: "00000000-0000-0000-0000-000000000000",
      transcript: [...Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? "bot" : "user", text: "t".repeat(900) })), { role: "system", text: "x" }],
    });
    expect(v).not.toHaveProperty("user_id");
    expect(v.transcript).toHaveLength(5);
    expect(v.transcript.every((t) => t.text.length === 300)).toBe(true);
  });
  it("flags the honeypot", () => {
    expect(ok({ message: "help", website: "http://spam" }).honeypot).toBe(true);
    expect(ok({ message: "help", website: "" }).honeypot).toBe(false);
  });
  it("guests must leave one contact; signed-in users need not", () => {
    const v = ok({ message: "help" });
    expect(needsContact(v, null)).toBe(true);
    expect(needsContact(v, "u1")).toBe(false);
    expect(needsContact(ok({ message: "help", zalo: "abc" }), null)).toBe(false);
  });
});

describe("support rate limit", () => {
  it("defaults 3/hour + 10/day, env-configurable and clamped", () => {
    expect(supportLimitsFrom(() => undefined)).toEqual({ hourly: 3, daily: 10 });
    const env: Record<string, string> = { SUPPORT_REQUEST_HOURLY: "5", SUPPORT_REQUEST_DAILY: "9999" };
    expect(supportLimitsFrom((k) => env[k])).toEqual({ hourly: 5, daily: 50 });
    expect(supportLimitsFrom(() => "junk")).toEqual({ hourly: 3, daily: 10 });
  });
  it("fails closed on RPC errors / unknown values", () => {
    expect(supportQuotaOutcome({ data: "ok", error: null })).toBe("ok");
    expect(supportQuotaOutcome({ data: "rate_limited", error: null })).toBe("rate_limited");
    expect(supportQuotaOutcome({ data: null, error: { message: "missing" } })).toBe("error");
    expect(supportQuotaOutcome({ data: "capped", error: null })).toBe("error");
  });
});

describe("supportReply", () => {
  it("confirms in the user's language", () => {
    expect(supportReply("vi", "sent")).toContain("Đã gửi cho admin");
    expect(supportReply("en", "sent")).toContain("Sent to the ThePickleHub admin");
    for (const o of ["rate_limited", "error", "message_required", "invalid_email", "invalid_phone", "contact_required"] as const) {
      expect(supportReply("vi", o)).not.toBe(supportReply("en", o));
    }
  });
});

describe("telegramText", () => {
  const v = ok({
    message: "Không đăng ký được giải\n" + "m".repeat(2000), name: "Anh *Bold* _x_ <b>", phone: "0912345678", email: "a@b.vn",
    page_type: "venues", route: "/san/abc", page_label: "Sân A", lang: "vi",
  });
  const t = telegramText(v, "0123456789abcdef", null);
  it("has the header, contact, page, clipped message and admin link", () => {
    expect(t.startsWith("🆘 Yêu cầu hỗ trợ mới #01234567")).toBe(true);
    expect(t).toContain("SĐT 0912345678");
    expect(t).toContain("Email a@b.vn");
    expect(t).toContain("Trang: venues /san/abc — Sân A");
    expect(t).toContain("khách");
    expect(t).toContain(ADMIN_SUPPORT_URL);
    expect(t).toContain("m…");
    expect(t.length).toBeLessThanOrEqual(3500);
  });
  it("is plain text (no parse_mode) so markup chars pass through harmlessly", () => {
    expect(t).toContain("Anh *Bold* _x_ <b>");
  });
  it("never contains secrets or env names", () => {
    expect(t).not.toMatch(/TELEGRAM|SERVICE_ROLE|GEMINI|bot\d+:/);
    expect(telegramText(ok({ message: "hi" }), "id", "u")).toContain("(không để lại liên hệ)");
  });
});
