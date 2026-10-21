/**
 * Turning the server's preflight into copy and into a focus target.
 *
 * The RULES are in Postgres (shop_phase2a_submit.test.sql). What is asserted
 * here is that every code the server can emit has something to say, that every
 * section it can name resolves to a control that exists, and that a target is
 * never a position — a moderator's "sửa ảnh thứ hai" written as an index points
 * at a different photo the moment somebody reorders them.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EDIT_SECTIONS,
  SECTION_LABEL,
  firstProblem,
  focusTargetFor,
  groupProblems,
  problemMessage,
  type SubmitProblem,
} from "../submitProblems";

const SQL = readFileSync(
  resolve(__dirname, "../../../../supabase/migrations/20260811230000_shop_preview_submit.sql"),
  "utf8",
);

const problem = (over: Partial<SubmitProblem> = {}): SubmitProblem => ({
  code: "no_media",
  section: "media",
  ...over,
});

describe("the client and the server agree on the vocabulary", () => {
  it("has copy for every problem code the preflight can emit", () => {
    // A code with no copy renders as "còn một chỗ chưa hợp lệ", which tells the
    // seller nothing and is indistinguishable from a bug.
    const codes = [...SQL.matchAll(/'code',\s*'(\w+)'/g)].map((m) => m[1]);
    expect(codes.length).toBeGreaterThan(10);
    for (const code of new Set(codes)) {
      expect(problemMessage({ code, section: "basics" }), code).not.toBe("Còn một chỗ chưa hợp lệ.");
    }
  });

  it("knows every section product_edit_sections() names", () => {
    const block = SQL.slice(SQL.indexOf("FUNCTION public.product_edit_sections"));
    const sections = [...block.slice(0, block.indexOf("$$;")).matchAll(/'(\w+)'/g)].map((m) => m[1]);
    for (const section of sections) {
      expect(EDIT_SECTIONS, section).toContain(section);
    }
  });

  it("labels every section, so a checklist group is never headed by a slug", () => {
    for (const section of EDIT_SECTIONS) {
      expect(SECTION_LABEL[section], section).toBeTruthy();
    }
  });

  it("says what is missing, not which rule failed", () => {
    expect(problemMessage({ code: "category_missing", section: "category" })).toMatch(/ngành hàng/i);
    expect(problemMessage({ code: "no_media", section: "media" })).toMatch(/ảnh/i);
    expect(problemMessage({ code: "category_missing", section: "category" })).not.toMatch(/category_missing/);
  });

  it("falls back to something honest for a code it has never seen", () => {
    // A new server rule must not render as blank or as its own code.
    expect(problemMessage({ code: "brand_new_rule", section: "basics" })).toBeTruthy();
  });
});

describe("focus targets are named, never positions", () => {
  it("points a variant problem at that variant, by id", () => {
    const target = focusTargetFor(problem({ section: "price", variant_id: "v-42" }));
    expect(target.elementId).toBe("variant-v-42");
    expect(target.elementId).not.toMatch(/\[\d+\]|index|nth/);
  });

  it("points a media problem at that photo, by id", () => {
    expect(focusTargetFor(problem({ section: "media", media_id: "m-7" })).elementId).toBe("media-m-7");
  });

  it("points a variant-media problem at that variant's picker", () => {
    expect(focusTargetFor(problem({ section: "variant_media", variant_id: "v-9" })).elementId).toBe("vm-v-9");
  });

  it("falls back to the section when the server did not name a row", () => {
    expect(focusTargetFor(problem({ section: "media" })).elementId).toBe("sec-media");
    expect(focusTargetFor(problem({ section: "variants" })).elementId).toBe("sec-variants");
  });

  it("names the lazily-mounted area that has to open first", () => {
    // Focusing a control inside a chunk that has not loaded is a no-op that
    // reads to the seller as a broken link.
    expect(focusTargetFor(problem({ section: "price", variant_id: "v-1" })).lazySection).toBe("variants");
    expect(focusTargetFor(problem({ section: "sku", variant_id: "v-1" })).lazySection).toBe("variants");
    expect(focusTargetFor(problem({ section: "media" })).lazySection).toBe("media");
    expect(focusTargetFor(problem({ section: "category" })).lazySection).toBeUndefined();
  });

  it("resolves a target for every section, so no problem is a dead end", () => {
    for (const section of EDIT_SECTIONS) {
      const target = focusTargetFor(problem({ section }));
      expect(target.elementId, section).toBeTruthy();
    }
  });

  it("matches the ids the editor actually renders", () => {
    // The contract is only real if the element exists. These are the ids in
    // SellerProductForm and the two lazy editors.
    const form = readFileSync(
      resolve(__dirname, "../../../pages/shop/SellerProductForm.tsx"),
      "utf8",
    );
    expect(form).toContain('id="p-title"');
    expect(form).toContain('id="p-cat"');
    expect(form).toContain('id="p-desc"');
    const media = readFileSync(
      resolve(__dirname, "../../../components/shop/MediaEditor.tsx"),
      "utf8",
    );
    expect(media).toContain('id="sec-media"');
    expect(media).toContain("vm-${variant.id}");
  });
});

describe("grouping", () => {
  const problems: SubmitProblem[] = [
    problem({ code: "no_media", section: "media" }),
    problem({ code: "category_missing", section: "category" }),
    problem({ code: "price_missing", section: "price", variant_id: "v1" }),
    problem({ code: "price_missing", section: "price", variant_id: "v2" }),
  ];

  it("groups by section, in screen order rather than in the order SQL returned", () => {
    // A flat list in emission order makes the seller jump up and down the form.
    expect(groupProblems(problems).map((g) => g.section)).toEqual(["category", "price", "media"]);
  });

  it("keeps every problem, and does not merge two rows into one line", () => {
    const price = groupProblems(problems).find((g) => g.section === "price")!;
    expect(price.problems).toHaveLength(2);
    expect(price.problems.map((p) => p.variant_id)).toEqual(["v1", "v2"]);
  });

  it("returns nothing for a product with nothing wrong", () => {
    expect(groupProblems([])).toEqual([]);
  });

  it("jumps to the first problem in SCREEN order, not the first emitted", () => {
    expect(firstProblem(problems)?.section).toBe("category");
    expect(firstProblem([])).toBeNull();
  });
});
