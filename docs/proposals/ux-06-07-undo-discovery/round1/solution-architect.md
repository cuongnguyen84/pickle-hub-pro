# solution-architect — cụm UX-06 + UX-07

Agent: `solution-architect` · 2026-07-20 · vòng 1 độc lập

> Mọi dữ kiện dưới đây tôi **tự mở file kiểm chứng**, không tin recon. Chỗ nào recon sai
> hoặc thiếu, tôi ghi rõ ở §0.

---

## 0. Đính chính + phát hiện mới của vòng 1

### 0.1 Recon ĐÚNG (tôi verify lại)

- `MyTournaments.tsx:229-247` — `performDelete()` xoá 4 loại giải, **không đọc một dòng
  đăng ký nào trước khi xoá**. Verify thêm: file này **không hề query bảng đăng ký** —
  `counts` (`MyTournaments.tsx:207`) chỉ đếm số giải theo `toolKind`, không phải số người
  đăng ký. Nghĩa là ngay cả muốn chặn ở client cũng phải thêm query mới.
- Dialog xoá (`MyTournaments.tsx:549-577`) là dialog CHUNG cho cả 4 loại, không typed-name,
  và text đã tự nhận `"không thể hoàn tác"`.
- `TeamJoinPanel.tsx:135-145` và `TeamOverviewCard.tsx:259-268` gọi thẳng
  `removeRosterMember({...})` trong `onClick`, **không confirm**. Đúng.
- Native `TeamMatchManageTeamsView.swift:97-102` — `deleteTeam` gọi thẳng repo, không confirm.
- `useConfirm()` tồn tại, `ConfirmProvider` đã mount (`App.tsx:568`).
- Không có hàm refund nào. Tôi grep lại: chỉ có `create-payment-order`, `mark-payment-claimed`,
  `claim_team_payment`, `confirm_team_payment` — không có counterpart hoàn tiền.

### 0.2 Recon THIẾU — 4 dữ kiện đổi kết luận

**(a) Ranh giới tiền hẹp hơn recon gợi ý.** `payment_orders.registration_id` là
`NOT NULL UNIQUE REFERENCES public.event_registrations(id)`
(`20260512130001_payment_orders.sql:24`). Tức **toàn bộ hạ tầng thanh toán chỉ gắn với
social event** — mà social event đã soft-cancel rồi. Trong 4 loại giải hard-delete, chỉ
`team_match_teams` có cột tiền (`payment_status`, `payment_claimed_at`,
`payment_confirmed_at`). QuickTable / DoublesElim / Flex **không có đường tiền nào cả**.

→ Hệ quả lớn: "xoá giải làm mất tiền" chỉ đúng cho **1 trong 4** loại. Ba loại còn lại
xoá thì mất *đăng ký của người khác*, không mất tiền. Mức thiệt hại lý thuyết thấp hơn
intake giả định.

**(b) Blast radius của soft-delete — con số thật.** Đếm call site đọc trực tiếp:

| Bảng | `from("<table>")` trong `src/` + `functions/` + `supabase/functions/` |
|---|---|
| `quick_tables` | 25 |
| `doubles_elimination_tournaments` | 25 |
| `flex_tournaments` | 13 |
| `team_match_tournaments` | 20 |
| **Tổng** | **83** |

Cộng thêm **39 file migration** tham chiếu các bảng này (RPC/view/policy phải soát lại
xem cái nào cần `AND deleted_at IS NULL`). Chưa kể SSR (`functions/_lib/render/`) và
sitemap sẽ phát tán giải đã xoá nếu sót. Đây là con số để bác Option soft-delete, không
phải cảm tính.

**(c) `delete_quick_table` xoá con THỦ CÔNG trong thân RPC**, 3 loại kia dựa
`ON DELETE CASCADE` từ client. Sự bất đối xứng này quyết định thiết kế guard ở §1 —
trigger `BEFORE DELETE` hành xử khác nhau giữa hai đường, và đó lại là *tính năng*,
không phải lỗi (xem Option A).

**(d) 🔴 BUG SỐNG — redirect bị NUỐT sau khi đăng ký tài khoản.** Đây là phát hiện mạnh
nhất của vòng 1 cho UX-07, recon không thấy:

