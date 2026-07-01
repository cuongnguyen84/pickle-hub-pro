import { describe, it, expect } from 'vitest';
import { isDuprEligible } from '../duprEligibility';

describe('isDuprEligible', () => {
  it('always eligible when DUPR not required', () => {
    expect(isDuprEligible({ requireDupr: false, connected: false, rating: null, max: 4 })).toBe(true);
  });

  it('blocks when required but not connected', () => {
    expect(isDuprEligible({ requireDupr: true, connected: false, rating: null, max: 4 })).toBe(false);
  });

  it('eligible when rating within cap', () => {
    expect(isDuprEligible({ requireDupr: true, connected: true, rating: 3.5, max: 4 })).toBe(true);
  });

  it('blocks when rating exceeds cap', () => {
    expect(isDuprEligible({ requireDupr: true, connected: true, rating: 4.2, max: 4 })).toBe(false);
  });

  it('boundary: rating equal to cap is eligible', () => {
    expect(isDuprEligible({ requireDupr: true, connected: true, rating: 4, max: 4 })).toBe(true);
  });

  it('no cap → any connected rating is eligible', () => {
    expect(isDuprEligible({ requireDupr: true, connected: true, rating: 9, max: null })).toBe(true);
  });
});
