<!-- model: gpt-5.6-terra · reasoning effort high · 14464 tokens -->

## 1. Tab-bar placement at 390px

Place the `[DUPR | WPR]` navigation **between the H1 and the intro paragraph** on both pages.

Do not put it where the current scope pills are. At that position it will still be below a full screen of editorial content and read as another filter, not as the primary choice between two ranking systems.

### Page A exact changes

1. **Delete the breadcrumb row**  
   Delete `TRANG CHỦ / BẢNG XẾP HẠNG` entirely on `/rankings`.

   It costs vertical space without helping Facebook deep-link visitors. The sticky header already provides the app-level wayfinding.

2. **Shorten the H1 from three lines to two**
   Replace:

   > Ai đang *đứng top.*  
   > *Toàn cầu,* tính theo DUPR.

   with:

   > Ai đang *đứng top* theo DUPR?

   This must be capped at two lines at 390px.

3. **Insert the 48px ranking-system navigation immediately after the H1**
   Approximate Page A vertical sequence:

   | y | element |
   |---|---|
   | 76 | `◆ DUPR · CẬP NHẬT 20 THG 7, 2026` |
   | 100–163 | H1 |
   | 176–224 | `[ DUPR | WPR ]` navigation |
   | 240–278 | short intro |
   | 294–338 | scope rail |
   | 360–408 | rankings panel toolbar, including Đôi/Đơn |
   | 420–450 | table header |
   | ~450 | first ranking row |

   This puts rank `#01` inside the first viewport, with roughly 5–6 rows visible before the bottom navigation.

4. **Replace the current four-line DUPR paragraph with a two-line summary**
   Ship:

   > **DUPR là rating toàn cầu, cập nhật từ kết quả giải đấu.**

   Then place the longer explanation and source wording behind a disclosure below the table:

   > `DUPR được tính thế nào?`

   Do not spend four lines explaining “sanctioned” before users can see any ranking data.

5. **Delete the `PRO` group and `PPA Tour ↗` pill from Page A**
   The new WPR navigation item replaces this job. Keeping both creates duplicate paths to the same page and makes WPR look like a sub-filter of DUPR.

6. **Remove the three full-width group-label rows**
   Delete the separate full-width `QUỐC GIA`, `TOÀN CẦU`, and `CHÂU LỤC` rows. Replace them with one compact scope rail; details are in section 3.

7. **Move `Đôi 12 | Đơn 12` into the rankings panel header**
   It should not sit as a detached third pill row above the table.

### Page B accompanying cleanup

Use the same tab position: immediately below the H1.

Also delete the Page B breadcrumb and collapse the current five-line WPR-formula paragraph. Replace it above the search field with:

> **WPR xếp hạng nhà nghề PPA Tour theo 52 tuần gần nhất.**

Put the 50% / 35% / 15% explanation in:

> `WPR được tính thế nào?`

below the table or in an expandable details block. The search expectation message needs the scarce upper-page space more than the formula does.

---

## 2. Tab labels

Bare `DUPR` and `WPR` are not enough. A Vietnamese recreational player can reasonably assume both are simply “điểm xếp hạng pickleball.”

Use a two-line tab label: acronym on line one, plain-language meaning on line two.

### Vietnamese

| Tab | Line 1 | Line 2 |
|---|---|---|
| DUPR | `DUPR` | `Rating cá nhân` |
| WPR | `WPR` | `BXH nhà nghề PPA` |

### English

| Tab | Line 1 | Line 2 |
|---|---|---|
| DUPR | `DUPR` | `Personal rating` |
| WPR | `WPR` | `PPA Tour ranking` |

Do not use “Xếp hạng DUPR” for the first label. DUPR is primarily meaningful to club players as a personal rating, while WPR is a professional leaderboard. The distinction needs to be explicit in the tab itself.

### Tab geometry

