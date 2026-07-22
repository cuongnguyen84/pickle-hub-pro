# risk-auditor — referee-pin (vòng 1, nguyên văn)

Đã xác minh xong toàn bộ. Prompt + reply GPT-5.6 lưu tại `docs/proposals/referee-pin/external/risk-auditor-gpt56.md`.

---

## Verdict: 🔴 RED
Một người lạ đăng nhập đoán/đọc được PIN 4-6 ký tự → tự ghi mình vào bảng `*_referees` → dùng đúng RLS score-update sẵn có để sửa tỉ số một giải **đang chạy**, và ở Doubles/Flex làm sai propagation nhánh = **mất slot bracket = sự cố SLO 4**, không phải rate.

Classifier said: RED (`node scripts/agents/risk-tier.mjs` → "DB migration — schema/RLS change, not reversible by a git revert"). **Em GIỮ RED**, không nâng, nhưng làm rõ lý do sâu hơn classifier: đây không chỉ là "có migration" — đây là cấp **năng lực ghi điểm cho người lạ**, và hai cách làm sai đều gây hư hại **không revert được** (rò PIN cho anon, hoặc 42501 giết app native đã cài).

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | PIN đặt làm cột trên bảng cha (`doubles_elimination_tournaments`…) có SELECT policy `USING(true)` → anon `select('referee_pin')` đọc PIN mọi giải. Lặp y nguyên leak `invite_code` #430 (`20260722000000`). | Không thấy gì cho tới khi tỉ số bị sửa; đúng lỗ đã vá 2 tháng trước, mở lại | **KHÔNG** đặt PIN lên 4 bảng cha. Bảng riêng `tournament_referee_pins` (format, tournament_id, pin_hash, enabled), **không GRANT SELECT cho anon/authenticated** — chỉ RPC SECURITY DEFINER đọc |
| 2 | **Cao** | Nếu để cứu #1 mà làm column-REVOKE PIN trên `doubles_elimination_tournaments`: native binary đã cài chạy `select("*")` (`apple/.../DoublesElimRepository.swift:79`). Postgres đòi SELECT trên MỌI cột `*` expand → **42501 chết cả query** | Mọi iPhone đã cài **không load được** giải Doubles Elimination; **không có đường vá** (không ép update app) | Bảng PIN riêng né hoàn toàn — không đụng cột nào native `select("*")`. Nếu bắt buộc đụng bảng cha: expand-then-contract + `grep -rn apple/` trước |
| 3 | **Cao** | Redeem-PIN không rate-limit: PIN 4 số = 10.000 tổ hợp, `tournament_id` công khai enumerable → 1 account brute-force trong vài giây thành trọng tài | Tỉ số/nhà vô địch sai; operator thấy "referee write hợp lệ", RLS không phân biệt PIN-đoán với thêm-tay | Mirror pattern `phone-otp-send` (`RATE_MAX_PER_WINDOW=3`/15p/identity + `IP_RATE_MAX=5`). Thêm budget **toàn cục** để chặn spray `1234` lên mọi giải. Generate PIN ngẫu nhiên, cấm `1234`/`0000` |
| 4 | **Cao** | Self-INSERT sai tầng: nếu mở RLS INSERT "authenticated tự thêm mình" thì RLS `WITH CHECK` không thể so PIN với verifier ẩn (client không đọc được) → hoặc lỏng hoàn toàn hoặc phải lộ PIN | Người lạ INSERT thẳng vào `*_referees` không cần PIN đúng | Chỉ qua **RPC SECURITY DEFINER transactional**: check enabled → check completion → rate-limit → verify PIN → INSERT `auth.uid()` (KHÔNG nhận `user_id` từ body). `REVOKE EXECUTE ... FROM PUBLIC`. `search_path=public` cố định. Allowlist format, không nội suy tên bảng |
| 5 | **TB** | Race check-rồi-insert nếu redeem qua edge function service_role (verify PIN rồi insert 2 bước): organizer tắt PIN/đóng giải giữa 2 bước → insert vẫn chạy | Trọng tài "chui" vào sau khi đã đóng | Làm nguyên tử trong 1 RPC (lock row enrollment + insert cùng transaction), không verify-rồi-insert rời |
| 6 | **TB** | "Tự hết hạn khi có nhà vô địch" **không định nghĩa được cho Doubles Elim + Flex** — không có enum `completed`, chỉ `status` string tự do; QuickTable/TeamMatch thì có | Giải đã xong nhưng endpoint vẫn nhận trọng tài mới; PIN từng chia sẻ vẫn sửa được điểm sau giải | Cần predicate hoàn tất chuẩn hoá cho cả 4 (ví dụ `final_placement=1` cho Doubles, hoặc thêm cột completion timestamp set cùng transaction crown). **Hỏi Cuong** tín hiệu nào |
| 7 | **Thấp** | 4 bảng `*_referees` **không có cột "nguồn"** (thêm-tay vs PIN). Nếu muốn hết hạn chỉ trọng tài-PIN mà giữ trọng tài-tay | Hết hạn nhầm cả trọng tài thêm tay, hoặc không hết hạn được gì | Thêm cột `source enrollment` nếu cần phân biệt; hoặc chấp nhận expiry = chặn redeem MỚI, không xoá row cũ (làm rõ với Cuong) |

