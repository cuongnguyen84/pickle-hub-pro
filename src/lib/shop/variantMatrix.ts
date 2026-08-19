// ============================================================================
// The variant matrix, as pure functions.
// ----------------------------------------------------------------------------
// Mirrors migration 20260811210000. Postgres is the authority — it derives
// option_key itself and refuses anything that does not match the product's
// groups — and this file exists so the seller finds out while typing rather
// than after a round trip, and so the editor has a deterministic matrix to
// render before anything is saved.
//
// The one rule everything here is built on: a combination is identified by its
// NORMALISED group=value pairs, sorted by group. Never by a position in an
// array. An index is where a row is sitting right now; the first time somebody
// reorders the columns it starts pointing at a different product's stock.
// ============================================================================

/** Pilot operational limits. Same numbers as product_option_groups_valid(). */
export const VARIANT_LIMITS = {
  groups: 3,
  combinations: 100,
  nameLength: 40,
  valueLength: 40,
} as const;

export interface OptionGroup {
  name: string;
  values: string[];
}

/** A row in the editor. `id` is the server's variant id, absent until saved. */
export interface VariantRow {
  id?: string;
  /** {"Màu sắc":"Trắng"} — an object, so a value is addressed by its group. */
  optionValues: Record<string, string>;
  priceVnd: string;
  stockOnHand: string;
  sku: string;
}

/** Mirrors shop_option_norm(): case- and whitespace-insensitive, and
 *  accent-PRESERVING — Trắng and Trang are two different colours. */
export const normOption = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** Mirrors product_option_key(). Empty object → null, i.e. the default variant. */
export function optionKey(values: Record<string, string>): string | null {
  const keys = Object.keys(values ?? {});
  if (keys.length === 0) return null;
  return keys
    .map((k) => [normOption(k), normOption(values[k])] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

export interface GroupsError {
  /** Index of the group at fault, or -1 for a whole-structure problem. */
  index: number;
  message: string;
}

/** Mirrors product_option_groups_valid(), and returns WHICH rule broke so the
 *  editor can put the message next to the field instead of at the top. */
export function validateGroups(groups: OptionGroup[]): GroupsError | null {
  if (groups.length === 0) return null;
  if (groups.length > VARIANT_LIMITS.groups) {
    return { index: -1, message: `Tối đa ${VARIANT_LIMITS.groups} nhóm tuỳ chọn` };
  }

  const seenNames = new Set<string>();
  let combos = 1;

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    const name = g.name.trim();
    if (!name) return { index: i, message: "Đặt tên cho nhóm tuỳ chọn" };
    if (name.length > VARIANT_LIMITS.nameLength) {
      return { index: i, message: `Tên nhóm tối đa ${VARIANT_LIMITS.nameLength} ký tự` };
    }
    if (seenNames.has(normOption(name))) {
      return { index: i, message: `Đã có nhóm tên "${name}"` };
    }
    seenNames.add(normOption(name));

    const values = g.values.map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) return { index: i, message: "Nhóm cần ít nhất một giá trị" };
    if (values.some((v) => v.length > VARIANT_LIMITS.valueLength)) {
      return { index: i, message: `Mỗi giá trị tối đa ${VARIANT_LIMITS.valueLength} ký tự` };
    }
    const seenValues = new Set<string>();
    for (const v of values) {
      if (seenValues.has(normOption(v))) return { index: i, message: `Đã có giá trị "${v}"` };
      seenValues.add(normOption(v));
    }

    combos *= values.length;
    if (combos > VARIANT_LIMITS.combinations) {
      return {
        index: -1,
        message: `Tối đa ${VARIANT_LIMITS.combinations} phiên bản cho một sản phẩm — bộ tuỳ chọn này tạo ra ${combos}`,
      };
    }
  }
  return null;
}

/** How many combinations these groups produce. Shown before the seller commits
 *  to them, because 6 and 96 are very different amounts of typing. */
export const combinationCount = (groups: OptionGroup[]) =>
  groups.length === 0
    ? 0
    : groups.reduce((n, g) => n * g.values.filter((v) => v.trim()).length, 1);

/** Every combination, in a deterministic order: the last group varies fastest,
 *  which is the order a person reads a size chart in. */
export function cartesian(groups: OptionGroup[]): Record<string, string>[] {
  const usable = groups
    .map((g) => ({ name: g.name.trim(), values: g.values.map((v) => v.trim()).filter(Boolean) }))
    .filter((g) => g.name && g.values.length > 0);
  if (usable.length === 0) return [];

  return usable.reduce<Record<string, string>[]>(
    (acc, g) => acc.flatMap((row) => g.values.map((v) => ({ ...row, [g.name]: v }))),
    [{}],
  );
}

/**
 * The matrix the editor should show for these groups, given what the seller
 * already has.
 *
 * Keeps a row whose combination still exists — with its id, price, stock and
 * SKU — and creates only what is genuinely new. That is what makes adding one
 * size add one row instead of resetting the table, and what makes reordering
 * the groups a display change rather than a data migration.
 *
 * `seed` fills a brand-new row: on the switch from a single product it is the
 * default variant's price, so the seller does not retype it six times.
 */
