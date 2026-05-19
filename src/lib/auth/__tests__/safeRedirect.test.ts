import { describe, it, expect } from "vitest";
import {
  isValidInternalPath,
  safeInternalPath,
  buildLoginRedirect,
} from "../safeRedirect";

describe("isValidInternalPath", () => {
  it("accepts a simple absolute path", () => {
    expect(isValidInternalPath("/clb/test/quan-ly")).toBe(true);
    expect(isValidInternalPath("/")).toBe(true);
  });

  it("accepts a path with a query string", () => {
    expect(isValidInternalPath("/su-kien/foo?bar=baz")).toBe(true);
  });

  it("rejects null / empty / non-string", () => {
    expect(isValidInternalPath(null)).toBe(false);
    expect(isValidInternalPath(undefined)).toBe(false);
    expect(isValidInternalPath("")).toBe(false);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isValidInternalPath("//evil.com/path")).toBe(false);
    expect(isValidInternalPath("//evil.com")).toBe(false);
  });

  it("rejects backslash variants", () => {
    expect(isValidInternalPath("/\\evil.com")).toBe(false);
    expect(isValidInternalPath("/%2Fevil.com")).toBe(false);
    expect(isValidInternalPath("/%5cfoo")).toBe(false);
  });

  it("rejects javascript: / data: / mailto: schemes", () => {
    expect(isValidInternalPath("javascript:alert(1)")).toBe(false);
    expect(isValidInternalPath("data:text/html,x")).toBe(false);
    expect(isValidInternalPath("mailto:a@b.c")).toBe(false);
  });

  it("rejects values that don't start with /", () => {
    expect(isValidInternalPath("foo")).toBe(false);
    expect(isValidInternalPath("http://example.com/foo")).toBe(false);
  });

  it("rejects values with embedded scheme via colon-before-slash", () => {
    // `/javascript:alert(1)` looks like a relative path but the colon
    // before the first additional slash makes it suspect.
    expect(isValidInternalPath("/javascript:alert(1)")).toBe(false);
  });

  it("rejects very long inputs", () => {
    expect(isValidInternalPath("/" + "a".repeat(3000))).toBe(false);
  });

  it("rejects whitespace + control characters", () => {
    expect(isValidInternalPath("/foo bar")).toBe(false);
    expect(isValidInternalPath("/foo\nbar")).toBe(false);
    expect(isValidInternalPath("/foo\tbar")).toBe(false);
  });
});

describe("safeInternalPath", () => {
  it("returns the input when valid", () => {
    expect(safeInternalPath("/clb/test")).toBe("/clb/test");
  });

  it("falls back to / on invalid input", () => {
    expect(safeInternalPath("//evil.com")).toBe("/");
    expect(safeInternalPath(null)).toBe("/");
    expect(safeInternalPath("javascript:alert(1)")).toBe("/");
  });
});

describe("buildLoginRedirect", () => {
  it("URL-encodes the redirect path", () => {
    expect(buildLoginRedirect("/clb/test club")).toBe("/login");
    expect(buildLoginRedirect("/su-kien/foo")).toBe("/login?redirect=%2Fsu-kien%2Ffoo");
  });

  it("falls back to /login alone when the current path is invalid", () => {
    expect(buildLoginRedirect("//evil.com")).toBe("/login");
    expect(buildLoginRedirect("")).toBe("/login");
  });
});
