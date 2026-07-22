# Referee PIN — trọng tài tự vào giải bằng mã PIN

> Slug: `referee-pin` · Ngày: `2026-07-22` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none` (lưu ý: `scripts/agents/ask-model.mjs` không có trong worktree lúc chạy — ui-ux-critic gọi OpenAI API trực tiếp, harness gắn cảnh báo data-out-to-external; raw đã lưu đủ ở `external/`)
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D1 | PIN lưu **đọc-lại-được** hay **hash**? (Cả hai phía đã hội tụ: bảng riêng khóa kín + reveal qua RPC creator-only + rate-limit redeem. Chỉ còn 1 nút.) | `solution-architect` (sau REFINE) + `ui-ux-critic`: lưu đọc-lại-được theo đúng pattern `invite_code` của repo — organizer tại sân xem/copy/share nhiều lần; hash 6 số là "security theater" (10^6 brute offline trong ms) | Lập trường hash vòng 1: nếu một ngày RLS/GRANT cấu hình sai, bản hash không lộ mã dùng được, bản plaintext lộ | Chọn plaintext: rủi ro dư chỉ còn "RLS sai thì lộ PIN rotate-được". Chọn hash: organizer không xem lại PIN được, chỉ rotate — phiền thật ở sân |
| D3 | Trọng tài nhập PIN ở đâu: **dialog trên trang giải sẵn có** hay **route riêng `/referee/join/:format/:id`**? (Đã hội tụ: share-link mang format+id là luồng chính v1, `buildLoginRedirect` bắt buộc, chi phí SSR route mới ≈ 0 — hai bên đều đã kiểm chứng file.) | `solution-architect`: dùng URL trang giải sẵn có + dialog "Trở thành trọng tài" — ít code, trọng tài đáp xuống trang giải quen thuộc | `ui-ux-critic`: route join chuyên dụng — màn hình gọn đúng một việc nhập PIN, dễ in QR, không bắt trọng tài tìm nút trong trang giải đông đúc | Thuần UX, không có đường sai chết người; đổi sau được nhưng đổi = đổi URL đã in QR |

**Khuyến nghị của orchestrator để anh khỏi phải nghĩ lâu:** D1 chọn đọc-lại-được (2 agent + GPT-5.6 cùng phía, khớp pattern repo, điều kiện tiên quyết: bảng khóa kín đúng như thiết kế); D3 chọn dialog-trên-view cho v1 (ít code, URL giải đã có sẵn QR-able), route riêng để dành khi có nhu cầu in QR chuyên dụng.

---

## 1. Ý tưởng gốc

> tạo PIN code hoặc mật khẩu cho giải đấu tại các chức năng trên /tools bao gồm Doubles Eli, Team match, quick-table, Flex. Khi người dùng bất kì nhập PIN code, người đó sẽ trở thành trọng tài của giải, không cần thiết phải thêm trọng tài thủ công như hiện tại (vẫn giữ)

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Organizer (đặt PIN) + người được nhờ làm trọng tài tại sân (nhập PIN) |
| Auth | Người nhập PIN **phải đăng nhập** — quyền gắn vào user_id, audit được |
| Quyền hạn | Đúng bằng trọng tài thêm thủ công hôm nay (chỉ chấm/sửa tỉ số) — không hơn |
| Vòng đời PIN | Organizer bật/tắt + đổi trong màn setup giải; tự hết hạn khi giải kết thúc (có nhà vô địch) |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED |
| **Khuyến nghị** | Option A′ (A bỏ hash nếu anh chốt D1 theo khuyến nghị) — bảng `referee_pins` riêng khóa kín + RPC SECURITY DEFINER + rate-limit + expiry check cả 4 format |
| **Công sức** | 4.5–5 nửa ngày (web; native + route join để sau) |
| **Rủi ro lớn nhất** | Người lạ thành trọng tài (đoán/đọc trộm PIN) sửa tỉ số giải đang chạy → sai bracket/DUPR, không revert được bằng git |
| **Auto-merge** | **Chặn — cần Cuong duyệt** (migration DB + RPC cấp quyền) |

🔴 RED nghĩa là: **không revert được bằng `git revert`.** Ở đây: migration prod + một RPC bypass RLS để cấp quyền ghi điểm. Pipeline dừng chờ anh duyệt trước khi `/ship`.

---

## 3. Đã có sẵn gì (recon)

Cơ chế trọng tài thủ công **đã tồn tại đầy đủ, đồng nhất cho cả 4 format** — feature này chỉ thêm lối vào bằng PIN, không xây hệ trọng tài mới.

**Prior art:**
- 4 bảng `doubles_elimination_referees` / `flex_tournament_referees` / `quick_table_referees` / `team_match_referees`, cùng shape `{id, fk, user_id, created_at}`; RLS INSERT **creator-only** → user không tự thêm mình được → redeem PIN bắt buộc qua RPC SECURITY DEFINER.
- Quyền trọng tài = UPDATE match/score qua `is_<format>_referee()` — đúng yêu cầu "không hơn không kém", không cần đổi.
- `src/lib/referee-helpers.ts` + 4 hook + `RefereeManagement.tsx` (add-by-email) — UI/logic gắn thêm vào đây.
- Bài học #430 (`20260722000000_team_match_invite_code_lockdown.sql`): secret không sống được trên bảng có `select('*')` public.

**Sẽ đụng vào:** 1 migration mới (bảng + RPC), `referee-helpers.ts`, component PIN mới nhúng 4 trang setup + trang view, i18n en/vi, types regen, test.

**Ràng buộc đã ghi trong repo:** native `/apple` đang `select("*")` trên bảng tournament (`DoublesElimRepository.swift:79`) → cấm mọi thiết kế đòi REVOKE cột trên bảng cha, nếu không app đã cài chết màn Doubles (42501, không vá được).

---

## 4. Phương án (solution-architect)

### Option A — Bảng phụ + RPC + rate-limit (khuyến nghị, đã refine sau vòng 2)

Effort: 4.5–5 nửa ngày · Data: 1 migration (bảng `referee_pins`, bảng `referee_pin_attempts`, 3 RPC)

Cách hoạt động:
- Bảng `referee_pins(format CHECK in 4, parent_id, pin*, is_active, created_by, created_at)` UNIQUE(format, parent_id) — **không GRANT SELECT cho anon/authenticated**; đọc duy nhất qua RPC creator-gated. (*`pin` plaintext hay `pin_hash` = D1 anh chốt.)
- `set_referee_pin` / `clear_referee_pin`: creator-only. `redeem_referee_pin(format, parent_id, pin)`: rate-limit theo `auth.uid()` (10 lần/15p, mirror pattern `phone-otp-send`) + budget toàn cục chống spray → verify PIN + `is_active` → **check expiry cho CẢ 4 format** (xem D4 đã resolve) → INSERT referee row cho `auth.uid()` (không nhận user_id từ body), nguyên tử trong 1 transaction.
- Expiry (kết quả D4): `status='completed'` check cho cả 4 — tín hiệu này ĐÃ tồn tại cho DE/Flex nhờ cron `auto-archive-tournaments` (dập completed sau 14 ngày, phát hiện vòng 2 của pre-mortem); bịt cửa sổ 0–14 ngày cho Doubles Elim bằng check `final_placement=1` tồn tại + WARNING log khi redeem sau chung kết.
- UI organizer: `RefereePinSettings.tsx` (Switch + mã + copy/share) nhúng 4 trang setup (QuickTableSetup có `table.id` thật — D2 đã resolve) + điểm quản lý/rotate trên QuickTableView (setup là màn một-lần).
- UI trọng tài: theo D3 anh chốt (dialog trên view hoặc route join). Dù chọn gì: `buildLoginRedirect` trong v1, offline chặn nhập (không queue việc cấp quyền).

Được: diệt tận gốc Sự cố 2 của pre-mortem (PIN không bao giờ nằm trên bảng public), không đụng native `select("*")`, brute-force bị chặn bằng rate-limit chứ không phải bằng niềm tin. · Mất: nhiều móc nối nhất (bảng attempts + expiry 2 tầng). · Đóng cửa gì: gần như không — share-link QR, native parity, per-tournament expires_at đều thêm được sau.

### Option B — Bản rẻ: plaintext, không rate-limit, không auto-expiry

Effort: 3 nửa ngày. Bị cả risk-auditor lẫn pre-mortem bác: bỏ rate-limit ở một RPC cấp quyền ghi điểm là bỏ chốt an ninh ở đúng trust boundary; PIN 6 số + tournament_id enumerable = brute-force được. Chỉ rẻ hơn A ~1.5 nửa ngày.

### Option C — Cột PIN trên 4 bảng tournament (loại)

Tự chuốc 4 lần bài học #430 + bẫy "cột mới phải grant tay mãi mãi" + rủi ro 42501 giết native đã cài. Cả 4 agent (và GPT-5.6 ở cả 2 phiên độc lập) cùng bác — đây là đồng thuận cross-vendor, đáng tin.

### Increments

1. Migration + 3 RPC + regen types — verify: anon gọi redeem → chặn; anon `select('pin')` → 0 rows/42501; redeem đúng PIN → referee row xuất hiện; redeem trên giải completed → EXPIRED. pgTAP có control probe 42501 (class lỗi đã tái diễn 3+ lần).
2. `referee-helpers.ts` + i18n VI/EN + `refereePin.test.ts`.
3. `RefereePinSettings` nhúng 4 setup + QuickTableView — verify tay: bật/đổi/tắt, reload giữ trạng thái.
4. Luồng redeem (theo D3) + `buildLoginRedirect` — verify tay: user thứ 2 nhập PIN → chấm điểm được; sai 11 lần → chặn. **Điểm dừng-nhìn: ship web, xem có ai dùng rồi mới làm tiếp.**
5. (defer) Native parity, route join chuyên dụng/QR nếu D3 chọn dialog, `referee_live_state` versioning (nợ riêng, xem mục 6).

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Luồng người dùng

Organizer: setup giải → bật "Cho phép vào bằng mã PIN" → server sinh mã 6 số → copy/share (Web Share: link giải + PIN). Trọng tài: nhận link qua Zalo/FB → mở trang giải/màn join → (chưa login → "Đăng nhập để nhập mã" → quay lại đúng chỗ) → gõ PIN → "Bắt đầu chấm điểm" → vào danh sách trận.

### Vấn đề chính (sau vòng 2)

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Login redirect rớt param (class bug UX-07 vừa vá) | Dùng `buildLoginRedirect(location.pathname)`, test FB in-app browser + Chrome Android + Capacitor; **không** nhét PIN vào `?redirect` |
| 2 | Blocker | Offline không được queue việc cấp quyền | Chặn nhập khi offline + copy lỗi rõ |
| 3 | Nên sửa | Card Trọng tài đang chôn dưới nút Save trong `TeamMatchSettingsDialog:300-308` | Kéo lên sau Tên/Ngày, trước Lệ phí/DUPR — cả 4 format |
| 4 | Nên sửa | shadcn Input h-10 = 40px < 44px | Ô PIN ≥56px, MỘT `<input>` duy nhất, `inputmode="numeric"` `autocomplete="one-time-code"`, không auto-submit số thứ 6, lỗi `role="alert"` giữ focus tại field |
| 5 | Nên sửa | Nút mới không được thêm `.tl-btn` (ratchet DS-03 HARD sau 01/08) | Dùng `<Button variant>` |
| 6 | Nit | Không phân biệt trọng tài email vs PIN | Badge nguồn trong danh sách (cần cột `source` — auditor #7 cũng đòi) |

Copy VI/EN đầy đủ (mask/reveal, rotate dialog, sai PIN, hết hạn, đã-là-trọng-tài, offline) đã soạn sẵn trong `round1/ui-ux-critic.md` — dùng thẳng khi `/ship`. Điểm ăn tiền: tách thông điệp "mã bị đổi" vs "giải kết thúc", không dùng chung "Mã hết hạn".

### Panel đa model

Claude + GPT-5.6 đồng thuận: card Trọng tài hợp nhất (PIN là phương thức thứ 2 cạnh email), mask+reveal+copy/share, một input semantic, offline chặn, login-redirect là blocker. Bất đồng nội bộ đã ghi trong round1 (URL join, auto-expire, chỗ đặt PIN) — critic thắng nhờ đọc được repo, riêng "QT wizard chưa có id" critic sai và đã concede vòng 2.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED

Classifier nói: RED (migration schema/RLS). Auditor **giữ RED** với lý do sâu hơn: cấp năng lực ghi điểm cho người lạ; hai cách làm sai đều không revert được (rò PIN cho anon, hoặc 42501 giết native đã cài).

| # | Mức | Cơ chế hỏng | Giảm thiểu (đã nằm trong Option A) |
|---|-----|-------------|--------------------------------------|
| 1 | Cao | PIN thành cột bảng cha → anon đọc mọi PIN (lặp #430); pre-mortem xếp đây là sự cố ưu tiên 1 — im lặng vô hạn | Bảng riêng không anon-SELECT; CI grep cột `*_pin|*secret*` trên bảng public (đề xuất pipeline, làm cùng inc 1) |
| 2 | Cao | REVOKE cột trên bảng cha giết native `select("*")` — 42501 vĩnh viễn trên app đã cài | Bảng riêng né hoàn toàn; verify migration không ALTER 4 bảng cha |
| 3 | Cao | Brute-force PIN không rate-limit | Rate-limit/identity + budget toàn cục; PIN sinh ngẫu nhiên, cấm 1234/0000 |
| 4 | Cao | Self-INSERT nếu mở RLS thay vì RPC | Chỉ RPC SECURITY DEFINER, `REVOKE EXECUTE FROM PUBLIC`, INSERT `auth.uid()` |
| 5 | TB | Race verify-rồi-insert 2 bước | 1 RPC nguyên tử |
| 6 | TB | Expiry không định nghĩa cho DE/Flex | **ĐÃ RESOLVE D4**: check `status='completed'` cả 4 (auto-archive cron dập completed cho DE/Flex sau 14 ngày) + `final_placement` guard cửa sổ 0-14 ngày + WARNING log |
| 7 | Thấp | Không phân biệt trọng tài PIN vs tay; đổi PIN không thu hồi quyền đã cấp | Cột `source` trên 4 bảng referee (hoặc chấp nhận: expiry chỉ chặn redeem mới); copy rotate dialog đã nói rõ "trọng tài đã tham gia vẫn giữ quyền" |

**Nợ liền kề panel phát hiện (không thuộc scope PIN nhưng PIN làm nó nóng hơn):** `referee_live_state` là jsonb last-write-wins không version (`20260717150000`) — hai trọng tài (hoặc 1 troll) cùng ghi là clobber màn khán giả. Đáng một ticket riêng.

### SLO / Perf / SEO

- SLO 4 (scoring, zero lost-update): nặng nhất nếu làm sai — trọng tài chui sửa vòng sớm bracket. SLO 1/6 native: an toàn NẾU bảng riêng.
- Bundle: +3–6 KB gz toàn trên lazy route, không chạm INITIAL. Đạt.
- SEO: không đụng SSR/sitemap; không bump `pr:v30`. (Nếu D3 chọn route join: +1 regex NOINDEX_PATTERNS, vẫn không SSR.)

### Rollback

- Additive migration: rollback = DROP TABLE + DROP FUNCTION, vài phút, không mất dữ liệu cũ.
- **Không revert được:** trọng tài chui đã sửa điểm (phải audit tay + nhờ DUPR rollback); native binary nếu ship parity. Đó là cái làm nó RED.

### Phản biện độc lập (GPT-5.6)

Cả 7 cơ chế GPT-5.6 nêu đều được auditor xác minh trong repo (khớp #430, `DoublesElimRepository.swift:79`, race 2 bước, thiếu cột source...). Không claim nào bị bác. **Đồng thuận cross-vendor có nghĩa** ở: cấm PIN trên bảng cha, bắt buộc rate-limit, RPC-only.

---

## 7. Tranh luận trong panel

> Cưỡng chế bởi `debate-ledger.mjs` — 4 bất đồng · 2 giải quyết bằng bằng chứng · 2 mở cho Cuong · 0 nhượng bộ bị loại.

| # | Chủ đề | Vòng 2 | Trạng thái |
|---|--------|--------|------------|
| D1 | Hash vs xem-lại-được | architect REFINE (bỏ hash, theo pattern invite_code) · critic HOLD | 🔶 OPEN_FOR_CUONG |
| D2 | PIN control QT: wizard vs post-create view | critic **CONCEDE** (`QuickTableSetup.tsx:142` — table.id có thật, row pre-created upstream) | ✅ RESOLVED: đặt trong setup wizard được, thêm điểm rotate trên QuickTableView |
| D3 | Dialog-trên-view vs route /referee/join | architect REFINE (share-link vào v1) · critic REFINE (chi phí route ≈ 0 — `_middleware.ts:82,388-399` — nhưng hạ blocker→nên-sửa) | 🔶 OPEN_FOR_CUONG |
| D4 | Defer auto-expiry DE/Flex? | architect **CONCEDE** (`DoublesEliminationBracket.tsx:1067` + `MyRefereeTournaments.tsx:19-24` — 'harm low' của mình sai) · pre-mortem REFINE (`auto-archive-tournaments/index.ts:44-66` — completed ĐÃ được cron ghi cho DE/Flex → guard = 1 dòng cho cả 4) | ✅ RESOLVED: expiry trong v1 cho cả 4 format |

**Bất đồng bị giết ở vòng 2 (ảo):** D2 — critic chưa thấy row pre-created; D4 — architect chưa thấy cron auto-archive + tưởng nhầm match-level setter là tournament-level. Vòng 2 làm đúng việc: hai phát hiện mới (QT có id sẵn; completed có sẵn cho cả 4) làm thiết kế RẺ hơn và AN TOÀN hơn cùng lúc.

**Bất đồng sống sót (thật):** D1, D3 — cùng dữ kiện, khác khẩu vị đánh đổi. Lên mục 0.

**Nhượng bộ bị LOẠI:** không có.

---

## 8. Kế hoạch verify

**Tự động:**
- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>` · `npx tsc -b --noEmit` · `npm run test` · `npm run build` + bundle gate · `npm run e2e:smoke`
- [ ] pgTAP: redeem đúng/sai/hết-hạn/rate-limit + control probe 42501 anon trên `referee_pins`
- [ ] curl anon: `select('*')` và `select('pin')` trên `referee_pins` → không trả secret
- [ ] grep migration không ALTER 4 bảng cha

