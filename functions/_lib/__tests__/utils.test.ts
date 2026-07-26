import { describe, expect, it } from "vitest";
import { buildTitle, normalizeImageUrl, sanitizeBlogHtml } from "../utils";

describe("sanitizeBlogHtml", () => {
  it("leaves normal blog markup intact", () => {
    const html =
      '<h2>Tiêu đề</h2><p>Đoạn văn <a href="https://example.com">link</a> ' +
      '<img src="https://lh3.googleusercontent.com/d/abc"></p><ul><li>score < 5</li></ul>';
    expect(sanitizeBlogHtml(html)).toBe(html);
  });

  it("strips nested fragments that reassemble into a tag after one pass", () => {
    const out = sanitizeBlogHtml("<scr<script>ipt>alert(1)</scr</script>ipt>");
    expect(out.toLowerCase()).not.toContain("<script");
  });

  it("strips event handlers that reassemble after one pass", () => {
    const out = sanitizeBlogHtml('<img src="x" onclonclick="x"ick="alert(1)">');
    expect(out).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("neutralizes javascript: URLs", () => {
    const out = sanitizeBlogHtml('<a href="javascript:alert(1)">x</a>');
    expect(out).not.toContain("javascript:");
  });
});

describe("normalizeImageUrl", () => {
  it("passes through real googleusercontent URLs", () => {
    const url = "https://lh3.googleusercontent.com/d/abc123";
    expect(normalizeImageUrl(url)).toBe(url);
  });

  it("does not treat googleusercontent.com in the path as a trusted host", () => {
    const url = "https://evil.com/googleusercontent.com?id=abc_123";
    // must fall through to Drive-ID extraction, not short-circuit
    expect(normalizeImageUrl(url)).toBe("https://lh3.googleusercontent.com/d/abc_123");
  });

  it("rejects lookalike hosts", () => {
    const url = "https://evilgoogleusercontent.com/x?id=abc";
    expect(normalizeImageUrl(url)).toBe("https://lh3.googleusercontent.com/d/abc");
  });

  it("converts Drive share links", () => {
    expect(normalizeImageUrl("https://drive.google.com/file/d/FILE_ID/view?usp=sharing"))
      .toBe("https://lh3.googleusercontent.com/d/FILE_ID");
  });

  it("returns non-Drive URLs unchanged", () => {
    expect(normalizeImageUrl("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });
});

// ─── buildTitle byte budget ────────────────────────────────
// buildHtml truncates the final <title> at 60 UTF-8 bytes. buildTitle used to
// decide whether " | ThePickleHub" fits by counting CHARACTERS, so Vietnamese
// titles got a suffix they had no room for and prod served an ellipsised
// title (measured 2026-07-26 on /vi/blog/the-thuc-mlp-la-gi).
describe("buildTitle byte budget", () => {
  const bytes = (s: string) => new TextEncoder().encode(s).length;

  it("appends the brand suffix when the total still fits 60 bytes", () => {
    const t = buildTitle("How to Play Pickleball | 7-Day Beginner Plan");
    expect(t.endsWith(" | ThePickleHub")).toBe(true);
    expect(bytes(t)).toBeLessThanOrEqual(60);
  });

  it("skips the suffix for a Vietnamese title that fits in chars but not bytes", () => {
    const raw = "Thể thức MLP Pickleball | Luật đồng đội"; // 39 chars, 51 bytes
    expect(raw.length + " | ThePickleHub".length).toBeLessThanOrEqual(60); // would have passed the old check
    const t = buildTitle(raw);
    expect(t).toBe(raw);
    expect(bytes(t)).toBeLessThanOrEqual(60);
  });

  it("never returns more than 60 bytes for a title that already fits", () => {
    for (const raw of [
      "MLP Format Explained 2026 | Major League Pickleball Rules",
      "Luật Pickleball 2026 | Hướng dẫn đầy đủ",
      "Cách tạo Bracket Pickleball | Kích thước & Mẫu 2026",
    ]) {
      expect(bytes(buildTitle(raw))).toBeLessThanOrEqual(60);
    }
  });
});
