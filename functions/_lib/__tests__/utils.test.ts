import { describe, expect, it } from "vitest";
import { normalizeImageUrl, sanitizeBlogHtml } from "../utils";

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
