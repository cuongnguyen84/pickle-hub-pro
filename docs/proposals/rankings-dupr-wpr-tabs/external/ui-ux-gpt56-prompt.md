# UI/UX review brief — two-tab rankings navigation + player search

## The product

A bilingual (Vietnamese-primary, English-secondary) pickleball web app. Roughly 95% of
visitors read Vietnamese. Traffic is mobile-dominant on mid-tier Android over 4G;
there is also a Capacitor native shell wrapping the same web pages. Users usually
arrive from a Facebook link straight onto one deep page — they do not browse the IA.

Design language ("The Line"): cream/paper light theme, thin 1px borders, an
Instrument Serif italic display face mixed with a Geist sans in headlines, Geist Mono
uppercase micro-labels with wide letterspacing, rounded pill controls, no shadows,
minimal color (one green accent). Tokens are CSS variables. Reference viewport for
this review: **390 × 853 CSS px**, with a **sticky top header (~59px)** and a
**fixed bottom tab bar (~88px)**, so the usable first-screen window is roughly
**59px → 765px = ~706px tall**.

## The two pages today

### Page A — `/rankings` (Vietnamese default). Measured vertical layout at 390px:

| y (CSS px) | element |
|---|---|
| 59 | (bottom of sticky header) |
| 88 | breadcrumb: `TRANG CHỦ / BẢNG XẾP HẠNG` |
| 125 | mono kicker: `◆ DUPR · CẬP NHẬT 20 THG 7, 2026` |
| 145–240 | H1, 3 lines, serif+sans mix: "Ai đang *đứng top.* / *Toàn cầu,* tính theo DUPR." |
| 262–355 | intro paragraph, 4 lines: "DUPR (Dynamic Universal Pickleball Rating) là chuẩn rating toàn cầu — cập nhật theo kết quả các giải đấu sanctioned. Snapshot này lấy từ trang chính thức DUPR." |
| 385 | horizontal rule |
| 417–465 | mono label `QUỐC GIA` on its own full-width line, then one pill: `Việt Nam` (active, black fill) |
| 482–527 | mono label `TOÀN CẦU` on its own line, then pills: `Hạng mở`, `Trẻ` |
| 546–630 | mono label `CHÂU LỤC` on its own line, then 5 pills wrapping onto 2 rows: `Châu Á`, `Bắc Mỹ`, `Nam Mỹ`, `Úc / Châu Đại Dương`, `Châu Âu` |
| 650–695 | mono label `PRO` on its own line, then one pill-shaped link: `PPA Tour ↗` (this navigates to page B) |
| 730–760 | format pills: `Đôi 12` (active), `Đơn 12` |
| ~775 | top of the rankings table — **below the fold** |

Result: **zero ranking rows are visible on first paint.** The user must scroll a full
screen to see rank #1. The mono group labels each consume a full-width line of their
own on mobile. The scope pills are ~28px tall (12px text, 5px/10px padding).

### Page B — `/rankings/ppa-tour` (the "WPR" page, currently unreleased). At 390px:

| y | element |
|---|---|
| 88 | breadcrumb `TRANG CHỦ / BẢNG XẾP HẠNG / PPA TOUR` |
| 125 | kicker `◆ PPA TOUR · WPR · SỐ LIỆU LẤY NGÀY 6 THG 8, 2026` |
| 145–210 | H1, 2 lines: "Ai đang *đứng đầu* / *thế giới* nhà nghề." |
| 235–340 | intro paragraph, 5 lines explaining the WPR formula (doubles 50%, mixed 35%, singles 15%, trailing 52 weeks) |
| 400–430 | two pills: `Nam 25` (active), `Nữ 25` — these switch which board the table shows |
| 480–560 | panel head: "PPA Tour · Nam · Top 25" + "NGUỒN: PPA TOUR · WPR" |
| 590 | table header: `#` `VĐV` `ĐIỂM WPR` (a Country column is hidden on mobile) |
| 637+ | first row: `01  Ben Johns  19.295` |

Two floating circular chat buttons (Messenger, Zalo) are fixed at the bottom-right,
~56px each, stacked, sitting ~100px above the bottom tab bar. In the current
screenshot they **overlap and clip the right-hand points column** of table rows 2–3.

