// @vitest-environment jsdom
// Ngữ cảnh màn hình gửi trợ lý (facts) + form "Liên hệ admin" phía client.
import { afterEach, describe, expect, it } from "vitest";
import { assistantFacts, genericFacts, serializeFacts } from "@/lib/assistant-context";
import { prefillMessage, supportClientError, supportPayload } from "@/lib/assistant-support";
import { MAX_CTX_CHARS } from "../../../supabase/functions/site-assistant/shared";

afterEach(() => { document.body.innerHTML = ""; document.title = ""; });

describe("serializeFacts", () => {
  it("key: value lines in declaration order, skipping empty values", () => {
    expect(serializeFacts({ name: "Sân A", courts: 4, indoor: true, price: null, hours: undefined, note: "" })).toBe("name: Sân A\ncourts: 4\nindoor: true");
  });
  it("sanitizes control chars, newlines in values, angle brackets", () => {
    expect(serializeFacts({ "bad key\n": "a\u0000b\nc <script>" })).toBe("bad_key: a b c script");
  });
  it("clips each value and caps the total at a line boundary, deterministically", () => {
    const facts = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, "v".repeat(500)]));
    const out = serializeFacts(facts);
    expect(out.length).toBeLessThanOrEqual(MAX_CTX_CHARS);
    expect(out.split("\n").every((l) => l.length <= "k49: ".length + 300)).toBe(true);
    expect(serializeFacts(facts)).toBe(out);
    expect(serializeFacts({ a: "x".repeat(50), b: "y" }, 20)).toBe("");
    expect(serializeFacts({ a: "x", b: "y".repeat(50) }, 20)).toBe("a: x");
  });
});

describe("generic + merged facts", () => {
  it("reads route, title, h1 and login state from the rendered page", () => {
    document.title = "Sân A | ThePickleHub";
    document.body.innerHTML = "<main><h1>  Sân A  </h1></main>";
    expect(genericFacts(true)).toMatchObject({ title: "Sân A | ThePickleHub", h1: "Sân A", logged_in: "yes" });
  });
  it("puts screen facts first and respects the budget left by the summary", () => {
    document.body.innerHTML = "<h1>H</h1>";
    const s = assistantFacts({ label: "x", summary: "s".repeat(600), facts: { name: "Sân A", courts: 4 } }, false);
    expect(s.startsWith("name: Sân A\ncourts: 4\nroute: ")).toBe(true);
    expect(s).toContain("logged_in: no");
    expect(s.length).toBeLessThanOrEqual(MAX_CTX_CHARS - 600);
    expect(assistantFacts(null, false)).toContain("h1: H");
  });
});

describe("support form (client)", () => {
  const f = { message: "Cần giúp", name: "", phone: "", email: "", zalo: "", website: "" };
  it("validates lightly; guests need a contact", () => {
    expect(supportClientError({ ...f, message: " " }, true)).toBe("message_required");
    expect(supportClientError(f, false)).toBe("contact_required");
    expect(supportClientError(f, true)).toBeNull();
    expect(supportClientError({ ...f, email: "x@" }, true)).toBe("invalid_email");
    expect(supportClientError({ ...f, phone: "09 12" }, true)).toBe("invalid_phone");
    expect(supportClientError({ ...f, phone: "0912 345 678" }, false)).toBeNull();
  });
  it("prefills from the user's recent turns only", () => {
    expect(prefillMessage([{ role: "user", text: "a" }, { role: "bot", text: "b" }, { role: "user", text: " c " }])).toBe("a\nc");
  });
  it("payload carries page + clipped transcript and never a user id", () => {
    const p = supportPayload({ ...f, message: "x".repeat(2000) }, { page_type: "venues", route: "/san/a", page_label: "Sân A", lang: "vi" },
      Array.from({ length: 9 }, (_, i) => ({ role: i % 2 ? "bot" as const : "user" as const, text: "t".repeat(500) })));
    expect(p.support.message).toHaveLength(1000);
    expect(p.support.transcript).toHaveLength(6);
    expect(p.support.transcript[0].text).toHaveLength(300);
    expect(JSON.stringify(p)).not.toMatch(/user_id/);
  });
});
