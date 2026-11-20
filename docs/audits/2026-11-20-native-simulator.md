# Native QA baseline — 20/11/2026

Scope: current local apple source; simulator-only, unsigned, no release/upload,
production transaction, push send, or source changes. Tests ran 19:25–19:26 ICT;
Release completed 19:29 ICT. Local checkout is not current remote main, so this
evidence covers the local tree, not uninspected changes merged elsewhere.

## Environment

- macOS 27.2 (26B5091g), Xcode 27.2 (27B52).
- Scheme/targets: ThePickleHub / ThePickleHubTests.
- iPhone 17 simulator, iOS 26.2, UUID 5A44903A-DF46-4016-9903-33CBF05FD3F5.
- Release preflight identity: net.thepicklehub.app 2.3.0 (19), Swift 6.
- Initial Xcode list reported stale CoreSimulator 1174.9.2 versus 1174.21.0.
  The subsequent simctl invocation automatically completed platform installation
  and refreshed its service; simulator discovery and actual test execution then
  succeeded. No manual system changes or simulator erasure were performed.

## Commands and results

Working directory: apple.

1. xcodebuild test -project ThePickleHub.xcodeproj -scheme ThePickleHub
   -destination 'platform=iOS Simulator,id=5A44903A-DF46-4016-9903-33CBF05FD3F5'
   CODE_SIGNING_ALLOWED=NO
   — TEST SUCCEEDED; **294 tests / 49 suites passed**.
2. xcodebuild build -project ThePickleHub.xcodeproj -scheme ThePickleHub
   -configuration Release -destination 'generic/platform=iOS Simulator'
   CODE_SIGNING_ALLOWED=NO
   — BUILD SUCCEEDED (arm64/x86_64 simulator).
3. ./scripts/release_preflight.sh — PASS.

Temporary logs: /tmp/tph-native-qa-20261120.log,
/tmp/tph-native-release-20261120.log,
/tmp/tph-native-preflight-20261120.log.
Xcode result: ~/Library/Developer/Xcode/DerivedData/ThePickleHub-hikoemxzozzrwacutwtmldwrfvpk/Logs/Test/Test-ThePickleHub-2026.11.20_19-25-15-+0700.xcresult.
These paths are local ephemeral evidence, not durable CI artifacts.

## Warnings and limits

Release emitted two string-catalog warnings: ambiguous plural substitution for
English variants of "Thắng %lld · HS %@%lld" and "%lld đội · %lld trận".
AppIntents metadata extraction also skipped because the app has no dependency
on AppIntents.framework. No compile/test error was reproduced. String plural
warnings need a separate positional-substitution regression review; they were
not silently normalized in this audit.

Simulator unit coverage and source preflight do not establish real-device
quality. Remaining physical-device gates from docs/manual-test-backlog.md and
Shop release packet include signed-install/update and session continuity,
Apple/Google login and universal links, APNs/FCM delivery + logout token
isolation, paid-registration/COD/bank-transfer flows with genuine state,
offline score recovery, VoiceOver/large-text journeys, locale deep links and
draft restore. Record device/OS/build/date/results before NATIVE-1 closes.
App Store upload/privacy and real buyer/seller validation remain separate gates.

## Current-main parity audit — 20/11/2026

Read-only comparison after `git fetch origin main`. No reset, stash, checkout,
source write or test rerun was performed. Working-tree status scoped to apple
was clean, so tested tracked native source matches local HEAD.

- Tested local HEAD: `f74724368456c110fd01e3a38da9d53d02567a70`.
- Fetched remote main: `156a61d70ad33d0561d02b07e184f1e0af91f5b8`.
- Local apple tree: `4d374bcc6c92474c5e7880fa78629f2719c3412a`.
- Remote apple tree: `d2830b6c7b44883a40fa9175f515958016a369a6`.

**Not source-equivalent:** four tracked native files differ. The simulator
results above must not be attributed to current main. Changes include new
QuickTable chat parsing/name-confirmation and player-versus-team behavior,
associated tests/view state, and rankings resource updates.

| Path | Tested/local Git blob | Current-main Git blob |
|---|---|---|
| apple/Tests/QuickTableChatEngineTests.swift | 8cc8476cebd5910e50a51bfc53662eda65018e8e | b2ea60d0908778db9c52a3c1badba1de8a2a4375 |
| apple/ThePickleHub/Core/QuickTable/QuickTableChatEngine.swift | ba63ff111ecd6ea9c8ebd39f06a349247a6a3678 | 62e5edd40e2a077667a4b5d5f9c9cbf9e769a836 |
| apple/ThePickleHub/Features/Bracket/QuickTableChatView.swift | b42c789ac48f276f6e162f566b860826bb55b8cf | 690e2a564a2fa2e055c366c46a9c515baf5a179c |
| apple/ThePickleHub/Resources/wpr-rankings.json | 550331fb22a537c9ee043ef114dc853cde5b6c0c | 75c13512c6dc939c92044a2e8da1796dadef8bc7 |

Recommended next action: export the fetched apple subtree to an isolated
temporary directory, inspect its build configuration/resources, and run the
QuickTableChatEngineTests plus a simulator build there. A full suite should
then confirm current-main native evidence if the focused tests pass. Preserve
the existing dirty web worktree; do not reset/stash it. Physical-device gates
remain unverified regardless of simulator success.

## Isolated fetched-main validation

Exported exact commit 156a61d70ad33d0561d02b07e184f1e0af91f5b8 using
git archive into /tmp/tph-native-main-156a61d7. The generated xcodeproj is ignored
in Git; generated it with xcodegen from the archived project.yml. Only ignored
Config/Secrets.xcconfig was copied after inspecting variable names without
printing values, with file permissions 0600. No source/config values entered
this report. Existing dirty checkout was not reset, stashed or overwritten.

Commands from archived apple directory:

- xcodegen generate
- xcodebuild test -project ThePickleHub.xcodeproj -scheme ThePickleHub
  -destination 'platform=iOS Simulator,id=5A44903A-DF46-4016-9903-33CBF05FD3F5'
  -derivedDataPath /tmp/tph-native-main-derived CODE_SIGNING_ALLOWED=NO

Result: TEST SUCCEEDED. Swift Testing **298 tests / 49 suites passed**;
XCTest additionally reported **16 tests, 0 failures**. This validates the four
listed fetched-main native deltas, including the added chat-engine test cases.
Temporary log: /tmp/tph-native-main-tests.log. The first attempted command
failed before compilation because the ignored project was not generated;
the successful run above followed project generation.

Unsigned Release build of the same isolated export also **BUILD SUCCEEDED**:
xcodebuild build -project ThePickleHub.xcodeproj -scheme ThePickleHub
-configuration Release -destination 'generic/platform=iOS Simulator'
-derivedDataPath /tmp/tph-native-main-derived CODE_SIGNING_ALLOWED=NO.
Log: /tmp/tph-native-main-release.log. No signing, upload, physical-device
execution, production transactions or push sends occurred. These results are
pinned to the fetched SHA above; later main changes need their own delta review.

## Physical-device availability — 21 November 2026 (Vietnam)

Read-only devicectl inventory returned nine registered device entries; all
reported disconnected. No connected physical device was available for the
required task checks. No device names or identifiers are included here, and
no pairing, installation, signing or device mutation was attempted. This does
not establish physical-device acceptance or replace the simulator evidence.
