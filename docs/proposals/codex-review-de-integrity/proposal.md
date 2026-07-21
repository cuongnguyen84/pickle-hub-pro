# Codex review follow-up — telemetry D5 đo được + 2 residual

> Slug: `codex-review-de-integrity` · Ngày: `2026-07-21` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel: `solution-architect` · `ui-ux-critic` (+GPT-5.6) · `risk-auditor` (+GPT-5.6) · `pre-mortem`.
> Raw: `round1/*.md` · `round2/*.json` · `external/*` · `debate.json`

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Panel | Anh chọn gì |
|---|--------|-------|-------------|
| **D2** | `TeamMatchView.tsx:185` anon **KHÔNG có nút nào** — người vào từ link Facebook gặp ngõ cụt. Thêm CTA "Đăng nhập để đăng ký" (chỉ điều hướng `/login`, KHÔNG phải guest-register)? | critic gọi **Blocker UX**, HOLD. architect: đồng ý đây là fix UX rời rạc, KHÔNG kéo vào gói đo. Không ai chống việc làm nó — chỉ là quyết định rời của anh (làm thì native /apple theo) | ☐ Làm CTA login ☐ Bỏ qua |
| **D3** | P1 residual (1 đội `seed=NULL` khi có race close/cancel hiếm) | **Cả panel + GPT-5.6 hội tụ: BỎ.** Fix 3 dòng KHÔNG đóng được race (close cũng unlocked); vá đúng = migration rộng, downside SLO-3 (`CREATE OR REPLACE` hỏng → mọi đăng ký DE 500) > residual. `organizer_add_team` đã có status guard chặn orphan tuần tự | ☐ Chấp nhận bỏ (khuyến nghị) ☐ Xếp DB release riêng có test |
| **D1** | Progress bar QuickTable: có xây feature count đăng ký thật trên `/tournaments` không? | **Không phải bug** — component dead code, 0 người thấy. Nếu muốn count thật = **feature MỚI** (1 aggregate GROUP BY, query tách kẻo throw sập list, verify GRANT anon) | ☐ Xây feature count ☐ Xoá dead component |

---

## 1. Ý tưởng gốc

