import { describe, expect, it } from "vitest";
import { safeHttpsUrl } from "../url-utils";

describe("safeHttpsUrl", () => {
  it("accepts canonical HTTPS image URLs", () => {
    expect(safeHttpsUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    );
  });

  it("normalizes Google Drive links before validation", () => {
    expect(
      safeHttpsUrl("https://drive.google.com/file/d/abc_123/view?usp=sharing"),
    ).toBe("https://lh3.googleusercontent.com/d/abc_123");
  });

  it.each([
    "javascript:alert(1)",
    "data:image/svg+xml,<svg></svg>",
    "http://cdn.example.com/a.png",
    "https://user:pass@example.com/a.png",
    "/relative/image.png",
    "not a URL",
  ])("rejects unsafe or malformed input: %s", (value) => {
    expect(safeHttpsUrl(value)).toBe("");
  });
});
