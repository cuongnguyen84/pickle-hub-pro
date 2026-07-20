# Pre-mortem — cụm UX-06 + UX-07

Agent: `idea-premortem` · 2026-07-20 · read-only

> Luật của vai: feature này **đã lên prod và đã hỏng**. Dưới đây là ba bản tường thuật
> viết ngược. Hậu quả là hư cấu; **cơ chế thì không** — mọi mắt xích trỏ tới file thật,
> tự đọc lại, không tin recon vòng 0.

---

## ⚠️ LỖ HỔNG ĐANG SỐNG TRÊN PROD HÔM NAY (không cần UX-06/07 ship mới hỏng)

Ba cái này tách riêng vì chúng **không phải kịch bản**. Chúng đúng ngay lúc này.

### LIVE-1 — Xoá một đội MLP xoá luôn bằng chứng đội đó đã đóng lệ phí

`supabase/migrations/20260701140000_team_match_payment_status.sql:5-8` gắn
`payment_status` / `payment_claimed_at` / `payment_confirmed_at` **trực tiếp lên
`team_match_teams`**. Không có bảng ledger, không có bảng audit, không có
`payment_orders` cho nhánh team-match (`payment_orders.registration_id` FK tới
`event_registrations` — `20260512130001_payment_orders.sql:23` — tức chỉ phục vụ social event).

`src/hooks/useTeamMatchTeams.ts:421-430` xoá cứng `team_match_teams` bằng một
`.delete().eq('id', teamId)`. **Không đọc `payment_status` trước khi xoá.**
Khi hàng biến mất, dòng chữ "đội này đã chuyển 2 triệu, BTC đã xác nhận" biến mất cùng.
Không có RPC refund nào trong repo (`supabase/functions/` chỉ có `create-payment-order`
và `mark-payment-claimed`, không có counterpart nào).

Bên native còn tệ hơn: `apple/ThePickleHub/Features/Bracket/TeamMatchManageTeamsView.swift:221`

```swift
Button { Haptics.light(); Task { await model.deleteTeam(team.id) } } label: {
    Image(systemName: "trash")...
```

Một chạm. Không `.alert`, không `confirmationDialog`, không undo. Icon thùng rác nằm
**ngay cạnh** badge trạng thái và bộ đếm `\(members.count)/\(rosterSize)` trong cùng
một `HStack` (`:210-222`), tức là ở vùng ngón cái quét qua khi cuộn danh sách đội.

Trên web ít nhất có `AlertDialog` (`src/components/teamMatch/TeamList.tsx:216-228`),
nhưng nội dung dialog **không nhắc một chữ nào về tiền**.

### LIVE-2 — Quota=3 là cái máy đẩy organizer đi xoá giải đã thu tiền

`src/hooks/useUserCreateQuota.ts:27` mặc định `quota = 3`;
`count_user_tournaments` (`20260516125412_quota_rpcs_flex_doubles_team_match.sql:41-46`)
đếm **tổng** trên cả 4 thể thức. Organizer chạy giải hằng tuần chạm trần rất nhanh,
và đường duy nhất để tạo giải mới là **xoá một giải cũ**.

Bốn đường xoá đó ở `src/pages/MyTournaments.tsx:237-247` đều là xoá cứng
(`delete_quick_table` RPC, hoặc `.delete()` thẳng + `ON DELETE CASCADE`), và
`performDelete` chạy xong thì gọi `refetchQuota()` (`:261`) — nghĩa là code **biết**
xoá là để lấy lại slot.

Dòng danh sách chỉ select `id, name, status, created_at, share_id`
(`MyTournaments.tsx:88,102,116,130`). **Không có số đội, không có số người đăng ký,
không có trạng thái thanh toán.** Dialog xác nhận (`:549-572`) chỉ in tên giải.

Nói cách khác: nền tảng ép organizer xoá, rồi không cho họ thấy họ đang xoá gì.

