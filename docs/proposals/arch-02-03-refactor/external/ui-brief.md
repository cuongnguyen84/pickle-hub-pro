# Brief: UX review of a "no-behavior-change" layered refactor of two money flows

Context: ThePickleHub, a bilingual (Vietnamese-primary, ~95% VN users) mobile-first
pickleball web app (React + shadcn/ui + Tailwind), also wrapped in a Capacitor native
shell. Primary user: mid-tier Android, 4G, one-handed, at a noisy court in Saigon.

We are about to do a PURE REFACTOR (ARCH-02 + ARCH-03): split two flows into
domain/application/infra/UI layers. Explicit commitment: **no user-facing behavior
change**. Your job: tell us where a layer-extraction refactor most plausibly breaks the
UX invisibly, and where copy will drift. Be concrete: name the state/string, name the fix.

## Flow A — Social Event registration + VietQR payment (RegistrationModal, 1398 lines)

A single React modal with a `Step` state machine: "phone" | "otp" | "member" | "payment"
| "success". States it handles:
- **member skip-OTP path**: club members open straight to a confirm button (+ slot pick),
  call an RPC instead of OTP.
- **phone step**: name (required), self-rated level (optional select), slot picker
  (required only if organizer configured slots — each slot shows "X/Y chỗ còn lại" or
  "Full" badge, full slots disabled), Cloudflare Turnstile CAPTCHA (submit button DISABLED
  until token arrives; 20s watchdog then shows a "Tải lại CAPTCHA" reload button).
- **otp step**: 6-digit OTP input, 60s resend cooldown, delivery channel can be zalo/sms/dev,
  a "resend via SMS" link shown ONLY when last channel was zalo, dev-mode OTP echoed in an
  amber box (dev only).
- **payment step** (only if price > 0 AND club has payment enabled): a QR step with 2
  sub-states: (1) pre-claim = amount + VietQR image + copyable bank number + reference code
  + "Tôi đã chuyển tiền" / "Sẽ thanh toán tại sân" (or "Tôi sẽ thanh toán sau" if prepayment
  required, which also shows an amber auto-cancel-deadline warning); (2) post-claim = green
  banner + reference code.
- **success step**: 5 stacked cards — success banner, Zalo-OA follow CTA, payment
  instructions (if paid), reference code + amber "unpaid" badge (if prepayment & unclaimed),
  save-link card (magic-link URL, copy + open + screenshot hint), recovery email opt-in
  (optional, skippable), footer (Zalo group + close).
- **error handling**: ~20 server error codes mapped to bilingual i18n strings
  (invalid_phone, already_registered, event_full, slot_required/not_found/full,
  not_a_member, event_not_open family, too_many_otps_ip, captcha_failed,
  daily_budget_exceeded, too_many_otps, otp_mismatch, otp_expired, otp_too_many_attempts,
  sms_send_failed).

Structural details a refactor will touch:
- A single reset useEffect clears ~13 state fields on modal close. If state is extracted
  into a hook, every field must still reset or stale state (e.g. a previous event's
  paymentOrder / selected slot) leaks into the next open.
- Turnstile token is single-use: reset after each send AND on phone change.
- localStorage `saveMyRegistration` is called TWICE — once at verify, again after the
  payment order returns (to fold in the reference_code).
- The `payment_not_enabled` response silently falls back to the success step.
- Copy: almost all i18n-keyed EXCEPT ~4 hardcoded VN strings (Turnstile "Đang xác minh
  trình duyệt…" / "Xác minh trình duyệt quá lâu…", "Tải lại CAPTCHA", "Dev mode OTP",
  and a bookmark footer line branched inline on language).

## Flow B — Team Match (MLP) setup, fee + VietQR (TeamMatchSetup, 1348 lines)

A 5-step organizer wizard: 1 Basic Info, 2 Game Templates, 3 DreamBreaker, 4 Format,
5 Fees. Step 5 (money) handles: rules summary, fee-per-player, fee-per-team, early-slot
discount tiers (add/remove rows, cumulative by registration order, with a live "Slot 1–10:
X đ (−20%)" preview), and a bank trio (bank select + account number [6–20 digits regex] +
holder name) that generates a live VietQR preview image. Step-5 validity: if any fee > 0,
bank + account + name (≥3 chars) all required to proceed/submit.

Critical detail: **Step 5's copy is almost 100% hardcoded inline `language === 'vi' ? ... :
...` ternaries** — ~20 strings (labels, placeholders, discount preview lines, QR hints),
NOT i18n-keyed. The player-facing side (captain pays the fee) is a separate component whose
"claimed but not yet confirmed" status chip is rendered in the RED "live" color token.

## Questions
1. For each flow, which specific state/edge-case is most likely to silently break when
   state/logic is extracted into a hook or lib layer? Rank them.
2. Where is copy-drift risk highest, and what's the concrete guard (e.g. move to i18n first)?
3. What is the minimal behavior-parity test list a solo dev should write BEFORE refactoring
   so "no behavior change" is actually verifiable? Name the exact assertions.
4. Any UX invariant here that is worth FIXING during the refactor vs strictly preserving
   (e.g. the red 'live' token on a pending-payment chip)?
