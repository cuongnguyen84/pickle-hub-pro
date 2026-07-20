# Cụm UX-06 (undo destructive) + UX-07 (khám phá → đăng ký)

> Slug: `ux-06-07-undo-discovery` · Ngày: `2026-07-20` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`.
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` · `round2/*.json` · `external/*.md` (+`.meta.json` pin model ID) · `debate.json`

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| **D4** | quota=3 là ràng buộc sản phẩm hay **bug đếm**? | `ui-ux-critic`: bug đếm — `count_user_tournaments` (`20260516125412:41-46`) đếm cả giải `completed` → hạn mức "đang chạy" bị cài nhầm thành "trọn đời". Sửa mệnh đề WHERE + đổi nút chính thành "Kết thúc giải" | `solution-architect` + `pre-mortem`: ràng buộc bất biến, thiết kế đường thoát quanh nó. `risk-auditor`: nâng trần bằng `set_user_quota` cho rẻ | Chọn B = xây guard chống xoá mà vẫn để nguyên **cái đẩy organizer đi xoá**. Chọn A = đụng RPC quota, phải rà lại ý định sản phẩm của anh: 3 giải **cùng lúc** hay 3 giải **trọn đời**? Chỉ anh trả lời được |
| **D5** | "Tường đăng nhập là đòn bẩy số 1" — dữ kiện hay giả thuyết? | `ui-ux-critic` (+GPT-5.6 độc lập, **đồng thuận cross-vendor**): đòn bẩy số 1 | `solution-architect` với số prod: `quick_table_registrations` = **0 hàng từ trước tới nay**; 12/105 bảng bật `requires_registration`, **0 cái trong 60 ngày**. 0 hàng tương thích với cả "tường giết 100%" lẫn "không ai bật tính năng" | Chọn sai = làm cả UX-07 cho một bài toán không tồn tại. Đây là lý do increment gắn đo phải ship TRƯỚC khi bàn đường khách |
| **D3** | Sửa 2 bug điều hướng ngay, hay vá race sức chứa trước? | cả ba agent: **ship ngay** | (không còn ai giữ) | **Về thực chất đã hội tụ** — `risk-auditor` tự rút phần chặn. Ledger vẫn để OPEN vì không có CONCEDE kèm bằng chứng ở D3; orchestrator không tự chốt. Quyết định của anh ở đây gần như hình thức |

---

## 0b. ✅ Quyết định của Cuong (2026-07-20)

**D4 — GIẢI QUYẾT: quota = 3 giải TRỌN ĐỜI, đúng như đang chạy.** Không phải bug đếm. Đề xuất của `ui-ux-critic` (sửa `count_user_tournaments` chỉ đếm giải chưa `completed`, đổi nút chính thành "Kết thúc giải" để trả slot) **bị bác** — nó sẽ phá đúng cái hạn mức mà Cuong cố ý đặt.