- One connected 2-column control, not two independent pills.
- Outer width: full content width, about `358px` at 390px viewport.
- Height: `48px`.
- Each tab: about `175px`.
- Outer radius: `12px`.
- One 1px border around the container and one 1px divider between items.
- Acronym: Geist Mono, `10–11px`, uppercase, letterspaced.
- Sub-caption: Geist Sans, `11px`, normal tracking.
- Active item: black fill, cream text.
- Inactive item: cream background, black text.

This is intentionally more substantial than the page filters.

---

## 3. Make the three control levels distinct

Do not render all three levels as black-active rounded pills. They represent different jobs.

### Tier 1: ranking-system navigation — DUPR / WPR

**Purpose:** changes URL and ranking system.

**Visual treatment:**

- Full-width, connected two-item control.
- `48px` tall.
- Two-line labels.
- Black-filled active state.
- Sits directly under H1.
- Looks like page-level navigation, not a filter.

This is the only control that should carry the large, high-contrast black active area.

---

### Tier 2 on Page A: scope — Việt Nam / global / continent

**Purpose:** chooses the geographic or board scope within DUPR.

Replace the current three labelled pill groups with one row:

```text
PHẠM VI   [Việt Nam] [TG · Mở] [TG · Trẻ] [Châu Á] [Bắc Mỹ] ...
```

English:

```text
SCOPE   [Vietnam] [World · Open] [World · Youth] [Asia] [North America] ...
```

### Exact layout

- One `40px`-high row.
- Left fixed label:
  - Vietnamese: `PHẠM VI`
  - English: `SCOPE`
  - Geist Mono, `10px`, width around `62px`.
- Right side: horizontally scrollable rail.
- Visual chip height: `30px`; actual tap target must be at least `44px` high.
- No black filled active pill.
- Active item: black text plus a `2px` green bottom rule.
- Inactive item: muted black at roughly 60–65% opacity.
- No wrapping. The rail scrolls horizontally.
- Add a right-edge fade only when additional scope options are off-screen.

Use the contextual global labels exactly as below so users do not mistake “Mở” and “Trẻ” for Vietnam-specific divisions:

- `Việt Nam`
- `TG · Mở`
- `TG · Trẻ`
- `Châu Á`
- `Bắc Mỹ`
- `Nam Mỹ`
- `Úc / Châu Đại Dương`
- `Châu Âu`

This removes about 100–130px of vertical waste from Page A.

---

### Tier 3 on Page A: format — Đôi / Đơn

**Purpose:** changes the table format only.

Place it inside the rankings panel header, not as a standalone filter row.

Example:

```text
DUPR · Việt Nam                    [Đôi 12 | Đơn 12]
```

- Label on the left: `DUPR · Việt Nam`.
- Right-side format switch: `32px` high.
- Use a small connected segmented control, not loose pills.
- Active segment: black fill.
- Inactive segment: cream background with border.
- Keep the count in the segment because this is an excerpt:
  - `Đôi 12`
  - `Đơn 12`

English:

- `Doubles 12`
- `Singles 12`

The format control is now visually subordinate because it is physically attached to the table it changes.

---

### Tier 2 on Page B: Nam / Nữ board

On Page B, the board picker is table-local, like Page A’s format picker.

Use:

```text
BẢNG WPR                         [Nam · Top 25 | Nữ · Top 25]
```

English:

```text
WPR BOARD                   [Men · Top 25 | Women · Top 25]
```

- Same `32px` connected segmented control as Page A’s format switch.
- Do not use the current isolated `Nam 25` / `Nữ 25` rounded pills.
- Keep it in the panel header when the search field is empty.
- When a search query is present, replace this panel header with:
  - Vietnamese: `KẾT QUẢ TÌM KIẾM`
  - English: `SEARCH RESULTS`

That prevents the user from thinking the selected Men/Women board is still limiting the search result set.

---

## 4. Search behavior and honest copy

### Search scope

Do not present the field as a search of WPR generally. It is a search of a 50-player excerpt.

