# PR — feat/proxy-and-manual-registration

Branch: `feat/proxy-and-manual-registration` (chưa push — sandbox bash bị lỗi disk space, anh push thủ công).

## File đã tạo / sửa

### Migration (1 file mới)
- `supabase/migrations/20260521100000_proxy_and_manual_registration.sql`
  - Thêm 3 cột vào `event_registrations`: `registered_by_profile_id`, `registration_source` ('self'|'proxy'|'manual'), `internal_notes`
  - 2 index mới (registered_by_profile_id partial + source/created_at partial)
  - 3 SECURITY DEFINER RPC: `count_proxy_registrations_recent`, `count_manual_registrations_recent`, `verify_event_organizer`
  - Idempotent — replay-safe

### Edge function (1 file mới)
- `supabase/functions/add-registration-direct/index.ts`
- `supabase/config.toml` — thêm block `[functions.add-registration-direct] verify_jwt = false`
- Input: `{ event_id, guest_phone, guest_name, guest_self_rating?, mode, proxy_magic_token? | organizer_auth_token?, initial_payment_status?, internal_notes? }`
- Auth: proxy_magic_token cho proxy mode, JWT verify nội bộ cho manual mode
- Trả: `{ success, magic_token, recovery_url, reference_code, ... }`

### Frontend (4 file mới + 5 file sửa)
**Mới:**
- `src/lib/social-events/addRegistrationDirect.ts` — helper invoke edge function
- `src/components/social-events/RegistrationSuccessShare.tsx` — shared success card (copy link, share Zalo/FB, copy payment info)
- `src/components/social-events/ProxyRegistrationModal.tsx` — entry point user A đăng ký hộ B
- `src/components/social-events/ManualAddRegistrationModal.tsx` — entry point organizer thêm thủ công

**Sửa:**
- `src/hooks/useEventRegistrations.ts` — thêm `registration_source`, `registered_by_profile_id`, `internal_notes` vào row type + query
- `src/pages/SocialEventDetail.tsx` — thêm button "+ Đăng ký hộ bạn bè" cạnh "Xem đăng ký", mount ProxyRegistrationModal, bank info query, badge "đăng ký hộ" trên roster public
- `src/pages/SocialEventRoster.tsx` — thay dialog manualAdd cũ bằng ManualAddRegistrationModal, thêm badge "đăng ký hộ"/"BTC thêm" + internal_notes trong cell tên
- `src/i18n/vi.ts` — thêm khối `proxyRegister` (type + data)
- `src/i18n/en.ts` — thêm khối `proxyRegister`

## Lệnh chạy thủ công (sandbox bash bị lỗi disk, anh chạy local)

### 1. Tạo branch + commit
```bash
cd /Users/cuongmit/pickle-hub-pro
git fetch origin
git checkout -b feat/proxy-and-manual-registration origin/main

# stage tất cả thay đổi
git add \
  supabase/migrations/20260521100000_proxy_and_manual_registration.sql \
  supabase/functions/add-registration-direct/index.ts \
  supabase/config.toml \
  src/lib/social-events/addRegistrationDirect.ts \
  src/components/social-events/RegistrationSuccessShare.tsx \
  src/components/social-events/ProxyRegistrationModal.tsx \
  src/components/social-events/ManualAddRegistrationModal.tsx \
  src/hooks/useEventRegistrations.ts \
  src/pages/SocialEventDetail.tsx \
  src/pages/SocialEventRoster.tsx \
  src/i18n/vi.ts \
  src/i18n/en.ts \
  PR_proxy_and_manual_registration.md

git commit -m "feat(social-events): proxy + manual registration (no OTP)

User-facing:
- New '+ Đăng ký hộ bạn bè' button on /social/<slug> when the viewer is
  already registered. Opens ProxyRegistrationModal — A enters B's phone +
  name and B gets a /dang-ky/<token> link without going through OTP.
- Replaces the legacy 'Thêm thủ công' dialog in the organizer roster
  with ManualAddRegistrationModal: payment-status radio (unpaid /
  claimed_paid / waived), internal notes, and a copy/share success
  state that hands the BTC the player's /dang-ky/<token> URL.

Backend:
- New edge function add-registration-direct (verify_jwt=false; verifies
  internally via proxy_magic_token OR supabase.auth.getUser + the new
  verify_event_organizer RPC).
- Rate limits: 5 proxy / 24h per A profile, 50 manual / 24h per
  organizer profile.

Schema:
- event_registrations: +registered_by_profile_id, +registration_source
  ('self'|'proxy'|'manual'), +internal_notes. Backward-compatible —
  existing rows default to source='self'.
- 3 new SECURITY DEFINER RPCs: count_proxy_registrations_recent,
  count_manual_registrations_recent, verify_event_organizer.

UI badges:
- Public roster shows a subtle 'đăng ký hộ' pill next to proxy rows.
  'BTC thêm' badge + internal_notes preview only render on the
  organizer dashboard."

# push (anh đã có GITHUB_PAT trong secrets.local.md)
git push "https://cuongnguyen84:$GITHUB_PAT@github.com/cuongnguyen84/pickle-hub-pro.git" feat/proxy-and-manual-registration

# open PR
gh pr create --base main --head feat/proxy-and-manual-registration \
  --title "feat(social-events): proxy + manual registration (no OTP)" \
  --body-file PR_proxy_and_manual_registration.md
```

