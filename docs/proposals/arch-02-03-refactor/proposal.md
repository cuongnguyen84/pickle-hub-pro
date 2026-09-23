# ARCH-02/03 — Refactor Social Event payment layers · hoãn Team Match

> Slug: `arch-02-03-refactor` · Ngày: `2026-07-17` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: xem `external/*.meta.json`.
> Model thiếu key: `none`
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D1 | Trình tự ARCH-02 — hai agent đã REFINE hội tụ, cần anh gật thứ tự cuối: increment 1 (cancel/reactivate → handler.ts, backend-only) đi TRƯỚC lưới test, rồi characterization test là gate cứng trước increment 2 (chạm RegistrationModal) | `architect`: increment 1 trước, gate test trước increment 2 | `ui-ux-critic`: đồng ý sau khi thu hẹp — blocker chỉ áp từ lát chạm UI; điều kiện: vitest increment 1 pin đúng error-code | Bỏ gate → regress vô hình trên money path; ngược lại, bắt test cả increment 1 chỉ tốn thêm ~0 (nó vốn có vitest theo mẫu QA-08) |
| — | **2 nhánh treo** `feat/team-match-event-discounts` (401 dòng) + `feat/mlp-captain-registration` (158 dòng, stale 07-09) đè đúng vùng ARCH-03: merge/đóng chúng trước khi ARCH-03 khởi động — anh muốn xử lý 2 nhánh này thế nào? | panel đồng thuận: sequencing thuộc về anh | | Refactor trước = anh rebase 2 lần + rủi ro "regression ma" (pre-mortem #3: resolve conflict sai làm sống lại cách đếm discount cũ → sai lệ phí VietQR âm thầm) |

---

## 1. Ý tưởng gốc

Cụm 4/4 chuỗi "tiếp tục các tác vụ cải tiến": ARCH-02 + ARCH-03 (roadmap:200-201, mỗi cái 5d, dep ARCH-01 done #334). Câu hỏi mở đưa vào panel: làm cả hai hay một, cái nào trước, scope thật còn lại của ARCH-03 sau khi ARCH-04 ship.

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟡 AMBER (layering PRs) + 🔴 RED cho 1 lát: migration DB-01c (bug overbooking phát hiện trong audit) |
| **Khuyến nghị** | Option A — **ARCH-02 full bây giờ, HOÃN ARCH-03**; DB-01c vá riêng prod-first trước tiên |
| **Công sức** | ARCH-02: ~8-10 nửa ngày (gồm characterization tests) · DB-01c: ~30 phút · ARCH-03: defer |
| **Rủi ro lớn nhất** | Regress vô hình trên money path khi kéo 7 supabase call khỏi RegistrationModal (rpc trả `{data,error}` không throw — quên 1 `if(error)` = paid-but-unregistered) |
| **Auto-merge** | Layering PRs: được sau gate + characterization xanh · DB-01c: migration — theo standing authorization áp prod qua Management API, nhưng ghi nhận RED trong record |

---

## 3. Đã có sẵn gì (recon)

- **ARCH-01 rules** (docs/architecture-boundaries.md): `pages → components → hooks → lib`; money/state logic phải ở `handler.ts` Deno-free có test. KHÔNG có lint enforce — doc nói thêm `eslint-plugin-boundaries` "not before ARCH-02/03".
- **ARCH-02 surface (~8.7k dòng, 113 commit từ 04/2026):** tim là `RegistrationModal.tsx` 1.398 dòng với 7 supabase call inline (rpc :231/:593/:1314, functions.invoke :376/:473/:518/:652) — vi phạm rule #3; hooks `useRegistration`/`useEventRegistrations` đã sạch. **QA-08 (#328) là template đúng sẵn có** (create-payment-order + mark-payment-claimed đã tách handler.ts + vitest). `cancel-registration`/`reactivate-registration` còn monolithic.
- **ARCH-03 surface (46 commit):** ARCH-04 đã ăn phần đắt nhất (engine, live-state, spectator, contention). Còn: `TeamMatchView.tsx` 1.025 dòng (nhưng 0 supabase call — đã sạch rule #3), `TeamMatchSetup.tsx` 1.348 dòng, họ hook `useTeamMatch*` 3.150 dòng/7 file, `useTeamMatchRealtime.ts` kênh riêng. DB-02 thực tế không đụng TeamMatch dù roadmap ghi dependency.
- **0 test** cho RegistrationModal/TeamMatchView/Setup/hooks. 2 nhánh feature treo đè vùng ARCH-03 (mục 0).

---

## 4. Phương án (solution-architect)

### Option A — ARCH-02 full bây giờ, hoãn ARCH-03 ⭐

Effort: 8-10 nửa ngày · Data: none trong layering (DB-01c là migration riêng, xem mục 6)

Lý do hoãn ARCH-03: (1) ARCH-04 vừa ăn phần realtime đắt nhất — làm full ARCH-03 giờ là trả tiền cho việc đã xong; (2) 2 nhánh treo đè đúng vùng refactor; (3) TeamMatchView đã sạch rule #3 — phần "vi phạm" thật nằm ở ARCH-02.

**Increments (đã điều chỉnh sau vòng 2):**

0. **DB-01c trước tiên** (từ D2): migration thêm `pg_advisory_xact_lock` vào `register_event_as_member` theo mẫu DB-01 + member case vào `db-race.mjs`. Prod-first, ~30 phút, PR riêng.
1. `cancel-registration`/`reactivate-registration` → `handler.ts` + vitest pin error-code (caller duy nhất `PlayerRegistration.tsx:155-186` chỉ đọc status + `code` — contract-only, 0 rủi ro UI).
2. **GATE:** characterization tests cho RegistrationModal money path (mẫu ARCH-04) — land và xanh TRƯỚC khi đụng component.
3. Kéo 7 call inline khỏi RegistrationModal về hook (giữ nguyên `{data,error}` handling — từng call một, test parity chạy sau mỗi lần).
4. Capacity math → `src/lib` + unit test. STOP-AND-LOOK.
5. i18n hoá 4 chuỗi VI cứng + badge "Full" trong RegistrationModal (đợt copy riêng, byte-for-byte).
6. Chẻ page SocialEvent* chỉ khi có feature thật đụng tới (YAGNI).

`eslint-plugin-boundaries`: KHÔNG thêm đợt này (điều kiện doc là "sau ARCH-02/03", ARCH-03 hoãn; plugin config-nặng cho 1 domain).

### Option B — Bản rẻ (7 nửa ngày): chỉ increment 0-3, dừng trước capacity/i18n

Fallback nếu quỹ thời gian < 4 ngày.

### Option C — Làm cả ARCH-02 + ARCH-03 tuần tự

Bác: ép rebase 2 nhánh treo qua vùng refactor (regression ma — pre-mortem #3), chạm publication realtime (gotcha câm-kênh), và phần lớn giá trị ARCH-03 đã được ARCH-04 giao.

### ARCH-03 khi nào quay lại

Sau khi 2 nhánh treo merge/đóng + có feature thật đụng TeamMatchSetup. Scope lúc đó thu gọn: chuẩn hoá họ hook `useTeamMatch*` + đưa lệ phí team match về server truth (hiện dựng client-side — pre-mortem #3 chỉ ra không có gì đối soát).

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

Refactor "không đổi hành vi" trên đúng 2 luồng tiền quan trọng nhất → blocker là regression vô hình, không phải màn xấu.

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | 0 test parity → cam kết không kiểm chứng được | Increment 2 (gate cứng) — thu hẹp vòng 2: chỉ áp từ lát chạm UI |
| 2 | Blocker | ~20 chuỗi copy VI/EN cứng ở TeamMatchSetup Step 5 (màn phí BTC) → tách = drift copy màn tiền | Thuộc ARCH-03 — đã defer cùng nó; khi làm phải i18n hoá byte-for-byte TRƯỚC |
| 3 | Blocker | Reset 13 field + stale-async trong RegistrationModal: sót 1 field → `paymentOrder`/`reference_code` của event trước rò sang event sau | Characterization test phải cover mở modal event A → đóng → mở event B |
| 4 | Nên sửa | 4 chuỗi VI cứng + badge "Full" EN trong RegistrationModal | Increment 5 |
| 5 | Nit | Chip "đã nộp chờ xác nhận" dùng token `--tl-live` sai ngữ nghĩa | Commit UX riêng, không nhét vào refactor |

### Panel đa model

Claude + GPT-5.6 hội tụ độc lập về: 3 rủi ro flow đăng ký, copy-drift Step 5, trình tự test→i18n→tách→test. Bất đồng nhỏ: GPT muốn object TS trung gian làm guard tạm — critic bác (repo đã có `src/i18n/{vi,en}.ts` keyed, object trung gian đẻ chỗ drift lần hai). Hợp lý.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟡 AMBER (cả ARCH-02 lẫn ARCH-03-nếu-làm) + 🔴 RED lát DB-01c

Classifier nói RED khi có file migration trong set · Auditor vòng 1 AMBER cho layering, RED-per-sub-change cho migration — khớp. Ghi chú: memory standing authorization cho phép áp migration prod qua Management API không cần hỏi; RED ở đây nghĩa là "không git-revert được", vẫn cần verify + rollback plan tường minh.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | Cao | **Bug SỐNG (độc lập refactor):** `register_event_as_member` (def mới nhất `20260522190000` L77-106) COUNT→check→INSERT không lock; DB-01 vá sót path này; db-race.mjs không test | 2 member giành slot cuối cùng lúc → overbooking +1 → SLO 4 incident | DB-01c: advisory lock theo mẫu DB-01 + race test. **Increment 0** |
| 2 | Cao | Hook mới quên `if(error) throw` (rpc không throw) | Paid-but-unregistered (SLO 3) — chuyển VietQR xong không có chỗ | Characterization test gate + kéo từng call một |
| 3 | Cao | (Nếu làm ARCH-03) binding bảng ngoài publication → câm cả channel — đúng vết `chat_room_settings` 07/07 | Tỷ số live đứng im giữa giải, silent | Đã hoãn ARCH-03; khi làm: checklist publication trước mọi channel change |
| 4 | TB | Rebase nhánh discount sau refactor → conflict resolve sai sống lại code cũ | Sai lệ phí VietQR âm thầm (không server truth đối soát) | Chốt 2 nhánh treo TRƯỚC (mục 0) |

### SLO / Perf / SEO

SLO 3 (payment) + SLO 4 (capacity) là tâm điểm — cả hai được increment 0+2 bảo vệ. Bundle: layering thuần, kỳ vọng ±0 KB (theo dõi budget như thường). SEO: không đụng route SSR, không bump cache.

### Rollback

- Layering PRs: `git revert` + Pages redeploy ~5 phút.
- Edge functions (cancel/reactivate): revert → deploy-guard redeploy 2 function.
- **DB-01c migration: không git-revert được** — rollback = migration đảo (DROP lock statement, khôi phục def cũ đã lưu trong file down). Viết sẵn down script trước khi áp.

### Phản biện độc lập (GPT-5.6)

Đồng thuận độc lập với auditor: ship 2 PR riêng thay vì gộp (coupling rollback/chẩn đoán); member-race đáng ưu tiên. 1 chi tiết bị hạ: GPT nêu tên bảng ví dụ `team_match_lineups` chưa verify — loại.

### Pre-mortem — 3 sự cố (chi tiết `round1/pre-mortem.md`)

1. Gộp OTP+payment handler làm rớt guard `data.ok` → user thua race vẫn sang bước QR, chuyển tiền vào reference mồ côi. 2. Gộp 4 channel realtime + 1 binding ngoài publication → câm channel giữa giải. 3. **Tệ nhất:** rebase nhánh discount sai → sai lệ phí âm thầm 3 tuần, không exception, không alert — `git revert` không lấy lại tiền thu sai. Khoảng hở lộ ra: money-path team match không có server truth; soak test chạy trên DB local có publication drift nên mù đúng loại bug realtime hay nhất.

---

## 7. Tranh luận trong panel

> 2 bất đồng · 1 giải quyết bằng bằng chứng · 1 còn mở cho Cuong · ✅ Luật đối chất OK (ledger strict exit 0).

| # | Chủ đề | Vòng 2 | Trạng thái | Kết luận |
|---|--------|--------|------------|----------|
| D1 | Extraction trước hay test/i18n trước? | Cả hai REFINE hội tụ: increment 1 backend-only đi trước được (`PlayerRegistration.tsx:155-186` + `cancel-registration/index.ts:8,41-43,109` — hai phía verify độc lập cùng kết luận); characterization gate cứng trước increment 2; i18n gate áp cho lát chạm UI | 🔶 OPEN_FOR_CUONG | Nội dung đã thống nhất — anh gật thứ tự cuối ở mục 0 |
| D2 | Bug overbooking member-path: trong hay ngoài scope? | **architect CONCEDE** (`20260522180000:76-81` + `db-race.mjs:156,182` — vòng 1 giả định sai DB-01 phủ hết) · auditor REFINE (tách DB-01c riêng, không block ARCH-02) | ✅ RESOLVED_EVIDENCE | DB-01c: migration riêng prod-first ~30 phút + race test |

### Bất đồng bị giết ở vòng 2

D2 — architect concede sau khi mở migration thật. Phát hiện giá trị nhất của cả panel này: **bug overbooking sống, không liên quan refactor, được risk-auditor tìm ra khi audit vùng lân cận.**

### Bất đồng sống sót

D1 chỉ còn hình thức (hai phía hội tụ cùng trình tự bằng bằng chứng độc lập — nhưng cả hai là Claude, nên ghi rõ: điểm neo là code caller/handler cụ thể có thể tự kiểm, không phải sự đồng ý của chúng).

### Nhượng bộ bị LOẠI

Không có.

---

## 8. Kế hoạch verify

**Tự động:**

- [ ] DB-01c: down script viết sẵn; áp prod qua Management API; `db-race.mjs` member case 15 rounds sạch; pgTAP xanh
- [ ] Increment 1: vitest handler pin error-code; `supabase functions list` xác nhận chỉ 2 function redeploy
- [ ] Increment 2: characterization tests xanh trên code CŨ trước khi refactor (gồm case mở modal event A → B)
- [ ] Mỗi increment: `npx eslint` · `check-theline` · `tsc -b --noEmit` · `npm run test` · build + bundle (±0 KB) · `e2e:smoke`
- [ ] Post-deploy smoke flow đăng ký social event trên preview

**Cuong phải tự làm:**

- [ ] Chốt D1 (mục 0 — khuyến nghị: gật trình tự như increments)
- [ ] Quyết số phận 2 nhánh treo team-match TRƯỚC khi ARCH-03 quay lại
- [ ] Test tay flow đăng ký + VietQR trên điện thoại thật sau increment 3 (money path — mắt người)

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được:
