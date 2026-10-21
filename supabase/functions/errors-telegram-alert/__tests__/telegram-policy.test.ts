import { describe, expect, it } from "vitest";
import {
  instantMarkdownV2,
  instantText,
  isCriticalEdgeFunction,
  isCriticalText,
} from "../telegram-policy";

describe("telegram-policy", () => {
  it("treats only payment, auth and prerender functions as critical", () => {
    for (const slug of ["create-payment-order", "mark-payment-claimed", "phone-otp-send", "phone-otp-verify", "send-auth-email", "pages-prerender"]) {
      expect(isCriticalEdgeFunction(slug)).toBe(true);
    }
    for (const slug of ["news-rewrite", "news-check", "ops-job-digest", "mux-sync-assets", "dupr-sync", "pages-sitemap"]) {
      expect(isCriticalEdgeFunction(slug)).toBe(false);
    }
  });

  it("flags payment and auth errors but not ordinary content jobs", () => {
    expect(isCriticalText("create-payment-order")).toBe(true);
    expect(isCriticalText(null, "SePay webhook rejected")).toBe(true);
    expect(isCriticalText("TypeError", "https://www.thepicklehub.net/auth/callback")).toBe(true);
    expect(isCriticalText("phone-otp-send")).toBe(true);
    expect(isCriticalText("Login failed: invalid grant")).toBe(true);
    expect(isCriticalText("news-rewrite", "x-draft", "social-poster", "Unexpected token <")).toBe(false);
    expect(isCriticalText("author bio missing")).toBe(false);
    expect(isCriticalText(null, undefined, "")).toBe(false);
  });

  it("prefixes instant messages once", () => {
    expect(instantText("Site down")).toBe("[Grok Bot] 🔴 Site down");
    expect(instantText("Back up", "resolved")).toBe("[Grok Bot] ✅ Back up");
    expect(instantText("[Grok Bot] 🔴 x")).toBe("[Grok Bot] 🔴 x");
    expect(instantMarkdownV2("*spike*")).toBe("\\[Grok Bot\\] 🔴 *spike*");
    expect(instantMarkdownV2(instantMarkdownV2("a"))).toBe("\\[Grok Bot\\] 🔴 a");
  });
});
