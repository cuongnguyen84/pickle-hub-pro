## 1. Invite-code copy button: delete it

**Decision: (a) Delete it.**

Remove the entire **“Copy invite code: ABC123”** row from the captain’s team-detail sheet, including the copy icon, toast, and invite-code fetch.

Why:

- The code has no valid destination or redemption flow.
- Keeping it through an RPC preserves a broken promise: captains will share a code teammates cannot use.
- Repurposing the same control would create ambiguity between a secret code and a public share link.

If sharing is still useful, add a separate action only when there is a valid destination:

- **VI:** `Chia sẻ giải đấu`
- **EN:** `Share tournament`

That action should share the canonical `/tools/team-match/:id` URL, not the old code.

Also stop generating new `team_match_teams.invite_code` values. Existing codes should be invalidated or treated as dead data; do not build a privileged RPC solely to preserve this button.

---

## 2. Public tournament page: degrade per section, never as a blank page

Do not block `/tools/team-match/:id` with a full-page error. Keep independently available content visible:

- Tournament name
- Date and venue
- Tournament status
- Rules/format
- Organizer information
- Share action

Replace the public `select('*')` with an explicit safe-column query. This should not add a round trip.

### Team-list behavior

Render the error inside the **team-list section**, in the same space as the list. Do not convert a failed request into “0 teams”.

| State | Vietnamese | English |
|---|---|---|
| Loading | `Đang tải danh sách đội…` | `Loading teams…` |
| Genuine empty | `Chưa có đội nào đăng ký.` | `No teams have registered yet.` |
| Request failed | `Không tải được danh sách đội.` | `Couldn’t load the team list.` |
| Retry button | `Thử lại` | `Try again` |
| Offline, no cached data | `Bạn đang ngoại tuyến. Kết nối mạng rồi thử lại.` | `You’re offline. Connect to the internet and try again.` |

Use a compact inline error card, not a toast. A toast disappears too quickly court-side and leaves an unexplained empty section.

### Standings and matches

If standings or match cards require the failed team response to resolve team names, show section-specific errors rather than blank tables or IDs:

| Section | Vietnamese | English |
|---|---|---|
| Standings error | `Không tải được bảng xếp hạng.` | `Couldn’t load the standings.` |
| Standings empty | `Chưa có bảng xếp hạng.` | `Standings are not available yet.` |
| Matches error | `Không tải được lịch thi đấu.` | `Couldn’t load the match schedule.` |
| Matches empty | `Chưa có trận đấu nào.` | `No matches have been scheduled yet.` |

A single **`Thử lại / Try again`** action may refetch the shared safe-team query for all dependent sections.

If cached content exists while offline, keep it visible and add a non-blocking banner:

- **VI:** `Bạn đang ngoại tuyến. Dữ liệu có thể chưa được cập nhật.`
- **EN:** `You’re offline. This information may be out of date.`

Do not replace cached content with an offline empty state.

---

## 3. Native payment status: hide it from general viewers

A viewer should not see another team’s `payment_status` as social proof.

Reasons:

- It is financial/account information, not tournament participation information.
- `claimed` is not verified payment and could be misread as paid.
- Public payment chips would pressure teams and confuse payment confirmation with the existing team `confirmed` status.

### Exact native fix

The public team-list DTO and query should contain only safe fields. Remove `payment_status` entirely rather than making it optional. Making it optional does not solve the database error if the query still requests the column.

Show payment state only in:

1. The captain’s own team view, through a captain-scoped RPC.
2. Organizer payment tools, through an organizer-scoped RPC.

Label it explicitly as payment, so it is not confused with team registration:

| State | Vietnamese | English |
|---|---|---|
| `unpaid` | `Phí tham dự: Chưa đóng` | `Entry fee: Unpaid` |
| `claimed` | `Phí tham dự: Chờ BTC xác nhận` | `Entry fee: Awaiting organizer confirmation` |
| `confirmed` | `Phí tham dự: Đã xác nhận` | `Entry fee: Confirmed` |

For chips, use green for confirmed, gold for awaiting confirmation, and a neutral outlined chip for unpaid. Do not use red for unpaid because red already means “live” in The Line system.

### Native rollout risk

Installed app versions that continue requesting `payment_status` will fail after the revoke. This cannot be repaired by making the decoder tolerant because PostgreSQL rejects the entire query.

Ship the safe native query before the migration where possible. For older versions:

- Use the shell’s minimum-version/update gate if one exists.
- Otherwise, accept that those versions need an app update; do not restore the grant and reintroduce the leak merely to support them.

---

## 4. Organizer payment surfaces: one RPC round trip is acceptable

Yes—one additional organizer-scoped RPC is appropriate because these are privileged, secondary surfaces. Do not put it on the tournament page’s first-paint path.

### Payment roster

Fetch when the organizer opens the **Payment roster** tab or sheet. Use one RPC returning only:

- `team_id`
- `team_name`
- `payment_status`
- Any payment timestamp needed by the organizer

Do not perform one RPC per team.

Exact states:

| State | Vietnamese | English |
|---|---|---|
| Loading | `Đang tải tình trạng đóng phí…` | `Loading payment statuses…` |
| Empty | `Chưa có đội nào trong giải.` | `There are no teams in this tournament yet.` |
| Error | `Không tải được tình trạng đóng phí.` | `Couldn’t load payment statuses.` |
| Retry | `Thử lại` | `Try again` |
| No permission | `Bạn không có quyền xem thông tin đóng phí của giải này.` | `You don’t have permission to view this tournament’s payment information.` |

Button:

- **VI:** `Xác nhận đã nhận phí`
- **EN:** `Confirm payment received`

While the mutation is running, disable only that team’s button and show:

- **VI:** `Đang xác nhận…`
- **EN:** `Confirming…`

Success toast:

- **VI:** `Đã xác nhận phí của đội.`
- **EN:** `Team payment confirmed.`

Failure toast:

- **VI:** `Không thể xác nhận lúc này. Vui lòng thử lại.`
- **EN:** `Couldn’t confirm the payment. Please try again.`

Do not optimistically change the chip before the RPC succeeds. A false green “confirmed” state is worse than a short delay.

### Delete-confirmation dialog

Call a summary RPC when the dialog opens. Prefer returning separate counts instead of treating `claimed` as paid:

- `confirmed_count`
- `awaiting_confirmation_count`

Dialog copy:

- **VI:** `Đã xác nhận: {{confirmed}} đội · Chờ xác nhận: {{pending}} đội. Khi xoá giải, toàn bộ dữ liệu đóng phí cũng sẽ bị xoá.`
- **EN:** `Confirmed: {{confirmed}} teams · Awaiting confirmation: {{pending}} teams. Deleting the tournament will also delete all payment records.`

Loading:

- **VI:** `Đang kiểm tra tình trạng đóng phí…`
- **EN:** `Checking payment records…`

Failure:

- **VI:** `Không kiểm tra được tình trạng đóng phí.`
- **EN:** `Couldn’t check payment records.`

Keep **`Xoá giải đấu / Delete tournament`** disabled while the summary is loading or has failed, and provide **`Thử lại / Try again`**. This prevents the dialog from silently omitting the payment warning.

### Regressions to watch

- Do not show `0 đội` while the RPC is loading; use the loading text.
- Cache the organizer roster for the current session so reopening the sheet does not flicker.
- Invalidate that cache after confirming a payment.
- If the organizer session expires, show a sign-in-specific state rather than a generic network error:

  - **VI:** `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.`
  - **EN:** `Your session has expired. Please sign in again.`

---

## 5. Recommended shared error-state strings

These should be locale-switched, not displayed in both languages simultaneously.

| Purpose | Vietnamese | English |
|---|---|---|
| Generic loading | `Đang tải…` | `Loading…` |
| Generic retry | `Thử lại` | `Try again` |
| Generic request failure | `Không tải được dữ liệu.` | `Couldn’t load the information.` |
| Offline, no cache | `Bạn đang ngoại tuyến. Kết nối mạng rồi thử lại.` | `You’re offline. Connect to the internet and try again.` |
| Offline, cached content shown | `Bạn đang ngoại tuyến. Dữ liệu có thể chưa được cập nhật.` | `You’re offline. This information may be out of date.` |
| Session expired | `Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.` | `Your session has expired. Please sign in again.` |
| Sign-in action | `Đăng nhập lại` | `Sign in again` |
| Permission denied | `Bạn không có quyền xem thông tin này.` | `You don’t have permission to view this information.` |

The key implementation rule is that a permission error must never render as a genuine empty state. “No teams,” “no matches,” and “unpaid” are valid product states; they must only appear after a successful response.