# GPT-5.6 reply — UI/UX review, ppa-rankings-tab

- Model: `gpt-5.6-terra`, OpenAI Responses API, reasoning effort `medium`, 2026-08-06.
- Note: `scripts/agents/ask-model.mjs` referenced in the reviewer workflow does not exist in this repo; the call was made directly against the API with the same system prompt.
- Prompt sent: `ui-ux-gpt56-prompt.md` (same directory), verbatim.

---

1. **PPA Tour should not replace Việt Nam as the default.**

   The current Việt Nam board is weak: 12 doubles players, 4 singles players, raw usernames, and missing cities make it look unfinished. That is real counter-evidence, and it means the current default needs work.

   But changing `/rankings` from “Vietnamese recreational-player rankings” to “American-dominated pro-tour points” solves the visual density problem by changing the product’s meaning. For the 95% Vietnamese audience, the likely first question is still “Ai đang đứng đầu ở Việt Nam?”—not “Who is #67 on the PPA Tour?”

   PPA Tour should be a clearly available **separate ranking source**, not a replacement for the local default. It has legitimate value:
   - Vietnamese-recognisable players: Jonathan Truong, HT Hien Truong, Luc Pham, Alix Truong.
   - A fuller pro leaderboard.
   - A dedicated SEO page for PPA/WPR searches.
   - Useful “watch pro pickleball” content adjacent to livestream/replay.

   **Correct fix for the weak Việt Nam default:**
   - Keep `/rankings` and `/vi/rankings` defaulting to `scope=vn&format=doubles`.
   - Change the Vietnam panel head from just `Việt Nam · Đôi · Top 12` to **`Việt Nam · Đôi — 12 VĐV đã liên kết DUPR`**. This makes the small population explicit rather than accidentally looking broken.
   - Add a visible data-quality CTA directly below the Vietnam table: **`Kết nối DUPR và hoàn tất hồ sơ để xuất hiện trong bảng Việt Nam →`**.
   - Require or prompt for a proper display name and city in the “link DUPR” flow. The ranking should not lead with `CM11` and `trungnguyen0706` as if those are editorially curated athlete identities.
   - For missing cities, render `—`, not a blank cell in desktop layouts.
   - Do not invent density by blending PPA pros into a DUPR Vietnam board.
   - Create a dedicated PPA route, such as `/rankings/ppa-tour` and `/vi/rankings/ppa-tour`, with its own title, metadata, canonical URL, SSR content, and source disclosure.

2. **Do not add “PPA Tour” as a ninth pill in the existing scope selector. It is not a scope; it is a different ranking source and metric.**

   On a 390px viewport, replace the current three wrapped scope rows with this structure:

   **Row 1 — ranking source, full-width segmented control, 44px high**
   ```text
   BẢNG XẾP HẠNG
   [ DUPR                 ] [ PPA Tour             ]
   ```

   - This is the top-level switch.
   - Use two equal-width controls, minimum `44px` height.
   - Default selection: `DUPR`.
   - `PPA Tour` must not sit beside `Việt Nam`, `Châu Á`, and `Châu Âu`; those are geographical filters while PPA is a source.

   **When DUPR is selected:**

   **Row 2 — geographic scope, one horizontal scroll rail**
   ```text
   PHẠM VI
   [Việt Nam] [Toàn cầu] [Châu Á] [Bắc Mỹ] [Nam Mỹ] [Châu Âu] [Úc & Châu Đại Dương]
   ```

   - Do not wrap this row into multiple lines.
   - Make it horizontally scrollable with `scroll-snap-type: x proximity`.
   - Keep the active chip fully visible after selection.
   - Each chip has a `44px` minimum touch target.

   **Row 3 — category, only where applicable**
   ```text
   HẠNG MỤC
   [Mở rộng] [Trẻ]
   ```

   If “Mở rộng” and “Trẻ” are genuinely ranking divisions rather than scopes, they belong here—not under `TOÀN CẦU`.

   **Row 4 — format**
   ```text
   NỘI DUNG
   Việt Nam: [Đôi (12)] [Đơn (4)]
   Toàn cầu/khu vực: [Đơn nam (25)] [Đơn nữ (25)] [Đôi nam (25)] [Đôi nữ (25)]
   ```

   **When PPA Tour is selected:**

   Replace DUPR category/format controls with the source’s actual available choices:

   ```text
   BẢNG XẾP HẠNG
   [ DUPR                 ] [ PPA Tour             ]

   BẢNG PPA TOUR
   [Nam] [Nữ]

   KHU VỰC
   [Tất cả] [Mỹ] [Châu Á] [Úc] [Châu Âu] [Canada] [Khác]
   ```

   Do **not** show `Đơn nam`, `Đôi nam`, `Đôi nữ`, or `Đôi nam nữ` for PPA Tour. Those boards do not exist on the stated source page.

