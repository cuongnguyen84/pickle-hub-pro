# ADR-001: Mobile platform direction

- Status: Accepted — transition completed 2026-08-24
- Date: 2026-07-11
- Owners: Cuong + Codex

## Outcome (2026-08-24)

The transition this ADR describes is finished, and the Capacitor code has been
deleted from the repository.

- Native SwiftUI took over the App Store identity `net.thepicklehub.app` at
  2.0.3 (build 8), following the Capacitor release 1.0.1 (2). App Store
  versions only move forward, so there is no rollback path to Capacitor and
  keeping its project served no purpose.
- The Android wrapper was never published. Cuong confirmed this on 2026-08-24,
  which resolves follow-up item 6 and decision 5 by removal: nothing shipped,
  so nothing inherits the Capacitor callback.
- `SEC-01` closes by retirement, the second of the two options in follow-up
  item 1: the transitional token callback no longer exists in any shipped
  surface.
- Removed: `ios/`, `android/`, `capacitor.config.ts`, `MOBILE_BUILD_GUIDE.md`,
  all `@capacitor/*` and `@capgo/*` packages, and the four web modules that
  only ran inside the wrapper (deep-link handler, native Google auth, push
  registration, platform detection). Push tokens are now registered solely by
  `apple/ThePickleHub/Core/Notifications/RemotePushService.swift`.

The record below is the original 2026-07-11 decision, kept unedited.

## Context

ThePickleHub currently has one mobile application in production:

- iOS App Store: Capacitor application rendering the React web application in a WebView.

The repository also contains a native SwiftUI application under `/apple`. It is still under development and is intended to replace the production Capacitor iOS application.

There is currently no Android application. Android will be developed later; generated/local Android artifacts in the workspace do not represent a released Android product.

The production Capacitor iOS authentication path currently returns Supabase access and refresh tokens through a custom URL scheme. That path remains a production concern until the Capacitor app is retired.

## Decision

1. SwiftUI `/apple` is the long-term iOS source of truth.
2. Capacitor iOS is a transitional production application, not a permanent second iOS implementation.
3. New iOS product functionality should target SwiftUI unless it is an urgent production fix required by the existing Capacitor release.
4. Shared backend contracts, domain rules, design tokens, and deep-link routes should be reusable by web and SwiftUI; UI implementation is platform-specific.
5. Android has no committed implementation stack yet. Its architecture will be decided when Android planning begins, using the lessons and shared contracts from SwiftUI/web rather than inheriting Capacitor by default.
6. The Capacitor token callback must either be secured with verified Universal Links and PKCE or removed by retiring the Capacitor app. It must not be copied into Android.

## Consequences

### Positive

- One long-term iOS implementation and navigation model.
- Native authentication, accessibility, performance, and platform behavior.
- Less permanent duplication between Capacitor and SwiftUI.
- Android remains free to choose an appropriate architecture later.

### Costs and risks

- Capacitor iOS must remain secure and supported until SwiftUI reaches release parity.
- Feature parity and migration need an explicit checklist.
- Users need a session/deep-link migration and a safe App Store upgrade path.
- Backend and analytics contracts must remain compatible during the transition.

## Required follow-up

- `SEC-01`: choose between securing the transitional Capacitor callback and retiring it before another release.
- Create an iOS parity matrix covering auth, onboarding, feed, events, tournaments, registration, DUPR, notifications, deep links, account, privacy, and recovery.
- Define SwiftUI release gates and rollback strategy.
- Do not treat local Android build artifacts as a product roadmap commitment.
