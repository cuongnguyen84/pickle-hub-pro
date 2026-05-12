import { describe, it, expect } from "vitest";
import { profileIdToSlug, normalizeSlug } from "../profileSlug";

describe("profileIdToSlug", () => {
  it("returns the first 8 hex chars (stripping dashes)", () => {
    expect(profileIdToSlug("11111111-2222-3333-4444-555555555555")).toBe("11111111");
    expect(profileIdToSlug("a1b2c3d4-e5f6-7890-abcd-ef0123456789")).toBe("a1b2c3d4");
  });

  it("handles a UUID with no dashes", () => {
    expect(profileIdToSlug("aabbccdd00112233445566778899aabbcc")).toBe("aabbccdd");
  });
});

describe("normalizeSlug", () => {
  it("accepts a valid 8-char hex slug, lowercased", () => {
    expect(normalizeSlug("aabb1234")).toBe("aabb1234");
    expect(normalizeSlug("AaBb1234")).toBe("aabb1234");
  });

  it("accepts a valid 12-char hex slug (collision fallback)", () => {
    expect(normalizeSlug("aabbccdd1234")).toBe("aabbccdd1234");
  });

  it("rejects too short / too long", () => {
    expect(normalizeSlug("aabb")).toBeNull();
    expect(normalizeSlug("aabbccdd12345")).toBeNull();
  });

  it("rejects non-hex characters", () => {
    expect(normalizeSlug("ggggggggg")).toBeNull();
    expect(normalizeSlug("nope1234")).toBeNull();
  });

  it("rejects null / empty", () => {
    expect(normalizeSlug(undefined)).toBeNull();
    expect(normalizeSlug("")).toBeNull();
  });
});