```
Login.tsx:62   const targetUrl = onboarded ? redirectUrl : "/onboarding";
```

Người chơi mới: `/tools/quick-tables/<share_id>` → tường đăng nhập
(`RegistrationForm.tsx:195-201`) → `/login?redirect=/tools/quick-tables/<share_id>` →
tạo tài khoản → **chưa onboarded** → `redirectUrl` **bị vứt**, đi `/onboarding` →
`OnboardingWizard.tsx:86-89` `handleComplete()` đưa về `/nguoi-choi/<username>`.

Giải mà họ muốn đăng ký **biến mất hoàn toàn khỏi luồng**. Không có breadcrumb, không có
banner, không có gì. Người chơi phải tự nhớ đường quay lại.

Đây là **đúng nhóm người quan trọng nhất** của UX-07 (người mới, chưa có tài khoản — chính
là nhóm mà "bắt tạo tài khoản" đang lọc ra). Với họ, luồng discovery→registration hiện tại
có tỉ lệ hoàn thành **bằng 0 do lỗi kỹ thuật**, không phải do friction. Tôi không claim con
số conversion (D1 cấm), nhưng tôi *có* claim đây là lỗi luồng xác định được bằng đọc code,
không cần baseline để biết nó sai.

**(e) `sonner` đã mount sẵn** (`App.tsx:569-570` render CẢ `<Toaster />` radix lẫn
`<Sonner />`). Toast-có-nút-Hoàn-tác là **0 KB dependency mới**. Recon nói "chưa có mẫu"
— đúng là chưa có mẫu, nhưng hạ tầng có sẵn, chi phí là code chứ không phải bundle.

---

# UX-06 — undo/rollback cho thao tác destructive

## Trả lời thẳng câu hỏi 4 ngày

**KHÔNG đáng 4 ngày. Đáng khoảng 3 nửa ngày (web) + 1 nửa ngày (native).**

Lý do, theo thứ tự trọng lượng:

1. **Không có sự cố thật** (Cuong: "chưa từng đau thật"). ~2k user, 1 admin, số organizer
   nhỏ. Cơ chế undo toàn cục là phòng thủ cho tần suất chưa từng quan sát.
2. **Mức thiệt hại lý thuyết nhỏ hơn tưởng** — §0.2(a): 3/4 loại giải không dính tiền.
3. **Undo thật (soft-delete) tốn 83 call site + 39 migration để soát** — chi phí lệch bậc
   so với rủi ro.
4. **Có cách rẻ hơn nhiều mà loại bỏ ĐÚNG kịch bản tệ nhất**: chặn-trước ở tầng DB. Xoá
   nhầm giải rỗng = mất 2 phút gõ lại. Xoá nhầm giải có 20 người đăng ký = không cứu được
   bằng undo trong 5 phút đâu, vì organizer thường chỉ phát hiện sau nhiều giờ.

> Nguyên tắc tôi dùng: **undo là để sửa hối tiếc của CHÍNH mình; guard là để bảo vệ dữ liệu
> của NGƯỜI KHÁC.** Ở đây thứ đáng bảo vệ là đăng ký của người khác → guard thắng undo.

## Phân loại KHÔI PHỤC ĐƯỢC vs KHÔNG

| Thao tác | Khôi phục được? | Cơ chế đúng |
|---|---|---|
| Xoá giải **rỗng** (0 đăng ký) | Không cần | Confirm 1 bước như hiện tại, đủ rồi |
| Xoá giải **có đăng ký** (Quick/Doubles/Flex) | Không (cascade xoá dữ liệu người khác) | **Chặn-trước** + đường thoát có typed-name |
| Xoá giải TeamMatch **có đội đã claim/confirm tiền** | **KHÔNG BAO GIỜ** — không có refund trong repo | **Chặn cứng**, không có đường thoát trong UI |
| Gỡ thành viên khỏi đội | Có (chỉ 1 dòng, thêm lại được) | Confirm + toast-Hoàn-tác (re-insert) |
| Huỷ social event | Đã soft | Giữ nguyên, đã tốt |
| Đổi status đăng ký (roster) | Có | Toast-Hoàn-tác (đổi status ngược) |
| `deleteMatchesMutation` | — | **Xoá code**, không ai gọi |

