# CLS attribution — truy và fix thủ phạm layout shift mobile VN

> Slug: `cls-attribution` · Ngày: `2026-08-09` · Trạng thái: `shipped`
> **Quyết định của Cuong 09/08 ("theo em đi"):** D3 = DEFER (ticket chất-lượng-chữ-Việt riêng) · D4 = SHIP CHỈ-WEB (guard getPlatform()==="web", native giữ ngưỡng 80)
> **SHIPPED 11/08:** PR #570 → main `f0e1e184` (squash). Lab CLS đo 11/08 cùng harness cùng thời điểm: home 2nd-nav 1.0222→0.5281 (−48%), /live 0.4512→0.1623 (−64%); entry 0.315 chung cả prod lẫn nhánh = ngoài scope, để kỳ đọc CLS-ATTR-READ 17/08.
> **Khác kế hoạch:** (a) INC1 dùng thứ tự stable→volatile trong hàng nowrap thay vì slot ẩn bọc cả cụm — cùng bảo đảm zero-shift, residual vài px khi viewCount đổi số chữ số (ghi trong comment code); (b) INC3 skeleton hình dạng cố định head+16/9 — sẽ hụt khi có hero live thật (ui-ux-verifier ghi chú), nhận làm trần, xét ở kỳ đọc; (c) thêm 2 fix residual từ số đo preview: editorial VI skeleton 2→3 story, /live loading tree thêm info-column rows; (d) detour: PR #571 hotfix blog barrel + byte budget vì main đỏ sẵn chặn CI (bài học: bài blog push thẳng main không qua checklist 4 bước).
> **Nợ còn lại (Cuong, ghi ở §8):** đăng ký 4 GA4 dims ngày ship (KHÔNG hồi tố), test bàn phím iOS thật (INC4), xem 1 buổi phát thật trên điện thoại; entry 0.315 + hero-state skeleton = input kỳ đọc 17/08.
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+external) ·
> `risk-auditor` (+external) · `pre-mortem`.
> Model thiếu key trong lần chạy này: **GPT-5.6 bị account từ chối (400) — cả 2 agent chạy codex CLI model mặc định, đã ghi rõ trong external/**
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json` · data thô: `00-data-ga4-raw.txt`
> Ghi chú ledger: `debate-ledger.mjs` không tồn tại trong repo — orchestrator cưỡng chế luật thủ công, mọi stance vòng 2 đều có bằng chứng, 0 nhượng bộ bị loại.

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D3 | Fix font Inter VI (`index.html:62-63`: `inter-latin` = `optional` nhưng `inter-vietnamese` = `swap`, không preload) trong pass này? | `ui-ux-critic`: fix 0-byte (đồng bộ optional/swap + fallback metric-match) — mismatch gây chữ lai font trong một từ + reflow | `solution-architect`: defect thật nhưng là ticket chất-lượng-chữ-Việt riêng — data phân bố trang không ủng hộ font là thủ phạm CLS (/onboarding 6good/0poor, 226/246 poor dồn /live), và đổi metric chữ toàn site rơi đúng cửa sổ đo | Chọn A mà architect đúng: nhiễu cửa sổ đo, không biết fix nào ăn. Chọn B mà critic đúng: sót một nguồn CLS nền trải đều mọi trang |
| D4 | INC2 — `useKeyboardHeight` ngưỡng 80→150 (chặn false-positive address-bar iOS làm chat nhảy 280↔400px) | `solution-architect`: trong scope, caveat cần test app iOS thật | `risk-auditor`: defer — native đóng góp **0 event CLS poor** (app_surface 100% web) mà hồi quy bàn phím native phải đi qua app-store review mới sửa được; web hưởng, native trả giá | Chọn A mà auditor đúng: bàn phím native hỏng, kẹt chờ review App Store. Chọn B mà architect đúng: sót nghi phạm lớn thứ hai trên /live web |

**Khuyến nghị của orchestrator cho cả hai:** D3 chọn B (defer — nguyên tắc một-biến-số-mỗi-cửa-sổ-đo), D4 chọn phương án giữa: ship phần đổi ngưỡng **chỉ trên web** (`getPlatform() === "web"` guard — native giữ nguyên 80), test iOS thật vẫn nằm trong checklist Cuong.

---

## 1. Ý tưởng gốc

> "CLS attribution — đọc GA4 cls_shift_target (VN mobile) tìm thủ phạm layout shift lớn nhất, đề xuất fix để kéo CLS p75 mobile (~0.67, 63.7% poor) về ngưỡng good"

**Làm rõ ở bước 0:** không hỏi — derivable (00-intake.md). Ai dùng: khách mobile VN, nặng nhất là người xem livestream. Thành công: xem predicate mới ở §6 (số toàn cục cũ đã bị chứng minh là không dùng được làm gate). Ràng buộc: bundle headroom ~66KB, không phá Mux/signed playback, cả web lẫn WebView.

**Data thực tế (kéo 09/08, 29/07–08/08, VN+mobile, n=457):** `/live/<id>` chiếm **~78% CLS poor** (1 stream: 179 poor/20 good); home 37 poor; /login 15 poor (86% good). `cls_shift_target`/`cls_load_state`/`route` **chưa đăng ký GA4 dim** → element-level field data KHÔNG có, không hồi tố. `auth_state` đăng ký nhưng web_vital không gửi param → toàn `(not set)`. `app_surface`: **100% web** — native 0 event.

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟡 **AMBER** (classifier GREEN, auditor nâng: /live là surface có tiền lệ sự cố + một nhánh ý tưởng không revert được — ghi bẩn GA4) |
| **Khuyến nghị** | Option C sửa đổi sau vòng 2 — fix theo code-reading 3 chỗ đã chứng minh cơ chế + đăng ký dims ngày 0; KHÔNG đợi 7 ngày data, KHÔNG xây harness |
| **Công sức** | ~2–2,5 nửa ngày (1 người) + 2 thao tác GA4 UI thủ công của Cuong |
| **Rủi ro lớn nhất** | Fix đúng mà không chứng minh được (predicate cũ đo bằng traffic mix) — đã xử bằng predicate 3-gate G0-G3 |
| **Auto-merge** | Được sau khi qua gate, **TRỪ** cửa sổ deploy: cấm merge khi đang có buổi phát live (R3) |

---

## 3. Đã có sẵn gì (recon)

- **Giả thuyết có sẵn từ PERF-05** (`docs/perf-05-report-2026-07-28.md:54-60`): CLS tích luỹ qua session trên trang long-dwell (chat/presence re-render) — lab CLS đo 0.000. Data pagePath mới **khớp giả thuyết này**.
- **Attribution capture đã built** (#502): `cls_shift_target`/`cls_load_state` gửi từ client sẵn (`webVitalsRum.ts:146-189`) — chỉ thiếu đăng ký dim phía GA4.
- **9 commit từng fix CLS** quanh home live section — chưa ai đụng `/live/<id>` (WatchLive).
- Test `layout-stability-surfaces.test.ts` pin home/venue/blog — **0 coverage cho WatchLive/Login**.
- Không có tooling đo CLS local nào.

---

## 4. Phương án (solution-architect)

- **A — GA4-first:** đăng ký dims, đợi 7-10 ngày, fix theo data. Thua: dims đăng ký được ở mọi phương án cùng ngày 0 → A chỉ khác ở chỗ *không ship gì* trong 7 ngày; `largestShiftTarget` chỉ nêu 1 node — sai chỗ nếu 0.67 là tổng nhiều shift nhỏ (đúng giả thuyết session-accrual).
- **B — Harness Playwright đo CLS:** thua: nghi phạm address-bar iOS về nguyên tắc không tái tạo được headless; repro trỏ stream thật bị auditor chặn RED (track() khi mount làm bẩn viewer count). Chỉ cân nhắc lại nếu sau T+21 vẫn mù.
- **C — Fix theo cơ chế đã chứng minh + dims ngày 0** ← **CHỌN** (~2–2,5 nửa ngày, bundle +0KB, 0 dependency mới).

### Increments (đã cập nhật theo vòng 2)

1. **INC0 — instrumentation, cùng PR:** thêm param `auth_state` vào `buildWebVitalEvent` (`webVitalsRum.ts:146-174`, dim đã đăng ký sẵn); **Cuong thủ công trên GA4 UI:** đăng ký event-scoped dims `cls_shift_target`, `cls_load_state`, `metric_id` (pre-mortem: thiếu metric_id thì không dedupe hậu kỳ được), `route`. Không hồi tố — làm NGÀY 0.
2. **INC1 — hàng metadata WatchLive** (`WatchLive.tsx:391-477`): tách organizer ra hàng riêng, grid nowrap, slot `visibility:hidden` bọc **cả cụm** viewer-chip + viewCount (async value thứ 2, refetch 30s — `useInteractionData.ts:60-77`). Toa critic + 2 amendment architect.
3. **INC2 — ConnectDuprBanner ra khỏi flow** (`TheLineLayout.tsx:1052` + `ConnectDuprBanner.tsx:41-43`): chèn ~60-80px vào đầu MỌI trang khi user đăng nhập chưa link DUPR. Giả thuyết mất chỗ dựa field data (auth_state chưa gửi) nhưng cơ chế chèn là sự thật đọc được từ code; INC0 sẽ chứng minh/bác trong data kỳ sau.
4. **INC3 — LiveSection `return null`** (`LiveSection.tsx:79`): hero ~350px chèn vào đầu home sau khi query về (37 poor của `/`) — reserve skeleton cùng geometry.
5. **INC4 (D4 — chờ anh quyết):** `useKeyboardHeight` ngưỡng 80→150, đề xuất chỉ-web.
6. **Test:** thêm assertion WatchLive vào `layout-stability-surfaces.test.ts` theo pattern có sẵn.
7. **T+7 → T+21:** đọc GA4 theo predicate G0-G3 (§6). <ngưỡng thì mới bàn tiếp harness.

**Không làm:** /login (86% good — consensus vòng 2) · `reportAllChanges` trên prod (RED, chỉ sau `?cls_debug=1` local) · min-height/overlay cho chat (chat mở bằng chạm = CLS miễn trừ, chỉ tốn chỗ video) · kéo dài skeleton toàn trang.

---

## 5. UI/UX (ui-ux-critic + external)

- **Blocker giữ nguyên sau vòng 2:** loading-tree WatchLive (`:108-122`) render cây DOM khác hẳn resolved tree (skeleton 358×201 vs player thật 390×219, thiếu back-link ~40px) — phải cùng markup, chỉ khác nội dung. Hàng metadata (→INC1). LiveSection null (→INC3).
- **Nguyên tắc reserve không thành ô trống xấu:** giữ chỗ *bên trong hàng đã có* bằng `visibility:hidden` — tự ẩn khỏi a11y tree, không có "khoảng trống chờ" người dùng nhìn thấy.
- **Chống-fix bị chặn:** không `aria-live` cho viewer count (spam screen-reader suốt 45 phút xem), không clamp `<h1>`, không overlay lên footage.
- **Đồng thuận Claude+external:** fade-in không sửa CLS (opacity không đổi layout box — chỉ đẹp, không ăn điểm); loading và loaded phải chung skeleton geometry; giữ `swap` cho VI (chữ Việt hiện chậm tệ hơn reflow).
- Nit: `<select>` chất lượng trong `MuxPlayer.tsx:397` có `aria-label` hardcode tiếng Việt (thuộc nhánh WIP — nhắc chủ nhánh).

---

## 6. Rủi ro (risk-auditor + external + pre-mortem)

### Verdict: 🟡 AMBER — classifier GREEN, auditor nâng (surface /live + nhánh không revert được)

| # | Mức | Cơ chế hỏng | Giảm thiểu |
|---|-----|-------------|------------|
| R1 | 🔴 chặn cứng | `reportAllChanges` ghi bẩn vĩnh viễn chính KPI (%good phồng 32→89 giả; GA4 không xoá row — `git revert` vô dụng) | Không lên prod. Debug local sau `?cls_debug=1` |
| R2 | 🔴 chặn cứng | Repro Playwright trỏ stream thật: `useLivePresence.ts:100-112` track() khi mount → viewer thật thấy số nhảy | Không xây harness nhắm stream live |
| R3 | 🔴 chặn cứng | Deploy giữa buổi phát → chunk-reload cho khán giả đang xem | Cấm merge khi đang có stream live; đọc lịch trước khi /ship |
| R4 | 🟡 | Attribution sai tầng: CLS document-scope, `route` đóng băng lúc boot → shift ở `/` có thể ghi cho `/live` | Ghi rõ mẫu số /live là proxy; INC0 route dim để đo kỳ sau |
| R5 | 🟡 | Predicate cũ đo traffic mix, không đo fix (lật 15,3 điểm theo lịch phát) | **Predicate mới:** G0 n_LIVE<100 → +7 ngày (trần T+21) · G1 %good_LIVE ≥50% (nền 8,8%) · G2 %good_NONLIVE ≥80% (nền 63,5%) · G3 toàn cục chỉ báo cáo, không gate |
| P1 | 🟡 (pre-mortem #2, **đúng ngay bây giờ**) | Test layout pin chuỗi chỉ có trong diff CHƯA commit của nhánh WIP → checkout sạch nhánh WIP đỏ test | Cuong commit phần source WIP (LiveSection/WatchLive/MuxPlayer) hoặc chủ fix rebase off main — fix branch này PHẢI base main |
| P2 | 🟡 (pre-mortem #3) | Giữ ChatPanel mounted để chống CLS → channel per-instance không refcount (`useChatMessages.ts:128`) → 3→5 conn/viewer, đêm giải ×5 khán giả chạm quota Realtime | INC1/INC3 không đổi mount-state của chat — giữ nguyên ranh giới đó |

**Perf:** bundle +0 KB (đo thật 1904,0/1970 gz, headroom 66,0 KB; `docs/perf-budgets.md:34` stale 82KB — tiện tay sửa). LCP không đụng (không thêm preload — lý do bác một phần D3). **SEO:** không đụng SSR, không bump `pr:v34`. **Rollback:** toàn bộ INC0-INC4 là app code — `git revert` + redeploy; thứ KHÔNG revert được duy nhất là data GA4 nếu vi phạm R1.

**External pass:** 12 claim xác minh đúng trong repo; 2 bị bác (cardinality `(other)` sai ở n=457; "blank route" thực tế có recovery `chunkError.ts`).

---

## 7. Tranh luận trong panel

Ledger đầy đủ trong `debate.json` (cưỡng chế thủ công — script không tồn tại). Tóm tắt:

**Bị giết ở vòng 2 (ảo — thiếu thông tin):**
- D1: architect CONCEDE khi thấy `useInteractionData.ts:60-77` (viewCount refetch 30s cùng hàng) → restructure metadata row thành increment chính.
- D2: architect CONCEDE khi tự cộng lại số (fix hoàn hảo vẫn 73,74%) → nhận predicate 3-gate; auditor cũng REFINE, rút chữ "không thể đạt".

**Sống sót (thật — cùng dữ kiện, khác đánh giá):** D3 (font), D4 (keyboard threshold) → mục 0.

**Nhượng bộ bị LOẠI:** không có.

**Đồng thuận có nghĩa** (Claude + external độc lập): R1 reportAllChanges, không-harness-trỏ-stream-thật, fade-in không sửa CLS, /login ngoài scope.

---

## 8. Kế hoạch verify

**Tự động:** eslint changed · check-theline changed tsx · tsc -b · npm run test (kèm assertion WatchLive mới) · build + bundle-size (kỳ vọng +0) · e2e:smoke trên preview · post-deploy `/` + `/live/<id đang không phát>`.

**Cuong phải tự làm:**
- [ ] GA4 UI: đăng ký 4 event-scoped dims `cls_shift_target`, `cls_load_state`, `metric_id`, `route` (Admin API của SA bị disable — phải qua UI)
- [ ] Quyết D3, D4 (mục 0)
- [ ] Commit phần source đang dở trên nhánh WIP (gỡ P1 pre-mortem)
- [ ] Xem một buổi phát thật trên điện thoại sau khi ship INC1 — mắt người là verify cuối cho "hết nhảy"
- [ ] (nếu D4 chọn ship) test bàn phím chat trong app iOS thật

**Mốc milestone đề xuất** (thêm vào `docs/milestones.md` khi /ship): `2026-08-17 CLS-ATTR-READ` — đọc GA4 theo G0-G3, trần T+21 (2026-08-31), verdict ∈ {ĐẠT, CHƯA ĐỦ MẪU +7d, TRƯỢT → cân nhắc harness B}.
