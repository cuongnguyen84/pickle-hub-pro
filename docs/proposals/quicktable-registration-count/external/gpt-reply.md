## Recommended card treatment

For an eligible open bracket, change the meta line from:

`Đôi · 16 người chơi · Round robin · 2 giờ trước`

to:

`Đôi · [14 đội đã đăng ký] · Round robin · 2 giờ trước`

The bracketed portion is a compact, non-interactive badge. The quota value must not remain beside it.

---

## 1. Copy: use the unit, never X/Y

### Exact visible strings

| Format | VI | EN |
|---|---|---|
| Singles | `14 người đã đăng ký` | `14 players registered` |
| Doubles | `14 đội đã đăng ký` | `14 teams registered` |

Use the same templates for any displayed number:

- VI singles: `{N} người đã đăng ký`
- VI doubles: `{N} đội đã đăng ký`
- EN singles: `{N} players registered`
- EN doubles: `{N} teams registered`

Do not use:

- `14 đã đăng ký`: ambiguous for doubles—users cannot tell whether it means 14 people or 14 teams.
- `14/16`: communicates a hard maximum and conflicts with the stated Quick Tables model.
- `14 người chơi`: can be mistaken for roster size or quota rather than registrations.

### Mobile fit

Put the badge immediately after `Đơn`/`Đôi`, and make it non-shrinking:

`Đôi · [14 đội đã đăng ký] · Round robin · 2 giờ trước`

If space runs out, truncate or omit metadata after the badge—not the badge itself. Priority should be:

1. `Đơn` / `Đôi`
2. Registration badge
3. `Round robin`
4. Relative time

**Severity: Should-fix**

---

## 2. Anti-social-proof threshold: show from 4 registrations

Render the badge only when:

`registration_count >= 4`

Hide it for `0–3`.

Four is a practical minimum because:

- Four singles players can form a recognizable round robin.
- Four doubles teams already represent eight people and signals a viable table.
- One to three registrations make the bracket look unstarted rather than popular.

For counts below four, do not replace the badge with “Be the first” or expose the low number. Keep the existing status pill:

- VI: `ĐANG MỞ ĐĂNG KÝ`
- EN: `REGISTRATION OPEN`

Example below threshold:

`Đôi · Round robin · 2 giờ trước`

Do not fall back to showing the quota in that position.

Treat `4` as the launch rule, then measure registration conversion by visible count bucket. Do not delay launch for an experiment.

**Severity: Should-fix**

---

## 3. Placement and hierarchy

### Exact placement

Place the registration badge in the meta line, replacing the current quota token:

```text
Bracket name
Đôi · [14 đội đã đăng ký] · Round robin · 2 giờ trước     [ĐANG MỞ ĐĂNG KÝ]
```

### Remove the quota from Quick Tables list rows

For open-registration brackets, do not show both:

`16 người chơi · 14 đội đã đăng ký`

That introduces two unexplained numbers and mixes people with teams.

More broadly, remove the current quota token from all Quick Tables rows if it is not an enforced capacity. A value labeled `16 người chơi` will be interpreted as either current attendance or a hard cap. If the quota is still useful administratively, keep it on the bracket detail/edit screen, not on the public list row.

For an eligible bracket with fewer than four registrations:

```text
Đôi · Round robin · 2 giờ trước
```

For an ad-hoc bracket:

```text
Đôi · Round robin · 2 giờ trước
```

Do not substitute roster size unless it comes from a separate, accurate roster count and is explicitly labeled as roster size.

### Badge visual hierarchy

The registration badge should be more prominent than ordinary grey metadata, but less prominent than the status pill.

Recommended styling:

```css
.tl-registration-count {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  min-height: 18px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #eaf2ff;
  color: #174ea6;
  font-size: 11px;
  line-height: 16px;
  font-weight: 600;
  white-space: nowrap;
}
```

Keep the status pill as the stronger operational signal. Do not increase the count to 12–14px, place it beside the bracket name, or add another saturated status color.

No Users icon is necessary: the localized text already names the unit, and the icon would consume scarce horizontal space.

**Quota/count collision: Blocker**  
**Placement and styling: Should-fix**

---

## 4. Eligibility and counting rules

