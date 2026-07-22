# External second opinion — Referee PIN UX (GPT-5.6)

> Model: `gpt-5.6` via OpenAI /v1/responses. Saved verbatim by ui-ux-critic on 2026-07-22.
> The prescribed `scripts/agents/ask-model.mjs` is absent from this repo; called the API directly with the same system prompt + a self-contained brief.

## System prompt (verbatim)

```
You are a senior product designer reviewing a mobile-first bilingual (Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and the exact fix. No generic design platitudes.
```

## User prompt / brief (verbatim)

```markdown
# UX review request — "Referee PIN" for ThePickleHub

## Product context
ThePickleHub = bilingual (Vietnamese-primary, ~95% VN users) pickleball platform.
Mobile-dominant, mid-tier Android on 4G. Also has a Capacitor native shell.
Users arrive mid-task from Facebook deep links. Design system "The Line": dark
surfaces, Instrument Serif italic titles, Geist Mono uppercase kickers/labels,
shadcn/ui primitives, semantic --tl-* color tokens. Touch targets must be >=44px.

## The feature
Organizers run tournaments in 4 formats under /tools: Doubles Elimination,
Team Match, Quick Table, Flex. Today referees are added ONE WAY: organizer types
the referee's account email into a "Referee management" card. That grants the
user UPDATE rights on match scores only (nothing else).

New idea: add a **PIN** path. Organizer enables a 6-ish digit PIN in the setup
wizard. Any LOGGED-IN user who enters the correct PIN becomes a referee of that
tournament (exact same score-editing rights as manual). Organizer can enable/
disable + rotate the PIN. PIN auto-expires when the tournament finishes (has a
champion). Manual email path stays.

Constraints already locked:
- Entering PIN requires being logged in (so every score edit is attributable to a user_id).
- PIN referee rights == manual referee rights, no more.
- PIN lives in the setup wizard; auto-expires at tournament completion.

## What I need reviewed (be concrete, name the element + the fix)
(a) ORGANIZER flow: where in the wizard does the PIN control go? Quick Table wizard
    has 2 steps ('input' players -> 'assignment'). Team Match uses a settings
    dialog (a scrolling modal) where the Referee card sits at the very bottom,
    below name/date/fees/DUPR sections. How to show the PIN: masked vs shown,
    copy button, a shareable link? Enable/disable toggle uses shadcn <Switch>.
(b) REFEREE-at-the-court flow: a person standing at a noisy sunny court in Vietnam,
    one hand, wet hands, in a hurry, wants to start scoring. Where do they enter
    the PIN? What URL? Does a deep-link + login-redirect survive (login wall then
    bounce back to the PIN entry with the tournament context intact)? Note: the
    app recently had a bug where the post-login redirect param was dropped.
(c) Vietnamese copy for the whole flow: what a PIN is, the enable control, wrong-PIN
    error, expired-PIN error, success. Must be natural VN, not translated-English.
(d) Accessibility: PIN input (numeric?), error announcement (aria-live), focus.
(e) States: empty (no PIN yet), loading, error, offline (PWA/Capacitor).

## Current referee-management copy (VN app, for tone reference)
- Card title "Trọng tài", email placeholder, "Thêm" button, empty state "◌".
- Existing helper text below the card explains referees can edit scores.

Give a blocker-vs-nit verdict. Name exact screens, exact strings, exact fixes.
```

## Reply (verbatim)

## Verdict

**Blockers before launch**

1. **Post-login return path is not reliable.** Do not ship the PIN path until Facebook in-app browser, web login, and Capacitor all return to the same tournament join screen.
2. **Six-digit PIN abuse protection is undefined.** Validation, expiry, rate limiting, and permission grants must be server-side.
3. **Disable/rotate semantics are ambiguous.** Define whether existing PIN-added referees keep access. Recommended behavior: disabling or rotating blocks future joins but does not silently revoke existing referees.
4. **Tournament completion enforcement must be server-side.** Once the tournament has a champion, PIN joining and score updates must be rejected regardless of stale client state.
5. **Offline joining must not be queued.** A referee grant is a permission change and requires an online server response.

**Nits / polish**

- Mask/reveal behavior, QR presentation, button labels, source badges, empty-state copy, and loading skeletons.

---

# A. Organizer flow

## 1. Use one consistent `Trọng tài` section across all four formats

Do not create a separate “PIN settings” card elsewhere. Extend the existing **`Trọng tài` card** into two clearly labeled methods:

1. **`Thêm bằng email`**
2. **`Cho phép vào bằng mã PIN`**

This keeps both paths understood as equivalent ways of granting the same score-editing permission.

Replace the current empty state `◌` with:

> **Chưa có trọng tài.**

Under the card title, use:

> **Trọng tài chỉ có thể nhập và sửa tỷ số của giải này.**

