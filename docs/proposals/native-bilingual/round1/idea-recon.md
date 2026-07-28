# idea-recon — native-bilingual (nguyên văn output, 28/07)

## Prior art
This is genuinely 0% built for native — no `.xcstrings`, no `.lproj`, no `NSLocalizedString` call anywhere in `apple/` or the legacy `ios/` Capacitor tree. Web (`src/i18n/`) is the only bilingual precedent in this repo.

- `apple/project.yml:13` — `DEVELOPMENT_LANGUAGE: vi` (single language, no `knownRegions`/`CFBundleLocalizations` block anywhere in the file)
- `apple/project.yml:50` — `SWIFT_EMIT_LOC_STRINGS: "YES"` (only loc-adjacent setting present)
- `apple/ThePickleHub/App/Info.plist` — no `CFBundleLocalizations` key; also **zero** `*UsageDescription` keys (camera/photo/notification) exist at all today, localized or not
- Memory claim correction: project.yml has `SWIFT_VERSION: "5.0"` (line 11, comment says "flip to 6 in a later phase") and **no** `SWIFT_TREAT_WARNINGS_AS_ERRORS` key anywhere in the file — that memory note is stale/wrong.
- `docs/proposals/web-native-parity-port/round1/ui-ux-critic.md:182-259` — a VI/EN copy table for ~7 screens only (Login, DUPR connect, Push pre-permission, Tournaments list/detail, Invite member, Slots, Match detail/share). Explicitly says native today is VI-only. Not a spec for the other ~190 files.

## Touch surface (likely)
- `apple/ThePickleHub/**/*.swift` — 199 files total, **151 contain hardcoded VI text** (grep for diacritics)
- `apple/project.yml` — needs `knownRegions`/localization config to add `.xcstrings` as a build resource; xcodegen installed here is 2.45.4
- `apple/ThePickleHub/App/Info.plist` — app display name + (currently absent) permission strings
- `apple/Tests/UserFacingErrorTests.swift:8,13-14` and `apple/Tests/TournamentMutationErrorTests.swift:11,18` — **assert VI error strings verbatim**, will break the moment those strings move into a catalog/get translated
- `apple/ThePickleHub/Features/Bracket/TeamMatchDetailView.swift:1366` — `enum Mode: String { case random = "Ngẫu nhiên", manual = "Thủ công" }` — VI text is the enum's `rawValue`, i.e. logic-bearing, not just display (translating it without separating display-from-value breaks whatever compares/persists this rawValue)

## String surface, counted (grep, not estimate)
| Pattern | Count |
|---|---|
| `Text("...")` literals | 640 |
| `Button("...")` | 129 |
| `Label("...")` | 73 |
| `.navigationTitle("...")` | 77 |
| `.accessibilityLabel("...")` | 47 |
| `String(format: ...)` (interpolated/formatted) | 41 |
| `.alert("...")` | 16 |
| `NSLocalizedString` (existing usage) | 0 |
| enums with `case x = "VI text"` as rawValue | 3 (2 are English `SINGLES`/`DOUBLES` API values, 1 is the VI `Mode` above) |
| Non-VI-but-English `case x = "word"` style rawValues | 133 `enum X: String` declarations total in codebase — not all individually audited for display-use, only the 3 with quoted literal text were greppable this way |

## Data
Not a Supabase-schema task — no tables/RPCs involved. Only client-side string surface + Xcode project config.

## Binding constraints found
- `apple/project.yml:11` — `SWIFT_VERSION: "5.0"` (comment: "flip to 6 in a later phase") — contradicts memory note claiming Swift 6 is already set.
- No CLAUDE.md section covers native localization at all (CLAUDE.md's bilingual rules are all web-blog-specific: EN+VI blog checklist, `BLOG_POST_META`, hreflang — none apply to native).
- `docs/proposals/.../ui-ux-critic.md:245-251` — flags a tone/register bug on web (`"Anh…"` gendered/age-coded address) already confirmed absent from native; explicit note "native /apple has zero 'Anh' strings" — copy is neutral today, a constraint on what NOT to introduce during EN authoring.

## Test coverage today
19 Swift test files in `apple/Tests/`. Two directly assert VI string literals as pass/fail conditions (`UserFacingErrorTests`, `TournamentMutationErrorTests`) — these are the known break points once strings route through a catalog. The other VI-containing test files matched by grep only have VI in **comments**, not assertions (`DeepLinkTests`, `QuickTableSeedingV2Tests`, `MatchmakingTests`, `DraftStoreTests`, `TLComponentsRenderTests`) — false positives, not a gap. No test anywhere exercises locale switching (none exists to test).

## Unknowns worth asking Cuong
- None blocking.