### LIVE-3 — Huỷ sự kiện xong, người đã chuyển khoản mất luôn mã tra soát

`cancel_social_event` (`20260521130000_club_managers.sql:568-579`) set
`social_events.status='cancelled'`. `create-payment-order/handler.ts:131-133`:

```ts
if (event.status === "cancelled") {
  return err("event_cancelled", 410, "event_cancelled");
}
```

Mà `payment_orders` **không cho player SELECT client-side** — comment ở
`20260512130001_payment_orders.sql:13-18` nói rõ: player chỉ lấy được order qua
edge function idempotent này. Sau khi huỷ, đường đó trả 410. Người đã ghi
`PHUB-XXXXXX` vào memo chuyển khoản không còn cách nào tự tra lại mã của mình.
Chỉ organizer/admin đọc được — đúng cái người đang bị đòi tiền.

---

## Sự cố 1 — "Anh xoá cái giải tháng trước để tạo giải mới, giờ 8 đội đòi lại tiền mà em không biết đội nào đã đóng"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 2–6 tuần (chỉ phát hiện khi có tranh chấp)

Đây là kịch bản UX-06 **được ship nửa vời**: panel chốt "chưa từng đau thật → YAGNI →
chỉ thêm typed-confirm cho 4 nút xoá giải, không làm soft-delete". Typed-confirm ship,
và chính nó là thứ tạo ra sự cố.

**Timeline**

- **T-30 ngày** — Organizer H. chạy giải MLP 12 đội trên `/tools/team-match/<id>`, thu
  lệ phí 1.5tr/đội qua VietQR. H. bấm "Xác nhận đã nhận" cho từng đội →
  `confirm_team_payment` (`20260701140000:69-72`) set `payment_status='confirmed'`
  trên 12 hàng `team_match_teams`. Đó là **toàn bộ** sổ sách của giải.
- **T+0, 21:40** — H. muốn mở giải tháng sau. `MyTournaments` hiện `3/3`
  (`MyTournaments.tsx:355`). Nút tạo mới chặn.
- **T+0, 21:41** — H. bấm xoá giải MLP đã kết thúc. Dialog mới của UX-06 bắt gõ lại
  tên giải. H. gõ. Đối với H. đây là "dọn dẹp giải đã xong", không phải "xoá sổ sách".
  Dialog vẫn chỉ nói "sẽ bị xóa vĩnh viễn cùng tất cả dữ liệu liên quan" — đúng nguyên
  văn `MyTournaments.tsx:558-560`, không có con số nào.
- **T+0, 21:41:02** — `.from("team_match_tournaments").delete()` (`:246`) →
  CASCADE (`20260107133349:68`) xoá 12 hàng team, roster, matches.
  `queryClient.invalidateQueries` + `refetchQuota()` → `2/3`. Toast xanh "Đã xóa".
- **T+0, 21:41:05** — H. tạo giải mới. Xong việc.
- **T+19 ngày** — Một đội cãi nhau về suất thi đấu giải sau, moi lại chuyện cũ:
  "bọn tôi đóng rồi mà lần đó không được xếp bảng". H. mở app tra. Không còn gì.
- **T+21 ngày** — H. nhắn Cuong: "em có backup không?".

**Cơ chế**

`src/pages/MyTournaments.tsx:246` (`.from("team_match_tournaments").delete()`)
→ FK cascade `supabase/migrations/20260107133349_...sql:68`
→ `team_match_teams` bị xoá, mang theo `payment_status`/`payment_confirmed_at`
  (`20260701140000_team_match_payment_status.sql:5-8`) — cột tiền nằm trên chính hàng bị xoá
→ không có bảng audit, không có refund function
→ `useUserCreateQuota.ts:27` (quota 3) là động cơ khiến thao tác này **thường xuyên** xảy ra
→ `MyTournaments.tsx:88-130` không select số đội, nên dialog không thể cảnh báo dù muốn.

**Vì sao mọi gate vẫn xanh**