**Ranh giới tôi cam kết:** chỉ hứa undo cho thao tác **1 dòng, không cascade, không tiền**.
Không hứa undo cho bất cứ thứ gì đã thu tiền hoặc đã có đăng ký của người khác.

## Có nên dùng toast-với-nút-Hoàn-tác không?

**Có, nhưng CHỈ cho thao tác 1 dòng.** `sonner` đã mount (§0.2e) → 0 KB. Dùng cho: gỡ
thành viên, đổi status roster. **Không** dùng cho xoá giải — vì sau `ON DELETE CASCADE`
thì không còn gì để hoàn tác, và một cái nút "Hoàn tác" không hoạt động còn tệ hơn không
có nút.

> Cảnh báo thiết kế: toast-undo cho thao tác *đã ghi DB rồi* là "undo giả" — nó chỉ là một
> mutation ngược. Nếu người dùng đóng tab trước khi bấm, không cứu được. Chấp nhận được cho
> gỡ-thành-viên. Không chấp nhận được cho bất cứ thứ gì cascade.

---

## Option A — Guard ở tầng DB + đường thoát typed-name (KHUYẾN NGHỊ)

**Effort: 3 nửa ngày web + 1 nửa ngày native = 4 nửa ngày**

**Files:**
- `supabase/migrations/<ts>_ux06_delete_guards.sql` (mới)
- `src/pages/MyTournaments.tsx` (dialog 2 tầng + xử lý lỗi guard)
- `src/components/teamMatch/TeamJoinPanel.tsx`, `src/components/teamMatch/TeamOverviewCard.tsx` (thêm `useConfirm()`)
- `src/hooks/useTeamMatchMatches.ts` (xoá `deleteMatchesMutation` dead code)
- `src/i18n/vi.ts` + `src/i18n/en.ts` (copy song ngữ)
- `apple/.../Features/Bracket/TeamMatchManageTeamsView.swift` (confirmationDialog)

**Data: CÓ migration.** 4 trigger `BEFORE DELETE` + 3 RPC. Không RLS mới, không cột mới.

**Cách hoạt động:**

1. Trigger `BEFORE DELETE` trên `quick_tables`, `doubles_elimination_tournaments`,
   `flex_tournaments`, `team_match_tournaments`: đếm đăng ký/đội con còn sống. Nếu > 0 →
   `RAISE EXCEPTION` với `ERRCODE` riêng + số lượng trong message.
2. Với `team_match_tournaments`, thêm điều kiện cứng: nếu tồn tại đội có
   `payment_status` đã claim/confirm → raise **kể cả đường RPC**. Không refund thì không cho xoá.
3. Đường thoát: 3 RPC `delete_doubles_elimination_tournament` /
   `delete_flex_tournament` / `delete_team_match_tournament` — **mô phỏng đúng
   `delete_quick_table` đã có**: xoá con thủ công rồi xoá row. Vì con đã sạch trước khi
   `BEFORE DELETE` chạy, trigger tự động cho qua. **Không cần cờ force, không cần GUC,
   không có state ẩn.** Đây là lý do tôi chọn hình dạng này thay vì `SET LOCAL`.
4. UI 2 tầng: giải rỗng → dialog như hiện tại. Giải có đăng ký → dialog đỏ, hiện số người
   sẽ mất, **bắt gõ đúng tên giải** (tái dùng đúng mẫu `EditSocialEvent.tsx:839-878`,
   không phát minh mẫu mới) → mới gọi RPC.
5. Xoá thẳng từ client (`.delete()`) vẫn giữ cho trường hợp rỗng — trigger là lưới an toàn
   cho mọi caller kể cả native và caller tương lai.

**Được:**
- Kịch bản tệ nhất (xoá mất đăng ký người khác / mất giải đã thu tiền) **bị chặn ở tầng DB**
  → native, web, script tay, caller tương lai đều được bảo vệ bằng **một** chỗ. Đây là
  "một guard trong hàm dùng chung" thay vì "guard ở mỗi caller".
