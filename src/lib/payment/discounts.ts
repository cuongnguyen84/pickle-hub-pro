// Bậc giảm giá theo slot đăng ký sớm: {slots: 10, percent: 20} = 10 slot đầu -20%.
// Cộng dồn theo thứ tự bậc; slot đội tính theo thứ tự đăng ký (created_at).
export interface DiscountTier {
  slots: number;
  percent: number;
}

/** % giảm cho slot thứ `index` (0-based) theo các bậc cộng dồn. Hết bậc = 0%. */
export function discountPercentForSlot(tiers: DiscountTier[] | null | undefined, index: number): number {
  if (!tiers) return 0;
  let start = 0;
  for (const tier of tiers) {
    if (index < start + tier.slots) return tier.percent;
    start += tier.slots;
  }
  return 0;
}
