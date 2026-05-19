// @ts-nocheck — vitest types available at test runtime only
import { describe, it, expect } from "vitest";
import {
  normalizeVietnamPhone,
  isValidVietnamPhone,
  maskPhone,
} from "../index";

describe("normalizeVietnamPhone", () => {
  it("normalizes 0xx format (Mobifone)", () => {
    expect(normalizeVietnamPhone("0901234567")).toBe("+84901234567");
  });

  it("normalizes 0xx format (Viettel)", () => {
    expect(normalizeVietnamPhone("0961234567")).toBe("+84961234567");
  });

  it("normalizes +84 with spaces", () => {
    expect(normalizeVietnamPhone("+84 901 234 567")).toBe("+84901234567");
  });

  it("normalizes 84 with dashes", () => {
    expect(normalizeVietnamPhone("84-901-234-567")).toBe("+84901234567");
  });

  it("normalizes mixed spaces / parentheses", () => {
    expect(normalizeVietnamPhone("(+84) 901 234 567")).toBe("+84901234567");
  });

  it("normalizes bare 9-digit subscriber number", () => {
    expect(normalizeVietnamPhone("901234567")).toBe("+84901234567");
  });

  it("normalizes Vinaphone prefix", () => {
    expect(normalizeVietnamPhone("0941234567")).toBe("+84941234567");
  });

  it("normalizes Itelecom prefix", () => {
    expect(normalizeVietnamPhone("0871234567")).toBe("+84871234567");
  });

  it("rejects null", () => {
    expect(normalizeVietnamPhone(null)).toBeNull();
  });

  it("rejects undefined", () => {
    expect(normalizeVietnamPhone(undefined)).toBeNull();
  });

  it("rejects empty string", () => {
    expect(normalizeVietnamPhone("")).toBeNull();
  });

  it("rejects whitespace-only string", () => {
    expect(normalizeVietnamPhone("   ")).toBeNull();
  });

  it("rejects letters mixed in", () => {
    expect(normalizeVietnamPhone("0901abc4567")).toBeNull();
  });

  it("rejects too-short number", () => {
    expect(normalizeVietnamPhone("090123")).toBeNull();
  });

  it("rejects too-long number", () => {
    expect(normalizeVietnamPhone("09012345678901")).toBeNull();
  });

  it("rejects unknown carrier prefix (010 retired)", () => {
    expect(normalizeVietnamPhone("0101234567")).toBeNull();
  });

  it("rejects landline (024 / 028)", () => {
    expect(normalizeVietnamPhone("0241234567")).toBeNull();
  });

  it("rejects non-VN country code", () => {
    // US +1 number should not be coerced into VN.
    expect(normalizeVietnamPhone("+15551234567")).toBeNull();
  });

  it("does not error on phone with leading/trailing whitespace", () => {
    expect(normalizeVietnamPhone("  0901234567  ")).toBe("+84901234567");
  });

  it("rejects garbage non-numeric input", () => {
    expect(normalizeVietnamPhone("hello world")).toBeNull();
  });

  it("rejects symbol-only input", () => {
    expect(normalizeVietnamPhone("+++---")).toBeNull();
  });
});

describe("isValidVietnamPhone", () => {
  it("accepts a canonical E.164 VN number", () => {
    expect(isValidVietnamPhone("+84901234567")).toBe(true);
  });

  it("accepts every supported carrier prefix", () => {
    expect(isValidVietnamPhone("+84321234567")).toBe(true); // Viettel
    expect(isValidVietnamPhone("+84811234567")).toBe(true); // Vinaphone
    expect(isValidVietnamPhone("+84701234567")).toBe(true); // Mobifone
    expect(isValidVietnamPhone("+84521234567")).toBe(true); // Vietnamobile
    expect(isValidVietnamPhone("+84591234567")).toBe(true); // Gmobile
    expect(isValidVietnamPhone("+84871234567")).toBe(true); // Itelecom
  });

  it("rejects 0xx input (not E.164)", () => {
    expect(isValidVietnamPhone("0901234567")).toBe(false);
  });

  it("rejects formatted input with spaces", () => {
    expect(isValidVietnamPhone("+84 901 234 567")).toBe(false);
  });

  it("rejects retired prefix", () => {
    expect(isValidVietnamPhone("+84101234567")).toBe(false);
  });

  it("rejects null", () => {
    expect(isValidVietnamPhone(null)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidVietnamPhone("")).toBe(false);
  });
});

describe("maskPhone", () => {
  it("masks a valid VN number, preserving last 3 digits", () => {
    expect(maskPhone("+84901234567")).toBe("+84 *** *** 567");
  });

  it("masks a different VN number, preserving last 3", () => {
    expect(maskPhone("+84961234999")).toBe("+84 *** *** 999");
  });

  it("falls back to generic mask for non-VN E.164", () => {
    const out = maskPhone("+15551234567");
    expect(out.startsWith("+1")).toBe(true);
    expect(out.endsWith("567")).toBe(true);
    expect(out.includes("***")).toBe(true);
  });

  it("returns empty for null", () => {
    expect(maskPhone(null)).toBe("");
  });

  it("returns empty for empty string", () => {
    expect(maskPhone("")).toBe("");
  });
});