Search should match across **all 50 curated rows**: Top 25 Men plus Top 25 Women, regardless of which board was being browsed before typing.

That means:

- Empty search: show the currently selected Men or Women board.
- Non-empty search: search all 50 rows.
- Search results: add a visible `BẢNG` / `BOARD` tag per row: `NAM` or `NỮ`.
- Do not silently search only the currently selected men’s board. A user who types a woman’s name while Men is selected should not receive a misleading zero-result state when that player is included in the Women excerpt.

The small Vietnamese/Vietnamese-origin highlight table should not silently be included if it contains players outside these 50 records. The search scope copy must match the actual indexed data.

### Before the user types: expectation-setting copy

Place this directly above the input, below the visible label.

**Vietnamese:**

> **Tìm trong 50 VĐV ở đây (Top 25 Nam + Top 25 Nữ), không phải toàn bộ BXH WPR.**

**English:**

> **Searches this 50-player selection (Men’s Top 25 + Women’s Top 25), not the full WPR rankings.**

This sentence is required. Do not wait until the user gets a zero-result state to disclose that the app is not searching the full board.

### Visible search label

**Vietnamese:**

> `TÌM VĐV WPR`

**English:**

> `SEARCH WPR PLAYERS`

### Input placeholder

**Vietnamese:**

> `Tìm tên trong 50 VĐV`

**English:**

> `Search names in this 50-player selection`

### Result-count line

When no query is entered and the Men board is displayed:

**Vietnamese:**

> `Đang xem 25/25 VĐV Nam trong phần trích dẫn.`

**English:**

> `Showing 25 of 25 men’s players in this selection.`

When there is a query:

**Vietnamese:**

> `{{count}} kết quả trong 50 VĐV được chọn.`

**English:**

> `{{count}} result{{plural}} in this 50-player selection.`

Examples:

- `1 kết quả trong 50 VĐV được chọn.`
- `0 kết quả trong 50 VĐV được chọn.`

### No-match state

Do not say “Không tìm thấy VĐV” by itself.

**Vietnamese:**

> **Không có kết quả trong 50 VĐV được chọn.**  
> VĐV này có thể có trong BXH WPR đầy đủ nhưng chưa xuất hiện trong phần trích dẫn của chúng tôi.  
> `Mở BXH WPR chính thức ↗`

**English:**

> **No match in this 50-player selection.**  
> This player may appear in the full WPR rankings but is not included in our excerpt.  
> `Open official WPR rankings ↗`

The external CTA should lead to the source’s official board, not to another internal page.

### Filter interaction

Use an **instant in-memory filter**, not a debounce, because the list has only 50 rows.

Implementation details:

- Filter after each completed input change.
- Do not filter during IME composition; wait for `compositionend`.
- Match case-insensitively.
- Match diacritic-insensitively where relevant.
- Search normalized player-name strings only; do not make users type exact punctuation or accents.

### If the full 2,075-player data becomes permitted and available

Only do this after permission and through a server-side, cached proxy. Do not bundle the full list into client JavaScript just to satisfy search.

When full data is available:

1. Preserve the **original source rank numbers**.
2. Never renumber filtered rows to `01`, `02`, `03`.
3. Show the original rank in the `#` column.
4. Keep the board/gender label visible in global search results because Men’s #1 and Women’s #1 can both exist.
5. Search across both men’s and women’s boards for non-empty queries, as above.
6. Update the helper copy to:

   **Vietnamese:**
   > `Tìm trong toàn bộ BXH WPR hiện có.`

   **English:**
   > `Searches the full available WPR rankings.`

---

## 5. Accessibility

### Navigation semantics

Use a `<nav>`, not `role="tablist"`.

These items navigate to different URLs:

- `/rankings`
- `/rankings/ppa-tour`

They are page navigation, not two panels within one document. `role="tab"` implies in-page panel switching and brings keyboard expectations that do not match URL navigation.