Do not use copy implying broader tournament administration.

---

## 2. Quick Table wizard placement

Quick Table should remain a two-step wizard. Do not add a third step solely for permissions.

### Exact placement

On step 2, **`Phân bảng` / assignment**, place the expanded **`Trọng tài` card**:

- after the assignment preview;
- before the final sticky action that creates/saves the tournament.

Reason: this is an operational setting, not player input, but it must be visible before the tournament is finalized.

### If the tournament does not have a server ID yet

Do not generate a usable PIN only in client state. Show the switch, but after enabling display:

> **Mã PIN sẽ được tạo khi bạn hoàn tất thiết lập giải.**

After successful creation, the confirmation screen should automatically open the PIN area and show the generated PIN.

If a draft tournament ID already exists, generate the PIN server-side immediately.

---

## 3. Team Match settings dialog placement

The existing **`Trọng tài` card at the very bottom of the scrolling modal** is too easy to miss.

Move the entire card:

- directly after **name/date**;
- before **fees** and **DUPR**.

Use this order:

1. Thông tin giải
2. Ngày thi đấu
3. **Trọng tài**
4. Lệ phí
5. DUPR

Keep email and PIN management in the same card. Do not place the PIN switch in a separate security or advanced section.

Apply the same relative placement to Doubles Elimination and Flex.

---

## 4. PIN switch and organizer copy

Use a full-width switch row with the label itself clickable:

**Label**

> **Cho phép vào bằng mã PIN**

**Helper text**

> **Người đã đăng nhập có thể nhập mã này để chấm điểm. Họ không thể thay đổi cài đặt hoặc danh sách thi đấu.**

The shadcn `<Switch>` must have an accessible label and `aria-describedby` pointing to the helper text. The entire row should provide at least a 44px-high target.

### Disabled state

Show:

> **Chưa bật mã PIN.**

Do not show a blank PIN container.

### Enabled state

Use the subsection title:

> **Mã PIN trọng tài**

Display the code grouped for readability:

> **123 456**

Store and validate six digits without the space.

Below it:

> **Mã tự hết hiệu lực khi giải kết thúc.**

---

## 5. Masking, copy, rotate, and sharing

### Masking

Recommended behavior:

- Immediately after generating or rotating: show `123 456`.
- On later visits: show `••• •••`.
- Provide a 44×44px reveal button with accessible labels:
  - **`Hiện mã PIN`**
  - **`Ẩn mã PIN`**

Do not use a tiny eye icon inside the code field.

### Actions

Use these exact actions:

- **`Sao chép mã`**
- **`Chia sẻ`**
- overflow/destructive action: **`Tạo mã mới`**

Copy toast:

> **Đã sao chép mã PIN.**

### Rotate confirmation

Title:

> **Tạo mã PIN mới?**

Body:

> **Mã hiện tại sẽ ngừng hoạt động ngay. Những trọng tài đã tham gia vẫn giữ quyền chấm điểm.**

Actions:

- **`Hủy`**
- **`Tạo mã mới`**

### Disable confirmation

Do not switch off immediately without explaining the effect.

Title:

> **Tắt mã PIN?**

Body:

> **Người mới sẽ không thể tham gia bằng mã này. Những trọng tài đã tham gia vẫn giữ quyền chấm điểm.**

Actions:

- **`Giữ mã PIN`**
- **`Tắt mã PIN`**

If the product instead intends to revoke all PIN-added referees, that must be an explicit separate destructive action; do not overload the switch with that behavior.

---

## 6. Shareable link and QR

Use a tournament-specific join URL:

```text
https://thepicklehub.com/referee/join/{tournamentId}
```

The URL should contain the tournament context but **not the six-digit PIN in a query parameter**. Query parameters leak into analytics, logs, browser history, screenshots, and support tooling.

The native/Web Share payload can include the PIN in the message:

> **Bạn được mời làm trọng tài giải “{tournamentName}”.**  
> **Mở: {joinUrl}**  
> **Mã PIN: 123 456**  
> **Bạn cần đăng nhập để chấm điểm.**

For court use, add an optional action:

> **Hiện mã QR**

The QR should encode only the tournament join URL. Show the PIN as large text below the QR. This lets someone scan the tournament context and then type the verbally shared PIN.

Render the QR only when requested; do not load a large QR dependency in the initial wizard bundle.

---

## 7. Referee list

Once users have joined, show each referee by name/email with a source badge:

- **`Email`**
- **`Mã PIN`**

Provide an individual action:

> **Gỡ quyền trọng tài**

This makes it clear that disabling the PIN does not remove people who already joined.

---

# B. Referee-at-the-court flow

## 1. Entry points

Use the same tournament-specific destination everywhere:

