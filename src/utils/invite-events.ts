/**
 * GA4 event helpers for the match invite-to-confirm growth loop (Phase A).
 * Thin wrappers over trackEvent so every step of the loop fires with a
 * consistent name + shape, letting us measure whether the loop actually
 * converts: invite_sent → invite_opened → signup_from_invite → match_confirmed.
 */
import { trackEvent } from "@/utils/ga";

/** The creator shared/copied an invite link for an unregistered opponent. */
export function trackInviteSent(params: { proposalId: string; channel: string; count?: number }): void {
  trackEvent("invite_sent", { ...params });
}

/** An invite link was opened (the public /match/confirm/:code preview loaded). */
export function trackInviteOpened(params: { code: string; loggedIn: boolean }): void {
  trackEvent("invite_opened", { ...params });
}

/** A brand-new account was created from an invite link (signup attributed to a token). */
export function trackSignupFromInvite(params: { code: string }): void {
  trackEvent("signup_from_invite", { ...params });
}

/** An opponent confirmed (or disputed) a match via an invite link. */
export function trackMatchConfirmed(params: { proposalId: string; action: "confirm" | "dispute" }): void {
  trackEvent("match_confirmed", { ...params });
}
