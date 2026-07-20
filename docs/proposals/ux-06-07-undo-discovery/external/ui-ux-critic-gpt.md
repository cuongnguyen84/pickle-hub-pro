# GPT-5.6 — ui-ux-critic (vòng 1)

> Lưu nguyên văn. Phần 1 = prompt gửi đi, phần 2 = reply nhận về. Không biên tập.
>
> Lệnh: `node scripts/agents/ask-model.mjs --provider openai --system "You are a senior product designer reviewing a mobile-first bilingual (Vietnamese-primary) sports web app. Be specific and concrete. Name the exact element and the exact fix. No generic design platitudes." --prompt-file ... --out ...`

---

## 1. Prompt đã gửi (nguyên văn)

````markdown
# Change review brief — ThePickleHub (solo-operated, ~2000 users, ~95% Vietnamese)

You cannot see the repo. Everything you need is below. All facts were verified by reading files.

## Product
Bilingual VI/EN pickleball platform. React 18 + Vite SPA on Cloudflare Pages. Supabase Postgres (RLS) + ~50 Edge Functions. Cloudflare Pages Functions do SEO prerendering for bots (SSR HTML cached in KV, key `pr:v30:${pathname}`, TTL 6h for tournament pages, 5min for hub lists). Capacitor + a separate native SwiftUI iOS app. One operator, no on-call rotation.

## Two proposed features

### UX-06 — "undo/rollback for reversible destructive organizer actions"
Note: the operator says NO real incident has ever happened. This is precautionary.

Verified current state:
- There are 4 "community tournament" formats: quick_tables, doubles_elimination_tournaments, flex_tournaments, team_match_tournaments.
- Organizer deletes them from one screen. 3 of 4 are a **raw client-side `supabase.from(<table>).delete()`** from the browser, relying on Postgres `ON DELETE CASCADE` to wipe child rows (matches, teams, registrations, referees). The 4th (quick_tables) calls an RPC that cascades manually in its body.
- **No check for existing registrations or completed payments before deleting.** No refund function exists anywhere in the codebase. Payment flow is Vietnamese bank-transfer/VietQR: a "create payment order" + "mark payment claimed" pair, no card processor, no automated refunds.
- No table has a `deleted_at` column. "Soft delete" today only exists as TEXT `status` columns on social events.
- RLS on these tables: `FOR SELECT USING (true)` — fully public read (share-link model). UPDATE and DELETE policies are both `created_by = auth.uid()` (plus an admin-any policy). So update rights and delete rights are the same set.
- Reading these 4 tables happens at ~83 call sites across the SPA, plus a Cloudflare Pages Function SSR renderer that renders each format by share_id for bots.

Proposal shape: add `deleted_at` soft-delete + a restore window, replacing hard delete.

### UX-07 — "simplify player discovery-to-registration journey"
Verified current state:
- Discovery: `/tournaments` page, "Community" tab, lists the 4 formats, links to `/tools/<format>/<share_id>`.
- At the tournament page, registration **requires a full account**: if not logged in the form renders a login wall and redirects to `/login?redirect=...`.
- By contrast, **social events already allow guest registration** with no account: phone OTP flow.
- The OTP send function is well defended: Cloudflare Turnstile invisible CAPTCHA (required in prod), per-IP limit 5 successful OTPs / 15 min, per-phone limit 3 / 15 min, plus a global per-day SMS budget cap. SMS costs real money.
- **Crucially: that OTP function is hard-scoped to social events.** It takes an `event_id`, validates it is a UUID, and looks the row up in the `social_events` table. It cannot currently serve a tournament.

Proposal shape: open a guest (no-account) registration path for the 4 tournament formats, mirroring social events.

## Verified concurrency facts (this is the part I most want challenged)
- Social event registration was hardened after a confirmed race: registration now goes through Postgres RPCs using **advisory locks** for capacity enforcement (both guest and member paths). This was a real, reproduced bug.
- **doubles_elimination_tournaments** has a registration RPC that does: `SELECT count(*) FROM teams WHERE tournament_id = $1`, compares to `team_count` capacity, then later `INSERT`s the team. I read the whole function: **there is no advisory lock, no `FOR UPDATE`, no unique constraint on capacity**. It is a bare check-then-insert. The function is defined once and never redefined by a later migration.
- **quick_tables** registration is not an RPC at all — it is a plain client-side `.insert()` into `quick_table_registrations` from the browser, with **no capacity check anywhere in the database**. Capacity/approval appears to be organizer-side moderation after the fact.

