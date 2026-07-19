# risk-auditor — vòng 1 (2026-07-19)

> Nguyên văn output agent, không chỉnh sửa. GPT-5.6 brief/reply: `../external/risk-brief.md`, `../external/risk-openai.md`.

GPT-5.6 returned strong findings. I verified each against the repo. One is a hallucination caused by my brief omitting a policy: the repo HAS a `"Users can view their own tables" USING (creator_user_id = auth.uid())` SELECT policy on `quick_tables`, so its finding #2 (a private `is_public=false` draft becomes unreadable by its own creator) is FALSE — the private insert is actually the safe, owner-readable fix. Everything else survives verification.

## Verdict: 🔴 RED
Cụm đụng cùng lúc: migration enum không thể revert + RLS `quick_tables` leak draft công khai + 4 file SwiftUI native ship qua App Store không có nút revert — một defect autosave chung biến thành sự cố tạo-giải trên cả web lẫn iOS mà không lùi được.

Classifier said: RED · Em giữ nguyên RED (không nâng, đã chạm sàn). Lý do classifier: native shell + DB migration. Em bổ sung lý do thứ ba nó không thấy: **RLS `quick_tables` rò rỉ draft** — đây mới là cơ chế hỏng cụ thể nhất, không phải chỉ "có native/migration".

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | UX-04 QuickTable: autosave INSERT `quick_tables`. Cột `is_public NOT NULL DEFAULT true`; policy SELECT duy nhất cho public là `USING (is_public = true)`, **không có status gate** (migration `20251223034604`). Draft dở dang = công khai ngay khi gõ. | Bảng QuickTable trống/tên placeholder/format chưa xong hiện public cho bất kỳ ai; lọt vào list surface + `/quicktable` SSR. Sitemap whitelist KHÔNG chặn được vì nó chỉ lọc bảng `tournaments`, không phải `quick_tables`. | INSERT draft với `is_public = false`. An toàn VÀ chủ vẫn đọc được (đã có policy `"Users can view their own tables" USING (creator_user_id = auth.uid())`). Đây là cách sửa đúng — xem mục bác bỏ GPT bên dưới. |
| 2 | **Cao** | UX-04: `ALTER TYPE quick_table_status ADD VALUE 'draft'` và `team_match_status ADD VALUE 'draft'` — cả hai là ENUM Postgres thật. **ADD VALUE không thể revert** (Postgres không DROP được enum value). doubles/flex là TEXT+CHECK nên sửa CHECK lùi được; quick_table + team_match thì KHÔNG. | Nếu autosave lỗi phải rollback, không có down-migration cho phần enum. `git revert` code không gỡ được giá trị enum đã thêm. | Đừng nhét 'draft' vào enum vòng đời. Dùng cột riêng (`is_draft boolean` / bảng `creation_drafts` owner-only), hoặc localStorage-only cho tournament. Xem checklist hạ tier. |
| 3 | **Cao** | UX-04/UX-05 mọi flow: autosave và publish là hai write đồng thời không có version/lock. Autosave trễ đang bay khi user bấm Publish → publish xong trước, autosave cũ đáp sau ghi đè. Nặng nhất ở TeamMatch/Doubles (tiền thật). | Giải vừa publish tụt về draft/setup; hoặc fee/VietQR bị ghi đè bằng data cũ → mở đăng ký với giá sai / QR sai. Đây là sự cố mất-slot/thanh-toán (SLO 4), không phải lỗi cosmetic. | Revision number/ETag, reject stale write; disable autosave sau publish; publish là RPC atomic. |
| 4 | **Cao** | UX-03/UX-05 TeamMatch (1348 dòng) + Doubles (1420 dòng): progressive disclosure ẩn field payment nhưng state vẫn nằm trong form/draft; validation coi field ẩn là "không liên quan". Bật fee → nhập VietQR → thu gọn payment → apply template/resume draft → publish. | Giải thu sai phí, hiện QR/tài khoản cũ, hoặc quảng cáo "có phí" mà không có đích thanh toán; hoặc data phí ẩn còn sót làm giải "miễn phí" thành có phí. | Validation server-side dựa trên payment mode ĐÃ PERSIST, không dựa trên field visibility. Clear state khi ẩn. |
| 5 | **TB** | Native: 4 file `Create*.swift` sửa cùng đợt, nhánh `feat/mlp-captain-registration` có 19 commit native creation chưa merge (`backup/native-2026-07-18`). Merge conflict có thể âm thầm nuốt logic draft HOẶC creation work cũ. | Màn tạo native mất field/crash sau khi resolve conflict; chỉ phát hiện khi qua App Store review. | Tách PR native; rebase/resolve trước; test tay 5 màn tạo trên simulator. |
| 6 | **TB** | Release không atomic: backend/status/API đổi trong khi binary iOS còn nằm chờ review. Client iOS cũ nhận status value lạ nó không decode được. | User iOS cũ decode fail → row biến mất khỏi list, hoặc save/publish fail cho tới lần release App Store kế tiếp. | Mọi thay đổi backend phải tương thích ngược cả client native cũ; ship additive, không đổi nghĩa status cũ. |
| 7 | **TB** | UX-04 4 flow tournament chưa có draft lifecycle → autosave tạo row bền vững khi vào wizard; mỗi lần bỏ dở = 1 orphan. Không có cron nào quét (auto-archive chỉ `ongoing→completed`, auto-cancel chỉ `pending_payment` — không đụng `setup`). | Organizer thấy list đầy giải rác abandoned; DB phình vô hạn. (Ngược lại nếu SAU này thêm cron quét `setup` thì lại xoá nhầm draft hợp lệ.) | Expiry rõ ràng cho draft (TTL) hoặc chỉ ghi draft khi user chủ động "Lưu nháp", không autosave-INSERT khi vừa mở. |
| 8 | **Thấp** | UX-01..05: 4/5 flow không có instrumentation (`journeys.ts` chỉ có `player_registration` + `organizer_event`=social). | Không phải outage — nhưng "tăng completion O2→O4" chỉ đo được cho social; 4 flow kia không verify được claim. | Instrument trước khi ship (điều kiện của BASE-02), nếu không thì đừng claim metric cho 4 flow đó. |

