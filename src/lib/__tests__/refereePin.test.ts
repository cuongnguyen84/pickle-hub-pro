import { describe, it, expect, vi } from 'vitest';

// referee-helpers imports the supabase client at module load; the pure
// normalizePinInput under test needs none of it. Stub the client so the test
// stays hermetic (same pattern as the other lib tests).
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { normalizePinInput } from '@/lib/referee-helpers';

describe('normalizePinInput', () => {
  it('strips spaces and dashes from a grouped code', () => {
    expect(normalizePinInput('123 456')).toBe('123456');
    expect(normalizePinInput('123-456')).toBe('123456');
  });

  it('drops non-digit characters', () => {
    expect(normalizePinInput('12a3b45c6')).toBe('123456');
  });

  it('caps at 6 digits', () => {
    expect(normalizePinInput('1234567890')).toBe('123456');
  });

  it('keeps a partial code as typed', () => {
    expect(normalizePinInput('12')).toBe('12');
    expect(normalizePinInput('')).toBe('');
  });

  it('preserves leading zeros (PINs are strings, not numbers)', () => {
    expect(normalizePinInput('007 042')).toBe('007042');
  });
});
