import { describe, it, expect } from "vitest";
import {
  validateManualRating,
  normalizeDuprUrl,
} from "../dupr-validation";

describe("validateManualRating — required + range checks", () => {
  it("rejects when dupr_doubles missing", () => {
    const r = validateManualRating({ dupr_singles: 4.0 });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_doubles_required");
  });

  it("accepts valid dupr_doubles only", () => {
    const r = validateManualRating({ dupr_doubles: 4.2 });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.normalized.dupr_doubles).toBe(4.2);
      expect(r.normalized.dupr_singles).toBeNull();
    }
  });

  it("accepts both singles and doubles", () => {
    const r = validateManualRating({ dupr_singles: 4.05, dupr_doubles: 4.2 });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.normalized.dupr_singles).toBe(4.05);
      expect(r.normalized.dupr_doubles).toBe(4.2);
    }
  });

  it("rejects rating below 2.0", () => {
    const r = validateManualRating({ dupr_doubles: 1.5 });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_doubles_out_of_range");
  });

  it("rejects rating above 7.0", () => {
    const r = validateManualRating({ dupr_doubles: 7.5 });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_doubles_out_of_range");
  });

  it("accepts boundary values 2.0 and 7.0", () => {
    expect(validateManualRating({ dupr_doubles: 2.0 }).valid).toBe(true);
    expect(validateManualRating({ dupr_doubles: 7.0 }).valid).toBe(true);
  });

  it("rejects singles out of range when doubles is valid", () => {
    const r = validateManualRating({ dupr_singles: 1.9, dupr_doubles: 4.0 });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_singles_out_of_range");
  });

  it("rejects non-finite rating (NaN)", () => {
    const r = validateManualRating({ dupr_doubles: NaN });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_doubles_out_of_range");
  });
});

describe("validateManualRating — id + url format", () => {
  it("accepts dupr_id alphanumeric 4-20 chars", () => {
    const r = validateManualRating({ dupr_doubles: 4.0, dupr_id: "V6Y5XP" });
    expect(r.valid).toBe(true);
    if (r.valid) expect(r.normalized.dupr_id).toBe("V6Y5XP");
  });

  it("rejects dupr_id 3 chars (too short)", () => {
    const r = validateManualRating({ dupr_doubles: 4.0, dupr_id: "abc" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_id_invalid_format");
  });

  it("rejects dupr_id with hyphen", () => {
    const r = validateManualRating({ dupr_doubles: 4.0, dupr_id: "V-6-Y" });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_id_invalid_format");
  });

  it("accepts dashboard.dupr.com URL", () => {
    const r = validateManualRating({
      dupr_doubles: 4.0,
      dupr_profile_url: "https://dashboard.dupr.com/dupr/players/V6Y5XP",
    });
    expect(r.valid).toBe(true);
  });

  it("accepts mydupr.com URL", () => {
    const r = validateManualRating({
      dupr_doubles: 4.0,
      dupr_profile_url: "https://mydupr.com/dupr/players/V6Y5XP",
    });
    expect(r.valid).toBe(true);
  });

  it("accepts dupr.gg URL", () => {
    const r = validateManualRating({
      dupr_doubles: 4.0,
      dupr_profile_url: "https://www.dupr.gg/dupr/players/V6Y5XP",
    });
    expect(r.valid).toBe(true);
  });

  it("rejects non-DUPR domain URL", () => {
    const r = validateManualRating({
      dupr_doubles: 4.0,
      dupr_profile_url: "https://example.com/players/V6Y5XP",
    });
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.errors).toContain("dupr_profile_url_invalid");
  });

  it("allows null dupr_id and dupr_profile_url", () => {
    const r = validateManualRating({
      dupr_doubles: 4.2,
      dupr_id: null,
      dupr_profile_url: null,
    });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.normalized.dupr_id).toBeNull();
      expect(r.normalized.dupr_profile_url).toBeNull();
    }
  });

  it("allows empty string dupr_id and dupr_profile_url", () => {
    const r = validateManualRating({
      dupr_doubles: 4.2,
      dupr_id: "",
      dupr_profile_url: "",
    });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.normalized.dupr_id).toBeNull();
      expect(r.normalized.dupr_profile_url).toBeNull();
    }
  });

  it("trims whitespace from dupr_id and dupr_profile_url", () => {
    const r = validateManualRating({
      dupr_doubles: 4.2,
      dupr_id: "  V6Y5XP  ",
      dupr_profile_url: "  https://mydupr.com/dupr/players/V6Y5XP  ",
    });
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.normalized.dupr_id).toBe("V6Y5XP");
      expect(r.normalized.dupr_profile_url).toBe(
        "https://mydupr.com/dupr/players/V6Y5XP",
      );
    }
  });
});

describe("normalizeDuprUrl", () => {
  it("returns valid DUPR URL as-is (dashboard.dupr.com)", () => {
    expect(normalizeDuprUrl("https://dashboard.dupr.com/dupr/players/V6Y5XP")).toBe(
      "https://dashboard.dupr.com/dupr/players/V6Y5XP",
    );
  });

  it("returns valid mydupr.com URL as-is", () => {
    expect(normalizeDuprUrl("https://mydupr.com/dupr/players/abc123")).toBe(
      "https://mydupr.com/dupr/players/abc123",
    );
  });

  it("builds canonical URL from bare ID", () => {
    expect(normalizeDuprUrl("V6Y5XP")).toBe(
      "https://dashboard.dupr.com/dupr/players/V6Y5XP",
    );
  });

  it("returns null for too-short ID", () => {
    expect(normalizeDuprUrl("abc")).toBeNull();
  });

  it("returns null for non-DUPR URL", () => {
    expect(normalizeDuprUrl("https://evil.com/foo")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeDuprUrl("")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(normalizeDuprUrl("  V6Y5XP  ")).toBe(
      "https://dashboard.dupr.com/dupr/players/V6Y5XP",
    );
  });
});