3. **For PPA Tour, show a compact three-column WPR table, not a fake tournament-stat table.**

   The exact table columns should be:

   | Column | Mobile | Notes |
   |---|---:|---|
   | `#` | visible | Rank, mono, fixed narrow width |
   | `VĐV` | visible | Player name, primary column |
   | `Điểm WPR` | visible | Right-aligned, mono, green accent |

   Do not add country, city, DUPR, age, discipline, or nationality. The source does not provide those values for this ranking table.

   **Row design**
   - Minimum row height: `48px`.
   - Rank column: approximately `32px`.
   - Player name: allow two lines only if necessary; otherwise truncate with an accessible full-name label.
   - Points: right aligned, `font-variant-numeric: tabular-nums`.
   - Make the whole player-name cell a profile/search link only if ThePickleHub has a real corresponding player page. Do not create misleading local player profiles for scraped PPA names.

   **Depth and loading**
   - Server-render and show the first **50** rows.
   - Below row 50, use one full-width button: **`Tải thêm 50 VĐV`**.
   - Each activation loads another 50 rows.
   - Do not initially render 100 rows on mobile. Fifty rows is already a long courtside scroll, and the source itself is paginated at 50.
   - Preserve scroll position after loading; do not refocus the page top.
   - Announce the result through a polite live region: **`Đã tải thêm 50 VĐV. Đang hiển thị 100 VĐV.`**

   **Number formatting**
   Convert source numbers to Vietnamese locale formatting before display:

   ```text
   Source: 19,295      Display: 19.295 điểm
   Source: 12,212.5    Display: 12.212,5 điểm
   ```

   Do not display raw source notation such as `12,212.5`; Vietnamese users will parse that incorrectly.

   **Attribution placement**
   In the PPA panel head, use:

   ```text
   PPA Tour · Nam · Top 50                 Nguồn: PPA Tour · WPR
   ```

   On narrow mobile widths, stack it:

   ```text
   PPA Tour · Nam · Top 50
   Nguồn: PPA Tour · WPR
   ```

   Then place the fuller legal/editorial disclosure in the existing attribution box below the table. The panel-head source label is enough to be visible without becoming a banner.

   Before shipping a scraper, verify PPA Tour’s terms, rate limits, attribution requirements, and whether republishing ranking data is permitted. The UI must show the actual retrieval timestamp, not imply live official synchronization.

4. **Changing the URL-less default is a high-severity continuity and SEO problem.**

   `/rankings` currently means “Vietnam DUPR rankings” to:
   - Existing bookmarks.
   - Facebook shares.
   - In-app saved links.
   - Search result visitors.
   - Bots that have indexed the existing Vietnam SSR page.

   If that same URL starts opening PPA rankings, a user clicking a Google result titled **“Bảng xếp hạng DUPR Pickleball Việt Nam”** can land on Ben Johns and Anna Leigh Waters. That is a direct title/content mismatch and damages trust immediately.

   The existing pathname-only prerender cache makes this worse: `?scope=ppa` and `?scope=vn` already receive identical bot HTML. Do not build new SEO behavior on that implementation.

   **Required mitigation: preserve the legacy route meaning.**
   - Keep `/rankings` and `/vi/rankings` as Vietnam DUPR landing pages.
   - Add `/rankings/ppa-tour` and `/vi/rankings/ppa-tour` for PPA Tour.
   - Give PPA its own server-rendered title, for example:
     ```text
     Bảng xếp hạng PPA Tour WPR Nam & Nữ | ThePickleHub
     ```
   - Use a canonical URL matching the rendered route.
   - Server-render the actual selected PPA board on the PPA route.
   - Do not rely on `?scope=ppa` as the canonical SEO landing page.
   - If query-based filtering remains, include normalized query parameters in the SSR/cache key, or return a canonical URL that removes unsupported query values.
   - Ensure the client does not `history.replace` a user’s valid PPA route back to a generic `/rankings` URL.

   If the owner insists on changing `/rankings` to PPA, there is no reliable way to distinguish an old URL-less Vietnam bookmark from a new intended PPA visit. That is exactly why the old route must remain Vietnam.

