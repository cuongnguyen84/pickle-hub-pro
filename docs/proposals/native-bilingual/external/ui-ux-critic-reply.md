I’ll review only the specified brief, then answer its eight questions in markdown with element-level fixes.

# 1. No in-app language control

**Verdict: Blocker.** Following the iPhone language alone is wrong for this audience. A Vietnamese user with an English-language phone would receive the secondary product experience by default.

The smallest acceptable fix is an app-level two-option selector:

- Add **“Ngôn ngữ / Language”** near the top of Profile/Settings.
- Options: **“Tiếng Việt”** and **“English”**.
- Default new installations to **Tiếng Việt**, independent of the device language.
- Persist the choice with `@AppStorage`.
- Apply the selected locale at the app root with `.environment(\.locale, selectedLocale)`.
- Pass the same locale explicitly to formatters and any `String(localized:)` calls.
- Update the interface immediately; do not require relaunching.

A row that merely opens iOS Settings does not fix the default-language problem and is not sufficient.

The app should not expose both an effective in-app preference and an apparently independent iOS per-app language preference. Document the in-app preference as authoritative, or include a third **“Follow Device”** option if system-language behavior must remain available.

# 2. Source-language strings as catalog keys

**Verdict: Blocker. Use symbolic keys from the first migration pass.**

Literal Vietnamese keys fail whenever identical source text needs different English output. String Catalogs consolidate the same key, so translating one occurrence changes every occurrence sharing that literal.

Concrete examples:

- `Thêm` cannot represent both **“Add”** and **“More”**.
- A generic `Sân` key cannot safely grow to cover court finders, assigned courts, venue references, streaming courts, or future editorial uses.
- Translator comments explain context but do not allow two English translations for one catalog key.
- Editing translations per occurrence is therefore impossible without changing the source key later.

Use contextual keys during the initial 151-file migration, for example:

| Symbolic key | VI | EN |
|---|---|---|
| `social.tab.courts` | Sân | Courts |
| `tournament.tab.courts` | Sân | Courts |
| `home.section.highlights` | Sân đấu. | Highlights |
| `court.number` | Sân %lld | Court %lld |
| `venue.surface.hard` | Sân cứng | Hard court |
| `live.courtCount` | %lld sân | %lld live court / %lld live courts |
| `common.action.add` | Thêm | Add |
| `common.navigation.more` | Thêm | More |

Use a resource with a stable key, Vietnamese default, and context:

```swift
LocalizedStringResource(
    "social.tab.courts",
    defaultValue: "Sân",
    comment: "Social hub tab that opens the court finder"
)
```

Do not first extract Vietnamese literals and re-key them later; that would require touching the same call sites twice.

Also fix the logic-bearing enum before localization:

```swift
enum Mode {
    case random
    case manual

    var title: LocalizedStringResource {
        switch self {
        case .random:
            "team.mode.random"
        case .manual:
            "team.mode.manual"
        }
    }
}
```

`"Ngẫu nhiên"` and `"Thủ công"` must not remain raw values used for identity, persistence, comparison, or decoding.

Finally, make project generation declare both `vi` and `en` in the project’s known regions while retaining Vietnamese as the development language. Do not rely on manually editing the generated Xcode project.

# 3. Layout

## `TLSegmented`

The named English labels do not demonstrate a current 390pt failure:

- `Trực tiếp / Phát lại / Video` → `Live / Replays / Video` is shorter.
- `Sân / Xé vé / CLB` → `Courts / Tickets / Club` still fits three segments.
- `Theo dõi / Cộng đồng {count}` → `Following / Community {count}` is slightly wider but should fit a two-segment control.

Profile and Matchmaking labels were not provided, so no break can be asserted for them.

The reusable component should nevertheless prevent a future English label from wrapping into a two-line capsule. Put these modifiers directly on `Text(label(option))` in `TLSegmented.swift`:

```swift
Text(label(option))
    .lineLimit(1)
    .minimumScaleFactor(0.80)
    .allowsTightening(true)
    .frame(maxWidth: .infinity)
    .padding(.vertical, 9)
```

Do not reduce the outer 18–22pt padding globally based on the supplied translations.

## Home toolbar and DUPR chip

