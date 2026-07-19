## 1. Priority order for O2→O4

### 1 — UX-04: draft autosave
This directly addresses the largest documented failure: organizers partially complete a form, leave, and lose their work.

**Exact fix**
- Autosave every create flow locally after field changes.
- Restore the draft when the organizer returns to the same flow.
- Add a persistent save-state line to the mobile action bar.
- Do not require the organizer to press **“Lưu nháp”** to prevent data loss.

### 2 — UX-05: pre-publish validation and recovery
This addresses organizers getting stuck near the end, especially in payment configuration.

**Exact fix**
- In the **Fees / Phí** step, add a required choice before showing bank fields:
  - **Miễn phí**
  - **Có thu phí**
- When **Miễn phí** is selected, completely hide bank code, account number, account name, and prepayment deadline.
- Show helper text: **“Không cần thông tin ngân hàng.”**
- When **Có thu phí** is selected, reveal the fields and mark only the genuinely required ones:
  - Ngân hàng *
  - Số tài khoản *
  - Tên chủ tài khoản *
  - Hạn thanh toán trước — **Không bắt buộc**
- On publish failure, show a linked error summary such as:
  - **“Còn 3 mục cần kiểm tra trước khi đăng.”**
  - Each row names the step and field, for example **“Phí · Chưa nhập số tài khoản”**.
  - Tapping the row opens that step, scrolls to the field, and focuses it.

The payment-mode change should ship inside UX-05 rather than waiting for the full UX-03 scope.

### 3 — UX-03: progressive disclosure
Useful, particularly for TeamMatch, but the broad initiative is less directly tied to the known data-loss problem.

Prioritize:
- Dreambreaker consolidation.
- Optional payment settings.
- Rare format controls.

Do not spend the first batch redesigning every advanced field.

### 4 — UX-02: templates
Templates will reduce setup time, but they do not fix lost work or payment confusion. Measure template usage and completion separately after autosave and recovery are in place.

### 5 — UX-01: checklist/status model
As currently framed, this risks adding a second progress interface beside the existing wizard indicator. Narrow it to:
1. Unifying the existing step indicator.
2. Making drafts resumable from the club dashboard.

### Recommended roadmap

| Order | Task | Expected effect |
|---|---|---|
| 1 | UX-04 | Primary O2→O4 mover |
| 2 | UX-05, including payment-mode branching | Primary O2→O4 mover |
| 3 | UX-03 | Secondary improvement |
| 4 | UX-02 | Speed/convenience |
| 5 | UX-01, narrowed | Consistency and discoverability |

---

## 2. Autosave: local or database?

### Recommendation: local-first autosave now; server draft sync later

For this batch, use device-local autosave across all five flows.

- Web: preferably IndexedDB behind a draft-storage abstraction; localStorage is acceptable if payloads remain small.
- Native: local persisted storage through the corresponding Swift draft repository.
- Save after approximately 750 ms of inactivity, on field blur, and when the app/page backgrounds.
- Key the draft by organizer, club, flow type, and draft instance.
- Store a schema version so old draft payloads can be migrated or safely discarded.

This is the right immediate choice because it:
- Works on flaky 4G.
- Does not wait for four table migrations, RLS changes, and native API parity.
- Protects work immediately.
- Avoids creating incomplete tournament rows in production tables.

### Be explicit that it is device-local

Do not show the generic **“Đã lưu lúc 14:32”** if the data is only on that device. That implies cross-device persistence.

Use:

> **Đã lưu trên thiết bị lúc 14:32**

If a save is in progress:

> **Đang lưu trên thiết bị…**

After restoration:

> **Đã khôi phục bản nháp trên thiết bị này.**

Do not say **“Sẽ đồng bộ khi có mạng”** unless a real server synchronization queue exists.

### Where the indicator should sit on a 390 px screen

Put it inside the **sticky bottom action bar**, directly above the Back/Continue or Publish buttons:

```text
Đã lưu trên thiết bị lúc 14:32

[ Quay lại ]  [ Tiếp tục ]
```

Specifications:
- Save line: 12–13 px secondary text.
- One line only.
- Reserve its height so the buttons do not jump between “Đang lưu…” and “Đã lưu…”.
- Use an inline spinner for saving and a semantic success icon for saved.
- Do not show a toast after every autosave.
- When the keyboard is open, the save can continue silently; avoid forcing the entire sticky footer above a small Android keyboard if it covers the active field.