**Cuong phải tự làm:**
- [ ] Điện thoại thật tại điều kiện sân: nhập PIN từ link Zalo/FB (FB in-app browser), cả luồng chưa-login
- [ ] Duyệt RED trước khi `/ship` (migration + RPC cấp quyền)

---

## 9. Sau khi ship

- PR: #441 · Ngày build: 2026-07-22 · Trạng thái: **CI xanh (quality+pgtap PASS), chờ Cuong Approve RED + merge**
- Migration `20260722110000_referee_pins.sql` ĐÃ áp prod (anon probe 42501 verify; per-user + per-tournament rate-limit live).
- Phương án chốt (em tự chọn theo khuyến nghị panel): D1 = PIN đọc-lại-được (bảng khóa kín + reveal RPC creator-only); D3 = dialog-trên-view (không route /referee/join riêng — share URL trang giải sẵn có).
- Khác kế hoạch: thêm **budget rate-limit thứ 2 theo (format,parent_id)** ngoài per-user (qa-verifier chỉ ra multi-account grind) — cap 20 lần sai/15p/giải, chặn spray bất kể số tài khoản.
- Học được → lessons-learned.md: coverage gate (component .tsx mới không test → tụt global < 83%); component test mock cả module → không phủ chính module đó; project KHÔNG có jest-dom (dùng `.textContent`/`toHaveProperty`); dialog.tsx đọc `t.common.close` nên mock i18n phải có `common`.
- CHƯA chứng minh: luồng redeem PIN thật (cần 2 user login + giải chạy + organizer bật PIN) + redirect trong FB/Zalo in-app browser — Cuong test tay.
