import { describe, expect, it } from 'vitest';
import {
  buildLinkReply,
  checkXBody,
  countXWeighted,
  isRetryableXStatus,
  shouldRefreshToken,
  xLinkDelaySeconds,
  xMaxAttempts,
  xMinGapMinutes,
  type XEnv,
} from './x';

const env = (over: Partial<XEnv> = {}): XEnv => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'key',
  ...over,
});

describe('countXWeighted', () => {
  it('counts plain ASCII one per character', () => {
    expect(countXWeighted('Hello pickleball')).toBe(16);
  });

  it('charges every URL a flat 23 regardless of real length', () => {
    // 76 raw characters, but t.co wrapping makes X count 23.
    const long = 'https://www.thepicklehub.net/blog/hong-kong-slam-2026-preview-and-picks';
    expect(countXWeighted(long)).toBe(23);
    expect(countXWeighted(`Read: ${long}`)).toBe(6 + 23);
  });

  it('charges astral code points double', () => {
    expect(countXWeighted('🔥')).toBe(2);
    expect(countXWeighted('ab🔥')).toBe(4);
  });
});

describe('checkXBody', () => {
  it('accepts a normal post', () => {
    const result = checkXBody('Anna Leigh Waters takes the gold in three. Again.');
    expect(result.ok).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it('rejects an empty body', () => {
    expect(checkXBody('   ').reason).toBe('empty');
  });

  it('rejects a body over the 280 weighted limit', () => {
    const result = checkXBody('a'.repeat(281));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('too_long');
    expect(result.weighted).toBe(281);
  });

  it('accepts exactly 280 weighted characters', () => {
    expect(checkXBody('a'.repeat(280)).ok).toBe(true);
  });

  it('warns but still accepts a body containing a link', () => {
    // Links belong in the reply. This is Cuong-approved copy, so we flag it
    // rather than silently rewriting what he signed off on.
    const result = checkXBody('Recap: https://www.thepicklehub.net/blog/x');
    expect(result.ok).toBe(true);
    expect(result.warning).toBe('body_contains_link');
  });
});

describe('isRetryableXStatus', () => {
  it('retries rate limits and server errors', () => {
    expect(isRetryableXStatus(429)).toBe(true);
    expect(isRetryableXStatus(500)).toBe(true);
    expect(isRetryableXStatus(599)).toBe(true); // network failure shim
  });

  it('does not retry auth, duplicate-content, or malformed requests', () => {
    expect(isRetryableXStatus(400)).toBe(false);
    expect(isRetryableXStatus(401)).toBe(false);
    expect(isRetryableXStatus(403)).toBe(false);
  });
});

describe('shouldRefreshToken', () => {
  const now = Date.UTC(2026, 7, 16, 12, 0, 0);
  const at = (minutesFromNow: number) => new Date(now + minutesFromNow * 60_000).toISOString();

  it('keeps a token that is comfortably valid', () => {
    expect(shouldRefreshToken(at(60), now)).toBe(false);
  });

  it('refreshes inside the 5-minute skew window', () => {
    expect(shouldRefreshToken(at(4), now)).toBe(true);
    expect(shouldRefreshToken(at(-1), now)).toBe(true);
  });

  it('refreshes when expires_at is unparseable rather than trusting it', () => {
    expect(shouldRefreshToken('not-a-date', now)).toBe(true);
  });
});

describe('tuning knobs', () => {
  it('falls back to defaults when vars are unset or junk', () => {
    expect(xMinGapMinutes(env())).toBe(90);
    expect(xMinGapMinutes(env({ X_POST_MIN_GAP_MINUTES: 'abc' }))).toBe(90);
    expect(xLinkDelaySeconds(env())).toBe(90);
    expect(xMaxAttempts(env())).toBe(3);
    expect(xMaxAttempts(env({ X_MAX_ATTEMPTS: '0' }))).toBe(3);
  });

  it('honours explicit values, including a disabled gap', () => {
    expect(xMinGapMinutes(env({ X_POST_MIN_GAP_MINUTES: '0' }))).toBe(0);
    expect(xLinkDelaySeconds(env({ X_LINK_COMMENT_DELAY_SECONDS: '120' }))).toBe(120);
    expect(xMaxAttempts(env({ X_MAX_ATTEMPTS: '5' }))).toBe(5);
  });
});

describe('buildLinkReply', () => {
  it('prefixes the link so the reply does not read as a bare-URL spam post', () => {
    expect(buildLinkReply('https://www.thepicklehub.net/news/a')).toBe(
      '🔗 https://www.thepicklehub.net/news/a',
    );
  });
});