- Không đụng 83 call site đọc. Không đụng SSR/sitemap.
- Tái dùng 2 mẫu đã có sẵn trong repo (`delete_quick_table`, typed-name confirm).
- `git revert` được: `DROP TRIGGER` + `DROP FUNCTION`, không có cột nào để lại rác.

**Mất:**
- Không có undo thật. Xoá giải rỗng nhầm vẫn mất (chấp nhận: mất 2 phút).
- Trigger thêm 1 `COUNT` mỗi lần xoá — không đáng kể ở quy mô này.
- Organizer có giải cũ đầy đăng ký muốn dọn dashboard sẽ phải gõ tên. Cố ý.

**Đóng cửa gì:** không đóng gì. Nếu sau này thật sự cần soft-delete, thêm `deleted_at`
vẫn làm được; trigger chỉ cần đổi điều kiện.

---

## Option B — Chỉ siết confirm, KHÔNG migration (bản rẻ)

**Effort: 1.5 nửa ngày web + 0.5 nửa ngày native = 2 nửa ngày**

**Files:** `MyTournaments.tsx`, `TeamJoinPanel.tsx`, `TeamOverviewCard.tsx`,
`useTeamMatchMatches.ts` (xoá dead code), i18n, `TeamMatchManageTeamsView.swift`.
**Data: none.**

**Cách hoạt động:** thêm 1 query đếm đăng ký vào `MyTournaments` (hiện chưa có — §0.1),
nếu > 0 thì dialog chuyển sang typed-name. Bịt 2 chỗ gỡ thành viên bằng `useConfirm()`.
Native thêm `confirmationDialog`. Hết.

**Được:** rẻ nhất, không migration, revert bằng 1 lệnh, ship trong một buổi tối.
**Mất:** guard chỉ ở client. Native `MyTournaments` chưa tồn tại nhưng nếu port sau sẽ
quên guard. Bất kỳ caller mới nào cũng phải nhớ tự guard — đúng cái mô hình "guard ở mỗi
caller" mà lần sau sẽ hỏng.
**Đóng cửa gì:** không, nhưng để lại nợ: guard đúng chỗ (DB) vẫn phải làm sau.

---

## Option C — Soft-delete `deleted_at` cho 4 bảng giải (BÁC BỎ, ghi để so sánh)

**Effort thật: 12–18 nửa ngày.** Migration 4 cột + 4 index + soát **83 call site đọc** +
**39 migration** chứa view/RPC/policy + SSR `functions/_lib/render/` + 4 sitemap segment +
UI "Thùng rác" + job dọn rác. Mỗi call site sót = giải "đã xoá" vẫn hiện với người chơi
hoặc với Googlebot.

**Thua vì:** chi phí lệch bậc so với rủi ro đã đo (0 sự cố, 3/4 loại không dính tiền), và
mỗi call site sót là một bug im lặng — đúng loại lỗi khiến solo maintainer bị gọi lúc 2h
sáng. Đây là chi phí thật, không phải chi phí phòng thủ.

---

## Khuyến nghị UX-06 — **Option A**

Option C thua vì §0.2(b): 83 + 39 chỗ phải soát cho một rủi ro chưa từng xảy ra, và cơ chế
hỏng của nó (sót một query đọc) tệ hơn cơ chế nó phòng.

Option B thua Option A **chỉ vì đúng 1.5 nửa ngày và một lỗ hổng có thật**: web chưa có
màn `MyTournaments` native, nhưng Cuong đang port web→native liên tục (memory
`native-port-session-2026-07.md`). Guard ở client sẽ không đi theo bản port đó. Chênh
lệch 2 nửa ngày mua được thứ đúng-mãi-mãi ở tầng DB.

**Nhưng:** nếu Cuong muốn cắt cụm này xuống mức tối thiểu tuyệt đối, **Option B là lựa chọn
hợp lệ và tôi không phản đối mạnh** — vì tiền đề "chưa từng đau thật" vẫn đứng. Ranh giới
quyết định rõ ràng: *có định port MyTournaments sang native trong 3 tháng tới không?* Có →
A. Không → B.

**Cái tôi khuyên KHÔNG làm, ở mọi option:** cơ chế undo toàn cục, hàng đợi undo, bảng
`deleted_items`, "thùng rác 30 ngày". Không có bằng chứng nào trong repo hay trong lời
Cuong biện minh cho chúng.

