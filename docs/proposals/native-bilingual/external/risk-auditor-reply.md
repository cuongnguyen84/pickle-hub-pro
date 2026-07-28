## Verdict

**This causes no production failure today.** The `apple/` target is undistributed and uses `net.thepicklehub.app.dev`. Neither the Cloudflare website nor the shipped Capacitor app consumes this code. App Store users will see no change.

If the intent is to ship this SwiftUI app later, however, **the proposed one-batch conversion is not low-risk**. Several concrete failures are waiting in the English path.

## What actually breaks when the native app is shipped

| Site | Mechanism and trigger | User-visible symptom | Classification |
|---|---|---|---|
| Account deletion | The prompt is automatically translated, but validation still compares against literal `"XOÁ"`. If English says “Enter DELETE,” typing `DELETE` never satisfies the guard. | The destructive button remains disabled; English users cannot delete their account. | **Real functional failure** |
| Registration reset | Control flow parses localized presentation text using `hasPrefix("Đăng ký thành công")`. If the producer is translated but this comparison is not—or the two copies later diverge—the success branch does not run. | Registration succeeds, but partner and team-name fields remain populated, encouraging duplicate or stale submissions. | **Real functional failure, conditional on translation divergence** |
| Default team name | Localizing `"Đội"` before POSTing freezes the writer’s UI language into shared database content. | A nameless team created by an English client appears as `"Team"` on the Vietnamese website. If left untranslated, it appears as `"Đội"` on the English website. | **Real persistent cross-product data defect** |
| `Mode.rawValue` | `rawValue` is a plain `String`; `Text($0.rawValue)` does no lookup. | English mode picker still shows `Ngẫu nhiên` / `Thủ công`. | Cosmetic |
| Custom components | Their arguments are `String`, and `Text(title)` with a runtime `String` is verbatim. They are not covered by automatic extraction. | English screens contain Vietnamese buttons, placeholders, empty states, labels, and possibly VoiceOver text. | Mostly cosmetic/accessibility, but certain unless fixed |
| `scheduleToText()` | It is exported content, not merely UI chrome. Leaving it alone gives English users Vietnamese clipboard text; blindly localizing it makes an English schedule for an organizer whose Zalo audience may still be Vietnamese. | Organizer pastes the wrong-language schedule for the recipients. | Real output/product-semantics defect |
| Vietnamese-string tests | The test process resolves explicit localizations according to its language, often English once the catalog exists. | CLI tests fail or become host-language-dependent. | Delivery failure, not a production incident |

For registration, explicitly localizing the exact same key at both producer and consumer would happen to preserve the prefix check. That does not make the design acceptable. Copy edits must not control state. Use a success enum/flag/result and derive the localized message from it.

For deletion, either keep `XOÁ` as a documented invariant token in both languages or derive the displayed and validated token from one shared value. Do not independently translate the prompt and the comparison.

For the team name, the proper fix is not choosing between `"Đội"` and `"Team"`. Store `nil`, a generated-name flag, or canonical domain data, then render the fallback in the viewer’s locale. A localized placeholder must not cross the RPC boundary.

## The 790/976 split makes the estimate indefensible

The 790 `LocalizedStringKey` sites are the easy portion. Extraction gives you catalog entries; it does not write or review the English translation.

The 976 plain strings require semantic classification:

1. Static UI copy that should become localized.
2. Dynamic user/server content that must remain verbatim.
3. Model display labels that need an explicit localized resource.
4. Control-flow strings that must be replaced with typed state.
5. API/database values that must remain canonical.
6. Clipboard/share output requiring an explicit audience-language policy.
7. Whole sentences currently assembled from fragments and needing restructuring.

Three to five half-days is roughly 12–20 hours. For 1,766 literals, that allows about **24–41 seconds per literal**, with no time left for code changes, translation review, dual-language testing, or database-boundary auditing. The estimate is fantasy.

Do not “fix” the design system by changing every `String` to `LocalizedStringKey`. If a component sometimes receives server or user content, that would treat dynamic content as a catalog key. A user-created title equal to a catalog key such as `"Đăng nhập"` could render as `"Sign in"`. Provide separate localized and verbatim APIs.

Split the work by behavior or feature, not into one or two repository-wide diffs:

- localization infrastructure and component APIs;
- static UI feature batches;
- model labels and formatted messages;
- control-flow refactors;
- database/share boundary audit;
- VI and EN test passes.

## Additional failure modes

### String Catalog extraction

Your measured behavior is correct:

- The 790 statically typed localized positions extract.
- The 976 plain strings do not magically localize because `SWIFT_EMIT_LOC_STRINGS=YES`.
- Dynamic keys such as `LocalizedStringKey(title)` may perform a runtime lookup, but the extractor cannot discover all possible values.
- Missing English translations fall back to the Vietnamese source key. They do not crash; they produce mixed-language screens.
- No physical `vi.lproj` is not a defect here. Vietnamese is the development language and source fallback.

Vietnamese source text also acts as the key for the automatically extracted cases. Two identical Vietnamese strings with different meanings share one English translation unless you introduce semantic keys or separate entries. A word such as `"Đơn"` can require different English translations depending on whether it means singles, an application, or an order.

### Plural and grammatical agreement

String Catalogs support plural variants, but they do not infer good English from Vietnamese fragments.

For example, independently translating:

- count;
- `"người"`;
- a prefix or suffix;

cannot produce reliable `"1 player"` versus `"2 players"` or allow English word-order changes. Build one interpolated semantic message and provide English plural variants. The same applies to grammatical agreement: the catalog does not repair sentences assembled with concatenation, ternaries, or localized fragments.

### Per-app language behavior

The observed bundle configuration is sound. English and Vietnamese will appear in the per-app language picker, and bundle localization will follow that choice.

It does **not**:

- translate existing database rows;
- localize server/user strings passed to `Text(String)`;
- choose the right language for Zalo recipients;
- migrate previously persisted localized values.

Because there is no in-app switch, hot language switching is not a major concern; iOS normally relaunches the app around a Settings language change. Still, values localized once and then persisted remain in the old language.

### Distribution mismatch

Under the current bundle identifier, this project cannot replace App Store app `net.thepicklehub.app`; it is a separate app identity. If the bundle ID is later changed to ship it as the update, the iOS 17 deployment target also means iOS 15–16 users remain on the old compatible Capacitor version. That is outside this localization change, but it invalidates any assumption that this PR itself makes the existing App Store product bilingual.

## Ranked risks for a future native release

1. **Localized presentation strings used as state or protocol:** deletion token and registration prefix checks. Functional breakage under English.
2. **Localized strings written to shared storage:** known `"Đội"` fallback. Durable wrong-language data visible on the website.
3. **The 976-string coverage gap:** certain mixed VI/EN UI if approached as automatic extraction.
4. **Fragmented sentences, plurals, and context collisions:** grammatically wrong or semantically incorrect English.
5. **Wrong-language exported schedules:** app UI language is not necessarily recipient language.
6. **Tests asserting localized prose:** blocks or destabilizes CI, but does not directly affect users.
7. **`Mode.rawValue`:** cosmetic only.

**Bottom line:** safe for the currently live product because this code is not shipped. **Not low-risk as a future release plan.** The catalog infrastructure is fine; the blanket one-batch conversion and estimate are not.
