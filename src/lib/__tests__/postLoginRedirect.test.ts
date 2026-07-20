// UX-07 increment 2 — the post-login destination must survive onboarding.
//
// The bug this pins: Login sent a not-yet-onboarded user to a bare
// "/onboarding" and dropped `redirect` entirely, so a player who followed a
// bracket link, hit the auth wall and signed up was landed on their own
// profile — the tournament they came for gone from the flow.
//
// Both decisions live in lib/auth/postLoginRedirect and are imported here —
// Login and OnboardingWizard call the same functions, so a green test means
// the shipped path is green, not a copy of it.

import { describe, expect, it } from 'vitest';
import { postLoginTarget, postOnboardingTarget } from '../auth/postLoginRedirect';

const BRACKET = '/tools/quick-tables/abc123';

describe('post-login redirect survives onboarding', () => {
  it('carries the bracket through to the wizard for a brand-new player', () => {
    const afterLogin = postLoginTarget(BRACKET, false);
    expect(afterLogin).toBe(`/onboarding?redirect=${encodeURIComponent(BRACKET)}`);

    // The wizard reads it back off the URL and returns the player to it.
    const param = new URLSearchParams(afterLogin.split('?')[1]).get('redirect');
    expect(postOnboardingTarget(param, 'linh')).toBe(BRACKET);
  });

  it('sends an already-onboarded player straight to the bracket', () => {
    expect(postLoginTarget(BRACKET, true)).toBe(BRACKET);
  });

  it('keeps the profile-first landing when onboarding started on its own', () => {
    expect(postLoginTarget('/', false)).toBe('/onboarding');
    expect(postOnboardingTarget(null, 'linh')).toBe('/nguoi-choi/linh');
  });

  it('falls back home when the wizard has no username to land on', () => {
    expect(postOnboardingTarget(null, null)).toBe('/');
  });

  it('refuses an off-site destination at BOTH hops, not just the wizard', () => {
    // postLoginTarget is an exported open-redirect boundary; a future caller
    // that forgets safeInternalPath must not turn it into a trampoline.
    for (const hostile of ['//evil.com', '/\\evil.com', 'https://evil.com']) {
      expect(postLoginTarget(hostile, true)).toBe('/');
      expect(postLoginTarget(hostile, false)).toBe('/onboarding');
    }
  });

  it('refuses an off-site destination smuggled through the wizard URL', () => {
    // The redirect reaches the wizard through the URL, so it is attacker
    // input by the time we read it — revalidate, never trust Login's pass.
    for (const hostile of ['//evil.com', '/\\evil.com', 'https://evil.com', '/%2Fevil.com']) {
      expect(postOnboardingTarget(hostile, 'linh')).toBe('/nguoi-choi/linh');
    }
  });
});