---

# UX-07 — luồng khám phá → đăng ký

## Luồng thật (tôi verify lại từ file)

`/tournaments` (`Tournaments.tsx:25` tab `watch|community`, `:145` mặc định rơi về
`community` khi không có nội dung watch, `:338-341` nhãn "Cộng đồng") → 4 thể thức
(`FORMATS[]` `:65-111`) → `/tools/<format>/<share_id>` → form → **tường đăng nhập**
(`RegistrationForm.tsx:195-201`) → **redirect bị nuốt nếu là người mới** (§0.2d).

Bất đối xứng: social event có `social_event_guest_register` + ghost profile theo
số điện thoại (`phone-otp-verify/index.ts:228-272`); 4 thể thức giải thì
`quick_table_registrations.user_id` là `NOT NULL REFERENCES auth.users(id)`
(`20251225041737_...sql:21`) — **guest đăng ký giải là bất khả thi nếu không migration schema**.

## Đo trước hay đo cùng lúc?

**Đo cùng lúc — nhưng tách claim khỏi ship.** Lý do:

- D1 (RESOLVED) cấm *claim cải thiện*, không cấm *ship sửa lỗi*. §0.2(d) là **lỗi luồng
  xác định bằng đọc code**, không phải giả thuyết conversion. Bắt Cuong chờ 2 tuần baseline
  để sửa một cái redirect bị nuốt là áp dụng nguyên tắc sai chỗ.
- Đo trước rồi mới sửa = tốn thêm ~2 tuần lịch cho một người làm buổi tối, đổi lấy một
  baseline **đo trên luồng đang hỏng** — baseline đó không dùng để so sánh được, vì sau khi
  sửa lỗi thì mẫu số đã khác.
- Mốc **~2026-08-02** (đọc funnel `organizer_tournament`) không bị đụng: đó là funnel phía
  organizer, độc lập. Nếu gắn `player_registration` cho đường giải **ngay tuần này**, tới
  ~2026-08-03 sẽ có ~2 tuần data phía người chơi — đọc cùng một lần, tiết kiệm một lượt
  context switch.

**Cam kết ràng buộc:** không câu nào trong PR/changelog được nói "tăng conversion". Câu
được phép: "sửa redirect bị nuốt sau onboarding" (sự thật kiểm chứng được) và "bắt đầu đo
đường giải từ <ngày>".

## Guest + OTP cho đăng ký giải — trả lời thẳng: **KHÔNG, không phải đợt này**

Chi phí thật nếu làm (tôi tra ra, không ước lượng mù):

1. `quick_table_registrations.user_id NOT NULL REFERENCES auth.users(id)` +
   `UNIQUE(table_id, user_id)` — phải làm nullable, thêm `profile_id`, đổi unique
   constraint, **viết lại RLS** (policy hiện dựa `user_id = auth.uid()`). Nhân cho các
   bảng tương đương của doubles/flex/team.
2. `phone-otp-send/index.ts` **hard-code cho social event**: nó validate `event_id` với
   `status='published'`, `allow_guests=true`, `start_at` tương lai, rate-limit theo
   `(phone, event)`. Muốn dùng cho giải phải mở rộng thành đa-loại-thực-thể → sửa
   `phone-otp-send` + `phone-otp-verify`, cả hai `verify_jwt=false`. **Đây là RED-tier:
   chạm auth.** Cần Cuong ký duyệt (`scripts/agents/risk-tier.mjs`).
3. **OTP tốn tiền thật** — eSMS + Zalo ZNS. Mở guest cho 4 thể thức giải = mở thêm bề mặt
   spam có chi phí VND trực tiếp. Rate limit hiện tại scope theo event; scope mới phải
   thiết kế lại.
4. Trùng người: ghost profile theo phone sẽ đụng user thật đã có tài khoản cùng số → cần
   logic merge. `dupr-link` có mẫu nhưng chưa tổng quát.

**Ước lượng thật: 10–14 nửa ngày, RED-tier, chạm tiền + auth.** Cho một giả thuyết **chưa
có một con số nào** chống lưng (đường giải hiện mù hoàn toàn — `journeys.ts` chỉ wire ở
`RegistrationModal.tsx`).

