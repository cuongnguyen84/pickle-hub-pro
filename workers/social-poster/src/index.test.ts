import { describe, expect, it } from 'vitest';
import { isWithinPostWindow, type Env } from './index';

const env = (window?: string) => ({ FB_POST_WINDOW_VN: window } as Env);

// 2026-08-03T00:00:00Z = 07:00 VN
const utc = (h: number, min = 0) => Date.UTC(2026, 7, 3, h, min);

describe('isWithinPostWindow', () => {
  it('allows daytime VN hours with default window', () => {
    expect(isWithinPostWindow(env(), utc(0))).toBe(true); // 07:00 VN
    expect(isWithinPostWindow(env(), utc(5))).toBe(true); // 12:00 VN
    expect(isWithinPostWindow(env(), utc(13, 59))).toBe(true); // 20:59 VN
  });

  it('blocks the VN night with default window', () => {
    expect(isWithinPostWindow(env(), utc(14))).toBe(false); // 21:00 VN
    expect(isWithinPostWindow(env(), utc(18, 45))).toBe(false); // 01:45 VN — the 2026-08-03 incident
    expect(isWithinPostWindow(env(), utc(23, 30))).toBe(false); // 06:30 VN
  });

  it('supports a wrap-around window like 21-7', () => {
    expect(isWithinPostWindow(env('21-7'), utc(14))).toBe(true); // 21:00 VN
    expect(isWithinPostWindow(env('21-7'), utc(5))).toBe(false); // 12:00 VN
  });

  it('fails open on malformed spec', () => {
    expect(isWithinPostWindow(env('banana'), utc(18))).toBe(true);
  });
});