- Panel duyệt vì nhìn UX-06 như **bài toán UI**: "thêm confirm mạnh hơn". Câu hỏi
  "xoá cái gì" được coi là đã trả lời (một giải), không ai hỏi "hàng đó **chứa** cái gì".
  Recon vòng 0 nói đúng — `20260521130000` "None of these check for existing
  paid/active registrations before deleting" — nhưng nói ở mục *schema reality*, không
  ở mục *money*, nên nó đọc như ghi chú kỹ thuật chứ không như báo động.
- CI xanh vì hành vi **đúng đặc tả**: xoá thì phải mất. Không có test nào assert
  "không được xoá đội đã confirmed" bởi vì không ai viết ra quy tắc đó.
- Soak 30 phút xanh vì soak chạy trên dữ liệu không có tiền.
- Typed-confirm **làm gate thấy an toàn hơn**: có ma sát rồi thì coi như đã bảo vệ.
  Ma sát chống nhầm tay, không chống nhầm ý định.

**Ai báo, sau bao lâu**

Không ai báo. Không exception, không alert, không log. Chỉ nổ ra khi có tranh chấp tiền
— 3 tuần sau, qua tin nhắn Facebook cho Cuong, không qua hệ thống.

**Vì sao khó sửa**

`git revert` vô nghĩa: không có code nào sai, chỉ có dữ liệu đã mất. Khôi phục
duy nhất là PITR của Supabase, mà PITR khôi phục **cả database** về thời điểm đó —
tức là xoá luôn 19 ngày dữ liệu của mọi người khác. Thực tế = mất vĩnh viễn.
Cách duy nhất còn lại là bảo H. mở app ngân hàng dò 12 giao dịch — nhưng memo
VietQR của team-match không có reference code (chỉ social event mới có `PHUB-`
theo `create-payment-order/handler.ts:8-13`), nên không đối soát được.

**Dấu hiệu sớm lẽ ra phải có**

Một dòng log server-side khi xoá: `deleted_teams_with_payment=N`. Hôm nay xoá đi qua
PostgREST thẳng từ client — **không có chỗ nào để log**. Đó chính là dấu hiệu:
thao tác phá huỷ nhất trong sản phẩm là thao tác duy nhất không có server-side hook.

---

## Sự cố 2 — "Khôi phục buổi chơi" dựng dậy 6 người đã tự huỷ, sự kiện vượt sức chứa, và một người bị tính tiền lần hai

**Xác suất:** trung bình–cao (nếu UX-06 làm restore cho social event) · **Thời gian tới lúc phát hiện:** 20 phút tới 3 ngày, tuỳ ai đến sân

Đây là kịch bản UX-06 **được ship đầy đủ** cho nhánh soft-delete có sẵn: undo cho
`cancel_social_event`. Nghe an toàn nhất trong cả cụm — vì nó đã là soft delete rồi.
Chính vì thế nó được chọn.

**Timeline**

- **T-9 ngày** — Sự kiện "Tối thứ 5 sân Tân Bình", `max_players=16`, `price_vnd=80000`,
  `requires_prepayment`. 16 người đăng ký đủ. 11 người chuyển khoản, có
  `payment_orders` với mã `PHUB-`.
- **T-4 ngày → T-1** — 6 người bận, tự huỷ qua magic link →
  `cancel-registration` edge function set `cancelled_at` trên 6 hàng
  `event_registrations`. 6 suất mở lại, 6 người khác vào (guest, qua
  `social_event_guest_register`). Sự kiện lại đủ 16.
- **T+0, 14:10** — Dự báo mưa. Manager CLB (không phải creator — quyền qua
  `is_event_organizer`, xem `20260521130000:554`) gõ tên sự kiện vào modal typed-confirm
  (`src/pages/EditSocialEvent.tsx:839-878`) → `cancel_social_event`.
  RPC set `status='cancelled'` và `UPDATE event_registrations SET status='cancelled',
  cancelled_at=now() WHERE event_id=... AND cancelled_at IS NULL` (`:573-579`).
  Đúng 16 hàng đang sống bị huỷ. **6 hàng tự huỷ trước đó không bị đụng — đúng ý đồ.**
