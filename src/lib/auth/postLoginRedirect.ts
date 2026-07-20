// Where an authenticated user lands — UX-07 increment 2.
//
// Onboarding used to EAT the post-login destination: Login sent a not-yet-
// onboarded user to a bare "/onboarding" and dropped `redirect`, and the
// wizard finished by landing them on their own profile. A player who followed
// a bracket link, hit the auth wall and signed up therefore lost the
// tournament they came for — the exact journey UX-07 is about.
//
// Both decisions live here so Login and OnboardingWizard cannot drift apart,
// and so the rule is testable without rendering the auth stack.

import { safeInternalPath } from './safeRedirect';

/**
 * Destination once a session exists (Login).
 *
 * Revalidates even though today's only caller already passed the value through
 * `safeInternalPath` — this is an open-redirect boundary, and a second caller
 * forgetting that step should be harmless, not exploitable.
 */
export function postLoginTarget(redirectUrl: string, onboarded: boolean): string {
  const safe = safeInternalPath(redirectUrl);
  if (onboarded) return safe;
  // Carry the destination INTO onboarding rather than discarding it.
  return safe !== '/' ? `/onboarding?redirect=${encodeURIComponent(safe)}` : '/onboarding';
}

/**
 * Destination once the wizard finishes (OnboardingWizard).
 *
 * `redirectParam` arrives through the URL, so it is attacker-controlled by the
 * time we read it no matter who wrote it last — revalidate here instead of
 * trusting that Login already did.
 */
export function postOnboardingTarget(
  redirectParam: string | null,
  username: string | null,
): string {
  const carried = redirectParam ? safeInternalPath(redirectParam) : null;
  if (carried && carried !== '/') return carried;
  return username ? `/nguoi-choi/${username}` : '/';
}