`DUPR · Connect` is not materially longer than `DUPR · Kết nối`, so this is not an English-only break. The modifier combination is still defective: the child’s horizontal `fixedSize` prevents the call site’s negative layout priority from making it yield space.

In `DuprHeaderChip.swift`, remove:

```swift
.fixedSize(horizontal: true, vertical: false)
```

Keep one line and permit controlled compression:

```swift
.lineLimit(1)
.minimumScaleFactor(0.80)
.allowsTightening(true)
```

The icon-only toolbar items require no visual localization; their accessibility labels do.

## Bottom tab bar

No fix. Every supplied English label is shorter:

- Home
- Live
- Social
- Feed
- Tools

## Standings table

No width change is required:

- `Player` goes in the existing flexible column.
- `W` and `P` fit the existing 30pt columns.
- `+/–` remains within 44pt.

Use full VoiceOver labels—**“Player,” “Wins,” “Played,” “Point differential”**—instead of making the visible headers wider.

## Global `minimumScaleFactor` count

Having only three current uses is not itself a defect. Do not mechanically add scaling to 151 views. Add it only to constrained, single-line elements such as `TLSegmented` and the DUPR chip, then test all screens at 390pt and Accessibility text sizes.

# 4. English terminology

| VI element | Required EN | Fix |
|---|---|---|
| `Chia bảng` action | **Create pools** or **Draw groups** | Do not map it globally. Use “Create pools” when creating round-robin pools; use “Draw groups” when allocating players. |
| `Chia bảng` format name | **Round Robin** | Use only when it names the competition format. |
| `Quick Bracket` / `Create Brackets` for `Chia bảng` | Incorrect | “Bracket” implies elimination structure, not pool allocation. |
| `Vòng bảng` | **Group Stage** | Keep. |
| `Loại kép` | **Double Elimination** | Replace “Doubles Elimination” everywhere. The latter incorrectly sounds like elimination restricted to doubles teams. |
| `Đồng đội (MLP)` | **MLP Team Match** | Clearer and more natural than “Team Match (MLP).” |
| `Giao lưu` for rotating drop-in play | **Open Play** | Use this for court sessions where players rotate in. |
| `Giao lưu` for an organized social event | **Social** | Keep only when the event is genuinely social rather than drop-in play. |
| `BTC` | **Organizer** | Use “Awaiting organizer approval,” “Organizer actions,” and “Organizer notes.” Do not invent an English three-letter abbreviation. |
| `VĐV` | **Player** | The column is flexible, so use the full word. VoiceOver must also say “Player.” |
| `CLB` | **Club** | Four letters fit where three did; do not retain `CLB` in English. |
| Social `Sân` tab | **Courts** | Court/venue finder. |
| Tournament `Sân` tab | **Courts** | Current-round court assignments. |
| Home `Sân đấu.` section | **Highlights** | Do not translate this editorial heading as “Courts.” |
| `Sân {courtID}` | **Court {courtID}** | Add number pluralization only where a count is involved, not for the court identifier. |
| `Sân cứng` | **Hard court** | Surface type. |
| `{n} sân` in Live | **{n} live court(s)** | Use catalog plural variants. |
| `Trận` | **Match** | A match is the overall contest. |
| `Ván` | **Game** | A game is one unit within a match. |
| `Xé vé` | **Tickets** | Acceptable if the feature actually represents purchasable or redeemable tickets. Do not carry the Vietnamese idiom into English. |
| `Đơn / Đôi` | **Singles / Doubles** | Keep. |
| `T / TR / +/–` | **W / P / +/–** | Keep visually; expand each term for accessibility. |

# 5. Dates, numbers, currency, and timezone

## Dates

Remove all 14 `Locale(identifier: "vi_VN")` assignments. Every formatter must receive the selected app locale:

- Vietnamese: `vi_VN`
- English: `en_US`

Replace fixed `dateFormat` strings with `Date.FormatStyle` components so ordering, weekday names, month names, and punctuation are localized.

Examples:

```swift
// Social: weekday, day/month, time
date.formatted(
    .dateTime
        .weekday(.abbreviated)
        .day()
        .month(.twoDigits)
        .hour()
        .minute()
        .locale(appLocale)
        .timeZone(eventTimeZone)
)
```