## SLO bị đe doạ
- **SLO 4 (Scoring — zero lost-update incidents):** trọng tài chui sửa điểm vòng sớm Doubles Elim → re-propagate nhánh sai → **mất slot bracket = incident**. Đây là SLO nặng nhất bị đụng.
- **SLO 1/6 (native availability/latency):** không đụng NẾU dùng bảng riêng; RED-42501 ở #2 sẽ giết màn Doubles trên app đã cài nếu làm sai.

## Ngân sách hiệu năng
- Bundle: UI = 1 ô nhập PIN + 1 `<Switch>` (đã có pattern `TeamMatchSettingsDialog.tsx`) trên 4 setup page + 1 màn redeem. Ước **+3–6 KB gz**, tất cả trên **lazy route** (setup/tools), không chạm INITIAL. Total ~1822 → ~1828 / 1970. Đạt.
- INITIAL headroom thật chỉ ~15 KB (265/280) — nhưng feature này không nằm trên initial path nên không liên quan. Vietnam p75: không ảnh hưởng (không render mới trên `/` hay `/feed`).

## SEO
- Routes SSR bị ảnh hưởng: **none**. Referee/PIN nằm sau auth, /tools setup không SSR cho bot, không đụng `functions/_middleware.ts`, `_lib/render/`, sitemap, `BLOG_POST_META`.
- Cần bump `pr:v30`? **Không** — không đổi output SSR.

## Kế hoạch rollback
- Cơ chế: migration (bảng mới + RPC + grants) → **KHÔNG revert bằng `git revert`**. Nếu theo thiết kế sạch (bảng `tournament_referee_pins` MỚI, không ALTER bảng cũ), rollback = `DROP TABLE` + `DROP FUNCTION` + REVOKE — additive nên gỡ tương đối gọn, không mất dữ liệu bảng có sẵn.
- Thời gian khôi phục: web/RPC ~vài phút (drop function → hết đường redeem). Trọng tài chui đã tạo phải xoá row + **audit lại điểm đã sửa** (cần cột audit UID+timestamp trên score writes).
- **Không revert được:** (a) nếu lỡ đặt cột PIN lên bảng cha + REVOKE → app native đã cài 42501 vĩnh viễn; (b) nếu ship parity native PIN redeem → binary đã submit không lùi được. **Đó là cái làm nó RED thật.**

## Phải verify trước khi merge
- [ ] Migration **không** thêm cột nào lên `quick_tables`/`doubles_elimination_tournaments`/`flex_tournaments`/`team_matches`; PIN sống ở bảng riêng không anon-SELECT. Xác nhận: `grep -rn "ALTER TABLE.*\(quick_tables\|doubles_elimination_tournaments\|flex_tournaments\|team_matches\)" <migration>` → rỗng.
- [ ] RPC redeem: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC, anon;` có mặt; body INSERT `auth.uid()` chứ không phải tham số `user_id`.
- [ ] Rate-limit tồn tại (đếm server-side, không tin IP header client) — test: 4 lần đoán sai/15p bị chặn.
- [ ] Test curl thực nghiệm: `select('*')` và `select('pin_hash')` với anon key trên bảng PIN → **42501/0 rows**, KHÔNG trả hash.
- [ ] Xác nhận `is_<format>_referee` chỉ mở UPDATE score, không mở participants/settings (đã đúng hôm nay — giữ nguyên, không nới).
- [ ] Predicate "completed" cho Doubles/Flex được Cuong chốt trước khi build expiry.

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo (đều đúng):** (1) đường score-corruption qua self-enroll — khớp recon + gate `is_<format>_referee`; (2) không được đặt PIN lên bảng cha public, cột không ẩn được dưới RLS — khớp lesson #430 + `doubles_elimination_tournaments` `USING(true)`; (3) native `select("*")` trên `doubles_elimination_tournaments` là **xác định, không giả định** — verify trực tiếp `DoublesElimRepository.swift:79`; (4) auto-expire không định nghĩa cho Doubles/Flex; (5) race verify-rồi-insert của edge function service_role; (6) SECURITY DEFINER phải revoke EXECUTE khỏi PUBLIC + không nhận `user_id` từ body; (7) 4 bảng `*_referees` không có cột nguồn — kiểm shape `{id,fk,user_id,created_at}`, đúng.
- **Bác bỏ:** Không có claim nào phải bác. GPT-5.6 không nhìn được repo nhưng mọi cơ chế nó nêu đều trùng dữ kiện xác minh độc lập. Phần "Required safe design" của nó lấn sang địa hạt solution-architect — không tính là finding rủi ro. Riêng câu hỏi "expiry đóng enrollment hay thu hồi cả quyền chấm" là **clarification cho Cuong**.

Panel chạy đủ 2 model (GPT-5.6 OK, không one-model-down).
