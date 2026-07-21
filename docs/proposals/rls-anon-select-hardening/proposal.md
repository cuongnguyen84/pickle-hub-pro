# Siết anon SELECT trên team_match_teams — khóa cột invite_code

> Slug: `rls-anon-select-hardening` · Ngày: `2026-07-21` · Trạng thái: `shipped`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail**: `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 (+ `.meta.json`) · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D2 | Cửa sổ giữa "áp REVOKE" (Management API, tức thì) và "web mới live" (Cloudflare ~3-5 phút): nghiêm trọng hay mỹ phẩm? | `pre-mortem` + `risk-auditor`(r2): bundle CŨ `select('*')` → 42501 → **bảng đấu live trắng** cả cửa sổ. Thứ tự áp là BẮT BUỘC. | `solution-architect`: PostgREST degrade êm → cửa sổ chỉ là lỗi mỹ phẩm; thứ tự chỉ là vệ sinh. | Nếu tin architect mà pre-mortem đúng: áp REVOKE lúc đang build → mọi trang team-match trắng 3-5 phút, kể cả giải đang đá live. |

**Khuyến nghị của orchestrator:** không cần chọn phe về cơ chế — cứ **duyệt runbook có thứ tự** (deploy web trước, xác nhận live, RỒI áp REVOKE). An toàn dưới CẢ HAI cách đọc, chi phí = 0 (chỉ là thứ tự thao tác). Crux factual sẽ được verify bằng curl ngay sau khi áp (mục 8). Lưu ý minh bạch: risk-auditor vòng 1 nói "degrade êm", vòng 2 tự sửa thành "42501" — kết luận cuối của nó dựa trên cơ chế đã sửa.

**Điều thứ hai cần anh gật (không phải bất đồng, là thẩm quyền):** verdict RED → pipeline không auto-merge. Đọc mục 2 rồi trả lời "duyệt /ship" hay không.

---

## 1. Ý tưởng gốc

Siết RLS anon SELECT trên `team_match_teams` — anon key query `select=*` trả về cả `invite_code`, `captain_user_id`, `payment_status` (verify sống trên prod phiên 2026-07-21b). Người lạ có thể lấy `invite_code` → join team. Giới hạn cột cho anon/non-member, giữ đọc đầy đủ cho captain/thành viên/organizer, không phá web + native. Rà bảng chị em.

**Làm rõ ở bước 0:** không hỏi — fix defect bảo mật đã xác nhận; mọi ràng buộc đọc được từ repo (xem `00-intake.md`).

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED (phần migration) — client PR là AMBER |
| **Khuyến nghị** | Option B′ — REVOKE **chỉ cột `invite_code`**, xóa nút copy-code dead-end, KHÔNG xây RPC |
| **Công sức** | ~2 nửa ngày (1 người) — native **0 file** |
| **Rủi ro lớn nhất** | Áp REVOKE trước khi web mới live → bảng đấu trắng 3-5 phút (D2, tránh được bằng thứ tự áp) |
| **Auto-merge** | **Chặn — cần Cuong duyệt** (risk-tier.mjs: mọi migration = RED tất định) |

🔴 RED nghĩa là: migration áp prod **không lùi được bằng `git revert`** — muốn lùi phải chạy migration ngược (`GRANT SELECT(invite_code)` lại, 1 dòng, vài giây).

**Vì sao KHÔNG revoke cả 3 cột như intake:** đồng thuận cross-vendor mạnh nhất của panel (GPT-5.6 ×2 độc lập + 4 agent Claude): native binary đã cài hardcode `payment_status` trong query list công khai (`TeamMatchRepository.swift:44`) và filter `.eq("captain_user_id",…)` (`:407`). Postgres đòi SELECT-privilege trên **mọi cột được nêu tên, kể cả trong WHERE** → revoke 2 cột đó = trắng màn team-match cho mọi iPhone đã cài, không có đường vá (user không update app). `captain_user_id` là UUID trần (PII đã khóa ở profiles-lockdown), `payment_status` là trạng thái thô — mức hại thấp, không đáng đổi. `invite_code` là cột duy nhất vừa là secret thật vừa có **0 consumer sống**.

---

## 3. Đã có sẵn gì (recon)

**Prior art:** `supabase/migrations/20260706120000_profiles_pii_column_lockdown.sql` — template y hệt cho lớp fix này (REVOKE + GRANT-loop cột). Mã mời QuickTable đã ở bảng riêng được guard đúng (`quick_table_partner_invitations`).

**Leak gốc:** policy `"Teams are publicly viewable" USING (true)` (`20260107133349…sql:278-281`) + GRANT table-level blanket (`20260513000000…sql:45`) + hook `select('*')` (`useTeamMatchTeams.ts:62,83,602`).

**Dead code liên quan:** `useTeamByInviteCode` (`useTeamMatchTeams.ts:614`) — reader duy nhất của `invite_code`, 0 caller. Route `/join/:code` đọc bảng QuickTable khác. Nút "Copy invite code" (`TeamRosterManager.tsx:358-366`) copy ra một mã **không flow nào tiêu thụ** — lời hứa gãy có sẵn từ trước.

**Bảng chị em — kết luận rà soát (không hành động đợt này):**
- `team_match_roster`: chỉ lộ `user_id` UUID, cần cho filter membership → để nguyên.
- `team_match_games`: `referee_live_state`/`dupr_*` semi-internal, không phải credential; native có thể nêu tên cột → defer, đừng đụng khi chưa grep native đủ.
- `quick_table_registrations` / `quick_table_teams`: đã scoped `is_public OR creator` từ trước, không có invite_code trong bảng → không hành động.

**Ràng buộc repo:** RLS là row-level, không giấu được cột — REVOKE+GRANT là cơ chế duy nhất. service_role bypass column privileges → edge functions (`invite-team-to-tournament`) không ảnh hưởng. pgTAP hiện **0 coverage** cho cả 5 bảng.

---

## 4. Phương án (solution-architect)

### Option A — Full lockdown 3 cột (trung thành intake)
Effort: ~5 nửa ngày · 3 RPC + sửa cả native. **Loại**: đụng đúng 2 cột native hardcode → sự cố không vá được (mục 2); chi phí bảo trì 2 codebase cho mức hại thấp.

### Option B′ — Chỉ khóa `invite_code`, xóa nút dead-end ⭐ (B của architect + kết quả D1)
Effort: ~2 nửa ngày · Files: 1 migration mới, `useTeamMatchTeams.ts`, `TeamRosterManager.tsx`, `TeamDetailSheet.tsx`, `rls_auth_matrix.test.sql` (+2 guard nhỏ, xem increments) · Native: **0 file**

Cách hoạt động:
- Migration: `REVOKE SELECT ON team_match_teams FROM anon, authenticated` + `GRANT SELECT (mọi cột TRỪ invite_code)` (loop theo template profiles-lockdown). `payment_status`, `captain_user_id` **vẫn granted** → native + MyTournaments + useUserTeam chạy nguyên.
- Client: narrow cả 3 chỗ `select('*')` (`:62, :83, :602`) → danh sách cột tường minh; **xóa** nút copy invite-code + prop + toast (D1: cả architect lẫn risk-auditor CONCEDE — mã là ngõ cụt, đường mời sống duy nhất là InviteTeamDialog qua email/edge-fn, 0 code mới).
- KHÔNG xây RPC nào (kết quả D1 — bớt so với Option B gốc).

Được: đóng đúng lỗ đã verify sống ở tầng server; anon craft `select=invite_code` → permission denied. Mất: `payment_status`/`captain_user_id` vẫn đọc được (đã lý giải mức hại thấp). Đóng cửa gì: không — muốn siết thêm sau này thì Option A là bước cộng thêm, điều kiện là bản native mới phủ đủ user.

### Option C — Tách invite_code sang bảng riêng
Effort: ~4.5 nửa ngày · DROP column + sửa creation flow web/native. **Loại**: YAGNI cho feature join-by-code đang chết.

### Khuyến nghị
**Option B′.** A trả gấp đôi công + toàn bộ rủi ro native cho 2 cột hại thấp; C nặng nhất cho feature chết. B′ còn rẻ hơn B gốc (bỏ RPC).

### Increments
1. **PR duy nhất (AMBER phần code):** narrow 3 select + xóa nút/prop/toast + migration file + pgTAP + 2 guard rẻ từ pre-mortem/ui-ux: (a) `MyTournaments` disable nút Xóa khi impact query lỗi (chặn "xóa mù"), (b) `TeamMatchView` đọc `isError` → inline card "Không tải được danh sách đội." + nút Thử lại (lỗi ≠ rỗng). Verify: CI xanh + preview.
2. **Áp migration theo thứ tự (RED — sau khi Cuong duyệt):** merge → Cloudflare deploy xong → xác nhận bundle mới live → áp migration qua Management API **kèm ghi row `schema_migrations`** (nợ #427 đang drift — reconcile cùng lúc). Verify: curl anon `?select=invite_code` → 42501/403; `?select=id,team_name,status` → 200; badge #429 còn sống.
3. **Rotate invite_code hiện có (tùy chọn, khuyến nghị làm):** mã đã lộ trước khi vá không tự vô hiệu — `UPDATE team_match_teams SET invite_code = encode(gen_random_bytes(6),'hex')`. An toàn tuyệt đối vì 0 consumer sống. + Rà roster xem có thành viên lạ đã join bằng mã lộ.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

**Đánh giá tổng thể:** với scope B′, mặt UX co lại còn 2 việc: xóa nút dead-end và thêm error-state thật. 4 blocker vòng 1 của critic (public list, native list, organizer payment, captain banner) đều gắn với kịch bản revoke `payment_status`/`captain_user_id` — **tự tan** khi scope thu về invite_code.

**Vấn đề còn áp dụng:**

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Narrow client phải đi **cùng PR** với migration (quên = nút copy hiện `undefined` trong cửa sổ deploy) | Increment 1 gói chung |
| 2 | Nên sửa | `TeamMatchView` nuốt lỗi — query fail hiển thị y hệt "chưa có đội" | Inline error card + "Thử lại", `role="status"`, không toast |
| 3 | Nên sửa | Nút copy invite-code là lời hứa gãy sẵn | Xóa (đã chốt D1); người dùng mời đội qua InviteTeamDialog (email) sẵn có |

**Copy VI/EN:** Error list: `Không tải được danh sách đội.` / `Couldn't load the team list.` + `Thử lại` / `Try again`. Empty thật: `Chưa có đội nào đăng ký.` / `No teams have registered yet.` (chỉ sau response 200). Nút Thử lại ≥44px, contrast AA (bài học `.tl-filter .count`).

