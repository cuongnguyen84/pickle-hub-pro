import { describe, it, expect } from 'vitest';
import { planRepair, type Origin } from '../plan';

const origin = (over: Partial<Origin> = {}): Origin => ({
  id: 'x', raw_title: 't', source_name: 's',
  content_kind: 'full', attempts: 0, last_error: null,
  ...over,
});

describe('planRepair', () => {
  it('reclassifies a full article its source could not sustain', () => {
    const p = planRepair(origin({ last_error: 'en body has 254 words; expected 350-800' }));
    expect(p.kind).toBe('reclassify');
    if (p.kind === 'reclassify') expect(p.patch).toEqual({ content_kind: 'brief' });
  });

  // These already survived news-rewrite's own three corrective attempts, so a
  // plain requeue is only worth the call because the rules changed underneath.
  it.each([
    'en body has 109 words; expected 150-250',
    'vi body has 354 words; expected 150-250',
    'vi draft is missing Vietnamese diacritics',
    'en category is invalid',
    'en summary length is invalid',
  ])('requeues a validation miss: %s', (last_error) => {
    expect(planRepair(origin({ last_error })).kind).toBe('requeue');
  });

  it.each(['Signal timed out.', 'Gemini HTTP 503: overloaded'])(
    'requeues a transient: %s', (last_error) => {
      expect(planRepair(origin({ last_error })).kind).toBe('requeue');
    });

  // The bound is the only thing standing between this and an infinite requeue
  // loop against a row that can never pass.
  it('stops after the repair budget, whatever the error says', () => {
    const p = planRepair(origin({ attempts: 3, last_error: 'Signal timed out.' }));
    expect(p.kind).toBe('leave');
    expect(p.reason).toContain('budget');
  });

  it('leaves an unrecognised error alone, and names it', () => {
    const p = planRepair(origin({ last_error: 'something nobody has seen before' }));
    expect(p.kind).toBe('leave');
    expect(p.reason).toContain('unrecognised');
  });
});