Làm việc này trước khi đo là đúng thứ D1 sinh ra để ngăn.

---

## Option A — Sửa lỗi luồng + gắn đo, không đụng schema (KHUYẾN NGHỊ)

**Effort: 3 nửa ngày web + 1 nửa ngày native = 4 nửa ngày**

**Files:**
- `src/pages/Login.tsx` (giữ `redirect` xuyên qua onboarding)
- `src/components/onboarding/OnboardingWizard.tsx` (`handleComplete` tôn trọng đích đã lưu)
- `src/components/quickTable/RegistrationForm.tsx` (journey + intent khi bấm login)
- `src/components/quickTable/DoublesRegistrationForm.tsx`,
  `src/components/doublesElimination/DoublesEliminationRegistrationSection.tsx` (journey)
- `src/pages/Tournaments.tsx` (journey `start` khi bấm vào 1 giải ở tab Cộng đồng)
- `src/lib/journeys.ts` (không thêm `JourneyKind` mới — dùng lại `player_registration` +
  prop `tool`, đúng cách `organizer_tournament` đã tái dùng shape của `organizer_event`)
- i18n VI/EN
- Native: `Features/Bracket/TeamMatchRegisterSheet.swift`, `Features/Social/SocialListView.swift`

**Data: none.** Không migration, không RLS, không RPC mới.

**Cách hoạt động:**

1. **Sửa redirect bị nuốt** (§0.2d) — đích cần tới được giữ qua bước onboarding thay vì
   bị vứt ở `Login.tsx:62`. Truyền tiếp `?redirect=` vào `/onboarding` và cho
   `handleComplete` ưu tiên nó, fallback về `/nguoi-choi/<username>` như hiện tại. Bắt buộc
   đi qua `safeInternalPath()` đã có (`Login.tsx:51`) — **không được** tự parse, chỗ này
   từng có lỗ open-redirect (PR52).
