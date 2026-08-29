import { describe, expect, it } from 'vitest';
import {
  buildAppComment,
  configuredPages,
  isWithinPostWindow,
  type Env,
} from './index';

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

describe('buildAppComment', () => {
  it('builds a standalone App Store call to action', () => {
    const comment = buildAppComment();

    expect(comment).toContain('ThePickleHub: Tournaments');
    expect(comment).toContain('xem livestream');
    expect(comment).toContain('cập nhật tin tức');
    expect(comment).toContain(
      'https://apps.apple.com/vn/app/thepicklehub-tournaments/id6759968026?l=vi',
    );
    expect(comment).not.toContain('thepicklehub.net/vi/news/');
  });
});

describe('configuredPages', () => {
  it('applies the same publishing flow to both configured fanpages', () => {
    const pages = configuredPages({
      FB_PAGE_ID: 'primary-page',
      FB_PAGE_ACCESS_TOKEN: 'primary-token',
      FB_SECONDARY_PAGE_ID: 'secondary-page',
      FB_SECONDARY_PAGE_ACCESS_TOKEN: 'secondary-token',
      FB_SECONDARY_START_AT: '2026-07-31T10:04:31Z',
    } as Env);

    expect(pages.map(({ key, id }) => ({ key, id }))).toEqual([
      { key: 'thepicklehub', id: 'primary-page' },
      { key: 'ta-pickleball', id: 'secondary-page' },
    ]);
  });
});