- **T+0, 14:26** — Trời tạnh. Manager bấm **"Hoàn tác huỷ"** — nút UX-06 vừa ship.
  Nút gọi `restore_social_event`, viết đối xứng với `cancel_social_event`:
  `status='published'` + `UPDATE event_registrations SET status='confirmed',
  cancelled_at=NULL WHERE event_id=...`.
- **T+0, 14:26:01** — Mệnh đề `WHERE` **không thể** phân biệt 16 người bị huỷ vì mưa
  với 6 người đã tự bỏ 4 ngày trước. Cả hai nhóm đều mang `cancelled_at` và
  `status='cancelled'` tại thời điểm restore. **22 hàng sống dậy.**
  `max_players=16`.
- **T+0, 14:26:01** — Không có exception. `restore_social_event` là một `UPDATE`, không
  đi qua `register_event_as_member` cũng không đi qua `social_event_guest_register`,
  nên **advisory lock `'event_capacity:'||event_id` của DB-01/DB-01c
  (`20260717200000_db01c_member_capacity_lock.sql:10-12`) không được lấy, và
  capacity check không hề chạy.** Toàn bộ công của DB-01/DB-01c bị đi vòng qua cửa sau.
- **T+0, 14:27** — Roster hiện 22/16. Manager thấy con số lạ, cho là bug hiển thị.
- **T+0, 18:55** — 19 người tới sân 4 court. 3 người trong nhóm "đã tự huỷ" cũng tới,
  vì họ nhận được... không gì cả (không có notify nào trong repo), họ tới do một
  người bạn nhắn "sân vẫn đá". Thiếu chỗ.
- **T+1** — Một trong 6 người tự huỷ đã được hoàn tiền tay hôm trước. Giờ hàng
  đăng ký của họ sống lại kèm `payment_orders` cũ (`payment_orders.registration_id`
  UNIQUE, hàng chưa bao giờ bị xoá vì registration chưa bao giờ bị xoá). Roster của
  organizer hiện họ "đã chuyển khoản". Organizer đòi tiền lần hai.

**Cơ chế**

`cancel_social_event` (`supabase/migrations/20260521130000_club_managers.sql:573-579`)
dùng `cancelled_at IS NULL` làm bộ lọc "ai đang sống" — **đúng cho chiều huỷ**
→ nhưng chiều ngược lại không có bộ lọc đối xứng nào tồn tại: schema
`event_registrations` không lưu *ai* huỷ hay *vì sao* ở dạng máy đọc được
(`cancelled_reason` là TEXT tự do, mặc định `'Event cancelled by organizer'`)
→ restore buộc phải quét theo `event_id`, gom cả hai nhóm
→ đường restore không đi qua RPC đăng ký nên không lấy advisory lock DB-01c
→ `payment_orders` sống sót nguyên vẹn theo registration, nên trạng thái tiền
  cũng sống dậy sai (`20260512130001_payment_orders.sql:23` — CASCADE chỉ theo DELETE,
  mà ở đây không có DELETE nào).

**Vì sao mọi gate vẫn xanh**

- Panel duyệt vì đây là **lựa chọn bảo thủ nhất trong cụm**: "chỉ làm undo cho thao tác
  vốn đã là soft delete, không đụng 4 nhánh hard-delete". Nghe như đúng rung *ladder*:
  rung thấp nhất còn chịu được.
- Code review xanh vì `restore_social_event` **đọc như bản đối xứng hoàn hảo** của
  `cancel_social_event`. Reviewer so hai hàm cạnh nhau và thấy chúng khớp. Cái sai
  không nằm trong hàm nào — nó nằm ở chỗ `cancelled_at` là kênh một chiều: chiều đi
  ghi thông tin, chiều về đã mất thông tin đó.