```text
/referee/join/{tournamentId}
```

Open it from:

- the organizer’s share link;
- the QR code;
- a public tournament page action labeled **`Nhập mã trọng tài`**;
- a global fallback at `/referee/join`, where the user can paste a full invitation link or find a tournament.

Do not require the referee to navigate through `/tools`. That area sounds organizer-facing and is poor for a Facebook deep-link arrival.

On the public tournament page, place **`Nhập mã trọng tài`** in the actions menu or immediately below the primary match-view action. Do not make it compete visually with normal participant actions.

---

## 2. Join screen

### Header

Kicker:

> **TRỌNG TÀI**

Title:

> **Vào chấm điểm**

Tournament context must remain visible:

- tournament name;
- date;
- venue, if available;
- status.

### PIN field

Label:

> **Mã PIN trọng tài**

Helper:

> **Nhập mã 6 số do ban tổ chức cung cấp.**

Primary button:

> **Bắt đầu chấm điểm**

After success, route directly to the tournament’s match list, not back to the tournament homepage.

---

## 3. Login redirect must preserve tournament context

If logged out, the join screen should still render the tournament name and show:

> **Đăng nhập để nhập mã**

After login, return to:

```text
/referee/join/{tournamentId}
```

Do not return to the homepage, `/tools`, or the generic tournament page.

### Implementation requirement

Preserve the internal return route in both:

1. the OAuth `state` value or equivalent server-side login transaction;
2. a short-lived local fallback such as `pendingRefereeJoin = { tournamentId }`.

Allowlist the return route so it cannot become an open redirect.

Do not put a PIN in `returnTo`. If the user has already typed it before an auth interruption, either:

- require re-entry after login; or
- keep it only in short-lived session storage and clear it immediately after success/failure.

### Required regression tests

Test all of these before launch:

- Facebook in-app browser → login → return to join screen.
- Chrome Android → login → return.
- Capacitor shell → external OAuth browser → app universal link return.
- Existing logged-in user opening the QR URL.
- Login cancelled, then retried.
- App killed during login and reopened.

Given the recent dropped-redirect bug, this is a launch blocker.

---

# C. Vietnamese copy

## Organizer

| Element | Vietnamese copy |
|---|---|
| Card title | **Trọng tài** |
| Permissions helper | **Trọng tài chỉ có thể nhập và sửa tỷ số của giải này.** |
| Email subsection | **Thêm bằng email** |
| Email placeholder | **Email tài khoản trọng tài** |
| Email action | **Thêm** |
| PIN switch | **Cho phép vào bằng mã PIN** |
| PIN explanation | **Người đã đăng nhập có thể nhập mã này để chấm điểm. Họ không thể thay đổi cài đặt hoặc danh sách thi đấu.** |
| Disabled empty state | **Chưa bật mã PIN.** |
| PIN label | **Mã PIN trọng tài** |
| Expiry helper | **Mã tự hết hiệu lực khi giải kết thúc.** |
| Reveal | **Hiện mã PIN** |
| Hide | **Ẩn mã PIN** |
| Copy | **Sao chép mã** |
| Share | **Chia sẻ** |
| Rotate | **Tạo mã mới** |
| No referees | **Chưa có trọng tài.** |

Avoid explaining PIN as “personal identification number.” In this context, **`mã PIN 6 số`** is already natural Vietnamese.

## Referee join

| State/element | Vietnamese copy |
|---|---|
| Screen title | **Vào chấm điểm** |
| Logged-out action | **Đăng nhập để nhập mã** |
| PIN label | **Mã PIN trọng tài** |
| PIN helper | **Nhập mã 6 số do ban tổ chức cung cấp.** |
| Submit | **Bắt đầu chấm điểm** |
| Wrong PIN | **Mã PIN không đúng. Kiểm tra lại mã do ban tổ chức cung cấp.** |
| Rotated/disabled PIN | **Mã PIN này không còn hiệu lực. Hãy xin mã mới từ ban tổ chức.** |
| Tournament finished | **Giải đã kết thúc nên mã PIN không còn hiệu lực.** |
| Success | **Bạn đã được thêm làm trọng tài.** |
| Success CTA | **Xem các trận đấu** |
| Already a referee | **Bạn đã là trọng tài của giải này.** |
| Rate limited | **Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau {n} phút.** |
| Generic server error | **Không thể kiểm tra mã PIN lúc này. Vui lòng thử lại.** |

Do not use only “Mã hết hạn” because it is unclear whether the organizer rotated it or the tournament finished.

---

# D. Accessibility and one-handed use

## PIN input

Use one semantic input, not six independent boxes:

```html
<input
  type="text"
  inputmode="numeric"
  autocomplete="one-time-code"
  pattern="[0-9]*"
  maxlength="6"
/>
```

Important details:

