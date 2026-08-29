import { describe, expect, it } from "vitest";
import {
  classifyRewriteFailure,
  fallbackContentKind,
  validateLanguageDraft,
  type NewsLanguageDraft,
} from "../news-rewrite-validation";

function draft(words: number, language: "en" | "vi" = "en"): NewsLanguageDraft {
  const token = language === "vi" ? "tiếng" : "word";
  return {
    title: language === "vi" ? "Tiêu đề pickleball hợp lệ" : "A valid pickleball headline",
    summary: (language === "vi" ? "Đây là bản tóm tắt tin pickleball hợp lệ. " : "This is a valid pickleball news summary. ").repeat(5),
    category: "community",
    importance: 3,
    sections: [{ paragraphs: [Array.from({ length: words }, () => token).join(" ")] }],
  };
}

describe("news rewrite validation", () => {
  it("accepts a brief slightly above the editorial target", () => {
    expect(validateLanguageDraft("vi", draft(277, "vi"), "brief")).toEqual([]);
  });

  it("rejects output beyond the hard safety limit", () => {
    expect(validateLanguageDraft("en", draft(321), "brief").map((i) => i.code)).toContain("word_count");
  });

  it("can downgrade a thin full article when both languages are valid briefs", () => {
    expect(fallbackContentKind("full", draft(280), draft(280, "vi"))).toBe("brief");
  });

  it("catches a diacritic-less VI title even when the body is fine", () => {
    const d = draft(200, "vi");
    d.title = "Major League Pickleball Cong Bo Chung Ket 2026 Tai Thanh Phố New York";
    const issues = validateLanguageDraft("vi", d, "brief");
    expect(issues.map((i) => i.message)).toContain("vi title is missing Vietnamese diacritics");
    expect(issues.map((i) => i.message)).not.toContain("vi body is missing Vietnamese diacritics");
  });

  it("marks length and transient Gemini failures retryable", () => {
    expect(classifyRewriteFailure("vi body has 340 words; hard limit is 130-320")).toEqual({ kind: "length", retryable: true });
    expect(classifyRewriteFailure("Gemini HTTP 429: quota").retryable).toBe(true);
  });
});
