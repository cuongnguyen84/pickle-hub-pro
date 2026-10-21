import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { hasIndexableSubstance } from "../sitemap-players.xml";
import { PROFILE_BIO_MIN_LENGTH } from "../_lib/seo-helpers";

const source = readFileSync(
  resolve(import.meta.dirname, "../sitemap-players.xml.ts"),
  "utf8",
);

/**
 * 2026-08-23 site audit. /sitemap-players.xml handed Google 40 URLs, all of
 * them 52–70 words, because renderProfile can only print what the row holds.
 * 29 had no DUPR link and none had a bio, so the pages were one boilerplate
 * template with a name swapped in — QA accounts ("test DUPR 2", "admindupr")
 * included. CLAUDE.md already documented the intended contract, "DUPR-linked
 * public profiles only"; the query never implemented it.
 */
const stub = {
  bio: null,
  dupr_id: null,
  dupr_doubles: null,
  dupr_singles: null,
};

describe("sitemap-players substance gate", () => {
  it("drops a profile with no DUPR link and no bio", () => {
    expect(hasIndexableSubstance(stub)).toBe(false);
  });

  it("keeps a DUPR-linked profile even before a rating syncs", () => {
    expect(hasIndexableSubstance({ ...stub, dupr_id: "M9Q6KD" })).toBe(true);
  });

  it("keeps a profile that has a rating but no dupr_id", () => {
    expect(hasIndexableSubstance({ ...stub, dupr_doubles: 3.5 })).toBe(true);
    expect(hasIndexableSubstance({ ...stub, dupr_singles: 4.2 })).toBe(true);
  });

  // 0.0 is a real rating. A `!p.dupr_doubles` check would have dropped it.
  it("treats a zero rating as present, not absent", () => {
    expect(hasIndexableSubstance({ ...stub, dupr_doubles: 0 })).toBe(true);
  });

  it("keeps a profile whose bio is long enough to be its own meta description", () => {
    expect(
      hasIndexableSubstance({
        ...stub,
        bio: "Chơi pickleball ở Hà Nội từ 2024, thích đánh đôi nam.",
      }),
    ).toBe(true);
  });

  it("does not count whitespace or a one-word bio as substance", () => {
    expect(hasIndexableSubstance({ ...stub, bio: "   " })).toBe(false);
    expect(hasIndexableSubstance({ ...stub, bio: "hi" })).toBe(false);
  });

  it("still selects the columns the gate reads", () => {
    // Anchored on the .select() argument itself, not on a neighbouring .eq()
    // call — an indexOf that misses returns -1 and slices a passing string out
    // of thin air, so the assertion would go quietly vacuous.
    const select = source.match(/\.select\(\s*"([^"]+)"\s*\)/);
    expect(select).not.toBeNull();
    for (const column of ["bio", "dupr_id", "dupr_doubles", "dupr_singles"]) {
      expect(select![1]).toContain(column);
    }
  });

  // The gate and the meta description must agree on what "has a bio" means.
  // Two independent 30s drift; doc-vs-code drift is the bug being fixed here.
  it("shares the bio threshold with pickProfileMetaDescription", () => {
    expect(source).toContain("PROFILE_BIO_MIN_LENGTH");
    expect(source).not.toMatch(/const\s+MIN_BIO_LENGTH/);
    const justUnder = "a".repeat(PROFILE_BIO_MIN_LENGTH - 1);
    const justOver = "a".repeat(PROFILE_BIO_MIN_LENGTH);
    expect(hasIndexableSubstance({ ...stub, bio: justUnder })).toBe(false);
    expect(hasIndexableSubstance({ ...stub, bio: justOver })).toBe(true);
  });

  it("records why excluded profiles are not also noindexed", () => {
    expect(source).toContain("Deliberately NOT paired with a noindex");
  });
});