> **Hệ quả phải ghi rõ, vì nó làm NẶNG thêm rủi ro chứ không nhẹ đi:**
> Nếu hạn mức là trọn đời thì xoá giải cũ **thật sự là đường duy nhất** để tạo giải thứ 4 — và đó là thiết kế, không phải tai nạn. Tức là hệ thống **cố ý** đẩy organizer về phía thao tác phá huỷ, trong khi thao tác đó đang xoá luôn bằng chứng thanh toán (lỗi #1) mà không có refund ở đâu.
>
> → **Increment 6 (trigger chặn xoá khi đã có tiền) tăng giá trị, không giảm.** Nó là thứ duy nhất đứng giữa áp lực-do-thiết-kế và mất bằng chứng tiền của người chơi.
> → Đường thoát cho organizer bị kẹt **không** phải là nới hạn mức đại trà, mà là `set_user_quota` (`20251230114611:67`, UI `/admin/users`) — Cuong duyệt từng ca. Đúng ý đồ "trọn đời" mà không phá sổ sách.
> → `pre-mortem` LIVE-2 vì vậy **vẫn đứng**: quota là cái máy đẩy organizer đi xoá. Chỉ khác là cái máy đó chạy đúng thiết kế.

**Ship:** Cuong duyệt increment **1-5** (GREEN/AMBER). Increment 6-7 (RED) giữ lại chờ duyệt riêng.

**D5** vẫn mở — increment 3 (gắn đo) chính là thứ sẽ trả lời nó.

---

## 1. Ý tưởng gốc

Nguyên văn roadmap (`docs/roadmap-8.5-9.md:183-184`):
- **UX-06** (4d): "Add undo/rollback for reversible destructive organizer actions"
- **UX-07** (4d): "Simplify player discovery-to-registration journey"

| Hỏi | Trả lời của Cuong |
|---|---|
| Xoá nhầm nào từng đau thật | **"Chưa từng đau thật, làm phòng xa"** |
| Baseline UX-07 | **"Có cảm nhận nhưng không có số"** |
| Native | **Cả hai cùng đợt** như cụm #408 |
| Đính chính của Cuong | `/tournaments` CÓ tab "Cộng Đồng" gồm mọi giải đang vận hành — recon vòng 0 đã sai |

---

## 2. Verdict — đọc cái này trước

**🔴 RED** (`risk-auditor` giữ nguyên sau vòng 2; `risk-tier.mjs` scoped 7 file cũng RED — khớp, không ai phải nâng/hạ).

RED thu hẹp còn **đúng 2 chỗ**: (1) migration trigger `BEFORE DELETE` — không git-revert được; (2) đường khách + OTP cho giải — chạm `phone-otp-send` (verify_jwt=false, ES256), tốn tiền SMS thật, và nới `NOT NULL` trên `otp_codes.event_id` (`20260511120000:350`) không revert thẳng được khi đã có hàng NULL. **Phần còn lại của cụm là GREEN/AMBER**, git revert 5 phút.

> ### Kết luận thật của cụm này
>
> **Roadmap đặt tên sai bài toán.** UX-06 không phải bài toán undo, UX-07 phần lớn không phải bài toán thiết kế. Panel moi ra **7 thứ đang hỏng trên prod hôm nay**, không cái nào cần cụm này ship mới hỏng — và tất cả đã được orchestrator mở file kiểm chứng độc lập.
>
> Cả 4 agent thống nhất: **KHÔNG làm undo tổng quát / soft-delete.** ~83 điểm đọc + 39 migration tham chiếu phải rà, cho một sự cố chưa từng xảy ra, mà cơ chế hỏng của nó (sót một query đọc → dữ liệu đã xoá vẫn hiện, hoặc lọt sitemap) **tệ hơn cơ chế nó phòng**.
>
> Ước lượng lại: **~7 nửa ngày**, không phải 8 ngày.

### 7 lỗi đang sống trên prod (đã kiểm chứng từng cái)

| # | Lỗi | Bằng chứng | Mức |
|---|-----|-----------|-----|
| 1 | Xoá đội MLP xoá luôn **bằng chứng đã đóng tiền**. Không ledger, không audit, không refund ở đâu trong repo. Native là **một chạm, không confirm** | `20260701140000:5-8` (payment_status nằm thẳng trên hàng team) · `payment_orders.registration_id` FK về `event_registrations` (`20260512130001:24`) nên team-match không có sổ · `useTeamMatchTeams.ts:421-427` xoá không đọc payment_status · `TeamMatchManageTeamsView.swift:221` | 🔴 P0 |
| 2 | `register_team_for_doubles_elimination` check-then-insert, **0 lock** | `20260529120000:112-118` vs `:158`; `grep -cE "pg_advisory\|FOR UPDATE"` = **0** | 🔴 P0 (tải hiện tại thấp — xem D5) |
| 3 | Đăng ký QuickTable `.insert()` thẳng từ browser, DB **không check sức chứa** | `useRegistration.ts:121-127`; guard duy nhất `UNIQUE(table_id, user_id)` — chính cái mà đường khách xoá sổ | 🟠 Thấp-hôm-nay / Cao-nếu-mở-khách |
| 4 | `Login.tsx:62` **nuốt `redirectUrl`** với người chưa onboard; onboarding không mang nó đi tiếp | `Login.tsx:62` + `OnboardingWizard.tsx:86-89` (đi `/nguoi-choi/<username>`) | 🔴 chặn đúng nhóm UX-07 nhắm tới |
| 5 | `/tournaments` **không bao giờ** mở tab Cộng đồng — nhánh đó là code chết | `Tournaments.tsx:144-145` + `useTournamentData.ts:21-31` (`select("*")` không lọc status). Kiểm chứng prod: sitemap 11 giải, trang có PPA/MLP → `hasWatchContent` luôn true | 🔴 sửa 1 dòng |
| 6 | "Giải của bạn" chỉ phủ Quick Tables, bỏ 3/4 thể thức, nhưng tiêu đề hứa "Các giải bạn đã đăng ký" | `useInteractionData.ts:117-140,208-230` · `Tournaments.tsx:446,459,467` | 🟡 P2 (vá copy 15 phút) |
| 7 | Quota đếm cả giải **đã kết thúc** → chiếm slot vĩnh viễn → đẩy organizer đi xoá giải đã thu tiền | `20260516125412:41-46` (COUNT(*) 4 bảng, không lọc status) · `20260529120000:28` (`completed` có thật) | 🔴 **fix gốc** — xem D4 |

Lỗi 7 là chỗ đắt giá nhất của cả phiên: nó giải thích **vì sao** lỗi 1 nguy hiểm. Anh nói "chưa từng đau thật" — đúng, nhưng chưa đau **không phải vì an toàn**, mà vì hệ thống chưa đẩy ai tới đó. Quota càng đầy thì áp lực xoá càng tăng.

---

## 3. Đã có sẵn gì (recon)

Đọc `round1/idea-recon.md`. **Recon sai 2 lần**, cả hai đều được bắt và ghi lại nguyên văn trong file đó:

1. Đọc nhầm `TournamentDetail.tsx` thay vì `Tournaments.tsx` → kết luận sai rằng `/tournaments` không có đường đăng ký. **Cuong bắt.**
2. Bản đính chính của orchestrator chép lại chữ trong code mà không hỏi nhánh đó có chạy không. **`ui-ux-critic` bắt** (đúng như cụm UX-01..05, cũng chính agent này bắt recon sai).

→ Coi đây là **điểm yếu hệ thống của bước recon**, không phải rủi ro ngẫu nhiên. Panel vòng 1 đã được lệnh tự kiểm chứng thay vì tin recon.

Thứ đã có, **dùng lại chứ đừng xây**: `useConfirm()` (10 file, nhưng **không flow destructive nào dùng**) · `cancel_social_event` (soft, typed-name) · cặp `cancel-registration`/`reactivate-registration` (mẫu cancel↔undo thật, player-facing) · `set_user_quota` + `useAdminQuota.ts` · `useUrlBackedState` (#414) · `PageStates` (DS-04) · `journeys.ts` (4 kind, `player_registration` **chỉ** wire ở social event) · `sonner` đã mount sẵn (`App.tsx:570`).

---

## 4. Phương án (solution-architect)

**UX-06 — Option A: guard ở tầng DB.** Trigger `BEFORE DELETE`, không cột `deleted_at`, không undo, không cờ force. Option C (soft-delete) bị bác bằng số: **83 call site đọc + 39 migration tham chiếu**.

**UX-07 — Option A: sửa lỗi luồng + gắn đo, không đụng schema.** Option C (guest OTP) bị bác: 10-14 nửa ngày, RED, `quick_table_registrations.user_id` là `NOT NULL REFERENCES auth.users(id)` nên phải migration + viết lại RLS, cộng tiền OTP thật — cho một giả thuyết **chưa có một con số nào** (D5).

### Thứ tự increment đề xuất (~7 nửa ngày)

| # | Việc | Tier | Nửa ngày |
|---|------|------|---------|
| 1 | Đảo mặc định tab `Tournaments.tsx:145` + nhãn VI + vá copy "Giải của bạn" | 🟢 | 0,5 |
| 2 | Sửa `Login.tsx:62` mang `redirectUrl` qua onboarding | 🟢 | 0,5 |
| 3 | Gắn `player_registration` + `auth_wall_viewed` cho nhánh giải | 🟢 | 1 |
| 4 | Confirm dialog 2 chỗ thiếu (`TeamJoinPanel.tsx:138`, `TeamOverviewCard.tsx:265`) + copy hậu quả có CON SỐ + xoá dead `deleteMatchesMutation` | 🟡 | 1 |
| 5 | Confirm native `TeamMatchManageTeamsView.swift:221` | 🟡 | 0,5 |
| 6 | **Trigger `BEFORE DELETE`** chặn xoá khi `payment_status IN (claimed,confirmed)` + pgTAP + ERRCODE riêng | 🔴 | 2 |
| 7 | Vá lock `register_team_for_doubles_elimination` | 🔴 | 1,5 |

**Điểm dừng sau increment 3** để đọc funnel cùng mốc ~2026-08-02 (`organizer_tournament` đã cam kết ở cụm trước).

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

**Cường độ xác nhận đang ĐẢO NGƯỢC.** Thao tác khôi phục được (huỷ social event, `status='cancelled'`) bắt **gõ lại tên đầy đủ** (`EditSocialEvent.tsx:843-871`); còn hard-delete cascade phá đăng ký + tiền người khác (`MyTournaments.tsx:549-577`) chỉ có dialog 2 nút và **không nêu con số nào**. Câu trả lời không phải undo mà là **nói thật về hậu quả**.

**Toast "Hoàn tác" 5 giây: BÁC** — đồng thuận cross-vendor. Lý do riêng của critic mà GPT không có: trong Capacitor shell, app đi nền là WebView bị treo → toast biến mất còn chắc hơn trên web. Đừng đặt lưới an toàn vào thứ không tồn tại đúng lúc cần.

**GPT-5.6 bị bác một đề xuất lớn:** nó vẽ danh sách gộp 4 thể thức + bottom sheet lọc 5 chiều, card mẫu `12/16 suất · 200.000đ · Tân Bình · Hạn 18/5`. `CommunityBracket` (`Tournaments.tsx:40-52`) **không có** địa điểm, phí, hạn đăng ký hay sức chứa. GPT thiết kế cho dữ liệu sản phẩm không có — đúng chỗ nó mù vì không thấy repo.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

**`risk-auditor` đã BÁC 3 claim của GPT-5.6 sau khi mở file:** mức nghiêm trọng SEO (SAI — `/tools/*` đã `noindex, follow`, không trong sitemap) · "anon INSERT bypass Turnstile" (SAI — policy `WITH CHECK (user_id = auth.uid())`, không GRANT cho anon) · "RLS `deleted_at IS NULL` làm restore bất khả thi" (đúng một nửa).

**`risk-auditor` cũng tự cắt việc của phe mình:** Sự cố 2 của pre-mortem (`restore_social_event` dựng dậy 6 người đã huỷ) mô tả rủi ro của **một hàm không tồn tại** — grep 0 kết quả trong `supabase/` và `src/`. Cơ chế nền là thật (`20260521130000:573-579`, `cancelled_at` là kênh một chiều) nhưng xếp P1 trong cụm này là phồng phạm vi.

**Điều kiện `risk-auditor` KHÔNG nhượng ở increment 6:** trigger phải RAISE với ERRCODE riêng, có pgTAP, và test bằng **đúng role `authenticated` qua PostgREST** chứ không phải SQL editor superuser — lớp lỗi 42501 đã tái diễn 3+ lần, chính là lý do `20260513000000` phải ra đời.

**Gotcha pipeline (dính lần 2):** `risk-tier.mjs --files` tách bằng **DẤU CÁCH**, không phải dấu phẩy — truyền chuỗi phẩy ra `fileCount: 1` + AMBER giả. Và script gộp cả file untracked nên rác build local đẩy mọi thứ thành RED giả. Đáng sửa script hơn là để mỗi agent tự bịa cách lách.

---

## 7. Tranh luận trong panel

> **Cảnh báo về đồng thuận:** `solution-architect` + `pre-mortem` + `risk-auditor` đều là Claude. Ba bên gật đầu với nhau **không phải bằng chứng độc lập**. Đồng thuận cross-vendor duy nhất đáng tính trong cụm này: `ui-ux-critic` + GPT-5.6 độc lập cùng bác toast-undo. D5 chính là chỗ hai vendor **không** đồng ý — và nó nằm ở mục 0.

## Bảng bất đồng — ux-06-07-undo-discovery

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Guard chống xoá nhầm đặt ở TRIGGER tầng DB hay ở RPC? | **solution-architect**: Option A: trigger `BEFORE DELETE` ở tầng DB + 3 RPC mô phỏng `delete_quick_table` đã có. Lý do dứt điểm: guard<br>**risk-auditor**: Một RPC xoá có kiểm tra, từ chối xoá khi còn đăng ký / đã có người trả tiền / đã có trận xong; hard-delete chỉ<br>**pre-mortem**: Fix rẻ nhất cho P0: trigger `BEFORE DELETE` trên `team_match_teams` (~8 dòng SQL) — chặn cùng lúc web, native  | **solution-architect**: HOLD<br>**risk-auditor**: CONCEDE (`supabase/migrations/20260107133349_4d81fec4-b11a-4c56-9afa-2`) | ✅ RESOLVED_EVIDENCE | TRIGGER thắng. risk-auditor CONCEDE có bằng chứng: cả 5 bảng đều có RLS `FOR DELETE USING (creator = auth.uid())` CỘNG `GRANT DELETE ... TO authenticated`, và `MyTournaments.tsx:240-246` + `useTeamMatchTeams.ts:421` đang `.delete()` thẳng từ browser. RPC không phải guard — client bỏ qua được. Trigger BEFORE DELETE phủ cả web, native binary đã phát hành, và caller tương lai. Điều kiện risk-auditor KHÔNG nhượng và được giữ: migration này không git-revert được → increment đó vẫn RED-tier cần Cuong ký; trigger phải RAISE ERRCODE riêng + pgTAP + test bằng đúng role `authenticated` qua PostgREST (lớp lỗi 42501 đã tái diễn 3+ lần). |
| D2 | Khi giải đã có người trả tiền: CHẶN HẲN hay cho đường thoát gõ-lại-tên? | **solution-architect**: Có đường thoát typed-name: guard chặn mặc định nhưng organizer gõ lại tên giải thì vẫn xoá được.<br>**risk-auditor**: Từ chối xoá, chấm hết, khi còn đăng ký / đã có người trả tiền / đã có trận xong. Hard-delete chỉ dành cho giải<br>**ui-ux-critic**: Bỏ ô gõ tên (giữ lại CON SỐ hậu quả), chặn hẳn khi đã có thanh toán xác nhận — vì không có refund flow nào tro | **solution-architect**: CONCEDE (`src/hooks/useAdminQuota.ts:10 — `supabase.rpc('set_user_quot`)<br>**risk-auditor**: REFINE<br>**ui-ux-critic**: REFINE | ✅ RESOLVED_EVIDENCE | CHẶN CỨNG thắng, không có đường thoát typed-name cho nhánh có tiền. solution-architect CONCEDE có bằng chứng: tiền đề của nó (quota=3 khiến xoá là đường DUY NHẤT) SAI — `set_user_quota` đã tồn tại (`20251230114611:67`, wired `useAdminQuota.ts:10`, UI `/admin/users`), tức có escape valve KHÔNG phá dữ liệu. Và không ai trả lời được "xoá bằng chứng thanh toán rồi thì người đã đóng tiền đòi lại bằng cách nào" — repo không có hàm refund nào. Phạm vi chốt: (a) team_match có `payment_status IN (claimed,confirmed)` → trigger chặn cứng, UI không render nút xoá; (b) quick_tables/doubles/flex không có đường tiền (payment_orders FK về event_registrations) → typed-name chấp nhận được. LƯU Ý: ui-ux-critic REFINE và chỉ ra một fix GỐC rẻ hơn cả hai — xem D4. |
| D3 | Sửa 2 bug luồng đăng ký (tab mặc định + redirect bị nuốt) NGAY, hay phải vá race sức chứa trước? | **solution-architect**: Option A UX-07 'không đụng schema' — sửa lỗi redirect + gắn đo, ship ngay. Lập luận: bắt chờ 2 tuần baseline đ<br>**risk-auditor**: Thứ tự đúng: (a) vá lock doubles-elimination, (b) quyết QuickTable là 'đăng ký có sức chứa' hay 'xin tham gia <br>**ui-ux-critic**: Tách đôi: #1 (tab mặc định + redirect) là SỬA BUG, ship ngay cùng đo; #2 (đường khách) là thí nghiệm phễu thật | **solution-architect**: HOLD<br>**risk-auditor**: REFINE<br>**ui-ux-critic**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D4 | quota=3 là ràng buộc sản phẩm, hay là một BUG ĐẾM? (nảy sinh ở vòng 2, chưa qua đối chất) | **ui-ux-critic**: BUG ĐẾM. `count_user_tournaments` (`20260516125412:41-46`) đếm COUNT(*) trên cả 4 bảng KHÔNG lọc status, mà `s<br>**solution-architect + pre-mortem**: Coi quota=3 là ràng buộc bất biến và thiết kế đường thoát UI quanh nó (typed-name / cảnh báo hậu quả tốt hơn).<br>**risk-auditor**: Chấp nhận đường thoát KHÔNG destructive nhưng chọn cái rẻ nhất về rủi ro: admin nâng trần bằng `set_user_quota |  | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D5 | "Tường đăng nhập là đòn bẩy số 1 của UX-07" — có phải DỮ KIỆN hay mới là GIẢ THUYẾT? | **ui-ux-critic**: Tường đăng nhập là đòn bẩy số 1 (đồng thuận cross-vendor với GPT-5.6 — hai vendor độc lập cùng kết luận).<br>**solution-architect**: BÁC như dữ kiện. `quick_table_registrations` = 0 hàng vĩnh viễn tương thích với CẢ HAI giả thuyết: "tường giết<br>**risk-auditor**: Không phán về đòn bẩy, nhưng giữ RED trên đường khách vì lý do độc lập (race chưa vá + tiền OTP + nới NOT NULL |  | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |

### 🔶 Cần anh quyết (3)

**D3 — Sửa 2 bug luồng đăng ký (tab mặc định + redirect bị nuốt) NGAY, hay phải vá race sức chứa trước?**

- `solution-architect`: Option A UX-07 'không đụng schema' — sửa lỗi redirect + gắn đo, ship ngay. Lập luận: bắt chờ 2 tuần baseline để sửa một redirect bị nuốt là áp dụng nguyên tắc D1 sai chỗ, và baseline đo trên luồng đang hỏng thì cũng không so sánh được.
- `risk-auditor`: Thứ tự đúng: (a) vá lock doubles-elimination, (b) quyết QuickTable là 'đăng ký có sức chứa' hay 'xin tham gia chờ duyệt' rồi enforce trong DB, (c) gắn journey lấy baseline, (d) rồi mới bàn luồng khách. Nếu chỉ ship được một thứ: vá lock + gắn journey.
- `ui-ux-critic`: Tách đôi: #1 (tab mặc định + redirect) là SỬA BUG, ship ngay cùng đo; #2 (đường khách) là thí nghiệm phễu thật, đụng luồng tiền, đúng là phải chờ số. GPT-5.6 đúng cho #2, tôi đúng cho #1.

**D4 — quota=3 là ràng buộc sản phẩm, hay là một BUG ĐẾM? (nảy sinh ở vòng 2, chưa qua đối chất)**

- `ui-ux-critic`: BUG ĐẾM. `count_user_tournaments` (`20260516125412:41-46`) đếm COUNT(*) trên cả 4 bảng KHÔNG lọc status, mà `status=completed` có thật (`20260529120000:28`) → giải đã kết thúc chiếm slot VĨNH VIỄN. Hạn mức "đang chạy" bị cài nhầm thành hạn mức "trọn đời". Đề xuất: (1) chỉ đếm giải chưa completed/archived; (2) tách stat "Đang chạy n/quota" + "Đã kết thúc m · không tính hạn mức"; (3) đổi hành động chính từ "Xoá" thành "Kết thúc giải" (trả slot, giữ sổ sách); (4) chỉ giải RỖNG mới còn nút xoá cứng.
- `solution-architect + pre-mortem`: Coi quota=3 là ràng buộc bất biến và thiết kế đường thoát UI quanh nó (typed-name / cảnh báo hậu quả tốt hơn).
- `risk-auditor`: Chấp nhận đường thoát KHÔNG destructive nhưng chọn cái rẻ nhất về rủi ro: admin nâng trần bằng `set_user_quota`, không đụng RPC đếm.

**D5 — "Tường đăng nhập là đòn bẩy số 1 của UX-07" — có phải DỮ KIỆN hay mới là GIẢ THUYẾT?**

- `ui-ux-critic`: Tường đăng nhập là đòn bẩy số 1 (đồng thuận cross-vendor với GPT-5.6 — hai vendor độc lập cùng kết luận).
- `solution-architect`: BÁC như dữ kiện. `quick_table_registrations` = 0 hàng vĩnh viễn tương thích với CẢ HAI giả thuyết: "tường giết 100%" HOẶC "organizer đơn giản không bật tính năng" — mà 12/105 bảng bật requires_registration và 0 cái trong 60 ngày ủng hộ vế sau mạnh hơn. Chưa đo được gì cả; đây chính là lý do increment gắn journey phải ship trước.
- `risk-auditor`: Không phán về đòn bẩy, nhưng giữ RED trên đường khách vì lý do độc lập (race chưa vá + tiền OTP + nới NOT NULL không revert được).

---

## 8. Kế hoạch verify

- Increment 1-3: unit test cho `redirectUrl` đi qua onboarding; test mặc định tab với `tournaments` **không rỗng** (đúng điều kiện prod, đây là chỗ recon và orchestrator cùng trượt).
- Increment 6: **pgTAP bắt buộc**, chạy bằng role `authenticated` qua PostgREST. Test cả 2 chiều: chặn khi có tiền, cho qua khi rỗng.
- Increment 7: mở rộng `scripts/qa/db-race.mjs` — harness đã có `racePair()`, thêm case race 2 INSERT vào suất cuối.
- Manual: mục 12 `docs/manual-test-backlog.md` (đang chờ Cuong cho PR #422) + mục mới cho cụm này.

## 9. Sau khi ship

- Đọc funnel `player_registration` nhánh giải + `organizer_tournament` cùng mốc **~2026-08-02**. **Không claim cải thiện conversion trước mốc đó** (luật D1 cụm UX-01..05).
- Nếu số cho thấy `auth_wall_viewed` cao mà `complete` thấp → D5 ngả về `ui-ux-critic`, mở lại bàn đường khách (sau khi increment 7 xong — đó là gate cứng).
- Nếu `auth_wall_viewed` gần 0 → D5 ngả về `solution-architect`: không ai tới được cửa đó, bài toán nằm ở thượng nguồn, **đóng UX-07**.