export function reconcileRows(
  groups: OptionGroup[],
  existing: VariantRow[],
  seed?: Pick<VariantRow, "priceVnd" | "stockOnHand">,
): VariantRow[] {
  if (groups.length === 0) {
    // Single mode: keep the first row if there is one, so its price survives
    // the switch back.
    const first = existing[0];
    return [
      {
        id: first?.id,
        optionValues: {},
        priceVnd: first?.priceVnd ?? seed?.priceVnd ?? "",
        stockOnHand: first?.stockOnHand ?? seed?.stockOnHand ?? "",
        sku: first?.sku ?? "",
      },
    ];
  }

  const byKey = new Map<string, VariantRow>();
  for (const row of existing) {
    const key = optionKey(row.optionValues);
    if (key) byKey.set(key, row);
  }

  return cartesian(groups).map((optionValues) => {
    const key = optionKey(optionValues)!;
    const kept = byKey.get(key);
    return {
      id: kept?.id,
      optionValues,
      priceVnd: kept?.priceVnd ?? seed?.priceVnd ?? "",
      stockOnHand: kept?.stockOnHand ?? seed?.stockOnHand ?? "",
      sku: kept?.sku ?? "",
    };
  });
}

/** Rows the seller is about to lose, named so the warning can say which. A
 *  combination that is disappearing is a price and a stock count disappearing
 *  with it. */
export function removedRows(groups: OptionGroup[], existing: VariantRow[]): VariantRow[] {
  const next = new Set(cartesian(groups).map((v) => optionKey(v)!));
  return existing.filter((row) => {
    const key = optionKey(row.optionValues);
    return key !== null && !next.has(key);
  });
}

/** Human label for a combination: "Trắng · 40". */
export const comboLabel = (groups: OptionGroup[], values: Record<string, string>) =>
  groups.map((g) => values[g.name.trim()]).filter(Boolean).join(" · ") ||
  Object.values(values).join(" · ");

// ─── Per-row validation ─────────────────────────────────────────────────────

export interface RowErrors {
  priceVnd?: string;
  stockOnHand?: string;
  sku?: string;
}

const INT = /^[0-9]+$/;

/**
 * Validate every row, and mark ONLY the rows that are wrong.
 *
 * A duplicate SKU is the case that goes wrong most often in this kind of
 * editor: the usual implementation flags every row sharing the code, including
 * the first one, and the seller has no way to tell which one to change. Here
 * the first occurrence is left alone and the later ones are flagged, and the
 * message names the row it collides with.
 */
export function validateRows(rows: VariantRow[]): RowErrors[] {
  const firstBySku = new Map<string, number>();
  const errors: RowErrors[] = rows.map(() => ({}));

  rows.forEach((row, i) => {
    const price = row.priceVnd.trim();
    if (!price) errors[i].priceVnd = "Nhập giá";
    else if (!INT.test(price)) errors[i].priceVnd = "Chỉ nhập số, không dấu chấm";
    else if (Number(price) > 2_000_000_000) errors[i].priceVnd = "Giá vượt mức cho phép";

    const stock = row.stockOnHand.trim();
    if (stock && !INT.test(stock)) errors[i].stockOnHand = "Số nguyên, để trống nếu không đếm";
    else if (stock && Number(stock) > 1_000_000) errors[i].stockOnHand = "Tồn kho vượt mức cho phép";

    // Trim and case-fold before comparing, because the database does: " cp-w39 "
    // and "CP-W39" are the same code to uniq_product_variants_sku_per_shop, and
    // a client that lets them both through produces a save that fails with a
    // constraint name.
    const sku = row.sku.trim().toUpperCase();
    if (!sku) return;
    if (row.sku.trim().length > 64) {
      errors[i].sku = "Mã hàng tối đa 64 ký tự";
      return;
    }
    const first = firstBySku.get(sku);
    if (first === undefined) firstBySku.set(sku, i);
    else errors[i].sku = `Trùng mã hàng với dòng ${first + 1}`;
  });

  return errors;
}

export const hasRowErrors = (errors: RowErrors[]) =>
  errors.some((e) => e.priceVnd || e.stockOnHand || e.sku);

// ─── Bulk ───────────────────────────────────────────────────────────────────

export type BulkField = "priceVnd" | "stockOnHand";

/**
 * Apply one value to the rows the seller chose.
 *
 * Returns a NEW array and the count that actually changed, so the editor can
 * say "đã đổi 4 phiên bản" rather than claiming it touched all of them — and
 * so the seller can undo by keeping the previous array, which is why nothing
 * here mutates.
 */
export function applyBulk(
  rows: VariantRow[],
  field: BulkField,
  value: string,
  selected?: (row: VariantRow, index: number) => boolean,
): { rows: VariantRow[]; changed: number } {
  let changed = 0;
  const next = rows.map((row, i) => {
    if (selected && !selected(row, i)) return row;
    if (row[field] === value) return row;
    changed++;
    return { ...row, [field]: value };
  });
  return { rows: next, changed };
}

/** The payload shape product_variants_reconcile() expects. */
export const toReconcilePayload = (rows: VariantRow[], multi: boolean) =>
  rows.map((row, i) => ({
    option_values: multi ? row.optionValues : undefined,
    price_vnd: row.priceVnd.trim(),
    stock_on_hand: row.stockOnHand.trim() === "" ? null : row.stockOnHand.trim(),
    sku: row.sku.trim() || null,
    position: i,
  }));