- CI/pgTAP xanh vì test viết theo hình dạng cancel→restore trên sự kiện sạch: đăng ký,
  huỷ event, restore, assert đủ số. **Không có test nào có người tự huỷ trước.**
  Trạng thái đó cần 3 bước setup và không ai nghĩ ra nó vì nó là *tiền sử* của dữ liệu,
  không phải một *nhánh code*.
- DB-01/DB-01c không bảo vệ được vì chúng là advisory lock **trong** các RPC đăng ký.
  Đường mới không gọi RPC đăng ký. Ràng buộc sống trong hàm, không sống trong bảng —
  không có CHECK/trigger nào chặn `COUNT(active) > max_players` ở tầng schema.
- Soak 30 phút xanh: sự cố nằm ở hai lượt ghi cách nhau 4 ngày.

**Ai báo, sau bao lâu**

Manager thấy `22/16` sau 1 phút nhưng **đọc nhầm nó là lỗi UI** — vì không có gì đỏ,
không có toast cảnh báo, và con số vượt trần không được nền tảng coi là bất thường ở
bất kỳ đâu. Sự cố được "báo" thật sự lúc 18:55 tại sân, bởi những người không dùng app
để báo. Cuong nghe lại qua kể.

**Vì sao khó sửa**

Revert code thì được — nút biến mất. Nhưng 22 hàng đã `cancelled_at=NULL`:
**thông tin ai-tự-huỷ đã bị ghi đè bằng NULL, không phục hồi được từ chính bảng đó.**
Muốn dựng lại phải đối chiếu `cancelled_reason` (text tự do) hoặc audit log của Supabase.
Và tổn thất nặng nhất không phải dữ liệu: 3 người đứng ngoài sân, 1 người bị đòi tiền
hai lần. Không lệnh nào sửa được cái đó.

**Dấu hiệu sớm lẽ ra phải có**

Một CHECK/trigger tầng bảng: số registration active của một event không vượt
`max_players`. Hôm nay bất biến này chỉ tồn tại **bên trong** hai RPC đăng ký, nên bất
kỳ đường ghi mới nào cũng đi vòng được — kể cả đường do chính chúng ta viết.
Đó là khoảng hở kiến trúc, không phải khoảng hở của UX-06.

---

## Sự cố 3 — Mở đường khách cho giải đấu, và hoá đơn Zalo OTP nhân bảy trong một đêm

**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** 12–36 giờ (nhìn thấy bằng tiền, không bằng alert)

Kịch bản UX-07 làm đúng giả thuyết số 1 của bản đính chính: gỡ tường đăng nhập ở
`src/components/quicktable/RegistrationForm.tsx:200-229` (`if (!user)` → nút
`/login?redirect=`) và cho khách đăng ký giải bằng OTP, tái dùng nguyên cụm
`phone-otp-send`/`phone-otp-verify` như social event.

**Timeline**

- **T-3 ngày (lúc code)** — Dev nối `phone-otp-send` vào form đăng ký QuickTable.
  Chạy local, 400. Nguyên nhân: `otp_codes.event_id UUID NOT NULL REFERENCES
  public.social_events(id)` (`20260511120000_social_events_foundation.sql:350`) —
  không nhét được `quick_tables.id` vào đó.
  Sửa tối thiểu, một dòng migration: bỏ FK, cho `event_id` nullable, client gửi `null`
  cho luồng giải. Local chạy. Diff nhỏ. Reviewer gật.
- **T+0, 20:00** — Ship. Bốn thể thức ở `/tools/*` có đường khách.
- **T+0, 22:15** — Một nhóm ở nhóm Facebook khác thấy giải mở, nghịch: gửi OTP liên tục
  vào một số. Rate limit per-phone **không nổ**.
  `supabase/functions/phone-otp-send/index.ts:335-341`:

  ```ts
  .from("otp_codes")
  .select("id", { count: "exact", head: true })
  .eq("phone", phone)
  .eq("event_id", eventIdInput)
  .gte("created_at", windowStart);
  ```

  Với `eventIdInput = null`, PostgREST dịch thành `event_id=eq.null` — trong SQL
  `col = NULL` **không bao giờ true**. `recentCount` luôn `0`.
  Ngưỡng `RATE_MAX_PER_WINDOW` không bao giờ chạm.
