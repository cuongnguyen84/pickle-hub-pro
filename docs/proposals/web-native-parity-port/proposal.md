# Web → Native parity port (đêm 2026-07-27)

> Slug: `web-native-parity-port` · Ngày: `2026-07-27` · Trạng thái: `approved` (Cuong ra lệnh thi hành trong cùng message — phần GREEN; phần RED giữ lại chờ anh)
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) · `risk-auditor` (+GPT-5.6) · `pre-mortem`.
> Model thiếu key trong lần chạy này: `none` (cả hai external call thành công qua codex exec)
>
> **Raw audit trail**: `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`
> ⚠️ `scripts/agents/debate-ledger.mjs` và `risk-tier.mjs` KHÔNG tồn tại — luật vòng 2 cưỡng chế tay bởi orchestrator (kết quả trong `debate.json.ledger`), tier đối chiếu tay với verdict auditor.

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| O1 | **Native VI-only?** `DEVELOPMENT_LANGUAGE: vi`, 0 file localization / 199 file Swift. Chuỗi mới đêm nay viết VI-only theo thiết kế hiện tại — trái luật song ngữ CLAUDE.md | architect: VI-only theo hiện trạng, i18n native là dự án riêng | luật CLAUDE.md: mọi text user-facing phải song ngữ | Chọn VI-only: user EN (~5%) không đọc được app native. Chọn bilingual: +1 dự án hạ tầng trước khi port được gì |
| O2 | **T4/T5 (ghi prod) làm lúc nào?** Panel đồng thuận RÚT khỏi đêm không giám sát; kèm sẵn gate để làm phiên có anh ngồi cạnh (mục 9) | — | — | Không quyết thì hai gap này treo mãi như 3 tuần qua |

Hai bất đồng D1/D2/D3 còn lại đều đã CHẾT ở vòng 2 bằng dữ kiện file thật — không cần anh (chi tiết mục 7).

---

## 1. Ý tưởng gốc

> "so sánh prod web và app native (/apple). CHia task và thực hiện port đầy đủ sang native. Viết báo cáo tổng kết. Anh sẽ test vào sáng mai"

**Làm rõ ở bước 0:** AskUserQuestion không khả dụng trong phiên; intake lấy từ chính message + defaults khai báo trong `00-intake.md` (parity theo GIÁ TRỊ không theo pixel; task dở dang tệ hơn task chưa làm; không merge tự động nếu vượt AMBER).

---

## 2. Verdict — đọc cái này trước

**🔴 RED hẹp / 🟢 GREEN phần thi hành đêm nay.** risk-auditor phân vùng (không ai hạ được):

| Nhóm việc | Tier | Đêm nay |
|---|---|---|
| Màn hình **chỉ-đọc** + sửa chữ + tắt chip | 🟢 GREEN | ✅ THI HÀNH (6 task, mục 4) |
| T4 perks/lặp-tuần nhánh **CREATE qua RPC guarded, draft** | 🟢 GREEN (refined vòng 2) | ❌ vẫn hoãn — vì gộp chung phiên với nhánh EDIT dễ trượt phạm vi lúc 3h sáng |
| T4 nhánh **EDIT** (thêm `free_perks` vào EventPatch) | 🔴 RED | ❌ chờ anh — gate ở mục 9 |
| T5 mời thành viên CLB | 🔴 RED trừ khi gate G5 xanh | ❌ chờ anh |
| APNs push, Creator Studio, mọi migration | 🔴 RED | ❌ không đụng |

**Điều quan trọng nhất panel tìm ra:** hai gap trong bảng recon là **dữ kiện sai** — TV-mode dashboard ĐÃ TỒN TẠI trên native (`QuickTableDetailView.swift:942-973` courtsTab, poll 15s), và video player native ĐÃ CÓ (`VideoPlayerScreen.swift`) chỉ là Home chưa nối dây (`VideoSummary.playbackURL` là code chết). Tức "port" đêm nay phần lớn là NỐI DÂY thứ đã xây, không phải xây mới — rủi ro thấp hơn hẳn kế hoạch ban đầu.

**Cross-vendor (bằng chứng thật):** GPT-5.6 và risk-auditor Claude độc lập cùng tìm ra lỗ `.insert()` thẳng vào `event_registrations` bypass guard sức chứa (guard sống trong RPC, không trong bảng) — **lỗ này đang sống trên prod hôm nay**, không phải rủi ro tương lai. Gate vĩnh viễn: `grep 'from("event_registrations")' apple/` không được có `.insert(`.