2. **Giữ ý định đăng ký**: quay lại tool page với `?register=1` → tự mở form. Dùng
   `useUrlBackedState` (#414) cho cờ này — đúng chỗ nó sinh ra, và deep-link/back hoạt
   động miễn phí. Đây là toàn bộ chỗ `useUrlBackedState` được dùng trong UX-07; tôi
   **không** ép nó vào chỗ khác chỉ để tick ràng buộc.
3. **Gắn đo**: `startJourney('player_registration')` khi bấm item ở tab Cộng đồng
   (`Tournaments.tsx:459,553`); `trackJourneyStep` ở: mở form → chạm tường login →
   quay lại sau login → submit → thành công. Đây chính là đoạn "tường login nuốt bao nhiêu
   người" mà hiện không ai biết.
4. **Không** đụng RPC đăng ký. DB-01/DB-01c là RPC của *social event* (`p_event_id` →
   `social_events`); đường giải không đi qua chúng. Ràng buộc "phải đi qua RPC đó" trong
   intake áp dụng cho social event — mà social event **đã** đi qua rồi. Không có gì phải
   làm. *(Tôi ghi rõ chỗ này vì đọc lướt intake dễ tưởng phải rewire cả đường giải.)*

**Được:** sửa một lỗi làm luồng **hỏng hoàn toàn** cho người dùng mới; bật đèn trên đường
đang mù; không migration, không RED; revert 10 phút.
**Mất:** không mở guest. Người chơi mới vẫn phải tạo tài khoản — nhưng giờ tạo xong sẽ
**về đúng chỗ**, thay vì lạc.
**Đóng cửa gì:** không. Nếu số liệu 2 tuần cho thấy tường login vẫn giết phần lớn người
dùng *sau khi* đã sửa lỗi, Option C mở ra với bằng chứng thật.

---

## Option B — Chỉ sửa lỗi redirect, không gắn đo (bản rẻ)

**Effort: 1 nửa ngày web + 0 native = 1 nửa ngày**

**Files:** `Login.tsx`, `OnboardingWizard.tsx`, `RegistrationForm.tsx` (cờ `?register=1`).
**Data: none.**

**Được:** rẻ nhất có thể, sửa đúng cái hỏng thật, ship tối nay.
**Mất:** đường giải vẫn mù → tháng sau vẫn phải đoán như hôm nay. Không có gì để đọc vào
~2026-08-02 cùng funnel organizer.
**Đóng cửa gì:** không, nhưng đẩy lùi baseline thêm 2 tuần nữa mỗi lần trì hoãn.

---

## Option C — Guest + OTP cho đăng ký giải (BÁC BỎ đợt này)

**Effort: 10–14 nửa ngày · 🔴 RED (auth + tiền OTP) · migration schema 4 bảng + viết lại RLS**

Chi tiết chi phí ở §"Guest + OTP" trên. **Thua vì:** không có một con số nào chống lưng,
chạm auth (`phone-otp-send/verify`, `verify_jwt=false`), mở bề mặt spam tốn VND thật, và
cần logic merge ghost-profile chưa tồn tại. Đây là phương án đúng **sau** khi Option A cho
số — không phải trước.

---

## Khuyến nghị UX-07 — **Option A**

Option C thua vì nó là phương án đắt nhất, rủi ro nhất, cho giả thuyết **chưa được đo lần
nào** — và tệ hơn: nếu ship C trước A, con số sau đó vẫn bẩn, vì lỗi §0.2(d) vẫn đang giết
người dùng mới ở nhánh có-tài-khoản.

Option B thua Option A vì chênh lệch chỉ 3 nửa ngày mà mua được toàn bộ khả năng nhìn thấy
đường giải, đúng lúc mốc ~2026-08-02 sắp tới — gắn đo bây giờ thì đọc được 2 funnel trong
một lượt thay vì hai lượt cách nhau hai tuần.

---

# Native `/apple` — phần phải làm mỗi option

| Option | Việc SwiftUI | Nửa ngày | Hoãn được? |
|---|---|---|---|
| UX-06 A/B | `TeamMatchManageTeamsView.swift:97` → bọc `.confirmationDialog` trước khi gọi `deleteTeam` (song ngữ VI/EN) | 0.5 | **Không** — đây là chỗ native tệ hơn web rõ rệt |
| UX-06 A | Bắt lỗi `ERRCODE` từ trigger → hiện message đọc được thay vì `error.localizedDescription` thô | 0.5 | Hoãn được 1 đợt (trigger vẫn chặn đúng, chỉ là thông báo xấu) |
| UX-06 | Màn `MyTournaments` native **không tồn tại** (tôi xác nhận lại: chỉ có `ClubManageView.swift`) | 0 | Không có gì để làm |
| UX-07 A | `TeamMatchRegisterSheet.swift` + `SocialListView.swift`: gắn journey ngang web | 1 | **Hoãn được** — web đủ để có tín hiệu; native chỉ cần khi so sánh 2 nền tảng |
| UX-07 A | Redirect-sau-onboarding: native dùng OAuth qua custom URL scheme (`AuthCallback.tsx:34`) — đường khác, **chưa verify** có cùng lỗi không | ? | Xem §"Điều em không chắc" |

**App Store RED-gate:** không phương án nào phụ thuộc người dùng có bản mới trên store.
Guard UX-06 nằm ở DB → **bản native cũ đang chạy ngoài kia cũng được bảo vệ ngay khi
migration chạy**, không cần release. Đây là một lý do nữa để chọn Option A thay vì B: B
không bảo vệ được binary đã phát hành.

---

# Increments (thứ tự ship, mỗi cái độc lập)

| # | Việc | Nửa ngày | Verify bằng |
|---|---|---|---|
| 1 | **UX-07: sửa redirect bị nuốt** (`Login.tsx` + `OnboardingWizard.tsx` + `?register=1`) | 1 | Tạo tài khoản mới từ `/tools/quick-tables/<id>` → sau onboarding phải về đúng trang giải, form tự mở. Test `safeInternalPath` với `//evil.com` |
| 2 | **UX-06: bịt confirm + xoá dead code** (2 chỗ remove member, `deleteMatchesMutation`, native `confirmationDialog`) | 1 | Bấm gỡ thành viên → phải có dialog, cả web lẫn simulator |
| 3 | **UX-06: migration guard** (4 trigger + 3 RPC) | 1.5 | pgTAP: xoá giải có đăng ký phải raise; xoá giải rỗng phải qua; xoá TeamMatch có đội đã claim tiền phải raise **kể cả qua RPC** |
| 4 | **UX-06: UI 2 tầng** (`MyTournaments.tsx` typed-name khi có đăng ký) | 1 | Tay: giải rỗng = 1 bước; giải có người = phải gõ tên |
| 5 | **UX-07: gắn journey đường giải** (`Tournaments.tsx` + 3 form) | 1.5 | GA4 segment Vietnam thấy start/step/complete có prop `tool` |
| 6 | **Native journey parity** (PR riêng) | 1 | Simulator + so event với web |

**Tổng: 7 nửa ngày** (roadmap ghi 8 ngày cho cả hai task; đề xuất này ~1/2).

### 🛑 Điểm dừng-và-nhìn

**Sau increment 5, dừng ~2 tuần.** Đọc funnel `player_registration` (đường giải) **cùng
lượt** với `organizer_tournament` ở mốc ~2026-08-02/03. Chỉ khi đó mới quyết định Option C
(guest OTP) có đáng RED-tier không. Increment 6 là việc lấp đầy, làm trong lúc chờ.

**Điều kiện để mở lại Option C:** sau khi đã sửa lỗi redirect, tỉ lệ *chạm tường login →
hoàn thành đăng ký* vẫn thấp rõ rệt so với đường social event. Nếu sau khi sửa lỗi mà hai
đường xấp xỉ nhau → tường login **không phải** thủ phạm, và Option C sẽ là 14 nửa ngày đổ
vào chỗ sai.

---

# Điều em không chắc

1. **Native OAuth có cùng lỗi §0.2(d) không.** `AuthCallback.tsx:34` đi đường custom URL
   scheme, `AuthCallback.tsx:107` đọc `redirect` param riêng. Em **chưa trace** nhánh
   native từ đầu đến cuối. Nếu native đi đường khác thì increment 1 có thể chỉ sửa được
   web. **Cần verify trước khi ước lượng increment 1 là 1 nửa ngày.**
2. **RLS chính xác của `quick_table_registrations`** — em đọc được `CREATE TABLE` và thấy
   `ENABLE ROW LEVEL SECURITY`, nhưng chưa dump toàn bộ policy hiện hành (có thể đã bị
   migration sau sửa). Con số "viết lại RLS" trong ước lượng Option C là **ước lượng
   thô**, chưa đếm chính xác số policy.
3. **Bảng đăng ký của Flex và DoublesElim** — em xác nhận `quick_table_registrations` tồn
   tại, và doubles/flex dùng mô hình *team* (`doubles_elimination_teams`, `flex_teams`,
   `flex_team_members`). Em **chưa đọc kỹ** cái nào là đơn vị "đăng ký" đúng cho từng loại
   → điều kiện `COUNT` trong trigger increment 3 cần đọc thêm 3 file migration trước khi
   viết. Đây là rủi ro *thực thi*, không phải rủi ro *kiến trúc* — hình dạng phương án
   không đổi.
4. **`team_match_teams.payment_status` nhận giá trị gì** — em thấy tên cột và
   `claim_team_payment`/`confirm_team_payment`, nhưng chưa liệt kê tập giá trị. Điều kiện
   "đã claim/confirm" trong trigger cần chốt bằng giá trị thật, không đoán.
5. **"Cảm nhận" của Cuong ở UX-07 là chỗ nào** — intake nói có cảm nhận nhưng không có số,
   và câu hỏi này **chưa được hỏi cụ thể**. Nếu cảm nhận của anh trỏ vào chỗ khác hoàn toàn
   (ví dụ người ta không tìm thấy `/tournaments` từ đầu, hay rớt ở feed/SEO landing) thì cả
   Option A lẫn C đều đang sửa sai chỗ. **Đây là câu hỏi có giá trị nhất còn treo trong cụm
   này** — đáng hỏi trước khi ship increment 5.
6. **Số 83 call site** là đếm bằng grep `from("<table>")`. Nó **không** bắt được truy cập
   gián tiếp qua view hoặc qua RPC trả về các bảng đó. Con số thật của Option C **cao hơn**
   83, không thấp hơn — nên hướng sai số vẫn ủng hộ kết luận bác bỏ.