```swift
// Team match: full weekday and date
date.formatted(
    .dateTime
        .weekday(.wide)
        .day()
        .month()
        .year()
        .locale(appLocale)
        .timeZone(eventTimeZone)
)
```

```swift
// Weekday-only labels
date.formatted(
    .dateTime
        .weekday(.abbreviated)
        .locale(appLocale)
        .timeZone(eventTimeZone)
)
```

Do not preserve `"EEE, dd/MM · HH:mm"` or `"EEE dd.MM"` as fixed templates in both languages.

## Hardcoded weekday map

Delete:

```swift
["mon": "Thứ 2", ..., "sun": "Chủ nhật"]
```

Convert the server weekday token to a weekday index or weekday enum, then obtain its display name from the selected locale’s calendar/weekday symbols. The stored value remains `mon`, `tue`, and so on; only its label is localized.

## Relative time

Replace the manual `"vừa xong"`, minutes, hours, and days branches with localized relative formatting:

```swift
date.formatted(
    .relative(
        presentation: .named,
        unitsStyle: .wide
    )
    .locale(appLocale)
)
```

Use the localized absolute-date style for the older-date fallback. This supplies outputs such as “now,” “5 minutes ago,” and their Vietnamese equivalents without concatenating translated fragments.

## Counts and pluralization

Move all approximately 36 count-bearing strings into catalog plural variants. For example, `live.courtCount` needs:

- Vietnamese: `%lld sân`
- English one: `%lld live court`
- English other: `%lld live courts`

Apply the same treatment to teams, players, matches, clubs, notifications, and community counts.

## Numbers

Delete both manually assigned grouping separators. Use one locale-aware number style:

```swift
value.formatted(
    .number
        .grouping(.automatic)
        .locale(appLocale)
)
```

Expected results:

- Vietnamese: `80.000`
- English: `80,000`

Do not carry the Home formatter’s comma or Social formatter’s period across locales.

## Currency

Replace every `"\(amount) đ"` and `"…đ"` construction with:

```swift
amount.formatted(
    .currency(code: "VND")
        .locale(appLocale)
)
```

This standardizes on the real dong symbol `₫`, localizes grouping and symbol placement, and removes string concatenation. Put surrounding copy such as **“per person”** in the catalog, not inside the numeric formatter.

## Timezone

Store event timestamps as an instant plus the event timezone identifier. Vietnamese court events should normally carry `Asia/Ho_Chi_Minh`.

Format using the event timezone. If the viewer’s current timezone differs, show a short suffix such as:

- `19:00 ICT`
- `19:00 Vietnam time`

Do not silently display an overseas viewer’s device-local time as though it were the court’s start time.

# 6. Accessibility

All 47 `.accessibilityLabel` literals are part of the localization surface and must use symbolic catalog keys.

If the visible UI is English but a date formatter emits `Th 4`, `Thứ Tư`, or `thg 7`, VoiceOver will generally read those Vietnamese fragments using the English voice and English phonetics. The result can be unintelligible and may convey the wrong date. Fix the formatter locale; translating only the surrounding accessibility label does not solve it.

Specific fixes:

- Localize `TLLoadingView`’s **“Đang tải”** as **“Loading.”**
- Localize icon-only toolbar labels for trophy, chart, search, notifications, and profile.
- Expand compact visual abbreviations in accessibility labels:
  - `W` → “Wins”
  - `P` → “Played”
  - `+/–` → “Point differential”
  - visible organizer abbreviations, if retained in Vietnamese, → “Ban tổ chức”
- Use catalog plural variants so VoiceOver says “1 court” rather than “1 courts.”
- Keep player, club, and venue names unchanged; they are proper nouns.
- When an intentionally Vietnamese phrase appears inside an English screen, isolate it as its own accessibility element and apply Vietnamese speech language to that element or attributed range. Do not mark the whole English screen as Vietnamese.
- Test with both Vietnamese and English VoiceOver voices, not only visual language switching.

# 7. App name and App Store localization

Keep **ThePickleHub** unchanged in both languages. It is the product name, not interface copy. The literal `CFBundleDisplayName` is acceptable.