**Panel đa model:** Claude + GPT-5.6 đồng thuận: xóa nút thay vì nuôi bằng RPC; degrade per-section; lỗi permission không bao giờ render thành empty-state. Bất đồng nội bộ: critic tự sửa ở vòng 2 — thay thế cho nút copy KHÔNG phải "Copy link ở header" (không tồn tại trong TeamDetailSheet) mà là dialog mời email sẵn có.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (migration) · client PR AMBER
Classifier nói: RED (mọi file `supabase/migrations/` — tất định). Auditor giữ RED sau khi scope thu hẹp, vì: (1) Management API bypass toàn bộ deploy-gate, không git-revert được; (2) cửa sổ web-CŨ × schema-MỚI (D2). Không phải RED mất-dữ-liệu — reverse migration là 1 dòng GRANT, khôi phục vài giây.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao→**0** | Native đọc `payment_status`/`captain_user_id` | (đã loại khỏi scope — không revoke 2 cột này) | Checklist merge: grep migration KHÔNG đụng 2 cột |
| 2 | TB | Áp REVOKE khi bundle cũ còn live → `select('*')` 42501 → trang team trắng 3-5 phút | Bảng đấu live trắng giữa trận | Thứ tự áp (increment 2); crux D2 verify bằng curl |
| 3 | Thấp | Badge #429 chết nếu grant-list thiếu `tournament_id`/`status` | Badge biến mất | Grant re-list = mọi cột trừ invite_code |
| 4 | Thấp | Ledger drift #427 làm deploy-guard đỏ tiếp | CI đỏ giả | Ghi row `schema_migrations` cho cả migration này LẪN 20260721040000 (reconcile nợ cũ) |

