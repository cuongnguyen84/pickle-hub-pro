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

export type JourneyKind = "player_registration" | "organizer_event";

const JOURNEY_SCHEMA_VERSION = 1;
const storageKey = (kind: JourneyKind) => `journey_${kind}_id`;

function readActiveId(kind: JourneyKind): string | null {
  try {
    return sessionStorage.getItem(storageKey(kind));
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
  } catch {
    // Journey still tracks within this page's lifetime via the return value.
  }
  return id;
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
  } catch {
    // Best effort — the emit below still happens exactly once per read.
  }
  void emit(kind, eventName, id, props);
}