## Constraints
- CI-enforced total bundle ceiling 1970 KB gzipped, roughly 20 KB headroom left.
- Migrations are applied directly to the production database via a management API; `git revert` does not undo them.
- The native iOS app ships through App Store review; App Store submission is currently blocked for unrelated reasons, so native changes cannot be shipped or reverted quickly.
- House rule: instrument before optimizing; no claiming conversion improvements without a baseline. There is currently ZERO funnel instrumentation on any tournament registration path (it exists only for social events), so the tournament funnel is completely blind.
- A known recurring bug class in this codebase: a migration creating a new table/column without an explicit `GRANT` block causes `42501 permission denied` for real clients, because the dashboard SQL editor runs as superuser and masks it. This has happened 3+ times.

## Your task
Find the specific ways this breaks in production. Name mechanism, trigger, and the user-visible symptom. Be concrete about which of the two features is more dangerous and why. If some part is genuinely safe, say so briefly. Reject generic risk language. If you think a part should simply not be built, say that plainly.
````

---

## 2. Reply của GPT-5.6 (nguyên văn)

````markdown
## Q1 — Destructive organizer actions

### 1. Priority by real user harm

#### 1) A — Hard-delete tournament: critical

This is the only action that can irreversibly destroy:

- Other people’s registrations
- Match and team history
- Referee assignments
- Records connected to confirmed payments

The current modal is not enough because it hides the two facts that matter most: **how many people are affected and whether anyone paid**.

**Minimum high-value intervention:**

1. Add a **server-side deletion eligibility check**, not just UI confirmation.
2. Permit hard delete only when the tournament has:
   - `0` registrations
   - `0` confirmed payments
   - Ideally `0` started/completed matches
3. Show live counts in the AlertDialog.
4. Revalidate those counts inside the delete transaction so a late registration cannot race the confirmation.
5. If any payment exists, block deletion entirely.

Longer term, hard delete should be restricted to empty drafts. Once a player registers, the organizer should get **“Hủy giải” or “Lưu trữ”**, preserving records, rather than “Xóa”.

This is worth building even with no past incident. The probability may be low, but the consequence is disproportionate and affects other people’s money.

---

#### 2) D — Removing people from teams: high

The captain’s reject control is the most accident-prone individual interaction:

- Icon-only “X”
- Approximately 26px high
- Only about 10px from the opposite action
- Permanent
- No notification
- No undo

**Exact fixes:**

- Replace the green check and X icons with two labeled controls:
  - `Duyệt`
  - `Từ chối`
- Make each control at least **44×44 CSS px**.
- Use at least **12px separation** between them.
- Do not rely on green/red alone.
- On `Từ chối`, open an AlertDialog:
  - Title: `Từ chối yêu cầu tham gia?`
  - Body: `Yêu cầu của Minh Anh sẽ bị xóa. Người này có thể gửi lại yêu cầu.`
  - Buttons: `Giữ yêu cầu` / `Từ chối`

Better data behavior is to retain the request with `status='rejected'` and notify the applicant. If that is not available yet, confirmation is the minimum.

For `Rời đội` / `Rút đăng ký`, add a standard AlertDialog before firing:

- `Rời đội này?`
- `Bạn sẽ mất vị trí trong đội và có thể phải đăng ký lại.`
- `Ở lại` / `Rời đội`

Also raise all standard buttons from ~41px to at least **44px minimum height**.

---

#### 3) C — Hand-rolled cancel-event modal: medium

This creates accessibility failures and accidental dismissal, but the underlying cancellation is reversible and preserves records.

**Exact fix:** delete the custom fixed `<div>` implementation and rebuild it with the same shadcn/ui `AlertDialog` used elsewhere.

That gives you:

- `role="alertdialog"`
- `aria-modal`
- Correct title and description associations
- Focus trapping
- Focus return to the triggering button
- Escape behavior
- No accidental backdrop dismissal

Do not patch these features individually into the custom overlay. Replacing it is both smaller and safer.

---

#### 4) B — Retyping the event title: low harm, high unnecessary friction

It is bad friction for this context:

- Long Vietnamese title
- Accented input through Telex/VNI
- One-handed use
- Outdoor interruptions
- Underlying operation is soft and technically reversible

The user has already made the decision; typing the title tests keyboard accuracy, not comprehension.

**Remove the text input entirely.** Keep a normal AlertDialog that shows the affected count:

- Title: `Hủy sự kiện?`
- Body: `12 đăng ký sẽ bị hủy. Sự kiện sẽ không còn nhận người tham gia.`
- Buttons: `Giữ sự kiện` / `Hủy sự kiện`

The stronger gate should not “move” from event cancellation to tournament deletion as another long-name typing exercise. For tournament deletion, use **eligibility rules and truthful consequences**, not arbitrary transcription.

---

### 2. A five-second undo toast is wrong for tournament deletion

It does not fit this action or this user:

- The deletion is currently irreversible at the data layer.
- Five seconds is too short outdoors.
- The user may lock the phone or switch to Zalo.
- Toasts disappear on navigation and app lifecycle changes.
- Restoring a database cascade reliably is much more complicated than restoring one row.
- Calling the button “Hoàn tác” would be dishonest unless the system can fully restore every dependent record.

Do not perform a hard delete and then pretend it can be undone.

### Correct pattern

#### Minimum version now

- Run a server-side eligibility check.
- Block deletion when registrations or confirmed payments make it unsafe.
- Use an AlertDialog with exact counts and an explicit button:
  - `Xóa vĩnh viễn`
- Revalidate on submit.

#### Proper future version

- `Hủy giải` changes the tournament to a preserved cancelled state.
- `Lưu trữ` removes it from normal discovery.
- Hard delete is available only for empty drafts.
- Optional permanent purge happens later, not through a five-second client toast.

If you later add undo, it should operate on a durable soft-delete state for hours or days—not a transient toast.

---

### 3. Delete-tournament confirmation copy

Use singular/plural logic where practical, but do not make the sentence complicated.

#### Vietnamese — allowed state, no confirmed payments

**Title**

> Xóa vĩnh viễn giải đấu?

**Body**

> “Cúp Tân Bình” có 24 đăng ký và 0 thanh toán đã xác nhận. Toàn bộ trận đấu, đội và phân công trọng tài sẽ bị xóa. Không thể hoàn tác.

**Buttons**

- `Giữ lại`
- `Xóa vĩnh viễn`

For an empty draft:

> “Cúp Tân Bình” chưa có đăng ký hoặc thanh toán. Giải đấu sẽ bị xóa vĩnh viễn. Không thể hoàn tác.

#### English

**Title**

> Permanently delete tournament?

**Body**

> “Tan Binh Cup” has 24 registrations and 0 confirmed payments. All matches, teams, and referee assignments will be deleted. This cannot be undone.

**Buttons**

- `Keep`
- `Delete permanently`

On 390px, make the actions full-width and stacked if the destructive label does not fit comfortably. Do not shorten it back to the ambiguous `Xóa`.

Also ensure “confirmed payments” maps to the actual manual payment state. Do not say merely `đã thanh toán` if the system only knows that an organizer has marked the transfer as received.

---

### 4. State when confirmed payments exist

This should not be a confirmation dialog. It should be a **blocked state with no destructive button**.

#### Vietnamese

**Title**

> Không thể xóa giải đã có thanh toán

**Body**

> 6 trong 24 đăng ký đã được xác nhận thanh toán. Hãy giữ lại dữ liệu giải để đối soát và hoàn tiền cho người chơi.

**Actions**

- Primary: `Xem đăng ký`
- Secondary: `Đóng`

If you add tournament cancellation:

- Primary: `Hủy giải thay vì xóa`
- Secondary: `Xem đăng ký`

#### English

**Title**

> This tournament cannot be deleted

**Body**

> 6 of 24 registrations have confirmed payments. Keep the tournament records so payments and refunds can be reconciled.

**Actions**

- `View registrations`
- `Close`

Do not offer “Delete anyway,” including to a normal admin. Because there is no refund workflow, deleting would remove the very evidence needed to resolve refunds.

At minimum, the backend should return a specific error such as `TOURNAMENT_HAS_CONFIRMED_PAYMENTS`; do not rely on a disabled button alone.

---

## Q2 — Discovery to registration

### 1. Problems ranked by expected registration impact

#### 1) Hard account wall on tournament registration

This is the highest-impact problem and the single highest-leverage change.

It appears at the moment of maximum intent, after the player found the tournament and decided to register. It also affects deep-link users who bypass every discovery problem.

**Highest-leverage change:** reuse the social-event phone + OTP guest path for tournaments.

---

#### 2) Wrong default destination: “Xem Pro”