Before submission, create separate Vietnamese and English App Store localizations:

| Metadata | Required treatment |
|---|---|
| App name | `ThePickleHub` in both locales |
| Subtitle | Write independently for each locale; do not mechanically translate a character-limited Vietnamese subtitle |
| Keywords | Research and enter locale-specific search phrases; do not copy one keyword list into both locales |
| Description | Vietnamese-first value proposition for local players; separate English description for foreign players and pro-tour followers |
| Promotional text | Localize separately if used |
| Screenshots | Capture the actual Vietnamese UI for the Vietnamese listing and actual English UI for the English listing |
| Screenshot captions | Localize; do not place English captions over Vietnamese screens or vice versa |

Make Vietnamese the primary App Store locale. Because the app has not been published, this is the right time to establish both metadata sets and avoid inheriting a Vietnamese-only listing.

# 8. Priority ranking

## Blockers

| Finding | Required action |
|---|---|
| English-device users default to the secondary language | Add the in-app selector and default new installs to Vietnamese |
| Literal Vietnamese strings used as catalog keys | Introduce contextual symbolic keys in the initial migration |
| `Mode` stores localized copy as logic-bearing raw values | Replace raw-value identity with language-neutral cases and localized display properties |
| Project does not explicitly declare both localizations | Add `vi` and `en` to generated project known regions |
| `Loại kép` translated as “Doubles Elimination” | Change to “Double Elimination” everywhere |
| Vietnamese-pinned dates appear in English UI and VoiceOver | Replace all pinned formatters with selected-locale format styles |
| Hardcoded weekday map | Replace it with locale-derived weekday names |
| Conflicting hardcoded thousands separators | Use the selected locale’s number formatter |
| Hardcoded `đ` currency strings | Use VND currency formatting and `₫` |
| Count strings lack plural variants | Add String Catalog plural rules for all count-bearing strings |
| Accessibility labels remain Vietnamese in English UI | Localize all 47 labels and shared state labels |
| Tests assert Vietnamese presentation text | Assert language-neutral error identity, or explicitly run localized-output assertions once per locale |

## Should-fix

| Finding | Required action |
|---|---|
| DUPR chip cannot compress despite negative layout priority | Remove horizontal `fixedSize`; add `minimumScaleFactor(0.80)` and tightening |
| Segmented labels can wrap in future translations | Add one-line, tightening, and 0.80 scaling to `Text(label(option))` |
| `Chia bảng` has three inconsistent web translations | Split it into contextual keys: “Create pools,” “Draw groups,” or “Round Robin” |
| `Giao lưu` is translated globally | Use “Open Play” for rotating drop-in sessions and “Social” for social events |
| BTC/VĐV/CLB rely on Vietnamese-width abbreviations | Use “Organizer,” “Player,” and “Club”; adapt the label rather than inventing English abbreviations |
| Match/game terminology may collapse | Enforce `Trận` → “Match” and `Ván` → “Game” |
| Timezone behavior is undefined | Store the event timezone and label Vietnam time for overseas viewers |
| Mixed-language VoiceOver output | Apply speech-language metadata only to intentional foreign-language elements |
| No offline-specific state despite court/mobile-data use | Add a localized offline state using the existing state-view structure, with “You’re offline” and “Try again” |
| One or two very large PRs are difficult to validate | Separate localization infrastructure/logic decoupling from screen-string migration, while still introducing final symbolic keys on the first touch |
| App Store listing would otherwise be Vietnamese-only | Prepare Vietnamese and English metadata and real localized screenshots before submission |

## Nits or no change needed

| Finding | Decision |
|---|---|
| `ThePickleHub` app name | Keep untranslated |
| English bottom-tab labels | No layout work; all supplied labels are shorter |
| Standings column widths | No visual width change required |
| `Vòng bảng` → “Group Stage” | Keep |
| `Đơn / Đôi` → “Singles / Doubles” | Keep |
| `T / TR / +/–` → `W / P / +/–` | Keep visually; only accessibility expansion is needed |
| Only three existing `minimumScaleFactor` uses | Not independently a defect; do not add scaling indiscriminately |
| Vietnamese development language | Keep `vi`; the problem is literal key identity, not Vietnamese being the source language |