### 2. Apply migration (Supabase SQL Editor)
1. https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl/sql/new
2. Paste nội dung của `supabase/migrations/20260521100000_proxy_and_manual_registration.sql`
3. Run

Hoặc CLI nếu có:
```bash
supabase db push --project-ref ajvlcamxemgbxduhiqrl
```

### 3. Deploy edge function
```bash
cd /Users/cuongmit/pickle-hub-pro
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN \
  supabase functions deploy add-registration-direct \
  --project-ref ajvlcamxemgbxduhiqrl \
  --no-verify-jwt
```

### 4. Kiểm tra deploy
```bash
SUPABASE_ACCESS_TOKEN=$SUPABASE_ACCESS_TOKEN \
  supabase functions list --project-ref ajvlcamxemgbxduhiqrl | grep add-registration-direct

# test no-JWT smoke (expect 400 invalid_event_id)
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"mode":"proxy","event_id":"x"}' \
  https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/add-registration-direct
```

## Test plan checklist

### Setup
- [ ] Migration chạy qua Supabase SQL Editor
- [ ] Edge function deployed
- [ ] Frontend preview URL từ Cloudflare Pages (sau khi push branch)

### Feature 1 — Proxy registration
- [ ] A đăng ký event qua flow OTP thường
- [ ] A reload event page → banner "Bạn đã đăng ký" + 2 button: "Xem đăng ký" + "+ Đăng ký hộ bạn bè"
- [ ] Click "+ Đăng ký hộ" → ProxyRegistrationModal mở
- [ ] Nhập SĐT B + tên "Anh Tâm" + level 3.5 → "Xác nhận đăng ký hộ"
- [ ] Success card: ✅ "Đã thêm Anh Tâm vào sự kiện" + warning vàng "vui lòng gửi link"
- [ ] Card link `/dang-ky/<token>` của B + 3 button (Sao chép / Zalo / Facebook)
- [ ] (Event có phí) card mã thanh toán PHUB-XXXXXX + bank info preview + button copy info CK
- [ ] Click "Sao chép link" → toast "Đã sao chép link"
- [ ] Click "Chia sẻ Zalo" → tab Zalo share dialog mở
- [ ] Mở incognito → paste link → render trang đăng ký của B đúng
- [ ] SQL verify: `SELECT registration_source, registered_by_profile_id, internal_notes FROM event_registrations WHERE phone = '+84...'` → source='proxy', registered_by_profile_id = A's profile, internal_notes=NULL
- [ ] Public event page roster có badge "đăng ký hộ" cạnh tên Anh Tâm
- [ ] Click "+ Thêm người khác" → form reset, counter +1