The default logic is functionally broken because historical pro rows make “Watch” permanently win. A player trying to join a local tournament lands in unrelated professional broadcasts.

Fixing the status query is necessary, but not sufficient. The broader issue is intent: `/tournaments` should default to joining tournaments, not watching broadcasts.

---

#### 3) First tournament buried below ~1,070px

The header and two hero cards prioritize brand exposition, watching, and creation before the player’s primary task.

The `Tự tổ chức` card is especially misplaced for a player trying to register. It sends the player into organizer tooling before showing any joinable tournament.

---

#### 4) Four mandatory format tabs

These force players to understand an organizer decision before they can find a tournament. Most invited players do not know whether their friend selected Quick Tables, Flex, or Team Match.

---

#### 5) Ambiguous labels and organizer-oriented descriptions

`Cộng đồng` describes ownership/category, not what the player can do. The format descriptions explain tournament construction rather than helping a player decide whether to join.

---

### 2. Better labels

`Xem Pro` and `Cộng đồng` are not a clear task pair.

Recommended top-level labels:

- `Tham gia giải`
- `Giải chuyên nghiệp`

If livestream is central:

- `Tham gia giải`
- `Xem trực tiếp`

Or slightly more explicit:

- `Giải đang mở đăng ký`
- `Giải chuyên nghiệp`

My preference on mobile is:

> **Tham gia giải** | **Xem giải pro**

It is short enough for two tabs and clearly distinguishes participation from viewing. “Pro” is understandable to much of this audience, but `Giải chuyên nghiệp` is better in headings and accessibility labels.

The `/tournaments` default should be `Tham gia giải`. Do not choose the default based on whether historical database rows happen to exist.

If viewing is a substantial product area, give it a stable route such as `/watch` instead of dynamically transforming `/tournaments`.

---

### 3. Remove formats from primary player navigation

Players should see the format, but they should not have to choose it before seeing tournaments.

### Alternative structure

Show one combined list of joinable community tournaments, sorted by:

1. Registration open
2. Soonest registration deadline
3. Soonest start date
4. Proximity, if location is available and permitted

Above the list:

- Search field: `Tìm theo tên giải hoặc mã mời`
- Filter button: `Lọc`
- Optional location control: `TP.HCM`

The filter bottom sheet can include:

- `Ngày thi đấu`
- `Khu vực`
- `Trình độ`
- `Phí tham gia`
- `Thể thức`

Each tournament row/card should show the format as secondary metadata:

> **Cúp Tân Bình 2025**  
> 12/16 suất · 200.000đ · Tân Bình  
> Đôi loại kép · Hạn đăng ký 18/5

That lets knowledgeable players filter by format without making everyone decode four product names.

Move the detailed format explanations into:

- Tournament creation
- Organizer documentation
- An optional `Thể thức thi đấu` section on the individual tournament page

In Vietnamese UI, do not show four unexplained English labels. If the product names must remain branded, pair them with Vietnamese:

- `Quick Tables · Chia bảng`
- `Doubles Elimination · Loại kép`
- `Flex Format · Tùy chỉnh`
- `Team Match · Đồng đội`

---

### 4. Restructure the top of the page

The target should be: **at least one real tournament card visible in the first 390×844 viewport**, not after two swipes.

### Recommended mobile order

1. **Compact top bar**, 48–56px  
   Back/home affordance, page title, language/account controls as needed.

2. **Compact editorial header**, approximately 110–140px  
   Keep the serif typography, but reduce the H1 to two lines.

   Suggested copy:

   **Kicker**
   > XEM GIẢI · VÀO SÂN

   **H1**
   > Tìm giải để tham gia.

   **Supporting line**
   > Giải cộng đồng đang mở đăng ký trên khắp Việt Nam.

3. **Task tabs**, 44–48px  
   - `Tham gia giải`
   - `Xem giải pro`

4. **Search and filter row**, approximately 52px  
   - `Tìm giải hoặc mã mời`
   - `Lọc`

5. **Status chips**, horizontally scrollable if necessary  
   - `Đang mở đăng ký`
   - `Sắp diễn ra`
   - `Tất cả`

6. **First tournament card**

This should put the first tournament around 300–380px from the top.

### Where the existing hero cards should go

- Remove both from above the list on mobile.
- Put `Tự tổ chức` after the first 4–6 tournament rows as a compact banner:
  > Muốn tự tổ chức? Tạo bracket trong 60 giây.