Render the badge only when all of these are true:

```text
requires_registration = true
AND registration is currently open
AND bracket is still in setup/registration phase
AND registration_count >= 4
```

Prefer a canonical `registration_is_open` value rather than inferring openness solely from `status = setup`. A setup bracket may not have opened yet or may have been manually closed.

Omit the count for:

- `group_stage`
- `playoff`
- `completed`
- Registration-closed brackets
- `requires_registration = false`
- Missing or failed count data

Do not render `0` while the count request is loading or has failed.

### Doubles semantics

For doubles, count registered teams, not individual players:

- Four team registrations → `4 đội đã đăng ký`
- Do not display `8 người đã đăng ký` unless the registration system actually registers players individually and the product intentionally wants a player count.

The server should return both the count and its unit semantics, for example:

```json
{
  "registrationCount": 14,
  "registrationUnit": "team",
  "registrationIsOpen": true
}
```

Use the same active-registration definition as the bracket detail page. Exclude cancelled/deleted registrations; do not let list and detail counts disagree.

For `requires_registration = false`, roster entries are not registrations. Never label them `đã đăng ký`.

**Severity: Blocker**

---

## 5. Accessibility and interaction

### Contrast

The proposed colors, `#174EA6` on `#EAF2FF`, provide strong contrast for 11px text. Maintain at least 4.5:1 in every theme. Define a separate tested dark-theme token rather than inverting these colors automatically.

The number must remain understandable without color; the text itself provides the meaning.

### Screen-reader wording

Use the full visible wording, so no separate abbreviated accessible name is needed:

- VI singles: `14 người đã đăng ký`
- VI doubles: `14 đội đã đăng ký`
- EN singles: `14 players registered`
- EN doubles: `14 teams registered`

Do not announce it as an alert or status update. Do not use `aria-live`; list counts can change without interrupting users.

If visual copy is ever shortened, hide it from assistive technology and provide the full wording:

```html
<span class="tl-registration-count">
  <span aria-hidden="true">14 đội đăng ký</span>
  <span class="sr-only">14 đội đã đăng ký</span>
</span>
```

### Interaction

The badge is not tappable. It should not have:

- Its own `<a>` or `<button>`
- A hover state
- A focus stop
- A tooltip

Keep it inside the existing row link as plain text. This avoids a nested interactive element and lets the count be included naturally in the row’s accessible content.

**Nested interaction and readable contrast: Blocker**  
**Full screen-reader wording/no `aria-live`: Should-fix**

---

## 6. Performance requirement

Do not issue one COUNT request per card. The N+1 implementation risks both LCP and backend fan-out and should block release.

Return counts with the list payload using either:

1. One grouped query for all bracket IDs on the page, or
2. A precomputed/cached registration count updated when registrations change.

Example grouped query shape:

```sql
SELECT bracket_id, COUNT(*) AS registration_count
FROM registrations
WHERE bracket_id IN (...)
  AND status = 'active'
GROUP BY bracket_id;
```

For doubles, count distinct team registrations if multiple player records can belong to the same team:

```sql
COUNT(DISTINCT team_id)
```

The `/tournaments` response should already contain the count; the client should not fetch it after rendering. A short server cache of 30–60 seconds is acceptable for social proof, provided registration mutations invalidate or refresh it when practical.

**Severity: Blocker**

---

## Severity summary

| Recommendation | Rank |
|---|---|
| Never show quota and registration count together | **Blocker** |
| Remove the misleading quota token from public Quick Tables rows | **Blocker** |
| Only label real registrations from `requires_registration=true` brackets | **Blocker** |
| Count teams for doubles, not people | **Blocker** |
| Eliminate per-card COUNT requests; batch or precompute | **Blocker** |
| No nested tappable badge; meet 4.5:1 contrast | **Blocker** |
| Show the badge only from `N >= 4` | **Should-fix** |
| Use full unit-specific VI/EN copy | **Should-fix** |
| Put the badge after `Đơn`/`Đôi` and protect it from truncation | **Should-fix** |
| Keep the badge visually below the status pill | **Should-fix** |
| Omit the Users icon to save width | **Nit** |
| Use a 30–60 second count cache if needed | **Nit**, assuming the count remains reasonably fresh |