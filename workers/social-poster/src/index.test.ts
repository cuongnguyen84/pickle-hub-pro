import { describe, expect, it } from 'vitest';
import {
  buildAppComment,
  buildLinkComment,
  facebookMaxItemAgeDays,
  laterOf,
  isFacebookPostingWindow,
  pickNextId,
  pickNextScanLimit,
  sanitizeCaption,
} from './index';

describe('pickNext window', () => {
  const ids = (n: number, from = 0) =>
    Array.from({ length: n }, (_, i) => `id-${i + from}`);

  // The production stall, reproduced with the real numbers: 683 eligible rows
  // ordered by importance, the first 50 all finished, and the waiting item at
  // rank 87. With a fixed window of 50 the pipeline returns null forever — the
  // cron keeps succeeding and nothing is ever posted again.
  it('finds nothing when the window is smaller than the finished prefix', () => {
    const ordered = ids(683);
    const done = ids(86); // ranks 1..86 all posted; rank 87 is waiting
    expect(pickNextId(ordered, done, 50)).toBeNull();
  });

  it('finds the waiting item once the window is sized off the finished count', () => {
    const ordered = ids(683);
    const done = ids(86);
    expect(pickNextId(ordered, done, pickNextScanLimit(done.length))).toBe('id-86');
  });

  it('keeps at least 50 unposted candidates in view as the archive grows', () => {
    expect(pickNextScanLimit(0)).toBe(50);
    expect(pickNextScanLimit(692)).toBe(742);
    // Ceiling is deliberate; past it the scan needs a real anti-join.
    expect(pickNextScanLimit(5000)).toBe(2000);
  });

  it('returns null only when everything really is done', () => {
    const ordered = ids(10);
    expect(pickNextId(ordered, ordered, pickNextScanLimit(10))).toBeNull();
  });

  it('respects priority order rather than picking any unposted row', () => {
    const ordered = ['high', 'mid', 'low'];
    expect(pickNextId(ordered, ['high'], 50)).toBe('mid');
  });
});

// Window is 07:00–19:59 Asia/Ho_Chi_Minh (UTC+7), so UTC 00:00–12:59.
const utc = (h: number, min = 0) => new Date(Date.UTC(2026, 7, 3, h, min));

describe('isFacebookPostingWindow', () => {
  it('allows VN daytime hours', () => {
    expect(isFacebookPostingWindow(utc(0))).toBe(true); // 07:00 VN
    expect(isFacebookPostingWindow(utc(5))).toBe(true); // 12:00 VN
    expect(isFacebookPostingWindow(utc(12, 59))).toBe(true); // 19:59 VN
  });

  it('blocks the VN night', () => {
    expect(isFacebookPostingWindow(utc(13))).toBe(false); // 20:00 VN
    expect(isFacebookPostingWindow(utc(18, 45))).toBe(false); // 01:45 VN — the 2026-08-03 incident
    expect(isFacebookPostingWindow(utc(23, 30))).toBe(false); // 06:30 VN
  });
});

describe('sanitizeCaption', () => {
  it('passes plain captions through', () => {
    expect(sanitizeCaption('Pickleball VN thắng lớn!')).toBe('Pickleball VN thắng lớn!');
  });
});

describe('post comments', () => {
  const link = 'https://www.thepicklehub.net/vi/news/abc-123';

  // Two comments, not one. Combined, Facebook rendered a single comment with two
  // links and gave neither its own preview card.
  it('puts the article link alone in the first comment', () => {
    expect(buildLinkComment(link)).toBe(link);
    expect(buildLinkComment(link)).not.toContain('apps.apple.com');
  });

  it('puts the app CTA alone in the second, with no article link in it', () => {
    const app = buildAppComment();
    expect(app).toContain('Tải app ThePickleHub');
    expect(app).toContain('apps.apple.com');
    expect(app).not.toContain('/vi/news/');
  });

  // The caption promises the article link is in the FIRST comment, so the two
  // must never be swapped.
  it('keeps them distinct so neither can stand in for the other', () => {
    expect(buildLinkComment(link)).not.toBe(buildAppComment());
  });
});

describe('Facebook staleness floor', () => {
  it('defaults to 3 days and honours the env override', () => {
    expect(facebookMaxItemAgeDays({} as never)).toBe(3);
    expect(facebookMaxItemAgeDays({ FB_MAX_ITEM_AGE_DAYS: '7' } as never)).toBe(7);
    expect(facebookMaxItemAgeDays({ FB_MAX_ITEM_AGE_DAYS: 'nonsense' } as never)).toBe(3);
    expect(facebookMaxItemAgeDays({ FB_MAX_ITEM_AGE_DAYS: '0' } as never)).toBe(3);
  });

  // A page that joined recently must not suddenly reach back past its own start
  // date just because the staleness window is wider than its history.
  it('takes whichever bound is later', () => {
    const cutoff = '2026-08-14T00:00:00Z';
    expect(laterOf('2026-07-31T00:00:00Z', cutoff)).toBe(cutoff);
    expect(laterOf('2026-08-16T00:00:00Z', cutoff)).toBe('2026-08-16T00:00:00Z');
    expect(laterOf(null, cutoff)).toBe(cutoff);
  });
});