- **T+0, 22:15–02:00** — Còn lại hai lá chắn, và cả hai đều **không** chặn theo số điện thoại:
  Turnstile (`:266-274`) chặn bot rẻ tiền nhưng người thật ngồi bấm thì qua;
  IP limit (`:283-298`) đếm theo IP — mạng 4G Việt Nam đổi IP theo từng phiên,
  và nhóm này có 5 người 5 máy.
- **T+1, 02:00** — Lá chắn cuối cùng nổ đúng như thiết kế: kill-switch ngân sách ngày
  (`:303-331`) trả `503 daily_budget_exceeded`. **Nó cứu tiền, và đúng lúc đó nó
  chuyển sự cố tiền thành sự cố sản phẩm.**
- **T+1, 07:30** — Người chơi thật vào đăng ký buổi sáng. `phone-otp-send` trả 503 cho
  **tất cả**, kể cả luồng social event vốn đang chạy tốt 3 tháng nay — vì ngân sách là
  một bộ đếm **toàn cục** theo `channel='zalo'`, không tách theo luồng
  (`:307-312`: `.eq("channel","zalo").eq("success",true)`, không lọc gì thêm).
  Toàn bộ đăng ký khách của nền tảng chết cho tới nửa đêm UTC.
- **T+1, 09:00** — Organizer nhắn Cuong: "sao khách không đăng ký được?".

**Cơ chế**

`otp_codes.event_id NOT NULL REFERENCES social_events(id)`
(`20260511120000_social_events_foundation.sql:350`) — schema OTP **buộc chặt vào
social event**
→ mở luồng giải bắt buộc nới cột này
→ `event_id = null` làm `.eq("event_id", eventIdInput)` ở
  `supabase/functions/phone-otp-send/index.ts:339` vô hiệu **im lặng** — không lỗi,
  không log, chỉ trả 0
→ per-phone limit chết, chỉ còn IP limit (`:283`) và budget cap (`:303`)
→ IP limit vô nghĩa trên 4G VN
→ budget cap toàn cục nổ, kéo sập luôn luồng social event đang khoẻ.

Phụ thêm, cùng một cửa vừa mở: sức chứa. Social event có advisory lock
(`20260716090000` / `20260717200000_db01c_member_capacity_lock.sql:10-12`).
Bốn thể thức ở `/tools/*` **không có RPC đăng ký nào tương đương** — chúng ghi thẳng
qua PostgREST với GRANT rộng (`20260513000000_grant_mutations_on_tournament_tables.sql:45-51`
cấp `INSERT` cho `authenticated` trên toàn bộ họ bảng team-match). Mở đường khách mà
không viết RPC transactional là mở lại đúng lớp bug DB-00/DB-01 đã đóng, ở nhánh khác.

**Vì sao mọi gate vẫn xanh**

- Panel duyệt vì lý lẽ **rất mạnh và đúng**: bất đối xứng khách/đăng-nhập là phát hiện
  chính của recon, đã được bản đính chính xác nhận, và giải pháp là *tái dùng hạ tầng
  có sẵn* — đúng rung 2 của ladder. Không ai phản đối "dùng lại cái đang chạy tốt".
- Code review xanh vì cái sai là **một dòng migration bỏ NOT NULL**, và nó nằm ở PR
  khác chỗ với dòng `.eq("event_id", ...)` cách đó 300 dòng trong một file khác.
  Reviewer không có lý do nối hai chỗ lại.
