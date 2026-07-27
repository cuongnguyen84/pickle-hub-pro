# ui-ux-critic — second opinion GPT-5.6 (nguyên văn)

- Ngày: 2026-07-27
- Model: `gpt-5.6-sol` (Codex CLI 0.145.0, `codex exec --model gpt-5.6-sol --sandbox read-only`)
- Lý do không dùng `scripts/agents/ask-model.mjs`: script đó KHÔNG tồn tại trong repo
  (xem memory `idea-pipeline-missing-scripts`). Thay bằng Codex CLI.
- Lưu ý: `--model gpt-5.6` bị từ chối ("not supported when using Codex with a ChatGPT
  account"); model khả dụng thực tế = `gpt-5.6-sol` (mặc định trong `~/.codex/config.toml`).
- Tokens used: 62,580

---

## PROMPT ĐÃ GỬI (nguyên văn)

````markdown
You are a senior product designer reviewing a mobile-first bilingual (Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and the exact fix. No generic design platitudes. You cannot see the repo — everything you need is below.

# Product context

ThePickleHub (thepicklehub.net) — a pickleball platform. ~95% of users are Vietnamese, Vietnamese is the primary language, English secondary. Mobile-dominant, mid-tier Android on 4G, plus a Capacitor native shell. Users typically arrive from a Facebook/Zalo link straight into a single deep page, not via site navigation. Typical moment of use: standing at a noisy court in Saigon, one hand, checking a result between games.

Design system is called "The Line" — dark-first, editorial. Relevant tokens:
- dark: --tl-bg #08090a, --tl-bg-elev #0f1012, --tl-fg #f5f3ee, --tl-fg-2 #c7c3bb, --tl-fg-3 #86837d, --tl-fg-4 #7c7973, --tl-green #b5e853 (optic lime, primary accent), --tl-green-dim #9ccc3f, --tl-gold #e9b649 (featured/editorial secondary), --tl-blue #4f9bff
- light mode: --tl-gold becomes #8a6410 (5.2:1 on cream), --tl-fg-4 #787366 (4.55:1)
- Typography: "Geist" sans body 15px, "Geist Mono" for all meta/labels/status pills (10–11.5px, uppercase, letter-spacing 0.04em), "Instrument Serif" italic for display headings and for the existing champion name treatment.
- The project has previously shipped a real WCAG failure (a gold-on-tint label at 3.7:1) so contrast is a live sore spot.

# The feature being reviewed

When an event finishes (status = completed), show the champion (winner) name in three places:
1. the event card in the list page /tournaments
2. the event detail page
3. the OG preview when the link is shared to Facebook/Zalo

Scope: three tournament formats — "quick_tables" (which contains BOTH format='round_robin' AND format='large_playoff'), "doubles_elimination", "flex". Doubles events must show both partner names; team events show the team name. If no champion can be determined, hide the line entirely.

# Exact current UI — list row (/tournaments, Community tab)

Each finished event is a CSS-grid row `.tl-bracket-row`:
- desktop grid: `auto 1fr auto auto` = [8px×24px colored accent bar] [body] [creator name, mono 11px, max-width 140px] [status pill]
- mobile (≤640px): grid becomes `auto 1fr auto` and the creator column is `display:none`
- body = `<h4 class="tl-br-name">` 15px/500 with `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`, then a one-line meta row `.tl-br-meta` in Geist Mono 11px color --tl-fg-3, content e.g. `Đôi · 12 người chơi · round_robin · 3 ngày trước` (unit · playercount · format · relative created time), separators are a `·` in --tl-fg-4.
- status pill `.tl-br-status.completed` = background --tl-surface, color --tl-fg-3, mono 10.5px uppercase, text "Đã kết thúc" / "Completed".
- Row padding is 14px 18px (14px on mobile), rows separated by a 1px --tl-border hairline. The whole row is one `<a>` link. There is no per-row button.
- The name and the meta line are BOTH single-line truncated today. The card is already dense.

# Exact current UI — FEATURED MULTI-EVENT card (the one the founder screenshotted)

A larger card, `variant="featured"`, dark elevated surface with a gold radial glow and a 2px gold top rule, 20px padding, 14px gap, contents in this vertical order:
1. optional banner image, 3:1 aspect
2. pill: sparkles icon + "GIẢI TỔNG NỔI BẬT" / "FEATURED MULTI-EVENT" — mono 9.5px uppercase, gold on rgba(233,182,73,0.1)
3. header button: a gold Trophy icon (lucide, 20px) + `<h3>` in Instrument Serif italic 22px, clamped to 2 lines. Example real title: "TPP Cúp Mùa Hè Rực Lửa 2026"
4. pill: "4 nội dung" / "4 events" — mono 10.5px uppercase gold
5. meta row: calendar icon + 26/07/2026, pin icon + venue name — mono 11px --tl-fg-3
6. hairline divider
7. sub-event list — up to N rows, each a button, 6px 8px padding, containing: a `◆` glyph in --tl-fg-4, the sub-event name at 13.5px/500 single-line-truncated, and a right-aligned status pill mono 10px uppercase. Real examples: "TPP - Đôi nữ 26/7" and "TPP - Đôi nam 26/7", both with a green "HOÀN THÀNH" / "COMPLETED" pill (background rgba(0,185,107,0.16), color --tl-green).
8. optional "+2 nội dung nữa" link
9. full-width CTA button "Xem giải đấu" with an arrow, gold border + gold text.

So the Trophy icon is ALREADY used at the card title, and the sub-event rows are ALREADY three-column (glyph / name / status pill) and already truncating names on a 390px viewport.

# Existing champion treatment in the app (detail page, playoff bracket tab only)

There is already a champion banner, but it is buried inside the bracket tab of 2 of the 4 formats. It is a full-width panel, 28px 24px padding, subtle green→transparent vertical gradient, centered, containing: a green Trophy icon 28px, then a mono 10.5px uppercase --tl-fg-3 label "VÔ ĐỊCH", then the name in Instrument Serif italic clamp(28px,4vw,40px) in --tl-fg. Nothing on the card list, nothing on the page header, nothing in the share preview.

# Data constraints (real, verified in code)

- There is NO denormalized champion column on any of the three tables. Champion must be derived per render from the child match rows (the final match's winner_id) or, for round robin, from standings columns on the player table (matches_won, points_for, point_diff).
- For doubles, the player row has `name`, `player1_name`, `player2_name`. So both names are available, and a combined `name` field exists.
- A cron job auto-archives tournaments to status='completed' after 14 days of inactivity, with NO check that the final was played. So "completed" does not imply "has a champion". A meaningful share of completed events will have no derivable champion.
- Round robin events have a `group_count` column and can have MULTIPLE groups. A multi-group round robin with no playoff has several group winners and no single champion.
- The multi-event parent card can only contain sub-events of the quick_tables type (the parent FK exists only on that table).
- The list page loads up to 100 completed events per format in one query and the current query does NOT fetch any match/winner data. Adding champion means either widening these queries or a second query per page load, on 4G.

# Share / OG reality (verified)

- The link people actually share, e.g. https://www.thepicklehub.net/tools/quick-tables/<share_id>, is server-rendered for bots by a Cloudflare Pages middleware. That renderer sets `robots: noindex, follow` and produces a plain meta description: "Bảng đấu {name} – {n} VĐV, {format}. Xem kết quả trực tiếp trên ThePickleHub."
- og:image for these pages is a STATIC site-wide PNG. There is no dynamic image renderer for these three formats. The app does have a Satori→PNG dynamic OG image generator, but only for one other route (match pages).
- The `<title>` is truncated at 60 UTF-8 BYTES. Vietnamese characters cost 2–3 bytes each, so ~20–28 Vietnamese characters is the whole title budget. A production bug from this exact byte-vs-character confusion shipped and was fixed last week.
- SSR output is cached in a KV store keyed by pathname; changing SSR output requires bumping a cache version.

# i18n strings that already exist

`quickTable.playoff.champion` = "Nhà vô địch" / "Champion"; `teamMatch.champion` = "Vô địch" / "Champion". Two different Vietnamese strings for the same concept in two namespaces.

# What I want from you

Critique the DESIGN, not the data plumbing. Specifically:

1. On a 390px-wide viewport, where exactly should the champion name go in the `.tl-bracket-row` list row, given the row already truncates the title and the meta line? Should it replace something? Give the exact layout.
2. Same question for the sub-event rows inside the featured multi-event card, which already have glyph + truncated name + status pill in one line at 13.5px. Does the champion go per sub-event, or aggregated at the card level, or both?
3. Vietnamese name-length reality: doubles means two full Vietnamese names, e.g. "Nguyễn Thị Thanh Hương & Trần Minh Quân" is 39 characters. How do you handle that on a 390px row? Truncate which part? Stack? Initials? Give a specific rule.
4. The Trophy icon is already used as the multi-event card's title icon. Is reusing 🏆/Trophy for champion a collision? What's the alternative mark?
5. Copy: propose the exact Vietnamese and English strings. Note that Vietnamese pickleball players say specific things — critique whether "Vô địch" is right for a round-robin top-of-table finisher vs a knockout-final winner, and whether a multi-group round robin should say something different ("Nhất bảng"?).
6. Contrast/a11y: the champion line will likely be gold or green on a dark elevated surface, and there is a light mode. What are the specific traps and the specific token choices? Is the champion name announced correctly to a screen reader if it is jammed into a mono meta line of `·`-separated fragments?
7. Empty/unknown state: an event is `completed` but no champion can be derived (auto-archived mid-tournament). Should the row show nothing, or something? What does a user think when two adjacent finished events show a champion and the third does not?
8. OG/share: given there is no dynamic image renderer for these formats and the title budget is ~25 Vietnamese characters, what is the highest-value change to the share preview? Is building a dynamic OG image worth it here, or is the description line enough?
9. Detail page: where on the event detail page should champion appear, given a champion banner already exists but is buried in a bracket tab?
10. Rank each of your findings as BLOCKER / SHOULD / NIT and say which ONE thing you would ship first if you only had one day.
````

---

## REPLY NHẬN VỀ (nguyên văn)

````markdown
The champion is a result, not metadata. Give it a dedicated block; when a result exists, it should replace the redundant completed pill. Never squeeze it into the existing `·`-separated meta line.

## 1. `.tl-bracket-row` on 390px — SHOULD

For completed events with a sole winner, use:

```text
[bar] TPP Cúp Mùa Hè Rực Lửa 2026
      [Crown] VÔ ĐỊCH   Nguyễn Thị Thanh Hương
                        & Trần Minh Quân
      Đôi · 12 VĐV · 3 ngày trước
```

Exact changes:

- Remove `.tl-br-status.completed` when a champion is shown. “Vô địch” is a more informative terminal state than “Đã kết thúc.”
- Keep the title single-line.
- Insert `.tl-br-result` between the title and `.tl-br-meta`.
- Let `.tl-br-result` span through the former status column: `grid-column: 2 / -1`.
- Inside it, use `grid-template-columns: auto minmax(0,1fr)`:
  - Left: 13px Crown icon + mono 10.5px label.
  - Right: 15px/18px Instrument Serif italic name.
- Shorten the mobile meta to `Đôi · 12 VĐV · 3 ngày trước`. Remove the raw `round_robin` fragment on mobile. On desktop, localize it as `Vòng tròn`, never expose the enum.

When no champion exists, preserve the current two-line row and completed pill. Do not reserve an empty champion line.

## 2. Featured multi-event card — BLOCKER

Show champions per sub-event only. Never aggregate them at parent-card level: the parent has four competitions, not one overall winner.

For a sub-event with a champion:

```text
◆  TPP - Đôi nữ 26/7
   VÔ ĐỊCH   Nguyễn Thị Thanh Hương
             & Trần Minh Quân
```

Exact changes:

- Remove the green `HOÀN THÀNH` pill when that sub-event has a champion.
- Keep the existing pill only for completed sub-events without a derivable result.
- First row remains glyph + sub-event name. With the status removed, the name gets the reclaimed width.
- Champion block goes on row two, `grid-column: 2 / -1`.
- Use 14px/18px for the champion name and a maximum of two name lines.
- Increase the sub-event button to `min-height:44px`; use 8px vertical padding. The current 6px padding plus one 13.5px line is too small for a reliable mobile tap target.
- Do not repeat champions below the entire sub-event list.

## 3. Vietnamese doubles names — BLOCKER

Do not initialize Vietnamese names. `N.T.T.Hương & T.M.Quân` is harder to recognize and can be ambiguous among players at the same club.

Do not clamp the combined pair as one string either; that can erase the second partner completely.

Use two independently truncated lines:

```text
Nguyễn Thị Thanh Hương
& Trần Minh Quân
```

Specific rule:

- Player 1: one line, end ellipsis.
- Player 2: one line beginning with `&`, end ellipsis.
- Each partner receives its own width budget, so both are always represented.
- Team name: allow two lines, end ellipsis only on line two.
- Single player: allow up to two lines.
- Detail page: do not truncate; wrap the complete result.

The supplied 39-character example should fit fully in the proposed list layout: approximately 260px remains for each partner after the result label.

## 4. Trophy collision — NIT

Yes, a second Trophy would create a semantic collision: the gold Trophy currently means “featured tournament,” not “winner.”

Reserve:

- Lucide `Trophy`: tournament or competition identity.
- Lucide `Crown`: winning result.

Use `Crown` at 13px in dense rows and 20–24px on the detail result panel. Set it `aria-hidden="true"`. Do not use the 🏆 emoji; its rendering varies across Android and the Capacitor shell.

## 5. Copy and outcome semantics — BLOCKER

Use one shared results namespace instead of the conflicting `Nhà vô địch` and `Vô địch` strings.

| Outcome | Vietnamese | English |
|---|---|---|
| Winner of a final/playoff | `Vô địch` | `Champion` |
| First place in one round-robin group, no playoff | `Nhất bảng` | `Group winner` |
| Winner of group A | `Nhất bảng A` | `Group A winner` |
| Multiple groups, no final | No event-level label | No event-level label |

“Vô địch” is correct when somebody won a knockout final or an explicitly defined championship. It overstates a standings-only result. Vietnamese players will understand “Nhất bảng” as the team/pair that topped that round-robin table.

For a multi-group round robin, show `Nhất bảng A`, `Nhất bảng B`, etc. inside each standings section only. Do not present any of them as the event champion.

Use sentence-case source strings and CSS uppercase. That gives screen readers `Vô địch`, not a character-by-character-looking DOM value.

I would also standardize the remaining terminal-status copy to `Đã kết thúc` / `Completed`; `Hoàn thành` sounds more like a completed task than a finished tournament.

## 6. Contrast and screen readers — BLOCKER

Use these component mappings:

```css
--tl-result-label: var(--tl-gold);
--tl-result-icon: var(--tl-gold);
--tl-result-name: var(--tl-fg);
```

Specific traps:

- Do not make the champion name green. `--tl-green` and `--tl-green-dim` are excellent on dark, but without light-mode overrides they are roughly 1.3–1.9:1 on cream.
- `--tl-fg-4` is about 4.39:1 on `--tl-bg-elev`; it fails for 10.5px text. Keep it for decorative diamonds and separators only.
- `--tl-gold` is safe for the small label: approximately 10.2:1 on the dark elevated surface, while its light mapping is already verified around 5.2:1.
- Keep the actual name in `--tl-fg`, not accent color.
- Do not put the label on a gold or green tint. The composited foreground/background pair must be tested; the raw token’s contrast against the page background does not prove contrast against a tinted chip.

The result must be a separate semantic element, not part of `.tl-br-meta`:

```html
<p class="tl-result">
  <Crown aria-hidden="true" />
  <span class="tl-result-label">Vô địch:</span>
  <span class="tl-result-name">…</span>
</p>
```

Keep the complete names in the DOM even when visually ellipsized. Hide decorative separators from assistive technology. Do not use `aria-live`; this is static page content.

## 7. Completed but no champion — BLOCKER

Show nothing champion-specific.

Do not show:

- `Chưa xác định`
- `Đang cập nhật`
- `—`
- An empty Crown
- A blank reserved line

Those treatments imply that a result is pending or that the interface failed to load it.

The adjacent-row behavior should be intentional:

- Result known: replace the completed pill with the champion block.
- Result unknown: retain `Đã kết thúc` and the existing compact row.

The user reads this correctly as “this event is closed, but no final result was recorded.” It is more honest than inventing an unresolved champion state.

## 8. OG/share — SHOULD

Do not put the champion in `<title>`. The event name already consumes the roughly 20–28-character Vietnamese budget.

Put the result first in both the regular and OG description:

- Knockout, VI: `Vô địch: {winner}. {event} · {participantSummary} · {format}. Xem kết quả trên ThePickleHub.`
- Standings, VI: `Nhất bảng: {winner}. {event} · {participantSummary} · Vòng tròn. Xem kết quả trên ThePickleHub.`
- Knockout, EN: `Champion: {winner}. {event} · {participantSummary} · {format}. View results on ThePickleHub.`
- Standings, EN: `Group winner: {winner}. {event} · {participantSummary} · Round robin. View results on ThePickleHub.`

Front-loading the result protects it when a share surface shortens the description. With no winner, use the existing generic description.

A dynamic OG image is worth a later iteration because sharing is a primary entry path, but it is not the first-day change. When built, use a 1200×630 result card with the label, full winner name wrapping to two lines, and the event title secondary. Until then, the description is a sufficient initial release.

## 9. Detail page — BLOCKER

Move the existing champion treatment out of the bracket tab. Do not duplicate it.

Place a shared `event-result` panel immediately after the event title/status identity block and before the tab navigation. That guarantees it is visible on a direct deep-link visit without selecting “Bracket.”

Mobile specification:

- Full width.
- 16px padding.
- Left-aligned, not centered.
- Crown: 20px.
- Label: mono 10.5px, `--tl-gold`.
- Name: Instrument Serif italic, `clamp(24px, 7vw, 30px)`, `--tl-fg`.
- Doubles: one partner per line, no truncation.
- Keep the subtle gradient if desired, but it should not be the only distinction.
- Remove the old bracket-tab banner; the final match itself can still visually identify its winner.

Use the same component for `Vô địch` and `Nhất bảng`. Hide the component entirely for multi-group or unresolved events.

## Priority summary

| Finding | Rank |
|---|---|
| Dedicated result block in list row | SHOULD |
| Per-sub-event result; no parent aggregation | BLOCKER |
| Preserve both doubles partners | BLOCKER |
| Crown instead of a second Trophy | NIT |
| `Vô địch` versus `Nhất bảng` semantics | BLOCKER |
| Theme-safe contrast tokens | BLOCKER |
| Separate accessible result semantics | BLOCKER |
| No fake unknown-result state | BLOCKER |
| Champion-first OG description | SHOULD |
| Promote result above detail tabs | BLOCKER |
| Dynamic OG image | SHOULD, later |
| Standardize `Đã kết thúc` wording | NIT |

If I had one day, I would ship the shared `event-result` panel directly under the detail-page header for every format with exactly one valid result, with the `Vô địch`/`Nhất bảng` distinction and accessible token treatment included. That serves the dominant deep-link journey and removes the current requirement to discover the bracket tab.
````
