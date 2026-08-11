/**
 * The seller catalog's derived rules. Every permission here is also enforced in
 * Postgres (migration 20260811200000 + shop_phase2a_product_editor.test.sql);
 * this file only proves the screen agrees with the database about what it
 * should offer, and shows the seller the same numbers the database holds.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DRAFT_FIELD_ORDER,
  PRODUCT_STATUS_HINT,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_ORDER,
  PRODUCT_STATUS_TONE,
  canArchive,
  canEditContent,
  canEditSlug,
  canUnarchive,
  nextActionFor,
  priceSummary,
  stockSummary,
  summarise,
  validateDraft,
  vnd,
} from "../productState";
import type { ProductStatus, SellerProductRow } from "@/integrations/supabase/shop-schema";

const ALL_STATUSES: ProductStatus[] = [
  "draft",
  "pending_review",
  "needs_changes",
  "approved",
  "rejected",
  "archived",
];

describe("editability mirrors the database", () => {
  it("matches product_status_is_editable() in the migration", () => {
    // The client deciding one thing and Postgres another is how a seller gets
    // an enabled Save that always fails. Read the SQL and compare the sets.
    const sql = readFileSync(
      resolve(__dirname, "../../../../supabase/migrations/20260811200000_shop_product_editor.sql"),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("FUNCTION public.product_status_is_editable"));
    const list = /_status IN \(([^)]+)\)/.exec(body)?.[1] ?? "";
    const fromSql = [...list.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort();
    const fromClient = ALL_STATUSES.filter(canEditContent).sort();
    expect(fromClient).toEqual(fromSql);
  });

  it("refuses pending_review — a decision must land on what was reviewed", () => {
    expect(canEditContent("pending_review")).toBe(false);
  });

  it("refuses approved — an approval that survives an edit means nothing", () => {
    expect(canEditContent("approved")).toBe(false);
  });

  it("offers the URL change exactly where content is editable", () => {
    for (const status of ALL_STATUSES) {
      expect(canEditSlug(status), status).toBe(canEditContent(status));
    }
  });

  it("archives anything that is not already archived, and restores only what is", () => {
    for (const status of ALL_STATUSES) {
      expect(canArchive(status), status).toBe(status !== "archived");
      expect(canUnarchive(status), status).toBe(status === "archived");
    }
  });
});

describe("every status is presentable", () => {
  it.each(ALL_STATUSES)("%s has a label, a hint and a tone", (status) => {
    expect(PRODUCT_STATUS_LABEL[status]).toBeTruthy();
    expect(PRODUCT_STATUS_HINT[status]).toBeTruthy();
    expect(PRODUCT_STATUS_TONE[status]).toBeTruthy();
  });

  it("the filter chips cover every status exactly once", () => {
    expect([...PRODUCT_STATUS_ORDER].sort()).toEqual([...ALL_STATUSES].sort());
  });

  it("puts what needs the seller first", () => {
    expect(PRODUCT_STATUS_ORDER[0]).toBe("needs_changes");
  });

  it("says whether a buyer can see it, not just the state name", () => {
    expect(PRODUCT_STATUS_HINT.draft).toMatch(/chưa thấy/i);
    expect(PRODUCT_STATUS_HINT.approved).toMatch(/bật bán/i);
  });
});

describe("price comes off the variants", () => {
  it("one variant is one price", () => {
    expect(priceSummary([{ price_vnd: 2450000 }])).toBe("2.450.000₫");
  });

  it("several become a range — one number out of six is wrong five times", () => {
    expect(priceSummary([{ price_vnd: 1290000 }, { price_vnd: 1490000 }])).toBe(
      "1.290.000₫ – 1.490.000₫",
    );
  });

  it("no variant says so rather than showing 0₫", () => {
    expect(priceSummary([])).toBe("Chưa có giá");
  });

  it("formats VND the Vietnamese way", () => {
    expect(vnd(2450000)).toBe("2.450.000₫");
  });
});

describe("stock keeps its three answers apart", () => {
  it("NULL is not counted, and is not zero", () => {
    expect(stockSummary([{ stock: null }])).toBe("Không đếm");
  });

  it("zero is sold out", () => {
    expect(stockSummary([{ stock: 0 }])).toBe("Hết hàng");
  });

  it("adds up what is counted", () => {
    expect(stockSummary([{ stock: 3 }, { stock: 4 }])).toBe("7");
  });

  it("says the total is partial when only some variants are counted", () => {
    expect(stockSummary([{ stock: 3 }, { stock: null }])).toBe("3 (một số phiên bản không đếm)");
  });
});

describe("next action tells the truth about the missing photo", () => {
  it("names the real blocker on a draft with no photo", () => {
    const action = nextActionFor({ status: "draft", applicant_note: null, mediaCount: 0 });
    expect(action).toMatch(/thiếu ảnh/i);
  });

  it("does not push the seller when the ball is with the moderator", () => {
    expect(nextActionFor({ status: "pending_review", applicant_note: null, mediaCount: 1 })).toBeNull();
  });

  it("points a needs_changes product at the note it was given", () => {
    expect(
      nextActionFor({ status: "needs_changes", applicant_note: "Ảnh mờ quá", mediaCount: 1 }),
    ).toMatch(/gửi lại/i);
  });
});

describe("summarise — the card and the table row cannot disagree", () => {
  const row = {
    id: "p1",
    status: "draft",
    applicant_note: null,
    product_variants: [{ id: "v1", price_vnd: 990000, stock: null, position: 0, sku: null }],
    product_media: [],
  } as unknown as SellerProductRow;

  it("derives everything from the one row", () => {
    const s = summarise(row);
    expect(s.price).toBe("990.000₫");
    expect(s.stock).toBe("Không đếm");
    expect(s.variantCount).toBe(1);
    expect(s.mediaCount).toBe(0);
    expect(s.canEdit).toBe(true);
    expect(s.nextAction).toMatch(/thiếu ảnh/i);
  });

  it("survives a row whose embedded lists came back empty", () => {
    const bare = { ...row, product_variants: undefined, product_media: undefined } as unknown as SellerProductRow;
    expect(() => summarise(bare)).not.toThrow();
    expect(summarise(bare).price).toBe("Chưa có giá");
  });
});

describe("draft validation — no stricter than the SQL", () => {
  const ok = {
    title: "Vợt pickleball carbon T700",
    description: "",
    category_slug: "vot",
    price_vnd: "2450000",
    stock: "",
  };

  it("accepts a minimal valid product", () => {
    expect(validateDraft(ok)).toEqual({});
  });

  it("refuses a price that is not an integer number of đồng", () => {
    for (const price of ["12.5", "2.450.000", "1e6", "-100", "abc"]) {
      expect(validateDraft({ ...ok, price_vnd: price }).price_vnd, price).toBeTruthy();
    }
  });

  it("refuses a missing price rather than saving a product nobody can buy", () => {
    expect(validateDraft({ ...ok, price_vnd: "" }).price_vnd).toBeTruthy();
  });

  it("treats empty stock as valid — 'not counted' is an answer", () => {
    expect(validateDraft({ ...ok, stock: "" }).stock).toBeUndefined();
    expect(validateDraft({ ...ok, stock: "0" }).stock).toBeUndefined();
  });

  it("refuses a negative or fractional stock", () => {
    expect(validateDraft({ ...ok, stock: "-1" }).stock).toBeTruthy();
    expect(validateDraft({ ...ok, stock: "1.5" }).stock).toBeTruthy();
  });

  it("asks for the category now instead of at submit time", () => {
    expect(validateDraft({ ...ok, category_slug: "" }).category_slug).toBeTruthy();
  });

  it("uses the same length bounds as the products table CHECK", () => {
    expect(validateDraft({ ...ok, title: "Vợ" }).title).toBeTruthy();
    expect(validateDraft({ ...ok, title: "x".repeat(141) }).title).toBeTruthy();
    expect(validateDraft({ ...ok, title: "x".repeat(140) }).title).toBeUndefined();
  });

  it("focuses errors top-down, not in object-key order", () => {
    expect(DRAFT_FIELD_ORDER[0]).toBe("category_slug");
    expect(DRAFT_FIELD_ORDER).toContain("price_vnd");
  });
});