### Longer-term server model

Do not necessarily add `draft` to all four tournament status enums. A cleaner option is a shared draft table, for example:

- `organizer_drafts`
- `user_id`
- `club_id`
- `flow_type`
- `draft_id`
- `payload_json`
- `schema_version`
- `updated_at`

Apply owner/club RLS to that table. This keeps incomplete data out of real tournament records and supports cross-device resume for all five flows.

For the current Social Event flow:
- Keep **“Lưu nháp”** as an explicit server-save action for now.
- Also run local autosave so closing the screen cannot lose changes.
- Label the two states truthfully:
  - Local autosave: **“Đã lưu trên thiết bị lúc…”**
  - Successful server draft: **“Đã lưu bản nháp”**

---

## 3. Checklist/status model without redundant progress UI

### Replace both wizard styles with one unified step header

Remove:
- Social Event’s tiny dots plus separate **“Bước 1/2”**.
- Tournament flows’ **“◆ Bước 1/3”** mono kicker.

Use one component in all five flows:

```text
Bước 2/5 · Mẫu trận
━━━━━━━━░░░░░░
```

On mobile:
- Show current step number, total, and current step name.
- Show one progress bar.
- Make the header tappable to open a bottom sheet containing the full step list.

Example bottom sheet:

```text
Thiết lập TeamMatch

✓ 1. Thông tin cơ bản
● 2. Mẫu trận
  3. Thể thức
  4. Phí
```

Rules:
- A check means the step’s required fields are valid, not merely visited.
- The current step uses the active marker.
- A step containing errors uses the semantic error icon and error text.
- Do not add a separate checklist card inside the form.

For Flex Tournament, which is single-page, do not show **“Bước 1/1”**. Use the normal page title and section headings.

### Draft resume belongs on the club dashboard

The wizard should show save state, but draft discovery should live on the **club dashboard**, where organizers decide what to work on.

Add a section above published/upcoming events:

> **Bản nháp**

Each draft card should show:

```text
TeamMatch chưa đặt tên                  Nháp
Đã chỉnh sửa lúc 14:32
Còn thiếu: Thể thức, Phí

[Tiếp tục thiết lập]     [⋯]
```

The overflow menu contains:
- **Xóa bản nháp**

If the draft is local-only, add:

> **Trên thiết bị này**

Do not present local-only drafts as available on another device.

Inside the wizard, recovery should be automatic. Do not make the organizer choose between **“Tiếp tục”** and **“Bắt đầu lại”** every time. Restore the draft and show a dismissible confirmation with a secondary **“Bắt đầu lại”** action if needed.

---

## 4. Progressive disclosure in TeamMatch

### Dreambreaker should not have its own full step

Dreambreaker is an optional rule within the tournament format, not a top-level organizer goal. Giving it a dedicated step makes a niche option appear mandatory.

Change TeamMatch from five steps to four:

1. **Thông tin cơ bản**
2. **Mẫu trận**
3. **Thể thức**
4. **Phí**

Inside **Thể thức**, add:

```text
Dreambreaker
[ ] Dùng Dreambreaker khi hòa
```

Default: off.

When enabled, reveal only the associated fields immediately below it. For example:

- Điểm kết thúc
- Cách xoay người chơi
- Thắng cách biệt

Add one concise explanation:

> **Dreambreaker chỉ được dùng để phân định khi hai đội hòa.**

If existing templates require Dreambreaker, enabling that template should turn it on automatically and show the selected values.

### Rule for deciding between a step and a disclosure

Create a full step only when all three are true:

1. Most organizers must make the decision.
2. The section has multiple required fields.
3. Completing it represents a meaningful setup milestone.

Otherwise place it inside the relevant step as:
- A toggle that reveals dependent fields.
- An expandable **“Cài đặt nâng cao”** section.
- A collapsed summary after configuration.

Example:

```text
Cài đặt nâng cao
Thắng cách biệt 2 điểm · Giới hạn 21 điểm
[Chỉnh sửa]
```

### Avoid accordion overload

Do not put every field into an accordion. Within each step:

- Keep required, common fields visible.
- Put rare optional controls into one **“Cài đặt nâng cao”** group.
- Automatically open that group when it contains a validation error.
- Show a one-line summary when collapsed.
- Preserve values when the group is collapsed or disabled unless the organizer explicitly confirms removal.

This prevents both failure modes: one giant page and eight tiny steps.