## SLO bị đe doạ
- **SLO 4 (Scoring/lost-update, 99.5% + zero incident):** rủi ro #3 — publish race trên TeamMatch/Doubles ghi đè fee/bracket = mất-slot/sai-tiền = **incident**, không phải rate. Đây là SLO nặng nhất bị đe doạ.
- **SLO 1 (Availability /):** rủi ro #5/#6 — native creation crash / decode fail (không phải web `/`, nhưng là availability của luồng tạo trên iOS).
- Không đe doạ trực tiếp SLO 2/3/5/7 (auth/registration/cron/push). Không đụng edge function `verify_jwt` → **không** chạm bẫy ES256/HS256.

## Ngân sách hiệu năng
- **Bundle:** UX-01/02/03 thêm code vào 5 trang setup. Các trang `*Setup.tsx` là lazy route → **không** đụng INITIAL (~265/280 KB). Vào CODE (~1455/1800, còn ~345 KB headroom) — dư sức. Verdict: **rủi ro thấp**, miễn không import eager lib validation/form mới >20 KB. Kiểm tra `check-bundle-size.mjs` sau khi thêm.
- **Vietnam p75:** autosave = write network lặp lại. Nếu debounce kém (ghi mỗi keystroke) → tăng request Supabase REST từ mobile 3G/4G VN. Không đe doạ LCP/INP nếu autosave async không block render. Điều kiện: debounce ≥ 2-3s, không autosave-INSERT khi mở màn.