- Use `type="text"`, not `type="number`; number inputs can remove leading zeroes and expose increment controls.
- Accept pasted values such as `123 456` or `123-456` and normalize them to six digits.
- Visually present six positions if desired, but keep one real input for screen readers, paste, and focus.
- Use at least a 56px input height on the court screen.
- Use large tabular numerals and high-contrast focus styling.
- Keep the submit button at least 48–56px high and full width on mobile.
- Do not automatically submit on the sixth digit; wet-hand correction is easier when the user explicitly taps the primary button.

## Error announcement and focus

The inline error container should use:

```html
role="alert"
aria-live="assertive"
```

On an invalid PIN:

- keep focus in the PIN input;
- select or clear the existing digits consistently;
- associate the error through `aria-describedby`;
- do not move focus to a toast.

On server/offline errors, keep the entered digits unless there is a security reason to clear them.

On success:

- announce **`Bạn đã được thêm làm trọng tài.`**
- then navigate to the match list;
- move focus to the match-list heading after navigation.

## Sunny-court presentation

On the join screen:

- avoid low-contrast muted gray helper text;
- use the high-contrast `--tl-*` foreground/error tokens;
- do not place the PIN form inside a bottom sheet with a dimmed background;
- keep tournament name, PIN input, error, and primary button within the first mobile viewport where possible.

Instrument Serif italic is appropriate for the title, but the PIN, labels, errors, and buttons should remain Geist/Geist Mono for legibility.

---

# E. Required states

## Organizer PIN card

### Empty/off

> **Chưa bật mã PIN.**

Switch is available.

### Enabling/loading

- Disable the switch while the server creates the PIN.
- Show a compact skeleton in the code area.
- Status text:

> **Đang tạo mã PIN…**

Do not optimistically display a random client-generated number.

### Enabled

Show masked PIN, reveal/copy/share actions, expiry helper, and rotate action.

### Rotation loading

> **Đang tạo mã mới…**

Disable copy/share until the server confirms the new code.

### Server error

> **Không thể cập nhật mã PIN. Vui lòng thử lại.**

Keep the last confirmed switch state. Do not leave the switch visually on if creation failed.

### Offline

> **Bạn đang ngoại tuyến. Kết nối mạng để bật, tắt hoặc tạo mã PIN mới.**

Disable enable/disable/rotate actions. Do not queue them for later synchronization.

### Tournament complete

Disable all PIN controls and show:

> **Giải đã kết thúc. Mã PIN không còn hiệu lực.**

Do not offer rotation.

---

## Referee join screen

### Loading tournament context

Use a lightweight skeleton for tournament name/date. Do not block the whole screen with an indefinite spinner.

### Ready

Autofocus the PIN field only when:

- the user is logged in;
- the screen was opened directly;
- autofocus will not cause a disruptive viewport jump in the Facebook browser.

### Submitting

Button label:

> **Đang kiểm tra…**

Disable duplicate submission but keep the digits visible.

### Wrong PIN

> **Mã PIN không đúng. Kiểm tra lại mã do ban tổ chức cung cấp.**

### Disabled/rotated PIN

> **Mã PIN này không còn hiệu lực. Hãy xin mã mới từ ban tổ chức.**

### Completed tournament

> **Giải đã kết thúc nên mã PIN không còn hiệu lực.**

Provide a secondary action:

> **Xem kết quả giải**

### Success

> **Bạn đã được thêm làm trọng tài.**

Then show:

> **Xem các trận đấu**

### Already joined

Do not make the user enter the PIN again:

> **Bạn đã là trọng tài của giải này.**

Primary action:

> **Tiếp tục chấm điểm**

### Offline

> **Không thể xác nhận mã khi đang ngoại tuyến. Hãy kiểm tra kết nối mạng rồi thử lại.**

Button:

> **Thử lại**

Do not grant access locally or queue the PIN for background submission.

---

# Security and permission behavior that UX depends on

A six-digit code has only one million combinations. Require:

- server-side PIN hashing;
- server-side tournament status and expiry checks;
- rate limiting by account, tournament, IP/device signal;
- a practical limit such as five failed attempts per account/tournament in ten minutes;
- audit events for successful and failed joins;
- attribution of every score update to `user_id`;
- referee records with a source field such as `email` or `pin`;
- immediate invalidation of the old code after rotation.

The backend must return distinct machine-readable outcomes, for example:

- `INVALID_PIN`
- `PIN_DISABLED`
- `PIN_ROTATED_OR_EXPIRED`
- `TOURNAMENT_COMPLETE`
- `ALREADY_REFEREE`
- `RATE_LIMITED`
- `OFFLINE/NETWORK_ERROR` handled client-side

The UI can then show the exact Vietnamese messages above without guessing from a generic 400 response.
