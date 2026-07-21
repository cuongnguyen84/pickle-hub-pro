// ============================================================================
// North-star journey instrumentation (BASE-02).
// Contract: docs/north-star-journeys.md — event names, shared properties,
// PII rules, and dedup semantics are fixed there; this module implements
// them once so page code only supplies journey-specific properties.
// ============================================================================

import { trackEvent } from "@/utils/ga";
import {
  getAppSurface,
  getDeviceClass,
  getLocale,
  normalizeRumRoute,
  resolveMarketSegment,
} from "./webVitalsRum";

export type JourneyKind =
  | "player_registration"
  // QuickTable tournament registration (singles + doubles). SEPARATE from
  // player_registration on purpose: that one is the Social Event OTP flow
  // (RegistrationModal) with its own event vocabulary, and the two used to
  // share the sessionStorage key `journey_player_registration_id` — a real
  // collision that also blended the D5 funnel. Distinct kind = distinct key.
  | "quicktable_registration"
  | "organizer_event"
  // UX-01..05: the 4 tournament creation flows (prop `tool` distinguishes
  // flex | quicktable | teammatch | doubles).
  | "organizer_tournament"
  // Livestream login gate → signup funnel. Starts when the gate overlay is
  // shown; completes at the existing sign_up point in useAuth. Prop
  // `surface` distinguishes home | watch | embed.
  | "livestream_gate";

const JOURNEY_SCHEMA_VERSION = 1;
// A journey older than this is treated as abandoned: sessionStorage only
// clears on completeJourney, so a tab left open for days would otherwise let a
// LATER registration attempt reuse a stale id and merge two funnels.
const JOURNEY_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const storageKey = (kind: JourneyKind) => `journey_${kind}_id`;
const stampKey = (kind: JourneyKind) => `journey_${kind}_at`;

function readActiveId(kind: JourneyKind): string | null {
  try {
    return sessionStorage.getItem(storageKey(kind));
  } catch {
    return null;
  }
}

function readFreshId(kind: JourneyKind): string | null {
  try {
    const id = sessionStorage.getItem(storageKey(kind));
    if (!id) return null;
    const at = Number(sessionStorage.getItem(stampKey(kind)) ?? 0);
    if (!at || Date.now() - at > JOURNEY_MAX_AGE_MS) return null;
    return id;
  } catch {
    return null;
  }
}

/**
 * Start (or restart) a journey: mints a fresh journey_id for the intent
 * denominator. Call exactly at the contract's entry condition (CTA opens
 * the registration modal / create wizard becomes usable).
 */
export function startJourney(kind: JourneyKind): string {
  const id = crypto.randomUUID();
  try {
    sessionStorage.setItem(storageKey(kind), id);
    sessionStorage.setItem(stampKey(kind), String(Date.now()));
  } catch {
    // Journey still tracks within this page's lifetime via the return value.
  }
  return id;
}

/**
 * Start a journey ONLY if there isn't already a fresh one for this kind —
 * otherwise return the existing id. This is what a registration form must
 * call: its start effect re-runs on the anon→authenticated transition (and on
 * a full-page OAuth round-trip), and a plain startJourney there would mint a
 * NEW id, orphaning the `auth_wall_viewed` denominator from the eventual
 * `..._complete`. A stale journey (older than JOURNEY_MAX_AGE_MS, e.g. a tab
 * left open) is treated as absent so a later attempt gets a clean id.
 */
export function startJourneyOnce(kind: JourneyKind): string {
  const existing = readFreshId(kind);
  return existing ?? startJourney(kind);
}

/** Journey-specific properties. PII is forbidden by the contract — only
 * pass allow-listed enums/booleans/counts, never names/phones/titles. */
export type JourneyProps = Record<string, string | number | boolean | undefined>;

async function emit(
  kind: JourneyKind,
  eventName: string,
  journeyId: string,
  props: JourneyProps,
): Promise<void> {
  const pathname = window.location.pathname;
  trackEvent(eventName, {
    journey_schema_version: JOURNEY_SCHEMA_VERSION,
    journey_id: journeyId,
    source_route: normalizeRumRoute(pathname),
    locale: getLocale(pathname),
    auth_state: props.auth_state ?? "anonymous",
    app_surface: getAppSurface(),
    device_class: getDeviceClass(window.innerWidth),
    market_segment: await resolveMarketSegment(),
    ...props,
  });
}

/**
 * Step/diagnostic event. No-op when no journey is active (e.g. a stray
 * refetch after completion) so steps can't appear outside a journey.
 */
export function trackJourneyStep(
  kind: JourneyKind,
  eventName: string,
  props: JourneyProps = {},
): void {
  const id = readActiveId(kind);
  if (!id) return;
  void emit(kind, eventName, id, props);
}

/**
 * Completion event — emits once per journey_id, then closes the journey so
 * React re-renders and query refetches cannot emit it again (contract rule).
 */
export function completeJourney(
  kind: JourneyKind,
  eventName: string,
  props: JourneyProps = {},
): void {
  const id = readActiveId(kind);
  if (!id) return;
  try {
    sessionStorage.removeItem(storageKey(kind));
    sessionStorage.removeItem(stampKey(kind));
  } catch {
    // Best effort — the emit below still happens exactly once per read.
  }
  void emit(kind, eventName, id, props);
}
