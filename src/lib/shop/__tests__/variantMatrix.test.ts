/**
 * The variant matrix rules.
 *
 * Every limit and every identity rule here is also enforced in Postgres
 * (migration 20260811210000 + shop_phase2a_variants.test.sql). This file
 * proves the editor agrees with the database, and that the operations a seller
 * performs on a matrix — reorder, add a value, remove one, bulk-apply — do not
 * quietly move somebody's price onto another row.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  VARIANT_LIMITS,
  applyBulk,
  cartesian,
  comboLabel,
  combinationCount,
  hasRowErrors,
  normOption,
  optionKey,
  reconcileRows,
  removedRows,
  toReconcilePayload,
  validateGroups,
  validateRows,
  type OptionGroup,
  type VariantRow,
} from "../variantMatrix";

const GROUPS: OptionGroup[] = [
  { name: "Màu sắc", values: ["Trắng", "Đen"] },
  { name: "Kích cỡ", values: ["39", "40"] },
];

const row = (over: Partial<VariantRow> = {}): VariantRow => ({
  optionValues: {},
  priceVnd: "1290000",
  stockOnHand: "",
  sku: "",
  ...over,
});

describe("the limits are the database's limits", () => {
  it("uses the same numbers as product_option_groups_valid()", () => {
    // Two copies of a limit drift the moment one is edited alone, and the
    // seller finds out by hitting a wall the form said was not there.
    const sql = readFileSync(
      resolve(__dirname, "../../../../supabase/migrations/20260811210000_shop_variants_inventory.sql"),
      "utf8",
    );
    const body = sql.slice(sql.indexOf("FUNCTION public.product_option_groups_valid"));
    expect(body).toContain(`> ${VARIANT_LIMITS.groups} THEN RETURN false`);
    expect(body).toContain(`> ${VARIANT_LIMITS.combinations} THEN RETURN false`);
    expect(body).toContain(`> ${VARIANT_LIMITS.nameLength} THEN RETURN false`);
  });
});

describe("combination identity", () => {
  it("does not depend on the order the groups are written in", () => {
    expect(optionKey({ "Kích cỡ": "40", "Màu sắc": "Trắng" })).toBe(
      optionKey({ "Màu sắc": "Trắng", "Kích cỡ": "40" }),
    );
  });

  it("ignores case and spacing, so one combination cannot become two", () => {
    expect(optionKey({ "Màu sắc": " TRẮNG " })).toBe(optionKey({ "màu sắc": "trắng" }));
  });

  it("keeps Vietnamese accents — Trắng and Trang are different colours", () => {
    expect(optionKey({ "Màu sắc": "Trắng" })).not.toBe(optionKey({ "Màu sắc": "Trang" }));
  });

  it("is null for a product with no options", () => {
    expect(optionKey({})).toBeNull();
  });

  it("normOption matches shop_option_norm: collapse spaces, lowercase, keep accents", () => {
    expect(normOption("  Màu   Sắc ")).toBe("màu sắc");
  });
});

describe("cartesian", () => {
  it("produces every combination once", () => {
    const combos = cartesian(GROUPS);
    expect(combos).toHaveLength(4);
    expect(new Set(combos.map((c) => optionKey(c))).size).toBe(4);
  });

  it("varies the last group fastest — the order a size chart reads in", () => {
    expect(cartesian(GROUPS).map((c) => `${c["Màu sắc"]}/${c["Kích cỡ"]}`)).toEqual([
      "Trắng/39",
      "Trắng/40",
      "Đen/39",
      "Đen/40",
    ]);
  });

  it("is deterministic — the same groups give the same order twice", () => {
    expect(cartesian(GROUPS)).toEqual(cartesian(GROUPS));
  });

  it("ignores blank values and half-typed groups", () => {
    expect(cartesian([{ name: "Màu", values: ["Trắng", "  ", ""] }])).toHaveLength(1);
    expect(cartesian([{ name: "", values: ["a"] }])).toHaveLength(0);
  });

  it("counts before it builds, so the seller is warned before 96 rows appear", () => {
    expect(combinationCount(GROUPS)).toBe(4);
    expect(combinationCount([])).toBe(0);
  });
});

describe("validateGroups mirrors the SQL", () => {
  it("accepts no groups (a single product) and a normal matrix", () => {
    expect(validateGroups([])).toBeNull();
    expect(validateGroups(GROUPS)).toBeNull();
  });

  it("refuses a fourth group", () => {
    const four = [1, 2, 3, 4].map((n) => ({ name: `G${n}`, values: ["1"] }));
    expect(validateGroups(four)?.message).toMatch(/3 nhóm/);
  });

  it("refuses more than 100 combinations, and says how many it would be", () => {
    const big = [
      { name: "A", values: Array.from({ length: 11 }, (_, i) => String(i)) },
      { name: "B", values: Array.from({ length: 10 }, (_, i) => String(i)) },
    ];
    expect(validateGroups(big)?.message).toMatch(/110/);
  });

  it("allows exactly 100 — the boundary is 100, not 99", () => {
    const exactly = [
      { name: "A", values: Array.from({ length: 10 }, (_, i) => String(i)) },
      { name: "B", values: Array.from({ length: 10 }, (_, i) => String(i)) },
    ];
    expect(validateGroups(exactly)).toBeNull();
  });

  it("points at the group at fault so the message can sit next to it", () => {
    const dup = [
      { name: "Màu", values: ["Trắng"] },
      { name: " màu ", values: ["Đen"] },
    ];
    expect(validateGroups(dup)?.index).toBe(1);
  });

  it("refuses a duplicated value inside one group, after normalising", () => {
    expect(validateGroups([{ name: "Màu", values: ["Trắng", " trắng "] }])?.message).toMatch(/Đã có/);
  });

  it("refuses an unnamed group and an empty one", () => {
    expect(validateGroups([{ name: "", values: ["a"] }])).not.toBeNull();
    expect(validateGroups([{ name: "Màu", values: [] }])).not.toBeNull();
  });

  it("refuses over-long names and values", () => {
    expect(validateGroups([{ name: "x".repeat(41), values: ["a"] }])).not.toBeNull();
    expect(validateGroups([{ name: "Màu", values: ["x".repeat(41)] }])).not.toBeNull();
  });
});

describe("reconcileRows — identity, not position", () => {
  const existing: VariantRow[] = [
    row({ id: "v1", optionValues: { "Màu sắc": "Trắng", "Kích cỡ": "39" }, sku: "W39", stockOnHand: "2" }),
    row({ id: "v2", optionValues: { "Màu sắc": "Trắng", "Kích cỡ": "40" }, sku: "W40", stockOnHand: "3" }),
    row({ id: "v3", optionValues: { "Màu sắc": "Đen", "Kích cỡ": "39" }, sku: "B39" }),
    row({ id: "v4", optionValues: { "Màu sắc": "Đen", "Kích cỡ": "40" }, sku: "B40" }),
  ];

  it("keeps every row when the groups are only reordered", () => {
    const reordered: OptionGroup[] = [
      { name: "Kích cỡ", values: ["40", "39"] },
      { name: "Màu sắc", values: ["Đen", "Trắng"] },
    ];
    const next = reconcileRows(reordered, existing);
    expect(next).toHaveLength(4);
    expect(next.map((r) => r.id).sort()).toEqual(["v1", "v2", "v3", "v4"]);
  });

  it("adds only what is new when a value is added", () => {
    const bigger: OptionGroup[] = [
      { name: "Màu sắc", values: ["Trắng", "Đen"] },
      { name: "Kích cỡ", values: ["39", "40", "41"] },
    ];
    const next = reconcileRows(bigger, existing);
    expect(next).toHaveLength(6);
    expect(next.filter((r) => r.id).length).toBe(4);
    // And the ones that survived kept their price, stock and SKU.
    const w39 = next.find((r) => r.optionValues["Kích cỡ"] === "39" && r.optionValues["Màu sắc"] === "Trắng")!;
    expect(w39).toMatchObject({ id: "v1", sku: "W39", stockOnHand: "2" });
  });

  it("drops only what the seller removed", () => {
    const smaller: OptionGroup[] = [
      { name: "Màu sắc", values: ["Trắng"] },
      { name: "Kích cỡ", values: ["39", "40"] },
    ];
    expect(reconcileRows(smaller, existing).map((r) => r.id)).toEqual(["v1", "v2"]);
  });

  it("names what is about to be lost, so the warning can list it", () => {
    const smaller: OptionGroup[] = [
      { name: "Màu sắc", values: ["Trắng"] },
      { name: "Kích cỡ", values: ["39", "40"] },
    ];
    expect(removedRows(smaller, existing).map((r) => r.sku)).toEqual(["B39", "B40"]);
  });

  it("seeds a new row from the single product's price rather than blanking it", () => {
    const single = [row({ id: "v0", priceVnd: "990000", stockOnHand: "7" })];
    const next = reconcileRows(GROUPS, single, single[0]);
    expect(next).toHaveLength(4);
    expect(next.every((r) => r.priceVnd === "990000")).toBe(true);
    // The old default is not one of them: it has no combination.
    expect(next.some((r) => r.id === "v0")).toBe(false);
  });

  it("collapsing to a single product keeps the first row's price", () => {
    const next = reconcileRows([], existing);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "v1", sku: "W39", stockOnHand: "2" });
    expect(next[0].optionValues).toEqual({});
  });

  it("never uses an array index as identity — a reordered input is the same matrix", () => {
    const shuffled = [existing[3], existing[1], existing[0], existing[2]];
    expect(reconcileRows(GROUPS, shuffled).map((r) => r.id)).toEqual(
      reconcileRows(GROUPS, existing).map((r) => r.id),
    );
  });
});

describe("row validation", () => {
  it("flags the LATER duplicate SKU and names the row it collides with", () => {
    const rows = [row({ sku: "CP-W39" }), row({ sku: " cp-w39 " }), row({ sku: "CP-B39" })];
    const errors = validateRows(rows);
    // The first is left alone: flagging both leaves the seller with no way to
    // tell which one to change.
    expect(errors[0].sku).toBeUndefined();
    expect(errors[1].sku).toMatch(/dòng 1/);
    expect(errors[2].sku).toBeUndefined();
  });

  it("lets many rows share an empty SKU — blank is not a duplicate", () => {
    const errors = validateRows([row(), row(), row()]);
    expect(errors.every((e) => !e.sku)).toBe(true);
  });

  it("refuses a price that is not an integer number of đồng", () => {
    for (const price of ["", "12.5", "1e6", "-100", "2.450.000"]) {
      expect(validateRows([row({ priceVnd: price })])[0].priceVnd, price).toBeTruthy();
    }
  });

  it("treats empty stock as valid and 0 as valid", () => {
    expect(validateRows([row({ stockOnHand: "" })])[0].stockOnHand).toBeUndefined();
    expect(validateRows([row({ stockOnHand: "0" })])[0].stockOnHand).toBeUndefined();
    expect(validateRows([row({ stockOnHand: "-1" })])[0].stockOnHand).toBeTruthy();
  });

  it("leaves the valid rows untouched when one row is wrong", () => {
    const errors = validateRows([row(), row({ priceVnd: "abc" }), row()]);
    expect(hasRowErrors(errors)).toBe(true);
    expect(errors[0]).toEqual({});
    expect(errors[2]).toEqual({});
  });
});

describe("bulk apply", () => {
  const rows = [row({ priceVnd: "100" }), row({ priceVnd: "200" }), row({ priceVnd: "200" })];

  it("reports how many rows actually changed, not how many it touched", () => {
    const result = applyBulk(rows, "priceVnd", "200");
    expect(result.changed).toBe(1);
    expect(result.rows.every((r) => r.priceVnd === "200")).toBe(true);
  });

  it("changes nothing when the value is already everywhere", () => {
    expect(applyBulk(rows, "priceVnd", "100").changed).toBe(2);
    expect(applyBulk([row({ priceVnd: "5" })], "priceVnd", "5").changed).toBe(0);
  });

  it("does not mutate, so the previous matrix is a working undo", () => {
    const before = JSON.stringify(rows);
    applyBulk(rows, "priceVnd", "999");
    expect(JSON.stringify(rows)).toBe(before);
  });

  it("applies only to the rows selected", () => {
    const result = applyBulk(rows, "priceVnd", "999", (_r, i) => i === 0);
    expect(result.changed).toBe(1);
    expect(result.rows.map((r) => r.priceVnd)).toEqual(["999", "200", "200"]);
  });
});

describe("the reconcile payload", () => {
  it("sends option values only in multi mode, and null stock for 'not counted'", () => {
    const payload = toReconcilePayload([row({ optionValues: { A: "1" }, stockOnHand: "" })], true);
    expect(payload[0]).toMatchObject({ option_values: { A: "1" }, stock_on_hand: null, position: 0 });
  });

  it("drops the options entirely in single mode", () => {
    expect(toReconcilePayload([row({ optionValues: { A: "1" } })], false)[0].option_values).toBeUndefined();
  });

  it("sends an empty SKU as null rather than as an empty string", () => {
    expect(toReconcilePayload([row({ sku: "  " })], false)[0].sku).toBeNull();
  });

  it("carries position, so the display order the seller sees is the one stored", () => {
    expect(toReconcilePayload([row(), row(), row()], false).map((p) => p.position)).toEqual([0, 1, 2]);
  });
});

describe("comboLabel", () => {
  it("reads in the group order the seller arranged", () => {
    expect(comboLabel(GROUPS, { "Màu sắc": "Trắng", "Kích cỡ": "40" })).toBe("Trắng · 40");
  });

  it("still says something when the groups are not known", () => {
    expect(comboLabel([], { "Màu sắc": "Trắng" })).toBe("Trắng");
  });
});
