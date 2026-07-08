import { describe, it, expect } from 'vitest';
import { discountPercentForSlot } from '@/lib/payment/discounts';

// Bậc cộng dồn: 10 slot đầu -20%, 5 slot tiếp -15%, còn lại giá gốc.
const tiers = [
  { slots: 10, percent: 20 },
  { slots: 5, percent: 15 },
];

describe('discountPercentForSlot', () => {
  it('applies tier percentages cumulatively by slot index', () => {
    expect(discountPercentForSlot(tiers, 0)).toBe(20); // slot #1
    expect(discountPercentForSlot(tiers, 9)).toBe(20); // slot #10
    expect(discountPercentForSlot(tiers, 10)).toBe(15); // slot #11
    expect(discountPercentForSlot(tiers, 14)).toBe(15); // slot #15
    expect(discountPercentForSlot(tiers, 15)).toBe(0); // slot #16 — giá gốc
  });

  it('returns 0 when no tiers configured', () => {
    expect(discountPercentForSlot(null, 0)).toBe(0);
    expect(discountPercentForSlot([], 3)).toBe(0);
  });
});