Follow-up từ Codex review báo cáo roadmap (session `019f8272`). Codex bắt 6 defect; 2 cơ học đã vá (**PR #427** merged: contract `AUTH_REQUIRED`, UNIQUE `team_match_games`). 3 cái còn lại (P1 lock-gap, P2 QuickTable capacity, P3 telemetry) đưa vào panel.

| Hỏi | Trả lời Cuong |
|---|---|
| P1 organizer vượt cap | **ĐƯỢC** → race organizer-add không phải bug |
| P2 QuickTable cap | **Không cap cứng**, chỉ hiện số thật |
| P3 instrument tới đâu | **Để panel cân** |

---

## 2. Verdict — đọc trước

**🟡 AMBER** (`risk-auditor`; `risk-tier.mjs` scoped 5 file P3-only = AMBER, khớp). **RED chỉ nếu gói kèm migration P1** — mà panel khuyến nghị BỎ P1, nên gói còn lại KHÔNG migration.

> ### Cụm này KHÔNG như intake tưởng — panel lật 2/3 vấn đề
> - **P2 chết**: progress bar là **dead code**, "sửa" = 0 thay đổi người dùng (verify grep: 0 render caller).
> - **P1 nên bỏ**: fix tối thiểu không đóng được race; migration vá đúng rủi ro hơn phần thưởng.
> - **P3 là phần thật**, và panel hội tụ cách vá — nhưng recon lòi ra một blocker **Codex không thấy**: `player_registration` JourneyKind **dùng chung** cho 2 luồng (Social Event + QuickTable). Nếu không tách, funnel 02/08 **trộn 2 luồng**, anh đọc nhầm rồi đóng UX-07 sai.

**Gói khuyến nghị (~2.5–3 nửa ngày, AMBER, 0 migration):**

| # | Việc | Vì sao |
|---|------|--------|
| 1 | **Tách JourneyKind mới** `quicktable_registration` (hoặc `tournament_registration`) cho nhánh giải, rời khỏi `player_registration` của Social Event | Chống trộn funnel + chống collision key sessionStorage. risk-auditor xác nhận `kind` KHÔNG phải GA4 dimension → **0 ảnh hưởng dashboard cũ** |
| 2 | **`startJourneyOnce` / start-if-absent theo tableId** trong `journeys.ts` (không sửa `startJourney` → contract test không vỡ) | Fix re-mint anon→login. Sửa deps caller thôi KHÔNG đủ (OAuth remount vẫn mint lại — `journeys.ts:44`) |
| 3 | **Instrument nhánh Doubles** (mặc định QuickTable — `DoublesRegistrationForm.tsx`, hiện 0 event) | Không có nó, "near-zero wall_view" chỉ nghĩa "near-zero tới nhánh singles", không phải tín hiệu D5 |
| — | **KHÔNG** instrument DoublesElim/TeamMatch (traffic ~0), **KHÔNG** migration P1, **KHÔNG** đụng progress bar dead-code | cắt ~3–4 nửa ngày |

**Ràng buộc pre-mortem bắt buộc mang vào khi code:** sessionStorage chỉ xoá lúc `completeJourney` (`journeys.ts:104`) — tab bỏ dở giữ id stale nhiều ngày. `startJourneyOnce` phải scope theo tableId + có cơ chế hết hạn, nếu không lần đăng ký SAU dùng lại id cũ → trộn/rơi journey.

---

## 3. Đã có sẵn gì (recon)

`round1/idea-recon.md` — **recon sai 1 lần (P2 bar đang hiển thị), đã đính chính** (grep 0 caller). Cùng mô-típ với 2 phiên trước: recon tả một thứ như đang chạy mà không kiểm caller; risk-auditor bắt vì grep trước khi tin.

Cơ chế journey đã kiểm: sessionStorage **SỐNG qua cả 2 đường login** (email/password SPA, OAuth full-reload) → fix re-mint là logic caller, không phải storage.

---

## 4. Phương án (solution-architect)

Chi tiết `round1/solution-architect.md`. P3(a) `startJourneyOnce` idempotent (Option A, không phá contract test); P3(b) tách kind mới (Option A, prop `surface` không cứu collision key → loại); P3(c) chỉ Singles+Doubles (Option A). P2 defer/bỏ. P1 bỏ.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

`round1/ui-ux-critic.md`. Phần telemetry **không có UI để critic**. Hai chỗ chạm người dùng: (1) progress bar — hoá ra dead code (D1); (2) **CTA anon TeamMatch = Blocker** (D2, lên bàn anh). GPT-5.6 bị bác 1 điểm (khuyên bỏ hẳn tỉ lệ X/Y — critic giữ theo ý Cuong "hiện số thật"); GPT dùng `?returnTo=`, critic giữ `?redirect=` đã hardened.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

`round1/risk-auditor.md` + `pre-mortem.md`.

**Cross-vendor thật (GPT-5.6 độc lập, không phải blind-spot Claude):** fix P1 tối thiểu KHÔNG đóng race vì `close_registration` cũng unlocked (`20260529120000:215`, verify). Đây là dữ kiện chốt D3 → BỎ.

**risk-auditor bác pre-mortem (2 Claude, ghi lại theo luật):** cơ chế orphan "organizer-add sau close" của pre-mortem bị chặn — `organizer_add_team` CÓ status guard (`20260529140000:56-57`, orchestrator verify). Bất đồng thật được giữ, không gật cho êm.

**pre-mortem P0 im lặng:** JourneyKind collision → funnel blended → anh đóng UX-07 nhầm. CI xanh vì `journeys.test.ts` chỉ test "khác kind", không test "cùng kind hai bề mặt". Đây là **telemetry-version của mô-típ "test assert ít hơn tuyên bố"** đã đẻ ra cả cụm này.

**Cảnh báo mang vào code:** nếu sau này xây P2 count — `useTournamentData.ts` `if(error) throw` → lỗi count **sập cả list `/tournaments`**; `quick_table_registrations` chưa chắc có GRANT anon (RLS ≠ GRANT), verify prod trước.

---

## 7. Tranh luận trong panel

> **Đồng thuận đáng tính:** chỉ 1 cross-vendor (GPT-5.6 bắt "close unlocked" → D3). Còn lại P3(a)/(b) là 4-Claude đồng thuận — mạnh nhưng không phải bằng chứng độc lập; đã đánh dấu.

## Bảng bất đồng — codex-review-de-integrity

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | P2 progress bar: BỎ hẳn, hay xây feature count MỚI? | **risk-auditor**: Dead code — grep xác nhận 0 caller. 'Fix' = 0 user change. Nếu Cuong muốn count đăng ký thật thì đó là FEATURE<br>**solution-architect**: (vòng 1, trên tiền đề sai) count per-card trong OpenRegistrationCard, không nhét vào useOpenRegistrationTables<br>**ui-ux-critic**: (vòng 1, trên tiền đề sai) bỏ thanh fill gây hiểu nhầm, giữ tỉ lệ X/Y dạng text. | **ui-ux-critic**: CONCEDE (`src/components/quicktable/index.ts:4 — chỉ có re-export barr`) | ✅ RESOLVED_EVIDENCE | Dead code — ui-ux-critic CONCEDE có bằng chứng (`src/components/quicktable/index.ts:4` chỉ re-export, 0 render caller; orchestrator verify). 'Sửa progress bar' KHÔNG phải bug fix. CÒN LẠI cho Cuong (phạm vi): xây feature count thật trên card /tournaments không? Nếu có: 1 aggregate GROUP BY (KHÔNG per-card N+1 trên limit=20), query TÁCH BIỆT kẻo lỗi throw sập list, verify GRANT anon. Nếu không: xoá dead component. |
| D2 | TeamMatch/DoublesElim anon: bỏ qua (chỉ instrument Singles+Doubles), hay THÊM CTA 'Đăng nhập để đăng ký'? | **solution-architect**: P3(c) Option A: chỉ instrument Singles (fix) + Doubles (mặc định). BỎ DoublesElim + TeamMatch vì (1) instrumen<br>**ui-ux-critic**: `TeamMatchView.tsx:185` anon TRỐNG hoàn toàn = **Blocker UX** độc lập với chuyện đo — ngõ cụt cho người vào từ | **solution-architect**: REFINE<br>**ui-ux-critic**: HOLD | 🔶 OPEN_FOR_CUONG | HỘI TỤ trục ĐO: chỉ instrument Singles+Doubles cho D5, KHÔNG kéo DE/TeamMatch vào gói đo (architect REFINE bỏ lý do guest-path sai; critic không tranh trục này). CÒN MỞ cho Cuong (trục UX rời rạc): `TeamMatchView.tsx:185` anon TRỐNG = ngõ cụt deep-link; thêm CTA 'Đăng nhập để đăng ký' (chỉ điều hướng /login, KHÔNG guest-register) — critic Blocker HOLD. Làm/không tuỳ Cuong; nếu làm native theo. |
| D3 | P1 residual (self-register vs close/cancel): vá 3 dòng re-check status dưới lock, hay BỎ hẳn? | **solution-architect**: Vá 3 dòng re-check status dưới lock (migration mới, KHÔNG mở lock ra organizer). Ưu tiên thấp nhất, defer được<br>**risk-auditor**: BỎ hẳn P1. Fix tối thiểu KHÔNG đóng được race — `close_doubles_elimination_registration` (20260529120000:215) <br>**pre-mortem**: Phần self-register gần như đã đóng bởi capacity-recheck-under-lock; lỗ THẬT là organizer-add sau close+seed (C | **solution-architect**: REFINE<br>**risk-auditor**: HOLD | 🔶 OPEN_FOR_CUONG | Panel HỘI TỤ: BỎ P1. architect REFINE rút kết luận 'đóng invariant' (sai vì close cũng unlocked, 20260529120000:215); risk-auditor HOLD giữ BỎ + verify organizer_add_team CÓ status guard (20260529140000:56-57) chặn orphan tuần tự. GPT-5.6 cross-vendor độc lập bắt 'close unlocked'. Residual = 1 đội seed=NULL hồi phục được, path prod dùng 1 lần; migration vá đúng mang downside SLO-3 > phần thưởng. Cuong chỉ cần xác nhận CHẤP NHẬN để residual, hoặc xếp một DB release riêng có test (KHÔNG follow-up vội). |

### 🔶 Cần anh quyết (2)

**D2 — TeamMatch/DoublesElim anon: bỏ qua (chỉ instrument Singles+Doubles), hay THÊM CTA 'Đăng nhập để đăng ký'?**

- `solution-architect`: P3(c) Option A: chỉ instrument Singles (fix) + Doubles (mặc định). BỎ DoublesElim + TeamMatch vì (1) instrument chúng = xây CTA anon MỚI = chính guest-path D5 chưa quyết, (2) awareness thấp → traffic ~0, data quá thưa để đọc.
- `ui-ux-critic`: `TeamMatchView.tsx:185` anon TRỐNG hoàn toàn = **Blocker UX** độc lập với chuyện đo — ngõ cụt cho người vào từ deep-link Facebook. Thêm CTA 'Đăng nhập để đăng ký' full-width ≥44px `<a href>` tới `?redirect=`. Đây là fix UX THẬT, không phải analytics theater. DoublesElim (`:181` chỉ text tĩnh) = Nên-sửa-cao.

**D3 — P1 residual (self-register vs close/cancel): vá 3 dòng re-check status dưới lock, hay BỎ hẳn?**

- `solution-architect`: Vá 3 dòng re-check status dưới lock (migration mới, KHÔNG mở lock ra organizer). Ưu tiên thấp nhất, defer được.
- `risk-auditor`: BỎ hẳn P1. Fix tối thiểu KHÔNG đóng được race — `close_doubles_elimination_registration` (20260529120000:215) cũng không lấy lock nên close vẫn chạy song song; 3 dòng chỉ giảm cửa sổ. Đóng THẬT cần lock cả close+cancel = migration rộng, thuộc một DB release có test riêng chứ không phải follow-up vội. Verdict AMBER cho P2+P3, RED nếu gói kèm migration P1.
- `pre-mortem`: Phần self-register gần như đã đóng bởi capacity-recheck-under-lock; lỗ THẬT là organizer-add sau close+seed (Cuong cho vượt cap nhưng đội seed=NULL orphan khỏi bracket là chuyện khác) — nếu vá thì guard đúng chỗ đó, không phải self-register.

---

## 8. Kế hoạch verify

- **Test phải assert cái nó TUYÊN BỐ** (bài học cả phiên): thêm test `journeys.test.ts` cho "cùng kind hai bề mặt KHÔNG collide" — chính lỗ đã cho collision lọt. Test `startJourneyOnce`: journey active thì không mint mới; journey stale (hết hạn) thì mint lại.
- Wire test: `player_registration` (Social Event) và `quicktable_registration` (mới) không dùng chung sessionStorage key.
- KHÔNG migration → KHÔNG pgtap/prod-apply. AMBER → qua gate CI thường + preview.

## 9. Sau khi ship

- Mốc **~2026-08-02** đọc funnel — giờ tách kind nên số SẠCH cho D5. NHƯNG nhắc lại: Cuong xác nhận awareness thấp là ràng buộc thật → funnel có thể vẫn thưa mọi bước → nhánh "đóng UX-07, bài toán thượng nguồn" vẫn khả dĩ.
- Native 0 telemetry → dán nhãn kết quả **"web QuickTable"**, không suy ra funnel toàn sản phẩm.