- Move `Xem giải pro` into its own tab/page rather than advertising it above the participation list.
- On desktop, the editorial hero can remain larger because viewport and intent scanning differ.

The editorial identity should come from typography, contrast, rules, and composition—not from making users scroll through 530px of unrelated cards.

Also ensure every share action emits the tournament’s canonical deep URL. A Zalo invite should never point to the generic `/tournaments` page unless the sender explicitly chose to share discovery.

---

### 5. Guest tournament registration

The asymmetry is severe. Fees and DUPR requirements justify additional validation; they do **not** justify a blanket full-account requirement.

An account is a persistence mechanism. The actual tournament requirements are:

- A verified contact method
- A unique participant identity
- Eligibility information
- Payment state
- Possibly a verifiable DUPR profile

Those can be handled in a guest transaction.

### Recommended tournament guest flow

1. Player taps `Đăng ký`.
2. Collect:
   - Họ và tên
   - Số điện thoại
   - OTP
3. Collect only tournament-specific requirements:
   - Partner/team selection
   - DUPR ID or profile link
   - Rating/division
   - Date of birth if genuinely required
4. Show fee and cancellation terms before submission.
5. Create registration under the verified phone number.
6. For paid tournaments:
   - Reserve the slot as `Chờ thanh toán`
   - Show VietQR/bank transfer details
   - Show a clear payment deadline
   - Mark payment separately when manually confirmed
7. After registration, offer—not require—account creation:
   > Lưu thông tin để đăng ký nhanh lần sau?
   > `Tạo tài khoản` / `Để sau`

When the player later creates an account with the same verified phone number, attach the guest registration to that account.

### DUPR-specific exception

If a tournament requires a verified DUPR rating, ask the player to connect or verify DUPR during registration. Only require a ThePickleHub account if there is a concrete technical dependency that cannot work without one—and explain that requirement before the player fills the form.

Do not use account creation as a proxy for identity verification. A newly created account is not inherently more trustworthy than a phone-verified guest.

---

### 6. Instrumentation timing

Ship instrumentation **before the funnel redesign**, as a small release, then collect at least one representative registration cycle—ideally a full week including a weekend.

Do not wait months, but do preserve a baseline. Otherwise the product will never know whether guest OTP, the new default, or the compressed page changed completion.

Instrument both direct-link and discovery journeys:

- `tournament_list_viewed`
- `tournament_impression`
- `tournament_opened`
- `registration_cta_clicked`
- `registration_form_viewed`
- `auth_wall_viewed`
- `guest_otp_started`
- `guest_otp_verified`
- `eligibility_failed`
- `registration_submitted`
- `registration_completed`
- `payment_instructions_viewed`
- `payment_confirmed`

Useful properties:

- `tournament_id`
- `format`
- `has_fee`
- `requires_dupr`
- `language`
- `authenticated`
- `entry_route`: direct link, list, search, Zalo/Facebook referrer where available
- `ui_version`

Do not log phone numbers or names in analytics.

Then ship the redesigned funnel with a new `ui_version`. The safety and accessibility fixes in Q1 do not need to wait for funnel instrumentation; those are correctness fixes, not conversion experiments.

---

## Vietnamese copy that currently feels translated

### `◆ Xem hoặc thi đấu — tùy bạn`

Understandable, but slightly literal. More natural:

> ◆ Xem giải hay vào sân — tùy bạn

Or more editorial:

> ◆ Xem trận hay nhập cuộc

### `Giải đấu đáng xem, hoặc tự tổ chức.`

Awkward because “đáng xem” and “tự tổ chức” are not parallel. Suggested:

> Giải hay để xem. Công cụ gọn để tổ chức.

For the player-first page:

> Tìm giải để tham gia.

### `Sóng trực tiếp từ PPA...`

`Sóng trực tiếp` reads like a translation of “live feeds.” Use:

> Theo dõi trực tiếp PPA, APP, MLP và các tour khu vực; hoặc tạo giải cộng đồng trong chưa đầy một phút.

### `Mọi tour đấu, một nguồn xem.`

This sounds translated. Use:

> Xem mọi tour tại một nơi.

### `60 giây có ngay bracket.`

More natural:

> Tạo bracket trong 60 giây.

### `Đang diễn ra`

This is the wrong primary status for registration discovery. Use:

- `Đang mở đăng ký`
- `Sắp diễn ra`
- `Đã kết thúc`

The existing four format descriptions are acceptable as organizer documentation, but they should not occupy the primary player funnel.````
