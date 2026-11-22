import { describe, expect, it } from "vitest";
import { initialLanguageForPath } from "../initial-language";

describe("initialLanguageForPath", () => {
  it("keeps /feed in English when the visitor's stored language and geo are Vietnamese", () => {
    expect(initialLanguageForPath("/feed", "vi", "vi")).toBe("en");
    expect(initialLanguageForPath("/vi/feed", "en", "en")).toBe("vi");
  });

  it("still honors a stored language on pages that are not a feed locale", () => {
    expect(initialLanguageForPath("/tournaments", "vi", "en")).toBe("vi");
    expect(initialLanguageForPath("/", null, "vi")).toBe("vi");
    expect(initialLanguageForPath("/news", null, null)).toBe("en");
  });
});
