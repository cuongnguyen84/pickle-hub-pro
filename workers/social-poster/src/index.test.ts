import { describe, expect, it } from 'vitest';
import { isFacebookPostingWindow, sanitizeCaption } from './index';

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
