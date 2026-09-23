## 1. States and edge cases most likely to break

### Flow A — RegistrationModal

#### 1. Modal-session reset and stale async results — highest risk

**State at risk:** all ~13 reset fields, especially:

- `step`
- `selectedSlot`
- `paymentOrder`
- payment claimed/post-claim state
- phone/name/level
- OTP value, cooldown and delivery channel
- Turnstile token/watchdog state
- registration/save-link data
- recovery email state
- error state

**Silent failure examples:**

- Open Event A, select Slot 2, close, then open Event B and submit Slot 2 without selecting it.
- Event A’s `paymentOrder.reference_code` appears in Event B.
- The modal reopens on `"payment"` or `"success"` instead of the initial step.
- A late RPC response from Event A updates the newly opened Event B session after the close reset.

**Exact fix:**

- Put all modal-session state behind one `initialRegistrationState(eventId)` factory and one `RESET_SESSION` action. Do not scatter resets across hook and component.
- Invoke reset on both:
  - `open: true → false`
  - registration identity change, ideally a stable key such as `eventId + registrationId`.
- Add a session/request generation ID. Ignore async responses whose generation does not match the current modal session.
- Keep a checklist test that proves every session field resets; do not rely only on checking `step`.

---

#### 2. Turnstile token lifecycle

**State at risk:** Turnstile token, widget instance, 20-second watchdog and CAPTCHA error/reload state.

The token is single-use and must be invalidated:

1. after every send attempt, including a rejected server request;
2. whenever the phone changes;
3. when the modal closes;
4. when the widget is manually reloaded.

A common extraction bug is resetting the token only after a successful OTP send, allowing a failed token to be reused. Another is retaining a token when the user edits the phone after verification.

**Exact fix:**

Create one operation such as `invalidateCaptcha(reason)` that always:

- clears the token;
- clears the watchdog timer;
- resets/re-renders the widget as required;
- returns the submit button to disabled until a new token arrives.

Do not let the UI component independently clear the visual CAPTCHA while the hook retains the token.

---

#### 3. Double `saveMyRegistration` persistence

**State at risk:** locally saved registration before and after payment-order creation.

The first call persists the verified registration. The second folds in `reference_code`. A refactor can easily “deduplicate” these calls and leave the saved magic-link record without the payment reference.

**Exact fix:**

Model these as two intentional persistence points, not duplicate side effects:

- `persistVerifiedRegistration(registration)`
- `persistRegistrationWithPaymentOrder(registration, paymentOrder)`

The second write must merge with the first record rather than replace unrelated saved fields.

---

#### 4. Payment routing and `payment_not_enabled`

**Branch at risk:**

```text
price > 0
AND club payment enabled
→ payment step
```

Additionally, the server response `payment_not_enabled` must silently route to `"success"`.

Likely extraction regressions:

- Treating `payment_not_enabled` as a visible error.
- Sending every paid event to the QR step based only on `price > 0`.
- Showing the prepayment unpaid badge or deadline when no payment order exists.
- Losing the distinction between pre-claim and post-claim.

**Exact fix:**

Keep one application-layer transition function with an explicit result union, for example:

```ts
type PaymentStartResult =
  | { kind: 'payment_order_created'; order: PaymentOrder }
  | { kind: 'payment_unavailable' }
  | { kind: 'failed'; errorCode: RegistrationErrorCode };
```

Map `payment_unavailable` to `"success"` without rendering an error.

---

#### 5. Member skip-OTP path with slot requirements

**State at risk:** member status can skip phone/OTP, but it must not skip organizer-configured slot validation.

Likely regression: a generic `submitRegistration()` assumes every route has a verified OTP, or the direct-member RPC receives no `slotId`.

**Exact fix:**

Keep separate application commands:

- `registerMember({ eventId, slotId })`
- `requestGuestOtp(...)`
- `verifyGuestOtp(...)`

Both member and guest commands must use the same slot-domain validator for:

- `slot_required`
- `slot_not_found`
- `slot_full`

Do not encode member registration as a fake successful OTP state.

---

#### 6. OTP timers and channel-specific UI

**State at risk:**

- 60-second resend cooldown
- last delivery channel
- SMS fallback link shown only after Zalo
- dev OTP amber box shown only for `dev`

Likely regressions:

- Cooldown restarts on every render or disappears when the hook remounts.
- `"resend via SMS"` appears after SMS or dev delivery.
- The dev OTP survives a later production-channel resend.
- An old timer modifies a newly opened session.

**Exact fix:**

Store `lastOtpChannel` and `resendAvailableAt`, not just a decrementing display number. Derive remaining seconds from the timestamp. Clear both on session reset, and clear `devOtp` whenever the latest channel is not `dev`.

