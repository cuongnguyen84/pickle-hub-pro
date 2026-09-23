# Báo cáo tổng — đợt cải tiến 17–18/07/2026 (4 cụm /idea → ship)

> Chuỗi việc: Cuong duyệt chạy lần lượt 4 cụm (CodeQL → ARCH-05 → cycle1-residual → ARCH-02),
> ship DB-01c + safeRedirect trước, "làm tiếp cho đến hết".
> Thực thi bởi 2 phiên nối nhau (phiên chiều 17/07 bị session-limit lúc 22:10, phiên đêm nhận
> handoff qua memory và chạy nốt). Mọi con số dưới đây đã xác minh lại trực tiếp trên
> GitHub API / prod sáng 18/07 — không chép từ memory.

## Kết quả cuối (đã xác minh)

| Cụm | Trạng thái | Bằng chứng |
|---|---|---|
| **DB-01c** (bug overbooking member) | ✅ SHIPPED + prod | PR #384 (`d2fc6073`); migration `20260717200000` áp prod, `has_lock=true`, grants đúng; race harness: **đỏ 15/15 trước fix → 90/90 xanh sau**; pgtap CI replay xanh; ledger 287=287 |
| **CodeQL backlog** | ✅ **0 alert mở** (từ 28) | GitHub code-scanning API trả `0`. PR #383 (safeRedirect), #385 (DUPR edge), #386 (content-pipeline), #391 (frontend/Pages + `pr:v30`), #392 (workers); 4 worker đã `wrangler deploy` + probe; 6 alert dismiss có comment lý do + 5 alert mới của fixpoint dismiss "false positive — CodeQL không model do/while" |
| **ARCH-05** (route mirror /vi) | ✅ MERGED | #393 (characterization net 192 route) + #396 (App.tsx → mảng `MIRRORED` 60 entry map 2 lần); parity test chứng minh đúng 3 diff chủ đích; **route mới từ giờ = 1 entry, hết double-edit**; vá luôn bug `/vi/feed`, `/vi/rankings` kẹt EN + `/vi/*` NotFound VI; SocialEventLive defer (chờ audit socket) |
| **cycle1-residual** | ✅ ĐÓNG cả 5 | 3/5 đã fix từ 15/07 (memory cũ — đã đính chính); DUPR_CLIENT_KEY = 64 hex = **256-bit, đủ an toàn**, fingerprint giữ nguyên; gen types root cause = **thiếu `--schema public`** → types.ts regen 127/127 khớp prod (PR #390), lệnh chuẩn đã ghi CLAUDE.md |
| **ARCH-02** | 🟡 increment 1/6 | #397: cancel/reactivate-registration → `handler.ts` + 16 vitest pin error-code, probe prod đúng contract. Increment 2-5 **chưa làm** — cần dựng component-test infra (@testing-library) trước khi đụng RegistrationModal (money path, không rush) |

Prod smoke sáng 18/07: `/` 200 · `/feed` 200 · Googlebot `/rankings` + `/vi/rankings` 200.

## 2 bug sống thật đã vá + 1 false positive đáng nhớ

1. **Overbooking member-path (thật, CONFIRMED bằng chạy):** `register_event_as_member` COUNT→check→INSERT không lock; DB-01 vá sót path này. Tái hiện được 15/15 vòng (2 member cùng thắng ghế cuối). Fix: `pg_advisory_xact_lock` cùng key `event_capacity:<id>` với DB-01 → member/guest/reactivate serialize chung. Đã audit: không còn INSERT `event_registrations` nào ngoài 3 RPC.
2. **SPA-nav /vi kẹt tiếng Anh (thật):** Feed/Rankings bỏ ViLanguageWrapper là bất nhất lịch sử — vá trong #396.
3. **safeRedirect "bug hyphen" = FALSE POSITIVE của panel:** file chứa **byte control thô** render thành `[ -\s]`; cả 4 agent + GPT-5.6 "runtime verify" trên chuỗi hiển thị thay vì byte thật; test suite xanh có sẵn case hyphen mâu thuẫn với claim mà không ai đối chiếu. Hành vi prod luôn đúng. Fix ship = hygiene (escape tường minh `/[\x00-\x1F\x7F\s]/` + pin test). Bài học đã vào `.claude/memory/lessons-learned.md`: **trước khi tin "bug sống" — chạy test hiện có + hexdump dòng nghi vấn.**

Bonus phát hiện qua smoke đêm: 3 ảnh hero blog 404 trên prod (2 row DB đã UPDATE, 1 fix trong #391).

## Khác kế hoạch / trung thực

- 2 PR của phiên chiều (#387 workers, #388 types) bị đóng — phiên đêm làm lại tốt hơn (#392 có deploy+probe; #390 có đối chiếu pg_tables prod). Không mất công việc, chỉ trùng — gotcha "check `gh pr list` trước" đã vào memory.
- `sanitizeBlogHtml` bản merge dùng fixpoint **không cap** (phiên chiều định cap 10 + neutralize): vòng lặp bị chặn tự nhiên vì chuỗi chỉ ngắn dần, đổi lại worst-case O(n²) trên input admin/Gemini — trade-off chấp nhận, có ReDoS test.
- Deploy-guard đỏ transient lúc merge #384 (áp migration qua Management API không tự ghi ledger row kịp thời điểm gate chạy) — tự reconcile, quy trình ghi chú: **ghi ledger trước khi merge**.
- Áp migration prod lần đầu **fail im lặng** (curl exit 43 — token dính 2 dòng trong secrets file) — bắt được nhờ verify `has_lock` trước/sau. Quy tắc giữ: mọi thao tác prod phải có bước verify độc lập ngay sau.

## Việc còn treo (thứ tự đề xuất)

1. **ARCH-02 increment 2-5** — dựng component-test infra trước (characterization RegistrationModal → kéo 7 call về hook → capacity math lib → i18n 4 chuỗi).
2. **Cuong test tay** (mắt người, agent không thay được):
   - Điện thoại thật: từ trang EN bấm SPA-nav sang `/vi/rankings`, `/vi/feed` → tiếng Việt hiện đúng, không kẹt EN.
   - Đăng ký social event + VietQR một vòng (sau #397 contract không đổi, nhưng money path đáng 2 phút mắt).
   - 3 việc treo từ 17/07: push broadcast `/admin/push-notification`, GA4 funnel, referee+spectator 2 trình duyệt.
3. Playwright deploy-race root fix (còn flake dạng alias-preview 404, rerun là qua).
4. PERF-05 chờ ~1 tuần RUM; ARCH-03 chờ quyết định 2 nhánh treo team-match (`feat/team-match-event-discounts`, `feat/mlp-captain-registration`).
5. Roadmap chưa có proposal: DS-02..04, A11Y-02/04, UX-01..08, QA-04/05, PERF-04, OPS-04, CLOSE-02..04.

## Audit trail

- Proposals + panel + debate ledger: `docs/proposals/{codeql-backlog, arch-05-vi-route-mirror, cycle1-residual, arch-02-03-refactor}/` (codeql có mục ĐÍNH CHÍNH về D1).
- Memory: `idea-4-clusters-2026-07-17`, `session-2026-07-18-roadmap-run`, cập nhật `roadmap-cycle1-review-2026-07-15`.
- Dọn dẹp: 2 worktree agent mồ côi đã xoá; branch local+remote đã merge/superseded đã xoá.