Use this structure:

```html
<nav aria-label="Loại bảng xếp hạng">
  <a href="/rankings" aria-current="page">...</a>
  <a href="/rankings/ppa-tour">...</a>
</nav>
```

English locale:

```html
<nav aria-label="Ranking type">
```

Only the current link gets `aria-current="page"`.

### Search field labelling

A placeholder is not a label.

Use a visible `<label>`:

```html
<label for="wpr-player-search">TÌM VĐV WPR</label>
<input
  id="wpr-player-search"
  type="search"
  aria-describedby="wpr-search-scope"
  enterkeyhint="search"
>
<p id="wpr-search-scope">
  Tìm trong 50 VĐV ở đây...
</p>
```

The visible label supplies the field name; `aria-describedby` supplies the important limitation.

If there is a clear button, label it:

- Vietnamese: `Xóa tìm kiếm`
- English: `Clear search`

### Result count announcements

Use a separate status element:

```html
<p
  id="wpr-search-status"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  4 kết quả trong 50 VĐV được chọn.
</p>
```

Do not announce immediately on every keypress.

Behavior:

- Update the visual result list instantly.
- Announce the result count only after about `350–400ms` without typing.
- Do not announce again if the count and search state have not changed.
- Announce the zero-result state after the same delay.
- Announce the restored board count when the user clears the query.

This gives screen-reader users feedback without reading “49 results, 12 results, 3 results…” during a single name entry.

---

## 6. Mobile keyboard and floating-action fix

### Search layout behavior

The search field should stay near the top of the usable viewport while typing, not at the bottom.

On input focus:

1. Add a `.keyboard-open` state using Capacitor Keyboard events.  
   Use `window.visualViewport` as a web fallback when the visual viewport drops by more than roughly `150px`.

2. Make the search block sticky only while the keyboard is open:

```css
.keyboard-open .wpr-search-block {
  position: sticky;
  top: calc(59px + env(safe-area-inset-top));
  z-index: 20;
  background: var(--paper);
  border-bottom: 1px solid var(--line);
}
```

The sticky block contains:

- `TÌM VĐV WPR`
- the scope disclosure
- input
- result count

3. After keyboard open, scroll the search block to just below the sticky header:

```js
searchBlock.scrollIntoView({ block: 'start', behavior: 'instant' });
```

4. Keep the table in normal document flow below it. Do not make the table itself a fixed panel.

5. Make the table header sticky below the search block while typing:

```css
.keyboard-open .wpr-table thead {
  position: sticky;
  top: calc(59px + var(--wpr-search-block-height));
  z-index: 10;
}
```

At a roughly 426px visible viewport height, the user will still see the input, result count, table header, and about two result rows without manually dismissing the keyboard.

### Bottom tab bar while keyboard is open

The fixed bottom tab bar must not consume the already reduced visual viewport.

When `.keyboard-open` is active:

```css
.keyboard-open .bottom-tab-bar {
  transform: translateY(120%);
  pointer-events: none;
}
```

Restore it when the keyboard closes.

In the Capacitor shell, configure keyboard resize so the document/visual viewport responds to the keyboard instead of allowing the keyboard to overlay the body without layout change.

### Chat buttons: fix the existing table collision

The two 56px Messenger/Zalo floating circles cannot remain over ranking tables. They already cover the WPR points column; adding search does not make that acceptable.

On `/rankings` and `/rankings/ppa-tour`:

- Remove the two fixed circular chat buttons from the ranking screen.
- Replace them with one `44px` header action:
  - Vietnamese: `Trợ giúp`
  - English: `Help`
- That action opens a bottom sheet containing:
  - `Messenger`
  - `Zalo`

While the keyboard is open, the help entry is not shown as an overlay. The sticky header remains usable, but no floating element may sit over the search results or the `ĐIỂM WPR` column.

This fixes both the current clipped points values and the keyboard-era thumb-zone collision.