## SEO
- **Routes SSR bị ảnh hưởng:** `/quicktable/*` — rủi ro #1 làm draft QuickTable public có thể bị bot crawl qua link nội bộ. `sitemap-tournaments.xml` **an toàn** (whitelist `['ongoing','ended','upcoming']`, không đụng quick_tables). `social_events` sitemap đã `.eq('status','published')` — an toàn.
- **Cần bump `pr:v29`?** Chỉ khi UX-05/UX-01 đổi output SSR của trang tạo hoặc trang giải. Nếu chỉ đổi form client thì **không**. Nếu draft QuickTable lọt SSR thì phải fix RLS (#1) TRƯỚC, không phải bump cache.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/quicktable/<draft-id>` → PHẢI 404/403, KHÔNG được 200 với bảng dở.

## Kế hoạch rollback
- **Cơ chế:** `git revert` + Cloudflare Pages rollback cho web; NHƯNG:
  - Migration enum `ADD VALUE 'draft'` (quick_table_status, team_match_status): **KHÔNG revert được** — Postgres không DROP enum value.
  - Native SwiftUI: **KHÔNG revert được** — qua App Store review.
- **Thời gian khôi phục:** web ~10 phút (rollback deployment). Native: hàng ngày tới tuần (chu kỳ review). Enum: không bao giờ (phải recreate type + rewrite mọi column/RLS/RPC phụ thuộc).
- **Không revert được:** (a) enum draft value; (b) binary iOS đã ship; (c) row draft public đã bị Googlebot index (phải request de-index). Ba thứ này là lý do RED.

## Phải verify trước khi merge
- [ ] `quick_tables` draft insert dùng `is_public = false` — chạy: INSERT test row is_public=false rồi SELECT bằng anon key → **PHẢI 0 row**; SELECT bằng owner JWT → **PHẢI 1 row**.
- [ ] KHÔNG `ALTER TYPE ... ADD VALUE 'draft'` trên quick_table_status/team_match_status (dùng cột riêng / localStorage thay thế). Nếu bắt buộc enum → đưa vào PR migration riêng, Cuong duyệt tay.
- [ ] Publish là RPC atomic có version-check; autosave bị disable/drain sau publish (harness race: autosave-in-flight + publish → verify giải không tụt draft).
- [ ] Validation payment (UX-05) chạy server-side dựa trên `fee`/payment mode đã persist, không dựa field visibility.
- [ ] Tách PR native; đồng bộ với nhánh `feat/mlp-captain-registration` (19 commit) trước khi sửa `CreateTeamMatchView.swift` / `CreateDoublesElimView.swift` / `CreateQuickTableView.swift` / `CreateFlexView.swift`.
- [ ] `node scripts/check-bundle-size.mjs` xanh sau khi thêm code UX-01/02/03.
- [ ] Backend đổi phải tương thích client iOS cũ (không đổi nghĩa status hiện có).

## Điều kiện hạ tier (per-increment)
- **UX-01 checklist/status** → 🟢 GREEN nếu presentation-only, không ghi lifecycle state, web-only PR (native tách).
- **UX-02 templates** → 🟡 AMBER: chỉ là initial value editable, template **không** tự bật fee/publish.
- **UX-03 progressive disclosure** → 🟡 AMBER: field ẩn phải clear state; payment mode validate server-side (rủi ro #4).
- **UX-04 draft autosave** → **🔴 RED giữ nguyên**: chỉ hạ xuống AMBER khi (a) không dùng enum ADD VALUE, (b) QuickTable insert is_public=false verified, (c) publish race có version-guard + harness pass. Refine: **social-only autosave là AMBER** (đã có DB draft + RLS an toàn); 4 flow tournament là RED.
- **UX-05 pre-publish validation** → 🟡 AMBER nếu authoritative server-side + atomic với publish; nếu chỉ client-side thì bypass được → vô nghĩa.
- **Native (mọi apple/)** → 🔴 RED tại merge theo precedent DS-03; tách PR hoặc Cuong duyệt tay.

**Verdict tổng: RED.** Cho phép ship theo lát (khuyến nghị GPT-5.6, em đồng ý): instrument → backend draft additive (không enum) → social autosave (AMBER) → 1 flow tournament không tiền → flow có tiền → native cuối, sau khi chứng minh tương thích API cũ/mới.

## Phản biện độc lập (GPT-5.6)
- **Đã xác minh trong repo (survive):**
  - QuickTable autosave leak (#1) — CONFIRMED: `is_public DEFAULT true` + SELECT `USING (is_public=true)` không status gate. Đây là finding mạnh nhất, GPT tìm đúng.
  - Enum irreversible (#2) — CONFIRMED: quick_table_status/team_match_status là enum thật.
  - Publish race, payment-field-hidden, native non-atomic, orphan draft, thiếu instrumentation — plausible/verified, giữ.
  - GPT đúng khi cảnh báo sitemap whitelist KHÔNG bảo vệ quick_tables (chỉ bảo vệ bảng `tournaments`).
- **Bác bỏ:**
  - GPT finding #2 ("insert is_public=false → draft không đọc được kể cả bởi chính chủ, phải service-role"): **SAI**. Repo có sẵn policy thứ hai `"Users can view their own tables" USING (creator_user_id = auth.uid())` — chủ đọc được draft private của mình. Đây là hallucination do brief của em chỉ trích 1 dòng policy `is_public=true`. Thực tế insert `is_public=false` VỪA chống leak VỪA owner-readable → đó chính là cách sửa đúng, không cần service-role. Đã sửa lại thành mitigation của rủi ro #1.

Panel chạy đủ hai model (OPENAI_API_KEY present, GPT-5.6 exit 0).