5. **Minimum accessibility fix: make each selector a labeled single-choice control, increase every target to 44px, and make the long table navigable.**

   **Scope/source/format controls**
   Plain `<button>` elements are not automatically wrong, but the current implementation lacks the selection semantics needed for mutually exclusive choices.

   Use native radio inputs styled as chips:

   ```html
   <fieldset>
     <legend>Bảng xếp hạng</legend>
     <input type="radio" id="source-dupr" name="source" checked>
     <label for="source-dupr">DUPR</label>

     <input type="radio" id="source-ppa" name="source">
     <label for="source-ppa">PPA Tour</label>
   </fieldset>
   ```

   Apply the same pattern separately to:
   - `PHẠM VI`
   - `HẠNG MỤC`
   - `NỘI DUNG`
   - PPA `BẢNG PPA TOUR`
   - PPA `KHU VỰC`

   This is preferable to a `tablist` because these controls change filter state and URL state; they are not merely tabs exposing static sibling panels.

   If retaining `<button>`s temporarily, the minimum is:
   - Wrap each group in a labeled container.
   - Add `aria-pressed="true|false"` to every selectable pill.
   - Use a roving tabindex model for arrow-key navigation.
   - Announce the resulting table update.

   **Touch target**
   Every selectable chip and the “load more” button needs:
   ```css
   min-height: 44px;
   min-width: 44px;
   padding-inline: 12px;
   ```
   The current `26–28px` pills are not acceptable. Do not solve this with invisible overlapping hit areas; make the actual control box 44px tall.

   **Long table**
   - Keep a semantic `<table>`, with `<th scope="col">`.
   - Add a visible or screen-reader table caption, for example: `Bảng xếp hạng PPA Tour WPR Nam`.
   - Make the table container `aria-busy="true"` while loading more results.
   - Add a polite live region after the load-more button for loaded-result announcements.
   - Add a skip link immediately before a 100+ row table: **`Bỏ qua bảng xếp hạng`**, targeting the content after the table.
   - Do not virtualize rows in a way that makes screen-reader users unable to access the full loaded result set.
   - Ensure player links have at least a 44px-high interactive area, normally achieved by the 48px table row.

6. **Vietnamese strings**

   **Top-level source selector**
   ```text
   BẢNG XẾP HẠNG
   DUPR
   PPA Tour
   ```

   **DUPR scope selector**
   ```text
   PHẠM VI
   Việt Nam
   Toàn cầu
   Châu Á
   Bắc Mỹ
   Nam Mỹ
   Châu Âu
   Úc & Châu Đại Dương
   ```

   **DUPR category selector**
   ```text
   HẠNG MỤC
   Mở rộng
   Trẻ
   ```

   **DUPR format selector**
   ```text
   NỘI DUNG
   Đôi (12)
   Đơn (4)

   Đơn nam (25)
   Đơn nữ (25)
   Đôi nam (25)
   Đôi nữ (25)
   ```

   **PPA selectors**
   ```text
   BẢNG PPA TOUR
   Nam
   Nữ

   KHU VỰC
   Tất cả
   Mỹ
   Châu Á
   Úc
   Châu Âu
   Canada
   Khác
   ```

   **Vietnam panel head**
   ```text
   Việt Nam · Đôi — 12 VĐV đã liên kết DUPR
   Nguồn: ThePickleHub · DUPR
   ```

   **PPA panel head**
   ```text
   PPA Tour · Nam · Top 50
   Nguồn: PPA Tour · WPR
   ```

   **PPA column labels**
   ```text
   #
   VĐV
   Điểm WPR
   ```

   **PPA attribution/disclaimer**
   ```text
   Dữ liệu WPR do PPA Tour công bố. ThePickleHub thu thập và hiển thị lại dữ liệu này, không phải đối tác hoặc kênh chính thức của PPA Tour. Điểm được định dạng theo tiếng Việt.
   ```

   **Vietnam empty state**
   ```text
   Chưa có VĐV đủ điều kiện trong bảng này.
   Kết nối DUPR và hoàn tất hồ sơ để được xét vào bảng xếp hạng Việt Nam.
   ```

   **PPA loading state**
   ```text
   Đang tải bảng xếp hạng PPA Tour…
   ```

   **Load-more button and confirmation**
   ```text
   Tải thêm 50 VĐV
   Đã tải thêm 50 VĐV. Đang hiển thị 100 VĐV.
   ```

   **PPA error state**
   ```text
   Không tải được dữ liệu PPA Tour lúc này.
   Thử lại
   ```

   **Stale-data state, if the scraper’s last successful fetch is old**
   ```text
   Dữ liệu PPA Tour chưa được cập nhật. Lần đồng bộ gần nhất: 20 thg 7, 2026, 14:30.
   ```

**DO NOT SHIP AS PROPOSED.**
