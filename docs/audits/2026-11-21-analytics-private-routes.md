# Analytics credential-URL boundary — 21/11/2026

Source scope: current main984c0839; affected files unchanged since source review
f52e0193. No public analytics configuration, production data or deployment changed.

Existing GA utility passed full window.location.href as page_location and logged
custom event params. Boot disabled automatic pageviews but still loaded SDKs on
bearer routes; preloaded scripts could then observe an SPA transition to a secret
URL. index.html also deferred AdSense/Ahrefs loaders without credential gating.

Changes: earliest inline boot guard excludes registration/join/auth/recovery
routes and credential-bearing query/hash values; malformed URL decoding fails
closed. It runs before SDK configuration/load and rechecks deferred callbacks.
Public-to-private history/link navigation enters a new document so SDKs initialized
on a public page are not carried onto the private document. Modified/new-tab link
clicks suppress later JS event propagation while preserving browser navigation.
Private documents set no-referrer before third-party resource loading. Private
middleware responses use no-store/no-referrer; server-rendered private shells
omit analytics. Public SSR Ahrefs injection also requires the live boot policy,
so canonical URLs cannot hide credential query values from the guard.

Manual GA calls skip private URLs, omit query/hash/referrer/title, redact credential
keys/values and nested objects, bound string values, and stop logging params.
Safe analytics journey identifiers and numerical/enum properties remain usable.
Boot GA configuration sets sanitized page_location, empty referrer and static title,
with send_page_view:false and debug mode removed. Public content SDKs remain enabled;
this is not a third-party JavaScript sandbox or a universal PII guarantee.

Cache namespace v160 invalidates v158/v159 bot HTML/human extracted heads that contained
raw analytics tags. Expect cold-cache rendering/database work until warmed. No
purge API used. Previously installed/offline shells cannot be remotely certified;
verify new shell/service-worker update and force reload in deployment QA.

Validation:14 policy/utility/boot/history/SSR/cache cases; persistent offline Chromium
script checks three initial private URLs plus history/click document boundaries,
intercepting every network response without contacting providers. Full Vitest
coverage before the final cache assertion:5330passed/69existing skips; statement
83.96%,branch72.39%,function80.10%,line86.04%; gates unchanged. TypeScript, scoped lint
and Worker bundle pass. CI must validate the exact PR head after cache update.

Remaining limits: third-party SDKs already authorized on public pages can read
that public DOM; this patch does not claim hostile-SDK isolation. Enhanced
measurement/property settings need separate account-side review. Existing HTTP
logs or data previously collected are not deleted by source changes. No historical
exposure claim or legal conclusion is made. Verify network requests and GA debug
capture using synthetic owned credentials after deployment; never use real tokens.

Event-property filtering is defense in depth, NOT a universal PII classifier.
Callers still require event-specific reviewed schemas; arbitrary free text under
unrecognized keys cannot be automatically certified harmless. Explicit name fields
are omitted, approved registration failure_code uses a shared closed enum (unknown
provider strings become unknown), and country_code permits two-letter enums.
Sensitive code fields do not gain a free-text exception. Nested percent encoding
is decoded at most three rounds; malformed/over-depth input fails closed in both
boot and utility predicates, including match invite confirmation capabilities.

## Installed service-worker boundary

The generated worker imports sw-private-navigation.js before Workbox routes. Its
first fetch listener uses strict NetworkOnly behavior for private navigations and
stops later fallback handlers. Offline private requests receive a static no-store
503 without SDKs or reflected URLs. Activation enumerates existing caches and
removes only same-origin GET keys classified private; public entries, draft keys,
other-origin entries and all localStorage/IndexedDB stores are untouched.

Build inspection found a preexisting startup defect: index.html is deliberately
excluded from precache, yet navigateFallback bound a precache handler to it.
Workbox throws non-precached-url before registering later runtime handlers. Remove
that invalid fallback without adding index to precache; retain public html-shell
NetworkFirst and add a controlled503 for a genuinely cold offline public miss.
This is a necessary startup/runtime correction, not a general PWA redesign.

Persistent actual-generated-SW browser test installs the built worker on localhost,
seeds old private/encoded/public/draft caches before activation, verifies scoped
cleanup, tests three offline private requests against cached old SDK shells,
asserts warm public offline content remains available and cold misses fail safely,
and rejects generated-worker startup exceptions. A dedicated CI job builds using
synthetic Supabase configuration and runs both browser scripts without secrets,
application modules, real SDKs, notifications or production requests.

Final local validation after PWA/callback changes:5350Vitest assertions pass,
69existing skips; coverage statements83.52%,branches72.12%,functions79.78%,
lines85.53% with the existing83% statements gate unchanged. Four real Login/OA
callback tests also preload a fake SDK in a private context and prove no event
or dataLayer transmission. All remaining direct callback SDK/dataLayer writes
were routed through trackEvent (including AuthProvider fallback), preserving
safe public intent while removing registration identifiers. TypeScript/build
and both offline browser scripts pass. Scoped ESLint has no errors and retains
one preexisting useAuth fast-refresh warning. No production settings changed.

Merge reconciliation (2026-11-21): main 48b0c12c introduced the AI-chat landing
pages and cache namespace v159 before this privacy change. Both new route
renderers and the existing 1935 KB CODE budget are retained from main; this PR
does not increase the budget. Namespace v160 prevents reuse of those v159 heads
without the privacy guard. Both bot and human lookups use the shared key helper.