---

#### 7. Server error-code exhaustiveness

The extraction boundary may convert server errors into generic exceptions too early, causing codes such as `slot_full` or `otp_expired` to fall back to a generic message.

**Exact fix:**

Preserve the raw server code through infra and application layers. Map it to an i18n key in one exhaustive function:

```ts
mapRegistrationErrorCode(code): RegistrationErrorKey
```

Add a development assertion or TypeScript exhaustiveness check for all currently supported codes.

---

### Flow B — TeamMatchSetup

#### 1. Step-5 validity as a cross-field invariant — highest risk

**Invariant:**

```text
If feePerPlayer > 0 OR feePerTeam > 0:
  bank is required
  account number must match 6–20 digits
  holder name trimmed length must be >= 3
Otherwise:
  bank fields do not block submit
```

This often breaks when fee logic moves to a domain helper but bank validity remains in the component.

**Exact fix:**

Expose one pure function:

```ts
validateFeesStep({
  feePerPlayer,
  feePerTeam,
  bankCode,
  accountNumber,
  accountName
})
```

Use the same result for:

- disabling/enabling Next or Submit;
- inline field errors;
- final submission validation.

Normalize numeric fee values before testing `> 0`; avoid truthiness checks on strings such as `"0"`.

---

#### 2. Discount-tier ordering, boundaries and cumulative preview

**State at risk:** add/remove rows, registration-order boundaries and the live text such as:

> `Slot 1–10: X đ (−20%)`

Likely regressions:

- Off-by-one boundaries: slot 10 falls into the next tier.
- Removing a row leaves tier indexes or boundaries stale.
- Sorting rows by discount instead of registration order.
- Applying the discount twice to fee-per-player and fee-per-team.
- Different rounding or currency formatting after moving to a helper.

**Exact fix:**

Move both the calculation and preview data generation into one pure function. Return structured data:

```ts
{
  fromSlot,
  toSlot,
  baseAmount,
  discountedAmount,
  discountPercent
}
```

The UI should only format that result. Do not duplicate tier math in validation and preview components.

---

#### 3. Bank data and VietQR preview synchronization

**State at risk:** selected bank, account number, holder name and generated QR URL/image.

Likely regressions:

- QR image still shows the previous account after editing.
- Changing banks does not regenerate the image.
- Invalid account numbers still produce a preview because preview and validation use different rules.
- Holder names with Vietnamese characters are encoded differently after moving URL generation.

**Exact fix:**

Generate the VietQR request from the same normalized fee/bank model used for validation. The QR preview must derive from current values, not be independently stored state. If generation is async, key responses by a serialized request and ignore stale responses.

Preserve current trimming, capitalization, URL encoding and amount-selection behavior exactly.

---

#### 4. Step navigation retaining money fields

A hook split can unintentionally reset Step 5 whenever the user goes back to Step 4 and returns.

**Exact fix:**

Scope wizard state to the setup session, not to the mounted Step-5 component. Unmounting a step must not clear:

- both fee fields;
- discount rows;
- bank selection;
- account number;
- holder name.

Only an explicit wizard reset or successful completion should clear them.

---

#### 5. Zero-fee transitions

**Edge case:** the organizer enters fees and bank details, then changes both fees to zero.

The current behavior must be characterized before deciding whether hidden bank data is retained or cleared. A refactor frequently changes this accidentally.

**Exact fix:** preserve the observed behavior and test it. Regardless of whether bank data remains, zero fees must make bank fields non-blocking.

---

## 2. Copy-drift risk and concrete guards

### Highest risk: Flow B Step 5

The ~20 inline expressions such as:

```tsx
language === 'vi' ? '...' : '...'
```

are the largest copy-drift surface. Splitting Step 5 into components will encourage each component to recreate or slightly edit its own ternaries.

### Guard

Move Step-5 copy to i18n **before the architectural extraction**, as a separate behavior-parity commit.

Use a dedicated namespace, for example:

```text
teamMatch.fees.rulesSummary
teamMatch.fees.feePerPlayer.label
teamMatch.fees.feePerPlayer.placeholder
teamMatch.fees.feePerTeam.label
teamMatch.fees.discount.addTier
teamMatch.fees.discount.slotRange
teamMatch.fees.discount.preview
teamMatch.fees.bank.label
teamMatch.fees.accountNumber.label
teamMatch.fees.accountNumber.invalid
teamMatch.fees.accountName.label
teamMatch.fees.qr.hint
```

Requirements for that migration:

- Copy the current Vietnamese and English strings byte-for-byte.
- Preserve punctuation, spacing, `%`, `−` versus `-`, and `đ`.
- Use interpolation for values; do not concatenate translated fragments.
- Create a test that renders Step 5 in both languages and asserts the visible string inventory.
- Do not “improve” Vietnamese or English during this commit.

A centralized TypeScript copy object is an acceptable temporary guard if a full i18n migration is too large, but no extracted child component should contain a new `language === 'vi'` ternary.

---

### Secondary risk: Flow A’s hardcoded strings

Move these into i18n before extraction:

- `Đang xác minh trình duyệt…`
- `Xác minh trình duyệt quá lâu…`
- `Tải lại CAPTCHA`
- `Dev mode OTP`
- the inline language-branched bookmark footer line

Suggested keys:

```text
registration.captcha.verifying
registration.captcha.timeout
registration.captcha.reload
registration.otp.devMode
registration.success.bookmarkHint
```

Again, preserve exact current output. Whether `"Dev mode OTP"` should eventually be translated is a copy decision for a later change.

Also freeze the existing output of the `"Full"` badge. It may be a localization defect, but translating it during a no-behavior-change refactor would violate the stated scope.

---

### Error-copy guard

Create a table covering every server code and expected i18n key:

- `invalid_phone`
- `already_registered`
- `event_full`
- `slot_required`
- `slot_not_found`
- `slot_full`
- `not_a_member`
- every `event_not_open` family code
- `too_many_otps_ip`
- `captcha_failed`
- `daily_budget_exceeded`
- `too_many_otps`
- `otp_mismatch`
- `otp_expired`
- `otp_too_many_attempts`
- `sms_send_failed`

Test the key mapping separately from translation text. Then add one Vietnamese and one English integration assertion to confirm the selected key reaches the UI.

---

## 3. Minimal behavior-parity tests to write before refactoring

Run these against the current components first, then unchanged against the refactor. Use fake timers for CAPTCHA and OTP, and mock RPC/infra boundaries.

## Flow A characterization tests

### A1. Full reset across modal sessions

1. Open Event A.
2. Fill phone/name/level, select a slot, receive OTP, create a payment order and reach payment.
3. Close the modal.
4. Open Event B.

Assert:

- initial step is correct for Event B;
- phone, name, level and OTP are empty/default;
- no slot is selected;
- no old error is visible;
- no old payment amount, bank number or `reference_code` is visible;
- no dev OTP is visible;
- CAPTCHA submit remains disabled until Event B receives a new token;
- no timer from Event A changes Event B.

Also resolve a delayed Event A request after Event B opens and assert that Event B remains unchanged.

### A2. Member skip-OTP path

Assert that a known member:

- opens on the member confirmation UI;
- never sees phone or OTP steps;
- calls the member RPC, not request/verify OTP;
- sends the selected `slotId`;
- cannot submit when slots are configured and none is selected.

### A3. Slot rendering and validation

For a fixture with one available and one full slot, assert:

- available slot displays the exact current `X/Y chỗ còn lại` text;
- full slot displays the exact current `"Full"` badge;
- full slot is disabled;
- no configured slots means slot selection is not required;
- configured slots with no selection maps `slot_required` to the current localized message;
- `slot_not_found` and `slot_full` map to their distinct messages.

### A4. Turnstile lifecycle

Assert:

- submit is disabled before token arrival;
- token arrival enables submit when other fields are valid;
- changing the phone clears the token and disables submit;
- every OTP send attempt clears the token, for both success and server failure;
- after 20 seconds without a token, the exact timeout text and `Tải lại CAPTCHA` control appear;
- reload clears timeout state and requires a new token.

### A5. OTP cooldown and delivery channel

With fake timers, assert:

- resend is unavailable at 59 seconds and available at 60 seconds;
- the SMS fallback link appears only when `lastOtpChannel === 'zalo'`;
- it does not appear after `sms` or `dev`;
- dev OTP appears in the amber box only after a dev response;
- a later non-dev response removes the dev OTP.

### A6. Payment routing matrix

Cover four rows:

| Price | Payment enabled | Expected |
|---|---:|---|
| 0 | either | success |
| > 0 | false | success |
| > 0 | true, order created | payment |
| > 0 | true, server returns `payment_not_enabled` | success, no visible error |

### A7. Payment pre-claim/post-claim UI

Before claim, assert presence of:

- amount;
- VietQR image;
- bank number and copy control;
- reference code;
- `Tôi đã chuyển tiền`;
- the correct later-payment string.

For prepayment-required events, assert:

- `Tôi sẽ thanh toán sau` is used instead of `Sẽ thanh toán tại sân`;
- the amber auto-cancel deadline warning is visible.

After claim, assert:

- green claimed banner is visible;
- reference code remains visible;
- pre-claim controls are no longer shown.

### A8. Two local-storage writes

Assert:

1. `saveMyRegistration` is called after successful OTP/member verification.
2. It is called again after payment-order creation.
3. The second saved record contains `reference_code`.
4. Existing registration/magic-link fields are retained in the second record.

### A9. Success-step conditional cards

Assert the five-card structure and conditions:

- success banner always appears;
- Zalo OA CTA appears;
- payment instructions appear only under the current paid/payment condition;
- reference card shows the amber unpaid badge only for prepayment-required and unclaimed;
- magic-link card includes copy, open and screenshot hint;
- recovery email can be skipped without blocking close;
- footer includes Zalo group and close actions.

### A10. Error-code mapping table

Use a parameterized unit test asserting every listed server code maps to its current i18n key. This is cheaper and more reliable than driving 20 full modal interactions.

---

## Flow B characterization tests

### B1. Step-5 validity matrix

Assert:

1. Both fees zero, bank fields empty → valid.
2. Player fee positive, bank fields empty → invalid.
3. Team fee positive, bank fields empty → invalid.
4. Positive fee with missing bank → invalid.
5. Account number with 5 digits → invalid.
6. Account number with 6 digits → valid if other fields are valid.
7. Account number with 20 digits → valid.
8. Account number with 21 digits or non-digits → invalid.
9. Holder name trimmed length 2 → invalid.
10. Holder name trimmed length 3 → valid.

Also assert that the same validity controls both Next/Submit state and final submit acceptance.

### B2. Discount boundary fixture

Create a fixed fixture, for example:

- known base fee;
- first tier covering slots 1–10 at 20%;
- second tier covering the next configured range.

Assert exact preview text and amounts for:

- slot 1;
- slot 10;
- slot 11;
- last slot in the second tier;
- first slot without a discount.

Use the app’s current rounding and exact currency formatting as expected values.

### B3. Add/remove discount rows

Assert:

- adding a row creates the current default values;
- editing a row immediately updates the preview;
- removing the first/middle row recomputes all displayed slot ranges correctly;
- submission payload contains only remaining tiers in current order.

### B4. QR synchronization

With valid positive fees and bank details, assert the QR request/image reflects:

- selected bank;
- current account number;
- current holder name;
- current payable amount.

Then change each field individually and assert the preview updates. If an older async QR result resolves last, assert it does not replace the preview for newer values.

### B5. Back/forward step retention

Fill all Step-5 fields and discount rows, go to Step 4, then return to Step 5.

Assert every value and the QR preview are retained.

### B6. Positive-to-zero fee transition

Enter positive fees and valid bank details, then change both fees to zero.

Assert:

- Step 5 becomes valid without bank requirements;
- current hidden/visible bank-field behavior is preserved;
- the submitted payload matches the current implementation.

### B7. Bilingual copy inventory

Render Step 5 once in Vietnamese and once in English. Assert every current label, placeholder, hint, discount line and validation string. This test should be created before moving the ternaries to i18n.

### B8. Player-facing pending-payment chip

Characterize the current output:

- claimed but unconfirmed payment uses the current status label;
- it currently receives the red `"live"` token/class.

Keep this parity assertion during the refactor, then change it in the separate UX-fix commit described below.

---

## 4. UX fixes worth making—but not inside the refactor

### Fix the red `"live"` token on “claimed but not yet confirmed”

This is worth fixing. Red/live communicates an active match, urgent failure or destructive state, not “payment submitted and awaiting confirmation.”

**Exact fix:**

- Change the chip to a pending semantic token, preferably amber/yellow or neutral.
- Keep the status label explicit, for example the existing equivalent of “Đã báo chuyển khoản — chờ xác nhận.”
- Do not use green until payment is actually confirmed.

However, this is visibly different behavior. Make it a separate, reviewable commit immediately before or after ARCH-02/03:

1. characterization test records the current red class;
2. refactor passes unchanged;
3. UX-fix commit updates the class and expected screenshot/assertion.

### Other issues to preserve during the refactor

Do not bundle these changes into the extraction:

- translating the `"Full"` badge;
- changing CAPTCHA’s 20-second timing;
- changing resend from 60 seconds;
- changing `payment_not_enabled` from silent success to an explanation;
- changing whether zero-fee bank details are retained;
- changing success-card order;
- rewriting Vietnamese or English strings;
- consolidating the two local-storage writes into one.

The safest sequence is:

1. Add characterization tests.
2. Centralize hardcoded copy with byte-for-byte output parity.
3. Perform the layer extraction.
4. Pass the same tests.
5. Make the pending-payment chip color correction as a separate UX commit.