### Feature 1 — Proxy rate limit
- [ ] A đăng ký hộ 5 người liên tiếp → người thứ 6 toast "Bạn đã đăng ký hộ tối đa 5 người/24h"
- [ ] SQL: `SELECT count_proxy_registrations_recent('<A_profile_id>'::uuid, 24);` → 5

### Feature 2 — Manual add by organizer
- [ ] Login organizer (creator CLB)
- [ ] Vào `/social/<slug>/danh-sach` → button "+ Thêm thủ công" → ManualAddRegistrationModal mở
- [ ] Nhập SĐT C + tên "Bác Hùng" + level 2.5
- [ ] Chọn "Đã thanh toán tại sân"
- [ ] Internal notes "VIP, bạn của BTC"
- [ ] Submit → success state (KHÔNG có warning vàng vì payment=claimed)
- [ ] SQL verify: `SELECT registration_source, registered_by_profile_id, internal_notes, payment_status FROM event_registrations WHERE phone='+84...'` → source='manual', notes='VIP...', payment_status='paid'
- [ ] payment_orders: player_claimed_paid=true
- [ ] Public roster (anon) → Bác Hùng xuất hiện, KHÔNG có badge "BTC thêm"
- [ ] Organizer roster → Bác Hùng có badge "BTC thêm" + thấy note "VIP, bạn của BTC"

### Feature 2 — Manual unauthorized
- [ ] Curl edge function với JWT của user thường → 403 unauthorized

### Shared edge cases
- [ ] SĐT đã đăng ký active → error "already_registered"
- [ ] SĐT đã cancelled → re-register: clear cancelled_at, KEEP magic_token
- [ ] Event đầy → error "event_full"
- [ ] Event free (price_vnd=0) → modal KHÔNG hiển thị payment section
- [ ] Proxy nhập SĐT trùng A → error "already_registered"

### Recovery cross-flow
- [ ] B nhận link → mở `/dang-ky/<token>` → "Hủy đăng ký" thành công
- [ ] A's registration không bị ảnh hưởng

## Notes

### Backward compat
- Existing event_registrations default `registration_source='self'`
- Existing flow OTP (phone-otp-verify) KHÔNG bị đụng — vẫn insert mà không set registration_source (DEFAULT lo)
- Existing add_walk_in_registration RPC vẫn còn để dùng nếu cần (hiện không có UI gọi vì SocialEventRoster đã chuyển sang modal mới)

### Risk spam + mitigation
- Proxy rate limit 5/24h/profile A → giới hạn fan-out qua 1 account
- Manual rate limit 50/24h/profile organizer → cao hơn nhưng vẫn chặn abuse
- Rate-limit check thực hiện qua SECURITY DEFINER RPC, không qua RLS
- Edge function vẫn gọi verify_event_organizer (DB-side check) → frontend exploit không bypass được

### Zalo OA chưa active
- Hiện proxy/manual KHÔNG auto-notify guest — người add phải tự forward link qua Zalo cá nhân / Facebook / SMS
- Warning vàng trong UI nhắc explicit
- Khi Zalo OA template approve → follow-up PR thêm bước notify trong edge function (gọi sendZaloMessage trước khi return)

### Future follow-ups
- Auto-notify Zalo OA cho proxy/manual add khi template approved
- Cột UI "Đối chiếu thanh toán" — tick từng player đã CK
- Bulk import CSV
- Multi-organizer khi có bảng `club_members`

## Files changed summary
```
A  supabase/migrations/20260521100000_proxy_and_manual_registration.sql
A  supabase/functions/add-registration-direct/index.ts
M  supabase/config.toml
A  src/lib/social-events/addRegistrationDirect.ts
A  src/components/social-events/RegistrationSuccessShare.tsx
A  src/components/social-events/ProxyRegistrationModal.tsx
A  src/components/social-events/ManualAddRegistrationModal.tsx
M  src/hooks/useEventRegistrations.ts
M  src/pages/SocialEventDetail.tsx
M  src/pages/SocialEventRoster.tsx
M  src/i18n/vi.ts
M  src/i18n/en.ts
```
