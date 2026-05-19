import { describe, it, expect } from "vitest";
import {
  generateReferenceCode,
  isReferenceCode,
  REFERENCE_CODE_ALPHABET,
  REFERENCE_CODE_LENGTH,
} from "../referenceCode";

describe("generateReferenceCode", () => {
  it("returns the PHUB- prefix followed by exactly N alphabet chars", () => {
    const code = generateReferenceCode();
    expect(code.startsWith("PHUB-")).toBe(true);
    const body = code.slice("PHUB-".length);
    expect(body).toHaveLength(REFERENCE_CODE_LENGTH);
    for (const ch of body) {
      expect(REFERENCE_CODE_ALPHABET).toContain(ch);
    }
  });

  it("never produces visually ambiguous characters", () => {
    // 0/O, 1/I, L are deliberately excluded from the alphabet.
    const forbidden = new Set("01IOL");
    for (let i = 0; i < 200; i++) {
      const code = generateReferenceCode();
      for (const ch of code.slice("PHUB-".length)) {
        expect(forbidden.has(ch)).toBe(false);
      }
    }
  });

  it("produces unique codes across many calls (collision probability ~0)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) seen.add(generateReferenceCode());
    expect(seen.size).toBe(500);
  });

  it("isReferenceCode accepts a fresh code", () => {
    for (let i = 0; i < 20; i++) {
      expect(isReferenceCode(generateReferenceCode())).toBe(true);
    }
  });

  it("isReferenceCode rejects malformed input", () => {
    expect(isReferenceCode("")).toBe(false);
    expect(isReferenceCode("PHUB-")).toBe(false);
    expect(isReferenceCode("phub-A3F2K1")).toBe(false); // lowercase prefix
    expect(isReferenceCode("PHUB-A3F2K")).toBe(false); // too short
    expect(isReferenceCode("PHUB-A3F2K10")).toBe(false); // too long
    expect(isReferenceCode("PHUB-A3F2K0")).toBe(false); // banned char '0'
    expect(isReferenceCode("PHUB-A3F2KL")).toBe(false); // banned char 'L'
    expect(isReferenceCode("NOPE-A3F2K1")).toBe(false); // wrong prefix
  });
});
