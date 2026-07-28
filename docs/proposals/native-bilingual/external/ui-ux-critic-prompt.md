# Brief — UI/UX review of a VI→VI+EN localization plan for a native iOS app

You cannot see the repo. Everything you need is below. Be specific and concrete:
name the exact element and the exact fix. No generic design platitudes.

## Product

ThePickleHub — a pickleball platform for Vietnam. Web (React) is already bilingual
VI/EN. There is also a native iOS app (SwiftUI, ~199 Swift files, iOS 17+, portrait
phone only, `net.thepicklehub.app`). The native app is currently **100% Vietnamese
hardcoded** — zero `.xcstrings`, zero `NSLocalizedString`, zero `.lproj`. It is not
yet distributed on the App Store.

Audience: ~95% Vietnamese users, in Vietnam. Mid-tier phones, mobile data, used
one-handed while standing at a noisy outdoor court between games. English is a
secondary track (Asia pro-tour / PPA niche, foreign players living in Vietnam).

## The proposal being reviewed

Convert the native app from VI-only to bilingual VI+EN in one batch (~200 files,
estimated 3–5 half-days, 1–2 large PRs), using **Xcode String Catalogs**
(`.xcstrings`). Language selection follows **iOS Settings only** — iOS auto-adds a
per-app language picker in Settings once the app declares more than one localization.
**No in-app language toggle.** This was decided by the solo founder.

Current build config:
- `apple/project.yml:11` `SWIFT_VERSION: "5.0"`
- `apple/project.yml:13` `DEVELOPMENT_LANGUAGE: vi`  ← source language is Vietnamese
- `apple/project.yml:50` `SWIFT_EMIT_LOC_STRINGS: "YES"`
- No `knownRegions` key anywhere; `Info.plist` has no `CFBundleLocalizations`
- `Info.plist` `CFBundleDisplayName` = literal string `ThePickleHub`

Because `DEVELOPMENT_LANGUAGE` is `vi` and String Catalogs key on the **source
string literal**, the extracted key for every string will be the Vietnamese text
itself.

## String surface, counted by grep (not estimated)

| Pattern | Count |
|---|---|
| `Text("…")` literals | 640 |
| `Button("…")` | 129 |
| `Label("…")` | 73 |
| `.navigationTitle("…")` | 77 |
| `.accessibilityLabel("…")` | 47 |
| `String(format:)` | 41 |
| `.alert("…")` | 16 |
| Files containing hardcoded VI | 151 of 199 |
| Count-bearing interpolations like `"\(n) đội"` | ~36 |

## Vietnamese pickleball terminology in play (and current web EN translations)

VI is the source. The web's `src/i18n/en.ts` is proposed as the EN reference.

| VI (native) | Web EN today | Note |
|---|---|---|
| Chia bảng | "Round Robin" / "Quick Bracket" / "Create Brackets" | one VI term, three EN renderings on web |
| Vòng bảng | "Group Stage" | |
| Loại kép | "Doubles Elimination" (title) but "Double elimination" (description) | *"Loại kép" means **double elimination** (winners/losers bracket). "Doubles Elimination" reads in English as "elimination for doubles pairs" — a different thing.* |
| Đồng đội (MLP) | "Team Match (MLP)" | |
| Giao lưu | "social" / "Evening social" / "Inter-club social" | US pickleball more often says "open play" for drop-in rotating doubles |
| BTC (= Ban tổ chức, 3 letters) | "organizer" (9 letters) | appears ~15× in VI copy as the 3-char abbreviation, e.g. "Chờ BTC duyệt", "Hành động BTC", "Ghi chú BTC" |
| VĐV (= vận động viên, 3 letters) | "player" / "athlete" | used as a table column header at 30pt width |
| CLB (3) | "Club" (4) | |
| Sân | "Court" / "Courts" / "Venue" | **polysemous — see below** |
| Trận / Ván | "Match" / "Game" | |
| Xé vé | "Tickets" | idiomatic VI ("tear a ticket") |
| Đơn / Đôi | "Singles" / "Doubles" | |
| T / TR / +/– (standings column headers) | W / P / +/– | |

### The "Sân" collision (real, verified)

The identical literal `"Sân"` appears with different meanings in different screens:

- `SocialHubView.swift:12` — sub-tab of the Social hub = **venue/court finder** → EN "Courts"
- `QuickTableDetailView.swift:622` — segmented tab inside a tournament = **court assignments for the current round** → EN "Courts"
- `HomeVideosSection.swift:11` — editorial section header `"Sân đấu."` = **highlight videos** → EN cannot be "Courts."; it is an editorial section name
- `QuickTableModels.swift:132` — `"Sân \(courtID)"` = **Court 1, Court 2** (court number)
- `VenueModels.swift:129` — `"Sân cứng"` = **hard court** (playing surface type)
- `LiveView.swift:200` — `"\(streams.count + 1) sân"` = **N courts streaming**

Similarly `Text("Thêm")` appears 6× — some are "Add", the design intent of others
is unverified ("More"?).

## Concrete layout facts (390pt-wide phone, portrait only)

1. **Segmented control** `TLSegmented.swift:32`:
   `Text(label(option))` inside `.frame(maxWidth: .infinity).padding(.vertical, 9)`,
   font 13pt, no `.lineLimit`, no `.minimumScaleFactor`. Used in Live
   ("Trực tiếp" / "Phát lại" / "Video"), Social ("Sân" / "Xé vé" / "CLB"),
   Tournaments ("Theo dõi" / "Cộng đồng {count}"), Profile, Matchmaking.
   Whole control sits in a capsule with 18–22pt outer horizontal padding.

