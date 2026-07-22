# solution-architect — referee-pin (vòng 1, nguyên văn)

Đã verify đủ. Điểm load-bearing xác nhận: (1) RLS INSERT trên cả 4 bảng `*_referees` là **creator-only** (`is_*_creator` trong `WITH CHECK`) → user tự nhập PIN **không thể** self-insert bằng client thường, bắt buộc qua `SECURITY DEFINER` RPC hoặc edge function. (2) Bài học #430 (`20260722000000_...lockdown.sql`): mọi cột secret trên bảng có `select('*')` phải REVOKE + re-GRANT theo cột — nếu nhét PIN thành cột trên 4 bảng tournament thì phải trả giá 4 migration lockdown + bẫy "cột mới phải grant tay". (3) Quick Table + Team Match có `status='completed'`; Doubles Elim + Flex chỉ có `status: string` tự do, không có cột champion → auto-expiry không đồng nhất được cho cả 4.

---

## Tóm tắt kiến trúc

Thêm **một bảng phụ `referee_pins`** (polymorphic theo `format` + `parent_id`) giữ PIN đã hash, và **một RPC `redeem_referee_pin` SECURITY DEFINER** verify PIN rồi tự chèn hàng referee — vì RLS hiện tại chặn user tự thêm mình. Không nhét PIN thành cột trên 4 bảng tournament (né hẳn gánh nặng column-lockdown của #430). Không route công khai mới → **không phát sinh nghĩa vụ SSR/sitemap/hreflang**; luồng nhập PIN là dialog trên màn tournament sẵn có.

## Option A — Bảng phụ + RPC hash + rate-limit (bản chắc)

Effort: **4.5–5 half-days** · Data: 1 migration mới (bảng + 3 RPC + bảng attempts), regen types

Files:
- `supabase/migrations/2026072203xxxx_referee_pins.sql` (mới) — bảng `referee_pins(id, format text CHECK in 4, parent_id uuid, pin_hash text, is_active bool, created_by uuid, created_at)` + UNIQUE(format, parent_id); bảng `referee_pin_attempts(user_id, format, parent_id, created_at)`; extension `pgcrypto`; RPC `set_referee_pin`, `redeem_referee_pin`, `clear_referee_pin`.
- `src/integrations/supabase/types.ts` (regen)
- `src/lib/referee-helpers.ts` — thêm `redeemRefereePin()`, `setRefereePin()`, `getRefereePinStatus()` (chỉ trả `is_active`, KHÔNG trả hash/pin).
- Organizer UI (component chung `src/components/tournament/RefereePinSettings.tsx` mới, `<Switch>` mượn pattern `TeamMatchSettingsDialog.tsx:180`) nhúng vào 4 setup: `DoublesEliminationSetup.tsx`, `FlexTournamentSetup.tsx`, `QuickTableSetup.tsx`, `TeamMatchSetup.tsx`.
- Redeemer UI: `src/components/tournament/RefereePinDialog.tsx` (mới) — nút "Trở thành trọng tài" cho user đã login chưa-phải-referee, gắn trên 4 màn view tournament; sau redeem gọi `refetch` của hook referee tương ứng.
- i18n: `src/i18n/en.ts` + `src/i18n/vi.ts` — namespace `t.referee.pin.*` (VI+EN từ ngày 1).
- Test: `src/lib/__tests__/refereePin.test.ts`.

How it works: Organizer đặt PIN trong wizard → `set_referee_pin` hash bằng `crypt()` lưu vào `referee_pins`. User login nhập PIN → `redeem_referee_pin(format, parent_id, pin)`: (a) đếm `referee_pin_attempts` của `auth.uid()` trong 15 phút, >10 thì chặn; (b) `crypt(pin, pin_hash)=pin_hash` + `is_active`; (c) chặn nếu parent `status='completed'` (chỉ QuickTable/TeamMatch); (d) INSERT hàng referee cho `auth.uid()` (definer bypass RLS). RLS trên `referee_pins`: **chỉ creator SELECT/manage**, KHÔNG grant anon → hash không bao giờ lộ qua `select('*')`.

Wins: hash + rate-limit + không lộ secret là hàng chắc nhất; bảng phụ né sạch column-lockdown 4 bảng; PIN 4 số vẫn an toàn nhờ giới hạn thử. Loses: nhiều nhất; organizer không xem lại được PIN (chỉ đặt mới) — chấp nhận được vì họ tự gõ. Forecloses: gần như không; muốn nới sau (per-tournament expiry cột riêng, share-link) đều thêm được trên bảng phụ.

## Option B — Bảng phụ, plaintext creator-only, không rate-limit (bản rẻ)

Effort: **3 half-days** · Data: 1 migration (bảng + 2 RPC), regen types

Files: như A nhưng **bỏ** `referee_pin_attempts`; PIN lưu plaintext, RLS `referee_pins` SELECT chỉ creator (organizer xem/sửa PIN trực tiếp trong wizard); `redeem_referee_pin` chỉ so sánh chuỗi + `is_active`; **không** auto-expiry (chỉ toggle tay); ép PIN 6 số ở UI. Cùng bộ file frontend/i18n, chỉ `RefereePinDialog` + `RefereePinSettings` đơn giản hơn.

How it works: giống A, bỏ tầng hash + attempts + status-check. Brute-force chống bằng: bắt buộc login + audit `created_by` + không grant anon + PIN 6 số (10^6 không gian) + organizer tắt được ngay.

Wins: rẻ nhất, ít bề mặt; organizer xem lại PIN được (UX venue tốt). Loses: 6-số không rate-limit vẫn brute-force được về lý thuyết; plaintext → nếu lỡ cấu hình sai RLS là lộ thẳng PIN; PIN không tự hết hạn. Forecloses: không — nâng lên A sau chỉ là ALTER thêm cột hash + bảng attempts, không phá dữ liệu.

## Option C — Cột PIN trên 4 bảng tournament (bản "hiển nhiên", loại)

Effort: **5.5–6 half-days** · Data: cột `referee_pin_hash` trên 4 bảng + **4 migration column-lockdown** + regen

How it works: nhét PIN thành cột trên chính bảng tournament, redeem RPC đọc tại chỗ. Vì 4 bảng đều bị `select('*')` từ client (kể cả badge public), mỗi bảng phải REVOKE + re-GRANT theo cột đúng như `20260722000000` — và dính bẫy "cột mới phải grant tay mãi mãi".

Wins: không thêm bảng. Loses: nhân 4 gánh nặng #430, tăng vĩnh viễn rủi ro lộ secret mỗi lần thêm cột vào 4 bảng nóng. Forecloses: khoá dữ liệu PIN vào 4 schema khác nhau → khó thêm share-link/expiry thống nhất.

## Khuyến nghị

**Option A.** C thua vì tự chuốc lấy 4 lần bài học #430 và bẫy maintenance vĩnh viễn trên đúng những bảng đông người đọc nhất — sai lầm cho người một mình vận hành. B thua A ở đúng một chỗ nhưng là chỗ không nên tiết kiệm: đây là **trust boundary cấp quyền** (SECURITY DEFINER bypass RLS), bỏ rate-limit + hash là bỏ chốt an ninh — ponytail cho phép lười ở code, không cho phép lười ở trust boundary. Chi phí A hơn B chỉ ~1.5 half-days (bảng attempts + `crypt()` + status-check) mà đổi lấy khác biệt an ninh thật. Nếu Cuong muốn cắt phạm vi, cắt ở **native parity** và **auto-expiry Doubles/Flex**, đừng cắt hash/rate-limit.

**Cờ đỏ cần Cuong biết:** RPC mới `redeem_referee_pin` là `SECURITY DEFINER` bypass RLS để cấp quyền — không chạm auth/payments/`config.toml` nên **không tự động RED-tier**, nhưng đúng loại thay đổi nên soi kỹ RLS + rate-limit trước khi merge. Chạy `node scripts/agents/risk-tier.mjs` trên migration để xác nhận tier trước push.

## Increments

1. **Migration + 3 RPC + regen types** — verify: gọi `redeem_referee_pin` bằng anon key phải 42501/`insufficient`; `select('pin_hash')` từ anon phải rỗng/deny; đặt PIN sai → false, đúng → hàng referee xuất hiện.
2. **`referee-helpers.ts` + i18n VI/EN** — verify: `npm run test` cho `refereePin.test.ts` (map format→bảng, guard already-referee).
3. **Organizer `RefereePinSettings` nhúng 4 setup** — verify tay: bật/đặt/tắt PIN, reload wizard giữ trạng thái `is_active`.
4. **Redeemer `RefereePinDialog` trên 4 màn view** — verify tay: user thứ 2 login nhập PIN → thành referee → chấm điểm được; nhập sai 11 lần bị chặn. **Điểm dừng-nhìn tự nhiên ở đây** — ship web, đọc xem có ai dùng trước khi làm native/auto-expiry.
5. (defer) Auto-expiry Doubles/Flex + native parity.

## Điều em không chắc

- **Auto-expiry cho Doubles Elim + Flex:** hai format này không có `status='completed'` chuẩn — recon xác nhận chỉ có `final_placement` cấp team. Em enforce expiry được sạch cho QuickTable/TeamMatch; với 2 format kia phải hoặc (a) suy vô địch từ `final_placement=1` tồn tại (chưa verify query này rẻ/đúng), hoặc (b) chỉ dựa toggle tay. Cần Cuong chốt tín hiệu "kết thúc" cho Doubles/Flex, hoặc chấp nhận defer auto-expiry cho 2 format này ở v1. Tác hại thực của việc không auto-hết-hạn là thấp (referee thừa chỉ sửa được điểm giải đã xong).
- **Màn "view tournament" để gắn `RefereePinDialog`:** em chưa mở đủ 4 trang view (mới xem setup) để chắc điểm mount + hook `refetch` đồng nhất — cần đọc `RefereeManagement.tsx` callers và 4 view page trước khi cam kết inc 4 là 1 half-day.
- **Có nên cho share-link `?refpin=` prefill không:** intake không chốt. Em cố ý loại khỏi v1 vì nó kéo theo câu hỏi route/SSR; nếu Cuong muốn link chia sẻ QR tại sân thì đó là inc 6, không đổi data model.
