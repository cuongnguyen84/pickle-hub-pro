import { describe, expect, it } from 'vitest';
import {
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