- CI xanh vì test của `phone-otp-send` (nếu có) test **hành vi rate limit khi có
  event_id**. Không ai viết test cho `event_id = null` — nhánh đó vừa mới tồn tại.
  Và ngay cả test đó cũng sẽ **pass sai** nếu chạy trên mock, vì mock `.eq()` không
  tái hiện ngữ nghĩa NULL của SQL. Đây là cái sai chỉ có Postgres thật mới bắt được.
- Soak 30 phút xanh: soak gửi vài OTP hợp lệ và thấy chúng tới nơi. Sự cố cần
  ~200 lượt trong 15 phút mới lộ.
- Không alert nào nổ vì `logEvent({ step: "ip_rate_exceeded" })` và `budget_exceeded`
  ghi vào log function chứ không nối vào `errors-telegram-alert`. Sự cố có log, nhưng
  không có người đọc log.

**Ai báo, sau bao lâu**

Không ai báo pha tốn tiền (22:15–02:00) — nó lặng, và Zalo ZBS tính tiền theo tháng.
Người báo là organizer sáng hôm sau, báo **triệu chứng ngược** ("không gửi được OTP"),
tức là đội sẽ đi tìm bug ở lá chắn đã cứu mình chứ không ở lỗ hổng thật.
Chi phí thật chỉ lộ khi đối soát hoá đơn ZBS cuối tháng — **~4 tuần**.

**Vì sao khó sửa**

Revert code dễ. Nhưng migration nới `NOT NULL` thì không revert được thẳng: sau một
đêm, `otp_codes` đã có hàng `event_id IS NULL`; muốn đóng lại FK phải xoá hoặc backfill
chúng. Tiền Zalo đã tiêu không lấy lại. Và điều tệ nhất: **niềm tin của organizer vào
luồng đăng ký khách** — thứ đang chạy tốt và là tài sản của social event — bị hỏng bởi
một tính năng của nhánh khác.

**Dấu hiệu sớm lẽ ra phải có**

Một assert đúng một dòng, ngay đầu handler: nếu `eventIdInput` không phải UUID hợp lệ
thì **từ chối**, chứ không đi tiếp với `null`. Hôm nay handler nhận `null` và vẫn chạy
qua toàn bộ chuỗi rate-limit như không có chuyện gì. Lá chắn không nổ, nó chỉ *biến mất*.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| **1** | Sự cố 1 — xoá giải cuốn theo sổ tiền MLP (+ LIVE-1/LIVE-2) | Cao | **Rất cao** — im lặng tuyệt đối, lộ khi có tranh chấp, dữ liệu mất vĩnh viễn | **P0** |
| **2** | Sự cố 2 — restore dựng dậy người đã tự huỷ, vượt sức chứa | TB–Cao | Cao — con số `22/16` hiện ra nhưng bị đọc nhầm là lỗi UI; hậu quả rơi vào người chơi ngoài app | **P1** |
| **3** | Sự cố 3 — OTP rate limit chết vì `event_id = null` | TB | TB — kill-switch buộc nó lộ trong 12h, nhưng lộ dưới dạng triệu chứng ngược | **P2** |

Lý do #1 đứng đầu dù #3 tốn tiền mặt ngay: #3 **tự dừng** — nền tảng có kill-switch, và
tổn thất có trần đo được (`ZBS_DAILY_BUDGET_VND`). #1 không có trần, không có đáy, và
không có tín hiệu; mỗi lần xảy ra nó ăn mòn đúng thứ khó xây lại nhất — niềm tin của
organizer rằng sổ sách của họ nằm an toàn trên ThePickleHub. Và #1 **đúng ngay hôm nay**,
không cần chờ UX-06 ship.

---

## Rẻ nhất để chặn từ bây giờ

1. **Một guard trong DB, không phải trong UI** — trigger `BEFORE DELETE` trên
   `team_match_teams`: `RAISE EXCEPTION` nếu `payment_status IN ('claimed','confirmed')`.
   ~8 dòng SQL, chặn cùng lúc web (`useTeamMatchTeams.ts:421`), native
   (`TeamMatchManageTeamsView.swift:221`) và cascade từ `MyTournaments.tsx:246`.
   Đây là **cách duy nhất** vá được cả ba mặt bằng một diff — vá ở UI thì phải vá 3 chỗ
   và native còn chưa lên store được (App Store RED-gated).