2. **Home toolbar** `AppTabView.swift:84-128` — one HStack: lime trophy pill,
   a chart icon, `Spacer`, a DUPR chip, `Spacer`, search icon, bell icon, avatar.
   Everything but the DUPR chip is icon-only, so only `accessibilityLabel`s are
   text. The DUPR chip (`DuprHeaderChip.swift:53-54`) is
   `.lineLimit(1).fixedSize(horizontal: true, vertical: false)` — it refuses to
   compress — while the call site adds `.layoutPriority(-1)` intending it to yield
   width first. Chip content when unlinked: `DUPR · Kết nối` → EN `DUPR · Connect`.

3. **Bottom tab bar** `AppTabView.swift:17-33`, 5 tabs:
   "Trang chủ" / "Trực tiếp" / "Social" / "Bảng tin" / "Công cụ"
   → EN "Home" / "Live" / "Social" / "Feed" / "Tools" (all shorter).

4. **Standings table** `QuickTableDetailView.swift:669-675` — fixed column widths:
   `#` 28pt, `VĐV` flexible, `T` 30pt, `TR` 30pt, `+/–` 44pt, font mono 9pt.

5. **Only 3 uses of `.minimumScaleFactor` in the whole app**
   (`FeedCardKit.swift:102`, `RefereeScoringView.swift:299,303`).
   151 uses of `.lineLimit`.

## Date / number / currency facts

- 14 places pin `Locale(identifier: "vi_VN")` on a `DateFormatter`, e.g.
  `SocialModels.swift:208-209` `dateFormat = "EEE, dd/MM · HH:mm"`,
  `TeamMatchModels.swift:62-63` `"EEEE, d/M/yyyy"`,
  `LiveComponents.swift:10` `"EEE dd.MM"`, `ClubDetailView.swift:307` `"EEE"`.
  These emit "Th 4", "Thứ Tư", "thg 7" and will stay Vietnamese even when the app
  runs in English.
- `VenueModels.swift:106-107` hardcodes a weekday map:
  `["mon": "Thứ 2", "tue": "Thứ 3", … "sun": "Chủ nhật"]`.
- `FeedFormat.swift:98-109` hand-rolls relative time:
  `"vừa xong"`, `"\(minutes) phút trước"`, `"\(hours) giờ trước"`,
  `"\(days) ngày trước"`, then falls back to `"d/M"`.
  No `RelativeDateTimeFormatter`.
- **Two different hardcoded thousands separators in the same app:**
  `HomeModels.swift:51-55` `groupingSeparator = ","` (renders `1,816`) vs
  `SocialModels.swift:53-57` `groupingSeparator = "."` (renders `80.000`).
  Vietnamese convention is `.`; English is `,`.
- Currency: native writes `"\(amount) đ"` / `"…đ"` in ~6 places; web EN writes
  `"{vnd}₫ per person"`. Two different dong symbols across surfaces.
- The app has no timezone handling notes; all users are in Asia/Ho_Chi_Minh today,
  but an EN track implies some users abroad.

## Copy register rule (already decided)

Vietnamese second-person must be **"bạn"** or the subject dropped entirely.
Never "Anh" (male + older, wrong for a mixed audience). The web has one
violation; the native app has zero — copy is already neutral. EN equivalent
is neutral "you".

## Existing shared state components (`TLStateViews.swift`)

- `TLLoadingView` — redacted skeleton rows, `.accessibilityLabel("Đang tải")`
- `TLEmptyState` — SF Symbol + title + optional subtitle + optional text CTA
- `TLErrorState` — same layout, default title `"Không tải được"`, CTA `"Thử lại"`

There is no offline-specific state in the native app today.

## Known test coupling

Two test files assert Vietnamese error strings verbatim:
`Tests/UserFacingErrorTests.swift:8,13-14` and
`Tests/TournamentMutationErrorTests.swift:11,18`.

One enum stores Vietnamese as its `rawValue`, i.e. the VI text is logic-bearing,
not just display: `TeamMatchDetailView.swift:1366`
`enum Mode: String { case random = "Ngẫu nhiên", manual = "Thủ công" }`.

---

## What I want from you

1. **The no-toggle decision.** Many Vietnamese users keep their iPhone in English
   as a status/habit thing while preferring Vietnamese content. With no in-app
   toggle they get an English app they may not want, and no way back without going
   to iOS Settings. Is following iOS Settings alone acceptable here, or is this a
   blocker for a 95%-Vietnamese audience? If it needs a fix, what is the smallest
   one? Be decisive — do not hedge.
2. **Source-language-as-key.** Given `DEVELOPMENT_LANGUAGE: vi` and the `"Sân"` /
   `"Thêm"` collisions, is keying String Catalogs on the VI literal workable, or
   must they move to symbolic keys? Name the concrete failure mode and the smallest
   fix that avoids re-touching 199 files twice.
3. **Layout.** Which of the 5 numbered layout facts above actually break in
   English, and what exact modifier goes where? Where VI→EN gets *shorter*, say so
   and skip it.
4. **English terminology.** Which of the web EN translations in the table are
   wrong or would confuse an English-speaking pickleball player, and what should
   they be instead? Include the abbreviation problem (BTC/VĐV/CLB have no short
   English equivalent).
5. **Dates, numbers, currency.** The exact replacement for each hardcoded case.
6. **Accessibility.** 47 `accessibilityLabel`s must be translated too. What is the
   VoiceOver failure mode if the UI is English but a formatter still emits
   Vietnamese, and what else about VoiceOver + mixed-language content should be
   handled?
7. **App name and App Store metadata.** Keep "ThePickleHub" untranslated? What
   about the App Store subtitle, keywords, description, and screenshots for two
   locales when the app is not yet published?
8. **Rank everything you find as Blocker / Should-fix / Nit.** Be willing to say
   parts of this plan are fine and need no work.