---

## 5. Canonical Vietnamese and English microcopy

Use different forms intentionally according to grammar:

- **Nháp**: compact status badge.
- **Bản nháp**: noun in headings and sentences.
- **Lưu nháp**: explicit action.
- **Đã lưu bản nháp**: confirmation of an explicit server draft save.

### Draft and autosave strings

| Use | Vietnamese | English |
|---|---|---|
| Compact badge | **Nháp** | **Draft** |
| Draft section/title | **Bản nháp** | **Drafts** |
| Explicit action | **Lưu nháp** | **Save draft** |
| Explicit save in progress | **Đang lưu bản nháp…** | **Saving draft…** |
| Explicit server save success | **Đã lưu bản nháp** | **Draft saved** |
| Local autosave in progress | **Đang lưu trên thiết bị…** | **Saving on this device…** |
| Local autosave success | **Đã lưu trên thiết bị lúc {HH:mm}** | **Saved on this device at {HH:mm}** |
| Server autosave success | **Đã lưu lúc {HH:mm}** | **Saved at {HH:mm}** |
| Restored locally | **Đã khôi phục bản nháp trên thiết bị này.** | **Draft restored on this device.** |
| Resume action | **Tiếp tục thiết lập** | **Continue setup** |
| Delete action | **Xóa bản nháp** | **Delete draft** |
| Start over | **Bắt đầu lại** | **Start over** |

### Unsaved and save-failure strings

| Use | Vietnamese | English |
|---|---|---|
| Unsaved state | **Có thay đổi chưa được lưu.** | **You have unsaved changes.** |
| Save failed | **Chưa thể lưu thay đổi. Vui lòng thử lại.** | **Changes couldn’t be saved. Please try again.** |
| Exit dialog title | **Thoát mà không lưu?** | **Leave without saving?** |
| Exit dialog body | **Các thay đổi chưa được lưu sẽ bị mất.** | **Your unsaved changes will be lost.** |
| Stay action | **Ở lại** | **Stay** |
| Destructive exit | **Thoát mà không lưu** | **Leave without saving** |
| Retry | **Thử lại** | **Try again** |

Only show the exit dialog when a real unsaved state exists. If local autosave completed successfully, let the organizer leave without interruption.

### Validation strings

| Use | Vietnamese | English |
|---|---|---|
| Error summary | **Còn {count} mục cần kiểm tra trước khi đăng.** | **Check {count} items before publishing.** |
| Single error summary | **Còn 1 mục cần kiểm tra trước khi đăng.** | **Check 1 item before publishing.** |
| First-error action | **Đi đến mục đầu tiên** | **Go to first item** |
| Required field | **Vui lòng nhập {field}.** | **Enter {field}.** |
| Required choice | **Vui lòng chọn {field}.** | **Select {field}.** |
| Invalid value | **{field} chưa đúng định dạng.** | **Enter a valid {field}.** |
| Step error count | **{step} · Còn {count} lỗi** | **{step} · {count} errors** |
| Publish failure | **Chưa thể đăng. Vui lòng kiểm tra các mục bên dưới.** | **Couldn’t publish. Check the items below.** |

### Payment strings

| Element | Vietnamese | English |
|---|---|---|
| Section question | **Sự kiện này có thu phí không?** | **Is this a paid event?** |
| Free option | **Miễn phí** | **Free** |
| Paid option | **Có thu phí** | **Paid** |
| Free helper | **Không cần thông tin ngân hàng.** | **No bank information is needed.** |
| Bank field | **Ngân hàng** | **Bank** |
| Account number | **Số tài khoản** | **Account number** |
| Account name | **Tên chủ tài khoản** | **Account holder name** |
| Optional deadline | **Hạn thanh toán trước — Không bắt buộc** | **Prepayment deadline — Optional** |

### Fix the existing missing-fields panel

Replace the hardcoded inline strings, `⚠️` emoji, and `amber-*` classes with the design-system Alert component:

- Semantic variant: `warning` before publish, `error` after a failed publish attempt.
- Design-system warning/error icon, not an emoji.
- Semantic background, border, icon, and text tokens.
- Localized string keys for both VI and EN.
- Each missing-field row is a button/link to the exact field, rather than static warning text.

The panel title should be:

> **Còn {count} mục cần hoàn tất**

After a publish attempt, change it to:

> **Còn {count} mục cần kiểm tra trước khi đăng.**