// ============================================================================
// Choosing a variant on the PDP.
// ============================================================================
// The rules B04/B05 were accepted on:
//
//   · picking a colour changes the photo immediately;
//   · picking a size updates SKU, price and availability;
//   · changing colour KEEPS the size when that combination exists;
//   · a combination that does not exist, or is sold out, is disabled;
//   · the seller never changes.
//
// All of it is a function of (option_groups, variants, selection). Kept pure
// so the branches are testable without a browser — and because a bug here
// shows a buyer a price that belongs to a different variant, which is the
// worst thing this screen can do.
// ============================================================================

export type Availability = "in_stock" | "out_of_stock" | "unknown";

export interface OptionGroup {
  name: string;
  values: string[];
}

export interface PublicVariant {
  id: string;
  option_values: Record<string, string> | null;
  option_key: string | null;
  sku: string | null;
  price_vnd: number;
  compare_at_price_vnd?: number | null;
  availability: Availability;
  media_id: string | null;
}

export type Selection = Record<string, string>;

/** Variants that match every option already chosen. */
export const matching = (variants: PublicVariant[], selection: Selection) =>
  variants.filter((v) =>
    Object.entries(selection).every(([k, val]) => (v.option_values ?? {})[k] === val),
  );

/** The one variant a full selection identifies, or null while it is partial. */
export function resolveVariant(
  groups: OptionGroup[],
  variants: PublicVariant[],
  selection: Selection,
): PublicVariant | null {
  // A product with no options has exactly one variant and nothing to choose.
  if (groups.length === 0) return variants[0] ?? null;
  if (groups.some((g) => !selection[g.name])) return null;
  return matching(variants, selection)[0] ?? null;
}

/**
 * Whether picking `value` for `group` leads anywhere, given the OTHER options
 * already chosen.
 *
 * `exists` is about the option graph; `available` is about stock. They are
 * separate because they need different words on screen: a combination the
 * seller never made is not the same as one they have sold out of, and
 * `unknown` stock is neither.
 */
export function optionState(
  variants: PublicVariant[],
  selection: Selection,
  group: string,
  value: string,
): { exists: boolean; available: boolean } {
  const others = Object.fromEntries(Object.entries(selection).filter(([k]) => k !== group));
  const candidates = matching(variants, { ...others, [group]: value });
  return {
    exists: candidates.length > 0,
    // `unknown` counts as available: the seller did not give a number, and
    // greying the option out would invent a fact.
    available: candidates.some((v) => v.availability !== "out_of_stock"),
  };
}

/**
 * Pick a value, keeping the rest of the selection wherever it still works.
 *
 * Changing colour must not silently reset the size the buyer already chose —
 * but it also must not leave them on a combination that does not exist. So
 * options that no longer resolve are dropped, and everything else stays.
 */
export function pickOption(
  groups: OptionGroup[],
  variants: PublicVariant[],
  selection: Selection,
  group: string,
  value: string,
): Selection {
  const next: Selection = { ...selection, [group]: value };
  for (const g of groups) {
    if (g.name === group || !next[g.name]) continue;
    if (matching(variants, next).length === 0) delete next[g.name];
  }
  return next;
}

/**
 * The opening selection.
 *
 * The first variant that is actually buyable, so a buyer does not land on a
 * sold-out combination. Falls back to the first variant when everything is
 * sold out, because showing nothing selected is worse than showing the truth.
 */
export function initialSelection(groups: OptionGroup[], variants: PublicVariant[]): Selection {
  if (groups.length === 0) return {};
  const seed =
    variants.find((v) => v.availability === "in_stock") ??
    variants.find((v) => v.availability === "unknown") ??
    variants[0];
  return seed?.option_values ? { ...seed.option_values } : {};
}

/** The price to show: one number when resolved, a range while still choosing. */
export function displayPrice(
  variants: PublicVariant[],
  selection: Selection,
  resolved: PublicVariant | null,
): { min: number; max: number } | null {
  if (resolved) return { min: resolved.price_vnd, max: resolved.price_vnd };
  const pool = matching(variants, selection);
  if (pool.length === 0) return null;
  const prices = pool.map((v) => v.price_vnd);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Which photo to show.
 *
 * The chosen variant's photo when it has one, otherwise the product's main
 * image. Returning null would blank the gallery mid-selection, which reads as
 * a broken page rather than as "this colour has no separate photo".
 */
export const activeMediaId = (
  resolved: PublicVariant | null,
  variants: PublicVariant[],
  selection: Selection,
  primaryMediaId: string | null,
): string | null =>
  resolved?.media_id ??
  matching(variants, selection).find((v) => v.media_id)?.media_id ??
  primaryMediaId;

/**
 * Which photo the gallery shows once the buyer has TAPPED one.
 *
 * R5 #3. `activeMediaId` alone is a function of the variant, so on a product
 * with five photos and no options — a used paddle, the common case — every
 * thumbnail resolved to the same id and tapping 2..5 did nothing at all.
 *
 * A picked id wins, but only while it still exists in `media`: a stale pick
 * (the product changed under a cached page) falls back to the variant's photo
 * rather than blanking the gallery.
 */
export const shownMediaId = (
  pickedMediaId: string | null,
  media: readonly { id: string }[],
  variantMediaId: string | null,
): string | null =>
  pickedMediaId && media.some((m) => m.id === pickedMediaId) ? pickedMediaId : variantMediaId;