2. **Đếm trước khi hỏi** — thêm số đội/số đăng ký vào 4 query ở
   `MyTournaments.tsx:88-130` và nhét vào dialog `:558-560`: *"Giải này có 12 đội,
   8 đội đã đóng lệ phí."* Một câu, và nó biến LIVE-2 từ bẫy thành lựa chọn có thông tin.
3. **Một `if` ở đầu `phone-otp-send`** — reject khi `event_id` không phải UUID, thay vì
   đi tiếp với `null`. Chặn Sự cố 3 tại gốc trước khi ai kịp nghĩ tới việc nới cột.

Cả ba đều là guard, không phải feature. Không cái nào cần UX-06/07 phải ship.

---

## Khoảng hở của pipeline mà bài này lộ ra

**1. Không gate nào hỏi "hàng này chứa cái gì", chỉ hỏi "ai được xoá hàng này".**
RLS trên `team_match_teams` (`20260107133349:300-305`) đúng hoàn hảo — chỉ creator/admin
xoá được. Panel, risk-auditor và CI đều dừng ở đó vì câu hỏi phân quyền đã có đáp án
sạch. Không ô nào trên checklist ghi *"hàng bị xoá có mang trạng thái tiền không"*.
`/idea` cần một câu hỏi thường trực cho mọi thao tác phá huỷ: **cột nào trên hàng này là
bằng chứng duy nhất của một sự kiện ngoài đời?**

**2. Bất biến sống trong hàm, không sống trong bảng.**
DB-01/DB-01c là công việc tốt, nhưng nó đặt advisory lock **bên trong** hai RPC. Bất kỳ
đường ghi mới nào — kể cả đường do chính chúng ta viết ở vòng sau — đều đi vòng được
mà không gate nào biết. Không có CHECK, không có trigger, không có test nào assert
`active_count <= max_players` ở tầng schema. Mỗi cụm mới là một cơ hội mở lại đúng
lớp bug đã đóng. Đây là món nợ kiến trúc, và nó sẽ tái phát cho tới khi bất biến được
hạ xuống tầng bảng.

**3. Cột NOT NULL bị nới là một thay đổi bảo mật, và pipeline coi nó là chỗ nhỏ.**
Sự cố 3 sống được vì `NOT NULL` bị bỏ ở một PR và hậu quả rơi vào một `.eq()` cách đó
một file. Không diff review nào bắt được nối này. Gợi ý cụ thể: đưa "migration nào
DROP NOT NULL / DROP CONSTRAINT" thành mục bắt buộc kể tên **mọi query đang lọc trên
cột đó**.

**4. Cái sai chỉ Postgres thật mới bắt được thì mock không bắt.**
`.eq("event_id", null)` pass mọi unit test viết bằng fake store (đúng pattern
`PaymentOrderStore` ở `create-payment-order/handler.ts:49-66` — pattern tốt cho logic,
mù cho ngữ nghĩa SQL). pgTAP gate có tồn tại; các nhánh liên quan NULL cần rơi vào đó,
không rơi vào vitest.

**5. Test luôn chạy trên dữ liệu chưa có tiền sử.**
Sự cố 2 tồn tại được vì không test nào dựng trạng thái "có người tự huỷ **trước khi**
organizer huỷ". Đó không phải nhánh code — đó là *tiền sử của dữ liệu*, và pipeline hiện
tại không có chỗ nào mô tả nó. Với mọi thao tác undo/restore, gate cần một câu hỏi bắt
buộc: **hàng này có thể tới trạng thái hiện tại bằng mấy đường khác nhau, và undo có
phân biệt được chúng không?** Trong `event_registrations` câu trả lời là hai đường,
và undo không phân biệt được.