**SLO:** không làm = leak sống tiếp (người lạ join đội bằng mã + PII). Làm đúng thứ tự = 0 downtime dự kiến.
**Perf:** bundle +0 KB (thuần xóa code + narrow select). **SEO:** không đụng SSR, không bump `pr:v30`.

### Rollback
- Migration ngược: `GRANT SELECT(invite_code) ON team_match_teams TO anon, authenticated;` — vài giây, khôi phục cả leak.
- Client: `git revert` bình thường (AMBER).
- **Không revert được:** mã mời đã bị scrape trước khi vá → increment 3 (rotate) xử lý.

### Phản biện độc lập (GPT-5.6)
- Xác minh đúng: cột nêu tên trong WHERE cũng cần SELECT-privilege; revoke 2 cột native = không thể; phải rotate mã đã lộ; expand-then-contract.
- Bác bỏ: cảnh báo "phá luồng invite QuickTable" — sai, mã QuickTable ở bảng riêng ngoài scope (đã verify `QuickTableRepository.swift:110-115`); thành lằn ranh "đừng mở rộng scope sang partner_invitations".

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). Đồng thuận không phải mục tiêu.
> Cưỡng chế bởi `debate-ledger.mjs` (--strict: exit 0, không vi phạm).

## Bảng bất đồng — rls-anon-select-hardening

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Nút 'Copy invite code': giữ qua RPC hay xóa? | **architect**: GIỮ qua RPC · **risk-auditor**: GIỮ qua RPC (rủi ro #3) · **ui-ux-critic**: XÓA — mã là ngõ cụt | **architect**: CONCEDE (`useTeamMatchTeams.ts:615`) · **risk-auditor**: CONCEDE (`JoinTeam.tsx:28-30`) · **ui-ux-critic**: HOLD | ✅ RESOLVED_EVIDENCE | XÓA nút + prop + toast, KHÔNG xây RPC. Đường mời sống = InviteTeamDialog (email). |
| D2 | Thứ tự áp REVOKE vs deploy web — cửa sổ nghiêm trọng hay mỹ phẩm? | **architect**: mỹ phẩm (tin degrade-êm) · **ui-ux**: theo risk-auditor · **risk-auditor**: thứ tự BẮT BUỘC (r2 tự sửa cơ chế: 42501) · **pre-mortem**: HOLD, bảng trắng thật | REFINE ×3 · **pre-mortem**: HOLD | 🔶 OPEN_FOR_CUONG | **cần anh quyết** (mục 0 — khuyến nghị duyệt runbook có thứ tự, an toàn dưới cả 2 cách đọc) |
| D3 | Tier cho scope hẹp: RED hay thấp hơn? | **architect**: YELLOW · **risk-auditor**: RED | **architect**: CONCEDE (`risk-tier.mjs:33` — YELLOW không tồn tại, migration = RED tất định) · **risk-auditor**: REFINE (RED chỉ trên migration; client = AMBER) | ✅ RESOLVED_EVIDENCE | RED đứng cho migration → cần Cuong duyệt trước /ship. |

### Bất đồng bị giết ở vòng 2 (ảo)
- **D1**: architect + risk-auditor cùng CONCEDE sau khi tự mở `useTeamMatchTeams.ts:615` (0 caller) và `JoinTeam.tsx:28` (bảng khác) — cả hai vòng 1 chưa grep caller của invite_code.
- **D3**: architect CONCEDE sau khi mở `risk-tier.mjs:33` — "YELLOW" thậm chí không phải output hợp lệ của classifier.

### Bất đồng sống sót (thật)
- **D2** — cơ chế PostgREST `select('*')` sau REVOKE 1 cột. Pre-mortem HOLD với evidence code client (`throw error`, không nhánh degrade) + lập luận schema-cache role-agnostic; architect giữ cách đọc degrade-êm (mỉa mai: dựa trên risk#3 vòng 1 của chính risk-auditor, thứ risk-auditor đã rút lại ở vòng 2). Chứng minh được bằng: 1 lệnh curl sau khi áp (hoặc thử trên local db trước). Runbook đề xuất an toàn dưới cả hai cách đọc.

### Nhượng bộ bị LOẠI
Không có — ledger --strict exit 0. Mọi CONCEDE đều kèm file:line đã tự kiểm chứng.

**Ghi chú trung thực của orchestrator:** (1) risk-auditor và pre-mortem đồng ý với nhau về D2 — cả hai là Claude cùng phe "tìm cái hỏng", sự đồng thuận đó KHÔNG tự nó là bằng chứng; nhưng riêng D2, pre-mortem có evidence code độc lập (client `throw`, không có nhánh degrade) nên lập trường đứng bằng dữ kiện, không bằng số phiếu. (2) Đồng thuận có nghĩa nhất của panel là scope-hẹp-invite_code — GPT-5.6 (vendor khác, 2 phiên độc lập) và Claude tới cùng kết luận.

---

## 8. Kế hoạch verify

**Tự động (PR):**
- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>` · `npx tsc -b --noEmit`
- [ ] `npm run test` (coverage scope: narrow trong hook — nhớ bẫy coverage-scope phiên trước; helper thuần nếu cần tách)
- [ ] `npm run build` + `check-bundle-size.mjs` (kỳ vọng −, không +)
- [ ] pgTAP: `has_column_privilege('anon','team_match_teams','invite_code','SELECT') = false` (cả `authenticated`); cột an toàn = true; chạy trong `pgtap.yml`
- [ ] `npm run e2e:smoke` + preview: `/tools/team-match/<id>` render list bình thường

**Sau khi áp migration (thứ tự: web live TRƯỚC):**
- [ ] curl anon `?select=invite_code` → permission denied · `?select=id,team_name,status` → 200
- [ ] curl anon `?select=*` → ghi lại hành vi thật (chốt crux D2 cho lần REVOKE sau)
- [ ] Badge #429 trên `/tournaments` còn hiển thị (query `tournament_id`+`status` sống)
- [ ] `deploy-guard.yml` xanh (ledger đã reconcile cả #427)

**Cuong phải tự làm:**
- [ ] Duyệt RED (mục 0) trước khi /ship áp migration
- [ ] Test tay 1 vòng trên iPhone thật: mở giải team-match, list đội + payment section bình thường (native không đổi code nhưng xác nhận cho chắc)
- [ ] Quyết increment 3 (rotate mã đã lộ) — khuyến nghị: có

---

## 9. Sau khi ship

- SHA: `c2c4010d` · PR: #430 · Ngày: 2026-07-21
- Migration `20260722000000` áp prod qua Management API SAU khi web live (đúng runbook D2); ledger ghi cả `20260722000000` + `20260721040000` (reconcile drift #427).
- Verify post-migration: anon `?select=invite_code` → 42501 ✅ · `?select=id,team_name,status` → 200 ✅ · badge #429 query → 200 ✅ · narrow full list → 200 ✅.
- **Crux D2 chốt bằng thực nghiệm: anon `?select=*` → 42501 (chết cả query, KHÔNG degrade êm).** Pre-mortem đúng, claim "PostgREST expand `*` thành tập cột được phép" của risk-auditor vòng 1 (và architect vòng 2 dựa theo) SAI. Nếu áp REVOKE trước khi web live, mọi bundle cũ đã trắng trang team-match.
- Increment 3 đã chạy: rotate 19 `invite_code` (mã lộ trước đó hết hiệu lực).
- Khác kế hoạch: (1) phát hiện thêm lúc code — 3 chỗ INSERT `.select()` không tham số (= RETURNING \*) cũng phải narrow, panel không bắt được; (2) error-card đặt ở `TeamList.tsx` thay vì `TeamMatchView.tsx` (đúng chỗ chức năng); (3) guard MyTournaments chỉ disable khi `loadingImpact` — nhánh lỗi giữ fail-soft có cảnh báo chữ (quyết định có chủ đích sẵn trong code, không phá); (4) release-pilot từ chối merge RED theo luật cổng → orchestrator merge trên kênh user thật (đúng thiết kế bot-identity 2026-07-20).
- Học được: xem `.claude/memory/lessons-learned.md` mục 2026-07-21 (RETURNING \* + select=\* 42501).