## What is being proposed

1. **A prominent two-item tab bar `[DUPR | WPR]` on BOTH pages.** The tabs are
   navigation between two different URLs (`/rankings` and `/rankings/ppa-tour`), not
   in-page panel switching. The owner's exact request was "show 2 tabs highlighted
   clearly" — he thinks the current small `PPA Tour ↗` pill buried at the bottom of the
   scope pills is far too weak. `/rankings` stays the default landing page.
2. **A player-name search box on the WPR page**, so users can look up any player the
   way the official source site allows.

## The hard constraints on search

- The WPR page currently ships a hand-curated **static excerpt: top 25 men + top 25
  women = 50 rows total**, plus a small "Vietnamese and Vietnamese-origin players"
  highlight table. It is deliberately an excerpt, not a mirror, for licensing reasons.
- The source's full board is **~2,075 players**, available as a **~503 KB JSON /
  ~67 KB gzipped** endpoint that sends **no CORS header** (so a browser cannot fetch it
  directly; it would need a server-side proxy).
- The app's total gzipped JS budget has roughly **69 KB of headroom left** and is
  CI-enforced. Bundling the full 2,075-player list would consume essentially all of it.
- Mirroring the full board may violate the source's terms; a permission request is
  unanswered.
- So the realistic near-term state is: **search runs over 50 rows**, while the user
  believes they are searching 2,000+.

## Questions to answer, specifically

1. **Placement of the tab bar at 390px.** Where exactly does it go — above the H1,
   between H1 and the intro paragraph, or where the scope pills are? It must read as
   "prominent" but the first screen is already 100% consumed before any data appears on
   page A. What do you cut or move to pay for it? Name the element to delete/relocate.
2. **Labels.** Are the bare strings "DUPR" and "WPR" meaningful to a Vietnamese
   recreational player? Context: DUPR is a personal skill rating a club player might
   have themselves; WPR is a world professional tour ranking published by PPA Tour.
   They are easy to confuse — both are "a pickleball ranking number". Propose exact
   Vietnamese and English tab labels (and any sub-caption), keeping in mind Vietnamese
   strings run ~30% longer than English and these must fit two tabs across 390px.
3. **Three stacked tiers of controls.** After the change, page A has: tier 1 = the
   DUPR|WPR tab bar (changes URL), tier 2 = scope pills (Việt Nam / Hạng mở / Trẻ /
   5 continents), tier 3 = format pills (Đôi / Đơn). Page B has tier 1 = the same tab
   bar, tier 2 = board pills (Nam / Nữ). Today tiers 2 and 3 are **visually identical
   rounded pills with a black-fill active state**. How do you make three nested control
   levels legible without a wall of pills? Be concrete about shape, size and position
   for each tier.
4. **Search behaviour and honest copy.** Give exact Vietnamese and English strings for:
   the input placeholder, the result-count line, and the no-match empty state. The empty
   state is the interesting one: saying "player not found" is a lie when the player
   exists in the source's full 2,075 but not in our 50-row excerpt. How do you word it,
   and — more importantly — how do you set the expectation *before* the user types so
   the empty state isn't a surprise? Also: instant filter or debounce, for a 50-row
   in-memory array? And if the full 2,075 list ever becomes available, how should the
   results table render (keep the source's original rank numbers, or renumber?), and
   should a search on the men's board also match women's-board players?
5. **Accessibility.** The tabs are `<a>` links that change the URL. Should they use
   `role="tablist"`/`role="tab"`/`aria-selected`, or a `<nav>` with `aria-current`?
   Justify. What labelling does the search input need beyond a placeholder? How should a
   screen reader learn the result count changed as the user types, without announcing on
   every keystroke?
6. **Mobile keyboard.** When the user taps the search field on a 390×853 screen, the
   on-screen keyboard takes roughly the bottom half and hides the results table. Give
   the concrete layout/behaviour fix. A fixed-bottom search bar is not viable (the
   keyboard covers it) and there is already a fixed bottom tab bar plus two floating
   chat buttons in the bottom-right thumb zone.

Answer each numbered question directly. Name the exact element and the exact fix,
including the literal Vietnamese strings you would ship. Skip generic design advice.