---

## 3. Đã có sẵn gì (recon + đính chính vòng 2)

11 gap ban đầu (recon) → sau vòng 2 còn thực chất:

- **Nối dây, không xây mới:** Home video (player đã có), bảng sân (đã có trong QuickTableDetail).
- **Xây mới thật, chỉ-đọc:** màn `/videos`, lọc format/status tab Cộng đồng, badge "X người đã đăng ký" (web #429).
- **Xây mới thật, có ghi:** T4 perks+lặp-tuần, T5 mời thành viên → hoãn có gate.
- **Chủ ý không port:** Creator Studio (2 user), DUPR OAuth (cần ASWebAuthenticationSession), Turnstile recovery, permalink SEO, TV-mode (đã có), APNs (không có portal access — 0 dòng code APNs trong /apple, thiếu từ capability trở đi).
- Nhánh cũ (`feat/native-ios-phase-1`, `feat/mlp-captain-registration`) diff rỗng so main — không có work bị bỏ quên. Port đi từ `main`.

## 4. Phương án (solution-architect) — bản sau đối chất

**Option A' — "nối dây + chỉ-đọc", 6 task, cắt cứng.** (Option A vòng 1 bỏ T4/T5/T6 sau CONCEDE; nhận thêm 3 việc S từ critic + chính mình.)

| # | Task | File đụng | Cỡ | Ghi prod? |
|---|---|---|---|---|
| N1 | Home video phát native (nối `playbackURL` → `VideoPlayerScreen`, gỡ comment sai "Phase 6") | `HomeView/HomeVideosSection`, `Core/Home/VideoModels.swift:41` | S | 0 |
| N2 | Màn `/videos` — danh sách video replay + phát native | mới `Features/Videos/VideosListView.swift`, repo tái dùng `VideoModels` | M | 0 |
| N3 | Tab Cộng đồng: lọc theo format + trạng thái (web parity 3-tab) | `TournamentsView.swift` (thuần client-filter) | M | 0 |
| N4 | Badge "X người đã đăng ký / X đội" trên CommunityCard (web #429) | `TournamentsView.swift:132-158`, `CommunityRepository` | S | 0 |
| N5 | Fix tên format lệch trong chính native: ToolsView:210 "Loại trực tiếp" vs ToolsModels:134 "Loại kép" | 1 dòng | XS | 0 |
| N6 | Chip DUPR: `dupr == nil` → nhãn tĩnh, không mở SafariView ngõ cụt | `AppTabView.swift:104` | XS | 0 |
| N7 | Guard pre-mortem #1: `assertionFailure` trong catch của repository đọc (DEBUG-only) | `CommunityRepository.swift:58` + các catch cùng lớp | S | 0 |

Tổng ~4.5-5.5h kể cả verify. Mỗi task: build + **simctl launch + nhìn màn hình** (pre-mortem: BUILD SUCCEEDED không đủ — intake đã cắt mất nửa sau của `native-build-run-loop`, giờ trả lại).

### Khuyến nghị
Option A'. Không có option B đáng viết — phần ghi đã rút, phần còn lại không có trade-off thật.

## 5. UI/UX (ui-ux-critic + GPT-5.6)

- **3 blocker vòng 1:** auth cliff web-hop (3 call site) → đêm nay vá 1 (N6), 2 còn lại ghi mục 9; DUPR chip ngõ cụt (→N6); CTA "Xem trên web" lime full-width trên TournamentDetail → hạ `.outline` (gộp vào N3 nếu tiện, 1 dòng).
- **Redesign khi port sau:** tournaments IA (format/status xuống TLSelect, bỏ count khỏi nhãn segment); slots/perks tách sheet; push pre-permission sheet.
- **Không port vì UX:** TV-mode auto-rotate trên phone (mà nó cũng đã có bản đúng), Turnstile recovery.
- **Bất đồng với GPT-5.6 (được ghi nhận, không theo):** GPT muốn TV-mode two-scene external-display — đúng dài hạn, cần phần cứng thật, không phải đêm nay.

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED hẹp — phần thi hành đêm nay 🟢 GREEN (bảng mục 2)

- **SLO web không bị đe doạ:** diff `src/ functions/ supabase/` = rỗng, +0 KB bundle, 0 route SSR.
- **Rollback:** `git revert` là đủ cho toàn bộ phần đêm nay (0 ghi prod, 0 migration, không deploy tới user nào — app chưa submit).
- **Bằng chứng thay CI (Actions hết budget):** baseline local trên main đã chạy trong phiên: build XANH + `TEST SUCCEEDED 109 tests/19 suites`. Gate: mỗi task build lại + test + simctl launch.
- **3 postmortem pre-mortem:** (1) slots shape-drift — CHẾT dưới phạm vi hẹp (P0→P2, xem round2); (2) decode câm `catch { return [] }` — N7 vá đúng nó; (3) tab thứ 6/gỡ web-hop — luật: KHÔNG thêm tab mới, KHÔNG gỡ SafariView khi chưa có màn thay thế.
- **Phát hiện đo bằng Swift thật (risk-auditor):** `Encodable` synthesized bỏ key khi `nil` (encodeIfPresent) nhưng GỬI `[]` khi mảng rỗng → lớp lỗi xoá-trắng nằm ở mảng rỗng, không phải nil. Luật cho mọi field thêm vào `EventPatch` sau này: phải có dòng đọc tương ứng trong `prefill()`.
- **Bug độc quyền pre-mortem tìm ra (cho T4 sau này):** bộ sinh slug native khử trùng MỘT LẦN độ phân giải giây → vòng lặp lặp-tuần đụng UNIQUE ở vòng 3, retry nhân bản rác. Web đã giải bằng hậu tố tất định `-tuan${i+1}` + `batchResumeIndex` (`CreateSocialEvent.tsx:474`). Port lặp-tuần BẮT BUỘC copy đúng bộ sinh slug của web.

## 7. Tranh luận trong panel

### Bất đồng bị giết ở vòng 2 (ảo — do thiếu thông tin)
- **D3 TV-mode:** cả hai phía tranh cãi về thứ ĐÃ TỒN TẠI (`QuickTableDetailView.swift:942-973`). Chết bằng dữ kiện.
- **D2 (phần lớn):** architect CONCEDE "không phải gap" sau khi tự mở `DuprConnect.tsx:72-86` thấy ngõ cụt thật; phần còn lại hai bên vốn đồng ý (OAuth để sau).

### Bất đồng sống sót (thật — cùng dữ kiện, khác đánh giá)
- **D1 phạm vi dài hạn:** architect giữ "cấm theo lớp màn-hình-có-ghi là luật đúng đêm nay, sai dài hạn — fix bền là XCTest khẳng định key EventPatch ⊆ field prefill()". risk-auditor giữ partition RED cho nhánh EDIT tới khi có test đó. Cả hai lập trường ghi nguyên trạng — anh quyết khi duyệt T4 (O2).

### Nhượng bộ bị LOẠI
Không có — cả 3 CONCEDE đều kèm evidence file:line tự kiểm chứng (ledger tay trong `debate.json`, vì `debate-ledger.mjs` không tồn tại).

## 8. Kế hoạch verify (đêm nay)

Mỗi task N1-N7: (1) `xcodegen && xcodebuild build` exit 0; (2) `xcodebuild test` 109+ pass (thêm test cho logic mới không tầm thường); (3) `simctl launch` + screenshot màn liên quan; (4) commit riêng từng task — task hỏng thì revert được từng cái. Cuối đêm: PR + báo cáo tổng kết (đã-port / chưa-port-vì-sao / cách-test-từng-cái cho anh sáng mai).

## 9. Sau khi ship (nợ có gate, chờ anh)

1. **T4a perks (CREATE-only qua EventPayload):** GREEN theo risk-auditor nếu KHÔNG đụng EventPatch. Phiên có anh.
2. **T4b perks nhánh EDIT:** gate = prefill seed `e.freePerks` + XCTest chống `free_perks: []` + test tay "sửa event web-tạo-có-perks rồi mở lại trên web đếm chip".
3. **T4c lặp-tuần:** gate = slug hậu tố tất định `-tuanN` copy từ web + xử lý fail-giữa-chừng.
4. **T5 mời thành viên:** gate G5 = CLB test có đúng 1 organizer là account test, 0 co-manager (trigger push thật `20260527140000:194-196`).
5. **T10 slots:** gate = guard updateSlots read-before-write + test khoá tập key JSON khớp `20260521120000:15-25`.
6. Auth cliff 2 call site còn lại (`ClubsListView:81`, `ClubDetailView:215`) + `ASWebAuthenticationSession` cho DUPR.
7. APNs push: cần anh mở Apple Developer portal (capability + APNs key + Firebase iOS app) — code client viết sau khi có credential, KHÔNG trước.
8. XCTest "key EventPatch ⊆ prefill()" (đề xuất architect, D1 sống sót).
